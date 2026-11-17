// 业务卡片组件：项目/内容/人物/课程/赛事/机构/榜单行
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CITY_INFO,
  courseById,
  eventById,
  orgById,
  projectById,
  userById,
  ROLE_LABEL,
} from '../data/db'
import { useApp } from '../store/store'
import type { Competition, ContentItem, Course, Organization, RankRow, RankCategory, SportsProject, User } from '../types'
import Icon from './Icon'
import { Avatar, VerifyBadge } from './ui'

export function authorName(id: string) {
  return userById(id)?.name || id
}
export function fmt(n: number) {
  if (!n) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/* ===== 项目 ===== */
export function ProjectTile({ p, onClick }: { p: SportsProject; onClick?: () => void }) {
  return (
    <button className="proj-tile" style={{ background: `linear-gradient(135deg, ${p.colorA}, ${p.colorB})` }} onClick={onClick}>
      <SportGlyph className="glyph" />
      <div className="name">{p.name}</div>
    </button>
  )
}

function SportGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="37" cy="13" r="6.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" fill="none">
        <path d="M34 23 30 39" />
        <path d="M33 27 16 35" />
        <path d="M33 26 49 17" />
        <path d="M30 39 18 53" />
        <path d="M30 39 44 49" />
      </g>
    </svg>
  )
}

export function ProjectBanner({ p, onClick }: { p: SportsProject; onClick?: () => void }) {
  return (
    <button className="proj-banner" style={{ background: `linear-gradient(120deg, ${p.colorA}, ${p.colorB})` }} onClick={onClick}>
      <SportGlyph className="glyph" />
      <div className="cover-title">
        <div className="name">{p.name}</div>
        <div className="desc">{p.tags.join(' · ')}</div>
        <div className="tags">
          <span>项目故事</span>
          <span>运动员</span>
          <span>赛事</span>
        </div>
      </div>
    </button>
  )
}

