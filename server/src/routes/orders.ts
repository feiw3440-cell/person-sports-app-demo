// /v1/orders：课程订单（阶段五 F，模拟支付口径）
// 原则：全部金额以「分」存储；平台服务费率来自服务端配置（演示参数，写入订单快照）；
// 模拟支付（mock_pay）——真实支付网关未接入，接入需单独授权；
// 每笔资金变动写 ledger_entries（追加式，双端审计口径）。
import type { FastifyInstance } from 'fastify'
import { requireAuth, type AuthContext } from '../auth'
import { db } from '../db'
import { requirePerm } from '../rbac'
import { audit } from '../audit'
import { applyFlow } from '../statemachine'
import { idempotencyReplay, idempotencySave } from '../helpers'
import { enqueueNotify, pumpOutbox } from '../outbox'
import { err, newId, nowISO } from '../util'
import { feeRatePercent, getPlatformFeeRate } from '../commerce'

type CourseRow = {
  id: string; name: string; status: string; price_cents: number | null
  mentor_account_id: string; org_id: string | null
}

/** 分页参数（服务端夹紧，拒绝 NaN/负数/超大页） */
function pageArgs(q: { page?: string; page_size?: string }): { page: number; pageSize: number; offset: number } {
  const pageRaw = Number(q.page ?? 1)
  const sizeRaw = Number(q.page_size ?? 20)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
  const pageSize = Number.isFinite(sizeRaw) && sizeRaw >= 1 ? Math.min(Math.floor(sizeRaw), 100) : 20
  return { page, pageSize, offset: (page - 1) * pageSize }
}

/** 订单读取范围：平台/组织/本人（导师可读自己课程的销售订单，用于退款审核与收入） */
function orderScope(ctx: AuthContext, scope: string, mineOnly: boolean): { sql: string; args: unknown[] } | null {
  // mine=1：APP「我的订单」只返回本人购买，不混入本人授课课程的销售订单
  if (mineOnly) return { sql: 'o.account_id = ?', args: [ctx.accountId] }
  if (scope === 'self') return { sql: '(o.account_id = ? OR c.mentor_account_id = ?)', args: [ctx.accountId, ctx.accountId] }
  if (scope === 'own_org') {
    if (!ctx.orgId) return null
    return { sql: 'c.org_id = ?', args: [ctx.orgId] }
  }
  if (scope === 'granted_scope') return { sql: 'c.mentor_account_id = ?', args: [ctx.accountId] }
  return { sql: '1 = 1', args: [] }
}

function canReadOrderLedger(ctx: AuthContext, order: { account_id: string; mentor_account_id: string; org_id: string | null }): boolean {
  if (order.account_id === ctx.accountId) return true
  const perm = requirePerm(ctx, 'orders', 'read')
  if (perm.data_scope === 'platform' || perm.data_scope === 'all') return true
  if (perm.data_scope === 'own_org') return !!order.org_id && ctx.orgId === order.org_id
  // self / granted_scope：导师仅可查看自己课程的订单流水
  return order.mentor_account_id === ctx.accountId
}

