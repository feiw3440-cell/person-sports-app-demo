// /v1/history：浏览历史（阶段五 E-4）
// 仅记录登录用户本人对公开实体的浏览；同实体去重（重复浏览刷新 viewed_at）；无隐私敏感维度。
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db } from '../db'
import { audit } from '../audit'
import { err, newId, nowISO } from '../util'

const VALID_TYPES = ['content', 'course', 'competition', 'profile', 'project', 'org'] as const
type HistoryType = (typeof VALID_TYPES)[number]

export async function historyRoutes(app: FastifyInstance): Promise<void> {
  /* 上报浏览（本人）：upsert viewed_at */
  app.post('/history', async (req, reply) => {
    const ctx = requireAuth(req)
    const b = (req.body ?? {}) as { target_type?: string; target_id?: string }
    const targetType = String(b.target_type ?? '') as HistoryType
    const targetId = String(b.target_id ?? '').trim()
    if (!VALID_TYPES.includes(targetType)) throw err.validation('target_type 不合法')
    if (!targetId || targetId.length > 100) throw err.validation('缺少 target_id')
    const existing = db
      .prepare('SELECT id FROM view_history WHERE account_id = ? AND target_type = ? AND target_id = ?')
      .get(ctx.accountId, targetType, targetId) as { id: string } | undefined
    if (existing) {
      db.prepare('UPDATE view_history SET viewed_at = ? WHERE id = ?').run(nowISO(), existing.id)
      return reply.send({ data: { id: existing.id, viewed_at: nowISO() } })
    }
    const id = newId('vh_')
    db.prepare(
      'INSERT INTO view_history(id, account_id, target_type, target_id, viewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, ctx.accountId, targetType, targetId, nowISO(), nowISO())
    audit(ctx, { action: 'history.view', resourceType: 'view_history', resourceId: id, after: { target_type: targetType, target_id: targetId } })
    return reply.send({ data: { id, viewed_at: nowISO() } })
  })

  /* 本人浏览历史（倒序分页；实体名称由客户端按水合数据映射，不跨表 JOIN） */
  app.get('/history/mine', async (req, reply) => {
    const ctx = requireAuth(req)
    const q = req.query as { target_type?: string; page?: string; page_size?: string }
    const page = Math.max(1, Number(q.page || 1))
    const pageSize = Math.min(Number(q.page_size || 20), 100)
    const where: string[] = ['account_id = ?']
    const args: unknown[] = [ctx.accountId]
    if (q.target_type && VALID_TYPES.includes(q.target_type as HistoryType)) {
      where.push('target_type = ?')
      args.push(q.target_type)
    }
    const whereSql = 'WHERE ' + where.join(' AND ')
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM view_history ${whereSql}`).get(...args) as { c: number }).c
    const rows = db
      .prepare(`SELECT id, target_type, target_id, viewed_at FROM view_history ${whereSql} ORDER BY viewed_at DESC LIMIT ? OFFSET ?`)
      .all(...args, pageSize, (page - 1) * pageSize)
    return reply.send({ data: rows, meta: { total, page, page_size: pageSize } })
  })
}
