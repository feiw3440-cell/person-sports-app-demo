// 赛事详情：报名状态原型（PRD §5.6）
import { useParams } from 'react-router-dom'
import { eventById, projectById } from '../../data/db'
import { useApp } from '../../store/store'
import DetailHeader from '../../components/DetailHeader'
import { EmptyState, InfoRow, MockFooter } from '../../components/ui'

export default function CompetitionDetail() {
  const { id } = useParams()
  const e = eventById(id || '')
  const pushToast = useApp((s) => s.pushToast)

  if (!e) return <EmptyState title="赛事不存在" />
  const project = projectById(e.projectId)
  const pct = Math.min(100, Math.round((e.enrolled / e.quota) * 100))
  const canJoin = e.status === '报名中' || e.status === '即将截止'

  return (
    <>
      <DetailHeader title="赛事详情" sub={project?.name} />
      <div className="page page-nofoot">
        <div className="cover" style={{ background: 'linear-gradient(130deg, #12345B, #2872B8)', height: 140 }}>
          <div style={{ padding: 18, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.3 }}>{e.name}</div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>{project?.name} · {e.region}</div>
          </div>
        </div>

        <div className="card mt12">
          <div className="flex gap8 wrap mb12">
            <span className="badge badge-blue">{e.status}</span>
            <span className="badge badge-mock">演示赛事</span>
          </div>
          <InfoRow icon="calendar" label="比赛时间" value={e.date} />
          <InfoRow icon="location" label="比赛地点" value={e.location} />
          <InfoRow icon="users" label="主办方" value={`${e.organizer}（演示）`} />
          <InfoRow icon="target" label="所属项目" value={project?.name || '-'} />
        </div>

        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            赛事介绍
          </div>
          <div className="t-sub mt8" style={{ lineHeight: 1.7 }}>
            {e.intro}
          </div>
        </div>

        <div className="card mt12">
          <div className="sec-head" style={{ marginBottom: 8 }}>
            <div className="sec-title">报名情况（演示）</div>
            <div className="sec-sub">
              {e.enrolled}/{e.quota}
            </div>
          </div>
          <div className="progress">
            <div className="bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="t-mini mt8">报名状态为展示原型；真实报名、实名/监护人流程与付费报名不在本次范围。</div>
        </div>

        <div className="mt16">
          <button
            className={`btn btn-block ${canJoin ? 'btn-primary' : 'btn-disabled'}`}
            onClick={() => pushToast('赛事报名为演示原型：未接入真实报名与支付')}
          >
            {canJoin ? '报名参赛（演示原型）' : `当前状态：${e.status}`}
          </button>
        </div>

        <MockFooter text="本页赛事信息（时间/地点/主办方/报名数据）均为演示模拟" />
      </div>
    </>
  )
}
