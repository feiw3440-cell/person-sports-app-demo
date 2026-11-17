// /v1/courses、班级、报名（闭环核心）、考勤、训练计划与记录
import type { FastifyInstance } from 'fastify'
import { requireAuth, type AuthContext } from '../auth'
import { db } from '../db'
import { requirePerm, rolesOf } from '../rbac'
import { audit } from '../audit'
import { enqueueNotify, pumpOutbox } from '../outbox'
import { applyFlow } from '../statemachine'
import { assertVersion, idempotencyReplay, idempotencySave } from '../helpers'
import { err, newId, nowISO } from '../util'

/** 课程管理权归属：导师本人 或 课程所属组织的 org_admin（平台角色在 requirePerm 中覆盖） */
function canManageCourse(ctx: AuthContext, course: { mentor_account_id: string; org_id: string | null }): boolean {
  if (course.mentor_account_id === ctx.accountId) return true
  const roles = rolesOf(ctx)
  if (roles.includes('platform_admin') || roles.includes('platform_ops')) return true
  if (roles.includes('org_admin') && course.org_id && ctx.orgId === course.org_id) return true
  return false
}

function courseOut(id: string): Record<string, unknown> | undefined {
  const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return undefined
  const projects = db.prepare('SELECT s.id, s.name FROM course_project_links l JOIN sports_projects s ON s.id = l.project_id WHERE l.course_id = ?').all(id)
  const mentor = db.prepare('SELECT display_name FROM accounts WHERE id = ?').get(row.mentor_account_id as string) as { display_name: string } | undefined
  const org = row.org_id ? (db.prepare('SELECT name FROM organizations WHERE id = ?').get(row.org_id as string) as { name: string } | undefined) : null
  return { ...row, outline: row.outline ? JSON.parse(row.outline as string) : [], projects, mentor_name: mentor?.display_name, org_name: org?.name ?? null }
}

