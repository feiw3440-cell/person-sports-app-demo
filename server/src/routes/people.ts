// /v1/people：人员档案（隐私字段按 visibility 与权限裁剪）+ 资质审核
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db } from '../db'
import { requirePerm, rolesOf, mentorGrantedAccountIds } from '../rbac'
import { audit } from '../audit'
import { applyFlow } from '../statemachine'
import { idempotencyReplay, idempotencySave } from '../helpers'
import { err, newId, nowISO } from '../util'

type ProfileRow = {
  id: string; account_id: string; kind: string; title: string | null; bio: string | null
  region: string | null; achievements: string | null; career: string | null; mentor_info: string | null
  verify_status: string; visibility: string | null; version: number; created_at: string; updated_at: string
}

function canSeeSensitive(viewerRoles: string[], viewerAccountId: string, profile: ProfileRow): boolean {
  if (viewerAccountId === profile.account_id) return true
  if (viewerRoles.some((r) => ['platform_admin', 'platform_ops', 'reviewer'].includes(r))) return true
  // org_admin/coach 在自己组织范围内由查询层保证；联系方式类敏感字段仅 org_admin 可见
  return viewerRoles.includes('org_admin')
}

function profileOut(row: ProfileRow, viewerRoles: string[], viewerAccountId: string, extra?: Record<string, unknown>) {
  const sensitive = canSeeSensitive(viewerRoles, viewerAccountId, row)
  return {
    id: row.id, account_id: row.account_id, kind: row.kind, title: row.title, bio: row.bio, region: row.region,
    achievements: row.achievements ? JSON.parse(row.achievements) : [],
    career: row.career ? JSON.parse(row.career) : [],
    mentor_info: row.mentor_info ? JSON.parse(row.mentor_info) : null,
    verify_status: row.verify_status, version: row.version, created_at: row.created_at, updated_at: row.updated_at,
    contact_phone: sensitive ? extra?.phone ?? null : null, // 隐私：非授权视角不返回
    display_name: extra?.display_name ?? null, avatar_url: extra?.avatar_url ?? null, login_name: sensitive ? extra?.login_name ?? null : null,
  }
}

