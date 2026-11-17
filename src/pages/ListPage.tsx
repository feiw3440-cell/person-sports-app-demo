// 聚合列表页：全部项目/赛事中心/课程/运动员/导师/机构/内容 + 我的关注/收藏/课程/赛事
import { useNavigate, useParams } from 'react-router-dom'
import { CONTENTS, COURSES, EVENTS, ORGS, PROJECTS, USERS, courseById, eventById, projectById, userById } from '../data/db'
import { useApp } from '../store/store'
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
  'my-follows': { title: '我的关注', sub: '本地状态 · 切换身份不丢失' },
  'my-favs': { title: '我的收藏', sub: '本地状态 · 切换身份不丢失' },
  'my-courses': { title: '我的课程（原型）', sub: '报名为演示原型' },
  'my-events': { title: '我的赛事报名（原型）', sub: '报名为演示原型' },
}

export default function ListPage() {
  const { type = '' } = useParams()
  const nav = useNavigate()
  const follows = useApp((s) => s.follows)
  const favs = useApp((s) => s.favs)
  const meta = TITLES[type]
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
    const favContents = favIds.map((id) => CONTENTS.find((c) => c.id === id)).filter(Boolean)
    const favCourses = favIds.map((id) => courseById(id)).filter(Boolean)
    body =
      favContents.length + favCourses.length === 0 ? (
        <EmptyState title="还没有收藏" desc="在内容详情页点击「收藏」后会出现在这里。" icon="star" />
      ) : (
        <div className="list">
          {favContents.map((c) => (
            <ContentRow key={c!.id} c={c!} />
          ))}
          {favCourses.map((k) => (
            <CourseRow key={k!.id} k={k!} />
          ))}
        </div>
      )
  } else if (type === 'my-courses') {
    const myCourses = ['k1'].map((id) => courseById(id)!).filter(Boolean)
    body = (
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
  } else if (type === 'my-events') {
    const myEvents = ['e1', 'e2'].map((id) => eventById(id)!).filter(Boolean)
    body = (
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
