// 师徒关系与授权：关系（双方关联）与授权（权利范围）分开建模展示（PRD §7.3）
import { useNavigate } from 'react-router-dom'
import { AUTHORIZATIONS, MENTORSHIPS, SELF_ID, userById } from '../../data/db'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { EmptyState, MockFooter } from '../../components/ui'

export default function MentorshipPage() {
  const nav = useNavigate()
  const me = userById(SELF_ID)!

  const asStudent = MENTORSHIPS.filter((ms) => ms.menteeId === SELF_ID && ms.role === 'student')
  const asCoach = MENTORSHIPS.filter((ms) => ms.menteeId === SELF_ID && ms.role === 'coach')
  const asMentor = MENTORSHIPS.filter((ms) => ms.mentorId === SELF_ID)

  // 授权显式挂接在师徒关系上（mentorshipId），同一对师徒的不同关系各有授权
  const authOf = (mentorshipId: string) => AUTHORIZATIONS.find((a) => a.mentorshipId === mentorshipId)

  return (
    <>
      <DetailHeader title="师徒关系与授权" sub="关系记录关联 · 授权记录权利范围" />
      <div className="page page-nofoot">
        <div className="card">
          <div className="t-title" style={{ fontSize: 14 }}>
            两类数据关系（PRD §7.3）
          </div>
          <div className="t-sub mt8" style={{ lineHeight: 1.7 }}>
            <b>师徒关系</b>记录双方关联（谁是谁的师父/徒弟）；<b>授权</b>是关系之上的权利范围（项目/课程内容/地区/期限/可否再授权/状态）。
            有师徒关系不一定有授权；授权可独立配置、撤销或到期。与「身份」（账号属性）也完全分离。
          </div>
        </div>

        {/* 作为学员（徒弟） */}
        {asStudent.map((ms) => {
          const mentor = userById(ms.mentorId)!
          const az = authOf(ms.id)
          return (
            <div key={ms.id} className="card mt12">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <div className="t-title" style={{ fontSize: 14 }}>
                  我的师父
                </div>
                <span className="badge badge-verified">关系有效（演示）</span>
              </div>
              <div className="row-item mt12" style={{ boxShadow: 'none', border: '1px solid var(--line)' }} onClick={() => nav(`/mentor/${mentor.id}`)}>
                <div className="avatar avatar-md" style={{ background: `linear-gradient(135deg, ${mentor.color}, ${mentor.color}CC)` }}>
                  {mentor.name.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex gap6">
                    <span className="t-title">{mentor.name}</span>
                    <span className="badge badge-brand">认证导师</span>
                  </div>
                  <div className="t-mini mt4">
                    {mentor.title} · 建立时间 {ms.since}
                  </div>
                </div>
                <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
              </div>
              {az && (
                <button className="btn btn-ghost btn-sm btn-block mt12" onClick={() => nav(`/authorization/${az.id}`)}>
                  查看授权详情：{az.scope.project} · {az.scope.region}
                </button>
              )}
            </div>
          )
        })}

        {/* 作为授权教练 */}
        {asCoach.map((ms) => {
          const mentor = userById(ms.mentorId)!
          const az = authOf(ms.id)
          const myStudents = MENTORSHIPS.filter((x) => x.mentorId === SELF_ID)
          return (
            <div key={ms.id} className="card mt12">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <div className="t-title" style={{ fontSize: 14 }}>
                  我是授权教练
                </div>
                {az && <span className={`badge ${az.status === '生效中' ? 'badge-verified' : 'badge-unverified'}`}>授权{az.status}（演示）</span>}
              </div>
              <div className="t-sub mt8">
                获 {mentor.name} 授权开展教学；授权链路：导师 → 授权教练 → 学员。
              </div>
              <div className="row-item mt12" style={{ boxShadow: 'none', border: '1px solid var(--line)' }} onClick={() => nav(`/mentor/${mentor.id}`)}>
                <div className="avatar avatar-md" style={{ background: `linear-gradient(135deg, ${mentor.color}, ${mentor.color}CC)` }}>
                  {mentor.name.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-title">{mentor.name}</div>
                  <div className="t-mini mt4">授权方 · {mentor.title}</div>
                </div>
                <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
              </div>
              {az && (
                <div className="mt12">
                  <div className="t-mini mb8">
                    我名下学员 {myStudents.length} 位（含链路授权）：
                  </div>
                  {myStudents.map((s) => {
                    const st = userById(s.menteeId)!
                    const saz = authOf(s.id)
                    return (
                      <div key={s.id} className="row-item mb8" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
                        <div className="avatar avatar-sm" style={{ background: `linear-gradient(135deg, ${st.color}, ${st.color}CC)` }}>
                          {st.name.slice(0, 1)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="t-title" style={{ fontSize: 13.5 }}>
                            {st.name}
                          </div>
                          <div className="t-mini mt4">{saz ? `授权${saz.status} · ${saz.scope.term}` : '无授权（仅关系）'}</div>
                        </div>
                        {saz && (
                          <button className="btn btn-sm btn-ghost" onClick={() => nav(`/authorization/${saz.id}`)}>
                            授权详情
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {az.allowSubGrant && (
                    <button className="btn btn-primary btn-sm btn-block mt8" onClick={() => nav(`/authorization/${az.id}`)}>
                      查看链路与再授权权限（允许再授权）
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* 授权记录一览 */}
        <div className="section">
          <div className="sec-head">
            <div className="sec-title">授权记录 · {AUTHORIZATIONS.length} 条（演示）</div>
          </div>
          {AUTHORIZATIONS.length === 0 ? (
            <EmptyState title="暂无授权记录" />
          ) : (
            <div className="list">
              {AUTHORIZATIONS.map((a) => (
                <div key={a.id} className="row-item" onClick={() => nav(`/authorization/${a.id}`)}>
                  <div className="msg-icon" style={{ background: a.status === '生效中' ? '#19B9AC' : '#8B98A9' }}>
                    <Icon name="doc" size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex gap6">
                      <span className="t-title" style={{ fontSize: 13.5 }}>
                        {userById(a.mentorId)?.name} → {userById(a.granteeId)?.name}
                      </span>
                    </div>
                    <div className="t-mini mt4 ellipsis1">
                      {a.scope.project} · {a.scope.region} · {a.scope.term}
                    </div>
                  </div>
                  <span className={`badge ${a.status === '生效中' ? 'badge-verified' : a.status === '已撤销' ? 'badge-unverified' : 'badge-pending'}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="demo-strip">
          授权配置预留：体育项目、课程/教学内容、地区、有效期限、可否再授权、状态（生效/撤销/到期）。示例等级名称与权限仅作展示，真实规则待确认；Demo 不处理收益分账。
        </div>
        <MockFooter text="师徒关系、授权范围与链路均为演示模拟数据" />
      </div>
    </>
  )
}
