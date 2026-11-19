// API 响应 → 现有 APP 数据形状映射（保持页面组件零改动；演示指标为确定性生成并标注演示）
// 仅类型导入，无运行时循环依赖
import type {
  SportsProject,
  ContentItem,
  Course,
  Competition,
  Organization,
  User,
  Mentorship,
  Authorization,
  MsgItem,
  Metrics,
  Trend,
} from '../types'

/* 演示调色板（按 id 稳定分配，保证渲染一致） */
const PALETTE: [string, string][] = [
  ['#FF6B5E', '#FF9850'],
  ['#19B9AC', '#0EA5E9'],
  ['#8B5CF6', '#6366F1'],
  ['#2B7FFF', '#19B9AC'],
  ['#FF9850', '#FFB547'],
  ['#22C55E', '#84CC16'],
  ['#6366F1', '#8B5CF6'],
  ['#EC4899', '#F43F5E'],
  ['#12345B', '#2872B8'],
]

function hash01(s: string): number {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return h / 9973
}

function colorsFor(id: string): [string, string] {
  return PALETTE[Math.floor(hash01(id + 'c') * PALETTE.length) % PALETTE.length]
}

/* 确定性演示互动指标（页面已统一标注「演示数据」） */
function demoMetrics(id: string, base = 1): Metrics {
  const h = hash01(id + 'm')
  const views = Math.round((2 + h * 40) * 10000 * base)
  return {
    prof: Math.round(70 + h * 26),
    influence: Math.round(66 + hash01(id + 'i') * 30),
    views,
    likes: Math.round(views * (0.06 + h * 0.05)),
    favs: Math.round(views * (0.02 + h * 0.02)),
    comments: Math.round(views * (0.004 + h * 0.006)),
    follows: Math.round(views * (0.03 + h * 0.04)),
  }
}

function demoTrend(id: string): Trend {
  const h = hash01(id + 't')
  return { week: Math.round((h - 0.4) * 6), month: Math.round((hash01(id + 'm') - 0.4) * 8), total: Math.round((hash01(id + 'T') - 0.3) * 10) }
}

type AnyRow = Record<string, any>

/* ===== 体育项目 ===== */
export function mapProjects(rows: AnyRow[]): SportsProject[] {
  return rows.map((r, i) => {
    const [colorA, colorB] = colorsFor(r.id)
    const tags: string[] = Array.isArray(r.categories) ? r.categories.map((c: AnyRow) => c.name || c) : []
    return {
      id: r.id,
      name: r.name,
      colorA,
      colorB,
      category: tags[0] || r.name_en || '体育项目',
      tags: tags.length ? tags : [r.name_en || '体育项目'],
      intro: r.intro || '（演示）项目介绍',
      starter: ['第一步：了解项目规则与安全', '第二步：基础技术入门', '第三步：参与训练与活动'],
      region: r.region || '全国',
      metrics: demoMetrics(r.id),
      trend: demoTrend(r.id),
      _i: i,
    } as unknown as SportsProject
  })
}

/* ===== 内容 ===== */
export function mapContents(rows: AnyRow[], projectColor: Map<string, [string, string]>): ContentItem[] {
  return rows.map((r) => {
    const pid: string = Array.isArray(r.projects) && r.projects.length ? r.projects[0].id : ''
    const [colorA, colorB] = projectColor.get(pid) || colorsFor(r.id + 'p')
    return {
      id: r.id,
      type: r.type === 'article' ? 'article' : 'video',
      title: r.title,
      colorA,
      colorB,
      projectId: pid,
      authorId: r.author_account_id,
      authorName: r.author_name || undefined,
      publishAt: (r.published_at || r.updated_at || '').slice(0, 10),
      duration: undefined,
      summary: r.summary || '',
      photo: r.cover_url || undefined,
      hot: hash01(r.id + 'hot') > 0.72,
      cats: Array.isArray(r.projects) ? r.projects.map((p: AnyRow) => p.name) : [],
      metrics: demoMetrics(r.id),
    } as unknown as ContentItem
  })
}

