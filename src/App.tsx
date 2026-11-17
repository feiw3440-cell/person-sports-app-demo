import { useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import { ToastHost } from './components/ui'
import HomePage from './pages/HomePage'
import DiscoverPage from './pages/DiscoverPage'
import TopPage from './pages/TopPage'
import RankListPage from './pages/RankListPage'
import MessagesPage from './pages/MessagesPage'
import ProfilePage from './pages/ProfilePage'
import SearchPage from './pages/SearchPage'
import ListPage from './pages/ListPage'
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
import PublishPage from './pages/PublishPage'
import AboutPage from './pages/AboutPage'

const MAIN_PATHS = ['/', '/discover', '/publish', '/top', '/messages', '/me']

function Layout() {
  const loc = useLocation()
  const isMain = MAIN_PATHS.includes(loc.pathname)
  // 路由切换时重置滚动位置（二级页返回/进入详情从顶部开始）
  useEffect(() => {
    window.scrollTo(0, 0)
    // 渲染完成后兜底再滚一次，避免异步内容撑高导致残差
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
        <Route path="/publish" element={<PublishPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      {isMain && <BottomNav />}
      <ToastHost />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  )
}
