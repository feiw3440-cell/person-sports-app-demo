// 全量数据拉取：登录后一次拉取 APP 所需实体并水合（服务端为权威数据源）
import { api } from './apiClient'
import { loadRankings } from './rankings'
import { hydrateFromServer, DATA_SOURCE, type ServerPayload } from '../data/db'
import { hydrateRankings } from '../data/rankings'

export async function fetchAllAndHydrate(): Promise<void> {
  if (DATA_SOURCE === 'mock') return // Mock 模式：保持静态演示数据（开发隔离，不调 API）

  // 榜单与实体并行拉取；榜单失败只降级为空快照，不阻断 APP
  const rankingsPromise = loadRankings()
  const meRes = await api<{
    data: Record<string, unknown> & {
      identities: { identity_type: string }[]
      memberships?: Record<string, unknown>[]
    }
  }>('GET', '/me')
  const me = meRes.data
  const identityTypesByAccount: Record<string, string[]> = { [String(me.id)]: me.identities.map((i) => i.identity_type) }
  // memberships 是“账号 ↔ 机构”的成员关系（含 role/status/org_id），
  // 与 organizations（机构实体）是不同数据；/me 已按账号返回真实成员关系，不再重复拉取机构列表伪装。
  // accountContext() 当前未显式返回 account_id；/me 的成员关系恒属于当前账号，显式补齐以免映射时丢失。
  const myMemberships = (me.memberships || []).map((m) => ({ ...m, account_id: m.account_id || me.id }))

  // 并行拉取 APP 所需实体（page_size 上限 100，覆盖演示规模）
  const [projects, contents, courses, competitions, organizations, enrollments, registrations] = await Promise.all([
    api<{ data: Record<string, unknown>[] }>('GET', '/projects?page_size=100'),
    api<{ data: Record<string, unknown>[] }>('GET', '/contents?page_size=100&status=published'),
    api<{ data: Record<string, unknown>[] }>('GET', '/courses?page_size=100'),
    api<{ data: Record<string, unknown>[] }>('GET', '/competitions?page_size=100'),
    api<{ data: Record<string, unknown>[] }>('GET', '/organizations'),
    api<{ data: Record<string, unknown>[] }>('GET', '/enrollments?page_size=100'),
    api<{ data: Record<string, unknown>[] }>('GET', '/registrations?page_size=100'),
  ])
  const [people, mentorships, authorizations, notifications] = await Promise.all([
    api<{ data: Record<string, unknown>[] }>('GET', '/people?page_size=100'),
    api<{ data: Record<string, unknown>[] }>('GET', '/mentorships'),
    api<{ data: Record<string, unknown>[] }>('GET', '/authorizations'),
    api<{ data: Record<string, unknown>[] }>('GET', '/notifications?page_size=100'),
  ])

  // 我的互动关系（关注/点赞/收藏，权威在服务端）
  let myInteractions: { follows: { target_type: string; target_id: string }[]; reactions: { content_id: string; kind: string }[] } = {
    follows: [],
    reactions: [],
  }
  try {
    const mine = await api<{ data: typeof myInteractions }>('GET', '/interactions/my')
    myInteractions = mine.data
  } catch {
    /* 互动接口可选；失败时视为空（页面仍可用） */
  }

  hydrateFromServer({
    me,
    projects: projects.data,
    contents: contents.data,
    people: people.data,
    courses: courses.data,
    competitions: competitions.data,
    organizations: organizations.data,
    mentorships: mentorships.data,
    authorizations: authorizations.data,
    notifications: notifications.data,
    memberships: myMemberships,
    identityTypesByAccount,
  })

  // 榜单快照（服务端 ranking_snapshot 权威；失败时为空快照）
  hydrateRankings(await rankingsPromise)

  // 互动快照写入会话内内存（供组件乐观渲染；持久化在服务端）
  window.dispatchEvent(new CustomEvent('zt:interactions', { detail: myInteractions }))
  window.dispatchEvent(new CustomEvent('zt:enrollments', { detail: enrollments.data }))
  window.dispatchEvent(new CustomEvent('zt:registrations', { detail: registrations.data }))
}
