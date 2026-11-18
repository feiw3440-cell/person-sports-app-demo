// 机构主页：学校/俱乐部/场馆类型展示（PRD §5.6；场馆并入机构展示——需求确认记录）
import { useNavigate, useParams } from 'react-router-dom'
import { ORGS, projectById, userById } from '../../data/db'
import { EVENTS } from '../../data/db'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { EmptyState, InfoRow, MockFooter } from '../../components/ui'
import { PersonRow } from '../../components/cards'

export default function OrganizationPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const o = ORGS.find((x) => x.id === id)
  if (!o) return <EmptyState title="机构不存在" />
  const projects = o.projectIds.map((pid) => projectById(pid)).filter(Boolean)
  const members = o.memberIds.map((mid) => userById(mid)).filter(Boolean) as NonNullable<ReturnType<typeof userById>>[]
  const memberInfo = new Map((o.memberDetails || []).map((m) => [m.profileId, m]))
  const roleZh = (r: string) => ({ org_admin: '管理员', coach: '教练', athlete: '运动员', member: '成员' } as Record<string, string>)[r] || r || '成员'
  const statusZh = (s: string) => (s === 'accepted' ? '有效' : s === 'pending' ? '待接受' : s)
  const relatedEvents = EVENTS.filter((e) => o.projectIds.includes(e.projectId)).slice(0, 2)

  return (
    <>
      <div className="detail-hero" style={{ background: `linear-gradient(130deg, ${o.colorA}, ${o.colorB})` }}>
        <DetailHeader title="" transparent />
        <div style={{ marginTop: 10, position: 'relative', zIndex: 1 }}>
          <div className="dh-title">{o.name}</div>
          <div className="dh-sub">
            {o.type} · {o.region}
          </div>
        </div>
      </div>

      <div className="page detail-body">
        <div className="card">
          <div className="flex gap8 wrap">
            <span className="badge badge-blue">{o.type}</span>
            {projects.map((p) => (
              <span key={p!.id} className="tag">
                {p!.name}
              </span>
            ))}
          </div>
          <div className="t-sub mt12" style={{ lineHeight: 1.7 }}>
            {o.intro}
          </div>
        </div>

        <div className="section">
          <div className="sec-head">
            <div className="sec-title">教练 / 导师 · {members.length}</div>
          </div>
          <div className="list">
            {members.map((m) => {
              const info = memberInfo.get(m.id)
              return (
                <PersonRow
                  key={m.id}
                  u={m}
                  right={
                    info ? (
                      <span className="t-mini" style={{ color: 'var(--ink-3)', textAlign: 'right' }}>
                        {roleZh(info.role)} · {statusZh(info.status)}
                      </span>
                    ) : (
                      <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
                    )
                  }
                  onClick={() => nav(m.kind === 'mentor' ? `/mentor/${m.id}` : `/athlete/${m.id}`)}
                />
              )
            })}
          </div>
        </div>

        <div className="section">
          <div className="sec-head">
            <div className="sec-title">公开活动（演示）</div>
          </div>
          <div className="list">
            {o.activities.map((a, i) => (
              <div key={i} className="row-item">
                <div className="msg-icon" style={{ background: '#19B9AC' }}>
                  <Icon name="calendar" size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-title" style={{ fontSize: 13.5 }}>
                    {a}
                  </div>
                  <div className="t-mini mt4">面向公众的活动展示（演示占位）</div>
                </div>
              </div>
            ))}
            {relatedEvents.map((e) => (
              <div key={e.id} className="row-item" onClick={() => nav(`/event/${e.id}`)}>
                <div className="msg-icon" style={{ background: '#12345B' }}>
                  <Icon name="medal" size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-title" style={{ fontSize: 13.5 }}>
                    {e.name}
                  </div>
                  <div className="t-mini mt4">{e.date} · 点击查看赛事详情</div>
                </div>
                <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
              </div>
            ))}
          </div>
        </div>

        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            联系方式（占位）
          </div>
          <div className="mt8">
            <InfoRow icon="bell" label="电话" value={o.contact.phone} />
            <InfoRow icon="location" label="地址" value={o.contact.address} />
          </div>
          <div className="t-mini mt8">招生与联系信息为演示占位，不构成真实邀约。</div>
        </div>

        <MockFooter text="本页机构信息为演示模拟数据；机构资质审核口径待确认" />
      </div>
    </>
  )
}