function writeLedger(orderId: string, entries: { type: string; amount: number; memo: string }[]): void {
  for (const e of entries) {
    db.prepare('INSERT INTO ledger_entries(id, order_id, entry_type, amount_cents, memo, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      newId('le_'), orderId, e.type, e.amount, e.memo, nowISO(),
    )
  }
}

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  /* 下单（本人）：仅 published 付费课程；免费课程走原 enrollments 免费审核流 */
  app.post('/orders', async (req, reply) => {
    const ctx = requireAuth(req)
    const replay = idempotencyReplay(req, ctx.accountId)
    if (replay) {
      reply.header('Idempotency-Replayed', 'true')
      reply.code(replay.status)
      return replay.body
    }
    const b = (req.body ?? {}) as { course_id?: string; class_id?: string }
    if (!b.course_id) throw err.validation('缺少 course_id')
    const course = db.prepare('SELECT id, name, status, price_cents, mentor_account_id, org_id FROM courses WHERE id = ?').get(b.course_id) as CourseRow | undefined
    if (!course) throw err.forbidden('课程不存在')
    if (course.status !== 'published') throw err.state('课程当前不可购买（状态：' + course.status + '）')
    if (course.price_cents == null || course.price_cents <= 0) {
      throw err.state('该课程为免费课程，请直接报名（无需下单）')
    }
    const dup = db.prepare('SELECT id, status FROM orders WHERE account_id = ? AND course_id = ?').get(ctx.accountId, b.course_id) as
      | { id: string; status: string }
      | undefined
    if (dup && !['cancelled', 'refunded'].includes(dup.status)) throw err.state('已存在该课程的订单（不可重复购买）')

    const feeRate = getPlatformFeeRate()
    const fee = Math.round(course.price_cents * feeRate)
    const mentorAmount = course.price_cents - fee
    const id = newId('od_')
    const orderNo = 'ZT' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100)
    try {
      db.prepare(
        `INSERT INTO orders(id, order_no, account_id, course_id, class_id, amount_cents, platform_fee_cents, mentor_amount_cents,
                            fee_rate_snapshot, status, mock_paid, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', 0, ?, ?, 1)`,
      ).run(id, orderNo, ctx.accountId, b.course_id, b.class_id ?? null, course.price_cents, fee, mentorAmount, String(feeRate), nowISO(), nowISO())
    } catch (e) {
      // 部分唯一索引兜底并发重复下单（退款/取消后可重新下单）
      if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') throw err.state('已存在该课程的有效订单（不可重复购买）')
      throw e
    }
    audit(ctx, {
      action: 'order.create', resourceType: 'order', resourceId: id,
      after: { order_no: orderNo, course_id: b.course_id, amount_cents: course.price_cents, status: 'created' },
    })
    enqueueNotify({
      targetAccountId: course.mentor_account_id, category: 'biz', kind: 'order',
      title: '收到新的课程订单', body: `课程「${course.name}」有新订单（待支付）`, bizRefType: 'order', bizRefId: id,
    })
    pumpOutbox()
    const body = { data: { id, order_no: orderNo, status: 'created', amount_cents: course.price_cents, platform_fee_cents: fee, mentor_amount_cents: mentorAmount, fee_rate: feeRate, fee_rate_snapshot: String(feeRate), fee_rate_label: feeRatePercent(feeRate) } }
    idempotencySave(req, ctx.accountId, 201, body)
    reply.code(201)
    return reply.send(body)
  })

  /* 订单列表：self=本人购买 + 本人授课课程销售；org_admin=本组织课程订单；platform=全部 */
  app.get('/orders', async (req, reply) => {
    const ctx = requireAuth(req)
    const q = req.query as { status?: string; course_id?: string; mine?: string; page?: string; page_size?: string }
    const { page, pageSize, offset } = pageArgs(q)
    const perm = requirePerm(ctx, 'orders', 'read')
    const scope = orderScope(ctx, perm.data_scope, q.mine === '1')
    if (!scope) return reply.send({ data: [], meta: { total: 0, page, page_size: pageSize } })
    const where = [scope.sql]
    const args = [...scope.args]
    if (q.course_id) { where.push('o.course_id = ?'); args.push(q.course_id) }
    if (q.status) { where.push('o.status = ?'); args.push(q.status) }
    const whereSql = 'WHERE ' + where.join(' AND ')
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM orders o JOIN courses c ON c.id = o.course_id ${whereSql}`).get(...args) as { c: number }).c
    const rows = db
      .prepare(
        `SELECT o.*, c.name AS course_name, c.mentor_account_id, c.org_id, a.display_name AS account_name,
                m.display_name AS mentor_name,
                CASE WHEN EXISTS (SELECT 1 FROM settlement_items si WHERE si.order_id = o.id) THEN 1 ELSE 0 END AS settled
         FROM orders o JOIN courses c ON c.id = o.course_id JOIN accounts a ON a.id = o.account_id
         JOIN accounts m ON m.id = c.mentor_account_id
         ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, offset)
    return reply.send({ data: rows, meta: { total, page, page_size: pageSize } })
  })

  /* 订单动作（状态机）：mock_pay / request_refund / refund / cancel */
  app.post('/orders/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, reason, version } = (req.body ?? {}) as { action: string; reason?: string; version?: number }
    const order = db
      .prepare(
        `SELECT o.*, c.name AS course_name, c.mentor_account_id, c.org_id FROM orders o JOIN courses c ON c.id = o.course_id WHERE o.id = ?`,
      )
      .get(id) as (Record<string, unknown> & { course_name: string; mentor_account_id: string; org_id: string | null }) | undefined
    if (!order) throw err.forbidden('订单不存在')

    const isOwner = order.account_id === ctx.accountId
    const isMentor = order.mentor_account_id === ctx.accountId
    let isOrgAdmin = false
    if (order.org_id && ctx.orgId === order.org_id) {
      isOrgAdmin = !!db.prepare("SELECT id FROM memberships WHERE account_id = ? AND org_id = ? AND role = 'org_admin' AND status = 'accepted'").get(ctx.accountId, order.org_id)
    }
    const isPlatform = ['platform_admin', 'platform_ops'].includes((db.prepare("SELECT identity_type FROM identities WHERE account_id = ? AND status = 'active'").all(ctx.accountId) as { identity_type: string }[]).map((r) => r.identity_type).find((t) => ['platform_admin', 'platform_ops'].includes(t)) ?? '')

    if (action === 'mock_pay') {
      if (!isOwner) throw err.forbidden('只能支付本人订单')
      // 模拟支付：本地直接置为已支付（真实网关需单独授权接入）
    } else if (action === 'request_refund') {
      if (!isOwner) throw err.forbidden('只能对本人订单申请退款')
      if (!reason) throw err.validation('申请退款须填写原因')
      // 已结算订单不允许进入退款流程：否则会停在“退款申请中”却无法审批（冲正流程待产品决策）
      const settled = db.prepare('SELECT 1 FROM settlement_items WHERE order_id = ?').get(id)
      if (settled) throw err.state('该订单已结算，不能申请退款（需走结算冲正流程，待产品决策）')
    } else if (action === 'refund') {
      if (!isMentor && !isOrgAdmin && !isPlatform) throw err.forbidden('退款审核需导师 / 机构管理员 / 平台权限')
      if (!reason) throw err.validation('退款处理须填写原因（留痕）')
    } else if (action === 'cancel') {
      if (!isOwner) throw err.forbidden('只能取消本人订单')
    } else {
      throw err.validation('action 不合法')
    }

    const result = applyFlow(ctx, `order.${action}`, { status: order.status as string, version: order.version as number }, { action, reason, version })
    const now = nowISO()
    if (action === 'mock_pay') {
      db.prepare("UPDATE orders SET status = ?, mock_paid = 1, paid_at = ?, updated_at = ?, version = version + 1 WHERE id = ?").run(result.after, now, now, id)
      // 资金流水（三条，方向以 entry_type 表达；金额均为正数）
      writeLedger(id, [
        { type: 'payment', amount: order.amount_cents as number, memo: '模拟支付收款（用户）' },
        { type: 'platform_fee', amount: order.platform_fee_cents as number, memo: `平台服务费（${feeRatePercent(Number(order.fee_rate_snapshot))} 演示口径，费率快照）` },
        { type: 'mentor_income', amount: order.mentor_amount_cents as number, memo: '导师收入（订单快照分成）' },
      ])
      // 已支付 → 自动创建 approved 报名（付费课程跳过人工审核）
      const existingEn = db.prepare('SELECT id, status FROM enrollments WHERE course_id = ? AND account_id = ?').get(order.course_id, order.account_id) as { id: string; status: string } | undefined
      if (!existingEn) {
        db.prepare("INSERT INTO enrollments(id, course_id, account_id, status, created_at, updated_at, version) VALUES (?, ?, ?, 'approved', ?, ?, 1)").run(
          newId('en_'), order.course_id, order.account_id, now, now,
        )
      } else if (['pending', 'rejected', 'cancelled'].includes(existingEn.status)) {
        db.prepare("UPDATE enrollments SET status = 'approved', decided_at = ?, updated_at = ?, version = version + 1 WHERE id = ?").run(now, now, existingEn.id)
      }
      audit(ctx, { action: `order.${action}`, resourceType: 'order', resourceId: id, before: { status: result.before }, after: { status: result.after } })
      enqueueNotify({
        targetAccountId: order.mentor_account_id as string, category: 'biz', kind: 'order',
        title: '订单已支付（模拟）', body: `课程「${order.course_name}」订单已支付，报名已自动通过`, bizRefType: 'order', bizRefId: id,
      })
      pumpOutbox()
      return reply.send({ data: { id, status: result.after, version: (order.version as number) + 1 } })
    }

    if (action === 'refund') {
      // 已结算订单不再允许退款：避免已结算资金出现负向结算（如需支持，应设计结算冲正单，属产品决策）
      const settled = db.prepare('SELECT 1 FROM settlement_items WHERE order_id = ?').get(id)
      if (settled) throw err.state('该订单已结算，不能直接退款（需走结算冲正流程，待产品决策）')
      db.prepare("UPDATE orders SET status = ?, refunded_at = ?, refund_reason = ?, updated_at = ?, version = version + 1 WHERE id = ?").run(result.after, now, reason ?? null, now, id)
      writeLedger(id, [{ type: 'refund', amount: order.amount_cents as number, memo: '退款（全额，模拟口径）｜原因：' + (reason ?? '') }])
      // 退款 → 报名撤销
      db.prepare("UPDATE enrollments SET status = 'cancelled', updated_at = ?, version = version + 1 WHERE course_id = ? AND account_id = ? AND status = 'approved'").run(now, order.course_id, order.account_id)
      audit(ctx, { action: `order.${action}`, resourceType: 'order', resourceId: id, before: { status: result.before }, after: { status: result.after }, reason })
      enqueueNotify({
        targetAccountId: order.account_id as string, category: 'biz', kind: 'order',
        title: '退款已处理（模拟）', body: `课程「${order.course_name}」订单已退款`, bizRefType: 'order', bizRefId: id,
      })
      pumpOutbox()
      return reply.send({ data: { id, status: result.after, version: (order.version as number) + 1 } })
    }

    // request_refund / cancel
    db.prepare('UPDATE orders SET status = ?, refund_reason = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(
      result.after, action === 'request_refund' ? reason ?? null : order.refund_reason ?? null, now, id,
    )
    if (action === 'request_refund') {
      enqueueNotify({
        targetAccountId: order.mentor_account_id as string, category: 'biz', kind: 'order',
        title: '收到退款申请', body: `课程「${order.course_name}」订单申请退款：${reason ?? ''}`, bizRefType: 'order', bizRefId: id,
      })
      pumpOutbox()
    }
    audit(ctx, { action: `order.${action}`, resourceType: 'order', resourceId: id, before: { status: result.before }, after: { status: result.after }, reason })
    return reply.send({ data: { id, status: result.after, version: (order.version as number) + 1 } })
  })

  /* 订单资金流水（本人 / 课程导师 / 组织管理员 / 平台；按读取范围二次裁剪） */
  app.get('/orders/:id/ledger', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const order = db
      .prepare(
        `SELECT o.*, c.mentor_account_id, c.org_id FROM orders o JOIN courses c ON c.id = o.course_id WHERE o.id = ?`,
      )
      .get(id) as (Record<string, unknown> & { account_id: string; mentor_account_id: string; org_id: string | null }) | undefined
    if (!order) throw err.forbidden('订单不存在')
    if (!canReadOrderLedger(ctx, order)) throw err.forbidden('无权查看该订单流水')
    const rows = db.prepare('SELECT id, entry_type, amount_cents, memo, created_at FROM ledger_entries WHERE order_id = ? ORDER BY created_at').all(id)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })
}
