// /v1/competitions：赛事、报名（闭环核心）、赛程、成绩（修订留痕）、选拔
import type { FastifyInstance } from 'fastify'
import { requireAuth, type AuthContext } from '../auth'
import { db } from '../db'
import { requirePerm, rolesOf } from '../rbac'
import { audit } from '../audit'
import { enqueueNotify, pumpOutbox } from '../outbox'
import { applyFlow } from '../statemachine'
import { assertVersion, idempotencyReplay, idempotencySave } from '../helpers'
import { err, newId, nowISO } from '../util'

function competitionOut(id: string): Record<string, unknown> | undefined {
  const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return undefined
  const projects = db.prepare('SELECT s.id, s.name FROM competition_project_links l JOIN sports_projects s ON s.id = l.project_id WHERE l.competition_id = ?').all(id)
  const org = row.organizer_org_id ? (db.prepare('SELECT name, region FROM organizations WHERE id = ?').get(row.organizer_org_id) as { name: string; region: string }) : null
  const regCount = db.prepare("SELECT COUNT(*) AS c FROM registrations WHERE competition_id = ? AND status = 'approved'").get(id) as { c: number }
  const pendCount = db.prepare("SELECT COUNT(*) AS c FROM registrations WHERE competition_id = ? AND status = 'pending'").get(id) as { c: number }
  return {
    ...row, projects, org_name: org?.name ?? null, organizer_name: org?.name ?? null, region: org?.region ?? '',
    project_ids: (projects as { id: string }[]).map((p) => p.id),
    approved_count: regCount.c, pending_count: pendCount.c, enrolled: regCount.c,
  }
}

/** 赛事管理权：主办方组织 org_admin / 受派的 event_organizer / 平台 */
function canManageCompetition(ctx: AuthContext, comp: { organizer_org_id: string | null }): boolean {
  const roles = rolesOf(ctx)
  if (roles.includes('platform_admin') || roles.includes('platform_ops')) return true
  if (comp.organizer_org_id && ctx.orgId === comp.organizer_org_id && roles.includes('org_admin')) return true
  if (roles.includes('event_organizer') && comp.organizer_org_id && ctx.orgId === comp.organizer_org_id) return true
  return false
}

