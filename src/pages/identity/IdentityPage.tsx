// 身份管理：一账号多身份，切换仅改变当前业务视图，不清除/覆盖任何资料（PRD §7.1）
import { useNavigate } from 'react-router-dom'
import { ROLES, ROLE_LABEL, SELF_ID, userById } from '../../data/db'
import { currentRole, useApp } from '../../store/store'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { MockFooter } from '../../components/ui'

const ROLE_DESC: Record<string, string> = {
  regular: '浏览项目与内容、关注收藏、发现赛事',
  student: '导师与课程展示、师徒关系示例、继续学习',
  athlete: '运动员主页、作品、成绩与核验状态展示',
  coach: '授权教练工作台：我的学员与授权管理',
  org: '机构主页、教练赛事与招生信息（原型）',
  admin: '查看授权范围内的项目、人才、赛事及机构（仅原型）',
  mentor: '导师工作台（当前账号申请审核中）',
}

// 各身份对应的工作台入口（原型五页保持 1:1，身份业务入口统一收敛在身份管理页）
const ROLE_WORKBENCH: Record<string, { label: string; to: string }> = {
  regular: { label: '去发现', to: '/discover' },
  student: { label: '我的课程', to: '/list/my-courses' },
  athlete: { label: '运动员主页', to: '/athlete/u0' },
  coach: { label: '授权工作台', to: '/mentorship' },
  org: { label: '机构主页', to: '/org/o1' },
  admin: { label: '管理工作台', to: '/admin' },
}

export default function IdentityPage() {
  const nav = useNavigate()
  const currentRoleId = useApp((s) => s.currentRoleId)
  const switchRole = useApp((s) => s.switchRole)
  const pushToast = useApp((s) => s.pushToast)
  const me = userById(SELF_ID)!

  const roles = ROLES.map((r) => ({
    ...r,
    desc: ROLE_DESC[r.type] || '',
    icon: roleIcon(r.type),
    color: roleColor(r.type),
  }))

  return (
    <>
      <DetailHeader title="身份管理" sub={`账号「${me.name}」· ${ROLES.length} 个身份`} />
      <div className="page page-nofoot">
        <div className="card">
          <div className="t-title" style={{ fontSize: 14 }}>
            多身份说明（PRD §7.1）
          </div>
          <div className="t-sub mt8" style={{ lineHeight: 1.7 }}>
            同一账号可同时拥有多个身份。切换身份只改变当前业务工作台与内容重点：<b>不更换账号、不删除或覆盖原有资料</b>。
            身份（账号属性）与师徒/授权（账号间关系）是两类不同的数据关系。
          </div>
        </div>

        <div className="section">
          <div className="sec-head">
            <div className="sec-title">我的身份</div>
            <span className="badge badge-mock">状态为演示数据</span>
          </div>
          <div className="list">
            {roles.map((r) => {
              const active = r.id === currentRoleId
              return (
                <div key={r.id} className={`row-item ${active ? 'chain-node hot' : ''}`} style={{ alignItems: 'center' }}>
                  <div className="msg-icon" style={{ background: r.color }}>
                    <Icon name={r.icon} size={19} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => nav('/me')}>
                    <div className="flex gap6">
                      <span className="t-title">{r.label}</span>
                      {active ? (
                        <span className="badge badge-lime">使用中</span>
                      ) : (
                        <span className="badge badge-verified">已启用</span>
                      )}
                    </div>
                    <div className="t-mini mt4 ellipsis2">{r.desc}{r.extra ? ` · ${r.extra}` : ''}</div>
                  </div>
                  {active ? (
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => nav(ROLE_WORKBENCH[r.type]?.to || '/me')}
                    >
                      {ROLE_WORKBENCH[r.type]?.label || '工作台'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        switchRole(r.id)
                        pushToast(`已切换至「${ROLE_LABEL[r.type] || r.label}」身份，原资料全部保留（演示）`)
                      }}
                    >
                      切换
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 导师身份：需审核，当前账号申请中 */}
        <div className="section">
          <div className="sec-head">
            <div className="sec-title">导师身份（需平台审核）</div>
          </div>
          <div className="row-item">
            <div className="msg-icon" style={{ background: '#8B5CF6' }}>
              <Icon name="shield" size={19} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => nav('/mentor-apply')}>
              <div className="flex gap6">
                <span className="t-title">认证导师</span>
                <span className="badge badge-pending">申请审核中（演示）</span>
              </div>
              <div className="t-mini mt4">普通用户不能直接获得认证导师身份，需申请并通过平台审核</div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => nav('/mentor-apply')}>
              查看进度
            </button>
          </div>
        </div>

        <div className="demo-strip">
          当前身份指针变化不会清除：关注/收藏/点赞、消息已读、师徒关系与授权、申请进度等任何数据。回到「我的」或首页可看到身份对应的业务入口。
        </div>
        <MockFooter text="身份状态与审核状态均为演示模拟数据" />
      </div>
    </>
  )
}

function roleIcon(t: string): string {
  switch (t) {
    case 'regular': return 'home'
    case 'student': return 'book'
    case 'athlete': return 'medal'
    case 'coach': return 'users'
    case 'org': return 'building'
    case 'admin': return 'grid'
    default: return 'shield'
  }
}
function roleColor(t: string): string {
  switch (t) {
    case 'regular': return '#2872B8'
    case 'student': return '#19B9AC'
    case 'athlete': return '#FF9850'
    case 'coach': return '#2B7FFF'
    case 'org': return '#FF6B5E'
    case 'admin': return '#12345B'
    default: return '#8B5CF6'
  }
}
