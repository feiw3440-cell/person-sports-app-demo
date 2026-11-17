// /v1/notifications、/v1/analytics、/v1/admin：消息、工作台分析、系统管理
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db } from '../db'
import { requirePerm, rolesOf } from '../rbac'
import { audit } from '../audit'
import { err, nowISO } from '../util'

export async function miscRoutes(app: FastifyInstance): Promise<void> {
  /* ===== 通知 ===== */
  app.get('/notifications', async (req, reply) => {
    const ctx = requireAuth(req)
    const q = req.query as { category?: string; unread?: string; page?: string; page_size?: string }
    const page = Number(q.page || 1)
    const pageSize = Math.min(Number(q.page_size || 20), 100)
    const where: string[] = ['account_id = ?']
    const args: unknown[] = [ctx.accountId]
    if (q.category) { where.push('category = ?'); args.push(q.category) }
    if (q.unread === '1') { where.push('read_at IS NULL') }
    const whereSql = `WHERE ${where.join(' AND ')}`
    const total = db.prepare(`SELECT COUNT(*) AS c FROM notifications ${whereSql}`).get(...args) as { c: number }
    const unread = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE account_id = ? AND read_at IS NULL').get(ctx.accountId) as { c: number }
    const rows = db.prepare(`SELECT * FROM notifications ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize)
    return reply.send({ data: rows, meta: { total: total.c, page, page_size: pageSize, unread: unread.c } })
  })

  app.post('/notifications/:id/read', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT account_id FROM notifications WHERE id = ?').get(id) as { account_id: string } | undefined
    if (!row || row.account_id !== ctx.accountId) throw err.forbidden()
    db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL').run(nowISO(), id)
    return reply.send({ data: { ok: true } })
  })

  app.post('/notifications/read-all', async (req, reply) => {
    const ctx = requireAuth(req)
    db.prepare('UPDATE notifications SET read_at = ? WHERE account_id = ? AND read_at IS NULL').run(nowISO(), ctx.accountId)
    return reply.send({ data: { ok: true } })
  })

  /* ===== 工作台分析（角色化待办 + 数据卡片 + 最近动态） ===== */
  app.get('/analytics/workbench', async (req, reply) => {
    const ctx = requireAuth(req)
    const roles = rolesOf(ctx)
    const todos: { label: string; count: number; ref: string }[] = []
    const isPlatform = roles.some((r) => ['platform_admin', 'platform_ops', 'reviewer'].includes(r))
    // 待审核资质
    if (roles.some((r) => ['reviewer', 'platform_admin', 'platform_ops'].includes(r))) {
      const c = db.prepare("SELECT COUNT(*) AS c FROM credentials WHERE status IN ('submitted','under_review')").get() as { c: number }
      if (c.c) todos.push({ label: '待审核资质', count: c.c, ref: '/people/credentials' })
    }
    // 待审核课程报名（导师本人课程）
    const enc = db.prepare("SELECT COUNT(*) AS c FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.status = 'pending' AND c.mentor_account_id = ?").get(ctx.accountId) as { c: number }
    if (enc.c) todos.push({ label: '待审核课程报名', count: enc.c, ref: '/training/courses' })
    // 待审核赛事报名（本组织主办）
    if (ctx.orgId) {
      const rc = db.prepare("SELECT COUNT(*) AS c FROM registrations r JOIN competitions c ON c.id = r.competition_id WHERE r.status = 'pending' AND c.organizer_org_id = ?").get(ctx.orgId) as { c: number }
      if (rc.c) todos.push({ label: '待审核赛事报名', count: rc.c, ref: '/competitions' })
      const auc = db.prepare("SELECT COUNT(*) AS c FROM authorizations WHERE status = 'submitted'").get() as { c: number }
      if (auc.c && roles.some((r) => ['reviewer', 'org_admin', 'platform_admin', 'platform_ops'].includes(r))) todos.push({ label: '待审核授权', count: auc.c, ref: '/mentorship/authorizations' })
    }
    if (isPlatform) {
      const cc = db.prepare("SELECT COUNT(*) AS c FROM contents WHERE status = 'pending_review'").get() as { c: number }
      if (cc.c) todos.push({ label: '待审核内容', count: cc.c, ref: '/contents' })
    }
    // 数据卡片（口径注明 + 更新时间）
    const cards = {
      projects: (db.prepare("SELECT COUNT(*) AS c FROM sports_projects WHERE status = 'active'").get() as { c: number }).c,
      people: (db.prepare('SELECT COUNT(*) AS c FROM person_profiles').get() as { c: number }).c,
      courses: (db.prepare("SELECT COUNT(*) AS c FROM courses WHERE status = 'published'").get() as { c: number }).c,
      competitions: (db.prepare("SELECT COUNT(*) AS c FROM competitions WHERE status IN ('published','registration_closed','in_progress')").get() as { c: number }).c,
    }
    // 最近动态（授权范围内审计；platform 全部）
    let recent: unknown[] = []
    if (isPlatform) {
      recent = db.prepare(
        `SELECT l.action, l.resource_type, l.resource_id, l.client, l.created_at, a.display_name AS actor
         FROM audit_logs l LEFT JOIN accounts a ON a.id = l.actor_account_id ORDER BY l.created_at DESC LIMIT 10`,
      ).all()
    } else if (ctx.orgId) {
      recent = db.prepare(
        `SELECT l.action, l.resource_type, l.resource_id, l.client, l.created_at, a.display_name AS actor
         FROM audit_logs l LEFT JOIN accounts a ON a.id = l.actor_account_id
         WHERE l.org_id = ? OR l.actor_account_id = ? ORDER BY l.created_at DESC LIMIT 10`,
      ).all(ctx.orgId, ctx.accountId)
    } else {
      recent = db.prepare(
        `SELECT l.action, l.resource_type, l.resource_id, l.client, l.created_at, a.display_name AS actor
         FROM audit_logs l LEFT JOIN accounts a ON a.id = l.actor_account_id
         WHERE l.actor_account_id = ? ORDER BY l.created_at DESC LIMIT 10`,
      ).all(ctx.accountId)
    }
    return reply.send({
      data: { todos, cards, recent_activities: recent, generated_at: nowISO(), note: '统计口径：演示数据库实时聚合；卡片数字为本机权威库计数' },
      meta: {},
    })
  })

  /* 领域总览（遵守数据范围） */
  app.get('/analytics/overview', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'analytics', 'read')
    const q = req.query as { domain?: string }
    const domain = q.domain || 'org'
    const roles = rolesOf(ctx)
    const isPlatform = roles.some((r) => ['platform_admin', 'platform_ops'].includes(r))
    const orgFilter = !isPlatform && ctx.orgId
    let rows: Record<string, unknown>[] = []
    if (domain === 'project') {
      rows = db.prepare(
        `SELECT s.name AS name,
          (SELECT COUNT(*) FROM profile_project_links l WHERE l.project_id = s.id) AS people,
          (SELECT COUNT(*) FROM course_project_links l WHERE l.project_id = s.id) AS courses,
          (SELECT COUNT(*) FROM competition_project_links l WHERE l.project_id = s.id) AS competitions
         FROM sports_projects s WHERE s.status = 'active' ORDER BY people DESC`,
      ).all() as Record<string, unknown>[]
    } else if (domain === 'training') {
      rows = db.prepare(
        `SELECT c.name AS name, c.status AS status,
          (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'approved') AS approved,
          (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'pending') AS pending
         FROM courses c ${orgFilter ? 'WHERE c.org_id = ?' : ''} ORDER BY c.updated_at DESC LIMIT 20`,
      ).all(...(orgFilter ? [ctx.orgId] : [])) as Record<string, unknown>[]
    } else if (domain === 'competition') {
      rows = db.prepare(
        `SELECT c.name AS name, c.status AS status, c.quota,
          (SELECT COUNT(*) FROM registrations r WHERE r.competition_id = c.id AND r.status = 'approved') AS approved,
          (SELECT COUNT(*) FROM registrations r WHERE r.competition_id = c.id AND r.status = 'pending') AS pending
         FROM competitions c ${orgFilter ? 'WHERE c.organizer_org_id = ?' : ''} ORDER BY c.date_start DESC LIMIT 20`,
      ).all(...(orgFilter ? [ctx.orgId] : [])) as Record<string, unknown>[]
    } else {
      // org：成员构成
      rows = db.prepare(
        `SELECT o.name AS org_name, o.type AS org_type,
          (SELECT COUNT(*) FROM memberships m WHERE m.org_id = o.id AND m.status = 'accepted') AS members,
          (SELECT COUNT(*) FROM courses c WHERE c.org_id = o.id) AS courses,
          (SELECT COUNT(*) FROM competitions c WHERE c.organizer_org_id = o.id) AS competitions
         FROM organizations o ORDER BY members DESC`,
      ).all() as Record<string, unknown>[]
    }
    return reply.send({ data: { domain, rows, generated_at: nowISO(), note: '指标口径：本机权威库实时聚合（演示）' }, meta: {} })
  })

  /* 导出（单独授权 + 审计）：CSV */
  app.post('/analytics/export', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'analytics', 'export')
    const { domain } = (req.body ?? {}) as { domain?: string }
    const csv = `domain,generated_at,note\n${domain || 'org'},${nowISO()},演示导出（已留审计）\n`
    audit(ctx, { action: 'analytics.export', resourceType: 'analytics', after: { domain: domain || 'org' } })
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="analytics-${domain || 'org'}.csv"`)
    return reply.send(`\uFEFF${csv}`)
  })

  /* ===== 系统管理（platform_admin） ===== */
  app.get('/admin/accounts', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'admin', 'read')
    const q = req.query as { keyword?: string; page?: string; page_size?: string }
    const page = Number(q.page || 1)
    const pageSize = Math.min(Number(q.page_size || 20), 100)
    const where: string[] = []
    const args: unknown[] = []
    if (q.keyword) { where.push('(login_name LIKE ? OR display_name LIKE ?)'); const kw = `%${q.keyword}%`; args.push(kw, kw) }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = db.prepare(`SELECT COUNT(*) AS c FROM accounts ${whereSql}`).get(...args) as { c: number }
    const rows = db
      .prepare(
        `SELECT a.id, a.login_name, a.display_name, a.status, a.created_at,
          (SELECT GROUP_CONCAT(i.identity_type) FROM identities i WHERE i.account_id = a.id AND i.status = 'active') AS identity_types,
          (SELECT GROUP_CONCAT(o.name) FROM memberships m JOIN organizations o ON o.id = m.org_id WHERE m.account_id = a.id AND m.status = 'accepted') AS orgs
         FROM accounts a ${whereSql} ORDER BY a.created_at LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, (page - 1) * pageSize)
    return reply.send({ data: rows, meta: { total: total.c, page, page_size: pageSize } })
  })

  app.post('/admin/accounts/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'admin', 'manage')
    const { id } = req.params as { id: string }
    const { action, reason } = (req.body ?? {}) as { action: 'disable' | 'enable'; reason?: string }
    if (!reason) throw err.validation('高风险操作必须填写 reason（审计）')
    const row = db.prepare('SELECT status FROM accounts WHERE id = ?').get(id) as { status: string } | undefined
    if (!row) throw err.forbidden()
    const to = action === 'disable' ? 'disabled' : 'active'
    db.prepare('UPDATE accounts SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(to, nowISO(), id)
    audit(ctx, { action: `account.${action}`, resourceType: 'account', resourceId: id, before: { status: row.status }, after: { status: to }, reason })
    return reply.send({ data: { id, status: to } })
  })

  app.get('/admin/audit-logs', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'audit_logs', 'read')
    const q = req.query as { action?: string; actor?: string; resource?: string; page?: string; page_size?: string }
    const page = Number(q.page || 1)
    const pageSize = Math.min(Number(q.page_size || 20), 100)
    const where: string[] = []
    const args: unknown[] = []
    if (q.action) { where.push('l.action LIKE ?'); args.push(`%${q.action}%`) }
    if (q.actor) { where.push('a.display_name LIKE ?'); args.push(`%${q.actor}%`) }
    if (q.resource) { where.push('l.resource_type = ?'); args.push(q.resource) }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_logs l LEFT JOIN accounts a ON a.id = l.actor_account_id ${whereSql}`).get(...args) as { c: number }
    const rows = db
      .prepare(
        `SELECT l.*, a.display_name AS actor_name FROM audit_logs l LEFT JOIN accounts a ON a.id = l.actor_account_id
         ${whereSql} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, (page - 1) * pageSize)
    return reply.send({ data: rows, meta: { total: total.c, page, page_size: pageSize } })
  })
}
