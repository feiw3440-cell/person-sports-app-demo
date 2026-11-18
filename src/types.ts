// 专体 PERSON SPORTS · 演示数据类型定义
// 注意：以下类型仅服务于本地模拟数据（isMock），不代表最终后端数据库设计。

export type RoleType =
  | 'regular'
  | 'student'
  | 'athlete'
  | 'coach'
  | 'mentor'
  | 'org'
  | 'admin'

export type VerifyStatus = 'verified' | 'unverified' | 'appealing' | 'pending'

export interface RoleRecord {
  id: string
  type: RoleType
  label: string
  status: 'active' | 'pending' | 'rejected'
  extra?: string
}

export interface User {
  id: string
  name: string
  color: string
  kind: 'self' | 'athlete' | 'mentor' | 'student' | 'account'
  roles: RoleType[]
  verify: VerifyStatus
  region: string
  title?: string
  bio?: string
  photo?: string // 原型图裁切头像
  followers?: number
  achievements?: { name: string; date: string; unverified?: boolean }[]
  career?: { year: string; text: string }[]
  mentorInfo?: {
    level: string // 认证/高级/体系导师（演示占位名称，规则待确认）
    since: string
    system: string
    philosophy: string
    studentCount: number
  }
  orgId?: string
  accountId?: string // 服务端账号 ID（档案归属；师徒关系/可见性判断用）
  visibility?: 'public' | 'private' // 档案可见性（B-⑤）：public 登录可见；private 仅授权关系/组织/平台
}

export interface SportsProject {
  id: string
  name: string
  colorA: string
  colorB: string
  category: string
  tags: string[]
  intro: string
  starter: string[]
  region: string
  metrics: Metrics
  trend: Trend
}

export interface ContentItem {
  id: string
  type: 'video' | 'article'
  title: string
  colorA: string
  colorB: string
  projectId: string
  authorId: string
  authorName?: string // 服务端返回的内容作者展示名（账号 ID 与人员档案 ID 不同命名空间时兜底）
  publishAt: string
  duration?: string
  summary: string
  photo?: string // 原型图裁切封面
  hot?: boolean // 发现页"热门"角标
  cats?: string[] // 内容分类（奥运项目/格斗对抗/田径类/水上运动）
  metrics: Metrics
}

export interface Course {
  id: string
  name: string
  mentorId: string
  projectId: string
  format: '线下' | '线上'
  audience: string
  outline: string[]
  status: string
  sessions: string
  region: string
  metrics: Metrics
  trend: Trend
}

export interface Competition {
  id: string
  name: string
  projectId: string
  date: string
  location: string
  organizer: string
  intro: string
  status: '报名中' | '即将截止' | '筹备中' | '进行中' | '已结束'
  quota: number
  enrolled: number
  region: string
}

/** 机构成员关系（来自 memberships，不等于机构实体） */
export interface OrgMemberRef {
  accountId: string
  profileId: string
  role: string
  status: string
  identityTypes: string[]
  orgId: string
}

export interface Organization {
  id: string
  name: string
  type: '俱乐部' | '体育学校' | '场馆' | '协会'
  colorA: string
  colorB: string
  projectIds: string[]
  memberIds: string[]
  /** 真实成员关系的角色/状态/身份映射；缺失数据时为空，不用 Mock 补齐 */
  memberDetails?: OrgMemberRef[]
  intro: string
  activities: string[]
  contact: { phone: string; address: string }
  region: string
}

// 师徒关系：记录双方关联（与"身份"完全分离）
export interface Mentorship {
  id: string
  mentorId: string
  menteeId: string
  mentorName?: string // 服务端返回的展示名（账号 ID 与人员档案 ID 不同命名空间时的兜底）
  menteeName?: string
  /** 由 account ID 映射得到的人员档案 ID，用于页面与 person_profiles 关联；无公开档案时为空 */
  mentorProfileId?: string
  menteeProfileId?: string
  role: 'student' | 'coach' // 徒弟学员 / 授权教练
  status?: string // 服务端关系状态（active 等）
  since: string
}

// 授权：师徒关系之上的权利范围记录（显式挂接所属师徒关系）
export interface Authorization {
  id: string
  mentorshipId: string
  mentorId: string
  granteeId: string
  mentorName?: string // 服务端 grantor_name（账号 ID 与人员档案 ID 不同命名空间时兜底）
  granteeName?: string
  scope: { project: string; content: string; region: string; term: string }
  allowSubGrant: boolean
  status: '生效中' | '已撤销' | '已到期'
  parentAuthorizationId?: string
}

export interface Metrics {
  prof: number // 专业表现分（演示）
  influence: number // 平台影响力分（演示）
  views: number
  likes: number
  favs: number
  comments: number
  follows: number
}

export type Trend = { week: number; month: number; total: number }

// 榜单实体（排名/得分/名次变化全部为演示数据）
export interface RankEntity {
  id: string
  type: 'athlete' | 'mentor' | 'project' | 'course' | 'event' | 'org' | 'city'
  /** 服务端榜单自带的展示名；无本地档案时用它代替静态 ID 映射 */
  name?: string
  prof: number
  profVerified: boolean
  influence: number
  views: number
  likes: number
  favs: number
  comments: number
  follows: number
  appeal?: boolean // 申诉处理中（演示状态）
  delta: Trend
}

export interface MsgItem {
  id: string
  cat: 'interact' | 'system' | 'biz' | 'mentor'
  kind: 'system' | 'follow' | 'like' | 'comment' | 'dm' | 'course' | 'event' | 'mentorship' | 'auth'
  title: string
  body: string
  time: string
  unread: boolean
  badge?: number // 行内红色数字（系统聚合行/未读数）
  avatar?: string // 人员头像（如关注消息）
  verified?: boolean
  target?: string // 跳转路由
}

// 本期焦点荣誉榜（TOP 页演示快照数据）
export interface PodiumItem {
  id: string
  rank: 1 | 2 | 3
  vals: { overall: number; pro: number; popularity: number }
}

export interface RankRow {
  entity: RankEntity
  score: number
  delta: number
  reason: string
  subLabel: string
  href?: string
}

export type RankMode = 'overall' | 'pro' | 'popularity'
export type RankCategory = 'athlete' | 'mentor' | 'project' | 'course' | 'event' | 'org' | 'city'
export type Period = 'week' | 'month' | 'total'