/* ===== 人物（运动员/教练/导师等档案 + 账号） ===== */
const KIND_COLOR: Record<string, [string, string]> = {
  athlete: ['#FF6B5E', '#FF9850'],
  mentor: ['#12345B', '#2872B8'],
  coach: ['#2B7FFF', '#0A5CF0'],
  student: ['#19B9AC', '#0EA5E9'],
}
const KIND_TITLE: Record<string, string> = {
  athlete: '运动员',
  mentor: '导师',
  coach: '教练',
  student: '学员',
}

export function mapPeople(
  rows: AnyRow[],
  identityTypesByAccount: Record<string, string[]>,
): { people: User[]; profileIdByAccount: Map<string, string> } {
  const profileIdByAccount = new Map<string, string>()
  const people = rows.map((r) => {
    const kind: string = r.kind || 'student'
    profileIdByAccount.set(r.account_id, r.id)
    const [colorA] = KIND_COLOR[kind] || KIND_COLOR.student
    const idTypes: string[] = identityTypesByAccount[r.account_id] || [kind]
    const mentorRaw = r.mentor_info ? (typeof r.mentor_info === 'string' ? JSON.parse(r.mentor_info) : r.mentor_info) : null
    return {
      id: r.id,
      name: r.display_name || r.login_name || '演示用户',
      color: colorA,
      kind: kind as User['kind'],
      roles: idTypes,
      verify: r.verify_status === 'verified' ? 'verified' : r.verify_status === 'appealing' ? 'appealing' : 'unverified',
      region: r.region || '',
      title: r.title || KIND_TITLE[kind] || kind,
      bio: r.bio || '',
      photo: r.avatar_url || undefined,
      followers: Math.round(hash01(r.id + 'f') * 50000),
      achievements: Array.isArray(r.achievements)
        ? r.achievements.map((a: AnyRow) => ({ name: a.name, date: a.date, unverified: !!a.unverified }))
        : [],
      career: Array.isArray(r.career) ? r.career.map((c: AnyRow) => ({ year: c.year, text: c.text })) : [],
      mentorInfo: mentorRaw
        ? {
            level: mentorRaw.level || '认证导师（占位名称·规则待确认）',
            since: mentorRaw.since || '（演示）',
            system: mentorRaw.system || '（演示）教学体系',
            philosophy: mentorRaw.philosophy || '（演示）',
            studentCount: mentorRaw.student_count || 0,
          }
        : undefined,
      accountId: r.account_id,
      visibility: r.visibility === 'private' ? 'private' : 'public',
    } as unknown as User
  })
  return { people, profileIdByAccount }
}

/* ===== 课程 ===== */
export function mapCourses(rows: AnyRow[], profileIdByAccount: Map<string, string>): Course[] {
  return rows.map((r, i) => {
    const mentorProfileId = profileIdByAccount.get(r.mentor_account_id) || r.mentor_account_id
    const [colorA, colorB] = colorsFor(r.id + 'k')
    return {
      id: r.id,
      name: r.name,
      mentorId: mentorProfileId,
      projectId: (Array.isArray(r.project_ids) && r.project_ids[0]) || '',
      format: r.format === 'online' ? '线上' : '线下',
      audience: r.audience || '（演示）适用对象',
      outline: Array.isArray(r.outline) ? r.outline : [],
      status: statusZh(r.status),
      sessions: r.sessions || '（演示）课时安排',
      region: r.region || '',
      // F-2/F-3：价格与评价聚合以服务端为准（未加载时保持 undefined，不伪造）
      priceCents: typeof r.price_cents === 'number' ? r.price_cents : null,
      priceNote: r.price_note ?? null,
      reviewCount: typeof r.review_count === 'number' ? r.review_count : 0,
      ratingAvg: typeof r.rating_avg === 'number' ? r.rating_avg : null,
      metrics: demoMetrics(r.id + 'k'),
      trend: demoTrend(r.id + 'k'),
      _i: i,
    } as unknown as Course
  })
}

