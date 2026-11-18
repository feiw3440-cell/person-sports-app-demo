// 身份管理：一账号多身份，切换调用服务端 POST /auth/context 真正改变会话上下文
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/apiClient'
import { fetchAllAndHydrate } from '../../services/serverData'
import { useSession } from '../../services/session'
import { currentRole, useApp } from '../../store/store'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { MockFooter } from '../../components/ui'

const ROLE_DESC: Record<string, string> = {
  regular: '浏览项目与内容、关注收藏、发现赛事',
  student: '导师与课程展示、师徒关系示例、继续学习',
  athlete: '运动员主页、作品、成绩与核验状态展示',
  coach: '授权教练工作台：我的学员与授权管理',
  mentor: '导师工作台：教学体系、课程与师徒关系',
  org: '机构成员身份，按所属机构范围访问',
  reviewer: '平台审核：资质/内容/授权审核',
  platform_ops: '平台运营：跨机构业务管理与分析',
  platform_admin: '平台管理：账号、权限与审计',
  content_editor: '内容编辑：内容维护',
  event_organizer: '赛事组织：赛事与报名管理',
  admin: '平台管理视角（服务端身份）',
}

const ROLE_WORKBENCH: Record<string, { label: string; to: string }> = {
  regular: { label: '去发现', to: '/discover' },
  student: { label: '我的课程', to: '/list/my-courses' },
  athlete: { label: '运动员主页', to: '/athlete/u0' },
  coach: { label: '授权工作台', to: '/mentorship' },
  mentor: { label: '导师主页', to: '/mentor' },
  org: { label: '机构主页', to: '/organizations' },
  admin: { label: '管理工作台', to: '/admin' },
  platform_ops: { label: '管理工作台', to: '/admin' },
  platform_admin: { label: '管理工作台', to: '/admin' },
}

type IdentityView = {
  key: string
  label: string
  type: string
  enabled: boolean
  extra?: string
  switch?: { identityId?: string; orgId?: string }
}

type MeResponse = {
  display_name: string
  identities: { id: string; identity_type: string; label: string; status: string }[]
  memberships: { org_id: string; org_name?: string; role: string; status: string }[]
}

export default function IdentityPage() {
  const nav = useNavigate()
  const currentRoleId = useApp((s) => s.currentRoleId)
  const switchRole = useApp((s) => s.switchRole)
  const pushToast = useApp((s) => s.pushToast)
  const switchContext = useSession((s) => s.switchContext)
  const role = currentRole()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let removed = false
    api<{ data: MeResponse }>('GET', '/me')
      .then((res) => { if (!removed) setMe(res.data) })
      .catch((e) => { if (!removed) pushToast(`读取身份失败：${e instanceof Error ? e.message : '网络异常'}`) })
    return () => { removed = true }
  }, [pushToast])

  const identities: IdentityView[] = (me?.identities || []).map((i) => ({
    key: i.id,
    label: i.label || i.identity_type,
    type: i.identity_type,
    enabled: i.status === 'active',
    switch: { identityId: i.id },
  }))
  const memberships: IdentityView[] = (me?.memberships || [])
    .filter((m) => m.status === 'accepted' || m.status === 'pending')
    .map((m) => ({
      key: `org_${m.org_id}`,
      label: `${m.org_name || '机构'} · ${m.role === 'org_admin' ? '管理员' : '成员'}`,
      type: 'org',
      enabled: m.status === 'accepted',
      extra: m.status === 'accepted' ? undefined : '邀请待接受',
      switch: { orgId: m.org_id },
    }))
  const allRoles = [...identities, ...memberships]
  const activeKey = currentRoleId || ''

  const doSwitch = async (r: IdentityView) => {
    if (!r.enabled || !r.switch) return
    setBusy(true)
    const ok = await switchContext(r.switch.identityId, r.switch.orgId)
    if (ok) {
      switchRole(r.key)
      try { await fetchAllAndHydrate() } catch { /* 数据刷新失败不阻塞切换反馈 */ }
      pushToast(`已切换服务端上下文：${r.label}`)
    } else {
      pushToast('身份切换失败，服务端拒绝了上下文变更')
    }
    setBusy(false)
  }

  return (
    <>
      <DetailHeader title="身份管理" sub={`账号「${me?.display_name || '当前账号'}」· ${allRoles.length} 个身份`} />
      <div className="page page-nofoot">
        <div className="card">
          <div className="t-title" style={{ fontSize: 14 }}>
            多身份说明（PRD §7.1）
          </div>
          <div className="t-sub mt8" style={{ lineHeight: 1.7 }}>
            同一账号可同时拥有多个身份。切换身份会调用共享 API 建立真实服务端上下文，并重新加载权限与页面数据；不更换账号、不删除或覆盖原有资料。
          </div>
        </div>

        <div className="section">
          <div className="sec-head">
            <div className="sec-title">我的身份</div>
            <span className="badge badge-blue">来自服务端 /me</span>
          </div>
          <div className="list">
            {allRoles.length === 0 && <div className="t-mini center">当前账号暂无已开通身份</div>}
            {allRoles.map((r) => {
              const active = r.key === activeKey || (r.switch?.orgId && useSession.getState().orgId === r.switch.orgId && r.type === 'org')
              return (
                <div key={r.key} className={`row-item ${active ? 'chain-node hot' : ''}`} style={{ alignItems: 'center' }}>
                  <div className="msg-icon" style={{ background: roleColor(r.type) }}>
                    <Icon name={roleIcon(r.type)} size={19} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex gap6">
                      <span className="t-title">{r.label}</span>
                      {active ? (
                        <span className="badge badge-lime">使用中</span>
                      ) : r.enabled ? (
                        <span className="badge badge-verified">已开通</span>
                      ) : (
                        <span className="badge badge-pending">尚未开通</span>
                      )}
                    </div>
                    <div className="t-mini mt4 ellipsis2">{r.extra || ROLE_DESC[r.type] || '该身份由服务端授权'}</div>
                  </div>
                  {active ? (
                    <button className="btn btn-sm btn-ghost" onClick={() => nav(ROLE_WORKBENCH[r.type]?.to || '/me')}>
                      {ROLE_WORKBENCH[r.type]?.label || '工作台'}
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-primary" disabled={!r.enabled || busy} onClick={() => doSwitch(r)}>
                      切换
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {!identities.some((i) => i.type === 'mentor') && (
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
                  <span className="badge badge-pending">尚未开通</span>
                </div>
                <div className="t-mini mt4">普通用户不能直接获得认证导师身份，需申请并通过平台审核</div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => nav('/mentor-apply')}>
                查看进度
              </button>
            </div>
          </div>
        )}

        <div className="demo-strip">
          身份切换会改变服务端会话上下文；关注/收藏/点赞、消息已读、师徒关系与授权、申请进度等数据不会被清除。当前业务视角：{role.label}
        </div>
        <MockFooter text="身份列表来自共享 API；未开通身份不做已启用展示" />
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
    case 'mentor': return 'shield'
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
    case 'mentor': return '#8B5CF6'
    case 'org': return '#FF6B5E'
    case 'admin': return '#12345B'
    default: return '#12345B'
  }
}
