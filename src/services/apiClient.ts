// 共享 API 客户端：令牌注入、401 自动刷新、幂等键、统一错误
// 服务端为权威数据源；写入使用 Idempotency-Key 防重复提交（PRD V2.0 E 表）
const API_BASE: string = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8787'

const ACCESS_KEY = 'zt.session.access'
const REFRESH_KEY = 'zt.session.refresh'

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_KEY)
  } catch {
    return null
  }
}
export function getRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}
export function setTokens(access: string, refresh: string): void {
  try {
    sessionStorage.setItem(ACCESS_KEY, access)
    sessionStorage.setItem(REFRESH_KEY, refresh)
  } catch {
    /* 设备侧会话（隐私要求） */
  }
}
export function clearTokens(): void {
  try {
    sessionStorage.removeItem(ACCESS_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

let refreshing: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    const rt = getRefreshToken()
    if (!rt) return false
    try {
      const res = await fetch(`${API_BASE}/v1/auth/sessions/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      })
      if (!res.ok) return false
      const d = (await res.json()).data
      setTokens(d.access_token, d.refresh_token)
      return true
    } catch {
      return false
    } finally {
      setTimeout(() => (refreshing = null), 0)
    }
  })()
  return refreshing
}

function newIdempotencyKey(): string {
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function api<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  opts?: { idempotency?: boolean; client?: 'app' | 'pc' },
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  const tok = getAccessToken()
  if (tok) headers.Authorization = `Bearer ${tok}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts?.idempotency) headers['Idempotency-Key'] = newIdempotencyKey()

  const doFetch = () =>
    fetch(`${API_BASE}/v1${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

  let res = await doFetch()

  // 401：尝试刷新一次后重试（服务端令牌权威）
  if (res.status === 401 && getRefreshToken()) {
    if (await tryRefresh()) {
      headers.Authorization = `Bearer ${getAccessToken() || ''}`
      res = await doFetch()
    } else {
      clearTokens()
    }
  }

  if (!res.ok) {
    let code = 'HTTP_ERROR'
    let message = `HTTP ${res.status}`
    let details: unknown
    try {
      const d = (await res.json()).error
      code = d?.code || code
      message = d?.message || message
      details = d?.details
    } catch {
      /* 非 JSON 错误体 */
    }
    throw new ApiError(res.status, code, message, details)
  }
  return (await res.json()) as T
}

export { API_BASE }
