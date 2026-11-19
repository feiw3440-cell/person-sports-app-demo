// /v1/revenue：收入账本与模拟结算（F-4）
// 口径：
//   * 收入全部来自订单快照（amount/platform_fee/mentor_amount），不重新按当前课程价格计算
//   * 平台/导师净收入 = 已支付快照 - 已退款快照；退款不修改历史流水，仅以订单状态冲减
//   * 待结算 = status='paid' 且未被任何结算单引用；已结算以 settlement_items.order_id UNIQUE 防重复
//   * 结算为模拟口径，不触发真实资金划转；已结算订单退款会被拒绝（冲正流程待产品决策）
import type { FastifyInstance } from 'fastify'
import { requireAuth, type AuthContext } from '../auth'
import { db } from '../db'
import { requirePerm, rolesOf } from '../rbac'
import { audit } from '../audit'
import { idempotencyReplay, idempotencySave } from '../helpers'
import { enqueueNotify, pumpOutbox } from '../outbox'
import { err, newId, nowISO } from '../util'
import { feeRatePercent, getPlatformFeeRate, setPlatformFeeRate } from '../commerce'

type Scope = { sql: string; args: unknown[]; kind: 'self' | 'org' | 'platform' } | null

function pageArgs(q: { page?: string; page_size?: string }): { page: number; pageSize: number; offset: number } {
  const pageRaw = Number(q.page ?? 1)
  const sizeRaw = Number(q.page_size ?? 20)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
  const pageSize = Number.isFinite(sizeRaw) && sizeRaw >= 1 ? Math.min(Math.floor(sizeRaw), 100) : 20
  return { page, pageSize, offset: (page - 1) * pageSize }
}

/** 订单收入范围：导师本人（授课课程）/ 本组织 / 平台 */
function readScope(ctx: AuthContext, dataScope: string): Scope {
  if (dataScope === 'platform' || dataScope === 'all') return { sql: '1 = 1', args: [], kind: 'platform' }
  if (dataScope === 'own_org') {
    if (!ctx.orgId) return null
    return { sql: 'c.org_id = ?', args: [ctx.orgId], kind: 'org' }
  }
  return { sql: 'c.mentor_account_id = ?', args: [ctx.accountId], kind: 'self' }
}

function settlementScope(ctx: AuthContext, dataScope: string): Scope {
  if (dataScope === 'platform' || dataScope === 'all') return { sql: '1 = 1', args: [], kind: 'platform' }
  if (dataScope === 'own_org') {
    if (!ctx.orgId) return null
    return { sql: 's.org_id = ?', args: [ctx.orgId], kind: 'org' }
  }
  return { sql: 's.mentor_account_id = ?', args: [ctx.accountId], kind: 'self' }
}

function periodBound(value: string | undefined, end: boolean): string | null {
  if (!value) return null
  const s = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) throw err.validation('日期格式需为 YYYY-MM-DD')
  if (s.length === 10) return end ? `${s}T23:59:59.999Z` : `${s}T00:00:00.000Z`
  return s
}

