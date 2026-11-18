// 登录与工作区选择：统一登录 → 选择组织/身份（无组织时引导创建）
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Alert, Button, Card, Form, Input, Select, Space, Typography, message } from 'antd'
import { LoginOutlined } from '@ant-design/icons'
import { get, post } from '@/api/client'
import { useAuth } from '@/store/auth'

export default function LoginPage() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const setTokens = useAuth((s) => s.setTokens)
  const setMe = useAuth((s) => s.setMe)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'login' | 'workspace'>('login')
  const [me, setMeLocal] = useState<Record<string, any> | null>(null)
  const [tokens, setTokensLocal] = useState<{ access: string; refresh: string } | null>(null)

  const acceptedOrgs = (me?.memberships ?? []).filter((m: any) => m.status === 'accepted')

  const doLogin = async (v: { login_name: string; password: string }) => {
    setLoading(true)
    try {
      const d = await post('/auth/sessions', { ...v, client: 'pc' })
      setTokensLocal({ access: d.access_token, refresh: d.refresh_token })
      const meData: Record<string, any> = d.me
      setMeLocal(meData)
      const orgs = (meData.memberships ?? []).filter((m: any) => m.status === 'accepted')
      if (orgs.length > 0) {
        // 有组织上下文 → 进入工作区选择
        setStep('workspace')
      } else {
        // 无组织 → 直接进入（引导创建/加入在机构页完成）
        setTokens({ access: d.access_token, refresh: d.refresh_token })
        finishLogin(meData, null, null)
      }
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const finishLogin = (meData: Record<string, any>, orgId: string | null, identityId: string | null) => {
    setMe(meData)
    useAuth.setState({ identityId, orgId })
    nav(loc.state?.from ?? '/', { replace: true })
  }

  const enterWorkspace = async (orgId: string | null, identityId: string | null) => {
    setLoading(true)
    try {
      // 先注入令牌，再切换上下文（/auth/context 需要认证；返回新的带上下文访问令牌）
      setTokens(tokens!)
      const d = await post('/auth/context', { org_id: orgId ?? undefined, identity_id: identityId ?? undefined })
      // 关键：保存切换后签发的访问令牌（上下文在令牌内）
      setTokens({ access: d.access_token, refresh: tokens!.refresh })
      // 重新拉取带上下文的 me（perm_summary 随上下文变化）
      const meFresh = await get('/me')
      setMe(meFresh as Record<string, any>)
      useAuth.setState({ identityId, orgId })
      nav(loc.state?.from ?? '/', { replace: true })
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #12345B 0%, #2872B8 100%)' }}>
      <div className="pc-brand" style={{ color: '#fff', marginBottom: 24, transform: 'scale(1.3)' }}>
        <span className="logo" style={{ background: 'rgba(255,255,255,0.18)' }}>体</span>
        <span>
          专体 PERSON SPORTS
          <div className="en" style={{ color: 'rgba(255,255,255,0.6)' }}>PC 工作台 · 业务管理端</div>
        </span>
      </div>
      <Card style={{ width: 400, borderRadius: 12 }}>
        {step === 'login' ? (
          <>
            <Typography.Title level={4} style={{ marginTop: 0 }}>统一账号登录</Typography.Title>
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message="本地演示环境" description="种子账号：admin@local / orgadmin@local / mentor@local / coach@local / demo@local，密码均为 demo1234（仅本机使用）" />
            <Form layout="vertical" onFinish={doLogin} initialValues={{ login_name: 'orgadmin@local', password: 'demo1234' }}>
              <Form.Item name="login_name" label="登录名" rules={[{ required: true }]}>
                <Input placeholder="login_name" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Button type="primary" htmlType="submit" block icon={<LoginOutlined />} loading={loading}>
                登录
              </Button>
            </Form>
          </>
        ) : (
          <WorkspaceChooser
            orgs={acceptedOrgs}
            identities={me?.identities ?? []}
            loading={loading}
            onEnter={enterWorkspace}
          />
        )}
      </Card>
      <Typography.Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 20, fontSize: 12 }}>
        PC 与 APP 共用同一账号 / 认证服务 / 权威数据库（本地演示库）
      </Typography.Text>
    </div>
  )
}

function WorkspaceChooser({ orgs, identities, loading, onEnter }: {
  orgs: Record<string, any>[]
  identities: { id: string; identity_type: string; label: string }[]
  loading: boolean
  onEnter: (orgId: string | null, identityId: string | null) => void
}) {
  const orgOptions = orgs.map((m) => ({ value: m.org_id as string, label: `${m.org_name}（${m.role === 'org_admin' ? '管理员' : '成员'}）` }))
  const identityOptions = identities.map((i) => ({ value: i.id, label: i.label }))
  const [orgId, setOrgId] = useState<string | null>(orgOptions[0]?.value ?? null)
  const chosenOrg = orgs.find((m) => m.org_id === orgId)
  const [identityId, setIdentityId] = useState<string | null>(identityOptions[0]?.value ?? null)
  return (
    <>
      <Typography.Title level={4} style={{ marginTop: 0 }}>选择工作区</Typography.Title>
      {orgOptions.length === 0 ? (
        <Alert type="warning" showIcon message="尚未加入组织"
          description="可稍后在「机构与组织」中接受邀请或创建组织；当前以个人上下文进入。" style={{ marginBottom: 12 }} />
      ) : (
        <>
          <Typography.Text type="secondary">组织上下文（决定数据范围）</Typography.Text>
          <Select style={{ width: '100%', marginTop: 6, marginBottom: 16 }} value={orgId} onChange={setOrgId} options={orgOptions} />
        </>
      )}
      <Typography.Text type="secondary">当前身份（决定功能与菜单）</Typography.Text>
      <Select style={{ width: '100%', marginTop: 6, marginBottom: 16 }} value={identityId} onChange={setIdentityId} options={identityOptions} />
      {chosenOrg && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -8, marginBottom: 16 }}>
          将以「{String(chosenOrg.org_name)}·{String(chosenOrg.role) === 'org_admin' ? '管理员' : '成员'}」上下文进入：数据范围与菜单权限由该组织成员关系决定（账号 identity 为 {identityOptions.find((o) => o.value === identityId)?.label ?? '未选择'}）。
        </Typography.Text>
      )}
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button type="primary" block loading={loading} onClick={() => onEnter(orgId, identityId)}>
          进入工作台
        </Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          切换身份/组织会刷新会话权限上下文并清理端侧缓存（PRD §5）
        </Typography.Text>
      </Space>
    </>
  )
}
