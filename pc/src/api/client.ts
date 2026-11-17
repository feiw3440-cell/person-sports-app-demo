// API 客户端：令牌注入 / 401 自动刷新（一次性）/ 幂等键 / 统一错误封装
export type Obj = Record<string, any>

const BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8787'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Obj,
  ) {
    super(message)
  }
}

type TokenGetter = () => { access: string; refresh: string } | null
type TokenSetter = (t: { access: string; refresh: string } | null) => void

let getToken: TokenGetter = () => null
let setTokens: TokenSetter = () => {}
let onSessionExpired: (() => void) | null = null

export function bindTokenProvider(get: TokenGetter, set: TokenSetter, expired: () => void): void {
  getToken = get
  setTokens = set
  onSessionExpired = expired
}

let refreshing: Promise<string | null> | null = null

async function doRefresh(refreshToken: string): Promise<string | null> {
  const res = await fetch(`${BASE}/v1/auth/sessions/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) return null
  const json = (await res.json()) as Obj
  setTokens({ access: json.data.access_token, refresh: json.data.refresh_token })
  return json.data.access_token as string
}

export async function api<T = Obj>(method: string, path: string, opts: { body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const tokens = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (tokens?.access) headers.Authorization = `Bearer ${tokens.access}`
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey

  const send = async (access?: string): Promise<Response> => {
    if (access) headers.Authorization = `Bearer ${access}`
    return fetch(`${BASE}/v1${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
  }

  let res = await send(tokens?.access)
  if (res.status === 401 && tokens?.refresh) {
    refreshing = refreshing || doRefresh(tokens.refresh)
    const access = await refreshing
    refreshing = null
    if (access) {
      res = await send(access)
    } else {
      setTokens(null)
      onSessionExpired?.()
      throw new ApiError(401, 'SESSION_REVOKED', '登录已失效，请重新登录')
    }
  }

  if (res.status === 204) return undefined as T
  const json = (await res.json().catch(() => ({}))) as Obj
  if (!res.ok) {
    const err = (json.error ?? {}) as Obj
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? '请求失败', err.details)
  }
  return (json.data !== undefined ? json.data : json) as T
}

export const get = <T = Obj>(path: string) => api<T>('GET', path)
export const post = <T = Obj>(path: string, body?: unknown, idempotencyKey?: string) => api<T>('POST', path, { body, idempotencyKey })
export const patch = <T = Obj>(path: string, body?: unknown) => api<T>('PATCH', path, { body })
export const del = <T = Obj>(path: string) => api<T>('DELETE', path)

export function newIdempotencyKey(): string {
  return `pc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** 409 VERSION_CONFLICT 的用户可读提示 */
export function conflictHint(e: unknown): string | null {
  if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') {
    const cur = (e.details as Obj | undefined)?.current_version
    return `对象已被他人修改（当前版本 v${cur ?? '?'}），请刷新后重试`
  }
  return null
}
