// 模拟服务层：与组件分离，未来可整体替换为真实 API（PRD §8 数据边界要求）
import {
  CITY_INFO,
  CONTENTS,
  COURSES,
  EVENTS,
  MESSAGES,
  ORGS,
  PROJECTS,
  RANK_POOL,
  REGIONS,
  USERS,
} from '../data/db'
import type {
  RankCategory,
  RankMode,
  RankRow,
  Period,
  ContentItem,
  Course,
  Competition,
  Organization,
  SportsProject,
  User,
} from '../types'

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/* ============ 榜单 ============ */
// 综合榜：专业表现与平台影响力结合（示意权重 6:4，PRD §6.2 —— 具体权重未确认，仅为演示口径）
// 专业榜：经核验的成绩、资质、专业评价
// 人气榜：关注、有效观看、收藏、评论等真实互动（不仅按点赞排序）
export const MODE_WEIGHT_NOTE: Record<RankMode, string> = {
  overall: '综合榜 = 专业表现 × 60% + 平台影响力 × 40%（示意权重，仅演示口径，正式规则待确认）',
  pro: '专业榜依据经核验的成绩、资质与专业评价；未核验数据仅作演示排序并明确标注',
  popularity: '人气榜由关注、有效观看、收藏、评论等互动行为构成（模拟数据），非仅按点赞排序',
}

function popScore(e: { views: number; likes: number; favs: number; comments: number; follows: number }) {
  // 示意权重：关注×3 + 收藏×2 + 评论×2 + 有效观看×0.2（点赞不单独主导排序）
  return Math.round(e.follows * 3 + e.favs * 2 + e.comments * 2 + e.views * 0.2)
}

export interface RankFilters {
  project?: string
  region?: string
  period: Period
}

function scaleByPeriod<T extends { prof: number; influence: number }>(e: T, period: Period): T {
  // 周期模拟：不同周期给不同分数缩放，保证"筛选周期"有可见效果
  const f = period === 'week' ? 0.35 : period === 'month' ? 0.7 : 1
  if (f === 1) return e // 总榜不缩放，保留原始小数分（如 98.5 → 综合分 9850）
  return {
    ...e,
    prof: Math.round(e.prof * f * 10) / 10,
    influence: Math.round(e.influence * f * 10) / 10,
  }
}

function entityRegion(id: string, type: string): string {
  if (type === 'city') return CITY_INFO[id]?.name || ''
  const u = USERS.find((x) => x.id === id)
  if (u) return u.region
  const p = PROJECTS.find((x) => x.id === id)
  if (p) return p.region
  const k = COURSES.find((x) => x.id === id)
  if (k) return k.region
  const ev = EVENTS.find((x) => x.id === id)
  if (ev) return ev.region
  const o = ORGS.find((x) => x.id === id)
  if (o) return o.region
  return ''
}

function entityProjectId(id: string, type: string): string | undefined {
  if (type === 'project') return id
  const k = COURSES.find((x) => x.id === id)
  if (k) return k.projectId
  const ev = EVENTS.find((x) => x.id === id)
  if (ev) return ev.projectId
  const o = ORGS.find((x) => x.id === id)
  if (o) return o.projectIds[0]
  const u = USERS.find((x) => x.id === id)
  if (u) {
    // 演示：按人物主要项目粗略映射
    if (['a1', 'm1', 'nm1', 'nm4', 'nw1', 'nw2'].includes(id)) return 'p1'
    if (['a2', 'm2', 'nm5'].includes(id)) return 'p2'
    if (['a3', 'm3', 'nm3'].includes(id)) return 'p3'
    if (['a4', 'm4', 'nm2', 'nm6', 'nw3', 'nw4'].includes(id)) return 'p4'
    if (['a5', 'm5', 'nw5'].includes(id)) return 'p5'
    if (['a6', 'm6'].includes(id)) return 'p7'
    if (id === 'a7') return 'p8'
    if (id === 'a8') return 'p6'
  }
  return undefined
}

export function entityName(id: string, type: string): string {
  if (type === 'city') return CITY_INFO[id]?.name || id
  const u = USERS.find((x) => x.id === id)
  if (u) return u.name
  const p = PROJECTS.find((x) => x.id === id)
  if (p) return p.name
  const k = COURSES.find((x) => x.id === id)
  if (k) return k.name
  const ev = EVENTS.find((x) => x.id === id)
  if (ev) return ev.name
  const o = ORGS.find((x) => x.id === id)
  if (o) return o.name
  return id
}

export function entitySub(id: string, type: string): string {
  if (type === 'city') return CITY_INFO[id]?.note || ''
  const u = USERS.find((x) => x.id === id)
  if (u) return `${u.title || ''} · ${u.region}`
  const p = PROJECTS.find((x) => x.id === id)
  if (p) return `${p.category} · ${p.tags.slice(0, 2).join(' · ')}`
  const k = COURSES.find((x) => x.id === id)
  if (k) {
    const mentor = USERS.find((x) => x.id === k.mentorId)
    return `${mentor?.name || ''} · ${k.format} · ${k.region}`
  }
  const ev = EVENTS.find((x) => x.id === id)
  if (ev) return `${ev.date} · ${ev.location}`
  const o = ORGS.find((x) => x.id === id)
  if (o) return `${o.type} · ${o.region}`
  return ''
}

