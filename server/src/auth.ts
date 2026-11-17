// 认证：scrypt 口令哈希 + 手写 HS256 JWT + 会话 + 请求上下文
// 说明：本地 Demo 自实现，零外部依赖；生产环境应替换为标准 OIDC/OAuth2 方案（契约不变）。
import crypto from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { db, getPermVersion } from './db'
import { err, nowISO, sha256 } from './util'

const JWT_SECRET = process.env.JWT_SECRET || 'local-demo-secret-change-me'
const ACCESS_TTL_SEC = Number(process.env.ACCESS_TOKEN_TTL_MIN || 30) * 60
const REFRESH_TTL_SEC = Number(process.env.REFRESH_TOKEN_TTL_DAY || 7) * 86400

/* ---------- 口令 ---------- */
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const calc = crypto.scryptSync(plain, salt, 64)
  const expect = Buffer.from(hash, 'hex')
  return calc.length === expect.length && crypto.timingSafeEqual(calc, expect)
}

/* ---------- JWT ---------- */
const b64u = (buf: Buffer | string) => Buffer.from(buf).toString('base64url')

export interface AccessPayload {
  sub: string // account_id
  identity_id?: string
  org_id?: string
  client: 'app' | 'pc'
  perm_version: number
  iat: number
  exp: number
  sid: string // refresh session id
}

function sign(data: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url')
}

export function signAccessToken(p: Omit<AccessPayload, 'iat' | 'exp'>): string {
  const iat = Math.floor(Date.now() / 1000)
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64u(JSON.stringify({ ...p, iat, exp: iat + ACCESS_TTL_SEC }))
  return `${header}.${body}.${sign(`${header}.${body}`)}`
}

export function verifyAccessToken(token: string): AccessPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, b, s] = parts
  if (sign(`${h}.${b}`) !== s) return null
  try {
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString()) as AccessPayload
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/* ---------- 会话 ---------- */
export interface SessionRow {
  id: string
  account_id: string
  client: 'app' | 'pc'
  org_id: string | null
  identity_id: string | null
  expires_at: string
  revoked_at: string | null
}

export function createSession(accountId: string, client: 'app' | 'pc', orgId?: string, identityId?: string): { session: SessionRow; refreshToken: string } {
  const id = crypto.randomBytes(12).toString('base64url')
  const refreshToken = crypto.randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + REFRESH_TTL_SEC * 1000).toISOString()
  db.prepare(
    `INSERT INTO refresh_sessions(id, account_id, client, token_hash, org_id, identity_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, accountId, client, sha256(refreshToken), orgId ?? null, identityId ?? null, expires, nowISO())
  const session = db.prepare('SELECT * FROM refresh_sessions WHERE id = ?').get(id) as SessionRow
  return { session, refreshToken }
}

export function findLiveSession(refreshToken: string): SessionRow | null {
  const row = db.prepare('SELECT * FROM refresh_sessions WHERE token_hash = ?').get(sha256(refreshToken)) as SessionRow | undefined
  if (!row) return null
  if (row.revoked_at) return null
  if (new Date(row.expires_at).getTime() < Date.now()) return null
  return row
}

export function revokeSession(id: string, reason: string): void {
  db.prepare('UPDATE refresh_sessions SET revoked_at = ?, revoked_reason = ? WHERE id = ?').run(nowISO(), reason, id)
}

export function revokeAllSessions(accountId: string, reason: string): void {
  db.prepare('UPDATE refresh_sessions SET revoked_at = ?, revoked_reason = ? WHERE account_id = ? AND revoked_at IS NULL').run(nowISO(), reason, accountId)
}

/* ---------- 请求上下文 ---------- */
export interface AuthContext {
  accountId: string
  identityId?: string
  orgId?: string
  client: 'app' | 'pc'
  sessionId: string
  permVersion: number
}

/** 逐请求鉴权：令牌有效 + 账号 active。角色声明不作为授权事实——权限在 rbac.ts 中实时查库。 */
export function requireAuth(req: FastifyRequest): AuthContext {
  const header = (req.headers.authorization || '') as string
  if (!header.startsWith('Bearer ')) throw err.unauthorized()
  const payload = verifyAccessToken(header.slice(7))
  if (!payload) throw err.unauthorized('令牌无效或已过期', 'TOKEN_EXPIRED')
  const account = db.prepare('SELECT status FROM accounts WHERE id = ?').get(payload.sub) as { status: string } | undefined
  if (!account || account.status !== 'active') throw err.unauthorized('账号不可用')
  const session = db.prepare('SELECT revoked_at FROM refresh_sessions WHERE id = ?').get(payload.sid) as { revoked_at: string | null } | undefined
  if (!session || session.revoked_at) throw err.unauthorized('会话已被撤销', 'SESSION_REVOKED')
  return {
    accountId: payload.sub,
    identityId: payload.identity_id,
    orgId: payload.org_id,
    client: payload.client,
    sessionId: payload.sid,
    permVersion: payload.perm_version,
  }
}

/** 发放访问令牌（登录/刷新/切换上下文共用） */
export function issueAccess(ctx: { accountId: string; identityId?: string; orgId?: string; client: 'app' | 'pc'; sessionId: string }): string {
  return signAccessToken({
    sub: ctx.accountId,
    identity_id: ctx.identityId,
    org_id: ctx.orgId,
    client: ctx.client,
    perm_version: getPermVersion(),
    sid: ctx.sessionId,
  })
}
