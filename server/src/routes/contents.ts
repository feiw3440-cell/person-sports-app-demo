// /v1/contents 与 /v1/rankings：内容审核、TOP 榜单（口径/快照/更新时间）
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db } from '../db'
import { requirePerm } from '../rbac'
import { audit } from '../audit'
import { applyFlow } from '../statemachine'
import { assertVersion, idempotencyReplay, idempotencySave } from '../helpers'
import { err, newId, nowISO } from '../util'

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

  /* 内容创建（闭环核心：APP 提交 → 作者提审 → 平台发布 → APP 发现页可见） */
  app.post('/contents', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'contents', 'write') // coach/mentor/content_editor（data_scope=self，作者本人）
    const replay = idempotencyReplay(req, ctx.accountId)
    if (replay) {
      reply.header('Idempotency-Replayed', 'true')
      reply.code(replay.status)
      return replay.body
    }
    const b = (req.body ?? {}) as { type?: string; title?: string; summary?: string; media_url?: string; project_id?: string }
    const type = String(b.type ?? '')
    if (!['video', 'article'].includes(type)) throw err.validation('type 必须为 video 或 article')
    const title = String(b.title ?? '').trim()
    if (!title) throw err.validation('缺少标题（title）')
    if (title.length > 100) throw err.validation('标题过长（≤100 字）')
    const summary = b.summary ? String(b.summary) : null
    if (summary && summary.length > 2000) throw err.validation('正文过长（≤2000 字）')
    let projectId: string | null = null
    if (b.project_id) {
      const p = db.prepare('SELECT id FROM sports_projects WHERE id = ?').get(String(b.project_id)) as { id: string } | undefined
      if (!p) throw err.validation('关联体育项目不存在')
      projectId = p.id
    }
    const id = newId('ct_')
    db.prepare(
      "INSERT INTO contents(id, type, title, summary, author_account_id, media_url, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1)",
    ).run(id, type, title, summary, ctx.accountId, b.media_url ? String(b.media_url) : null, nowISO(), nowISO())
    if (projectId) db.prepare('INSERT INTO content_project_links(content_id, project_id) VALUES (?, ?)').run(id, projectId)
    audit(ctx, { action: 'content.create', resourceType: 'content', resourceId: id, after: { type, title, status: 'draft', project_id: projectId } })
    const body = { data: { id, status: 'draft', version: 1 } }
    idempotencySave(req, ctx.accountId, 201, body)
    reply.code(201)
    return reply.send(body)
  })

  app.post('/contents/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, version } = (req.body ?? {}) as { action: string; version?: number }
    const row = db.prepare('SELECT * FROM contents WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    // 提审是作者本人动作（与资质 submit 同口径）；publish/offline 为平台审核动作（contents.review）
    const isAuthorSubmit = action === 'submit_review' && row.author_account_id === ctx.accountId
    if (!isAuthorSubmit) {
      const perm = requirePerm(ctx, 'contents', 'review')
      if (perm.data_scope !== 'platform' && perm.data_scope !== 'all' && row.author_account_id !== ctx.accountId) throw err.forbidden()
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
