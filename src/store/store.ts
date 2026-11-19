// 全局状态：当前身份上下文、互动（关注/点赞/收藏）、消息已读、Toast
// 一体化改造：API 模式下互动与已读走共享 API（服务端权威，乐观更新 + 失败回滚）；
// Mock 模式保持本地演示行为（仅开发环境隔离使用）。切换身份只改变呈现上下文（PRD §7.1）。
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { api } from '../services/apiClient'
import { DATA_SOURCE, ROLES, ROLES_LIVE, SELF_ID } from '../data/db'
import type { RoleRecord, RoleType } from '../types'

interface Toast {
  id: number
  msg: string
}

/** P2-03：reaction 多态目标类型（与服务端 /interactions/reactions 一致） */
export type ReactionTarget = 'content' | 'project'
interface ReactionRow {
  target_type?: string
  target_id?: string
  content_id?: string // 兼容旧服务端字段
  kind: string
}

interface AppState {
  currentRoleId: string
  follows: Record<string, boolean>
  likes: Record<string, boolean>
  favs: Record<string, boolean>
  readMsgs: Record<string, boolean>
  mentorApplyStatus: '审核中' | '补充材料' | '已通过' | '已驳回'
  toasts: Toast[]

  switchRole: (roleId: string) => void
  toggleFollow: (id: string) => boolean
  toggleLike: (id: string, targetType?: ReactionTarget) => boolean
  toggleFav: (id: string, targetType?: ReactionTarget) => boolean
  markRead: (id: string) => void
  setApplyStatus: (st: AppState['mentorApplyStatus']) => void
  pushToast: (msg: string) => void
  removeToast: (id: number) => void
  /** E-2：登录水合时用服务端权威互动数据回填本地状态（修复刷新即丢的断裂链路） */
  hydrateInteractions: (my: { follows?: { target_type: string; target_id: string }[]; reactions?: ReactionRow[] }) => void
}

let toastSeq = 1

const isApi = () => DATA_SOURCE === 'api'

/** E-5：统一未读数口径（服务端 read_at 为权威 + 本地已读即时叠加）；全 APP 消息角标共用 */
export function unreadCount(messages: { unread?: boolean; id?: string }[]): number {
  const readMsgs = useApp.getState().readMsgs
  return messages.filter((m) => m.unread && m.id && !readMsgs[m.id]).length
}

/** 互动目标类型推断（id 前缀约定：pf_/acc_=人物档案，p_=项目，o_=机构，其余=内容） */
function targetTypeOf(id: string): 'profile' | 'project' | 'org' | 'content' {
  if (id.startsWith('pf_') || id.startsWith('acc_')) return 'profile'
  if (id.startsWith('p_')) return 'project'
  if (id.startsWith('o_')) return 'org'
  return 'content'
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      currentRoleId: 'r-regular',
      follows: {},
      likes: {},
      favs: {},
      readMsgs: {},
      mentorApplyStatus: '审核中',
      toasts: [],

      switchRole: (roleId) => {
        if (!ROLES_LIVE.some((r) => r.id === roleId)) return
        set({ currentRoleId: roleId })
      },

      toggleFollow: (id) => {
        const next = !get().follows[id]
        set({ follows: { ...get().follows, [id]: next } })
        if (isApi()) {
          const tt = targetTypeOf(id)
          api('POST', '/interactions/follow', { target_type: tt, target_id: id })
            .catch(() => {
              // 失败回滚（服务端权威；网络写失败不提示成功）
              set({ follows: { ...get().follows, [id]: !next } })
              get().pushToast('网络异常，关注未生效（已回滚）')
            })
        }
        return next
      },

      toggleLike: (id, targetType = 'content') => {
        const next = !get().likes[id]
        set({ likes: { ...get().likes, [id]: next } })
        if (isApi()) {
          api('POST', '/interactions/reactions', { target_type: targetType, target_id: id, kind: 'like' }).catch(() => {
            set({ likes: { ...get().likes, [id]: !next } })
            get().pushToast('网络异常，点赞未生效（已回滚）')
          })
        }
        return next
      },

      toggleFav: (id, targetType = 'content') => {
        const next = !get().favs[id]
        set({ favs: { ...get().favs, [id]: next } })
        if (isApi()) {
          api('POST', '/interactions/reactions', { target_type: targetType, target_id: id, kind: 'fav' }).catch(() => {
            set({ favs: { ...get().favs, [id]: !next } })
            get().pushToast('网络异常，收藏未生效（已回滚）')
          })
        }
        return next
      },

      setApplyStatus: (st) => set({ mentorApplyStatus: st }),
      hydrateInteractions: (my) => {
        if (!isApi()) return
        // 服务端权威互动回填：follows 键=target_id（profile/project/org），reactions 键=content_id
        const follows: Record<string, boolean> = {}
        for (const f of my.follows || []) {
          if (f.target_type === 'profile' || f.target_type === 'project' || f.target_type === 'org') follows[f.target_id] = true
        }
        const favs: Record<string, boolean> = {}
        const likes: Record<string, boolean> = {}
        for (const r of my.reactions || []) {
          // P2-03：多态目标键取 target_id（兼容旧 content_id 字段）；本项目 content=ct_/project=p_ 前缀不冲突
          const key = (r as ReactionRow).target_id ?? (r as ReactionRow).content_id
          if (!key) continue
          if (r.kind === 'fav') favs[key] = true
          if (r.kind === 'like') likes[key] = true
        }
        set({ follows, favs, likes })
      },
      markRead: (id) => {
        set({ readMsgs: { ...get().readMsgs, [id]: true } })
        if (isApi()) api('POST', `/notifications/${id}/read`).catch(() => get().pushToast('已读状态同步失败（稍后重试）'))
      },

      pushToast: (msg) => {
        const id = toastSeq++
        set({ toasts: [...get().toasts, { id, msg }] })
        setTimeout(() => get().removeToast(id), 2400)
      },
      removeToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    }),
    {
      name: 'zhuan-ti-app',
      partialize: (s) => {
        if (DATA_SOURCE === 'api') {
          // API 模式：互动与已读由服务端权威存储；本地仅保留身份呈现偏好与已读缓存
          return { currentRoleId: s.currentRoleId, readMsgs: s.readMsgs, mentorApplyStatus: s.mentorApplyStatus } as Partial<AppState>
        }
        return {
          currentRoleId: s.currentRoleId,
          follows: s.follows,
          likes: s.likes,
          favs: s.favs,
          readMsgs: s.readMsgs,
          mentorApplyStatus: s.mentorApplyStatus,
        } as Partial<AppState>
      },
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

/** 当前身份上下文（服务端身份/组织映射；客户端仅用于呈现） */
export function currentRole(): RoleRecord {
  const st = useApp.getState()
  return ROLES_LIVE.find((r) => r.id === st.currentRoleId) || ROLES_LIVE[0]
}

export function isFollowed(id: string) {
  return !!useApp.getState().follows[id]
}

export { SELF_ID, ROLES, ROLES_LIVE, DATA_SOURCE }
export type { RoleType }