export async function competitionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/competitions', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'competitions', 'read')
    const q = req.query as { keyword?: string; status?: string; project_id?: string; page?: string; page_size?: string }
    const page = Number(q.page || 1)
    const pageSize = Math.min(Number(q.page_size || 20), 100)
    const where: string[] = []
    const args: unknown[] = []
    if (q.status) { where.push('c.status = ?'); args.push(q.status) }
    if (q.keyword) { where.push('c.name LIKE ?'); args.push(`%${q.keyword}%`) }
    if (q.project_id) { where.push('c.id IN (SELECT competition_id FROM competition_project_links WHERE project_id = ?)'); args.push(q.project_id) }
    if (perm.data_scope === 'own_org') { where.push('c.organizer_org_id = ?'); args.push(ctx.orgId) }
    else { where.push("c.status NOT IN ('draft')") }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = db.prepare(`SELECT COUNT(*) AS c FROM competitions c ${whereSql}`).get(...args) as { c: number }
    const rows = db.prepare(`SELECT c.* FROM competitions c ${whereSql} ORDER BY c.date_start DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize) as { id: string }[]
    return reply.send({ data: rows.map((r) => competitionOut(r.id)), meta: { total: total.c, page, page_size: pageSize } })
  })

  app.get('/competitions/:id', async (req, reply) => {
    requireAuth(req)
    const { id } = req.params as { id: string }
    const detail = competitionOut(id)
    if (!detail || (detail as { status: string }).status === 'draft') {
      const ctx = requireAuth(req)
      if (!detail || !canManageCompetition(ctx, detail as unknown as { organizer_org_id: string | null })) throw err.forbidden()
    }
    return reply.send({ data: detail })
  })

  app.post('/competitions', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'competitions', 'write')
    const b = (req.body ?? {}) as { name?: string; date_start?: string; date_end?: string; location?: string; intro?: string; quota?: number; project_ids?: string[] }
    if (!b.name || !b.date_start || !b.date_end) throw err.validation('缺少 name/date_start/date_end')
    const id = newId('cmp_')
    db.prepare(
      'INSERT INTO competitions(id, name, organizer_org_id, date_start, date_end, location, intro, quota, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
    ).run(id, b.name, ctx.orgId ?? null, b.date_start, b.date_end, b.location ?? null, b.intro ?? null, b.quota ?? null, 'draft', nowISO(), nowISO())
    for (const pid of b.project_ids ?? []) {
      db.prepare('INSERT OR IGNORE INTO competition_project_links(competition_id, project_id) VALUES (?, ?)').run(id, pid)
    }
    audit(ctx, { action: 'competition.create', resourceType: 'competition', resourceId: id, after: { name: b.name } })
    return reply.code(201).send({ data: { id, version: 1 } })
  })

  app.patch('/competitions/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row || !canManageCompetition(ctx, row as unknown as { organizer_org_id: string | null })) throw err.forbidden()
    assertVersion(row as { version: number }, (req.body as { version?: number }).version)
    const b = (req.body ?? {}) as { name?: string; location?: string; intro?: string; quota?: number; version?: number }
    const fields: Record<string, string | number | null> = {}
    for (const k of ['name', 'location', 'intro'] as const) if (b[k] !== undefined) fields[k] = String(b[k])
    if (b.quota !== undefined) fields.quota = b.quota
    if (Object.keys(fields).length === 0) throw err.validation('无可更新字段')
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE competitions SET ${sets}, updated_at = @updated_at, version = version + 1 WHERE id = @id`).run({ ...fields, updated_at: nowISO(), id })
    audit(ctx, { action: 'competition.update', resourceType: 'competition', resourceId: id, after: fields })
    return reply.send({ data: { id, version: (row.version as number) + 1 } })
  })

  app.post('/competitions/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, version } = (req.body ?? {}) as { action: string; version?: number }
    const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row || !canManageCompetition(ctx, row as unknown as { organizer_org_id: string | null })) throw err.forbidden()
    const result = applyFlow(ctx, `competition.${action}`, { status: row.status as string, version: row.version as number }, { action, version })
    db.prepare('UPDATE competitions SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(result.after, nowISO(), id)
    audit(ctx, { action: `competition.${action}`, resourceType: 'competition', resourceId: id, before: { status: result.before }, after: { status: result.after } })
    return reply.send({ data: { id, status: result.after, version: (row.version as number) + 1 } })
  })

  /* ===== 赛事报名（闭环核心：APP 提交 → PC 审核 → APP 收结果） ===== */
  app.post('/registrations', async (req, reply) => {
    const ctx = requireAuth(req)
    const replay = idempotencyReplay(req, ctx.accountId)
    if (replay) {
      reply.header('Idempotency-Replayed', 'true')
      reply.code(replay.status)
      return replay.body
    }
    const b = (req.body ?? {}) as { competition_id?: string }
    if (!b.competition_id) throw err.validation('缺少 competition_id')
    const comp = db.prepare('SELECT id, name, status, quota FROM competitions WHERE id = ?').get(b.competition_id) as
      | { id: string; name: string; status: string; quota: number | null }
      | undefined
    if (!comp) throw err.forbidden()
    if (comp.status !== 'published') throw err.state('赛事当前不可报名（状态：' + comp.status + '）')
    const approved = db.prepare("SELECT COUNT(*) AS c FROM registrations WHERE competition_id = ? AND status = 'approved'").get(b.competition_id) as { c: number }
    if (comp.quota && approved.c >= comp.quota) throw err.state('名额已满')
    const dup = db.prepare('SELECT id, status FROM registrations WHERE competition_id = ? AND account_id = ?').get(b.competition_id, ctx.accountId) as
      | { id: string; status: string }
      | undefined
    if (dup && !['rejected', 'cancelled'].includes(dup.status)) throw err.state('已存在报名记录（不可重复报名）')
    let regId: string
    if (dup) {
      db.prepare('UPDATE registrations SET status = ?, decided_by = NULL, decided_at = NULL, reason = NULL, updated_at = ?, version = version + 1 WHERE id = ?').run('pending', nowISO(), dup.id)
      regId = dup.id
    } else {
      regId = newId('rg_')
      db.prepare('INSERT INTO registrations(id, competition_id, account_id, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, 1)').run(
        regId, b.competition_id, ctx.accountId, 'pending', nowISO(), nowISO(),
      )
    }
    audit(ctx, { action: 'registration.create', resourceType: 'registration', resourceId: regId, after: { competition_id: b.competition_id } })
    // 通知主办方组织的管理员（PC 待办可见）
    const compRow = db.prepare('SELECT organizer_org_id FROM competitions WHERE id = ?').get(b.competition_id) as { organizer_org_id: string | null }
    const admins = compRow.organizer_org_id
      ? (db.prepare("SELECT account_id FROM memberships WHERE org_id = ? AND role = 'org_admin' AND status = 'accepted'").all(compRow.organizer_org_id) as { account_id: string }[])
      : []
    for (const adm of admins) {
      enqueueNotify({
        targetAccountId: adm.account_id, category: 'biz', kind: 'event',
        title: '新的赛事报名待审核',
        body: `「${comp.name}」收到报名（演示通知）`, bizRefType: 'registration', bizRefId: regId,
      })
    }
    pumpOutbox()
    const body = { data: { id: regId, status: 'pending', competition_id: b.competition_id } }
    idempotencySave(req, ctx.accountId, 201, body)
    return reply.code(201).send(body)
  })

  app.get('/registrations', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'registrations', 'read')
    const q = req.query as { competition_id?: string; status?: string; page?: string; page_size?: string }
    const page = Number(q.page || 1)
    const pageSize = Math.min(Number(q.page_size || 20), 100)
    const where: string[] = []
    const args: unknown[] = []
    if (q.status) { where.push('r.status = ?'); args.push(q.status) }
    if (q.competition_id) { where.push('r.competition_id = ?'); args.push(q.competition_id) }
    if (perm.data_scope === 'self') { where.push('r.account_id = ?'); args.push(ctx.accountId) }
    else if (perm.data_scope === 'own_org') { where.push('c.organizer_org_id = ?'); args.push(ctx.orgId) }
    else if (perm.data_scope === 'granted_scope') {
      where.push('c.organizer_org_id IN (SELECT org_id FROM memberships WHERE account_id = ? AND role = ? AND status = ?)')
      args.push(ctx.accountId, 'org_admin', 'accepted')
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = db.prepare(`SELECT COUNT(*) AS c FROM registrations r JOIN competitions c ON c.id = r.competition_id ${whereSql}`).get(...args) as { c: number }
    const rows = db
      .prepare(
        `SELECT r.*, c.name AS competition_name, a.display_name AS account_name
         FROM registrations r JOIN competitions c ON c.id = r.competition_id JOIN accounts a ON a.id = r.account_id
         ${whereSql} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, (page - 1) * pageSize)
    return reply.send({ data: rows, meta: { total: total.c, page, page_size: pageSize } })
  })

  app.post('/registrations/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, reason, version } = (req.body ?? {}) as { action: string; reason?: string; version?: number }
    const row = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    const comp = db.prepare('SELECT * FROM competitions WHERE id = ?').get(row.competition_id) as Record<string, unknown>
    if (['approve', 'reject'].includes(action)) {
      requirePerm(ctx, 'registrations', 'review')
      if (!canManageCompetition(ctx, comp as unknown as { organizer_org_id: string | null })) throw err.forbidden('仅赛事主办方或平台可审核')
      if (!reason) throw err.validation('审核须填写 reason（留痕）')
    } else if (action === 'cancel') {
      if (row.account_id !== ctx.accountId) throw err.forbidden('只能取消本人报名')
    } else {
      throw err.validation('action 不合法')
    }
    const result = applyFlow(ctx, `registration.${action}`, { status: row.status as string, version: row.version as number }, { action, reason, version })
    db.prepare('UPDATE registrations SET status = ?, decided_by = ?, decided_at = ?, reason = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(
      result.after, ['approve', 'reject'].includes(action) ? ctx.accountId : (row.decided_by as string | null),
      ['approve', 'reject'].includes(action) ? nowISO() : (row.decided_at as string | null),
      reason ?? null, nowISO(), id,
    )
    // 跨端通知报名人
    enqueueNotify({
      targetAccountId: row.account_id as string, category: 'biz', kind: 'event',
      title: `赛事报名已${action === 'approve' ? '通过' : action === 'reject' ? '驳回' : '取消'}`,
      body: `「${comp.name}」${reason ? `原因：${reason}` : '（演示通知）'}`, bizRefType: 'registration', bizRefId: id,
    })
    pumpOutbox()
    return reply.send({ data: { id, status: result.after, version: (row.version as number) + 1 } })
  })

  /* 赛程 */
  app.get('/competitions/:id/schedule', async (req, reply) => {
    requireAuth(req)
    const { id } = req.params as { id: string }
    const rows = db.prepare('SELECT * FROM competition_schedules WHERE competition_id = ? ORDER BY start_at').all(id)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  app.post('/competitions/:id/schedule', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const comp = db.prepare('SELECT * FROM competitions WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!comp || !canManageCompetition(ctx, comp as unknown as { organizer_org_id: string | null })) throw err.forbidden()
    const b = (req.body ?? {}) as { unit_name?: string; phase?: string; start_at?: string; venue?: string }
    if (!b.unit_name || !b.start_at) throw err.validation('缺少 unit_name/start_at')
    const sid = newId('sch_')
    db.prepare('INSERT INTO competition_schedules(id, competition_id, unit_name, phase, start_at, venue, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      sid, id, b.unit_name, b.phase ?? null, b.start_at, b.venue ?? null, nowISO(),
    )
    audit(ctx, { action: 'schedule.create', resourceType: 'schedule', resourceId: sid, after: { competition_id: id } })
    return reply.code(201).send({ data: { id: sid } })
  })

  /* 成绩（provisional → confirmed；修订留版本） */
  app.get('/competitions/:id/results', async (req, reply) => {
    requireAuth(req)
    const { id } = req.params as { id: string }
    const rows = db
      .prepare(
        `SELECT r.*, a.display_name AS account_name FROM results r JOIN accounts a ON a.id = r.account_id
         WHERE r.competition_id = ? ORDER BY r.unit_name, r.rank`,
      )
      .all(id)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  app.post('/competitions/:id/results', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const comp = db.prepare('SELECT * FROM competitions WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!comp || !canManageCompetition(ctx, comp as unknown as { organizer_org_id: string | null })) throw err.forbidden()
    if (!['in_progress', 'completed'].includes(comp.status as string)) throw err.state('仅进行中/已结束赛事可录入成绩')
    const b = (req.body ?? {}) as { account_id?: string; unit_name?: string; rank?: number; score?: string; source?: string }
    if (!b.account_id || !b.unit_name || !b.source) throw err.validation('缺少 account_id/unit_name/source（成绩必须注明来源）')
    const rid = newId('res_')
    db.prepare('INSERT INTO results(id, competition_id, account_id, unit_name, rank, score, source, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').run(
      rid, id, b.account_id, b.unit_name, b.rank ?? null, b.score ?? null, b.source, 'provisional', nowISO(), nowISO(),
    )
    audit(ctx, { action: 'result.create', resourceType: 'result', resourceId: rid, after: { competition_id: id, unit_name: b.unit_name, source: b.source } })
    return reply.code(201).send({ data: { id: rid } })
  })

  app.post('/results/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, version } = (req.body ?? {}) as { action: 'confirm' | 'revise'; version?: number }
    const row = db.prepare('SELECT * FROM results WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    const comp = db.prepare('SELECT * FROM competitions WHERE id = ?').get(row.competition_id) as Record<string, unknown>
    if (!canManageCompetition(ctx, comp as unknown as { organizer_org_id: string | null })) throw err.forbidden()
    if (action === 'confirm') {
      assertVersion(row as { version: number }, version)
      audit(ctx, { action: 'result.confirm', resourceType: 'result', resourceId: id, before: { status: row.status }, after: { status: 'confirmed' } })
      db.prepare('UPDATE results SET status = ?, confirmed_by = ?, updated_at = ?, version = version + 1 WHERE id = ?').run('confirmed', ctx.accountId, nowISO(), id)
      return reply.send({ data: { id, status: 'confirmed', version: (row.version as number) + 1 } })
    }
    throw err.validation('成绩更正请使用 /results/:id/revisions（留版本）')
  })

  app.post('/results/:id/revisions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { rank, score, reason, version } = (req.body ?? {}) as { rank?: number; score?: string; reason?: string; version?: number }
    const row = db.prepare('SELECT * FROM results WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    const comp = db.prepare('SELECT * FROM competitions WHERE id = ?').get(row.competition_id) as Record<string, unknown>
    if (!canManageCompetition(ctx, comp as unknown as { organizer_org_id: string | null })) throw err.forbidden()
    if (!reason) throw err.validation('成绩更正必须填写 reason')
    assertVersion(row as { version: number }, version)
    const before = { rank: row.rank, score: row.score }
    const after = { rank: rank ?? row.rank, score: score ?? row.score }
    db.prepare('INSERT INTO result_revisions(id, result_id, before_json, after_json, reason, actor_account_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      newId('rv_'), id, JSON.stringify(before), JSON.stringify(after), reason, ctx.accountId, nowISO(),
    )
    db.prepare('UPDATE results SET rank = ?, score = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(
      after.rank as number | null, after.score as string | null, nowISO(), id,
    )
    audit(ctx, { action: 'result.revise', resourceType: 'result', resourceId: id, before, after, reason })
    return reply.send({ data: { id, version: (row.version as number) + 1 } })
  })

  app.get('/results/:id/revisions', async (req, reply) => {
    requireAuth(req)
    const { id } = req.params as { id: string }
    const rows = db.prepare('SELECT * FROM result_revisions WHERE result_id = ? ORDER BY created_at DESC').all(id)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  /* 选拔 */
  app.get('/competitions/:id/selections', async (req, reply) => {
    requireAuth(req)
    const { id } = req.params as { id: string }
    const rows = db
      .prepare('SELECT s.*, a.display_name AS account_name FROM selections s JOIN accounts a ON a.id = s.account_id WHERE s.competition_id = ?')
      .all(id)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  app.post('/competitions/:id/selections', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const comp = db.prepare('SELECT * FROM competitions WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!comp || !canManageCompetition(ctx, comp as unknown as { organizer_org_id: string | null })) throw err.forbidden()
    const b = (req.body ?? {}) as { account_id?: string; target?: string; status?: string; note?: string }
    if (!b.account_id || !b.target) throw err.validation('缺少 account_id/target')
    const sid = newId('sel_')
    db.prepare('INSERT INTO selections(id, competition_id, account_id, target, status, note, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)').run(
      sid, id, b.account_id, b.target, b.status ?? 'nominated', b.note ?? null, nowISO(), nowISO(),
    )
    audit(ctx, { action: 'selection.create', resourceType: 'selection', resourceId: sid, after: { competition_id: id } })
    return reply.code(201).send({ data: { id: sid } })
  })
}