/* ===== 赛事 ===== */
export function mapCompetitions(rows: AnyRow[]): Competition[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    projectId: (Array.isArray(r.project_ids) && r.project_ids[0]) || '',
    date: `${(r.date_start || '').slice(0, 10)} ~ ${(r.date_end || r.date_start || '').slice(0, 10)}`,
    location: r.location || '（演示）地点',
    organizer: r.organizer_name || '演示组委会',
    intro: r.intro || '',
    // 赛事语境：published（可报名）呈现为“报名中”，与 APP 原型状态词一致
    status: r.status === 'published' ? '报名中' : statusZh(r.status),
    quota: r.quota || 0,
    enrolled: r.enrolled ?? 0,
    region: r.region || '',
  })) as unknown as Competition[]
}

/* ===== 机构 ===== */
export function mapOrganizations(
  rows: AnyRow[],
  memberships: AnyRow[] = [],
  profileIdByAccount: Map<string, string> = new Map(),
): Organization[] {
  return rows.map((r) => {
    // organizations 是机构实体；memberships 才是账号与机构的关系。
    // 只使用真实成员关系，不把机构列表伪装成成员列表，也不补 Mock 人员。
    const memberDetails = memberships
      .filter((m) => m.org_id === r.id && ['pending', 'accepted'].includes(String(m.status || '')))
      .map((m) => ({
        accountId: String(m.account_id),
        profileId: profileIdByAccount.get(String(m.account_id)) || String(m.account_id),
        role: String(m.role || ''),
        status: String(m.status || ''),
        identityTypes: Array.isArray(m.identity_types) ? m.identity_types.map(String) : [],
        orgId: String(r.id),
      }))
    const memberIds = [...new Set(memberDetails.map((m) => m.profileId))]
    let contact = { phone: '（演示占位）', address: '（演示占位）' }
    try {
      if (r.contact) contact = typeof r.contact === 'string' ? JSON.parse(r.contact) : r.contact
    } catch {
      /* 演示占位 */
    }
    const [colorA, colorB] = colorsFor(r.id + 'o')
    return {
      id: r.id,
      name: r.name,
      type: orgTypeZh(r.type),
      colorA,
      colorB,
      projectIds: Array.isArray(r.project_ids) ? r.project_ids : [],
      memberIds,
      memberDetails,
      intro: r.intro || '（演示机构）',
      activities: [`（演示）${r.name}公开活动一`, `（演示）${r.name}公开活动二`],
      contact: { phone: contact.phone || '（演示占位）', address: contact.address || '（演示占位）' },
      region: r.region || '',
    } as unknown as Organization
  })
}

/* ===== 师徒 / 授权 ===== */
export function mapMentorships(rows: AnyRow[], profileIdByAccount: Map<string, string> = new Map()): Mentorship[] {
  return rows.map((r) => ({
    id: r.id,
    // account_id 保留给服务端授权语义；profile_id 用于页面与人员档案稳定关联（不靠姓名匹配）
    mentorId: r.mentor_account_id,
    menteeId: r.mentee_account_id,
    mentorProfileId: profileIdByAccount.get(String(r.mentor_account_id)),
    menteeProfileId: profileIdByAccount.get(String(r.mentee_account_id)),
    mentorName: r.mentor_name || undefined,
    menteeName: r.mentee_name || undefined,
    role: r.role === 'coach' ? 'coach' : 'student',
    status: r.status || undefined,
    since: (r.created_at || '').slice(0, 10),
  })) as unknown as Mentorship[]
}

