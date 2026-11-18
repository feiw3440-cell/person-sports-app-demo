// /v1/auth/* 与 /v1/me/*：登录、刷新、撤销、上下文切换、资料、设置
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import {
  createSession,
  findLiveSession,
  issueAccess,
  requireAuth,
  revokeSession,
  verifyPassword,
  type AuthContext,
} from '../auth'
import { bumpPermVersion, db, getPermVersion } from '../db'
import { accountContext, permSummary } from '../rbac'
import { audit } from '../audit'
import { err, newId, nowISO, sha256 } from '../util'

function mePayload(accountId: string, identityId?: string, orgId?: string, sessionId?: string) {
  const account = db
    .prepare('SELECT id, login_name, display_name, avatar_url, phone, locale, timezone, status, version, created_at, updated_at FROM accounts WHERE id = ?')
    .get(accountId) as Record<string, unknown> | undefined
  if (!account) throw err.notFound('账号不存在')
  const ctxData = accountContext(accountId)
  return {
    ...account,
    identities: ctxData.identities,
    memberships: ctxData.memberships,
    // 供客户端在退出登录时精确撤销当前会话，不影响该账号其他设备会话
    session_id: sessionId || null,
    perm_version: getPermVersion(),
    perm_summary: permSummary({ accountId, identityId, orgId, client: 'pc', sessionId: '-', permVersion: getPermVersion() }),
  }
}

