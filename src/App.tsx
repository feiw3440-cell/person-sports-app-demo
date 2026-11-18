// 应用入口：启动门（会话检查 → 共享 API 数据水合 → 路由）
// 数据源开关：VITE_DATA_SOURCE=api（默认，走共享本地 API）/ mock（静态演示数据，仅开发隔离）
import { useCallback, useEffect, useRef, useState } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastHost } from './components/ui'
import Icon from './components/Icon'
import { DATA_SOURCE, ROLES_LIVE } from './data/db'
import { fetchAllAndHydrate } from './services/serverData'
import { useSession } from './services/session'
import { useApp } from './store/store'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import DiscoverPage from './pages/DiscoverPage'
import TopPage from './pages/TopPage'
import RankListPage from './pages/RankListPage'
import MessagesPage from './pages/MessagesPage'
import ProfilePage from './pages/ProfilePage'
import SearchPage from './pages/SearchPage'
import ListPage from './pages/ListPage'
import PublishPage from './pages/PublishPage'
import ProjectDetail from './pages/detail/ProjectDetail'
import ContentDetail from './pages/detail/ContentDetail'
import AthleteProfile from './pages/detail/AthleteProfile'
import MentorProfile from './pages/detail/MentorProfile'
import CourseDetail from './pages/detail/CourseDetail'
import CompetitionDetail from './pages/detail/CompetitionDetail'
import OrganizationPage from './pages/detail/OrganizationPage'
import IdentityPage from './pages/identity/IdentityPage'
import MentorApplyPage from './pages/identity/MentorApplyPage'
import MentorshipPage from './pages/mentorship/MentorshipPage'
import AuthorizationDetail from './pages/mentorship/AuthorizationDetail'
import AdminWorkspace from './pages/AdminWorkspace'
import StatesPage from './pages/StatesPage'
import SettingsPage from './pages/SettingsPage'
import AboutPage from './pages/AboutPage'

const MAIN_PATHS = ['/', '/discover', '/publish', '/top', '/messages', '/me']

