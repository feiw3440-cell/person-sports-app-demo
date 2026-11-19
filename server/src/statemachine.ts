// 服务端状态机：状态只能经合法动作迁移；动作记录操作者/时间/原因/前后状态（PRD §9）
import type { AuthContext } from './auth'
import { db } from './db'
import { err, nowISO } from './util'
import { audit } from './audit'

export interface StateFlow {
  resource: string
  action: string
  from: string[] // 允许迁出的前置状态；'*' 表示任意
  to: string
  /** 终态动作额外校验的权限（resource.action），由路由在调用前完成归属校验 */
  note?: string
}

/** 六类状态机（邀请/资质/课程/报名/课程报名/赛事/授权 + 赛事报名） */
export const FLOWS: Record<string, StateFlow> = {
  // 组织成员邀请：pending → accepted / declined / expired / revoked
  'membership.accept': { resource: 'membership', action: 'accept', from: ['pending'], to: 'accepted' },
  'membership.decline': { resource: 'membership', action: 'decline', from: ['pending'], to: 'declined' },
  'membership.revoke': { resource: 'membership', action: 'revoke', from: ['pending', 'accepted'], to: 'revoked' },
  'membership.expire': { resource: 'membership', action: 'expire', from: ['pending'], to: 'expired' },

  // 身份/资质审核：draft → submitted → under_review → approved / rejected → resubmitted
  'credential.submit': { resource: 'credential', action: 'submit', from: ['draft', 'rejected', 'resubmitted'], to: 'submitted' },
  'credential.start_review': { resource: 'credential', action: 'start_review', from: ['submitted'], to: 'under_review' },
  'credential.approve': { resource: 'credential', action: 'approve', from: ['submitted', 'under_review'], to: 'approved' },
  'credential.reject': { resource: 'credential', action: 'reject', from: ['submitted', 'under_review'], to: 'rejected' },
  'credential.resubmit': { resource: 'credential', action: 'resubmit', from: ['rejected'], to: 'resubmitted' },

  // 课程：draft → pending_review → published → paused / archived
  'course.submit_review': { resource: 'course', action: 'submit_review', from: ['draft', 'paused'], to: 'pending_review' },
  'course.publish': { resource: 'course', action: 'publish', from: ['pending_review'], to: 'published' },
  'course.pause': { resource: 'course', action: 'pause', from: ['published'], to: 'paused' },
  'course.archive': { resource: 'course', action: 'archive', from: ['draft', 'pending_review', 'published', 'paused'], to: 'archived' },

  // 课程报名：pending → approved / rejected / cancelled → completed
  'enrollment.approve': { resource: 'enrollment', action: 'approve', from: ['pending'], to: 'approved' },
  'enrollment.reject': { resource: 'enrollment', action: 'reject', from: ['pending'], to: 'rejected' },
  'enrollment.cancel': { resource: 'enrollment', action: 'cancel', from: ['pending'], to: 'cancelled' },
  'enrollment.complete': { resource: 'enrollment', action: 'complete', from: ['approved'], to: 'completed' },

  // 赛事：draft → pending_review → published → registration_closed → in_progress → completed / cancelled
  'competition.submit_review': { resource: 'competition', action: 'submit_review', from: ['draft'], to: 'pending_review' },
  'competition.publish': { resource: 'competition', action: 'publish', from: ['pending_review'], to: 'published' },
  'competition.close_registration': { resource: 'competition', action: 'close_registration', from: ['published'], to: 'registration_closed' },
  'competition.start': { resource: 'competition', action: 'start', from: ['registration_closed'], to: 'in_progress' },
  'competition.complete': { resource: 'competition', action: 'complete', from: ['in_progress'], to: 'completed' },
  'competition.cancel': { resource: 'competition', action: 'cancel', from: ['draft', 'pending_review', 'published', 'registration_closed', 'in_progress'], to: 'cancelled' },

  // 赛事报名：pending → approved / rejected / cancelled
  'registration.approve': { resource: 'registration', action: 'approve', from: ['pending'], to: 'approved' },
  'registration.reject': { resource: 'registration', action: 'reject', from: ['pending'], to: 'rejected' },
  'registration.cancel': { resource: 'registration', action: 'cancel', from: ['pending'], to: 'cancelled' },

  // 授权：draft → submitted → approved / rejected → active → expired / revoked
  'authorization.submit': { resource: 'authorization', action: 'submit', from: ['draft', 'rejected'], to: 'submitted' },
  'authorization.approve': { resource: 'authorization', action: 'approve', from: ['submitted'], to: 'active' },
  'authorization.reject': { resource: 'authorization', action: 'reject', from: ['submitted'], to: 'rejected' },
  'authorization.revoke': { resource: 'authorization', action: 'revoke', from: ['submitted', 'active'], to: 'revoked' },
  'authorization.expire': { resource: 'authorization', action: 'expire', from: ['active'], to: 'expired' },

  // 内容：draft → pending_review → published → offline
  'content.submit_review': { resource: 'content', action: 'submit_review', from: ['draft', 'offline'], to: 'pending_review' },
  'content.publish': { resource: 'content', action: 'publish', from: ['pending_review'], to: 'published' },
  'content.offline': { resource: 'content', action: 'offline', from: ['published'], to: 'offline' },

  // 订单（F-1，模拟支付）：created → paid → refund_requested → refunded；created → cancelled
  'order.mock_pay': { resource: 'order', action: 'mock_pay', from: ['created'], to: 'paid' },
  'order.request_refund': { resource: 'order', action: 'request_refund', from: ['paid'], to: 'refund_requested' },
  'order.refund': { resource: 'order', action: 'refund', from: ['refund_requested'], to: 'refunded' },
  'order.cancel': { resource: 'order', action: 'cancel', from: ['created'], to: 'cancelled' },
}

export interface ApplyResult {
  before: string
  after: string
}

/** 校验并应用状态迁移（调用方负责归属/权限校验与 UPDATE 语句） */
export function applyFlow(
  ctx: AuthContext,
  flowKey: string,
  row: { status: string; version: number },
  input: { action: string; reason?: string; version?: number },
): ApplyResult {
  const flow = FLOWS[flowKey]
  if (!flow) throw err.state(`未知状态动作 ${flowKey}`)
  if (input.action !== flow.action) throw err.state(`动作与状态机不符：期望 ${flow.action}`)
  if (flow.from[0] !== '*' && !flow.from.includes(row.status)) {
    throw err.state(`当前状态 ${row.status} 不允许执行 ${input.action}（合法前置：${flow.from.join('/')}）`)
  }
  if (typeof input.version === 'number' && input.version !== row.version) {
    throw err.conflict('VERSION_CONFLICT', '对象已被他人修改，请刷新后重试', { current_version: row.version })
  }
  audit(ctx, {
    action: `${flow.resource}.${input.action}`,
    resourceType: flow.resource,
    before: { status: row.status, version: row.version },
    after: { status: flow.to, version: row.version + 1 },
    reason: input.reason,
  })
  return { before: row.status, after: flow.to }
}

export const now = nowISO