export function mePayloadFor(ctx: AuthContext) {
  return mePayload(ctx.accountId, ctx.identityId, ctx.orgId, ctx.sessionId)
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /* 登录 */
  app.post('/auth/sessions', async (req, reply) => {
    const { login_name, password, client } = (req.body ?? {}) as { login_name?: string; password?: string; client?: 'app' | 'pc' }
    if (!login_name || !password) throw err.validation('缺少 login_name 或 password')
    const account = db.prepare('SELECT * FROM accounts WHERE login_name = ?').get(login_name) as
      | { id: string; password_hash: string; status: string; display_name: string }
      | undefined
    if (!account || !verifyPassword(password, account.password_hash)) throw err.unauthorized('登录名或密码错误')
    if (account.status !== 'active') throw err.forbidden('账号已停用')
    const cl = client === 'app' ? 'app' : 'pc'
    const { session, refreshToken } = createSession(account.id, cl)
    const access = issueAccess({ accountId: account.id, client: cl, sessionId: session.id })
    audit({ accountId: account.id, client: cl, sessionId: session.id, permVersion: getPermVersion() }, {
      action: 'auth.login', resourceType: 'account', resourceId: account.id,
    })
    return reply.code(200).send({
      data: {
        access_token: access,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 1800,
        me: mePayload(account.id, undefined, undefined, session.id),
      },
    })
  })

  /* 刷新（旧 refresh 作废，重用检测） */
  app.post('/auth/sessions/refresh', async (req, reply) => {
    const { refresh_token } = (req.body ?? {}) as { refresh_token?: string }
    if (!refresh_token) throw err.validation('缺少 refresh_token')
    const session = findLiveSession(refresh_token)
    if (!session) {
      // 重用检测：哈希存在但已撤销/过期 → 撤销该账号全部会话（安全策略）
      const any = db.prepare('SELECT account_id, revoked_at FROM refresh_sessions WHERE token_hash = ?').get(sha256(refresh_token)) as
        | { account_id: string; revoked_at: string | null }
        | undefined
      if (any) {
        db.prepare('UPDATE refresh_sessions SET revoked_at = ?, revoked_reason = ? WHERE account_id = ? AND revoked_at IS NULL').run(
          nowISO(), 'refresh token reuse detected', any.account_id,
        )
        throw err.unauthorized('刷新令牌已失效，请重新登录', 'SESSION_REVOKED')
      }
      throw err.unauthorized('刷新令牌无效', 'TOKEN_EXPIRED')
    }
    const refreshToken = crypto.randomUUID()
    db.prepare('UPDATE refresh_sessions SET token_hash = ?, expires_at = ? WHERE id = ?').run(
      sha256(refreshToken),
      new Date(Date.now() + Number(process.env.REFRESH_TOKEN_TTL_DAY || 7) * 86400000).toISOString(),
      session.id,
    )
    const access = issueAccess({ accountId: session.account_id, identityId: session.identity_id ?? undefined, orgId: session.org_id ?? undefined, client: session.client, sessionId: session.id })
    return reply.send({ data: { access_token: access, refresh_token: refreshToken, token_type: 'Bearer', expires_in: 1800 } })
  })

  /* 登出/撤销会话 */
  app.delete('/auth/sessions/:id', async (req, reply) => {
    const ctx = requireAuth(req)
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT account_id FROM refresh_sessions WHERE id = ?').get(id) as { account_id: string } | undefined
    if (!row || row.account_id !== ctx.accountId) throw err.forbidden()
    revokeSession(id, 'logout')
    audit(ctx, { action: 'auth.logout', resourceType: 'session', resourceId: id })
    return reply.send({ data: { ok: true } })
  })

  /* 切换身份/组织上下文：换发访问令牌；客户端须清空越权缓存 */
  app.post('/auth/context', async (req, reply) => {
    const ctx = requireAuth(req)
    const { identity_id, org_id } = (req.body ?? {}) as { identity_id?: string; org_id?: string }
    if (identity_id) {
      const ident = db.prepare('SELECT id FROM identities WHERE id = ? AND account_id = ? AND status = ?').get(identity_id, ctx.accountId, 'active')
      if (!ident) throw err.forbidden('身份不属于该账号')
    }
    if (org_id) {
      const m = db.prepare("SELECT id FROM memberships WHERE account_id = ? AND org_id = ? AND status = 'accepted'").get(ctx.accountId, org_id)
      if (!m) throw err.forbidden('不是该组织成员')
    }
    const access = issueAccess({ accountId: ctx.accountId, identityId: identity_id, orgId: org_id, client: ctx.client, sessionId: ctx.sessionId })
    db.prepare('UPDATE refresh_sessions SET identity_id = ?, org_id = ? WHERE id = ?').run(identity_id ?? null, org_id ?? null, ctx.sessionId)
    audit(ctx, { action: 'auth.context_switch', resourceType: 'account', resourceId: ctx.accountId, after: { identity_id, org_id } })
    return reply.send({
      data: { access_token: access, token_type: 'Bearer', expires_in: 1800, me: mePayload(ctx.accountId, identity_id, org_id, ctx.sessionId) },
    })
  })

  /* 本人资料与权限上下文 */
  app.get('/me', async (req, reply) => {
    const ctx = requireAuth(req)
    return reply.send({ data: mePayloadFor(ctx) })
  })

  app.patch('/me', async (req, reply) => {
    const ctx = requireAuth(req)
    const body = (req.body ?? {}) as { display_name?: string; avatar_url?: string; phone?: string; locale?: string; timezone?: string; version?: number }
    const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(ctx.accountId) as Record<string, unknown>
    if (typeof body.version === 'number' && body.version !== row.version) {
      throw err.conflict('VERSION_CONFLICT', '资料已被其他端修改，请刷新后重试', { current_version: row.version })
    }
    const fields: Record<string, string> = {}
    for (const k of ['display_name', 'avatar_url', 'phone', 'locale', 'timezone'] as const) {
      if (body[k] !== undefined) fields[k] = String(body[k])
    }
    if (Object.keys(fields).length === 0) throw err.validation('无可更新字段')
    const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE accounts SET ${sets}, updated_at = @updated_at, version = version + 1 WHERE id = @id`).run({
      ...fields, updated_at: nowISO(), id: ctx.accountId,
    })
    audit(ctx, { action: 'me.update', resourceType: 'account', resourceId: ctx.accountId, before: { display_name: row.display_name }, after: fields })
    return reply.send({ data: mePayloadFor(ctx) })
  })

  /* ===== 设置（五作用域） ===== */
  app.get('/me/settings', async (req, reply) => {
    const ctx = requireAuth(req)
    const rows = db.prepare('SELECT scope, org_id, device_id, prefs, version, updated_at FROM settings WHERE account_id = ?').all(ctx.accountId) as {
      scope: string; org_id: string | null; device_id: string | null; prefs: string; version: number; updated_at: string
    }[]
    return reply.send({
      data: rows.map((r) => ({ scope: r.scope, org_id: r.org_id ?? undefined, device_id: r.device_id ?? undefined, prefs: JSON.parse(r.prefs), version: r.version, updated_at: r.updated_at })),
    })
  })

  app.patch('/me/settings', async (req, reply) => {
    const ctx = requireAuth(req)
    const body = (req.body ?? {}) as {
      scope: 'account' | 'privacy' | 'notify' | 'org' | 'device'
      org_id?: string
      device_id?: string
      prefs: Record<string, unknown>
      version?: number
    }
    if (!body.scope || !body.prefs || typeof body.prefs !== 'object') throw err.validation('缺少 scope 或 prefs')
    if (body.scope === 'org' && !body.org_id) throw err.validation('组织级设置必须携带 org_id')
    if (body.scope === 'device' && !body.device_id) throw err.validation('设备级设置必须携带 device_id')
    if (body.scope === 'org' && body.org_id) {
      const m = db.prepare("SELECT id FROM memberships WHERE account_id = ? AND org_id = ? AND status = 'accepted'").get(ctx.accountId, body.org_id)
      if (!m) throw err.forbidden('不是该组织成员，不能写组织级设置')
    }
    const existing = db
      .prepare('SELECT * FROM settings WHERE account_id = ? AND scope = ? AND org_id IS ? AND device_id IS ?')
      .get(ctx.accountId, body.scope, body.org_id ?? null, body.device_id ?? null) as
      | { id: string; prefs: string; version: number }
      | undefined
    if (existing && typeof body.version === 'number' && body.version !== existing.version) {
      throw err.conflict('VERSION_CONFLICT', '设置已被其他端修改，请刷新后重试', { current_version: existing.version })
    }
    let newVersion: number
    if (existing) {
      const merged = { ...JSON.parse(existing.prefs), ...body.prefs }
      newVersion = existing.version + 1
      db.prepare('UPDATE settings SET prefs = ?, version = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(merged), newVersion, nowISO(), existing.id)
    } else {
      newVersion = 1
      db.prepare('INSERT INTO settings(id, account_id, scope, org_id, device_id, prefs, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        newId('set_'), ctx.accountId, body.scope, body.org_id ?? null, body.device_id ?? null, JSON.stringify(body.prefs), 1, nowISO(),
      )
    }
    audit(ctx, { action: 'settings.write', resourceType: 'settings', resourceId: body.scope, after: { scope: body.scope, keys: Object.keys(body.prefs), org_id: body.org_id, device_id: body.device_id } })
    // 账号/隐私/通知作用域变更 → 事件同步另一端
    if (['account', 'privacy', 'notify'].includes(body.scope)) {
      bumpPermVersion()
    }
    return reply.send({
      data: { scope: body.scope, org_id: body.org_id, device_id: body.device_id, version: newVersion, updated_at: nowISO() },
    })
  })
}