function entityHref(id: string, type: string): string | undefined {
  switch (type) {
    case 'athlete': return `/athlete/${id}`
    case 'mentor': return `/mentor/${id}`
    case 'project': return `/project/${id}`
    case 'course': return `/course/${id}`
    case 'event': return `/event/${id}`
    case 'org': return `/org/${id}`
    default: return undefined // 城市榜行无详情页（演示）
  }
}

const CAT_FIELD_LABEL: Record<RankCategory, string> = {
  athlete: '运动员',
  mentor: '导师',
  project: '体育项目',
  course: '课程',
  event: '赛事',
  org: '体育机构',
  city: '城市/地区',
}

// 各榜单支持的筛选维度（PRD §6.2：项目/地区/周期；年龄组本期不做——需求确认记录）
export const CATEGORY_FILTERS: Record<RankCategory, { project: boolean; region: boolean }> = {
  athlete: { project: true, region: true },
  mentor: { project: true, region: true },
  project: { project: false, region: false },
  course: { project: true, region: true },
  event: { project: true, region: true },
  org: { project: true, region: true },
  city: { project: false, region: false },
}

export function buildRanking(category: RankCategory, mode: RankMode, filters: RankFilters): { state: 'ok' | 'updating' | 'empty'; rows: RankRow[] } {
  // 演示用异常/空态（PRD §6.2 要求处理更新中、暂无数据等状态）
  if (category === 'event' && mode === 'pro') return { state: 'updating', rows: [] }
  if (category === 'city' && mode === 'popularity') return { state: 'empty', rows: [] }

  let pool = RANK_POOL.filter((e) => e.type === category).map((e) => scaleByPeriod(e, filters.period))

  if (category !== 'city') {
    if (filters.project && CATEGORY_FILTERS[category].project) {
      pool = pool.filter((e) => entityProjectId(e.id, e.type) === filters.project)
    }
    if (filters.region && CATEGORY_FILTERS[category].region) {
      pool = pool.filter((e) => entityRegion(e.id, e.type) === filters.region)
    }
  }

  const scored = pool.map((e) => {
    let score = 0
    let reason = ''
    if (mode === 'overall') {
      // 保留两位小数：首页综合分展示为得分 ×100（如 98.5 → 9850，与原型一致）
      score = Math.round((e.prof * 0.6 + e.influence * 0.4) * 100) / 100
      reason = `专业 ${e.prof} · 影响力 ${e.influence} · 示意权重 6:4`
    } else if (mode === 'pro') {
      score = e.prof
      reason = e.profVerified ? '专业分（含核验成绩/资质）' : '专业分（未核验数据）'
    } else {
      score = popScore(e)
      reason = `关注 ${e.follows} · 观看 ${e.views} · 收藏 ${e.favs} · 评论 ${e.comments}`
    }
    return { entity: e, score, delta: e.delta[filters.period], reason } as RankRow & { reason: string }
  })

  scored.sort((a, b) => b.score - a.score)
  const rows: RankRow[] = scored.map((r) => ({
    ...r,
    subLabel: entitySub(r.entity.id, r.entity.type),
    href: entityHref(r.entity.id, r.entity.type),
  }))
  return { state: 'ok', rows }
}

export { CAT_FIELD_LABEL, REGIONS }

/* ============ 搜索 ============ */
export interface SearchResults {
  projects: SportsProject[]
  contents: ContentItem[]
  athletes: User[]
  mentors: User[]
  courses: Course[]
  events: Competition[]
  orgs: Organization[]
}

export function searchAll(qRaw: string): SearchResults {
  const q = qRaw.trim().toLowerCase()
  const empty: SearchResults = { projects: [], contents: [], athletes: [], mentors: [], courses: [], events: [], orgs: [] }
  if (!q) return empty
  const hit = (s: string) => (s || '').toLowerCase().includes(q)
  return {
    projects: PROJECTS.filter((p) => hit(p.name) || p.tags.some(hit) || hit(p.intro)),
    contents: CONTENTS.filter((c) => hit(c.title) || hit(c.summary)),
    athletes: USERS.filter((u) => u.kind === 'athlete' && (hit(u.name) || hit(u.title || '') || hit(u.region))),
    mentors: USERS.filter((u) => u.kind === 'mentor' && (hit(u.name) || hit(u.title || '') || hit(u.region))),
    courses: COURSES.filter((k) => hit(k.name) || hit(k.audience)),
    events: EVENTS.filter((e) => hit(e.name) || hit(e.location) || hit(e.intro)),
    orgs: ORGS.filter((o) => hit(o.name) || hit(o.intro) || o.type.includes(q)),
  }
}

export const HOT_KEYWORDS = ['摔跤', '柔道', '田径', '训练营', '上海']

/* ============ 关注/内容流 ============ */
export function feedOfFollowed(followIds: string[]): ContentItem[] {
  return CONTENTS.filter((c) => followIds.includes(c.authorId))
}

export function contentsByProject(pid: string) {
  return CONTENTS.filter((c) => c.projectId === pid)
}
export function contentsByAuthor(uid: string) {
  return CONTENTS.filter((c) => c.authorId === uid)
}

export const ALL_MESSAGES = MESSAGES