/* ===== 内容 ===== */
export function ContentCard({ c }: { c: ContentItem }) {
  const nav = useNavigate()
  return (
    <div className="content-card" onClick={() => nav(`/content/${c.id}`)}>
      <div className="content-thumb" style={{ background: `linear-gradient(135deg, ${c.colorA}, ${c.colorB})` }}>
        {c.type === 'video' ? (
          <>
            <div className="play">
              <Icon name="play" size={16} filled />
            </div>
            {c.duration && <span className="duration">{c.duration}</span>}
          </>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, opacity: 0.9 }}>图文</span>
        )}
      </div>
      <div className="cc-body">
        <div className="cc-title ellipsis2">{c.title}</div>
        <div className="cc-meta">
          <span className="ellipsis1" style={{ maxWidth: 90 }}>
            {authorName(c.authorId)}
          </span>
          <span className="flex gap6">
            <Icon name="play" size={11} /> {fmt(c.metrics.views)}
          </span>
          <span className="flex gap6">
            <Icon name="heart" size={11} /> {fmt(c.metrics.likes)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ContentRow({ c }: { c: ContentItem }) {
  const nav = useNavigate()
  return (
    <div className="row-item" onClick={() => nav(`/content/${c.id}`)}>
      <div className="content-row-thumb" style={{ background: `linear-gradient(135deg, ${c.colorA}, ${c.colorB})` }}>
        {c.type === 'video' ? (
          <div className="play" style={{ width: 28, height: 28 }}>
            <Icon name="play" size={13} filled />
          </div>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.9 }}>图文</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-title ellipsis2" style={{ fontSize: 13.5 }}>
          {c.title}
        </div>
        <div className="t-mini mt4 flex gap8">
          <span>{authorName(c.authorId)}</span>
          <span className="flex gap6">
            <Icon name="play" size={11} /> {fmt(c.metrics.views)}
          </span>
          <span className="flex gap6">
            <Icon name="heart" size={11} /> {fmt(c.metrics.likes)}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ===== 人物 ===== */
export function PersonRow({ u, right, onClick }: { u: User; right?: ReactNode; onClick?: () => void }) {
  return (
    <div className="row-item" onClick={onClick}>
      <Avatar name={u.name} color={u.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex gap6">
          <span className="t-title">{u.name}</span>
          <VerifyBadge verify={u.verify} />
        </div>
        <div className="t-mini mt4 ellipsis1">
          {u.title} · {u.region}
        </div>
      </div>
      {right}
    </div>
  )
}

export function FollowButton({ targetId }: { targetId: string }) {
  const follows = useApp((s) => s.follows)
  const toggleFollow = useApp((s) => s.toggleFollow)
  const pushToast = useApp((s) => s.pushToast)
  const on = !!follows[targetId]
  return (
    <button
      className={`btn btn-sm ${on ? 'btn-ghost-gray btn-followed' : 'btn-primary'}`}
      onClick={(e) => {
        e.stopPropagation()
        const next = toggleFollow(targetId)
        pushToast(next ? '已关注（演示状态）' : '已取消关注（演示状态）')
      }}
    >
      {on ? '已关注' : '关注'}
    </button>
  )
}

export function MentorCard({ u }: { u: User }) {
  const nav = useNavigate()
  return (
    <div className="row-item">
      <Avatar name={u.name} color={u.color} size="md" />
      <div style={{ flex: 1, minWidth: 0 }} onClick={() => nav(`/mentor/${u.id}`)}>
        <div className="flex gap6">
          <span className="t-title">{u.name}</span>
          <span className="badge badge-brand">认证导师</span>
        </div>
        <div className="t-mini mt4 ellipsis1">{u.mentorInfo?.system.split('（')[0] || u.title}</div>
        <div className="t-mini flex gap8" style={{ marginTop: 2, color: 'var(--blue)' }}>
          <span>教学</span>
          <span>课程</span>
          <span>人才培养</span>
        </div>
      </div>
      <FollowButton targetId={u.id} />
    </div>
  )
}

/* ===== 课程/赛事/机构行 ===== */
const statusBadge = (s: string) =>
  s === '报名开放' || s === '招募中' ? 'badge-verified' : s === '授权可见' ? 'badge-blue' : 'badge-pending'

export function CourseRow({ k }: { k: Course }) {
  const nav = useNavigate()
  const p = projectById(k.projectId)
  const mentor = userById(k.mentorId)
  return (
    <div className="row-item" onClick={() => nav(`/course/${k.id}`)}>
      <div
        className="content-row-thumb"
        style={{ background: `linear-gradient(135deg, ${p?.colorA || '#12345B'}, ${p?.colorB || '#2872B8'})` }}
      >
        <Icon name="book" size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-title ellipsis1" style={{ fontSize: 13.5 }}>
          {k.name}
        </div>
        <div className="t-mini mt4 ellipsis1">
          {mentor?.name} · {k.format} · {k.sessions}
        </div>
        <div className="mt4 flex gap6">
          <span className={`badge ${statusBadge(k.status)}`}>{k.status}</span>
        </div>
      </div>
      <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
    </div>
  )
}

const EVENT_ST: Record<string, string> = {
  报名中: 'badge-verified',
  即将截止: 'badge-unverified',
  筹备中: 'badge-pending',
  进行中: 'badge-blue',
  已结束: 'badge-pending',
}

export function EventRow({ e }: { e: Competition }) {
  const nav = useNavigate()
  return (
    <div className="row-item" onClick={() => nav(`/event/${e.id}`)}>
      <div className="msg-icon" style={{ background: 'linear-gradient(135deg,#12345B,#2872B8)' }}>
        <Icon name="medal" size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-title ellipsis1" style={{ fontSize: 13.5 }}>
          {e.name}
        </div>
        <div className="t-mini mt4 ellipsis1">
          {e.date} · {e.location}
        </div>
        <div className="mt4 flex gap6">
          <span className={`badge ${EVENT_ST[e.status]}`}>{e.status}</span>
          <span className="badge badge-mock">演示赛事</span>
        </div>
      </div>
      <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
    </div>
  )
}

export function OrgRow({ o }: { o: Organization }) {
  const nav = useNavigate()
  return (
    <div className="row-item" onClick={() => nav(`/org/${o.id}`)}>
      <div className="msg-icon" style={{ background: `linear-gradient(135deg, ${o.colorA}, ${o.colorB})` }}>
        <Icon name="building" size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex gap6">
          <span className="t-title" style={{ fontSize: 13.5 }}>
            {o.name}
          </span>
          <span className="badge badge-blue">{o.type}</span>
        </div>
        <div className="t-mini mt4 ellipsis1">{o.intro}</div>
      </div>
      <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
    </div>
  )
}

/* ===== 榜单行 ===== */
function rowName(id: string, category: RankCategory): string {
  if (category === 'city') return CITY_INFO[id]?.name || id
  const u = userById(id)
  if (u) return u.name
  const p = projectById(id)
  if (p) return p.name
  const k = courseById(id)
  if (k) return k.name
  const ev = eventById(id)
  if (ev) return ev.name
  const o = orgById(id)
  if (o) return o.name
  return id
}

export function categoryIcon(c: RankCategory): string {
  switch (c) {
    case 'athlete': return 'user'
    case 'mentor': return 'users'
    case 'project': return 'target'
    case 'course': return 'book'
    case 'event': return 'medal'
    case 'org': return 'building'
    case 'city': return 'location'
  }
}

export function RankRowView({ row, rank, category }: { row: RankRow; rank: number; category: RankCategory }) {
  const nav = useNavigate()
  const e = row.entity
  const isPerson = category === 'athlete' || category === 'mentor'
  const u = isPerson ? userById(e.id) : undefined
  const delta = row.delta
  const deltaEl =
    delta > 0 ? (
      <span className="rank-delta delta-up">↑{delta}</span>
    ) : delta < 0 ? (
      <span className="rank-delta delta-down">↓{-delta}</span>
    ) : (
      <span className="rank-delta delta-flat">—</span>
    )

  const inner = (
    <>
      <div className={`rank-no no${rank}`}>{String(rank).padStart(2, '0')}</div>
      {u ? (
        <Avatar name={u.name} color={u.color} size="md" />
      ) : (
        <div className="msg-icon" style={{ background: 'linear-gradient(135deg,#12345B,#2872B8)', width: 44, height: 44, borderRadius: 14 }}>
          <Icon name={categoryIcon(category)} size={20} />
        </div>
      )}
      <div className="rank-main">
        <div className="rank-name-row">
          <span className="rank-name ellipsis1">{rowName(e.id, category)}</span>
          {u && <VerifyBadge verify={u.verify} appeal={e.appeal} />}
          {category === 'mentor' && u?.mentorInfo && (
            <span className="badge badge-brand">{u.mentorInfo.level.split('（')[0]}</span>
          )}
          {category === 'athlete' && !e.profVerified && <span className="badge badge-unverified">未核验</span>}
        </div>
        <div className="t-mini ellipsis1" style={{ marginTop: 2 }}>
          {row.subLabel}
        </div>
        <div className="rank-reason ellipsis1">{row.reason}</div>
      </div>
      {deltaEl}
      {isPerson ? (
        <FollowButton targetId={e.id} />
      ) : row.href ? (
        <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
      ) : null}
    </>
  )

  if (!row.href) return <div className="rank-row">{inner}</div>
  return (
    <div className="rank-row" onClick={() => nav(row.href!)}>
      {inner}
    </div>
  )
}

/* 角色标签 */
export function RoleChips({ roles }: { roles: string[] }) {
  return (
    <div className="flex wrap gap6">
      {roles.map((r) => (
        <span key={r} className="tag">
          {ROLE_LABEL[r] || r}
        </span>
      ))}
    </div>
  )
}
