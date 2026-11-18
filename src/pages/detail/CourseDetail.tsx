// 课程详情：报名入口（A4 最小接入：报名写入共享权威库，导师/机构在 PC 工作台审核）
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { courseById, projectById, userById } from '../../data/db'
import { useApp } from '../../store/store'
import { api } from '../../services/apiClient'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { EmptyState, InfoRow, MockFooter } from '../../components/ui'

interface MyEnroll {
  id: string
  course_id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed'
  reason: string | null
}

const EN_LABEL: Record<string, string> = {
  pending: '已提交 · 待审核',
  approved: '报名通过',
  rejected: '报名被驳回',
  cancelled: '已取消',
  completed: '已完成',
}

export default function CourseDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const k = courseById(id || '')
  const pushToast = useApp((s) => s.pushToast)
  const [myEn, setMyEn] = useState<MyEnroll | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!k?.id) return
    api<{ data: MyEnroll[] }>('GET', `/enrollments?course_id=${k.id}&page_size=100`)
      .then((res) => {
        const mine = (res.data || []).find((r) => r.course_id === k.id)
        setMyEn(mine ?? null)
      })
      .catch(() => setMyEn(null))
  }, [k?.id])

  const doEnroll = async () => {
    if (busy || !k) return
    setBusy(true)
    try {
      await api('POST', '/enrollments', { course_id: k.id }, { idempotency: true })
      pushToast('报名已提交，等待导师/机构在 PC 工作台审核')
      const res = await api<{ data: MyEnroll[] }>('GET', `/enrollments?course_id=${k.id}&page_size=100`)
      const mine = (res.data || []).find((r) => r.course_id === k.id)
      setMyEn(mine ?? null)
    } catch (err) {
      pushToast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!k) return <EmptyState title="课程不存在" />
  const mentor = userById(k.mentorId)
  const project = projectById(k.projectId)
  const isGrantOnly = k.status === '授权可见'

  return (
    <>
      <DetailHeader title="课程详情" sub={project?.name} />
      <div className="page page-nofoot">
        <div
          className="cover"
          style={{
            background: `linear-gradient(130deg, ${project?.colorA || '#12345B'}, ${project?.colorB || '#2872B8'})`,
            height: 140,
          }}
        >
          <div style={{ padding: 18, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{k.name}</div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>
              {k.format} · {k.sessions}
            </div>
          </div>
        </div>

        <div className="card mt12">
          <div className="flex gap8 wrap">
            <span className="badge badge-blue">{k.status}</span>
            {isGrantOnly && <span className="badge badge-brand">授权学员可见（演示）</span>}
            <span className="badge badge-mock">演示课程 · 不接入支付</span>
          </div>
          <div className="mt12">
            <InfoRow icon="target" label="所属项目" value={project?.name || '-'} />
            <InfoRow icon="users" label="授课导师" value={mentor?.name || '-'} />
            <InfoRow icon="user" label="适用对象" value={k.audience} />
            <InfoRow icon="location" label="上课形式" value={`${k.format} · ${k.region}`} />
            <InfoRow icon="calendar" label="课程安排" value={k.sessions} />
          </div>
        </div>

        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            教学内容大纲（演示）
          </div>
          <div className="mt12">
            {k.outline.map((o, i) => (
              <div key={i} className="flex mt8" style={{ gap: 10 }}>
                <span className="badge badge-blue">第 {i + 1} 单元</span>
                <span className="t-sub">{o}</span>
              </div>
            ))}
          </div>
        </div>

        {mentor && (
          <div className="row-item mt12" onClick={() => nav(`/mentor/${mentor.id}`)}>
            <div
              className="avatar avatar-md"
              style={{ background: `linear-gradient(135deg, ${mentor.color}, ${mentor.color}CC)` }}
            >
              {mentor.name.slice(0, 1)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex gap6">
                <span className="t-title">{mentor.name}</span>
                <span className="badge badge-brand">认证导师</span>
              </div>
              <div className="t-mini mt4">{mentor.title} · 查看教学体系与全部课程</div>
            </div>
            <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
          </div>
        )}

        <div className="mt16">
          {myEn ? (
            <div className="card">
              <div className="flex gap8 wrap">
                <span className={`badge ${myEn.status === 'approved' ? 'badge-brand' : myEn.status === 'rejected' ? 'badge-mock' : 'badge-blue'}`}>
                  {EN_LABEL[myEn.status] || myEn.status}
                </span>
                <span className="t-mini" style={{ alignSelf: 'center' }}>状态来自共享权威库（PC 端可审核）</span>
              </div>
              {myEn.reason && <div className="t-mini mt8">审核意见：{myEn.reason}</div>}
            </div>
          ) : (
            <button className="btn btn-primary btn-block" disabled={busy} onClick={doEnroll}>
              {busy ? '提交中…' : isGrantOnly ? '申请授权报名' : '报名课程'}
            </button>
          )}
          <div className="t-mini center mt8">报名写入共享权威库并进入审核流；完整课程支付能力不在本次范围</div>
        </div>

        <MockFooter text="本页课程信息为演示模拟数据；不包含价格、支付、订单等商城相关内容" />
      </div>
    </>
  )
}
