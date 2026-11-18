// 登录页：统一账号登录（共享 API 会话）；演示账号一键填充（仅本地 Demo）
import { useState } from 'react'
import { useSession } from '../services/session'
import { BrandLogo } from '../components/ui'

const DEMO_ACCOUNTS = [
  { login: 'demo@local', label: '演示学员·阿体', desc: '普通用户 / 学员身份' },
  { login: 'orgadmin@local', label: '锋跃管理员·铁娟', desc: '机构管理员（报名审核）' },
  { login: 'mentor@local', label: '导师·徐峰', desc: '导师身份' },
  { login: 'coach@local', label: '授权教练·何小授', desc: '授权教练身份' },
  { login: 'admin@local', label: '平台管理员·谭青', desc: '平台管理（内容/资质审核）' },
]

export default function LoginPage() {
  const login = useSession((s) => s.login)
  const chooseOrg = useSession((s) => s.chooseOrg)
  const loggingIn = useSession((s) => s.loggingIn)
  const loginError = useSession((s) => s.loginError)
  const orgOptions = useSession((s) => s.orgOptions)
  const [loginName, setLoginName] = useState('demo@local')
  const [password, setPassword] = useState('demo1234')

  return (
    <div className="min-h-screen bg-[#F3F6FA] flex flex-col" style={{ minHeight: '100vh' }}>
      <div className="flex-1 flex flex-col justify-center px-7 py-10" style={{ maxWidth: 430, margin: '0 auto', width: '100%' }}>
        <div className="center mb-8">
          <div style={{ transform: 'scale(1.25)', transformOrigin: 'center' }}>
            <BrandLogo />
          </div>
          <div className="t-mini mt8">专体 PERSON SPORTS · 统一账号（APP / PC 共用）</div>
        </div>

        <div className="card">
          <div className="t-title mb8" style={{ fontSize: 16 }}>
            账号登录
          </div>
          <div className="pub-field" style={{ margin: '10px 0' }}>
            <input className="pub-input" placeholder="账号（如 demo@local）" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          </div>
          <div className="pub-field" style={{ margin: '10px 0' }}>
            <input className="pub-input" type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {loginError && <div className="demo-strip" style={{ color: '#c0392b' }}>{loginError}</div>}
          <button className="pub-submit" style={{ marginTop: 16 }} disabled={loggingIn} onClick={() => login(loginName, password)}>
            {loggingIn ? '登录中…' : '登录'}
          </button>
        </div>

        {orgOptions.length > 1 && (
          <div className="card mt12">
            <div className="t-title mb8" style={{ fontSize: 14 }}>选择工作机构</div>
            <div className="t-mini mb8">该账号加入了多个机构，请选择本次登录使用的组织上下文（由服务端 /auth/context 建立）。</div>
            <div className="list" style={{ gap: 6 }}>
              {orgOptions.map((o) => (
                <button
                  key={o.org_id}
                  className="row-item"
                  style={{ boxShadow: 'none', border: '1px solid var(--line)', justifyContent: 'flex-start' }}
                  onClick={() => chooseOrg(o.org_id)}
                >
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div className="t-title" style={{ fontSize: 13 }}>{o.org_name}</div>
                    <div className="t-mini">{o.role === 'org_admin' ? '机构管理员' : '机构成员'}</div>
                  </div>
                  <span className="badge badge-blue">进入</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card mt12">
          <div className="t-mini mb8">演示账号（仅本地 Demo，密码统一 demo1234）：</div>
          <div className="list" style={{ gap: 6 }}>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.login}
                className="row-item"
                style={{ boxShadow: 'none', border: '1px solid var(--line)', justifyContent: 'flex-start' }}
                onClick={() => {
                  setLoginName(a.login)
                  setPassword('demo1234')
                }}
              >
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div className="t-title" style={{ fontSize: 13 }}>
                    {a.label}
                  </div>
                  <div className="t-mini">{a.desc}</div>
                </div>
                <span className="badge badge-blue">{a.login}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="footer-note mt16">
          本页为本地 Demo 登录原型：账号与密码仅在本机开发环境有效，不接入真实账号体系；
          登录后的身份、组织、权限上下文来自共享 API（服务端逐请求授权，客户端仅用于呈现）。
        </div>
      </div>
    </div>
  )
}
