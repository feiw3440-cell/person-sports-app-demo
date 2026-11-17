// Outbox 事件：业务事务同写事件表，写后即时泵投递为站内通知（通知失败不回滚业务事实）。
// 本地 Demo 采用同进程同步泵；线上阶段可替换为独立消费者，事件契约不变。
import { db } from './db'
import { newId, nowISO } from './util'

export interface NotifyInput {
  targetAccountId: string
  category: 'system' | 'interact' | 'biz' | 'mentorship'
  kind: string
  title: string
  body?: string
  bizRefType?: string
  bizRefId?: string
}

/** 业务内调用：写 outbox（与业务同事务由调用方包裹），随后 pump 投递 */
export function enqueueNotify(input: NotifyInput): void {
  db.prepare(
    `INSERT INTO outbox_events(id, event_type, payload, target_account_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(newId('ev_'), 'notification', JSON.stringify(input), input.targetAccountId, nowISO())
}

/** 即时泵：未投递事件 → notifications 行 */
export function pumpOutbox(): number {
  const pending = db.prepare('SELECT * FROM outbox_events WHERE dispatched_at IS NULL ORDER BY created_at').all() as {
    id: string
    event_type: string
    payload: string
    target_account_id: string | null
  }[]
  let count = 0
  const tx = db.transaction(() => {
    for (const ev of pending) {
      if (ev.event_type !== 'notification' || !ev.target_account_id) continue
      const p = JSON.parse(ev.payload) as NotifyInput
      db.prepare(
        `INSERT INTO notifications(id, account_id, category, kind, title, body, biz_ref_type, biz_ref_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(newId('n_'), ev.target_account_id, p.category, p.kind, p.title, p.body ?? null, p.bizRefType ?? null, p.bizRefId ?? null, nowISO())
      db.prepare('UPDATE outbox_events SET dispatched_at = ? WHERE id = ?').run(nowISO(), ev.id)
      count++
    }
  })
  tx()
  return count
}
