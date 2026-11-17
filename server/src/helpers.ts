// 幂等与乐观锁辅助
import type { FastifyRequest } from 'fastify'
import { db } from './db'
import { err, nowISO, requestHash } from './util'

/** 幂等重放检查：命中返回原响应体（调用方直接回复），未命中返回 null */
export function idempotencyReplay(req: FastifyRequest, accountId: string): { body: string; status: number } | null {
  const key = req.headers['idempotency-key'] as string | undefined
  if (!key) return null
  const row = db
    .prepare('SELECT response_body, response_status, request_hash FROM idempotency_keys WHERE account_id = ? AND endpoint = ? AND key = ?')
    .get(accountId, req.url.split('?')[0], key) as { response_body: string; response_status: number; request_hash: string } | undefined
  if (!row) return null
  if (row.request_hash !== requestHash(req.body)) {
    throw err.conflict('IDEMPOTENCY_CONFLICT', '相同幂等键但请求体不同，请更换幂等键')
  }
  return { body: row.response_body, status: row.response_status }
}

/** 保存幂等响应（成功路径调用） */
export function idempotencySave(req: FastifyRequest, accountId: string, status: number, body: unknown): void {
  const key = req.headers['idempotency-key'] as string | undefined
  if (!key) return
  db.prepare(
    'INSERT OR IGNORE INTO idempotency_keys(account_id, endpoint, key, request_hash, response_status, response_body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(accountId, req.url.split('?')[0], key, requestHash(req.body), status, JSON.stringify(body), nowISO())
}

/** 版本冲突检测：row.version !== input.version 抛 409 */
export function assertVersion(row: { version: number }, inputVersion: number | undefined): void {
  if (typeof inputVersion === 'number' && inputVersion !== row.version) {
    throw err.conflict('VERSION_CONFLICT', '对象已被他人修改，请刷新后重试', { current_version: row.version })
  }
}
