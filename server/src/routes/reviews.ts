// /v1/courses/:id/reviews、/v1/reviews：课程评价（F-3）
// 规则：
//   * 仅本人「已支付（paid）」订单可评价；退款后不再具备评价资格
//   * 同一课程同一账号仅一条评价；同一订单仅一条（DB 唯一约束兜底）
//   * 公开列表只返回 visible；隐藏/恢复由课程导师、所属组织管理员或平台管理员操作
//   * 评价聚合只统计 visible，课程详情返回真实 review_count/rating_avg（不伪造）
import type { FastifyInstance } from 'fastify'
import { requireAuth, type AuthContext } from '../auth'
import { db } from '../db'
import { requirePerm } from '../rbac'
import { audit } from '../audit'
import { assertVersion } from '../helpers'
import { enqueueNotify, pumpOutbox } from '../outbox'
import { err, newId, nowISO } from '../util'

type CourseRow = { id: string; name: string; mentor_account_id: string; org_id: string | null; status: string }

function pageArgs(q: { page?: string; page_size?: string }): { page: number; pageSize: number; offset: number } {
  const pageRaw = Number(q.page ?? 1)
  const sizeRaw = Number(q.page_size ?? 20)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
  const pageSize = Number.isFinite(sizeRaw) && sizeRaw >= 1 ? Math.min(Math.floor(sizeRaw), 100) : 20
  return { page, pageSize, offset: (page - 1) * pageSize }
}

