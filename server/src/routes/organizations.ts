// /v1/organizations 与成员/邀请
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db, bumpPermVersion } from '../db'
import { requirePerm, rolesOf } from '../rbac'
import { audit } from '../audit'
import { enqueueNotify, pumpOutbox } from '../outbox'
import { applyFlow } from '../statemachine'
import { err, newId, nowISO } from '../util'

function isPlatform(ctx: { accountId: string; identityId?: string }): boolean {
  const roles = rolesOf({ accountId: ctx.accountId, identityId: ctx.identityId, client: 'pc', sessionId: '-', permVersion: 1 })
  return roles.some((r) => ['platform_admin', 'platform_ops'].includes(r))
}

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/organizations', async (req, reply) => {
    const ctx = requireAuth(req)
    const decorate = (rows: Record<string, unknown>[]) =>
      rows.map((r) => ({
        ...r,
        project_ids: db.prepare("SELECT project_id FROM project_relations WHERE entity_type = 'org' AND entity_id = ?").all(r.id).map((x) => (x as { project_id: string }).project_id),
      }))
    if (isPlatform(ctx)) {
      const rows = db.prepare('SELECT * FROM organizations ORDER BY name').all() as Record<string, unknown>[]
      return reply.send({ data: decorate(rows), meta: { total: rows.length } })
    }
    const rows = db
      .prepare(
        `SELECT o.*, m.role AS my_role, m.status AS my_status, m.id AS my_membership_id
         FROM memberships m JOIN organizations o ON o.id = m.org_id
         WHERE m.account_id = ? AND m.status IN ('pending','accepted')`,
      )
      .all(ctx.accountId) as Record<string, unknown>[]
    return reply.send({ data: decorate(rows), meta: { total: rows.length } })
  })

  app.get('/organizations/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!org) throw err.forbidden()
    if (!isPlatform(ctx)) {
      const m = db.prepare("SELECT id FROM memberships WHERE account_id = ? AND org_id = ? AND status = 'accepted'").get(ctx.accountId, id)
      if (!m) throw err.forbidden()
    }
    const memberCount = db.prepare("SELECT COUNT(*) AS c FROM memberships WHERE org_id = ? AND status = 'accepted'").get(id) as { c: number }
    return reply.send({ data: { ...org, member_count: memberCount.c } })
  })

  app.get('/organizations/:id/members', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const scope = requirePerm(ctx, 'members', 'read')
    const platform = isPlatform(ctx)
    if (scope.data_scope === 'own_org' && ctx.orgId !== id && !platform) throw err.forbidden()
    const page = Number((req.query as { page?: string }).page || 1)
    const pageSize = Math.min(Number((req.query as { page_size?: string }).page_size || 50), 100)
    const total = db.prepare('SELECT COUNT(*) AS c FROM memberships WHERE org_id = ?').get(id) as { c: number }
    const rows = db
      .prepare(
        `SELECT m.id, m.account_id, m.role, m.position, m.status, m.valid_until, m.created_at, m.version,
                a.display_name, a.avatar_url, a.login_name,
                (SELECT GROUP_CONCAT(i.identity_type) FROM identities i WHERE i.account_id = m.account_id AND i.status='active') AS identity_types
         FROM memberships m JOIN accounts a ON a.id = m.account_id
         WHERE m.org_id = ? ORDER BY m.created_at LIMIT ? OFFSET ?`,
      )
      .all(id, pageSize, (page - 1) * pageSize)
    return reply.send({ data: rows, meta: { total: total.c, page, page_size: pageSize } })
  })

  /* 邀请（org_admin）：生成 pending membership + 通知被邀请人 */
  app.post('/organizations/:id/invitations', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    requirePerm(ctx, 'members', 'invite')
    if (ctx.orgId !== id) throw err.forbidden('仅能管理当前组织')
    const { login_name, role, position, valid_until } = (req.body ?? {}) as {
      login_name?: string; role?: string; position?: string; valid_until?: string
    }
    if (!login_name || !role) throw err.validation('缺少 login_name 或 role')
    if (!['org_admin', 'coach', 'member', 'athlete'].includes(role)) throw err.validation('role 不合法')
    const account = db.prepare('SELECT id, display_name FROM accounts WHERE login_name = ?').get(login_name) as
      | { id: string; display_name: string }
      | undefined
    if (!account) throw err.notFound('登录名不存在（演示环境请使用种子账号）')
    const dup = db.prepare('SELECT id, status FROM memberships WHERE account_id = ? AND org_id = ?').get(account.id, id) as
      | { id: string; status: string }
      | undefined
    if (dup && ['pending', 'accepted'].includes(dup.status)) throw err.state('该账号已是成员或已有待处理邀请')
    let membershipId: string
    if (dup) {
      // 历史 declined/expired/revoked → 重新发起
      db.prepare('UPDATE memberships SET status = ?, role = ?, position = ?, valid_until = ?, invited_by = ?, decided_at = NULL, reason = NULL, updated_at = ?, version = version + 1 WHERE id = ?').run(
        'pending', role, position ?? null, valid_until ?? null, ctx.accountId, nowISO(), dup.id,
      )
      membershipId = dup.id
    } else {
      membershipId = newId('m_')
      db.prepare(
        'INSERT INTO memberships(id, account_id, org_id, role, position, status, valid_until, invited_by, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
      ).run(membershipId, account.id, id, role, position ?? null, 'pending', valid_until ?? null, ctx.accountId, nowISO(), nowISO())
    }
    const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(id) as { name: string }
    audit(ctx, { action: 'member.invite', resourceType: 'membership', resourceId: membershipId, after: { org_id: id, role, login_name } })
    enqueueNotify({
      targetAccountId: account.id, category: 'system', kind: 'invite',
      title: `「${org.name}」邀请您加入`,
      body: `岗位：${position || role}（演示通知）`, bizRefType: 'membership', bizRefId: membershipId,
    })
    pumpOutbox()
    return reply.code(201).send({ data: { id: membershipId, status: 'pending' } })
  })

  /* 成员动作：accept/decline（本人）、revoke（org_admin） */
  app.post('/memberships/:id/actions', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const { action, reason, version } = (req.body ?? {}) as { action: string; reason?: string; version?: number }
    const row = db.prepare('SELECT * FROM memberships WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw err.forbidden()
    const isSelfMember = row.account_id === ctx.accountId
    if (action === 'accept' || action === 'decline') {
      if (!isSelfMember) throw err.forbidden('只能处理自己的邀请')
    } else if (action === 'revoke') {
      requirePerm(ctx, 'members', 'manage')
      if (ctx.orgId !== row.org_id) throw err.forbidden()
    } else {
      throw err.validation('action 仅支持 accept/decline/revoke')
    }
    const result = applyFlow(ctx, `membership.${action}`, { status: row.status as string, version: row.version as number }, { action, reason, version })
    db.prepare('UPDATE memberships SET status = ?, decided_at = ?, reason = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(
      result.after, nowISO(), reason ?? null, nowISO(), id,
    )
    bumpPermVersion()
    audit(ctx, { action: `membership.${action}`, resourceType: 'membership', resourceId: id, before: { status: result.before }, after: { status: result.after }, reason })
    if (action === 'accept') {
      enqueueNotify({
        targetAccountId: row.invited_by as string, category: 'system', kind: 'invite',
        title: '邀请已被接受', body: '新成员已加入组织（演示通知）', bizRefType: 'membership', bizRefId: id,
      })
      pumpOutbox()
    }
    return reply.send({ data: { id, status: result.after, version: (row.version as number) + 1 } })
  })

  /* 新建组织（无组织用户引导创建申请 → 演示环境直接建为 active） */
  app.post('/organizations', async (req, reply) => {
    const ctx = requireAuth(req)
    const { name, type, region, intro } = (req.body ?? {}) as { name?: string; type?: string; region?: string; intro?: string }
    if (!name || !type || !region) throw err.validation('缺少 name/type/region')
    if (!['club', 'school', 'venue', 'association'].includes(type)) throw err.validation('type 不合法')
    const id = newId('o_')
    db.prepare('INSERT INTO organizations(id, name, type, region, intro, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)').run(
      id, name, type, region, intro ?? null, 'active', nowISO(), nowISO(),
    )
    // 创建者即为 org_admin
    db.prepare('INSERT INTO memberships(id, account_id, org_id, role, position, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)').run(
      newId('m_'), ctx.accountId, id, 'org_admin', '创建人', 'accepted', nowISO(), nowISO(),
    )
    bumpPermVersion()
    audit(ctx, { action: 'organization.create', resourceType: 'organization', resourceId: id, after: { name, type, region } })
    return reply.code(201).send({ data: { id, name } })
  })
}
