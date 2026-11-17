// 体育项目详情：介绍 / 入门说明 / 相关内容·运动员·导师·课程·赛事·机构（PRD §5.3）
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CONTENTS, COURSES, EVENTS, ORGS, USERS, projectById } from '../../data/db'
import { useApp } from '../../store/store'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { Cover, EmptyState, InfoRow, MockFooter } from '../../components/ui'
import { ContentCard, CourseRow, EventRow, FollowButton, OrgRow, PersonRow } from '../../components/cards'

type Tab = 'content' | 'athlete' | 'mentor' | 'course' | 'event' | 'org'

export default function ProjectDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const p = projectById(id || '')
  const [tab, setTab] = useState<Tab>('content')
  const favs = useApp((s) => s.favs)
  const toggleFav = useApp((s) => s.toggleFav)
  const pushToast = useApp((s) => s.pushToast)

  if (!p) return <EmptyState title="项目不存在" desc="演示数据中未找到该项目。" />

  const contents = CONTENTS.filter((c) => c.projectId === p.id)
  const athletes = USERS.filter((u) => u.kind === 'athlete' && [p.id].includes(projectOfUser(u.id)))
  const mentors = USERS.filter((u) => u.kind === 'mentor' && projectOfUser(u.id) === p.id)
  const courses = COURSES.filter((k) => k.projectId === p.id)
  const events = EVENTS.filter((e) => e.projectId === p.id)
  const orgs = ORGS.filter((o) => o.projectIds.includes(p.id))
  const favOn = !!favs[p.id]

  return (
    <>
      <div className="detail-hero" style={{ background: `linear-gradient(130deg, ${p.colorA}, ${p.colorB})` }}>
        <DetailHeaderTransparent />
        <div className="glyph">
          <Icon name="target" size={110} style={{ opacity: 0.3 }} />
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="dh-title">{p.name}</div>
          <div className="dh-sub">{p.category} · {p.tags.join(' · ')}</div>
        </div>
      </div>

      <div className="page detail-body">
        <div className="card detail-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap8">
            <span className="tag">{p.category}</span>
            <span className="tag">热度 {p.metrics.views >= 10000 ? `${(p.metrics.views / 10000).toFixed(0)}w+` : p.metrics.views}（模拟）</span>
          </div>
          <div className="flex gap8">
            <button
              className={`btn btn-sm ${favOn ? 'btn-ghost-gray' : 'btn-ghost'}`}
              onClick={() => {
                const next = toggleFav(p.id)
                pushToast(next ? '已收藏项目（演示状态）' : '已取消收藏（演示状态）')
              }}
            >
              <Icon name="star" size={14} filled={favOn} />
              {favOn ? '已收藏' : '收藏'}
            </button>
            <FollowButton targetId={p.id} />
          </div>
        </div>

        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            项目简介
          </div>
          <div className="t-sub mt8" style={{ lineHeight: 1.7 }}>
            {p.intro}
          </div>
          <div className="divider" />
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            三步入门口径（演示说明）
          </div>
          <div style={{ marginTop: 8 }}>
            {p.starter.map((s, i) => (
              <div key={i} className="flex mt8" style={{ gap: 10 }}>
                <span className="badge badge-blue">{i + 1}</span>
                <span className="t-sub">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 内容分栏切换 */}
        <div className="section">
          <div className="tabs">
            {(
              [
                ['content', `内容 ${contents.length}`],
                ['athlete', `运动员 ${athletes.length}`],
                ['mentor', `导师 ${mentors.length}`],
                ['course', `课程 ${courses.length}`],
                ['event', `赛事 ${events.length}`],
                ['org', `机构 ${orgs.length}`],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button key={k} className={`tab-item ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="section" style={{ marginTop: 12 }}>
          {tab === 'content' &&
            (contents.length ? (
              <div className="grid2">
                {contents.map((c) => (
                  <ContentCard key={c.id} c={c} />
                ))}
              </div>
            ) : (
              <EmptyState title="暂无相关内容" desc="该项目下还没有内容（演示）。" />
            ))}
          {tab === 'athlete' &&
            (athletes.length ? (
              <div className="list">
                {athletes.map((u) => (
                  <PersonRow key={u.id} u={u} right={<FollowButton targetId={u.id} />} onClick={() => nav(`/athlete/${u.id}`)} />
                ))}
              </div>
            ) : (
              <EmptyState title="暂无相关运动员" />
            ))}
          {tab === 'mentor' &&
            (mentors.length ? (
              <div className="list">
                {mentors.map((u) => (
                  <PersonRow key={u.id} u={u} right={<FollowButton targetId={u.id} />} onClick={() => nav(`/mentor/${u.id}`)} />
                ))}
              </div>
            ) : (
              <EmptyState title="暂无相关导师" />
            ))}
          {tab === 'course' &&
            (courses.length ? (
              <div className="list">
                {courses.map((k) => (
                  <CourseRow key={k.id} k={k} />
                ))}
              </div>
            ) : (
              <EmptyState title="暂无相关课程" />
            ))}
          {tab === 'event' &&
            (events.length ? (
              <div className="list">
                {events.map((e) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </div>
            ) : (
              <EmptyState title="暂无相关赛事" />
            ))}
          {tab === 'org' &&
            (orgs.length ? (
              <div className="list">
                {orgs.map((o) => (
                  <OrgRow key={o.id} o={o} />
                ))}
              </div>
            ) : (
              <EmptyState title="暂无相关机构" />
            ))}
        </div>

        <div className="demo-strip">项目示例（摔跤/柔道/田径/游泳等）为演示数据；真实项目资质与成绩不得伪造。</div>
        <MockFooter />
      </div>
    </>
  )
}

function projectOfUser(uid: string): string {
  const map: Record<string, string> = { a1: 'p1', a2: 'p2', a3: 'p3', a4: 'p4', a5: 'p5', a6: 'p7', a7: 'p8', a8: 'p6', m1: 'p1', m2: 'p2', m3: 'p3', m4: 'p4', m5: 'p5', m6: 'p7' }
  return map[uid] || ''
}

/* 透明返回头（覆盖在 hero 上） */
function DetailHeaderTransparent() {
  return <DetailHeader title="" transparent />
}

/* 保留 InfoRow 引用避免未使用告警（页面后续扩展使用） */
void InfoRow
void Cover
