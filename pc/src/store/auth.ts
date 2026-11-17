// 认证与上下文状态：令牌、账号、当前身份/组织（persist；切换上下文时清空本 store 之外的数据缓存）
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { post, bindTokenProvider, type Obj } from '@/api/client'

interface AuthState {
  access: string
  refresh: string
  me: Obj | null
  identityId: string | null
  orgId: string | null
  setTokens: (t: { access: string; refresh: string } | null) => void
  setMe: (me: Obj) => void
  switchContext: (identityId: string | null, orgId: string | null) => Promise<void>
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      access: '',
      refresh: '',
      me: null,
      identityId: null,
      orgId: null,
      setTokens: (t) => {
        if (t) set({ access: t.access, refresh: t.refresh })
        else set({ access: '', refresh: '', me: null, identityId: null, orgId: null })
      },
      setMe: (me) => set({ me }),
      switchContext: async (identityId, orgId) => {
        const data = await post('/auth/context', { identity_id: identityId || undefined, org_id: orgId || undefined })
        // 切换即清空权限上下文相关缓存：这里仅保留令牌与 me（页面数据均按挂载拉取，无全局业务缓存）
        set({ access: data.access_token, me: data.me, identityId, orgId })
      },
      logout: async () => {
        const { access, me } = get()
        try {
          // 会话撤销（演示：无 sessionId 暴露给客户端，登出仅清端侧令牌；服务端会话由过期/撤销策略管理）
          void access
          void me
        } finally {
          set({ access: '', refresh: '', me: null, identityId: null, orgId: null })
        }
      },
    }),
    { name: 'pc-auth-v1' },
  ),
)

bindTokenProvider(
  () => {
    const s = useAuth.getState()
    return s.access ? { access: s.access, refresh: s.refresh } : null
  },
  (t) => useAuth.getState().setTokens(t),
  () => useAuth.getState().setTokens(null),
)

/** 权限摘要便捷读取 */
export function perm(key: string): string | undefined {
  const me = useAuth.getState().me
  return me?.perm_summary?.[key]
}

export function hasPerm(key: string): boolean {
  return !!perm(key)
}
