// 体育管理工作台（仅原型）：授权范围内的项目、人才、课程、赛事概览（PRD §2.2，不实现管理后台）
// API 模式：统计四域来自 GET /v1/analytics/workbench（服务端实时口径），列表读水合数据仓；Mock 模式保留演示静态数据
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DATA_SOURCE, EVENTS, ORGS, PROJECTS, USERS } from '../data/db'
import { api } from '../services/apiClient'
import Icon from '../components/Icon'
import DetailHeader from '../components/DetailHeader'
import { MockFooter } from '../components/ui'
import { PersonRow } from '../components/cards'

type Workbench = {
  cards?: { projects?: number; people?: number; courses?: number; competitions?: number }
  todos?: { ref: string; label: string; count: number }[]
  generated_at?: string
}

export default function AdminWorkspace() {
  const nav = useNavigate()
  const isApi = DATA_SOURCE === 'api'
  const [wb, setWb] = useState<Workbench | null>(null)
  const [wbErr, setWbErr] = useState('')

  useEffect(() => {
    if (!isApi) return
    let removed = false
    api<{ data: Workbench }>('GET', '/analytics/workbench')
      .then((res) => { if (!removed) setWb(res.data) })
      .catch((e) => { if (!removed) setWbErr(e instanceof Error ? e.message : '网络异常') })
    return () => { removed = true }
  }, [isApi])

  // 列表展示水合数据仓（服务端权威范围）；Mock 模式保留原授权范围演示过滤
  const projects = isApi ? PROJECTS.slice(0, 6) : PROJECTS.filter((p) => ['p1', 'p2'].includes(p.id))
  const people = isApi
    ? USERS.filter((u) => u.kind === 'athlete' || u.kind === 'mentor').slice(0, 8)
    : USERS.filter((u) => ['a1', 'a2', 'm1', 'm2'].includes(u.id))
  const events = isApi ? EVENTS.slice(0, 6) : EVENTS.filter((e) => ['e1', 'e2'].includes(e.id))
  const orgs = isApi ? ORGS.slice(0, 6) : ORGS.filter((o) => ['o1', 'o2'].includes(o.id))

  const cards = isApi
    ? [
        { num: wb?.cards?.projects, label: '项目' },
        { num: wb?.cards?.people, label: '人才' },
        { num: wb?.cards?.courses, label: '课程' },
        { num: wb?.cards?.competitions, label: '赛事' },
      ]
    : [
        { num: projects.length, label: '项目' },
        { num: people.length, label: '人才' },
        { num: events.length, label: '赛事' },
        { num: orgs.length, label: '机构' },
      ]

  return (
    <>
      <DetailHeader title="管理工作台（原型）" sub={isApi ? '体育管理角色 · 服务端实时口径' : '体育管理角色 · 授权范围内只读展示'} />
      <div className="page page-nofoot">
        <div className="demo-strip">
          本页为体育管理角色的页面原型：<b>不实现管理后台</b>。
          {isApi ? '统计数字来自共享 API（GET /v1/analytics/workbench，服务端实时口径）；列表为数据仓授权范围展示。' : '授权范围（演示）：摔跤 / 柔道 · 华东地区。管理规则与权限口径待确认。'}
        </div>

        <div className="card mt12">
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            {cards.map((c) => (
              <div key={c.label}>
                <div className="sg-num">{wbErr && isApi ? '-' : (c.num ?? '…')}</div>
                <div className="sg-label">{c.label}</div>
              </div>
            ))}
          </div>
          {isApi && wbErr && <div className="t-mini mt8" style={{ color: '#c0392b' }}>统计读取失败：{wbErr}</div>}
          {isApi && !!wb?.todos?.length && (
            <div className="mt12">
              {wb.todos.map((t) => (
                <div key={t.ref} className="kv">
                  <span className="k"><Icon name="bell" size={13} /> 待办</span>
                  <span className="v" style={{ fontSize: 12.5 }}>{t.label}</span>
                  <span className="badge badge-pending">{t.count}</span>
                </div>
              ))}
              <div className="t-mini mt4">待办处理在 PC 管理端完成（资质/赛事报名/授权审核）。</div>
            </div>
          )}
        </div>

        <div className="section">
          <div className="sec-head">
            <div className="sec-title">体育项目</div>
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
                    {isApi ? '服务端项目档案 · 点击查看详情' : '内容 2 · 运动员 1 · 导师 1 · 赛事 1（演示统计）'}
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
                    {e.status} · 报名 {e.enrolled}/{e.quota}
                    {!isApi && '（模拟）'}
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

        {!isApi && <MockFooter text="本页统计与列表均为演示模拟数据，仅作角色原型展示" />}
      </div>
    </>
  )
}
