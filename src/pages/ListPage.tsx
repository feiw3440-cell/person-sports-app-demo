// 聚合列表页：全部项目/赛事中心/课程/运动员/导师/机构/内容 + 我的关注/收藏/课程/赛事
// E-2：API 模式下我的关注/收藏由水合回填（服务端权威）；我的课程/赛事报名直接拉本人记录
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CONTENTS, COURSES, DATA_SOURCE, EVENTS, ORGS, PROJECTS, USERS, courseById, eventById, projectById, userById } from '../data/db'
import { useApp } from '../store/store'
import { api } from '../services/apiClient'
import DetailHeader from '../components/DetailHeader'
import { EmptyState, MockFooter } from '../components/ui'
import { ContentRow, CourseRow, EventRow, FollowButton, OrgRow, PersonRow, ProjectBanner, ProjectTile } from '../components/cards'

const TITLES: Record<string, { title: string; sub: string }> = {
  projects: { title: '全部体育项目', sub: '按分类浏览（演示数据）' },
  events: { title: '赛事中心', sub: '近期赛事（报名为演示原型）' },
  courses: { title: '课程', sub: '仅展示与报名原型 · 不接入支付' },
  athletes: { title: '运动员', sub: '演示人物 · 核验状态为模拟' },
  mentors: { title: '教练 / 导师', sub: '均需平台审核（状态为模拟）' },
  orgs: { title: '体育学校 / 俱乐部 / 场馆', sub: '公开信息展示（演示）' },
  contents: { title: '视频 / 图文内容', sub: '演示内容库' },
  'my-follows': { title: '我的关注', sub: '服务端权威 · 双端同步（切换身份不丢失）' },
  'my-favs': { title: '我的收藏', sub: '服务端权威 · 双端同步（切换身份不丢失）' },
  'my-courses': { title: '我的课程', sub: '课程报名记录（服务端权威）' },
  'my-events': { title: '我的赛事报名', sub: '赛事报名记录（服务端权威）' },
  'my-history': { title: '浏览历史', sub: '最近浏览的内容 / 课程 / 赛事 / 人物（服务端权威，仅本人可见）' },
}

type MyEnrollRow = { id: string; course_id: string; status: string; course_name: string; class_name: string | null; created_at: string }
type MyRegRow = { id: string; competition_id: string; status: string; competition_name?: string; created_at: string }
type MyHistoryRow = { id: string; target_type: string; target_id: string; viewed_at: string }

