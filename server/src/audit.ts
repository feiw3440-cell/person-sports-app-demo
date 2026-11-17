// 审计日志：只增不改；关键动作（审核/成绩更改/授权/导出）必须落审计
import type { AuthContext } from './auth'
import { db } from './db'
import { newId, nowISO } from './util'

export interface AuditInput {
  action: string
  resourceType: string
  resourceId?: string
  before?: unknown
  after?: unknown
  reason?: string
}

export function audit(ctx: AuthContext, input: AuditInput): void {
  db.prepare(
    `INSERT INTO audit_logs(id, actor_account_id, actor_identity_type, org_id, client, action, resource_type, resource_id, before_json, after_json, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId('al_'),
    ctx.accountId,
    ctx.identityId
      ? (db.prepare('SELECT identity_type FROM identities WHERE id = ?').get(ctx.identityId) as { identity_type: string } | undefined)?.identity_type ?? null
      : null,
    ctx.orgId ?? null,
    ctx.client,
    input.action,
    input.resourceType,
    input.resourceId ?? null,
    input.before === undefined ? null : JSON.stringify(input.before),
    input.after === undefined ? null : JSON.stringify(input.after),
    input.reason ?? null,
    nowISO(),
  )
}