function summaryFor(ctx: AuthContext) {
  const perm = requirePerm(ctx, 'revenue', 'read')
  const scope = readScope(ctx, perm.data_scope)
  if (!scope) {
    return {
      empty: true, order_count: 0, gross_paid_cents: 0, refunded_cents: 0,
      platform_income_cents: 0, mentor_income_cents: 0, pending_settlement_cents: 0,
      pending_order_count: 0, settled_mentor_cents: 0, settlement_count: 0,
    }
  }
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN o.status IN ('paid','refund_requested','refunded') THEN 1 ELSE 0 END), 0) AS order_count,
         COALESCE(SUM(CASE WHEN o.status IN ('paid','refund_requested','refunded') THEN o.amount_cents ELSE 0 END), 0) AS gross_paid_cents,
         COALESCE(SUM(CASE WHEN o.status = 'refunded' THEN o.amount_cents ELSE 0 END), 0) AS refunded_cents,
         COALESCE(SUM(CASE WHEN o.status IN ('paid','refund_requested','refunded') THEN o.platform_fee_cents ELSE 0 END), 0) AS platform_gross_cents,
         COALESCE(SUM(CASE WHEN o.status = 'refunded' THEN o.platform_fee_cents ELSE 0 END), 0) AS platform_refund_cents,
         COALESCE(SUM(CASE WHEN o.status IN ('paid','refund_requested','refunded') THEN o.mentor_amount_cents ELSE 0 END), 0) AS mentor_gross_cents,
         COALESCE(SUM(CASE WHEN o.status = 'refunded' THEN o.mentor_amount_cents ELSE 0 END), 0) AS mentor_refund_cents,
         COALESCE(SUM(CASE WHEN o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM settlement_items si WHERE si.order_id = o.id) THEN o.mentor_amount_cents ELSE 0 END), 0) AS pending_settlement_cents,
         COALESCE(SUM(CASE WHEN o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM settlement_items si WHERE si.order_id = o.id) THEN 1 ELSE 0 END), 0) AS pending_order_count,
         COALESCE(SUM(CASE WHEN o.status = 'paid' AND EXISTS (SELECT 1 FROM settlement_items si WHERE si.order_id = o.id) THEN o.mentor_amount_cents ELSE 0 END), 0) AS settled_mentor_cents
       FROM orders o JOIN courses c ON c.id = o.course_id
       WHERE ${scope.sql}`,
    )
    .get(...scope.args) as Record<string, number>
  const sScope = settlementScope(ctx, perm.data_scope)
  const settled = sScope
    ? (db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(s.mentor_amount_cents),0) AS m FROM settlements s WHERE ${sScope.sql} AND s.status = 'settled'`).get(...sScope.args) as { c: number; m: number })
    : { c: 0, m: 0 }
  // 待审批申请单（仅本人/本组织/平台范围内）
  const pendingApps = sScope
    ? (db.prepare(`SELECT COUNT(*) AS c FROM settlements s WHERE ${sScope.sql} AND s.status = 'pending'`).get(...sScope.args) as { c: number })
    : { c: 0 }
  return {
    ...row,
    platform_income_cents: row.platform_gross_cents - row.platform_refund_cents,
    mentor_income_cents: row.mentor_gross_cents - row.mentor_refund_cents,
    settlement_count: settled.c,
    settlement_total_cents: settled.m,
    pending_settlement_applications: pendingApps.c,
  }
}

