// 体育管理工作台（仅原型）：查看授权范围内的项目、人才、赛事及机构（PRD §2.2，不实现管理后台）
import { useNavigate } from 'react-router-dom'
import { EVENTS, ORGS, PROJECTS, USERS } from '../data/db'
import Icon from '../components/Icon'
import DetailHeader from '../components/DetailHeader'
import { MockFooter } from '../components/ui'
import { PersonRow } from '../components/cards'

export default function AdminWorkspace() {
  const nav = useNavigate()
  // 授权范围（演示）：摔跤/柔道项目 · 华东地区
  const projects = PROJECTS.filter((p) => ['p1', 'p2'].includes(p.id))
  const people = USERS.filter((u) => ['a1', 'a2', 'm1', 'm2'].includes(u.id))
  const events = EVENTS.filter((e) => ['e1', 'e2'].includes(e.id))
  const orgs = ORGS.filter((o) => ['o1', 'o2'].includes(o.id))

  return (
    <>
      <DetailHeader title="管理工作台（原型）" sub="体育管理角色 · 授权范围内只读展示" />
      <div className="page page-nofoot">
        <div className="demo-strip">
          本页为体育管理角色的页面原型：<b>不实现管理后台</b>。授权范围（演示）：摔跤 / 柔道 · 华东地区。管理规则与权限口径待确认。
        </div>

        <div className="card mt12">
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div>
              <div className="sg-num">{projects.length}</div>
              <div className="sg-label">项目</div>
            </div>
            <div>
              <div className="sg-num">{people.length}</div>
              <div className="sg-label">人才</div>
            </div>
            <div>
              <div className="sg-num">{events.length}</div>
              <div className="sg-label">赛事</div>
            </div>
            <div>
              <div className="sg-num">{orgs.length}</div>
              <div className="sg-label">机构</div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="sec-head">
            <div className="sec-title">授权范围内项目</div>
          </div>
          <div className="list">
            {projects.map((p) => (
              <div key={p.id} className="row-item" onClick={() => nav(`/project/${p.id}`)}>
                <div className="msg-icon" style={{ background: `linear-gradient(135deg, ${p.colorA}, ${p.colorB})` }}>
                  <Icon name="target" size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-title" style={{ fontSize: 13.5 }}>
                    {p.name}
                  </div>
                  <div className="t-mini mt4">
                    内容 2 · 运动员 1 · 导师 1 · 赛事 1（演示统计）
                  </div>
                </div>
                <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="sec-head">
            <div className="sec-title">人才</div>
          </div>
          <div className="list">
            {people.map((u) => (
              <PersonRow
                key={u.id}
                u={u}
                onClick={() => nav(u.kind === 'mentor' ? `/mentor/${u.id}` : `/athlete/${u.id}`)}
              />
            ))}
          </div>
        </div>

        <div className="section">
          <div className="sec-head">
            <div className="sec-title">赛事</div>
          </div>
          <div className="list">
            {events.map((e) => (
              <div key={e.id} className="row-item" onClick={() => nav(`/event/${e.id}`)}>
                <div className="msg-icon" style={{ background: '#12345B' }}>
                  <Icon name="medal" size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-title" style={{ fontSize: 13.5 }}>
                    {e.name}
                  </div>
                  <div className="t-mini mt4">
                    {e.status} · 报名 {e.enrolled}/{e.quota}（模拟）
                  </div>
                </div>
                <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="sec-head">
            <div className="sec-title">机构</div>
          </div>
          <div className="list">
            {orgs.map((o) => (
              <div key={o.id} className="row-item" onClick={() => nav(`/org/${o.id}`)}>
                <div className="msg-icon" style={{ background: `linear-gradient(135deg, ${o.colorA}, ${o.colorB})` }}>
                  <Icon name="building" size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-title" style={{ fontSize: 13.5 }}>
                    {o.name}
                  </div>
                  <div className="t-mini mt4">{o.type} · {o.region}</div>
                </div>
                <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
              </div>
            ))}
          </div>
        </div>

        <MockFooter text="本页统计与列表均为演示模拟数据，仅作角色原型展示" />
      </div>
    </>
  )
}
