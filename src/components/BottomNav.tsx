// 底部导航 v4：首页 / 发现 / 发布(凸起居中) / TOP(奖杯) / 我的(人像)
// 消息入口收敛至各主页右上角铃铛（PRD 变更记录：应用户要求新增发布入口）
import { NavLink, useNavigate } from 'react-router-dom'

const NAVY = '#142A52'
const BLUE = '#005AFA'

function NavIcon({ tab, active }: { tab: string; active: boolean }) {
  const S = {
    fill: 'none',
    stroke: NAVY,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (tab === 'home') {
    if (active) {
      return (
        <svg width={25} height={25} viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            fill={BLUE}
            d="M12 3.4 20.6 10.4V19a1.7 1.7 0 0 1-1.7 1.7h-4.4v-6h-5v6H5.1A1.7 1.7 0 0 1 3.4 19v-8.6zM10.5 15.2h3v5.5h-3z"
          />
        </svg>
      )
    }
    return (
      <svg width={25} height={25} viewBox="0 0 24 24">
        <path {...S} d="M4.4 10.6 12 4.4l7.6 6.2V19a1.7 1.7 0 0 1-1.7 1.7H6.1A1.7 1.7 0 0 1 4.4 19z" />
        <rect {...S} x="10.2" y="14.6" width="3.6" height="6.1" rx="1" />
      </svg>
    )
  }

  if (tab === 'discover') {
    if (active) {
      return (
        <svg width={25} height={25} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.9" fill={BLUE} />
          <path fill="#fff" d="M15.9 8.1 13.6 13.6 8.1 15.9 10.4 10.4z" />
        </svg>
      )
    }
    return (
      <svg width={25} height={25} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.7" {...S} />
        <path {...S} d="M15.7 8.3 13.6 13.5 8.3 15.7 10.4 10.5z" />
      </svg>
    )
  }

  // top：奖杯（杯内白星，非活跃深藏青 / 激活蓝——与用户上传图标一致）
  if (tab === 'top') {
    const c = active ? BLUE : NAVY
    return (
      <svg width={25} height={25} viewBox="0 0 48 48">
        <path
          fill={c}
          fillRule="evenodd"
          d="M13.2 14.6a6.4 6.4 0 1 0 .1 12.9 6.4 6.4 0 0 0-.1-12.9zm.1 3a3.4 3.4 0 1 1-.1 6.8 3.4 3.4 0 0 1 .1-6.8z"
        />
        <path
          fill={c}
          fillRule="evenodd"
          d="M34.8 14.6a6.4 6.4 0 1 1-.1 12.9 6.4 6.4 0 0 1 .1-12.9zm-.1 3a3.4 3.4 0 1 0 .1 6.8 3.4 3.4 0 0 0-.1-6.8z"
        />
        <path fill={c} d="M15.3 11.2h17.4a2.3 2.3 0 0 1 2.3 2.3v7.4a11 11 0 0 1-22 0v-7.4a2.3 2.3 0 0 1 2.3-2.3z" />
        <path fill="#fff" d="m24 15.2 1.8 3.6 4 .6-2.9 2.82.7 3.98L24 23.3l-3.6 1.9.7-3.98-2.9-2.82 4-.6z" />
        <path fill={c} d="M22.4 30.4h3.2v3.4h-3.2z" />
        <path fill={c} d="M18.4 34h11.2a2.2 2.2 0 0 1 2.2 2.2v1.6H16.2v-1.6a2.2 2.2 0 0 1 2.2-2.2z" />
      </svg>
    )
  }

  // me：圆环头 + 半圆弧肩（与用户上传图标一致）
  if (active) {
    return (
      <svg width={25} height={25} viewBox="0 0 24 24">
        <circle cx="12" cy="8.2" r="4" fill={BLUE} />
        <path fill={BLUE} d="M4.7 20.8a7.3 7.3 0 0 1 14.6 0z" />
      </svg>
    )
  }
  return (
    <svg width={25} height={25} viewBox="0 0 24 24">
      <circle cx="12" cy="8.4" r="4" fill="none" stroke={NAVY} strokeWidth="2.4" />
      <path d="M4.7 20.6a7.3 7.3 0 0 1 14.6 0" fill="none" stroke={NAVY} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

const ITEMS = [
  { to: '/', tab: 'home', label: '首页' },
  { to: '/discover', tab: 'discover', label: '发现' },
  { to: '/top', tab: 'top', label: 'TOP' },
  { to: '/me', tab: 'me', label: '我的' },
]

export default function BottomNav() {
  const nav = useNavigate()
  return (
    <nav className="navbar navbar-v4">
      {/* 首页 */}
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        {({ isActive }) => (
          <>
            <NavIcon tab="home" active={isActive} />
            首页
          </>
        )}
      </NavLink>
      {/* 发现 */}
      <NavLink to="/discover" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <>
            <NavIcon tab="discover" active={isActive} />
            发现
          </>
        )}
      </NavLink>
      {/* 发布（凸起圆钮 + 下方文字，与原型一致） */}
      <button
        className="nav-publish"
        onClick={() => nav('/publish')}
        aria-label="发布"
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="np-label">发布</span>
      </button>
      {/* TOP */}
      <NavLink to="/top" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <>
            <NavIcon tab="top" active={isActive} />
            TOP
          </>
        )}
      </NavLink>
      {/* 我的 */}
      <NavLink to="/me" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <>
            <NavIcon tab="me" active={isActive} />
            我的
          </>
        )}
      </NavLink>
    </nav>
  )
}