export async function revenueRoutes(app: FastifyInstance): Promise<void> {
  /* 收入概览（含待结算/已结算汇总；金额均为服务端计算） */
  app.get('/revenue/summary', async (req, reply) => {
    const ctx = requireAuth(req)
    const summary = summaryFor(ctx)
    const rate = getPlatformFeeRate()
    return reply.send({
      data: {
        ...summary,
        fee_rate: rate,
        fee_rate_label: feeRatePercent(rate),
        fee_note: '平台服务费率为演示参数，最终费率与导师分成规则待产品决策；历史订单按 fee_rate_snapshot 保留。',
        settlement_note: '结算为模拟口径：不触发真实资金划转，仅生成本地结算记录。',
      },
    })
  })

  /* 兼容交接提示词中的 /analytics/revenue（与 /revenue/summary 同口径） */
  app.get('/analytics/revenue', async (req, reply) => {
    const ctx = requireAuth(req)
    return reply.send({ data: summaryFor(ctx) })
  })

  /* 收入明细（订单级；含退款冲减后的净额与结算标记） */
  app.get('/revenue/orders', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'revenue', 'read')
    const scope = readScope(ctx, perm.data_scope)
    const q = req.query as { status?: string; course_id?: string; page?: string; page_size?: string }
    const { page, pageSize, offset } = pageArgs(q)
    if (!scope) return reply.send({ data: [], meta: { total: 0, page, page_size: pageSize } })
    const where = [scope.sql, "o.status IN ('paid','refund_requested','refunded')"]
    const args = [...scope.args]
    if (q.status) {
      if (!['paid', 'refund_requested', 'refunded'].includes(q.status)) throw err.validation('status 不合法')
      where.push('o.status = ?'); args.push(q.status)
    }
    if (q.course_id) { where.push('o.course_id = ?'); args.push(q.course_id) }
    const whereSql = 'WHERE ' + where.join(' AND ')
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM orders o JOIN courses c ON c.id = o.course_id ${whereSql}`).get(...args) as { c: number }).c
    const rows = db
      .prepare(
        `SELECT o.id, o.order_no, o.status, o.amount_cents, o.platform_fee_cents, o.mentor_amount_cents,
                o.fee_rate_snapshot, o.created_at, o.paid_at, o.refunded_at, o.refund_reason,
                c.id AS course_id, c.name AS course_name, c.mentor_account_id, c.org_id,
                m.display_name AS mentor_name, a.display_name AS account_name,
                CASE WHEN EXISTS (SELECT 1 FROM settlement_items si WHERE si.order_id = o.id) THEN 1 ELSE 0 END AS settled
         FROM orders o JOIN courses c ON c.id = o.course_id
         JOIN accounts m ON m.id = c.mentor_account_id
         JOIN accounts a ON a.id = o.account_id
         ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, offset) as Record<string, unknown>[]
    return reply.send({
      data: rows.map((r) => ({
        ...r,
        platform_net_cents: r.status === 'refunded' ? 0 : r.platform_fee_cents,
        mentor_net_cents: r.status === 'refunded' ? 0 : r.mentor_amount_cents,
      })),
      meta: { total, page, page_size: pageSize },
    })
  })

  /* 待结算订单（paid 且未被结算引用） */
  app.get('/revenue/pending', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'revenue', 'read')
    const scope = readScope(ctx, perm.data_scope)
    if (!scope) return reply.send({ data: [], mentors: [], meta: { total: 0, pending_cents: 0 } })
    const rows = db
      .prepare(
        `SELECT o.id, o.order_no, o.amount_cents, o.mentor_amount_cents, o.paid_at,
                c.id AS course_id, c.name AS course_name, c.mentor_account_id, c.org_id,
                m.display_name AS mentor_name, a.display_name AS account_name
         FROM orders o JOIN courses c ON c.id = o.course_id
         JOIN accounts m ON m.id = c.mentor_account_id
         JOIN accounts a ON a.id = o.account_id
         WHERE ${scope.sql} AND o.status = 'paid'
           AND NOT EXISTS (SELECT 1 FROM settlement_items si WHERE si.order_id = o.id)
         ORDER BY o.paid_at ASC`,
      )
      .all(...scope.args) as Record<string, unknown>[]
    const mentors = db
      .prepare(
        `SELECT c.mentor_account_id, m.display_name AS mentor_name, COUNT(*) AS order_count,
                COALESCE(SUM(o.mentor_amount_cents),0) AS pending_cents
         FROM orders o JOIN courses c ON c.id = o.course_id JOIN accounts m ON m.id = c.mentor_account_id
         WHERE ${scope.sql} AND o.status = 'paid'
           AND NOT EXISTS (SELECT 1 FROM settlement_items si WHERE si.order_id = o.id)
         GROUP BY c.mentor_account_id, m.display_name ORDER BY pending_cents DESC`,
      )
      .all(...scope.args) as Record<string, unknown>[]
    return reply.send({
      data: rows,
      mentors,
      meta: { total: rows.length, pending_cents: rows.reduce((n, r) => n + Number(r.mentor_amount_cents), 0) },
    })
  })

  /* 结算记录（含 pending 申请单 / settled 已批 / rejected 已驳回） */
  app.get('/revenue/settlements', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'revenue', 'read')
    const scope = settlementScope(ctx, perm.data_scope)
    if (!scope) return reply.send({ data: [], meta: { total: 0 } })
    const q = req.query as { status?: string }
    const where = [scope.sql]
    const args = [...scope.args]
    if (q.status) {
      if (!['pending', 'settled', 'rejected'].includes(q.status)) throw err.validation('status 不合法')
      where.push('s.status = ?'); args.push(q.status)
    }
    const rows = db
      .prepare(
        `SELECT s.*, m.display_name AS mentor_name,
                u.display_name AS settled_by_name, ab.display_name AS applied_by_name, o.name AS org_name
         FROM settlements s JOIN accounts m ON m.id = s.mentor_account_id
         LEFT JOIN accounts u ON u.id = s.settled_by
         LEFT JOIN accounts ab ON ab.id = s.applied_by
         LEFT JOIN organizations o ON o.id = s.org_id
         WHERE ${where.join(' AND ')} ORDER BY COALESCE(s.settled_at, s.applied_at, s.created_at) DESC`,
      )
      .all(...args)
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  app.get('/revenue/settlements/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    const perm = requirePerm(ctx, 'revenue', 'read')
    const { id } = req.params as { id: string }
    const s = db
      .prepare(
        `SELECT s.*, m.display_name AS mentor_name,
                u.display_name AS settled_by_name, ab.display_name AS applied_by_name, o.name AS org_name
         FROM settlements s JOIN accounts m ON m.id = s.mentor_account_id
         LEFT JOIN accounts u ON u.id = s.settled_by
         LEFT JOIN accounts ab ON ab.id = s.applied_by
         LEFT JOIN organizations o ON o.id = s.org_id WHERE s.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined
    if (!s) throw err.notFound('结算单不存在')
    const allowed =
      perm.data_scope === 'platform' || perm.data_scope === 'all'
        ? true
        : perm.data_scope === 'own_org'
          ? !!ctx.orgId && s.org_id === ctx.orgId
          : s.mentor_account_id === ctx.accountId
    if (!allowed) throw err.forbidden()
    const items = db
      .prepare(
        `SELECT si.*, o.order_no, o.status AS order_status, c.name AS course_name, a.display_name AS account_name
         FROM settlement_items si JOIN orders o ON o.id = si.order_id
         JOIN courses c ON c.id = si.course_id JOIN accounts a ON a.id = o.account_id
         WHERE si.settlement_id = ? ORDER BY si.paid_at`,
      )
      .all(id)
    return reply.send({ data: { ...s, items } })
  })

  /* ===== 结算申请/审批分离（P1-03）=====
   * 申请（POST /revenue/settlements）：导师本人或组织/平台代为发起，生成 pending 单并预留订单（settlement_items）
   * 审批（POST /revenue/settlements/:id/approve）：机构仅本组织、平台按授权；【申请人/导师本人不可审批】
   * 驳回（POST /revenue/settlements/:id/reject）：释放预留订单，允许重新申请
   * 状态机：pending → settled / rejected；settled / rejected 为终态，不可再审批
   * 金额全部由服务端按订单快照计算；settlement_items.order_id UNIQUE 防重复；全程审计
   */

  /** 审批人公共校验：权限范围 + 自批自结阻断 + 状态机 */
  function loadApprovable(ctx: AuthContext, id: string, permScope: string, action: string): Record<string, any> {
    // 权限：导师/教练无 revenue.approve → 此处 requirePerm 直接 403（从权限表层面杜绝自批自结）
    requirePerm(ctx, 'revenue', 'approve')
    const s = db.prepare('SELECT * FROM settlements WHERE id = ?').get(id) as Record<string, any> | undefined
    if (!s) throw err.notFound('结算申请单不存在')
    if (s.status !== 'pending') throw err.state(`该申请单状态为 ${s.status}，仅 pending 可${action}`)
    // 数据范围：机构仅本组织、平台按授权；self 无审批权限（防御性兜底）
    if (permScope === 'platform' || permScope === 'all') {
      // 平台全量
    } else if (permScope === 'own_org') {
      if (!ctx.orgId || s.org_id !== ctx.orgId) throw err.forbidden('该申请单不属于当前组织')
    } else {
      throw err.forbidden('当前身份无结算审批权限')
    }
    // 服务端强校验：申请人不可审批自己的申请；导师不可审批自结
    if (s.applied_by === ctx.accountId || s.mentor_account_id === ctx.accountId) {
      throw err.forbidden('不可审批本人发起或本人相关的结算申请（申请/审批必须分离）')
    }
    return s
  }

  /* 申请结算 */
  app.post('/revenue/settlements', async (req, reply) => {
    const ctx = requireAuth(req)
    const replay = idempotencyReplay(req, ctx.accountId)
    if (replay) {
      reply.header('Idempotency-Replayed', 'true')
      reply.code(replay.status)
      return replay.body
    }
    const perm = requirePerm(ctx, 'revenue', 'settle')
    const b = (req.body ?? {}) as { mentor_account_id?: string; period_start?: string; period_end?: string }
    let mentorId: string
    let orgFilter: string | null = null
    if (perm.data_scope === 'platform' || perm.data_scope === 'all') {
      if (!b.mentor_account_id) throw err.validation('平台申请须指定 mentor_account_id')
      mentorId = b.mentor_account_id
    } else if (perm.data_scope === 'own_org') {
      if (!ctx.orgId) throw err.forbidden('缺少组织上下文')
      if (!b.mentor_account_id) throw err.validation('组织申请须指定 mentor_account_id')
      orgFilter = ctx.orgId
      const inOrg = db.prepare('SELECT 1 FROM courses WHERE mentor_account_id = ? AND org_id = ? LIMIT 1').get(b.mentor_account_id, ctx.orgId)
      if (!inOrg) throw err.forbidden('该导师不属于当前组织')
      mentorId = b.mentor_account_id
    } else {
      // 导师/教练：只能为本人发起申请；审批由机构或平台完成
      mentorId = ctx.accountId
      if (b.mentor_account_id && b.mentor_account_id !== ctx.accountId) throw err.forbidden('只能为本人发起结算申请')
    }
    const mentor = db.prepare("SELECT id, display_name FROM accounts WHERE id = ? AND status = 'active'").get(mentorId) as { id: string; display_name: string } | undefined
    if (!mentor) throw err.forbidden('导师账号不存在或不可用')

    const start = periodBound(b.period_start, false)
    const end = periodBound(b.period_end, true)
    const where = ["o.status = 'paid'", 'c.mentor_account_id = ?', 'NOT EXISTS (SELECT 1 FROM settlement_items si WHERE si.order_id = o.id)']
    const args: unknown[] = [mentorId]
    if (orgFilter) { where.push('c.org_id = ?'); args.push(orgFilter) }
    if (start) { where.push('o.paid_at >= ?'); args.push(start) }
    if (end) { where.push('o.paid_at <= ?'); args.push(end) }
    const orders = db
      .prepare(
        `SELECT o.id, o.amount_cents, o.platform_fee_cents, o.mentor_amount_cents, o.paid_at, o.course_id, c.org_id
         FROM orders o JOIN courses c ON c.id = o.course_id
         WHERE ${where.join(' AND ')} ORDER BY o.paid_at ASC`,
      )
      .all(...args) as { id: string; amount_cents: number; platform_fee_cents: number; mentor_amount_cents: number; paid_at: string | null; course_id: string; org_id: string | null }[]
    if (orders.length === 0) throw err.state('当前没有可申请的已支付订单（已结算/未支付/已退款/审批中订单不参与申请）')

    const gross = orders.reduce((n, o) => n + o.amount_cents, 0)
    const fee = orders.reduce((n, o) => n + o.platform_fee_cents, 0)
    const mentorAmount = orders.reduce((n, o) => n + o.mentor_amount_cents, 0)
    const orgIds = new Set(orders.map((o) => o.org_id).filter((v): v is string => !!v))
    const settlementOrg = orgFilter ?? (orgIds.size === 1 ? [...orgIds][0] : null)
    const sid = newId('st_')
    const settlementNo = 'ST' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100)
    const now = nowISO()
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO settlements(id, settlement_no, mentor_account_id, org_id, gross_amount_cents, platform_fee_cents,
                                 mentor_amount_cents, order_count, status, period_start, period_end,
                                 applied_by, applied_at, settled_by, settled_at, reject_reason, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 1)`,
      ).run(sid, settlementNo, mentorId, settlementOrg, gross, fee, mentorAmount, orders.length, start, end, ctx.accountId, now, now, now)
      for (const o of orders) {
        db.prepare(
          `INSERT INTO settlement_items(id, settlement_id, order_id, course_id, amount_cents, platform_fee_cents, mentor_amount_cents, paid_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(newId('sti_'), sid, o.id, o.course_id, o.amount_cents, o.platform_fee_cents, o.mentor_amount_cents, o.paid_at, now)
      }
    })
    try {
      tx()
    } catch (e) {
      if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') throw err.conflict('SETTLEMENT_CONFLICT', '订单已被其他结算申请引用，请刷新后重试')
      throw e
    }
    audit(ctx, {
      action: 'settlement.apply', resourceType: 'settlement', resourceId: sid,
      after: { settlement_no: settlementNo, mentor_account_id: mentorId, order_count: orders.length, mentor_amount_cents: mentorAmount, applied_by: ctx.accountId, simulated: true },
    })
    if (mentorId !== ctx.accountId) {
      enqueueNotify({
        targetAccountId: mentorId, category: 'biz', kind: 'order',
        title: '收入结算申请已提交', body: `${orders.length} 笔订单已提交结算申请，导师收入 ¥${(mentorAmount / 100).toFixed(2)}，待机构/平台审批。`,
        bizRefType: 'settlement', bizRefId: sid,
      })
      pumpOutbox()
    }
    const body = {
      data: {
        id: sid, settlement_no: settlementNo, mentor_account_id: mentorId, mentor_name: mentor.display_name,
        org_id: settlementOrg, gross_amount_cents: gross, platform_fee_cents: fee, mentor_amount_cents: mentorAmount,
        order_count: orders.length, status: 'pending', applied_by: ctx.accountId, applied_at: now, simulated: true,
      },
    }
    idempotencySave(req, ctx.accountId, 201, body)
    reply.code(201)
    return reply.send(body)
  })

  /* 审批通过：pending → settled（申请人/导师本人不可审批） */
  app.post('/revenue/settlements/:id/approve', async (req, reply) => {
    const ctx = requireAuth(req)
    const replay = idempotencyReplay(req, ctx.accountId)
    if (replay) {
      reply.header('Idempotency-Replayed', 'true')
      reply.code(replay.status)
      return replay.body
    }
    const perm = requirePerm(ctx, 'revenue', 'approve')
    const { id } = req.params as { id: string }
    const s = loadApprovable(ctx, id, perm.data_scope, '审批')
    // 审批前复核：申请单内订单仍须为 paid（若期间发生退款，需驳回后重新申请）
    const bad = (db.prepare(
      `SELECT COUNT(*) AS c FROM settlement_items si JOIN orders o ON o.id = si.order_id
       WHERE si.settlement_id = ? AND o.status <> 'paid'`,
    ).get(id) as { c: number }).c
    if (bad > 0) throw err.state('该申请单包含状态已变化的订单（如退款），请驳回后重新申请')
    const now = nowISO()
    const before = { status: s.status, settled_by: s.settled_by, settled_at: s.settled_at }
    db.prepare(
      `UPDATE settlements SET status = 'settled', settled_by = ?, settled_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND status = 'pending'`,
    ).run(ctx.accountId, now, now, id)
    audit(ctx, {
      action: 'settlement.approve', resourceType: 'settlement', resourceId: id,
      before, after: { status: 'settled', settled_by: ctx.accountId, settled_at: now, applied_by: s.applied_by },
    })
    enqueueNotify({
      targetAccountId: s.mentor_account_id, category: 'biz', kind: 'order',
      title: '收入结算已审批', body: `结算单 ${s.settlement_no} 已审批通过，导师收入 ¥${(s.mentor_amount_cents / 100).toFixed(2)}（模拟，无真实资金划转）。`,
      bizRefType: 'settlement', bizRefId: id,
    })
    pumpOutbox()
    const body = { data: { id, status: 'settled', settled_by: ctx.accountId, settled_at: now, simulated: true } }
    idempotencySave(req, ctx.accountId, 200, body)
    return reply.send(body)
  })

  /* 驳回：pending → rejected，释放预留订单（允许重新申请） */
  app.post('/revenue/settlements/:id/reject', async (req, reply) => {
    const ctx = requireAuth(req)
    const replay = idempotencyReplay(req, ctx.accountId)
    if (replay) {
      reply.header('Idempotency-Replayed', 'true')
      reply.code(replay.status)
      return replay.body
    }
    const perm = requirePerm(ctx, 'revenue', 'approve')
    const { id } = req.params as { id: string }
    const s = loadApprovable(ctx, id, perm.data_scope, '驳回')
    const b = (req.body ?? {}) as { reason?: string }
    const reason = String(b.reason ?? '').trim()
    if (!reason) throw err.validation('驳回须填写原因')
    const now = nowISO()
    const before = { status: s.status, order_count: s.order_count }
    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE settlements SET status = 'rejected', settled_by = ?, settled_at = ?, reject_reason = ?, updated_at = ?, version = version + 1 WHERE id = ? AND status = 'pending'`,
      ).run(ctx.accountId, now, reason, now, id)
      // 释放预留订单：删除本单的 settlement_items（订单重新进入可申请池）
      db.prepare('DELETE FROM settlement_items WHERE settlement_id = ?').run(id)
    })
    tx()
    audit(ctx, {
      action: 'settlement.reject', resourceType: 'settlement', resourceId: id,
      before, after: { status: 'rejected', settled_by: ctx.accountId, reject_reason: reason },
      reason,
    })
    enqueueNotify({
      targetAccountId: s.mentor_account_id, category: 'biz', kind: 'order',
      title: '收入结算申请被驳回', body: `结算单 ${s.settlement_no} 被驳回：${reason}`,
      bizRefType: 'settlement', bizRefId: id,
    })
    pumpOutbox()
    const body = { data: { id, status: 'rejected', settled_by: ctx.accountId, reject_reason: reason, settled_at: now } }
    idempotencySave(req, ctx.accountId, 200, body)
    return reply.send(body)
  })

  /* 费率配置：读取所有有收入权限者可见；写入仅平台管理员（演示参数，待产品决策） */
  app.get('/revenue/config', async (req, reply) => {
    const ctx = requireAuth(req)
    requirePerm(ctx, 'revenue', 'read')
    const rate = getPlatformFeeRate()
    return reply.send({
      data: {
        fee_rate: rate, fee_rate_label: feeRatePercent(rate),
        note: '当前为演示参数，不是正式商业政策；最终平台服务费/导师分成规则待产品决策。',
      },
    })
  })

  app.patch('/revenue/config', async (req, reply) => {
    const ctx = requireAuth(req)
    if (!rolesOf(ctx).includes('platform_admin')) throw err.forbidden('仅平台管理员可修改演示费率')
    const b = (req.body ?? {}) as { fee_rate?: number }
    if (typeof b.fee_rate !== 'number') throw err.validation('缺少 fee_rate')
    setPlatformFeeRate(b.fee_rate)
    audit(ctx, { action: 'revenue.config', resourceType: 'config', resourceId: 'platform_fee_rate', after: { fee_rate: b.fee_rate } })
    const rate = getPlatformFeeRate()
    return reply.send({ data: { fee_rate: rate, fee_rate_label: feeRatePercent(rate) } })
  })
}
