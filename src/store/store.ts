// 全局状态：当前身份、关注/点赞/收藏、消息已读、导师申请状态、Toast
// 关键约束：切换身份只改变 currentRoleId 指针，不清除/覆盖任何数据（PRD §7.1）
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ROLES, SELF_ID } from '../data/db'
import type { RoleRecord } from '../types'

interface Toast {
  id: number
  msg: string
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
  toggleLike: (id: string) => boolean
  toggleFav: (id: string) => boolean
  markRead: (id: string) => void
  setApplyStatus: (s: AppState['mentorApplyStatus']) => void
  pushToast: (msg: string) => void
  removeToast: (id: number) => void
}

let toastSeq = 1

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      currentRoleId: 'r-regular',
      // 预置的演示互动数据（模拟）
      follows: { m1: true, a1: true, p1: true },
      likes: { c1: true, c2: true },
      favs: { c4: true, k1: true },
      readMsgs: {},
      mentorApplyStatus: '审核中',
      toasts: [],

      switchRole: (roleId) => {
        if (!ROLES.some((r) => r.id === roleId)) return
        set({ currentRoleId: roleId })
      },
      toggleFollow: (id) => {
        const next = !get().follows[id]
        set({ follows: { ...get().follows, [id]: next } })
        return next
      },
      toggleLike: (id) => {
        const next = !get().likes[id]
        set({ likes: { ...get().likes, [id]: next } })
        return next
      },
      toggleFav: (id) => {
        const next = !get().favs[id]
        set({ favs: { ...get().favs, [id]: next } })
        return next
      },
      markRead: (id) => set({ readMsgs: { ...get().readMsgs, [id]: true } }),
      setApplyStatus: (s) => set({ mentorApplyStatus: s }),
      pushToast: (msg) => {
        const id = toastSeq++
        set({ toasts: [...get().toasts, { id, msg }] })
        setTimeout(() => get().removeToast(id), 2400)
      },
      removeToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    }),
    {
      name: 'zhuan-ti-demo-v2', // v2 原型还原：重置旧演示状态
      partialize: (s) => ({
        currentRoleId: s.currentRoleId,
        follows: s.follows,
        likes: s.likes,
        favs: s.favs,
        readMsgs: s.readMsgs,
        mentorApplyStatus: s.mentorApplyStatus,
      }),
    },
  ),
)

export function currentRole(): RoleRecord {
  const st = useApp.getState()
  return ROLES.find((r) => r.id === st.currentRoleId) || ROLES[0]
}

export function isFollowed(id: string) {
  return !!useApp.getState().follows[id]
}

export { SELF_ID }