export function mapAuthorizations(rows: AnyRow[]): Authorization[] {
  return rows.map((r) => ({
    id: r.id,
    mentorshipId: r.mentorship_id || '',
    mentorId: r.grantor_account_id || r.mentor_account_id,
    granteeId: r.grantee_account_id,
    mentorName: r.grantor_name || undefined,
    granteeName: r.grantee_name || undefined,
    scope: {
      project: r.project_name || r.scope_project || '（演示）',
      content: r.scope_content || '（演示）教学授权',
      region: r.scope_region || '（演示）地区',
      term: `${(r.valid_from || '').slice(0, 10)} ~ ${(r.valid_until || '').slice(0, 10)}`,
    },
    allowSubGrant: !!r.allow_sub_grant,
    status: authStatusZh(r.status),
    parentAuthorizationId: r.parent_authorization_id || undefined,
  })) as unknown as Authorization[]
}

function authStatusZh(s: string): string {
  return { active: '生效中', revoked: '已撤销', expired: '已到期', submitted: '审核中', under_review: '审核中', approved: '生效中', rejected: '已驳回' }[s] || s
}

export function statusZh(s: string): string {
  return (
    {
      published: '已发布',
      registration_open: '报名中',
      registration_closed: '报名截止',
      in_progress: '进行中',
      completed: '已结束',
      pending: '待确认',
      approved: '已通过',
      rejected: '已驳回',
      cancelled: '已取消',
      draft: '草稿',
      pending_review: '待审核',
      recruiting: '招募中',
      full: '已满员',
      ongoing: '进行中',
    }[s] || s
  )
}

/* ===== 通知 ===== */
export function mapNotifications(rows: AnyRow[]): MsgItem[] {
  return rows.map((r) => {
    const cat: MsgItem['cat'] = ['mentorship', 'authorization'].includes(r.category)
      ? 'mentor'
      : ['course', 'event', 'biz'].includes(r.category)
        ? 'biz'
        : ['interact'].includes(r.category)
          ? 'interact'
          : 'system'
    const kindMap: Record<string, MsgItem['kind']> = {
      mentorship: 'mentorship',
      authorization: 'auth',
      course: 'course',
      event: 'event',
      follow: 'follow',
      like: 'like',
      comment: 'comment',
      system: 'system',
    }
    return {
      id: r.id,
      cat,
      kind: kindMap[r.kind] || 'system',
      title: r.title,
      body: r.body,
      time: (r.created_at || '').slice(5, 16).replace('T', ' '),
      unread: !r.read_at,
      target: r.biz_ref_type ? targetFor(r.biz_ref_type, r.biz_ref_id) : undefined,
    } as unknown as MsgItem
  })
}

function targetFor(refType: string, refId: string): string | undefined {
  switch (refType) {
    case 'content': return `/content/${refId}`
    case 'course': return `/course/${refId}`
    case 'competition': return `/event/${refId}`
    case 'authorization': return `/authorization/${refId}`
    case 'mentorship': return '/mentorship'
    case 'membership': return '/identity' // 机构邀请：跳身份管理接受/拒绝
    case 'project': return `/project/${refId}`
    case 'profile': return `/athlete/${refId}`
    default: return undefined
  }
}

/* ===== 报名 ===== */
export function mapEnrollments(rows: AnyRow[]): { id: string; course_id: string; status: string; decided_at: string | null; reason: string | null }[] {
  return rows.map((r) => ({ id: r.id, course_id: r.course_id, status: r.status, decided_at: r.decided_at, reason: r.reason }))
}
export function mapRegistrations(rows: AnyRow[]): { id: string; competition_id: string; status: string; decided_at: string | null; reason: string | null }[] {
  return rows.map((r) => ({ id: r.id, competition_id: r.competition_id, status: r.status, decided_at: r.decided_at, reason: r.reason }))
}

/* ===== 组织 ===== */
export function orgTypeZh(t: string): string {
  return { club: '俱乐部', school: '体育学校', venue: '场馆', association: '协会', federation: '协会' }[t] || t
}
