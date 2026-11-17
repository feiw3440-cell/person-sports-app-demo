// /v1/contents 与 /v1/rankings：内容审核、TOP 榜单（口径/快照/更新时间）
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db } from '../db'
import { requirePerm } from '../rbac'
import { audit } from '../audit'
import { applyFlow } from '../statemachine'
import { assertVersion } from '../helpers'
import { err, nowISO } from '../util'

function contentOut(id: string): Record<string, unknown> | undefined {
  const row = db.prepare('SELECT * FROM contents WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return undefined
  const projects = db.prepare('SELECT s.id, s.name FROM content_project_links l JOIN sports_projects s ON s.id = l.project_id WHERE l.content_id = ?').all(id)
  const author = db.prepare('SELECT display_name FROM accounts WHERE id = ?').get(row.author_account_id) as { display_name: string }
  return { ...row, projects, author_name: author?.display_name }
}

export async function contentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/contents', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'contents', 'read')
    const q = req.query as { type?: string; status?: string; keyword?: string; project_id?: string; page?: string; page_size?: string }
    const page = Number(q.page || 1)
    const pageSize = Math.min(Number(q.page_size || 20), 100)
    const where: string[] = []
    const args: unknown[] = []
    if (q.type) { where.push('c.type = ?'); args.push(q.type) }
    if (q.status) { where.push('c.status = ?'); args.push(q.status) }
    if (q.keyword) { where.push('c.title LIKE ?'); args.push(`%${q.keyword}%`) }
    if (q.project_id) { where.push('c.id IN (SELECT content_id FROM content_project_links WHERE project_id = ?)'); args.push(q.project_id) }
    if (perm.data_scope === 'self') { where.push('c.author_account_id = ?'); args.push(ctx.accountId) }
    else if (['platform', 'all'].includes(perm.data_scope)) { /* 审核视角：可见全部状态（可再用 status 筛选） */ }
    else { where.push("c.status = 'published'") }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = db.prepare(`SELECT COUNT(*) AS c FROM contents c ${whereSql}`).get(...args) as { c: number }
    const rows = db.prepare(`SELECT c.id FROM contents c ${whereSql} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize) as { id: string }[]
    return reply.send({ data: rows.map((r) => contentOut(r.id)), meta: { total: total.c, page, page_size: pageSize } })
  })

  app.post('/contents/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, version } = (req.body ?? {}) as { action: string; version?: number }
    const row = db.prepare('SELECT * FROM contents WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    const perm = requirePerm(ctx, 'contents', 'review')
    if (perm.data_scope !== 'platform' && perm.data_scope !== 'all' && row.author_account_id !== ctx.accountId) throw err.forbidden()
    if (row.author_account_id === ctx.accountId && ['publish', 'offline'].includes(action)) {
      // 审核者不能直接发布/下架自己的内容？演示环境允许（记录审计）
    }
    const result = applyFlow(ctx, `content.${action}`, { status: row.status as string, version: row.version as number }, { action, version })
    if (result.after === 'published' && !row.published_at) {
      db.prepare('UPDATE contents SET status = ?, published_at = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(result.after, nowISO(), nowISO(), id)
    } else {
      db.prepare('UPDATE contents SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(result.after, nowISO(), id)
    }
    audit(ctx, { action: `content.${action}`, resourceType: 'content', resourceId: id, before: { status: result.before }, after: { status: result.after } })
    return reply.send({ data: { id, status: result.after, version: (row.version as number) + 1 } })
  })

  app.patch('/contents/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT * FROM contents WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    if (row.author_account_id !== ctx.accountId) requirePerm(ctx, 'contents', 'review')
    assertVersion(row as { version: number }, (req.body as { version?: number }).version)
    const b = (req.body ?? {}) as { title?: string; summary?: string; version?: number }
    const fields: Record<string, string> = {}
    for (const k of ['title', 'summary'] as const) if (b[k] !== undefined) fields[k] = String(b[k])
    if (Object.keys(fields).length === 0) throw err.validation('无可更新字段')
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE contents SET ${sets}, updated_at = @updated_at, version = version + 1 WHERE id = @id`).run({ ...fields, updated_at: nowISO(), id })
    audit(ctx, { action: 'content.update', resourceType: 'content', resourceId: id, after: fields })
    return reply.send({ data: { id, version: (row.version as number) + 1 } })
  })

  /* ===== TOP 榜单：返回口径说明、数据来源标记与更新时间 ===== */
  app.get('/rankings/:category', async (req, reply) => {
    requireAuth(req)
    const { category } = req.params as { category: string }
    const q = req.query as { mode?: string; period?: string }
    const mode = q.mode || 'overall'
    const period = q.period || 'total'
    const def = db
      .prepare('SELECT * FROM ranking_definitions WHERE category = ? AND mode = ? AND period = ? AND status = ?')
      .get(category, mode, period, 'active') as Record<string, unknown> | undefined
    if (!def) {
      return reply.send({ data: { rows: [], state: 'empty', note: '该维度暂无榜单定义（演示）', formula: null, updated_at: null }, meta: {} })
    }
    const snap = db
      .prepare('SELECT * FROM ranking_snapshots WHERE definition_id = ? ORDER BY computed_at DESC LIMIT 1')
      .get(def.id) as { rows: string; computed_at: string } | undefined
    return reply.send({
      data: {
        category, mode, period,
        formula: JSON.parse(def.formula as string),
        updated_at: snap?.computed_at ?? null,
        source: 'ranking_snapshot（演示数据）',
        rows: snap ? JSON.parse(snap.rows) : [],
        state: snap ? 'ok' : 'updating',
      },
      meta: {},
    })
  })

  app.get('/ranking-definitions', async (req, reply) => {
    requireAuth(req)
    const rows = db.prepare('SELECT * FROM ranking_definitions ORDER BY category, mode, period').all() as Record<string, unknown>[]
    return reply.send({ data: rows.map((r) => ({ ...r, formula: JSON.parse(r.formula as string) })), meta: { total: rows.length } })
  })

  app.patch('/ranking-definitions/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'rankings', 'write')
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT * FROM ranking_definitions WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    const b = (req.body ?? {}) as { formula?: unknown; status?: string }
    if (b.formula) db.prepare('UPDATE ranking_definitions SET formula = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(b.formula), nowISO(), id)
    if (b.status) db.prepare('UPDATE ranking_definitions SET status = ?, updated_at = ? WHERE id = ?').run(b.status, nowISO(), id)
    audit(ctx, { action: 'ranking.update', resourceType: 'ranking_definition', resourceId: id, after: { formula: b.formula, status: b.status } })
    return reply.send({ data: { id } })
  })
}