export async function courseRoutes(app: FastifyInstance): Promise<void> {
  /* 课程列表（状态可选；默认全部非 draft） */
  app.get('/courses', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'courses', 'read')
    const q = req.query as { keyword?: string; status?: string; project_id?: string; page?: string; page_size?: string }
    const page = Number(q.page || 1)
    const pageSize = Math.min(Number(q.page_size || 20), 100)
    const where: string[] = []
    const args: unknown[] = []
    if (q.status) { where.push('c.status = ?'); args.push(q.status) }
    if (q.keyword) { where.push('c.name LIKE ?'); args.push(`%${q.keyword}%`) }
    if (q.project_id) { where.push('c.id IN (SELECT course_id FROM course_project_links WHERE project_id = ?)'); args.push(q.project_id) }
    if (perm.data_scope === 'self') { where.push('c.mentor_account_id = ?'); args.push(ctx.accountId) }
    else if (perm.data_scope === 'own_org') { where.push('c.org_id = ?'); args.push(ctx.orgId) }
    else { where.push("c.status != 'draft'") }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = db.prepare(`SELECT COUNT(*) AS c FROM courses c ${whereSql}`).get(...args) as { c: number }
    const rows = db.prepare(`SELECT c.* FROM courses c ${whereSql} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize) as { id: string }[]
    return reply.send({ data: rows.map((r) => courseOut(r.id)), meta: { total: total.c, page, page_size: pageSize } })
  })

  app.get('/courses/:id', async (req, reply) => {
    requireAuth(req)
    const { id } = req.params as { id: string }
    const detail = courseOut(id)
    if (!detail || (detail as { status: string }).status === 'draft') {
      const ctx = requireAuth(req)
      if (!detail || !canManageCourse(ctx, detail as unknown as { mentor_account_id: string; org_id: string | null })) throw err.forbidden()
    }
    return reply.send({ data: detail })
  })

  app.post('/courses', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'courses', 'write')
    const b = (req.body ?? {}) as { name?: string; format?: string; audience?: string; outline?: string[]; sessions?: string; region?: string; project_ids?: string[] }
    if (!b.name || !b.format) throw err.validation('缺少 name/format')
    if (!['offline', 'online'].includes(b.format)) throw err.validation('format 不合法')
    const id = newId('c_')
    db.prepare(
      'INSERT INTO courses(id, name, mentor_account_id, org_id, format, audience, outline, sessions, region, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
    ).run(id, b.name, ctx.accountId, ctx.orgId ?? null, b.format, b.audience ?? null, JSON.stringify(b.outline ?? []), b.sessions ?? null, b.region ?? null, 'draft', nowISO(), nowISO())
    for (const pid of b.project_ids ?? []) {
      db.prepare('INSERT OR IGNORE INTO course_project_links(course_id, project_id) VALUES (?, ?)').run(id, pid)
    }
    audit(ctx, { action: 'course.create', resourceType: 'course', resourceId: id, after: { name: b.name } })
    return reply.code(201).send({ data: { id, version: 1 } })
  })

  app.patch('/courses/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    if (!canManageCourse(ctx, row as unknown as { mentor_account_id: string; org_id: string | null })) throw err.forbidden()
    assertVersion(row as { version: number }, (req.body as { version?: number }).version)
    const b = (req.body ?? {}) as { name?: string; audience?: string; outline?: string[]; sessions?: string; region?: string; version?: number }
    const fields: Record<string, string | null> = {}
    for (const k of ['name', 'audience', 'sessions', 'region'] as const) if (b[k] !== undefined) fields[k] = String(b[k])
    if (b.outline !== undefined) fields.outline = JSON.stringify(b.outline)
    if (Object.keys(fields).length === 0) throw err.validation('无可更新字段')
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE courses SET ${sets}, updated_at = @updated_at, version = version + 1 WHERE id = @id`).run({ ...fields, updated_at: nowISO(), id })
    audit(ctx, { action: 'course.update', resourceType: 'course', resourceId: id, after: fields })
    return reply.send({ data: { id, version: (row.version as number) + 1 } })
  })

  /* 课程状态动作（服务端状态机） */
  app.post('/courses/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, version } = (req.body ?? {}) as { action: string; version?: number }
    const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    if (!canManageCourse(ctx, row as unknown as { mentor_account_id: string; org_id: string | null })) throw err.forbidden()
    const result = applyFlow(ctx, `course.${action}`, { status: row.status as string, version: row.version as number }, { action, version })
    db.prepare('UPDATE courses SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(result.after, nowISO(), id)
    audit(ctx, { action: `course.${action}`, resourceType: 'course', resourceId: id, before: { status: result.before }, after: { status: result.after } })
    return reply.send({ data: { id, status: result.after, version: (row.version as number) + 1 } })
  })

  /* 班级 */
  app.get('/courses/:id/classes', async (req, reply) => {
    requireAuth(req)
    const { id } = req.params as { id: string }
    const rows = db.prepare('SELECT * FROM classes WHERE course_id = ? ORDER BY created_at').all(id)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  app.post('/courses/:id/classes', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    if (!canManageCourse(ctx, row as unknown as { mentor_account_id: string; org_id: string | null })) throw err.forbidden()
    const b = (req.body ?? {}) as { name?: string; schedule?: string; capacity?: number }
    if (!b.name) throw err.validation('缺少班级名')
    const cid = newId('cls_')
    db.prepare('INSERT INTO classes(id, course_id, name, schedule, capacity, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)').run(
      cid, id, b.name, b.schedule ?? null, b.capacity ?? null, 'open', nowISO(), nowISO(),
    )
    audit(ctx, { action: 'class.create', resourceType: 'class', resourceId: cid, after: { name: b.name, course_id: id } })
    return reply.code(201).send({ data: { id: cid } })
  })

  /* ===== 课程报名（闭环核心：APP 提交 → PC 审核） ===== */
  app.post('/enrollments', async (req, reply) => {
    const ctx = requireAuth(req)
    const replay = idempotencyReplay(req, ctx.accountId)
    if (replay) {
      reply.header('Idempotency-Replayed', 'true')
      reply.code(replay.status)
      return replay.body
    }
    const b = (req.body ?? {}) as { course_id?: string; class_id?: string }
    if (!b.course_id) throw err.validation('缺少 course_id')
    const course = db.prepare('SELECT id, name, status FROM courses WHERE id = ?').get(b.course_id) as { id: string; name: string; status: string } | undefined
    if (!course) throw err.forbidden()
    if (course.status !== 'published') throw err.state('课程未发布，不能报名')
    const dup = db.prepare('SELECT id, status FROM enrollments WHERE course_id = ? AND account_id = ?').get(b.course_id, ctx.accountId) as
      | { id: string; status: string }
      | undefined
    if (dup && !['rejected', 'cancelled'].includes(dup.status)) throw err.state('已存在报名记录（不可重复报名）')
    let enrollmentId: string
    if (dup) {
      db.prepare('UPDATE enrollments SET status = ?, class_id = ?, decided_by = NULL, decided_at = NULL, reason = NULL, updated_at = ?, version = version + 1 WHERE id = ?').run(
        'pending', b.class_id ?? null, nowISO(), dup.id,
      )
      enrollmentId = dup.id
    } else {
      enrollmentId = newId('en_')
      db.prepare('INSERT INTO enrollments(id, course_id, class_id, account_id, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)').run(
        enrollmentId, b.course_id, b.class_id ?? null, ctx.accountId, 'pending', nowISO(), nowISO(),
      )
    }
    audit(ctx, { action: 'enrollment.create', resourceType: 'enrollment', resourceId: enrollmentId, after: { course_id: b.course_id } })
    // 通知课程导师（跨端闭环：导师在 PC 待办中看到）
    const courseFull = courseOut(b.course_id)
    const submitter = db.prepare('SELECT display_name FROM accounts WHERE id = ?').get(ctx.accountId) as { display_name: string } | undefined
    enqueueNotify({
      targetAccountId: (courseFull as { mentor_account_id: string }).mentor_account_id, category: 'biz', kind: 'course',
      title: '新的课程报名待审核', body: `${submitter?.display_name ?? '学员'} 报名「${course.name}」（演示通知）`,
      bizRefType: 'course', bizRefId: b.course_id,
    })
    pumpOutbox()
    const body = { data: { id: enrollmentId, status: 'pending', course_id: b.course_id } }
    idempotencySave(req, ctx.accountId, 201, body)
    return reply.code(201).send(body)
  })

  app.get('/enrollments', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'enrollments', 'read')
    const q = req.query as { course_id?: string; status?: string; page?: string; page_size?: string }
    const page = Number(q.page || 1)
    const pageSize = Math.min(Number(q.page_size || 20), 100)
    const where: string[] = []
    const args: unknown[] = []
    if (q.status) { where.push('e.status = ?'); args.push(q.status) }
    if (q.course_id) { where.push('e.course_id = ?'); args.push(q.course_id) }
    if (perm.data_scope === 'self') {
      where.push('e.account_id = ?'); args.push(ctx.accountId)
    } else if (perm.data_scope === 'own_org') {
      where.push('c.org_id = ?'); args.push(ctx.orgId)
    } else if (perm.data_scope === 'granted_scope') {
      where.push('c.mentor_account_id = ?'); args.push(ctx.accountId)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = db.prepare(`SELECT COUNT(*) AS c FROM enrollments e JOIN courses c ON c.id = e.course_id ${whereSql}`).get(...args) as { c: number }
    const rows = db
      .prepare(
        `SELECT e.id, e.course_id, e.class_id, e.account_id, e.status, e.decided_by, e.decided_at, e.reason, e.created_at, e.updated_at, e.version,
                c.name AS course_name, c.mentor_account_id, a.display_name AS account_name, cl.name AS class_name
         FROM enrollments e JOIN courses c ON c.id = e.course_id JOIN accounts a ON a.id = e.account_id
         LEFT JOIN classes cl ON cl.id = e.class_id
         ${whereSql} ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, (page - 1) * pageSize)
    return reply.send({ data: rows, meta: { total: total.c, page, page_size: pageSize } })
  })

  app.post('/enrollments/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, reason, version } = (req.body ?? {}) as { action: string; reason?: string; version?: number }
    const row = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(row.course_id) as Record<string, unknown>
    if (['approve', 'reject'].includes(action)) {
      requirePerm(ctx, 'enrollments', 'review')
      if (!canManageCourse(ctx, course as unknown as { mentor_account_id: string; org_id: string | null })) throw err.forbidden('仅课程导师或组织管理员可审核')
      if (!reason) throw err.validation('审核须填写 reason（留痕）')
    } else if (action === 'cancel') {
      if (row.account_id !== ctx.accountId) throw err.forbidden('只能取消本人报名')
    } else if (action === 'complete') {
      if (!canManageCourse(ctx, course as unknown as { mentor_account_id: string; org_id: string | null })) throw err.forbidden()
    } else {
      throw err.validation('action 不合法')
    }
    const result = applyFlow(ctx, `enrollment.${action}`, { status: row.status as string, version: row.version as number }, { action, reason, version })
    db.prepare('UPDATE enrollments SET status = ?, decided_by = ?, decided_at = ?, reason = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(
      result.after, ['approve', 'reject'].includes(action) ? ctx.accountId : (row.decided_by as string | null),
      ['approve', 'reject'].includes(action) ? nowISO() : (row.decided_at as string | null),
      reason ?? null, nowISO(), id,
    )
    // 跨端通知报名人：状态与消息在 APP 更新
    enqueueNotify({
      targetAccountId: row.account_id as string, category: 'biz', kind: 'course',
      title: `课程报名已${action === 'approve' ? '通过' : action === 'reject' ? '驳回' : action === 'complete' ? '完成' : '取消'}`,
      body: `「${course.name}」${reason ? `原因：${reason}` : '（演示通知）'}`, bizRefType: 'enrollment', bizRefId: id,
    })
    pumpOutbox()
    return reply.send({ data: { id, status: result.after, version: (row.version as number) + 1 } })
  })

  /* 考勤 */
  app.get('/attendance', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'attendance', 'read')
    const q = req.query as { class_id?: string; date?: string }
    if (!q.class_id) throw err.validation('缺少 class_id')
    const cls = db.prepare('SELECT cl.*, c.mentor_account_id, c.org_id FROM classes cl JOIN courses c ON c.id = cl.course_id WHERE cl.id = ?').get(q.class_id) as Record<string, unknown> | undefined
    if (!cls) throw err.forbidden()
    if (!canManageCourse(ctx, cls as unknown as { mentor_account_id: string; org_id: string | null })) throw err.forbidden()
    const args: unknown[] = [q.class_id]
    let dateSql = ''
    if (q.date) { dateSql = ' AND occurred_on = ?'; args.push(q.date) }
    const rows = db.prepare(`SELECT a.*, acc.display_name AS account_name FROM attendance a JOIN enrollments e ON e.id = a.enrollment_id JOIN accounts acc ON acc.id = e.account_id WHERE a.class_id = ?${dateSql}`).all(...args)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  app.post('/attendance', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'attendance', 'write')
    const b = (req.body ?? {}) as { class_id?: string; enrollment_id?: string; occurred_on?: string; status?: string }
    if (!b.class_id || !b.enrollment_id || !b.occurred_on || !b.status) throw err.validation('缺少 class_id/enrollment_id/occurred_on/status')
    if (!['present', 'absent', 'leave'].includes(b.status)) throw err.validation('status 不合法')
    const cls = db.prepare('SELECT cl.*, c.mentor_account_id, c.org_id FROM classes cl JOIN courses c ON c.id = cl.course_id WHERE cl.id = ?').get(b.class_id) as Record<string, unknown> | undefined
    if (!cls || !canManageCourse(ctx, cls as unknown as { mentor_account_id: string; org_id: string | null })) throw err.forbidden()
    const dup = db.prepare('SELECT id FROM attendance WHERE class_id = ? AND enrollment_id = ? AND occurred_on = ?').get(b.class_id, b.enrollment_id, b.occurred_on) as { id: string } | undefined
    if (dup) {
      db.prepare('UPDATE attendance SET status = ?, recorded_by = ? WHERE id = ?').run(b.status, ctx.accountId, dup.id)
    } else {
      db.prepare('INSERT INTO attendance(id, class_id, enrollment_id, occurred_on, status, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        newId('att_'), b.class_id, b.enrollment_id, b.occurred_on, b.status, ctx.accountId, nowISO(),
      )
    }
    audit(ctx, { action: 'attendance.write', resourceType: 'attendance', resourceId: b.enrollment_id, after: { occurred_on: b.occurred_on, status: b.status } })
    return reply.code(201).send({ data: { ok: true } })
  })

  /* 训练计划与记录 */
  app.get('/training-plans', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'training', 'read')
    const where: string[] = []
    const args: unknown[] = []
    if (perm.data_scope === 'self') { where.push('account_id = ?'); args.push(ctx.accountId) }
    else if (perm.data_scope === 'granted_scope') { where.push('mentor_account_id = ?'); args.push(ctx.accountId) }
    const rows = db
      .prepare(`SELECT * FROM training_plans ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY updated_at DESC`)
      .all(...args) as Record<string, unknown>[]
    return reply.send({ data: rows.map((r) => ({ ...r, items: r.items ? JSON.parse(r.items as string) : [] })), meta: { total: rows.length } })
  })

  app.post('/training-plans', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'training', 'write')
    const b = (req.body ?? {}) as { account_id?: string; title?: string; items?: unknown[]; period?: string; course_id?: string }
    if (!b.account_id || !b.title) throw err.validation('缺少 account_id/title')
    const id = newId('tp_')
    db.prepare('INSERT INTO training_plans(id, account_id, mentor_account_id, course_id, title, items, period, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').run(
      id, b.account_id, ctx.accountId, b.course_id ?? null, b.title, JSON.stringify(b.items ?? []), b.period ?? null, nowISO(), nowISO(),
    )
    audit(ctx, { action: 'training_plan.create', resourceType: 'training_plan', resourceId: id, after: { title: b.title } })
    return reply.code(201).send({ data: { id } })
  })

  app.get('/training-records', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'training', 'read')
    const q = req.query as { plan_id?: string }
    const where: string[] = []
    const args: unknown[] = []
    if (q.plan_id) { where.push('plan_id = ?'); args.push(q.plan_id) }
    if (perm.data_scope === 'self') { where.push('account_id = ?'); args.push(ctx.accountId) }
    else if (perm.data_scope === 'granted_scope') { where.push('account_id IN (SELECT mentee_account_id FROM mentorships WHERE mentor_account_id = ? AND status = ?)'); args.push(ctx.accountId, 'active') }
    const rows = db.prepare(`SELECT * FROM training_records ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY occurred_on DESC`).all(...args)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  app.post('/training-records', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'training', 'write')
    const b = (req.body ?? {}) as { plan_id?: string; content?: string; metrics?: unknown; occurred_on?: string; account_id?: string }
    if (!b.plan_id || !b.occurred_on) throw err.validation('缺少 plan_id/occurred_on')
    const plan = db.prepare('SELECT * FROM training_plans WHERE id = ?').get(b.plan_id) as Record<string, unknown> | undefined
    if (!plan) throw err.forbidden()
    const recordAccountId = (b.account_id as string) || (plan.account_id as string)
    const id = newId('tr_')
    db.prepare('INSERT INTO training_records(id, plan_id, account_id, content, metrics, occurred_on, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, b.plan_id, recordAccountId, b.content ?? null, b.metrics ? JSON.stringify(b.metrics) : null, b.occurred_on, ctx.accountId, nowISO(),
    )
    audit(ctx, { action: 'training_record.create', resourceType: 'training_record', resourceId: id, after: { occurred_on: b.occurred_on } })
    return reply.code(201).send({ data: { id } })
  })
}
