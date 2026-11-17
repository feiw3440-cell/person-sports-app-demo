// 个人设置：账号/隐私/通知（账号范围共享同步）· 组织级（不覆盖个人级）· 设备级（仅本机）
import { useEffect, useState } from 'react'
import { App, Button, Card, Descriptions, Form, Input, Switch, Typography } from 'antd'
import { get, patch, type Obj } from '@/api/client'
import { PageWrap, useFetch } from '@/components/common'
import { useAuth } from '@/store/auth'

export default function SettingsPage() {
  const { message: msg } = App.useApp()
  const fetch = useFetch(() => get('/me/settings'), [])
  const [forms, setForms] = useState<Record<string, Obj>>({})
  const me = useAuth((s) => s.me)

  useEffect(() => {
    if (fetch.data) {
      const m: Record<string, Obj> = {}
      for (const row of fetch.data as Obj[]) m[row.scope] = row.prefs ?? {}
      setForms(m)
    }
  }, [fetch.data])

  const save = async (scope: string, prefs: Obj) => {
    const row = (fetch.data as Obj[]).find((r) => r.scope === scope)
    try {
      await patch('/me/settings', { scope, prefs, version: row?.version })
      msg.success(`已保存（${scope} 作用域）${scope === 'org' ? '：组织级设置不影响个人级' : scope === 'device' ? '：设备级不跨端' : '：另一端将按服务端版本同步'}`)
      fetch.reload()
    } catch (e) {
      msg.error((e as Error).message)
    }
  }

  return (
    <PageWrap fetch={fetch}>
      <Card title="个人设置（五作用域，服务端版本控制）">
        <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="账号">{String(me?.display_name)}</Descriptions.Item>
          <Descriptions.Item label="登录名">{String(me?.login_name)}</Descriptions.Item>
        </Descriptions>

        <Card size="small" title="账号级（头像/姓名/联系方式/语言/时区 — 账号范围两端共享）" style={{ marginBottom: 12 }}>
          <Form layout="inline">
            <Form.Item label="语言">
              <Input value={forms.account?.language ?? ''} style={{ width: 120 }} onChange={(e) => setForms({ ...forms, account: { ...forms.account, language: e.target.value } })} />
            </Form.Item>
            <Form.Item label="时区">
              <Input value={forms.account?.timezone ?? ''} style={{ width: 180 }} onChange={(e) => setForms({ ...forms, account: { ...forms.account, timezone: e.target.value } })} />
            </Form.Item>
            <SaveBtn onClick={() => save('account', forms.account ?? {})} />
          </Form>
        </Card>

        <Card size="small" title="隐私级（可见性 · 服务端每次读取授权生效，不落陈旧缓存）" style={{ marginBottom: 12 }}>
          <Form layout="inline">
            <Form.Item label="资料公开范围">
              <Input value={forms.privacy?.profile_visibility ?? ''} style={{ width: 140 }} onChange={(e) => setForms({ ...forms, privacy: { ...forms.privacy, profile_visibility: e.target.value } })} />
            </Form.Item>
            <Form.Item label="联系方式可见范围">
              <Input value={forms.privacy?.contact_visibility ?? ''} style={{ width: 140 }} onChange={(e) => setForms({ ...forms, privacy: { ...forms.privacy, contact_visibility: e.target.value } })} />
            </Form.Item>
            <SaveBtn onClick={() => save('privacy', forms.privacy ?? {})} />
          </Form>
        </Card>

        <Card size="small" title="通知偏好（按渠道与事件类型）" style={{ marginBottom: 12 }}>
          <Form layout="inline">
            {['course', 'event', 'mentorship', 'marketing'].map((k) => (
              <Form.Item key={k} label={{ course: '课程', event: '赛事', mentorship: '师徒', marketing: '推广' }[k]}>
                <Switch
                  checked={forms.notify?.channel?.[k] ?? false}
                  onChange={(v) => setForms({ ...forms, notify: { ...forms.notify, channel: { ...(forms.notify?.channel ?? {}), [k]: v } } })}
                />
              </Form.Item>
            ))}
            <SaveBtn onClick={() => save('notify', forms.notify ?? {})} />
          </Form>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>必要安全通知可由服务端策略覆盖用户偏好</Typography.Text>
        </Card>

        <Card size="small" title="组织级 / 设备级（只读说明）" >
          <Typography.Text type="secondary">
            组织级设置保存在对应组织作用域内（不覆盖个人级）；设备级（推送令牌/会话）仅本机，不跨端同步。当前演示账号的组织级设置由组织管理员维护。
          </Typography.Text>
        </Card>
      </Card>
    </PageWrap>
  )
}

function SaveBtn({ onClick }: { onClick: () => void }) {
  return <Button type="primary" size="small" onClick={onClick}>保存</Button>
}
