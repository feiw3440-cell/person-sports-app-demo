// /v1/interactions：关注、点赞/收藏、评论（APP 与 PC 共用同一互动关系，权威库存储）
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db } from '../db'
import { err, newId, nowISO } from '../util'

/** P2-03：reaction 支持多态目标（content / project），与 follows 设计一致 */
const REACTION_TARGETS = ['content', 'project'] as const
type ReactionTarget = (typeof REACTION_TARGETS)[number]

/** 路由层校验目标存在（迁移 007 后 reactions 无外键，改由此保证无悬空数据） */
function assertTargetExists(targetType: ReactionTarget, targetId: string): void {
  const table = targetType === 'content' ? 'contents' : 'sports_projects'
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(targetId)
  if (!row) throw err.validation(`${targetType === 'content' ? '内容' : '项目'}不存在`)
}

function countsFor(targetType: string, targetId: string) {
  const followers =
    targetType === 'profile' || targetType === 'project' || targetType === 'org' || targetType === 'content'
      ? (db.prepare('SELECT COUNT(*) AS c FROM follows WHERE target_type = ? AND target_id = ?').get(targetType, targetId) as { c: number }).c
      : 0
  const reactionsCount = (kind: string) =>
    (db.prepare('SELECT COUNT(*) AS c FROM reactions WHERE target_type = ? AND target_id = ? AND kind = ?').get(targetType, targetId, kind) as { c: number }).c
  const likes = REACTION_TARGETS.includes(targetType as ReactionTarget) ? reactionsCount('like') : 0
  const favs = REACTION_TARGETS.includes(targetType as ReactionTarget) ? reactionsCount('fav') : 0
  const comments =
    targetType === 'content'
      ? (db.prepare("SELECT COUNT(*) AS c FROM comments WHERE content_id = ? AND status = 'visible'").get(targetId) as { c: number }).c
      : 0
  return { followers, likes, favs, comments }
}