export default function ListPage() {
  const { type = '' } = useParams()
  const nav = useNavigate()
  const follows = useApp((s) => s.follows)
  const favs = useApp((s) => s.favs)
  const meta = TITLES[type]
  const isApi = DATA_SOURCE === 'api'
  // E-2 扩展：我的课程/赛事报名（API 模式拉本人记录，self 数据范围由服务端保证）
  const [enrolls, setEnrolls] = useState<MyEnrollRow[] | null>(null)
  const [regs, setRegs] = useState<MyRegRow[] | null>(null)
  const [histories, setHistories] = useState<MyHistoryRow[] | null>(null)

  useEffect(() => {
    if (!isApi) return
    let removed = false
    if (type === 'my-courses') {
      api<{ data: MyEnrollRow[] }>('GET', '/enrollments?page_size=50')
        .then((d) => { if (!removed) setEnrolls(d.data) })
        .catch(() => { if (!removed) setEnrolls([]) })
    } else if (type === 'my-events') {
      api<{ data: MyRegRow[] }>('GET', '/registrations?page_size=50')
        .then((d) => { if (!removed) setRegs(d.data) })
        .catch(() => { if (!removed) setRegs([]) })
    } else if (type === 'my-history') {
      api<{ data: MyHistoryRow[] }>('GET', '/history/mine?page_size=50')
        .then((d) => { if (!removed) setHistories(d.data) })
        .catch(() => { if (!removed) setHistories([]) })
    }
    return () => { removed = true }
  }, [type, isApi])

  if (!meta) return <EmptyState title="页面不存在" />

  const followIds = Object.keys(follows).filter((k) => follows[k])
  const favIds = Object.keys(favs).filter((k) => favs[k])

  let body: React.ReactNode = null

  if (type === 'projects') {
    body = (
      <div className="grid2" style={{ gap: 10 }}>
        {PROJECTS.map((p) => (
          <div key={p.id} style={{ display: 'contents' }}>
            <ProjectTile p={p} onClick={() => nav(`/project/${p.id}`)} />
          </div>
        ))}
      </div>
    )
  } else if (type === 'events') {
    body = (
      <div className="list">
        {EVENTS.map((e) => (
          <EventRow key={e.id} e={e} />
        ))}
      </div>
    )
  } else if (type === 'courses') {
    body = (
      <div className="list">
        {COURSES.map((k) => (
          <CourseRow key={k.id} k={k} />
        ))}
      </div>
    )
  } else if (type === 'athletes') {
    body = (
      <div className="list">
        {USERS.filter((u) => u.kind === 'athlete').map((u) => (
          <PersonRow key={u.id} u={u} right={<FollowButton targetId={u.id} />} onClick={() => nav(`/athlete/${u.id}`)} />
        ))}
      </div>
    )
  } else if (type === 'mentors') {
    body = (
      <div className="list">
        {USERS.filter((u) => u.kind === 'mentor').map((u) => (
          <PersonRow
            key={u.id}
            u={u}
            right={<FollowButton targetId={u.id} />}
            onClick={() => nav(`/mentor/${u.id}`)}
          />
        ))}
      </div>
    )
  } else if (type === 'orgs') {
    body = (
      <div className="list">
        {ORGS.map((o) => (
          <OrgRow key={o.id} o={o} />
        ))}
      </div>
    )
  } else if (type === 'contents') {
    body = (
      <div className="list">
        {CONTENTS.map((c) => (
          <ContentRow key={c.id} c={c} />
        ))}
      </div>
    )
  } else if (type === 'my-follows') {
    const people = followIds.map((id) => userById(id)).filter(Boolean)
    const projects = followIds.map((id) => projectById(id)).filter(Boolean)
    body = (
      <>
        {people.length === 0 && projects.length === 0 ? (
          <EmptyState title="还没有关注任何对象" desc="去 TOP 榜单或导师主页点击「关注」试试。" icon="heart" />
        ) : (
          <>
            {people.length > 0 && (
              <div className="section">
                <div className="sec-head">
                  <div className="sec-title">人物 · {people.length}</div>
                </div>
                <div className="list">
                  {people.map((u) => (
                    <PersonRow key={u!.id} u={u!} right={<FollowButton targetId={u!.id} />} onClick={() => nav(u!.kind === 'mentor' ? `/mentor/${u!.id}` : `/athlete/${u!.id}`)} />
                  ))}
                </div>
              </div>
            )}
            {projects.length > 0 && (
              <div className="section">
                <div className="sec-head">
                  <div className="sec-title">关注的项目 · {projects.length}</div>
                </div>
                <div className="list">
                  {projects.map((p) => (
                    <ProjectBanner key={p!.id} p={p!} onClick={() => nav(`/project/${p!.id}`)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </>
    )
  } else if (type === 'my-favs') {
    // E-2：收藏键为服务端 content_id（reactions 表维度）；课程收藏需独立端点（F 阶段课程交易一并实现）
    const favContents = favIds.map((id) => CONTENTS.find((c) => c.id === id)).filter(Boolean)
    body =
      favContents.length === 0 ? (
        <EmptyState title="还没有收藏" desc="在内容详情页点击「收藏」后会出现在这里（服务端权威，双端同步）。" icon="star" />
      ) : (
        <div className="list">
          {favContents.map((c) => (
            <ContentRow key={c!.id} c={c!} />
          ))}
        </div>
      )
  } else if (type === 'my-courses') {
    body = !isApi ? (
      (() => {
        const myCourses = ['k1'].map((id) => courseById(id)!).filter(Boolean)
        return (
          <div className="list">
            {myCourses.map((k) => (
              <div key={k.id} className="card">
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <span className="t-title" style={{ fontSize: 14 }}>
                    {k.name}
                  </span>
                  <span className="badge badge-verified">已报名（演示）</span>
                </div>
                <div className="progress mt12">
                  <div className="bar" style={{ width: '40%' }} />
                </div>
                <div className="t-mini mt4">进度 40% · 第 3/6 课时（模拟） · 点击查看详情</div>
                <button className="btn btn-ghost btn-sm btn-block mt12" onClick={() => nav(`/course/${k.id}`)}>
                  课程详情
                </button>
              </div>
            ))}
            <div className="demo-strip">报名与学习进度为演示原型，未接入支付。</div>
          </div>
        )
      })()
    ) : enrolls === null ? (
      <EmptyState title="加载中" desc="正在读取本人课程报名记录。" icon="clock" />
    ) : enrolls.length === 0 ? (
      <EmptyState title="暂无课程报名" desc="在课程详情页提交报名申请，审核通过后显示在这里。" icon="book" />
    ) : (
      <div className="list">
        {enrolls.map((e) => (
          <div key={e.id} className="card">
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <span className="t-title" style={{ fontSize: 14 }}>
                {e.course_name}
              </span>
              <span className={`badge ${e.status === 'approved' ? 'badge-verified' : e.status === 'rejected' ? 'badge-unverified' : 'badge-pending'}`}>
                {e.status === 'approved' ? '已通过' : e.status === 'rejected' ? '未通过' : '审核中'}
              </span>
            </div>
            <div className="t-mini mt4">
              {e.class_name ? `班级：${e.class_name} · ` : ''}报名时间 {e.created_at.slice(0, 10)}
            </div>
            <button className="btn btn-ghost btn-sm btn-block mt12" onClick={() => nav(`/course/${e.course_id}`)}>
              课程详情
            </button>
          </div>
        ))}
        <div className="t-mini mt8">学习进度为课程交易（阶段五 F）规划能力，当前展示报名与审核状态。</div>
      </div>
    )
  } else if (type === 'my-events') {
    body = !isApi ? (
      (() => {
        const myEvents = ['e1', 'e2'].map((id) => eventById(id)!).filter(Boolean)
        return (
          <div className="list">
            {myEvents.map((e) => (
              <div key={e.id} className="card">
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <span className="t-title" style={{ fontSize: 14 }}>
                    {e.name}
                  </span>
                  <span className="badge badge-pending">待确认（演示）</span>
                </div>
                <div className="t-mini mt4">
                  {e.date} · {e.location}
                </div>
                <button className="btn btn-ghost btn-sm btn-block mt12" onClick={() => nav(`/event/${e.id}`)}>
                  赛事详情
                </button>
              </div>
            ))}
            <div className="demo-strip">赛事报名为演示原型，未接入实名/监护人等流程。</div>
          </div>
        )
      })()
    ) : regs === null ? (
      <EmptyState title="加载中" desc="正在读取本人赛事报名记录。" icon="clock" />
    ) : regs.length === 0 ? (
      <EmptyState title="暂无赛事报名" desc="在赛事详情页提交报名，审核通过后显示在这里。" icon="medal" />
    ) : (
      <div className="list">
        {regs.map((r) => (
          <div key={r.id} className="card">
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <span className="t-title" style={{ fontSize: 14 }}>
                {r.competition_name || '赛事'}
              </span>
              <span className={`badge ${r.status === 'approved' ? 'badge-verified' : r.status === 'rejected' ? 'badge-unverified' : 'badge-pending'}`}>
                {r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '未通过' : '审核中'}
              </span>
            </div>
            <div className="t-mini mt4">报名时间 {r.created_at.slice(0, 10)}</div>
            <button className="btn btn-ghost btn-sm btn-block mt12" onClick={() => nav(`/event/${r.competition_id}`)}>
              赛事详情
            </button>
          </div>
        ))}
      </div>
    )
  } else if (type === 'my-history') {
    // E-4：浏览历史（服务端去重，倒序）；实体名称与跳转由本地水合数据映射
    if (!isApi) {
      body = <EmptyState title="演示模式" desc="浏览历史为共享 API 能力（服务端权威，仅本人可见），Mock 数据源下不记录。" icon="clock" />
    } else if (histories === null) {
      body = <EmptyState title="加载中" desc="正在读取浏览历史。" icon="clock" />
    } else if (histories.length === 0) {
      body = <EmptyState title="暂无浏览记录" desc="浏览内容 / 课程 / 赛事 / 人物详情后会出现在这里（仅本人可见）。" icon="clock" />
    } else {
      const TYPE_LABEL: Record<string, string> = { content: '内容', course: '课程', competition: '赛事', profile: '人物', project: '项目', org: '机构' }
      const rows = histories.map((h) => {
        let name = h.target_id
        let href = ''
        if (h.target_type === 'content') { name = CONTENTS.find((c) => c.id === h.target_id)?.title || name; href = `/content/${h.target_id}` }
        else if (h.target_type === 'course') { name = COURSES.find((c) => c.id === h.target_id)?.name || name; href = `/course/${h.target_id}` }
        else if (h.target_type === 'competition') { name = eventById(h.target_id)?.name || name; href = `/event/${h.target_id}` }
        else if (h.target_type === 'profile') {
          const u = userById(h.target_id)
          name = u?.name || name
          href = u ? (u.kind === 'mentor' ? `/mentor/${u.id}` : `/athlete/${u.id}`) : ''
        } else if (h.target_type === 'project') { name = projectById(h.target_id)?.name || name; href = `/project/${h.target_id}` }
        else if (h.target_type === 'org') { name = ORGS.find((o) => o.id === h.target_id)?.name || name; href = `/org/${h.target_id}` }
        return { ...h, name, href }
      }).filter((r) => r.href)
      body =
        rows.length === 0 ? (
          <EmptyState title="暂无浏览记录" desc="浏览的实体当前不在可见范围内（如私有档案或未发布内容）。" icon="clock" />
        ) : (
          <div className="list">
            {rows.map((r) => (
              <div key={r.id} className="row-item" onClick={() => nav(r.href)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-title" style={{ fontSize: 13.5 }}>
                    {r.name}
                  </div>
                  <div className="t-mini mt4">{TYPE_LABEL[r.target_type]} · 浏览于 {r.viewed_at.slice(0, 16).replace('T', ' ')}</div>
                </div>
              </div>
            ))}
            <div className="t-mini mt8">同一实体重复浏览仅保留最近一次时间；历史仅本人可见，不记录搜索词等敏感维度。</div>
          </div>
        )
    }
  }

  return (
    <>
      <DetailHeader title={meta.title} sub={meta.sub} />
      <div className="page page-nofoot">
        {body}
        <MockFooter />
      </div>
    </>
  )
}