export async function peopleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/people', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'people', 'read')
    const q = req.query as { kind?: string; keyword?: string; project_id?: string; org_id?: string; verify?: string; page?: string; page_size?: string }
    const toPositiveInt = (value: string | undefined, name: string, fallback: number): number => {
      if (value === undefined || value === '') return fallback
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1) throw err.validation(`${name} 必须为正整数`)
      return n
    }
    const page = toPositiveInt(q.page, 'page', 1)
    const pageSize = Math.min(toPositiveInt(q.page_size, 'page_size', 20), 100)
    const viewerRoles = rolesOf(ctx)
    const where: string[] = []
    const args: unknown[] = []
    if (q.kind) { where.push('p.kind = ?'); args.push(q.kind) }
    if (q.verify) { where.push('p.verify_status = ?'); args.push(q.verify) }
    if (q.keyword) {
      where.push("(a.display_name LIKE ? OR IFNULL(p.title, '') LIKE ? OR IFNULL(p.region, '') LIKE ?)")
      const kw = `%${q.keyword}%`
      args.push(kw, kw, kw)
    }
    if (q.project_id) {
      where.push('p.id IN (SELECT profile_id FROM profile_project_links WHERE project_id = ?)')
      args.push(q.project_id)
    }
    // 数据范围裁剪：self → 本人档案；own_org → 本组织成员档案；granted_scope → 师徒/授权范围；platform/all → 全部
    if (perm.data_scope === 'self') {
      where.push('p.account_id = ?'); args.push(ctx.accountId)
    } else if (perm.data_scope === 'own_org') {
      const orgId = q.org_id && q.org_id === ctx.orgId ? ctx.orgId : ctx.orgId
      if (!orgId) return reply.send({ data: [], meta: { total: 0, page, page_size: pageSize } })
      where.push('p.account_id IN (SELECT account_id FROM memberships WHERE org_id = ? AND status = ?)')
      args.push(orgId, 'accepted')
    } else if (perm.data_scope === 'granted_scope') {
      const mentees = mentorGrantedAccountIds(ctx)
      if (mentees.length === 0) return reply.send({ data: [], meta: { total: 0, page, page_size: pageSize } })
      where.push(`p.account_id IN (${mentees.map(() => '?').join(',')})`)
      args.push(...mentees)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = db.prepare(`SELECT COUNT(*) AS c FROM person_profiles p JOIN accounts a ON a.id = p.account_id ${whereSql}`).get(...args) as { c: number }
    const rows = db
      .prepare(
        `SELECT p.*, a.display_name, a.avatar_url, a.login_name, a.phone FROM person_profiles p JOIN accounts a ON a.id = p.account_id
         ${whereSql} ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, (page - 1) * pageSize) as (ProfileRow & { display_name: string; avatar_url: string | null; login_name: string; phone: string | null })[]
    return reply.send({
      data: rows.map((r) => profileOut(r, viewerRoles, ctx.accountId, { phone: r.phone, display_name: r.display_name, avatar_url: r.avatar_url, login_name: r.login_name })),
      meta: { total: total.c, page, page_size: pageSize },
    })
  })

  app.get('/people/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'people', 'read')
    const { id } = req.params as { id: string }
    const row = db
      .prepare('SELECT p.*, a.display_name, a.avatar_url, a.login_name, a.phone FROM person_profiles p JOIN accounts a ON a.id = p.account_id WHERE p.id = ?')
      .get(id) as (ProfileRow & { display_name: string; avatar_url: string | null; login_name: string; phone: string | null }) | undefined
    if (!row) throw err.forbidden()
    // 资源级归属复核：self / granted_scope / 本组织
    if (perm.data_scope === 'self' && row.account_id !== ctx.accountId) throw err.forbidden()
    if (perm.data_scope === 'granted_scope' && !mentorGrantedAccountIds(ctx).includes(row.account_id) && row.account_id !== ctx.accountId) throw err.forbidden()
    if (perm.data_scope === 'own_org') {
      const m = db.prepare("SELECT id FROM memberships WHERE account_id = ? AND org_id = ? AND status = 'accepted'").get(row.account_id, ctx.orgId)
      if (!m) throw err.forbidden()
    }
    const projects = db
      .prepare('SELECT s.id, s.name, l.is_primary FROM profile_project_links l JOIN sports_projects s ON s.id = l.project_id WHERE l.profile_id = ?')
      .all(id)
    const creds = db
      .prepare(
        `SELECT c.id, c.kind, c.source, c.status, c.valid_until, c.reviewed_at, c.reason, i.identity_type, i.label
         FROM credentials c JOIN identities i ON i.id = c.identity_id WHERE i.account_id = ? ORDER BY c.created_at DESC`,
      )
      .all(row.account_id)
    const history = db
      .prepare("SELECT action, reason, created_at, client FROM audit_logs WHERE resource_type = 'credential' AND resource_id IN (SELECT id FROM credentials WHERE identity_id IN (SELECT id FROM identities WHERE account_id = ?)) ORDER BY created_at DESC LIMIT 20")
      .all(row.account_id)
    return reply.send({ data: { ...profileOut(row, rolesOf(ctx), ctx.accountId, { phone: row.phone, display_name: row.display_name, avatar_url: row.avatar_url, login_name: row.login_name }), projects, credentials: creds, state_history: history } })
  })

  app.patch('/people/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT * FROM person_profiles WHERE id = ?').get(id) as ProfileRow | undefined
    if (!row) throw err.forbidden()
    if (row.account_id !== ctx.accountId) {
      // org_admin 可改本组织成员档案的基本字段
      requirePerm(ctx, 'people', 'write')
      const m = db.prepare("SELECT id FROM memberships WHERE account_id = ? AND org_id = ? AND status = 'accepted'").get(row.account_id, ctx.orgId)
      if (!m) throw err.forbidden()
    }
    const b = (req.body ?? {}) as { title?: string; bio?: string; region?: string; version?: number }
    if (typeof b.version === 'number' && b.version !== row.version) throw err.conflict('VERSION_CONFLICT', '档案已被修改，请刷新', { current_version: row.version })
    const fields: Record<string, string | null> = {}
    for (const k of ['title', 'bio', 'region'] as const) if (b[k] !== undefined) fields[k] = String(b[k])
    if (Object.keys(fields).length === 0) throw err.validation('无可更新字段')
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE person_profiles SET ${sets}, updated_at = @updated_at, version = version + 1 WHERE id = @id`).run({ ...fields, updated_at: nowISO(), id })
    audit(ctx, { action: 'people.update', resourceType: 'profile', resourceId: id, before: { title: row.title }, after: fields })
    return reply.send({ data: { id, version: row.version + 1 } })
  })

  /* 资质审核（reviewer/platform_admin；本人可 submit/resubmit） */
  app.post('/credentials/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, reason, version } = (req.body ?? {}) as { action: string; reason?: string; version?: number }
    const row = db.prepare('SELECT * FROM credentials WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    const owner = db.prepare('SELECT account_id FROM identities WHERE id = ?').get(row.identity_id) as { account_id: string }
    const reviewActions = ['start_review', 'approve', 'reject']
    if (reviewActions.includes(action)) {
      requirePerm(ctx, 'credentials', 'review')
      if (['approve', 'reject'].includes(action) && !reason) throw err.validation('驳回/通过资质须填写 reason（审核留痕）')
    } else if (['submit', 'resubmit'].includes(action)) {
      if (owner.account_id !== ctx.accountId) throw err.forbidden('只能提交本人资质')
    } else {
      throw err.validation('action 不合法')
    }
    const result = applyFlow(ctx, `credential.${action}`, { status: row.status as string, version: row.version as number }, { action, reason, version })
    const isReview = reviewActions.includes(action)
    db.prepare('UPDATE credentials SET status = ?, reviewed_by = ?, reviewed_at = ?, reason = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(
      result.after, isReview ? ctx.accountId : (row.reviewed_by as string | null), isReview ? nowISO() : (row.reviewed_at as string | null), reason ?? null, nowISO(), id,
    )
    // 审核通过 → 身份转 active
    if (action === 'approve') {
      db.prepare("UPDATE identities SET status = 'active', updated_at = ?, version = version + 1 WHERE id = ?").run(nowISO(), row.identity_id)
    }
    if (action === 'reject') {
      db.prepare("UPDATE identities SET status = 'rejected', updated_at = ?, version = version + 1 WHERE id = ?").run(nowISO(), row.identity_id)
    }
    audit(ctx, { action: `credential.${action}`, resourceType: 'credential', resourceId: id, before: { status: result.before }, after: { status: result.after }, reason })
    return reply.send({ data: { id, status: result.after, version: (row.version as number) + 1 } })
  })

  /* ===== 导师申请（闭环核心：APP 提交 → 平台审核 → identity 升级 mentor） ===== */
  // 申请创建（本人）：创建/复用 pending mentor identity + submitted credential；已是导师或申请进行中返回 409
  app.post('/credentials', async (req, reply) => {
    const ctx = requireAuth(req)
    const replay = idempotencyReplay(req, ctx.accountId)
    if (replay) {
      reply.header('Idempotency-Replayed', 'true')
      reply.code(replay.status)
      return replay.body
    }
    const b = (req.body ?? {}) as { kind?: string; source?: string; evidence?: string }
    const kind = String(b.kind ?? '').trim()
    if (!kind) throw err.validation('缺少资质名称（kind）')
    const source = String(b.source ?? 'app_self_apply').trim()
    const evidence = b.evidence ? String(b.evidence) : null
    if (kind.length > 100) throw err.validation('资质名称过长（≤100）')

    const activeMentor = db
      .prepare("SELECT id FROM identities WHERE account_id = ? AND identity_type = 'mentor' AND status = 'active'")
      .get(ctx.accountId) as { id: string } | undefined
    if (activeMentor) throw err.conflict('ALREADY_MENTOR', '已拥有认证导师身份，无需重复申请')

    const inProgress = db
      .prepare(
        `SELECT c.id FROM credentials c JOIN identities i ON i.id = c.identity_id
         WHERE i.account_id = ? AND i.identity_type = 'mentor' AND c.status IN ('draft','submitted','under_review','resubmitted')`,
      )
      .get(ctx.accountId) as { id: string } | undefined
    if (inProgress) throw err.conflict('APPLICATION_IN_PROGRESS', '已有进行中的导师申请（审核中）', { credential_id: inProgress.id })

    // 创建或复用 mentor identity：rejected 可重新申请（置回 pending），否则新建 pending
    let identity = db
      .prepare("SELECT id FROM identities WHERE account_id = ? AND identity_type = 'mentor'")
      .get(ctx.accountId) as { id: string } | undefined
    if (identity) {
      db.prepare("UPDATE identities SET status = 'pending', updated_at = ?, version = version + 1 WHERE id = ?").run(nowISO(), identity.id)
    } else {
      identity = { id: newId('idn_') }
      db.prepare(
        "INSERT INTO identities(id, account_id, identity_type, label, status, created_at, updated_at, version) VALUES (?, ?, 'mentor', ?, 'pending', ?, ?, 1)",
      ).run(identity.id, ctx.accountId, '认证导师（等级占位名·规则待确认）', nowISO(), nowISO())
    }

    const credId = newId('cr_')
    db.prepare(
      "INSERT INTO credentials(id, identity_id, kind, source, evidence, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, 1)",
    ).run(credId, identity.id, kind, source, evidence, nowISO(), nowISO())
    audit(ctx, {
      action: 'credential.create',
      resourceType: 'credential',
      resourceId: credId,
      after: { kind, source, identity_id: identity.id, status: 'submitted' },
    })
    const body = { data: { id: credId, identity_id: identity.id, status: 'submitted', kind } }
    idempotencySave(req, ctx.accountId, 201, body)
    reply.code(201)
    return reply.send(body)
  })

  // 本人申请记录（APP 进度展示）
  app.get('/credentials/mine', async (req, reply) => {
    const ctx = requireAuth(req)
    const rows = db
      .prepare(
        `SELECT c.id, c.kind, c.source, c.evidence, c.status, c.reason, c.reviewed_at, c.created_at, c.updated_at, c.version,
                i.identity_type, i.label, i.status AS identity_status
         FROM credentials c JOIN identities i ON i.id = c.identity_id
         WHERE i.account_id = ? ORDER BY c.created_at DESC`,
      )
      .all(ctx.accountId)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  // 审核列表（reviewer/platform_ops/platform_admin）：credentials.review 权限
  app.get('/credentials', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'credentials', 'review')
    const q = req.query as { status?: string; page?: string; page_size?: string }
    const toPositiveInt = (value: string | undefined, name: string, fallback: number): number => {
      if (value === undefined || value === '') return fallback
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1) throw err.validation(`${name} 必须为正整数`)
      return n
    }
    const page = toPositiveInt(q.page, 'page', 1)
    const pageSize = Math.min(toPositiveInt(q.page_size, 'page_size', 20), 100)
    const where: string[] = []
    const args: unknown[] = []
    if (q.status) { where.push('c.status = ?'); args.push(q.status) }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM credentials c ${whereSql}`).get(...args) as { c: number }).c
    const rows = db
      .prepare(
        `SELECT c.id, c.kind, c.source, c.evidence, c.status, c.valid_until, c.reason, c.reviewed_by, c.reviewed_at,
                c.created_at, c.updated_at, c.version,
                i.identity_type, i.label, i.status AS identity_status,
                a.display_name, p.id AS profile_id
         FROM credentials c
         JOIN identities i ON i.id = c.identity_id
         JOIN accounts a ON a.id = i.account_id
         LEFT JOIN person_profiles p ON p.account_id = i.account_id
         ${whereSql}
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, (page - 1) * pageSize)
    return reply.send({ data: rows, meta: { total, page, page_size: pageSize } })
  })

  /* 导出（单独授权 + 审计）：CSV 返回 */
  app.post('/people/export', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'people', 'export')
    const { kind } = (req.body ?? {}) as { kind?: string }
    const args: unknown[] = []
    let whereSql = ''
    if (kind) { whereSql = 'WHERE p.kind = ?'; args.push(kind) }
    if (!rolesOf(ctx).some((r) => ['platform_admin', 'platform_ops'].includes(r))) {
      // org_admin → 仅本组织
      whereSql = `${whereSql ? `${whereSql} AND` : 'WHERE'} p.account_id IN (SELECT account_id FROM memberships WHERE org_id = ? AND status = 'accepted')`
      args.push(ctx.orgId)
    }
    const rows = db
      .prepare(`SELECT p.id, a.display_name, p.kind, p.title, p.region, p.verify_status FROM person_profiles p JOIN accounts a ON a.id = p.account_id ${whereSql}`)
      .all(...args) as Record<string, unknown>[]
    const csv = ['id,display_name,kind,title,region,verify_status', ...rows.map((r) => [r.id, r.display_name, r.kind, r.title, r.region, r.verify_status].join(','))].join('\n')
    audit(ctx, { action: 'people.export', resourceType: 'people', after: { count: rows.length, kind: kind ?? 'all' } })
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="people-export-${Date.now()}.csv"`)
    return reply.send(`\uFEFF${csv}`)
  })
}
