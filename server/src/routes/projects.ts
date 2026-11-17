// /v1/projects：体育项目主数据（含分类/标签/分支/竞赛小项/版本历史）
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db } from '../db'
import { requirePerm } from '../rbac'
import { audit } from '../audit'
import { assertVersion } from '../helpers'
import { err, newId, nowISO } from '../util'

interface ProjectRow {
  id: string; name: string; name_en: string | null; slug: string; intro: string | null
  source: string | null; status: string; version: number; created_at: string; updated_at: string
}

function projectDetail(id: string) {
  const p = db.prepare('SELECT * FROM sports_projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!p) return undefined
  const categories = db.prepare('SELECT c.id, c.name FROM project_categories c JOIN project_category_links l ON l.category_id = c.id WHERE l.project_id = ?').all(id)
  const tags = db.prepare('SELECT t.id, t.name FROM project_tags t JOIN project_tag_links l ON l.tag_id = t.id WHERE l.project_id = ?').all(id)
  const branches = db.prepare('SELECT * FROM project_branches WHERE project_id = ?').all(id) as { id: string; name: string }[]
  const units = branches.length
    ? db.prepare(
        `SELECT u.* FROM competition_units u JOIN project_branches b ON b.id = u.branch_id WHERE b.project_id = ?`,
      ).all(id)
    : []
  const relations = db
    .prepare('SELECT entity_type, COUNT(*) AS count FROM project_relations WHERE project_id = ? GROUP BY entity_type')
    .all(id) as { entity_type: string; count: number }[]
  return { ...p, categories, tags, branches, competition_units: units, relation_counts: relations }
}

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.get('/projects', async (req, reply) => {
    requireAuth(req)
    const q = req.query as { keyword?: string; category?: string; status?: string; page?: string; page_size?: string }
    const page = Number(q.page || 1)
    const pageSize = Math.min(Number(q.page_size || 20), 100)
    const where: string[] = []
    const args: unknown[] = []
    if (q.keyword) {
      where.push('(name LIKE ? OR IFNULL(name_en,"") LIKE ? OR IFNULL(intro,"") LIKE ?)')
      const kw = `%${q.keyword}%`
      args.push(kw, kw, kw)
    }
    if (q.status) {
      where.push('status = ?')
      args.push(q.status)
    } else {
      // 非平台角色默认只见 active
      where.push("status != 'draft'")
    }
    if (q.category) {
      where.push('id IN (SELECT project_id FROM project_category_links l JOIN project_categories c ON c.id = l.category_id WHERE c.name = ?)')
      args.push(q.category)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = db.prepare(`SELECT COUNT(*) AS c FROM sports_projects ${whereSql}`).get(...args) as { c: number }
    const rows = db.prepare(`SELECT * FROM sports_projects ${whereSql} ORDER BY name LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize)
    return reply.send({ data: rows, meta: { total: total.c, page, page_size: pageSize } })
  })

  app.get('/projects/:id', async (req, reply) => {
    requireAuth(req)
    const { id } = req.params as { id: string }
    const detail = projectDetail(id)
    if (!detail || detail.status === 'draft') throw err.forbidden()
    return reply.send({ data: detail })
  })

  /* 平台运营维护 */
  app.post('/projects', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'projects', 'write')
    const b = (req.body ?? {}) as { name?: string; name_en?: string; slug?: string; intro?: string; source?: string }
    if (!b.name || !b.slug) throw err.validation('缺少 name/slug')
    const id = newId('p_')
    db.prepare(
      'INSERT INTO sports_projects(id, name, name_en, slug, intro, source, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
    ).run(id, b.name, b.name_en ?? null, b.slug, b.intro ?? null, b.source ?? null, 'draft', nowISO(), nowISO())
    db.prepare('INSERT INTO project_versions(id, project_id, version, change_summary, actor_account_id, snapshot, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)').run(
      newId('pv_'), id, '初始创建', ctx.accountId, JSON.stringify({ name: b.name, slug: b.slug }), nowISO(),
    )
    audit(ctx, { action: 'project.create', resourceType: 'project', resourceId: id, after: { name: b.name } })
    return reply.code(201).send({ data: { id, version: 1 } })
  })

  app.patch('/projects/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'projects', 'write')
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT * FROM sports_projects WHERE id = ?').get(id) as (ProjectRow & Record<string, unknown>) | undefined
    if (!row) throw err.forbidden()
    const b = (req.body ?? {}) as { name?: string; name_en?: string; intro?: string; source?: string; version?: number; change_summary?: string }
    assertVersion(row, b.version)
    const fields: Record<string, string | null> = {}
    for (const k of ['name', 'name_en', 'intro', 'source'] as const) if (b[k] !== undefined) fields[k] = b[k] === null ? null : String(b[k])
    if (Object.keys(fields).length === 0) throw err.validation('无可更新字段')
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE sports_projects SET ${sets}, updated_at = @updated_at, version = version + 1 WHERE id = @id`).run({ ...fields, updated_at: nowISO(), id })
    db.prepare('INSERT INTO project_versions(id, project_id, version, change_summary, actor_account_id, snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      newId('pv_'), id, row.version + 1, b.change_summary || '更新主数据', ctx.accountId,
      JSON.stringify({ before: { name: row.name, intro: row.intro }, after: fields }), nowISO(),
    )
    audit(ctx, { action: 'project.update', resourceType: 'project', resourceId: id, before: { name: row.name }, after: fields })
    return reply.send({ data: { id, version: row.version + 1 } })
  })

  app.post('/projects/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'projects', 'write')
    const { id } = req.params as { id: string }
    const { action, version } = (req.body ?? {}) as { action: 'activate' | 'deprecate'; version?: number }
    const row = db.prepare('SELECT status, version FROM sports_projects WHERE id = ?').get(id) as { status: string; version: number } | undefined
    if (!row) throw err.forbidden()
    if (typeof version === 'number' && version !== row.version) throw err.conflict('VERSION_CONFLICT', '已被他人修改，请刷新', { current_version: row.version })
    if (!['activate', 'deprecate'].includes(action)) throw err.validation('action 仅支持 activate/deprecate（软停用，不物理删除）')
    const to = action === 'activate' ? 'active' : 'deprecated'
    audit(ctx, { action: `project.${action}`, resourceType: 'project', resourceId: id, before: { status: row.status }, after: { status: to } })
    db.prepare('UPDATE sports_projects SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(to, nowISO(), id)
    return reply.send({ data: { id, status: to, version: row.version + 1 } })
  })

  /* 子资源：分类/标签/分支/竞赛小项/版本历史 */
  app.get('/projects/:id/versions', async (req, reply) => {
    requireAuth(req)
    const { id } = req.params as { id: string }
    const rows = db.prepare('SELECT version, change_summary, created_at FROM project_versions WHERE project_id = ? ORDER BY version DESC').all(id)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  app.post('/projects/:id/branches', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'projects', 'write')
    const { id } = req.params as { id: string }
    const { name } = (req.body ?? {}) as { name?: string }
    if (!name) throw err.validation('缺少分支名')
    const bid = newId('pb_')
    db.prepare('INSERT INTO project_branches(id, project_id, name, created_at) VALUES (?, ?, ?, ?)').run(bid, id, name, nowISO())
    audit(ctx, { action: 'project.branch.create', resourceType: 'project', resourceId: id, after: { name } })
    return reply.code(201).send({ data: { id: bid, name } })
  })

  app.post('/branches/:id/units', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'projects', 'write')
    const { id } = req.params as { id: string }
    const b = (req.body ?? {}) as { name?: string; gender?: string; group_name?: string; rule_version?: string }
    if (!b.name) throw err.validation('缺少小项名')
    const uid = newId('cu_')
    db.prepare('INSERT INTO competition_units(id, branch_id, name, gender, group_name, rule_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      uid, id, b.name, b.gender ?? null, b.group_name ?? null, b.rule_version ?? null, nowISO(),
    )
    audit(ctx, { action: 'project.unit.create', resourceType: 'competition_unit', resourceId: uid, after: { name: b.name } })
    return reply.code(201).send({ data: { id: uid, name: b.name } })
  })

  /* 字典：分类/标签（主数据维护入口） */
  app.get('/project-dictionaries', async (req, reply) => {
    requireAuth(req)
    return reply.send({
      data: {
        categories: db.prepare('SELECT * FROM project_categories ORDER BY name').all(),
        tags: db.prepare('SELECT * FROM project_tags ORDER BY name').all(),
      },
    })
  })

  app.post('/project-dictionaries', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'projects', 'write')
    const { kind, name } = (req.body ?? {}) as { kind?: 'category' | 'tag'; name?: string }
    if (!kind || !name) throw err.validation('缺少 kind/name')
    if (kind === 'category') db.prepare('INSERT OR IGNORE INTO project_categories(id, name) VALUES (?, ?)').run(newId('pc_'), name)
    else db.prepare('INSERT OR IGNORE INTO project_tags(id, name) VALUES (?, ?)').run(newId('pt_'), name)
    audit(ctx, { action: `dictionary.${kind}.create`, resourceType: 'dictionary', after: { name } })
    return reply.code(201).send({ data: { ok: true } })
  })
}
