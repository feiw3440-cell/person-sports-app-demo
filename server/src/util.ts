// 通用工具：错误、ID、时间
import crypto from 'node:crypto'

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export const err = {
  badRequest: (msg: string, details?: unknown) => new HttpError(400, 'BAD_REQUEST', msg, details),
  unauthorized: (msg = '未登录或令牌无效', code = 'INVALID_CREDENTIALS') => new HttpError(401, code, msg),
  forbidden: (msg = '无权访问该资源') => new HttpError(403, 'FORBIDDEN', msg),
  notFound: (msg = '资源不存在') => new HttpError(404, 'NOT_FOUND', msg),
  conflict: (code: string, msg: string, details?: unknown) => new HttpError(409, code, msg, details),
  state: (msg: string) => new HttpError(422, 'STATE_ILLEGAL', msg),
  validation: (msg: string, details?: unknown) => new HttpError(422, 'VALIDATION_FAILED', msg, details),
}

/** 短随机 ID（演示库使用；真实部署可换 UUID/雪花） */
export function newId(prefix = ''): string {
  return prefix + crypto.randomBytes(9).toString('base64url')
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export function requestHash(body: unknown): string {
  return sha256(JSON.stringify(body ?? null))
}
