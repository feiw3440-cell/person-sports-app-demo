// 会话管理（设备侧存储：sessionStorage，仅本标签有效；退出/权限撤销即清理）
// PRD V2.0 D/E 表：本地会话属于设备设置范围，不同步到 PC
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { api, setTokens, clearTokens } from './apiClient'

type SessionAccount = {
  id: string
  display_name: string
  login_name: string
  session_id?: string | null
  org_id?: string | null
}

type OrgOption = { org_id: string; org_name: string; role: string }

type SessionTokens = { access: string; refresh: string; account: SessionAccount }

type SessionState = {
  access: string | null
  refresh: string | null
  account: SessionAccount | null
  sessionId: string | null
  orgId: string | null
  orgOptions: OrgOption[]
  pendingTokens: SessionTokens | null
  loggingIn: boolean
  loginError: string | null
  login: (login_name: string, password: string) => Promise<boolean>
  chooseOrg: (orgId: string) => Promise<boolean>
  switchContext: (identityId?: string, orgId?: string) => Promise<boolean>
  logout: () => Promise<void>
}

type MeWithContext = SessionAccount & {
  memberships?: { org_id: string; org_name?: string; role: string; status: string }[]
}

function acceptedOrgs(me: MeWithContext): OrgOption[] {
  // 仅机构管理员成员关系需要组织上下文；导师/学员/教练保持原有个人数据范围，
  // 否则 own_org/granted_scope 会替换其 self 范围，改变现有业务语义。
  return (me.memberships || [])
    .filter((m) => m.status === 'accepted' && m.role === 'org_admin')
    .map((m) => ({ org_id: m.org_id, org_name: m.org_name || '机构', role: m.role }))
}

function applySession(set: (partial: Partial<SessionState>) => void, t: SessionTokens, orgId: string | null): void {
  setTokens(t.access, t.refresh)
  set({
    access: t.access,
    refresh: t.refresh,
    account: { ...t.account, org_id: orgId },
    sessionId: t.account.session_id || null,
    orgId,
    orgOptions: [],
    pendingTokens: null,
    loggingIn: false,
  })
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      access: null,
      refresh: null,
      account: null,
      sessionId: null,
      orgId: null,
      orgOptions: [],
      pendingTokens: null,
      loggingIn: false,
      loginError: null,

      login: async (login_name, password) => {
        set({ loggingIn: true, loginError: null })
        try {
          const d = (
            await api<{ data: { access_token: string; refresh_token: string; me: MeWithContext } }>(
              'POST',
              '/auth/sessions',
              { login_name, password, client: 'app' },
            )
          ).data
          const account: SessionAccount = {
            id: d.me.id,
            display_name: d.me.display_name,
            login_name: d.me.login_name,
            session_id: d.me.session_id || null,
          }
          const tokens: SessionTokens = { access: d.access_token, refresh: d.refresh_token, account }
          // 先注入令牌：后续 /auth/context 必须携带刚签发的 access token
          setTokens(d.access_token, d.refresh_token)
          const orgs = acceptedOrgs(d.me)

          // 单个已接受机构：按业务规则自动建立服务端上下文；多个机构：必须显式选择，不随意指定
          if (orgs.length === 1) {
            const switched = await api<{ data: { access_token: string; me: MeWithContext } }>(
              'POST',
              '/auth/context',
              { org_id: orgs[0].org_id },
            )
            applySession(set, { ...tokens, access: switched.data.access_token }, orgs[0].org_id)
            return true
          }
          if (orgs.length > 1) {
            set({ orgOptions: orgs, pendingTokens: tokens, loggingIn: false })
            return true
          }
          applySession(set, tokens, null)
          return true
        } catch (e) {
          set({ loginError: e instanceof Error ? e.message : '登录失败', loggingIn: false })
          return false
        }
      },

      chooseOrg: async (orgId) => {
        const pending = get().pendingTokens
        if (!pending) return false
        try {
          setTokens(pending.access, pending.refresh)
          const switched = await api<{ data: { access_token: string; me: MeWithContext } }>(
            'POST',
            '/auth/context',
            { org_id: orgId },
          )
          applySession(set, { ...pending, access: switched.data.access_token }, orgId)
          return true
        } catch (e) {
          set({ loginError: e instanceof Error ? e.message : '机构上下文建立失败' })
          return false
        }
      },

      switchContext: async (identityId, orgId) => {
        try {
          const res = await api<{ data: { access_token: string; me: MeWithContext } }>(
            'POST',
            '/auth/context',
            { identity_id: identityId, org_id: orgId },
          )
          const s = get()
          const next: SessionTokens = {
            access: res.data.access_token,
            refresh: s.refresh || '',
            account: {
              id: res.data.me.id,
              display_name: res.data.me.display_name,
              login_name: res.data.me.login_name,
              session_id: res.data.me.session_id || null,
              org_id: orgId ?? s.orgId,
            },
          }
          applySession(set, next, orgId ?? s.orgId)
          return true
        } catch (e) {
          set({ loginError: e instanceof Error ? e.message : '身份切换失败' })
          return false
        }
      },

      logout: async () => {
        const s = get()
        let revoked = true
        if (s.access && s.sessionId) {
          try {
            await api('DELETE', `/auth/sessions/${s.sessionId}`)
          } catch {
            revoked = false
          }
        }
        clearTokens()
        set({
          access: null,
          refresh: null,
          account: null,
          sessionId: null,
          orgId: null,
          orgOptions: [],
          pendingTokens: null,
          loginError: revoked ? null : '服务端会话撤销失败，已清除本机登录状态',
        })
      },
    }),
    {
      name: 'zt-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        access: s.access,
        refresh: s.refresh,
        account: s.account,
        sessionId: s.sessionId,
        orgId: s.orgId,
      }) as SessionState,
    },
  ),
)
