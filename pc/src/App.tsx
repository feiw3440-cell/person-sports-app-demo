import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import AppLayout from '@/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import WorkbenchPage from '@/pages/WorkbenchPage'
import ProjectsPage from '@/pages/ProjectsPage'
import PeoplePage from '@/pages/PeoplePage'
import CoursesPage from '@/pages/CoursesPage'
import MentorshipPage from '@/pages/MentorshipPage'
import CompetitionsPage from '@/pages/CompetitionsPage'
import OrgsPage from '@/pages/OrgsPage'
import ContentsPage from '@/pages/ContentsPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import AdminPage from '@/pages/AdminPage'
import SettingsPage from '@/pages/SettingsPage'
import SearchPage from '@/pages/SearchPage'

function RequireAuth({ children }: { children: React.ReactElement }) {
  const access = useAuth((s) => s.access)
  const location = useLocation()
  if (!access) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/" element={<WorkbenchPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/people/:id" element={<PeoplePage />} />
        <Route path="/training/courses" element={<CoursesPage />} />
        <Route path="/training/courses/:id" element={<CoursesPage />} />
        <Route path="/mentorship" element={<MentorshipPage />} />
        <Route path="/mentorship/authorizations/:id" element={<MentorshipPage />} />
        <Route path="/competitions" element={<CompetitionsPage />} />
        <Route path="/competitions/:id" element={<CompetitionsPage />} />
        <Route path="/orgs" element={<OrgsPage />} />
        <Route path="/orgs/:id" element={<OrgsPage />} />
        <Route path="/contents" element={<ContentsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/search" element={<SearchPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
