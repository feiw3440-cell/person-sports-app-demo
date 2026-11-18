// 赛事详情：报名状态（A4 最小接入：报名写入共享权威库，可在 PC 工作台审核）
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { eventById, projectById } from '../../data/db'
import { useApp } from '../../store/store'
import { api } from '../../services/apiClient'
import DetailHeader from '../../components/DetailHeader'
import { EmptyState, InfoRow, MockFooter } from '../../components/ui'

interface MyReg {
  id: string
  competition_id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason: string | null
}

const REG_LABEL: Record<string, string> = {
  pending: '已提交 · 待审核',
  approved: '报名通过',
  rejected: '报名被驳回',
  cancelled: '已取消',
}

export default function CompetitionDetail() {
  const { id } = useParams()
  const e = eventById(id || '')
  const pushToast = useApp((s) => s.pushToast)
  const [myReg, setMyReg] = useState<MyReg | null>(null)
  const [busy, setBusy] = useState(false)

  // 我的报名状态（权威库；PC 审核后此处状态随刷新更新）
  useEffect(() => {
    if (!e?.id) return
    api<{ data: MyReg[] }>('GET', `/registrations?competition_id=${e.id}&page_size=100`)
      .then((res) => {
        const mine = (res.data || []).find((r) => r.competition_id === e.id)
        setMyReg(mine ?? null)
      })
      .catch(() => setMyReg(null))
  }, [e?.id])

  if (!e) return <EmptyState title="赛事不存在" />
  const project = projectById(e.projectId)
  const pct = Math.min(100, Math.round((e.enrolled / e.quota) * 100))
  const canJoin = e.status === '报名中' || e.status === '即将截止'
  const regPending = myReg?.status === 'pending'

  const doRegister = async () => {
    if (busy) return
    setBusy(true)
    try {
      // 幂等键防重复提交（PRD §17）；重复报名由服务端幂等/唯一约束防护
      await api('POST', '/registrations', { competition_id: e.id }, { idempotency: true })
      pushToast('报名已提交，等待主办方在 PC 工作台审核')
      const res = await api<{ data: MyReg[] }>('GET', `/registrations?competition_id=${e.id}&page_size=100`)
      const mine = (res.data || []).find((r) => r.competition_id === e.id)
      setMyReg(mine ?? null)
    } catch (err) {
      pushToast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

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
          {myReg ? (
            <div className="card">
              <div className="flex gap8 wrap">
                <span className={`badge ${myReg.status === 'approved' ? 'badge-brand' : myReg.status === 'rejected' ? 'badge-mock' : 'badge-blue'}`}>
                  {REG_LABEL[myReg.status] || myReg.status}
                </span>
                <span className="t-mini" style={{ alignSelf: 'center' }}>状态来自共享权威库（PC 端可审核）</span>
              </div>
              {myReg.reason && <div className="t-mini mt8">审核意见：{myReg.reason}</div>}
            </div>
          ) : (
            <button
              className={`btn btn-block ${canJoin && !regPending ? 'btn-primary' : 'btn-disabled'}`}
              disabled={!canJoin || regPending || busy}
              onClick={doRegister}
            >
              {regPending ? '报名审核中（可在 PC 工作台查看）' : canJoin ? (busy ? '提交中…' : '报名参赛') : `当前状态：${e.status}`}
            </button>
          )}
        </div>

        <MockFooter text="本页赛事信息（时间/地点/主办方/报名数据）均为演示模拟" />
      </div>
    </>
  )
}
