// 课程详情：展示与报名入口原型，不接入支付（PRD §5.6）
import { useNavigate, useParams } from 'react-router-dom'
import { courseById, projectById, userById } from '../../data/db'
import { useApp } from '../../store/store'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { EmptyState, InfoRow, MockFooter } from '../../components/ui'

export default function CourseDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const k = courseById(id || '')
  const pushToast = useApp((s) => s.pushToast)

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
          <button
            className="btn btn-primary btn-block"
            onClick={() =>
              pushToast(
                isGrantOnly
                  ? '该课程仅对授权学员可见（演示状态）'
                  : '报名为演示原型：本阶段不接入支付与真实报名（PRD 范围排除项）',
              )
            }
          >
            {isGrantOnly ? '授权学员可见' : '报名课程（演示原型）'}
          </button>
          <div className="t-mini center mt8">课程状态与报名为展示原型，完整课程支付能力不在本次范围</div>
        </div>

        <MockFooter text="本页课程信息为演示模拟数据；不包含价格、支付、订单等商城相关内容" />
      </div>
    </>
  )
}
