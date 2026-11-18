// 设置页：设置分层原型（PRD V2.0 D 表）
// 账号级资料 / 隐私 / 通知偏好 → 共享 API（服务端权威）；组织级偏好 → 随组织上下文；设备级 → 仅本地
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearTokens } from '../services/apiClient'
import { useSession } from '../services/session'
import { currentRole, useApp } from '../store/store'
import { DATA_SOURCE, SELF_ID, userById } from '../data/db'
import Icon from '../components/Icon'
import DetailHeader from '../components/DetailHeader'
import { MockFooter } from '../components/ui'

type Prefs = {
  notify_course: boolean
  notify_event: boolean
  notify_mentorship: boolean
  notify_marketing: boolean
  privacy_contact: 'public' | 'org' | 'private'
  privacy_achievement: 'public' | 'org' | 'private'
}

export default function SettingsPage() {
  const nav = useNavigate()
  const role = currentRole()
  const me = userById(SELF_ID)
  const pushToast = useApp((s) => s.pushToast)
  const logout = useSession((s) => s.logout)

  const [prefs, setPrefs] = useState<Prefs>({
    notify_course: true,
    notify_event: true,
    notify_mentorship: true,
    notify_marketing: false,
    privacy_contact: 'org',
    privacy_achievement: 'public',
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [versions, setVersions] = useState<Record<string, number>>({})

  const load = async () => {
    setLoading(true)
    try {
      const res = await api<{ data: { scope: string; prefs: Record<string, unknown>; version: number }[] }>('GET', '/me/settings')
      const rows = res.data || []
      const notify = rows.find((r) => r.scope === 'notify')?.prefs || {}
      const privacy = rows.find((r) => r.scope === 'privacy')?.prefs || {}
      setPrefs({
        notify_course: notify.course !== false,
        notify_event: notify.event !== false,
        notify_mentorship: notify.mentorship !== false,
        notify_marketing: notify.marketing === true,
        privacy_contact: (['public', 'org', 'private'].includes(String(privacy.contact)) ? privacy.contact : 'org') as Prefs['privacy_contact'],
        privacy_achievement: (['public', 'org', 'private'].includes(String(privacy.achievements)) ? privacy.achievements : 'public') as Prefs['privacy_achievement'],
      })
      setVersions(Object.fromEntries(rows.map((r) => [r.scope, r.version])))
    } catch (e) {
      pushToast(`读取设置失败：${e instanceof Error ? e.message : '网络异常'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      // 服务端契约：{scope, prefs, version}；组织级设置需 org_id，本页未组织偏好写入
      const notifyRes = await api<{ data: { version: number } }>('PATCH', '/me/settings', {
        scope: 'notify',
        prefs: {
          course: prefs.notify_course,
          event: prefs.notify_event,
          mentorship: prefs.notify_mentorship,
          marketing: prefs.notify_marketing,
        },
        version: versions.notify,
      })
      const privacyRes = await api<{ data: { version: number } }>('PATCH', '/me/settings', {
        scope: 'privacy',
        prefs: { contact: prefs.privacy_contact, achievements: prefs.privacy_achievement },
        version: versions.privacy,
      })
      setVersions((v) => ({ ...v, notify: notifyRes.data.version, privacy: privacyRes.data.version }))
      await load()
      pushToast('设置已保存到共享 API（服务端权威，双端同步）')
    } catch (e) {
      pushToast(`保存失败：${e instanceof Error ? e.message : '网络异常'}（已保留当前输入）`)
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DetailHeader title="设置" sub="账号 / 隐私 / 通知偏好（服务端权威）" />
      <div className="page page-nofoot">
        {/* 账号级资料（共享） */}
        <div className="sec2">
          <div className="t">账号资料</div>
          <span className="badge badge-blue">双端共享</span>
        </div>
        <div className="card">
          <div className="kv">
            <span className="k">昵称</span>
            <span className="v">{me?.name || '演示账号'}</span>
          </div>
          <div className="kv">
            <span className="k">当前身份</span>
            <span className="v">{role.label}</span>
          </div>
          <div className="t-mini mt8">头像、姓名、联系方式等账号级资料双端共享（更新后刷新版本与时间）。</div>
        </div>

        {/* 隐私设置（服务端存储，逐请求检查） */}
        <div className="sec2">
          <div className="t">隐私设置</div>
          <span className="badge badge-blue">服务端逐请求检查</span>
        </div>
        <div className="card">
          <ToggleRow
            label="联系方式可见范围"
            value={prefs.privacy_contact}
            options={['public', 'org', 'private']}
            optionLabels={['公开', '组织内', '仅自己']}
            onChange={(v) => setPrefs({ ...prefs, privacy_contact: v as Prefs['privacy_contact'] })}
          />
          <ToggleRow
            label="成绩/成就可见范围"
            value={prefs.privacy_achievement}
            options={['public', 'org', 'private']}
            optionLabels={['公开', '组织内', '仅自己']}
            onChange={(v) => setPrefs({ ...prefs, privacy_achievement: v as Prefs['privacy_achievement'] })}
          />
          <div className="t-mini mt8">可见范围由服务端存储并在每次读取时检查；其他端不得继续显示已撤回权限的内容。</div>
        </div>

        {/* 通知偏好 */}
        <div className="sec2">
          <div className="t">通知偏好</div>
          <span className="badge badge-blue">按事件类型存储</span>
        </div>
        <div className="card">
          <ToggleRowBool label="课程通知（开课/审核）" value={prefs.notify_course} onChange={(v) => setPrefs({ ...prefs, notify_course: v })} />
          <ToggleRowBool label="赛事通知（报名/赛程/成绩）" value={prefs.notify_event} onChange={(v) => setPrefs({ ...prefs, notify_event: v })} />
          <ToggleRowBool label="师徒与授权通知" value={prefs.notify_mentorship} onChange={(v) => setPrefs({ ...prefs, notify_mentorship: v })} />
          <ToggleRowBool label="营销与活动推送" value={prefs.notify_marketing} onChange={(v) => setPrefs({ ...prefs, notify_marketing: v })} />
        </div>

        {/* 组织级偏好（当前组织上下文） */}
        <div className="sec2">
          <div className="t">组织偏好</div>
          <span className="badge badge-pending">仅当前组织上下文</span>
        </div>
        <div className="card">
          <div className="kv">
            <span className="k">当前组织</span>
            <span className="v">{role.extra || '（无组织上下文）'}</span>
          </div>
          <div className="t-mini mt8">组织级偏好（如默认工作台落地页）仅影响当前组织上下文，不覆盖个人默认值；切换组织时明确标注。</div>
        </div>

        {/* 设备级设置（仅本地） */}
        <div className="sec2">
          <div className="t">设备设置</div>
          <span className="badge badge-mock">仅本设备，不同步</span>
        </div>
        <div className="card">
          <div className="kv">
            <span className="k">数据模式</span>
            <span className="v">{DATA_SOURCE === 'api' ? '共享 API（服务端权威）' : 'Mock 演示数据'}</span>
          </div>
          <div className="kv">
            <span className="k">推送令牌</span>
            <span className="v">（本设备，不同步到 PC）</span>
          </div>
          <div className="t-mini mt8">推送令牌、生物识别、本地会话只保存在设备侧（PRD V2.0 D 表）。</div>
        </div>

        <button className="pub-submit" style={{ marginTop: 16 }} disabled={saving || loading} onClick={save}>
          {loading ? '读取服务端设置…' : saving ? '保存中…' : '保存设置'}
        </button>

        {/* 退出登录（危险操作二次校验） */}
        <div className="card mt16">
          <button
            className="btn btn-ghost-gray btn-block"
            onClick={async () => {
              if (window.confirm('退出登录将撤销当前服务端会话并清理本地敏感数据，确定退出？')) {
                await logout()
                nav('/login')
              }
            }}
          >
            退出登录（清理本地会话与敏感缓存）
          </button>
        </div>

        <MockFooter text="设置分层对应 PRD V2.0 D 表：账号/隐私/通知偏好共享，组织偏好随上下文，设备设置仅本地" />
      </div>
    </>
  )
}

function ToggleRow({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  optionLabels: string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="kv" style={{ alignItems: 'center' }}>
      <span className="k">{label}</span>
      <span className="flex gap6" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {options.map((o, i) => (
          <button key={o} className={`pub-chip ${value === o ? 'active' : ''}`} onClick={() => onChange(o)}>
            {optionLabels[i]}
          </button>
        ))}
      </span>
    </div>
  )
}

function ToggleRowBool({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="kv" style={{ alignItems: 'center' }}>
      <span className="k">{label}</span>
      <button
        className={`pub-chip ${value ? 'active' : ''}`}
        style={{ marginLeft: 'auto' }}
        onClick={() => onChange(!value)}
      >
        {value ? '开启' : '关闭'}
      </button>
    </div>
  )
}
