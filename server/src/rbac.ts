// RBAC + 数据范围：逐请求实时查库（不信任令牌中的角色声明）
import type { AuthContext } from './auth'
import { db } from './db'
import { err } from './util'

export type DataScope = 'self' | 'own_org' | 'granted_scope' | 'platform' | 'all'

export interface PermMatch {
  role: string
  resource: string
  action: string
  data_scope: DataScope
}

const SCOPE_BREADTH: Record<DataScope, number> = { self: 1, own_org: 2, granted_scope: 3, platform: 4, all: 5 }

/** 当前请求上下文生效的角色集（identity + org membership + 平台角色） */
export function rolesOf(ctx: AuthContext): string[] {
  const roles = new Set<string>()
  const acc = db.prepare('SELECT display_name FROM accounts WHERE id = ?').get(ctx.accountId) as { display_name: string } | undefined
  if (!acc) return []
  if (ctx.identityId) {
    const ident = db.prepare('SELECT identity_type, status FROM identities WHERE id = ? AND account_id = ?').get(ctx.identityId, ctx.accountId) as
      | { identity_type: string; status: string }
      | undefined
    if (ident && ident.status === 'active') roles.add(ident.identity_type)
  }
  if (ctx.orgId) {
    const m = db
      .prepare("SELECT role, status FROM memberships WHERE account_id = ? AND org_id = ? AND status = 'accepted'")
      .get(ctx.accountId, ctx.orgId) as { role: string } | undefined
    if (m) roles.add(m.role)
  }
  // 平台角色（不依赖组织上下文）
  const platformRoles = db
    .prepare("SELECT identity_type FROM identities WHERE account_id = ? AND status = 'active' AND identity_type IN ('platform_admin','platform_ops','reviewer','content_editor','event_organizer')")
    .all(ctx.accountId) as { identity_type: string }[]
  for (const r of platformRoles) roles.add(r.identity_type)
  // 基础登录角色始终叠加（登录即可读公开资源；细粒度由身份/成员关系角色扩展）
  roles.add('user')
  return [...roles]
}

/** 匹配 resource:action → 返回最宽数据范围；无匹配 = 默认拒绝 */
export function checkPerm(ctx: AuthContext, resource: string, action: string): PermMatch | null {
  const roles = rolesOf(ctx)
  const rows = db
    .prepare(`SELECT * FROM role_permissions WHERE resource = ? AND action = ? AND role IN (${roles.map(() => '?').join(',')})`)
    .all(resource, action, ...roles) as PermMatch[]
  if (rows.length === 0) return null
  return rows.reduce((best, r) => (SCOPE_BREADTH[r.data_scope] > SCOPE_BREADTH[best.data_scope] ? r : best))
}

/** requirePerm：无权限抛 403（不区分不存在/无权，防探测） */
export function requirePerm(ctx: AuthContext, resource: string, action: string): PermMatch {
  const m = checkPerm(ctx, resource, action)
  if (!m) throw err.forbidden()
  return m
}

/** /me 返回的权限摘要：客户端菜单依据（服务端仍逐请求校验） */
export function permSummary(ctx: AuthContext): Record<string, string> {
  const roles = rolesOf(ctx)
  const rows = db
    .prepare(`SELECT resource, action, data_scope, role FROM role_permissions WHERE role IN (${roles.map(() => '?').join(',')})`)
    .all(...roles) as PermMatch[]
  const out: Record<string, string> = {}
  for (const r of rows) {
    const key = `${r.resource}.${r.action}`
    if (!(key in out) || SCOPE_BREADTH[r.data_scope] > SCOPE_BREADTH[out[key] as DataScope]) out[key] = r.data_scope
  }
  return out
}

/** 账号全部身份与成员关系（/me 用） */
export function accountContext(accountId: string) {
  const identities = db
    .prepare('SELECT id, identity_type, label, status FROM identities WHERE account_id = ? AND status = ? ORDER BY created_at')
    .all(accountId, 'active')
  const memberships = db
    .prepare(
      `SELECT m.id, m.org_id, m.role, m.position, m.status, o.name AS org_name, o.type AS org_type, o.region
       FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.account_id = ? AND m.status IN ('pending','accepted')`,
    )
    .all(accountId)
  return { identities, memberships }
}

/** 资源归属辅助：是否本人 */
export function isSelf(ctx: AuthContext, accountId: string): boolean {
  return ctx.accountId === accountId
}

/** mentor 的授权可见范围（granted_scope）：可见学员与项目 */
export function mentorGrantedAccountIds(ctx: AuthContext): string[] {
  const rows = db
    .prepare("SELECT mentee_account_id AS id FROM mentorships WHERE mentor_account_id = ? AND status = 'active'")
    .all(ctx.accountId) as { id: string }[]
  return rows.map((r) => r.id)
}
