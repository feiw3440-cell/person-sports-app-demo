// 导师主页：认证状态（审核来源语义）/ 教学体系 / 课程 / 学员徒弟示例（PRD §5.5 / §7.2）
import { useNavigate, useParams } from 'react-router-dom'
import { AUTHORIZATIONS, COURSES, MENTORSHIPS, projectById, userById } from '../../data/db'
import { useApp } from '../../store/store'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { Avatar, Cover, EmptyState, MockFooter, VerifyBadge } from '../../components/ui'
import { CourseRow, FollowButton, PersonRow, fmt } from '../../components/cards'
import { contentsByAuthor } from '../../services/api'

export default function MentorProfile() {
  const { id } = useParams()
  const nav = useNavigate()
  const u = userById(id || '')
  const follows = useApp((s) => s.follows)

  if (!u) return <EmptyState title="未找到该导师" />
  if (u.kind === 'athlete') {
    return (
      <EmptyState
        title="这是运动员"
        desc="请从运动员主页查看该人物（演示导航）。"
        action={
          <button className="btn btn-primary btn-sm" onClick={() => nav(`/athlete/${u.id}`)}>
            去运动员主页
          </button>
        }
      />
    )
  }

  const project = projectById(projectOfUser(u.id))
  const courses = COURSES.filter((k) => k.mentorId === u.id)
  const works = contentsByAuthor(u.id)
  const students = MENTORSHIPS.filter((ms) => ms.mentorId === u.id)
  void AUTHORIZATIONS
  const followOn = !!follows[u.id]

  return (
    <>
      <Cover colorA={u.color} colorB="#12345B" className="detail-hero" style={{ borderRadius: 0, margin: '-14px -16px 0' }}>
        <DetailHeader title="" transparent />
        <div className="flex mt12" style={{ gap: 14, position: 'relative', zIndex: 2 }}>
          <Avatar name={u.name} color="rgba(255,255,255,0.25)" size="xl" />
          <div style={{ flex: 1 }}>
            <div className="flex gap6">
              <span className="dh-title" style={{ fontSize: 22 }}>
                {u.name}
              </span>
              <VerifyBadge verify={u.verify} />
            </div>
            <div className="dh-sub">{u.title} · {project?.name} · {u.region}</div>
            <div className="dh-sub">粉丝 {fmt(u.followers || 0)}（模拟）</div>
          </div>
        </div>
      </Cover>

      <div className="page detail-body">
        <div className="card detail-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap8 wrap">
            <span className="badge badge-brand">{u.mentorInfo?.level.split('（')[0]}</span>
            <span className="badge badge-blue">平台审核通过（演示语义）</span>
            <VerifyBadge verify={u.verify} />
          </div>
          <div className="flex gap8">
            <button className="btn btn-sm btn-ghost-gray" onClick={() => nav('/states')}>
              联系（占位）
            </button>
            <FollowButton targetId={u.id} />
          </div>
        </div>

        {u.bio && (
          <div className="card mt12">
            <div className="t-sub" style={{ lineHeight: 1.7 }}>{u.bio}</div>
          </div>
        )}

        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>导师认证（演示占位）</div>
          <div className="kv mt8">
            <span className="k">
              <Icon name="shield" size={13} />等级
            </span>
            <span className="v">{u.mentorInfo?.level}</span>
          </div>
          <div className="kv">
            <span className="k">
              <Icon name="clock" size={13} />认证
            </span>
            <span className="v">{u.mentorInfo?.since} 起 · 审核来源：平台资质审核（演示）</span>
          </div>
          <div className="kv">
            <span className="k">
              <Icon name="users" size={13} />学员
            </span>
            <span className="v">{u.mentorInfo?.studentCount} 名（模拟）</span>
          </div>
          <div className="t-mini mt8">
            导师等级名称与准入标准为演示占位，正式规则待确认；模拟账号不冒充真实认证。
          </div>
        </div>

        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>教学理念与体系</div>
          <div className="t-sub mt8" style={{ lineHeight: 1.7 }}>
            「{u.mentorInfo?.philosophy}」
          </div>
          <div className="divider" />
          <div className="t-sub" style={{ lineHeight: 1.7 }}>
            {u.mentorInfo?.system}
          </div>
        </div>

        {/* 课程 */}
        <div className="section">
          <div className="sec-head">
            <div className="sec-title">课程 · {courses.length}</div>
          </div>
          {courses.length ? (
            <div className="list">
              {courses.map((k) => (
                <CourseRow key={k.id} k={k} />
              ))}
            </div>
          ) : (
            <div className="t-mini center">暂无课程（演示）</div>
          )}
        </div>

        {/* 学员/徒弟示例 */}
        <div className="section">
          <div className="sec-head">
            <div className="sec-title">学员 / 徒弟关系示例</div>
            <button className="sec-more" onClick={() => nav('/mentorship')}>
              授权链路 →
            </button>
          </div>
          {students.length ? (
            <div className="list">
              {students.map((ms) => {
                const st = userById(ms.menteeId)!
                const grant = AUTHORIZATIONS.find((a) => a.mentorshipId === ms.id)
                return (
                  <PersonRow
                    key={ms.id}
                    u={st}
                    right={
                      grant ? (
                        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); nav(`/authorization/${grant.id}`) }}>
                          {grant.status}
                        </button>
                      ) : (
                        <span className="badge badge-pending">无授权</span>
                      )
                    }
                  />
                )
              })}
            </div>
          ) : (
            <div className="t-mini center">暂无公开的学员关系（演示）</div>
          )}
          <div className="demo-strip" style={{ marginTop: 10 }}>
            师徒关系与授权是两类数据：关系记录双方关联，授权记录权利范围（项目/内容/地区/期限/再授权）。有师徒关系不一定有授权。
          </div>
        </div>

        {/* 作品 */}
        {works.length > 0 && (
          <div className="section">
            <div className="sec-head">
              <div className="sec-title">教学作品 · {works.length}</div>
            </div>
            <div className="list">
              {works.map((c) => (
                <button key={c.id} className="row-item" style={{ justifyContent: 'flex-start' }} onClick={() => nav(`/content/${c.id}`)}>
                  <Icon name="play" size={16} style={{ color: 'var(--blue-strong)' }} />
                  <span className="t-title ellipsis1" style={{ fontSize: 13, fontWeight: 600 }}>
                    {c.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <MockFooter text="本页导师认证状态、学员数量与课程状态均为演示模拟数据" />
      </div>
    </>
  )
}

function projectOfUser(uid: string): string {
  const map: Record<string, string> = { m1: 'p1', m2: 'p2', m3: 'p3', m4: 'p4', m5: 'p5', m6: 'p7' }
  return map[uid] || ''
}