function Layout() {
  const loc = useLocation()
  const isMain = MAIN_PATHS.includes(loc.pathname)
  // 路由切换时重置滚动位置（二级页返回/进入详情从顶部开始）
  useEffect(() => {
    window.scrollTo(0, 0)
    const id = requestAnimationFrame(() => window.scrollTo(0, 0))
    return () => cancelAnimationFrame(id)
  }, [loc.pathname])
  return (
    <div className="shell">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/top" element={<TopPage />} />
        <Route path="/top/rank/:category" element={<RankListPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/me" element={<ProfilePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/list/:type" element={<ListPage />} />
        <Route path="/publish" element={<PublishPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/content/:id" element={<ContentDetail />} />
        <Route path="/athlete/:id" element={<AthleteProfile />} />
        <Route path="/mentor/:id" element={<MentorProfile />} />
        <Route path="/course/:id" element={<CourseDetail />} />
        <Route path="/event/:id" element={<CompetitionDetail />} />
        <Route path="/org/:id" element={<OrganizationPage />} />
        <Route path="/identity" element={<IdentityPage />} />
        <Route path="/mentor-apply" element={<MentorApplyPage />} />
        <Route path="/mentorship" element={<MentorshipPage />} />
        <Route path="/authorization/:id" element={<AuthorizationDetail />} />
        <Route path="/admin" element={<AdminWorkspace />} />
        <Route path="/states" element={<StatesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      {isMain && <BottomNav />}
      <ToastHost />
    </div>
  )
}

function BrandLoading({ text }: { text: string }) {
  return (
    <div className="min-h-screen bg-[#F3F6FA] flex flex-col items-center justify-center" style={{ minHeight: '100vh' }}>
      <div style={{ transform: 'scale(1.3)', marginBottom: 18 }}>
        <svg width={44} height={44} viewBox="0 0 24 24" fill="#0A5CF0" aria-hidden>
          <circle cx="15.2" cy="4.6" r="2.3" />
          <g stroke="#0A5CF0" strokeWidth="2.1" strokeLinecap="round" fill="none">
            <path d="M14 8.6 15.8 13" />
            <path d="M14.2 9.6 8.8 11.4" />
            <path d="M14.9 9.4 19.4 6.8" />
            <path d="M15.8 13 11.6 19.4" />
            <path d="M15.8 13 20.2 16.2" />
          </g>
        </svg>
      </div>
      <div className="t-sub">{text}</div>
    </div>
  )
}

/** 启动门：API 模式（登录 → 数据水合 → 路由）；Mock 模式直接路由 */
function AppGate() {
  const access = useSession((s) => s.access)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(DATA_SOURCE === 'mock' ? 'ready' : 'loading')
  const [errMsg, setErrMsg] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const lastRefreshAt = useRef(0)
  const refreshingRef = useRef(false)

  const reload = useCallback(async () => {
    setState('loading')
    try {
      await fetchAllAndHydrate()
      // 会话恢复的角色选择以服务端上下文为权威：identity 上下文 > 组织上下文 > 默认首位
      const sess = useSession.getState()
      const roles = ROLES_LIVE
      const ctxRole = sess.account?.identity_id ? roles.find((r) => r.id === sess.account!.identity_id) : undefined
      const orgRole = sess.orgId ? roles.find((r) => r.id === 'org_' + sess.orgId) : undefined
      const preferred = ctxRole || orgRole || roles[0]
      if (preferred) useApp.getState().switchRole(preferred.id)
      setState('ready')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }, [])

  useEffect(() => {
    if (DATA_SOURCE !== 'api') return
    if (access) reload()
    // 未登录时由 LoginPage 处理
  }, [access, reload])

  /**
   * 轻量刷新：页面重新获得焦点/可见时重新拉取服务端数据。
   * - 30 秒内不重复请求；
   * - 正在输入表单时跳过，避免覆盖尚未提交的本地编辑；
   * - 失败时保留当前数据，仅不提示，不把用户踢回加载页；
   * - 组件卸载后通过 removed 标记停止更新状态。
   */
  const silentRefresh = useCallback(async () => {
    if (DATA_SOURCE !== 'api' || !access || refreshingRef.current) return
    const el = document.activeElement
    if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
    const now = Date.now()
    if (now - lastRefreshAt.current < 30000) return
    lastRefreshAt.current = now
    refreshingRef.current = true
    setRefreshing(true)
    try {
      await fetchAllAndHydrate()
    } catch {
      // 保留现有数据；登录水合失败仍由 reload() 负责显示错误页
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }, [access])

  useEffect(() => {
    if (DATA_SOURCE !== 'api' || state !== 'ready') return
    let removed = false
    const onVisible = () => { if (!removed && document.visibilityState === 'visible') void silentRefresh() }
    const onFocus = () => { if (!removed) void silentRefresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      removed = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [state, silentRefresh])

  if (DATA_SOURCE === 'api') {
    if (!access)
      return (
        <ErrorBoundary>
          <div className="shell">
            <LoginPage />
          </div>
        </ErrorBoundary>
      )
    if (state === 'loading') return <BrandLoading text="正在从共享 API 加载专体数据…" />
    if (state === 'error')
      return (
        <div className="min-h-screen bg-[#F3F6FA] flex flex-col items-center justify-center" style={{ minHeight: '100vh' }}>
          <div className="card" style={{ maxWidth: 340 }}>
            <div className="state-box" style={{ padding: '12px 0' }}>
              <div className="sb-icon">
                <Icon name="flash" size={28} />
              </div>
              <div className="sb-title">无法连接共享 API</div>
              <div className="sb-desc">{errMsg}</div>
              <div className="sb-desc">请确认本地共享后端已启动（server/ · :8787）后重试。</div>
            </div>
            <button className="btn btn-primary btn-block" onClick={reload}>
              重试
            </button>
          </div>
        </div>
      )
  }

  return (
    <ErrorBoundary>
    <HashRouter>
      {refreshing && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            padding: '3px 10px', textAlign: 'center', fontSize: 11,
            background: 'rgba(18,52,91,.88)', color: '#fff', pointerEvents: 'none',
          }}
        >
          正在同步服务端数据…
        </div>
      )}
      <Layout />
    </HashRouter>
    </ErrorBoundary>
  )
}

export default function App() {
  return <AppGate />
}