/** 评价管理范围：平台 / 课程所属组织 / 课程导师；与 requirePerm('reviews','moderate') 叠加使用 */
function canModerateCourse(ctx: AuthContext, course: CourseRow): boolean {
  const perm = requirePerm(ctx, 'reviews', 'moderate')
  if (perm.data_scope === 'platform' || perm.data_scope === 'all') return true
  if (perm.data_scope === 'own_org') return !!course.org_id && ctx.orgId === course.org_id
  return course.mentor_account_id === ctx.accountId
}

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  /* 课程公开评价列表（登录可读；仅 visible；聚合口径与列表一致） */
  app.get('/courses/:id/reviews', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'reviews', 'read')
    const { id } = req.params as { id: string }
    const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(id)
    if (!course) throw err.notFound('课程不存在')
    const q = req.query as { page?: string; page_size?: string }
    const { page, pageSize, offset } = pageArgs(q)
    const total = (db.prepare("SELECT COUNT(*) AS c FROM reviews WHERE course_id = ? AND status = 'visible'").get(id) as { c: number }).c
    const rows = db
      .prepare(
        `SELECT r.id, r.course_id, r.account_id, r.rating, r.comment, r.created_at, r.updated_at,
                a.display_name AS account_name
         FROM reviews r JOIN accounts a ON a.id = r.account_id
         WHERE r.course_id = ? AND r.status = 'visible'
         ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(id, pageSize, offset)
    const agg = db.prepare("SELECT AVG(rating) AS a FROM reviews WHERE course_id = ? AND status = 'visible'").get(id) as { a: number | null }
    return reply.send({
      data: rows,
      meta: {
        total, page, page_size: pageSize,
        review_count: total,
        rating_avg: agg.a == null ? null : Math.round(agg.a * 10) / 10,
      },
    })
  })

  /* 发表评价：必须存在本人该课程的 paid 订单；防重复（课程+账号） */
  app.post('/courses/:id/reviews', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'reviews', 'write')
    const { id } = req.params as { id: string }
    const b = (req.body ?? {}) as { rating?: number; comment?: string; order_id?: string }
    const course = db.prepare('SELECT id, name, mentor_account_id FROM courses WHERE id = ?').get(id) as
      | { id: string; name: string; mentor_account_id: string }
      | undefined
    if (!course) throw err.notFound('课程不存在')
    if (!Number.isInteger(b.rating) || (b.rating as number) < 1 || (b.rating as number) > 5) {
      throw err.validation('评分需为 1-5 的整数')
    }
    const comment = (b.comment ?? '').trim()
    if (comment.length > 500) throw err.validation('评价内容不能超过 500 字')

    const paidOrder = b.order_id
      ? (db.prepare("SELECT id FROM orders WHERE id = ? AND account_id = ? AND course_id = ? AND status = 'paid'").get(b.order_id, ctx.accountId, id) as { id: string } | undefined)
      : (db.prepare("SELECT id FROM orders WHERE account_id = ? AND course_id = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT 1").get(ctx.accountId, id) as { id: string } | undefined)
    if (!paidOrder) throw err.state('只有存在该课程已支付订单的用户可以评价（退款后不可评价）')

    const dup = db.prepare('SELECT id FROM reviews WHERE course_id = ? AND account_id = ?').get(id, ctx.accountId) as { id: string } | undefined
    if (dup) throw err.conflict('REVIEW_EXISTS', '你已评价过该课程，不能重复评价')
    const rid = newId('rv_')
    try {
      db.prepare(
        "INSERT INTO reviews(id, course_id, order_id, account_id, rating, comment, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, 'visible', ?, ?, 1)",
      ).run(rid, id, paidOrder.id, ctx.accountId, b.rating, comment || null, nowISO(), nowISO())
    } catch (e) {
      if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') throw err.conflict('REVIEW_EXISTS', '你已评价过该课程，不能重复评价')
      throw e
    }
    audit(ctx, { action: 'review.create', resourceType: 'review', resourceId: rid, after: { course_id: id, rating: b.rating, order_id: paidOrder.id } })
    enqueueNotify({
      targetAccountId: course.mentor_account_id, category: 'biz', kind: 'course',
      title: '收到新的课程评价', body: `课程「${course.name}」收到 ${b.rating} 星评价`, bizRefType: 'course', bizRefId: id,
    })
    pumpOutbox()
    return reply.code(201).send({ data: { id: rid, status: 'visible', rating: b.rating } })
  })

  /* 我的评价（含隐藏状态，仅本人） */
  app.get('/reviews/mine', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'reviews', 'read')
    const rows = db
      .prepare(
        `SELECT r.id, r.course_id, r.rating, r.comment, r.status, r.created_at, r.updated_at, r.version,
                c.name AS course_name
         FROM reviews r JOIN courses c ON c.id = r.course_id
         WHERE r.account_id = ? ORDER BY r.created_at DESC`,
      )
      .all(ctx.accountId)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  /* 评价管理列表：按课程（导师/机构/平台）或全平台（平台角色） */
  app.get('/reviews', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'reviews', 'moderate')
    const q = req.query as { course_id?: string; status?: string; page?: string; page_size?: string }
    const { page, pageSize, offset } = pageArgs(q)
    const where: string[] = []
    const args: unknown[] = []
    if (q.course_id) {
      const course = db.prepare('SELECT id, name, mentor_account_id, org_id, status FROM courses WHERE id = ?').get(q.course_id) as CourseRow | undefined
      if (!course) throw err.notFound('课程不存在')
      if (!canModerateCourse(ctx, course)) throw err.forbidden()
      where.push('r.course_id = ?'); args.push(q.course_id)
    } else if (perm.data_scope !== 'platform' && perm.data_scope !== 'all') {
      throw err.validation('请指定 course_id（仅平台角色可跨课程查看）')
    }
    if (q.status) {
      if (!['visible', 'hidden'].includes(q.status)) throw err.validation('status 不合法')
      where.push('r.status = ?'); args.push(q.status)
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM reviews r ${whereSql}`).get(...args) as { c: number }).c
    const rows = db
      .prepare(
        `SELECT r.*, a.display_name AS account_name, c.name AS course_name
         FROM reviews r JOIN accounts a ON a.id = r.account_id JOIN courses c ON c.id = r.course_id
         ${whereSql} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, offset)
    return reply.send({ data: rows, meta: { total, page, page_size: pageSize } })
  })

  /* 隐藏/恢复评价（保留原文，不物理删除；必须填写原因并写审计） */
  app.patch('/reviews/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const b = (req.body ?? {}) as { status?: string; reason?: string; version?: number }
    if (!b.status || !['visible', 'hidden'].includes(b.status)) throw err.validation('status 需为 visible/hidden')
    if (!b.reason || !b.reason.trim()) throw err.validation('隐藏/恢复评价须填写原因（留痕）')
    const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.notFound('评价不存在')
    const course = db.prepare('SELECT id, name, mentor_account_id, org_id, status FROM courses WHERE id = ?').get(row.course_id as string) as CourseRow
    if (!canModerateCourse(ctx, course)) throw err.forbidden()
    assertVersion(row as { version: number }, b.version)
    db.prepare('UPDATE reviews SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(b.status, nowISO(), id)
    audit(ctx, {
      action: 'review.moderate', resourceType: 'review', resourceId: id,
      before: { status: row.status }, after: { status: b.status }, reason: b.reason,
    })
    if (b.status === 'hidden') {
      enqueueNotify({
        targetAccountId: row.account_id as string, category: 'biz', kind: 'course',
        title: '你的课程评价已被隐藏', body: `课程「${course.name}」的评价因：${b.reason.trim()} 被隐藏`, bizRefType: 'course', bizRefId: course.id,
      })
      pumpOutbox()
    }
    return reply.send({ data: { id, status: b.status, version: (row.version as number) + 1 } })
  })
}
