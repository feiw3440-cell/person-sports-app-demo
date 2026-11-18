// 运动员主页：身份与核验状态 / 公开成绩（模拟标注）/ 经历 / 作品（PRD §5.5）
import { useNavigate, useParams } from 'react-router-dom'
import { useViewHistory } from '../../services/viewHistory'
import { projectById, userById } from '../../data/db'
import { contentsByAuthor } from '../../services/api'
import { useApp } from '../../store/store'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { Avatar, EmptyState, MockFooter, VerifyBadge } from '../../components/ui'
import { ContentCard, FollowButton, fmt } from '../../components/cards'

export default function AthleteProfile() {
  const { id } = useParams()
  useViewHistory('profile', id)
  const nav = useNavigate()
  const u = userById(id || '')
  const follows = useApp((s) => s.follows)

  if (!u) return <EmptyState title="未找到该运动员" desc="演示数据中不存在该用户。" />
  if (u.kind === 'mentor') {
    // 防呆：导师走导师主页
    return <EmptyState title="这是导师" desc="请从导师主页查看该人物。" action={<button className="btn btn-primary btn-sm" onClick={() => nav(`/mentor/${u.id}`)}>去导师主页</button>} />
  }

  const project = projectById(projectOfUser(u.id))
  const works = contentsByAuthor(u.id)
  const isSelf = u.id === 'u0'
  const followOn = !!follows[u.id]

  return (
    <>
      <div className="detail-hero" style={{ background: `linear-gradient(130deg, ${u.color}, #12345B)` }}>
        <DetailHeader title="" transparent />
        <div className="flex mt12" style={{ gap: 14, position: 'relative', zIndex: 1 }}>
          <Avatar name={u.name} color="rgba(255,255,255,0.25)" size="xl" />
          <div style={{ flex: 1 }}>
            <div className="flex gap6">
              <span className="dh-title" style={{ fontSize: 22 }}>
                {u.name}
              </span>
              <VerifyBadge verify={u.verify} />
            </div>
            <div className="dh-sub">{u.title} · {u.region}</div>
            <div className="dh-sub">粉丝 {fmt(u.followers || 0)}（模拟）</div>
          </div>
        </div>
      </div>

      <div className="page detail-body">
        <div className="card detail-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex gap8">
            <span className="badge badge-brand">运动员身份</span>
            <VerifyBadge verify={u.verify} />
          </div>
          {!isSelf && <FollowButton targetId={u.id} />}
          {isSelf && <span className="badge badge-mock">演示账号本人</span>}
        </div>

        {u.bio && (
          <div className="card mt12">
            <div className="t-sub" style={{ lineHeight: 1.7 }}>{u.bio}</div>
          </div>
        )}

        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>专项与核验</div>
          <div className="kv mt8">
            <span className="k">
              <Icon name="target" size={13} />专项
            </span>
            <span className="v">{project?.name || '综合'}（演示）</span>
          </div>
          <div className="kv">
            <span className="k">
              <Icon name="shield" size={13} />核验
            </span>
            <span className="v">
              <VerifyBadge verify={u.verify} /> <span className="t-mini">核验来源：平台资质审核（演示语义，非真实认证）</span>
            </span>
          </div>
        </div>

        {/* 公开成绩：全部标注模拟 */}
        {u.achievements && u.achievements.length > 0 && (
          <div className="card mt12">
            <div className="sec-head" style={{ marginBottom: 8 }}>
              <div className="sec-title">公开成绩</div>
              <span className="badge badge-mock">以下成绩均为模拟数据</span>
            </div>
            {u.achievements.map((a, i) => (
              <div key={i} className="flex mt8" style={{ gap: 10, justifyContent: 'space-between' }}>
                <div className="flex gap8" style={{ minWidth: 0 }}>
                  <span className="badge badge-blue">{a.date}</span>
                  <span className="t-sub ellipsis1">{a.name}</span>
                </div>
                {a.unverified && <span className="badge badge-unverified">未核验</span>}
              </div>
            ))}
          </div>
        )}

        {/* 经历时间线 */}
        {u.career && u.career.length > 0 && (
          <div className="card mt12">
            <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>运动经历（演示）</div>
            <div className="mt12">
              {u.career.map((c, i) => (
                <div key={i} className="timeline-item">
                  <div className="tl-dot" />
                  <div>
                    <span className="badge badge-blue">{c.year}</span>
                    <div className="t-sub mt4">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 作品 */}
        <div className="section">
          <div className="sec-head">
            <div className="sec-title">作品 · {works.length}</div>
          </div>
          {works.length ? (
            <div className="grid2">
              {works.map((c) => (
                <ContentCard key={c.id} c={c} />
              ))}
            </div>
          ) : (
            <div className="t-mini center mt12">暂无发布作品（演示）</div>
          )}
        </div>

        <MockFooter text="本页核验状态、成绩与数据均为演示模拟，不冒充真实认证或真实比赛成绩" />
      </div>
    </>
  )
}

function projectOfUser(uid: string): string {
  const map: Record<string, string> = { u0: 'p1', a1: 'p1', a2: 'p2', a3: 'p3', a4: 'p4', a5: 'p5', a6: 'p7', a7: 'p8', a8: 'p6' }
  return map[uid] || ''
}