export async function interactionRoutes(app: FastifyInstance): Promise<void> {
  /* 我的互动关系（关注列表 + 点赞/收藏列表） */
  app.get('/interactions/my', async (req, reply) => {
    const ctx = requireAuth(req)
    const follows = db
      .prepare('SELECT target_type, target_id, created_at FROM follows WHERE account_id = ? ORDER BY created_at DESC')
      .all(ctx.accountId)
    const reactions = db
      .prepare('SELECT target_type, target_id, kind, created_at FROM reactions WHERE account_id = ? ORDER BY created_at DESC')
      .all(ctx.accountId)
    return reply.send({ data: { follows, reactions }, meta: {} })
  })

  /* 单目标互动统计 */
  app.get('/interactions', async (req, reply) => {
    requireAuth(req)
    const q = req.query as { target_type?: string; target_id?: string }
    if (!q.target_type || !q.target_id) throw err.validation('缺少 target_type / target_id')
    if (!['profile', 'project', 'org', 'content'].includes(q.target_type)) throw err.validation('target_type 非法')
    return reply.send({ data: { target_type: q.target_type, target_id: q.target_id, ...countsFor(q.target_type, q.target_id) }, meta: {} })
  })

  /* 关注 / 取消关注（幂等 toggle；同一关系不会重复创建） */
  app.post('/interactions/follow', async (req, reply) => {
    const ctx = requireAuth(req)
    const { target_type, target_id } = (req.body ?? {}) as { target_type: string; target_id: string }
    if (!['profile', 'project', 'org', 'content'].includes(target_type)) throw err.validation('target_type 非法')
    if (!target_id) throw err.validation('缺少 target_id')
    const dup = db
      .prepare('SELECT id FROM follows WHERE account_id = ? AND target_type = ? AND target_id = ?')
      .get(ctx.accountId, target_type, target_id) as { id: string } | undefined
    if (dup) {
      db.prepare('DELETE FROM follows WHERE id = ?').run(dup.id)
      auditLite(ctx, 'unfollow', target_type, target_id)
      return reply.send({ data: { followed: false, target_type, target_id, ...countsFor(target_type, target_id) } })
    }
    db.prepare('INSERT INTO follows(id, account_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?)').run(
      newId('fw_'), ctx.accountId, target_type, target_id, nowISO(),
    )
    auditLite(ctx, 'follow', target_type, target_id)
    return reply.send({ data: { followed: true, target_type, target_id, ...countsFor(target_type, target_id) } })
  })

  /* 点赞 / 收藏（多态目标 content/project；幂等 toggle；P2-03） */
  app.post('/interactions/reactions', async (req, reply) => {
    const ctx = requireAuth(req)
    const body = (req.body ?? {}) as { target_type?: string; target_id?: string; content_id?: string; kind?: string }
    const kind = body.kind as 'like' | 'fav'
    if (!['like', 'fav'].includes(kind)) throw err.validation('kind 非法')
    // 兼容旧客户端：缺省 target_type=content，content_id 作为 target_id
    const targetType = (body.target_type ?? 'content') as ReactionTarget
    if (!REACTION_TARGETS.includes(targetType)) throw err.validation('target_type 非法')
    const targetId = body.target_id ?? body.content_id
    if (!targetId) throw err.validation('缺少 target_id')
    assertTargetExists(targetType, targetId) // 无外键后由路由校验目标存在，避免悬空数据

    const dup = db
      .prepare('SELECT id FROM reactions WHERE target_type = ? AND target_id = ? AND account_id = ? AND kind = ?')
      .get(targetType, targetId, ctx.accountId, kind) as { id: string } | undefined
    if (dup) {
      db.prepare('DELETE FROM reactions WHERE id = ?').run(dup.id)
      auditLite(ctx, 'un' + kind, targetType, targetId)
      return reply.send({ data: { active: false, target_type: targetType, target_id: targetId, kind, ...countsFor(targetType, targetId) } })
    }
    try {
      db.prepare('INSERT INTO reactions(id, target_type, target_id, account_id, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        newId('rc_'), targetType, targetId, ctx.accountId, kind, nowISO(),
      )
    } catch (e) {
      // 并发重复点击：唯一约束兜底，视为已生效，不返回 500
      if ((e as { code?: string }).code !== 'SQLITE_CONSTRAINT_UNIQUE') throw e
    }
    auditLite(ctx, kind, targetType, targetId)
    return reply.send({ data: { active: true, target_type: targetType, target_id: targetId, kind, ...countsFor(targetType, targetId) } })
  })

  /* 内容评论：列表 + 发表（幂等键见请求头 Idempotency-Key，由全局幂等逻辑处理） */
  app.get('/contents/:id/comments', async (req, reply) => {
    requireAuth(req)
    const { id } = req.params as { id: string }
    const rows = db
      .prepare(
        `SELECT c.id, c.body, c.created_at, a.display_name, a.avatar_url FROM comments c
         JOIN accounts a ON a.id = c.account_id WHERE c.content_id = ? AND c.status = 'visible'
         ORDER BY c.created_at DESC LIMIT 50`,
      )
      .all(id) as { id: string; body: string; created_at: string; display_name: string; avatar_url: string | null }[]
    return reply.send({ data: rows, meta: { total: rows.length } })
  })

  app.post('/contents/:id/comments', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { body } = (req.body ?? {}) as { body?: string }
    if (!body || !body.trim()) throw err.validation('评论内容不能为空')
    const cid = newId('cm_')
    db.prepare('INSERT INTO comments(id, content_id, account_id, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      cid, id, ctx.accountId, body.trim(), 'visible', nowISO(),
    )
    return reply.code(201).send({ data: { id: cid, ...countsFor('content', id) } })
  })
}

/* 轻量审计（写 audit_logs；不引入额外依赖） */
function auditLite(
  ctx: { accountId: string; orgId?: string | null; client: string },
  action: string,
  resourceType: string,
  resourceId: string,
): void {
  db.prepare(
    'INSERT INTO audit_logs(id, actor_account_id, org_id, client, action, resource_type, resource_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(newId('al_'), ctx.accountId, ctx.orgId ?? null, ctx.client, action, resourceType, resourceId, nowISO())
}
