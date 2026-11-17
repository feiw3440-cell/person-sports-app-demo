// /v1/mentorships 与 /v1/authorizations：师徒关系与授权（链路可视化、双审、撤销留痕）
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db, bumpPermVersion } from '../db'
import { requirePerm, rolesOf } from '../rbac'
import { audit } from '../audit'
import { enqueueNotify, pumpOutbox } from '../outbox'
import { applyFlow } from '../statemachine'
import { err, newId, nowISO } from '../util'

function nameOf(accountId: string): string {
  return (db.prepare('SELECT display_name FROM accounts WHERE id = ?').get(accountId) as { display_name: string } | undefined)?.display_name ?? accountId
}

function authOut(id: string): Record<string, unknown> | undefined {
  const row = db.prepare('SELECT * FROM authorizations WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return undefined
  const project = row.scope_project_id ? (db.prepare('SELECT id, name FROM sports_projects WHERE id = ?').get(row.scope_project_id) as { id: string; name: string }) : null
  // 授权链路：从本授权向上找父授权，向下找子授权
  const chainUp: Record<string, unknown>[] = []
  let cur = row.parent_authorization_id as string | null
  while (cur) {
    const parent = db.prepare('SELECT id, grantor_account_id, grantee_account_id, status, term_start, term_end FROM authorizations WHERE id = ?').get(cur) as Record<string, unknown> | undefined
    if (!parent) break
    chainUp.unshift({ id: parent.id, grantor: nameOf(parent.grantor_account_id as string), grantee: nameOf(parent.grantee_account_id as string), status: parent.status })
    cur = parent.parent_authorization_id as string | null
  }
  const chainDown = db
    .prepare('SELECT id, grantor_account_id, grantee_account_id, status, term_start, term_end FROM authorizations WHERE parent_authorization_id = ?')
    .all(id)
    .map((c) => {
      const x = c as Record<string, unknown>
      return { id: x.id, grantor: nameOf(x.grantor_account_id as string), grantee: nameOf(x.grantee_account_id as string), status: x.status }
    })
  return {
    ...row,
    project,
    grantor_name: nameOf(row.grantor_account_id as string),
    grantee_name: nameOf(row.grantee_account_id as string),
    chain_up: chainUp,
    chain_down: chainDown,
  }
}

export async function mentorshipRoutes(app: FastifyInstance): Promise<void> {
  app.get('/mentorships', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'mentorships', 'read')
    let rows: Record<string, unknown>[]
    if (perm.data_scope === 'own_org' && ctx.orgId) {
      // 组织管理员可见本组织成员的师徒关系
      rows = db
        .prepare(
          `SELECT * FROM mentorships
           WHERE mentor_account_id IN (SELECT account_id FROM memberships WHERE org_id = ? AND status = 'accepted')
              OR mentee_account_id IN (SELECT account_id FROM memberships WHERE org_id = ? AND status = 'accepted')
           ORDER BY since DESC`,
        )
        .all(ctx.orgId, ctx.orgId) as Record<string, unknown>[]
    } else {
      rows = db
        .prepare(`SELECT * FROM mentorships WHERE mentor_account_id = ? OR mentee_account_id = ? ORDER BY since DESC`)
        .all(ctx.accountId, ctx.accountId) as Record<string, unknown>[]
    }
    return reply.send({
      data: rows.map((r) => ({ ...r, mentor_name: nameOf(r.mentor_account_id as string), mentee_name: nameOf(r.mentee_account_id as string) })),
      meta: { total: rows.length },
    })
  })

  app.post('/mentorships', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'mentorships', 'write')
    const b = (req.body ?? {}) as { mentee_account_id?: string; kind?: string }
    // 导师建立关系（学员发起的申请在 demo 中由导师直接建立）
    if (perm.data_scope !== 'platform' && !rolesOf(ctx).includes('mentor')) throw err.forbidden('仅导师可建立师徒关系')
    if (!b.mentee_account_id || !['student', 'coach'].includes(b.kind ?? '')) throw err.validation('缺少 mentee_account_id/kind')
    const id = newId('ms_')
    db.prepare('INSERT INTO mentorships(id, mentor_account_id, mentee_account_id, kind, status, since, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)').run(
      id, ctx.accountId, b.mentee_account_id, b.kind, 'active', nowISO(), nowISO(), nowISO(),
    )
    audit(ctx, { action: 'mentorship.create', resourceType: 'mentorship', resourceId: id, after: { kind: b.kind } })
    enqueueNotify({
      targetAccountId: b.mentee_account_id, category: 'mentorship', kind: 'mentorship',
      title: '已建立师徒关系', body: '可在「师徒与授权」中查看（演示通知）', bizRefType: 'mentorship', bizRefId: id,
    })
    pumpOutbox()
    return reply.code(201).send({ data: { id } })
  })

  /* ===== 授权 ===== */
  app.get('/authorizations', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'authorizations', 'read')
    const q = req.query as { status?: string }
    const stSql = q.status ? ' AND status = ?' : ''
    const stArg = q.status ?? ''
    const ids: { id: string }[] = []
    // 本人相关
    ids.push(
      ...(db
        .prepare(`SELECT id FROM authorizations WHERE (grantor_account_id = ? OR grantee_account_id = ?)${stSql} ORDER BY created_at DESC`)
        .all(...(q.status ? [ctx.accountId, ctx.accountId, stArg] : [ctx.accountId, ctx.accountId])) as { id: string }[]),
    )
    // 组织管理员：本组织成员的授权
    if (perm.data_scope === 'own_org' && ctx.orgId) {
      ids.push(
        ...(db
          .prepare(
            `SELECT id FROM authorizations WHERE (grantor_account_id IN (SELECT account_id FROM memberships WHERE org_id = ? AND status = 'accepted')
             OR grantee_account_id IN (SELECT account_id FROM memberships WHERE org_id = ? AND status = 'accepted'))${stSql} ORDER BY created_at DESC`,
          )
          .all(...(q.status ? [ctx.orgId, ctx.orgId, stArg] : [ctx.orgId, ctx.orgId])) as { id: string }[]),
      )
    }
    // 审批人视角：平台 reviewer 可见全部
    const roles = rolesOf(ctx)
    if (roles.some((r) => ['reviewer', 'platform_admin', 'platform_ops'].includes(r))) {
      ids.push(...(db.prepare(`SELECT id FROM authorizations WHERE 1=1${stSql} ORDER BY created_at DESC`).all(...(q.status ? [stArg] : [])) as { id: string }[]))
    }
    const seen = new Set<string>()
    const out: Record<string, unknown>[] = []
    for (const { id } of ids) {
      if (seen.has(id)) continue
      seen.add(id)
      const d = authOut(id)
      if (d) out.push(d)
    }
    return reply.send({ data: out, meta: { total: out.length } })
  })

  app.get('/authorizations/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'authorizations', 'read')
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT * FROM authorizations WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    const roles = rolesOf(ctx)
    const involved = row.grantor_account_id === ctx.accountId || row.grantee_account_id === ctx.accountId
    if (!involved && !roles.some((r) => ['reviewer', 'platform_admin', 'platform_ops'].includes(r))) throw err.forbidden()
    const history = db
      .prepare("SELECT action, reason, created_at, client FROM audit_logs WHERE resource_type = 'authorization' AND resource_id = ? ORDER BY created_at DESC")
      .all(id)
    return reply.send({ data: { ...authOut(id), state_history: history } })
  })

  app.post('/authorizations', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'authorizations', 'write')
    const b = (req.body ?? {}) as {
      mentorship_id?: string; scope_project_id?: string; scope_content?: string; scope_region?: string
      term_start?: string; term_end?: string; allow_sub_grant?: boolean; parent_authorization_id?: string
    }
    if (!b.mentorship_id || !b.term_start || !b.term_end) throw err.validation('缺少 mentorship_id/term_start/term_end')
    const ms = db.prepare('SELECT * FROM mentorships WHERE id = ?').get(b.mentorship_id) as Record<string, unknown> | undefined
    if (!ms) throw err.forbidden('师徒关系不存在')
    // grantor 必须是关系中的导师方
    if (ms.mentor_account_id !== ctx.accountId && !rolesOf(ctx).some((r) => ['platform_admin', 'platform_ops'].includes(r))) {
      throw err.forbidden('仅导师本人可发起授权')
    }
    if (b.parent_authorization_id) {
      const parent = db.prepare('SELECT * FROM authorizations WHERE id = ?').get(b.parent_authorization_id) as Record<string, unknown> | undefined
      if (!parent) throw err.forbidden('上级授权不存在')
      if (parent.status !== 'active') throw err.state('上级授权未生效，不能再授权')
      if (!parent.allow_sub_grant) throw err.state('上级授权不允许再授权')
      // 再授权链：被授权人作为新 grantor
      const id = newId('az_')
      db.prepare(
        'INSERT INTO authorizations(id, mentorship_id, grantor_account_id, grantee_account_id, scope_project_id, scope_content, scope_region, term_start, term_end, allow_sub_grant, parent_authorization_id, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
      ).run(id, b.mentorship_id, parent.grantee_account_id as string, ms.mentee_account_id as string, b.scope_project_id ?? null, b.scope_content ?? null, b.scope_region ?? null, b.term_start, b.term_end, b.allow_sub_grant ? 1 : 0, b.parent_authorization_id, 'draft', nowISO(), nowISO())
      audit(ctx, { action: 'authorization.create_sub', resourceType: 'authorization', resourceId: id, after: { parent: b.parent_authorization_id } })
      return reply.code(201).send({ data: { id } })
    }
    const id = newId('az_')
    db.prepare(
      'INSERT INTO authorizations(id, mentorship_id, grantor_account_id, grantee_account_id, scope_project_id, scope_content, scope_region, term_start, term_end, allow_sub_grant, parent_authorization_id, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
    ).run(id, b.mentorship_id, ctx.accountId, ms.mentee_account_id as string, b.scope_project_id ?? null, b.scope_content ?? null, b.scope_region ?? null, b.term_start, b.term_end, b.allow_sub_grant ? 1 : 0, null, 'draft', nowISO(), nowISO())
    audit(ctx, { action: 'authorization.create', resourceType: 'authorization', resourceId: id, after: { mentorship: b.mentorship_id } })
    return reply.code(201).send({ data: { id } })
  })

  app.post('/authorizations/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, reason, version } = (req.body ?? {}) as { action: string; reason?: string; version?: number }
    const row = db.prepare('SELECT * FROM authorizations WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    const roles = rolesOf(ctx)
    const isGrantor = row.grantor_account_id === ctx.accountId
    const isGrantee = row.grantee_account_id === ctx.accountId
    const isPlatformReviewer = roles.some((r) => ['reviewer', 'platform_admin', 'platform_ops'].includes(r))
    if (['submit', 'revoke'].includes(action)) {
      if (!isGrantor && !isPlatformReviewer) throw err.forbidden('仅授权方或平台可执行')
      if (action === 'revoke' && !reason) throw err.validation('撤销授权必须填写 reason')
    } else if (action === 'approve') {
      // 双审：授权方 + 平台 reviewer（demo：同一账号若同时具备两种角色需两次调用？——按权限矩阵记录 grantor 与平台各一次）
      if (!isGrantor && !isPlatformReviewer) throw err.forbidden()
    } else if (action === 'reject') {
      if (!isGrantor && !isPlatformReviewer) throw err.forbidden()
      if (!reason) throw err.validation('驳回须填写 reason')
    } else {
      throw err.validation('action 不合法')
    }
    const result = applyFlow(ctx, `authorization.${action}`, { status: row.status as string, version: row.version as number }, { action, reason, version })
    db.prepare('UPDATE authorizations SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(result.after, nowISO(), id)
    audit(ctx, { action: `authorization.${action}`, resourceType: 'authorization', resourceId: id, before: { status: result.before }, after: { status: result.after }, reason })
    // 通知双方（到期/撤销需通知双方——PRD §14）
    for (const target of [row.grantor_account_id, row.grantee_account_id]) {
      enqueueNotify({
        targetAccountId: target as string, category: 'mentorship', kind: 'auth',
        title: `授权已${action === 'approve' ? '生效' : action === 'revoke' ? '撤销' : action === 'reject' ? '驳回' : '更新'}`,
        body: reason ? `原因：${reason}` : '状态已更新（演示通知）', bizRefType: 'authorization', bizRefId: id,
      })
    }
    pumpOutbox()
    bumpPermVersion()
    return reply.send({ data: { id, status: result.after, version: (row.version as number) + 1 } })
  })
}
