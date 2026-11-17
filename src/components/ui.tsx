// 基础 UI 组件：头像、封面、徽章、空态、Sheet、Toast 等
import type { ReactNode, CSSProperties } from 'react'
import { useApp } from '../store/store'
import Icon from './Icon'
import type { VerifyStatus } from '../types'

/* 抽象运动员图形（呼应视觉稿插画风格） */
export function SportGlyph({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden>
      <circle cx="37" cy="13" r="6.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" fill="none">
        <path d="M34 23 30 39" />
        <path d="M33 27 16 35" />
        <path d="M33 26 49 17" />
        <path d="M30 39 18 53" />
        <path d="M30 39 44 49" />
      </g>
    </svg>
  )
}

export function Avatar({ name, color, size = 'md', photo }: { name: string; color: string; size?: 'sm' | 'md' | 'lg' | 'xl'; photo?: string }) {
  if (photo) {
    return (
      <div className={`avatar avatar-${size}`} style={{ background: '#dfe8f5', overflow: 'hidden', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.5)' }}>
        <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }
  return (
    <div className={`avatar avatar-${size}`} style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}>
      {name.slice(0, 1)}
    </div>
  )
}

/* 专体品牌 Logo（奔跑人形 + 双行字标） */
export function BrandLogo({ light, small }: { light?: boolean; small?: boolean }) {
  const c = light ? '#fff' : 'var(--blue-strong)'
  return (
    <div className="flex gap6" style={{ color: light ? '#fff' : 'var(--blue-strong)' }}>
      <svg width={small ? 26 : 34} height={small ? 26 : 34} viewBox="0 0 24 24" fill={c} aria-hidden>
        <circle cx="15.2" cy="4.6" r="2.3" />
        <g stroke={c} strokeWidth="2.1" strokeLinecap="round" fill="none">
          <path d="M14 8.6 15.8 13" />
          <path d="M14.2 9.6 8.8 11.4" />
          <path d="M14.9 9.4 19.4 6.8" />
          <path d="M15.8 13 11.6 19.4" />
          <path d="M15.8 13 20.2 16.2" />
        </g>
      </svg>
      <div style={{ lineHeight: 1.05 }}>
        <div style={{ fontSize: small ? 15 : 18, fontWeight: 900, letterSpacing: 1 }}>专体</div>
        <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, opacity: 0.85 }}>PERSON SPORTS</div>
      </div>
    </div>
  )
}

/* 渐变封面：抽象图形 + 装饰圆 */
export function Cover({
  colorA,
  colorB,
  children,
  className = '',
  style,
  glyph = true,
}: {
  colorA: string
  colorB: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
  glyph?: boolean
}) {
  return (
    <div className={`cover ${className}`} style={{ background: `linear-gradient(120deg, ${colorA}, ${colorB})`, ...style }}>
      <div className="blob" style={{ width: 90, height: 90, left: -26, top: -30 }} />
      <div className="blob" style={{ width: 46, height: 46, right: 76, bottom: -16 }} />
      {glyph && <SportGlyph className="glyph" />}
      {children}
    </div>
  )
}

/* 核验徽章：核验状态必须有来源语义（PRD §5.5） */
export function VerifyBadge({ verify, appeal }: { verify: VerifyStatus; appeal?: boolean }) {
  if (appeal) return <span className="badge badge-appealing">申诉处理中</span>
  if (verify === 'verified')
    return (
      <span className="badge badge-verified">
        <Icon name="shield" size={10} /> 已核验
      </span>
    )
  if (verify === 'unverified') return <span className="badge badge-unverified">未核验</span>
  return <span className="badge badge-pending">待核验</span>
}

/* 模拟数据标签（PRD §9.3：所有模拟数据须明确标注） */
export function MockTag({ text = '模拟数据' }: { text?: string }) {
  return <span className="badge badge-mock">{text}</span>
}

/* 渐变火焰（emoji 风格：外焰橙红渐变 + 内焰亮黄） */
export function FlameGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="ztFlameGrad" x1="0.2" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#f43f1e" />
          <stop offset="0.55" stopColor="#fb6b1d" />
          <stop offset="1" stopColor="#ffa02e" />
        </linearGradient>
      </defs>
      <path
        fill="url(#ztFlameGrad)"
        d="M12 1.9c.25 2.85 1.5 4.7 3 6.45 1.45 1.65 2.55 3.25 2.55 5.65a5.55 5.55 0 1 1-11.1 0c0-1.8.75-3.25 1.75-4.6.95-1.3 2-2.5 2.5-4.05.45-1.35.65-2.55.6-3.45.5.15 1.05.55 1.7 0z"
      />
      <path
        fill="#ffe0a3"
        d="M12 10.1c-.15 1.7-.85 2.75-1.75 3.75-.7.8-1.2 1.5-1.2 2.6a2.95 2.95 0 1 0 5.9 0c0-1.1-.5-1.85-1.1-2.65-.7-.95-1.5-2-1.85-3.7z"
      />
    </svg>
  )
}

/* 名次奖牌（绶带 + 渐变圆牌 + 名次数字，金银铜三色） */
const MEDAL_PALETTE: Record<1 | 2 | 3, { g1: string; g2: string; rb: string }> = {
  1: { g1: '#ffe07e', g2: '#ef9e1d', rb: '#e59114' },
  2: { g1: '#eaf1f9', g2: '#9db1c9', rb: '#a9bdd3' },
  3: { g1: '#f7cba4', g2: '#c97e3d', rb: '#be7131' },
}

export function RankMedal({ rank, size = 30 }: { rank: 1 | 2 | 3; size?: number }) {
  const p = MEDAL_PALETTE[rank]
  const gid = `ztMedalGrad${rank}`
  return (
    <svg width={size} height={size + 6} viewBox="0 0 30 36" aria-hidden style={{ flex: 'none' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.g1} />
          <stop offset="1" stopColor={p.g2} />
        </linearGradient>
      </defs>
      {/* 绶带 */}
      <path d="M7.4 1h5.6l2.5 10.8H9.9z" fill={p.rb} />
      <path d="M22.6 1h-5.6l-2.5 10.8h5.6z" fill={p.rb} opacity="0.85" />
      {/* 牌体 */}
      <circle cx="15" cy="22.6" r="11.8" fill={`url(#${gid})`} />
      <circle cx="15" cy="22.6" r="10.9" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.4" />
      <text x="15" y="27.2" textAnchor="middle" fontSize="13.5" fontWeight="900" fill="#ffffff">
        {rank}
      </text>
    </svg>
  )
}

/* 首页快捷图标：1:1 还原原型（彩色渐变图形直接呈现，无底板） */
export type QuickGlyphType = 'top' | 'video' | 'event' | 'athlete' | 'mentor'

/* 发现页分类图标：1:1 还原原型（蓝色渐变填充图形） */
export type DiscoverGlyphType =
  | 'wrestle'
  | 'video'
  | 'athlete'
  | 'coach'
  | 'course'
  | 'event'
  | 'school'
  | 'club'

export function DiscoverGlyph({ type, size = 40 }: { type: DiscoverGlyphType; size?: number }) {
  const gid = `ztDg-${type}`
  const blue = (
    <linearGradient id={gid} x1="0.25" y1="0" x2="0.75" y2="1">
      <stop offset="0" stopColor="#3F8BFF" />
      <stop offset="1" stopColor="#005AF0" />
    </linearGradient>
  )
  const B = `url(#${gid})`

  if (type === 'wrestle') {
    // 两个弯身角力的人（头相触、手臂中央互握、双腿外蹬）
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <circle cx="19.2" cy="9.8" r="3.9" fill={B} />
        <circle cx="28.8" cy="9.8" r="3.9" fill={B} />
        {/* 左人（躯干+腿，圆角矩形旋转拼合） */}
        <rect x="9.6" y="15.5" width="9.5" height="17" rx="4.5" fill={B} transform="rotate(16 14.3 17)" />
        <rect x="6.2" y="29" width="9" height="15" rx="4.2" fill={B} transform="rotate(10 10.7 31.5)" />
        <rect x="16.5" y="30.5" width="9" height="14" rx="4.2" fill={B} transform="rotate(-14 21 32.5)" />
        {/* 右人（镜像） */}
        <rect x="28.9" y="15.5" width="9.5" height="17" rx="4.5" fill={B} transform="rotate(-16 33.6 17)" />
        <rect x="32.8" y="29" width="9" height="15" rx="4.2" fill={B} transform="rotate(-10 37.3 31.5)" />
        <rect x="22.5" y="30.5" width="9" height="14" rx="4.2" fill={B} transform="rotate(14 27 32.5)" />
        {/* 中央互握手臂 */}
        <rect x="17.5" y="23.4" width="13" height="5.6" rx="2.8" fill={B} transform="rotate(-8 24 26.2)" />
      </svg>
    )
  }
  if (type === 'video') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <rect x="7.5" y="9" width="33" height="33" rx="9.5" fill={B} />
        <path fill="#fff" d="M20 19.3c0-1.7 1.85-2.7 3.3-1.85l8.6 5c1.45.85 1.45 2.95 0 3.8l-8.6 5c-1.45.85-3.3-.15-3.3-1.85z" />
      </svg>
    )
  }
  if (type === 'athlete') {
    // 半身人像：头 + 圆肩身体
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <circle cx="24" cy="14.5" r="7" fill={B} />
        <path fill={B} d="M10.5 38.5a13.5 13.5 0 0 1 27 0z" />
      </svg>
    )
  }
  if (type === 'coach') {
    // 教练/导师：半身人像 + 白色 V 领 + 领带
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <circle cx="24" cy="14" r="7" fill={B} />
        <path fill={B} d="M10.5 38.5a13.5 13.5 0 0 1 27 0z" />
        <path fill="#fff" d="M18.6 27.2 24 34.6l5.4-7.4v3.4L24 38.6l-5.4-8z" />
        <path fill={B} d="M22.9 28.9h2.2l1.3 5.4-2.4 2.6-2.4-2.6z" />
      </svg>
    )
  }
  if (type === 'course') {
    // 学士帽（帽板白菱孔 + 帽身 + 流苏 + 底座）
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <path fill={B} d="M14.8 23.2 24 27.8l9.2-4.6v5.3a9.2 6.1 0 0 1-18.4 0z" />
        <path d="M43.6 18.6v8.2" stroke={B} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <circle cx="43.6" cy="29" r="2.5" fill={B} />
        <path fill={B} d="M24 7.6 45 17.7 24 27.8 3 17.7z" />
        <path fill="#fff" d="m24 15.5 3.9 2.2L24 19.9l-3.9-2.2z" />
        <path fill={B} d="M16.6 42.6a7.6 5.8 0 0 1 15.2 0z" />
      </svg>
    )
  }
  if (type === 'event') {
    // 奖杯（杯内白星 + 把手 + 底座）
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <path
          fill={B}
          fillRule="evenodd"
          d="M13.2 14.6a6.4 6.4 0 1 0 .1 12.9 6.4 6.4 0 0 0-.1-12.9zm.1 3a3.4 3.4 0 1 1-.1 6.8 3.4 3.4 0 0 1 .1-6.8z"
        />
        <path
          fill={B}
          fillRule="evenodd"
          d="M34.8 14.6a6.4 6.4 0 1 1-.1 12.9 6.4 6.4 0 0 1 .1-12.9zm-.1 3a3.4 3.4 0 1 0 .1 6.8 3.4 3.4 0 0 0-.1-6.8z"
        />
        <path fill={B} d="M15.3 11.2h17.4a2.3 2.3 0 0 1 2.3 2.3v7.4a11 11 0 0 1-22 0v-7.4a2.3 2.3 0 0 1 2.3-2.3z" />
        <path fill="#fff" d="m24 15.2 1.8 3.6 4 .6-2.9 2.82.7 3.98L24 23.3l-3.6 1.9.7-3.98-2.9-2.82 4-.6z" />
        <path fill={B} d="M22.4 30.4h3.2v3.4h-3.2z" />
        <path fill={B} d="M18.4 34h11.2a2.2 2.2 0 0 1 2.2 2.2v1.6H16.2v-1.6a2.2 2.2 0 0 1 2.2-2.2z" />
      </svg>
    )
  }
  if (type === 'school') {
    // 体育学校：山形顶 + 檐 + 三柱 + 底台
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <path fill={B} d="M24 5.5 42.5 15H5.5z" />
        <rect x="4.5" y="16.5" width="39" height="3.6" rx="1.8" fill={B} />
        <rect x="10" y="22" width="5.4" height="13.5" rx="1.6" fill={B} />
        <rect x="21.3" y="22" width="5.4" height="13.5" rx="1.6" fill={B} />
        <rect x="32.6" y="22" width="5.4" height="13.5" rx="1.6" fill={B} />
        <rect x="6.5" y="37" width="35" height="4.5" rx="2.2" fill={B} />
      </svg>
    )
  }
  // club：盾牌 + 白星
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>{blue}</defs>
      <path
        fill={B}
        d="M24 3.6 41 9.3v11.9c0 10.9-7 18.6-17 22.9-10-4.3-17-12-17-22.9V9.3z"
      />
      <path fill="#fff" d="m24 15.4 2.5 5 5.5.8-4 3.9.95 5.5L24 28l-4.95 2.6.95-5.5-4-3.9 5.5-.8z" />
    </svg>
  )
}

/* 我的页面「我的功能」图标：1:1 还原原型（彩色渐变填充图形） */
export type FuncGlyphType =
  | 'home'
  | 'course'
  | 'event'
  | 'favs'
  | 'order'
  | 'handshake'
  | 'auth'
  | 'review'
  | 'wallet'
  | 'gear'

export function FuncGlyph({ type, size = 40 }: { type: FuncGlyphType; size?: number }) {
  const gid = `ztFn-${type}`
  const blue = (
    <linearGradient id={gid} x1="0.25" y1="0" x2="0.75" y2="1">
      <stop offset="0" stopColor="#3F8BFF" />
      <stop offset="1" stopColor="#0A5CF0" />
    </linearGradient>
  )
  const B = `url(#${gid})`

  if (type === 'home') {
    // 半身人像 + 胸前白色菱形徽标
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <circle cx="24" cy="13.5" r="7.2" fill={B} />
        <path fill={B} d="M9.8 37.2a14.2 14.2 0 0 1 28.4 0z" />
        <path fill="#fff" d="m24 26.6 3 3-3 3-3-3z" />
      </svg>
    )
  }
  if (type === 'course') {
    // 翡翠绿视频播放（浅层错位 + 渐变方块 + 白色圆角三角）
    const teal = (
      <linearGradient id={gid} x1="0.25" y1="0" x2="0.75" y2="1">
        <stop offset="0" stopColor="#2BD9A4" />
        <stop offset="1" stopColor="#00C184" />
      </linearGradient>
    )
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{teal}</defs>
        <rect x="16.5" y="6" width="26" height="26" rx="8" fill="#A9EBD4" opacity="0.9" />
        <rect x="9.5" y="13" width="28" height="28" rx="8.5" fill={`url(#${gid})`} />
        <path fill="#fff" d="M20.8 21.6c0-1.5 1.65-2.4 2.95-1.65l7.3 4.2a1.9 1.9 0 0 1 0 3.3l-7.3 4.2c-1.3.75-2.95-.15-2.95-1.65z" />
      </svg>
    )
  }
  if (type === 'event') {
    // 橙色奖杯 + 白星（杯耳 + 颈 + 底座）
    const orange = (
      <linearGradient id={gid} x1="0.25" y1="0" x2="0.75" y2="1">
        <stop offset="0" stopColor="#FFC24D" />
        <stop offset="1" stopColor="#FF9920" />
      </linearGradient>
    )
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{orange}</defs>
        <path
          fill={`url(#${gid})`}
          fillRule="evenodd"
          d="M15.4 8.4a6.6 6.6 0 1 0 .1 13.3 6.6 6.6 0 0 0-.1-13.3zm.1 3.2a3.5 3.5 0 1 1-.1 7 3.5 3.5 0 0 1 .1-7z"
        />
        <path
          fill={`url(#${gid})`}
          fillRule="evenodd"
          d="M32.6 8.4a6.6 6.6 0 1 1-.1 13.3 6.6 6.6 0 0 1 .1-13.3zm-.1 3.2a3.5 3.5 0 1 0 .1 7 3.5 3.5 0 0 0-.1-7z"
        />
        <path fill={`url(#${gid})`} d="M16.3 5.4h15.4a2.3 2.3 0 0 1 2.3 2.3v7.8a10 10 0 0 1-20 0V7.7a2.3 2.3 0 0 1 2.3-2.3z" />
        <path
          fill="#fff"
          d="m24 11.8 1.8 3.6 4 .6-2.9 2.82.7 3.98L24 19.9l-3.6 1.9.7-3.98-2.9-2.82 4-.6z"
        />
        <path fill={`url(#${gid})`} d="M22.6 28.6h2.8v3.4h-2.8z" />
        <path fill={`url(#${gid})`} d="M18.6 32.2h10.8a2.2 2.2 0 0 1 2.2 2.2v1.8H16.4v-1.8a2.2 2.2 0 0 1 2.2-2.2z" />
      </svg>
    )
  }
  if (type === 'favs') {
    // 紫色圆角星 + 中心白色小星
    const purple = (
      <linearGradient id={gid} x1="0.25" y1="0" x2="0.75" y2="1">
        <stop offset="0" stopColor="#A08CFF" />
        <stop offset="1" stopColor="#6C4EE0" />
      </linearGradient>
    )
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{purple}</defs>
        <path
          fill={`url(#${gid})`}
          stroke={`url(#${gid})`}
          strokeWidth="3.4"
          strokeLinejoin="round"
          d="m24 6.5 5 10.1 11.2 1.6-8.1 7.9 1.9 11.1L24 31.9l-10 5.3 1.9-11.1-8.1-7.9 11.2-1.6z"
        />
        <path
          fill="#fff"
          d="m24 20.3 1.5 3 3.3.5-2.4 2.3.55 3.35L24 27.9l-2.95 1.55.55-3.35-2.4-2.3 3.3-.5z"
        />
      </svg>
    )
  }
  if (type === 'order') {
    // 蓝色记事板 + 顶部夹子 + 白色条目
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <rect x="18.5" y="4.5" width="11" height="6" rx="3" fill="#0A5CF0" />
        <circle cx="24" cy="7.5" r="1.8" fill="#fff" />
        <rect x="9.5" y="8" width="29" height="33" rx="6.5" fill={B} />
        <rect x="15.5" y="18" width="17" height="3.4" rx="1.7" fill="#fff" />
        <rect x="15.5" y="24.6" width="17" height="3.4" rx="1.7" fill="#fff" />
        <rect x="15.5" y="31.2" width="10.5" height="3.4" rx="1.7" fill="#fff" />
      </svg>
    )
  }
  if (type === 'handshake') {
    // 蓝色握手（双臂相交 + 中央扣手 + 白色指缝）
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <rect x="1.5" y="17.5" width="21" height="11.5" rx="5.5" fill={B} transform="rotate(14 12 23)" />
        <rect x="25.5" y="17.5" width="21" height="11.5" rx="5.5" fill={B} transform="rotate(-14 36 23)" />
        <rect x="16.5" y="19.5" width="15" height="14" rx="6" fill={B} />
        <rect x="20.9" y="21.5" width="1.7" height="9" rx="0.85" fill="#fff" opacity="0.95" />
        <rect x="23.6" y="21.5" width="1.7" height="9" rx="0.85" fill="#fff" opacity="0.95" />
        <rect x="26.3" y="21.5" width="1.7" height="9" rx="0.85" fill="#fff" opacity="0.95" />
      </svg>
    )
  }
  if (type === 'auth') {
    // 紫色盾牌 + 白色对勾
    const purple = (
      <linearGradient id={gid} x1="0.25" y1="0" x2="0.75" y2="1">
        <stop offset="0" stopColor="#8B6CFF" />
        <stop offset="1" stopColor="#6C4EE0" />
      </linearGradient>
    )
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{purple}</defs>
        <path fill={`url(#${gid})`} d="M24 4 40.5 9.7v11.9c0 10.9-7 18.6-16.5 22.8C14.5 40.2 7.5 32.5 7.5 21.6V9.7z" />
        <path d="M16.8 23.6l5.3 5.3 9.6-10.2" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (type === 'review') {
    // 橙色气泡 + 白色三点
    const orange = (
      <linearGradient id={gid} x1="0.25" y1="0" x2="0.75" y2="1">
        <stop offset="0" stopColor="#FFA53B" />
        <stop offset="1" stopColor="#FF8A1E" />
      </linearGradient>
    )
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{orange}</defs>
        <rect x="4.5" y="7" width="39" height="26.5" rx="8.5" fill={`url(#${gid})`} />
        <path fill={`url(#${gid})`} d="M13.5 32.5v9.5l10-9.5z" />
        <circle cx="15.5" cy="20.2" r="2.7" fill="#fff" />
        <circle cx="24" cy="20.2" r="2.7" fill="#fff" />
        <circle cx="32.5" cy="20.2" r="2.7" fill="#fff" />
      </svg>
    )
  }
  if (type === 'wallet') {
    // 蓝色钱包 + 深色翻盖 + 白色卡槽与搭扣
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        <rect x="5" y="11.5" width="38" height="27.5" rx="7" fill={B} />
        <path fill="#0A5CF0" d="M5 18.5c0-3.9 3.1-7 7-7h24a7 7 0 0 1 7 7v2.2H5z" opacity="0.55" />
        <rect x="11.5" y="25.2" width="14" height="3.4" rx="1.7" fill="#fff" />
        <circle cx="36.5" cy="26.5" r="3.1" fill="#fff" />
      </svg>
    )
  }
  // gear：灰色齿轮（8 齿 + 中心孔）
  const gray = (
    <linearGradient id={gid} x1="0.25" y1="0" x2="0.75" y2="1">
      <stop offset="0" stopColor="#8E9BB0" />
      <stop offset="1" stopColor="#5E6D84" />
    </linearGradient>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>{gray}</defs>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <rect key={a} x="20.6" y="3.5" width="6.8" height="9" rx="2.4" fill={`url(#${gid})`} transform={`rotate(${a} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="13.6" fill={`url(#${gid})`} />
      <circle cx="24" cy="24" r="5.6" fill="#fff" />
    </svg>
  )
}

export function QuickGlyph({ type, size = 46 }: { type: QuickGlyphType; size?: number }) {
  const gid = `ztQg-${type}`
  const blue = (
    <linearGradient id={gid} x1="0.25" y1="0" x2="0.75" y2="1">
      <stop offset="0" stopColor="#3F8BFF" />
      <stop offset="1" stopColor="#0A5CF0" />
    </linearGradient>
  )
  if (type === 'top') {
    // 蓝色奖杯 + 白色五角星 + 两侧圆环把手
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{blue}</defs>
        {/* 把手（竖直椭圆环） */}
        <path
          fill={`url(#${gid})`}
          fillRule="evenodd"
          d="M13.2 14.6a6.4 6.4 0 1 0 .1 12.9 6.4 6.4 0 0 0-.1-12.9zm.1 3a3.4 3.4 0 1 1-.1 6.8 3.4 3.4 0 0 1 .1-6.8z"
        />
        <path
          fill={`url(#${gid})`}
          fillRule="evenodd"
          d="M34.8 14.6a6.4 6.4 0 1 1-.1 12.9 6.4 6.4 0 0 1 .1-12.9zm-.1 3a3.4 3.4 0 1 0 .1 6.8 3.4 3.4 0 0 0-.1-6.8z"
        />
        {/* 杯体 */}
        <path
          fill={`url(#${gid})`}
          d="M15.3 11.2h17.4a2.3 2.3 0 0 1 2.3 2.3v7.4a11 11 0 0 1-22 0v-7.4a2.3 2.3 0 0 1 2.3-2.3z"
        />
        {/* 白星 */}
        <path
          fill="#fff"
          d="m24 15.2 1.8 3.6 4 .6-2.9 2.82.7 3.98L24 23.3l-3.6 1.9.7-3.98-2.9-2.82 4-.6z"
        />
        {/* 颈 + 底座 */}
        <path fill={`url(#${gid})`} d="M22.4 30.4h3.2v3.4h-3.2z" />
        <path fill={`url(#${gid})`} d="M18.4 34h11.2a2.2 2.2 0 0 1 2.2 2.2v1.6H16.2v-1.6a2.2 2.2 0 0 1 2.2-2.2z" />
      </svg>
    )
  }
  if (type === 'video') {
    // 浅蓝底板（右上错位）+ 渐变主方块 + 白色圆角播放三角
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <rect x="16" y="5.5" width="27" height="27" rx="8.5" fill="#C6D9FF" opacity="0.9" />
        <defs>{blue}</defs>
        <rect x="9" y="13" width="29" height="29" rx="9" fill={`url(#${gid})`} />
        <path fill="#fff" d="M20.6 21.7c0-1.5 1.65-2.4 2.95-1.65l7.6 4.4a1.9 1.9 0 0 1 0 3.3l-7.6 4.4c-1.3.75-2.95-.15-2.95-1.65z" />
      </svg>
    )
  }
  if (type === 'event') {
    // 橙色日历：双钉 + 渐变主体 + 白色 3×2 圆角网格
    const orange = (
      <linearGradient id={gid} x1="0.25" y1="0" x2="0.75" y2="1">
        <stop offset="0" stopColor="#FCAC42" />
        <stop offset="1" stopColor="#F97F14" />
      </linearGradient>
    )
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{orange}</defs>
        <rect x="14.6" y="5" width="4.2" height="9" rx="2.1" fill="#FB9322" />
        <rect x="29.2" y="5" width="4.2" height="9" rx="2.1" fill="#FB9322" />
        <rect x="7" y="10.5" width="34" height="30" rx="7.5" fill={`url(#${gid})`} />
        {[0, 1, 2].map((c) => (
          <rect key={`r1${c}`} x={12.1 + c * 9.3} y="18.3" width="8.2" height="6.3" rx="2" fill="#fff" />
        ))}
        {[0, 1, 2].map((c) => (
          <rect key={`r2${c}`} x={12.1 + c * 9.3} y="27.3" width="8.2" height="6.3" rx="2" fill="#fff" />
        ))}
      </svg>
    )
  }
  if (type === 'athlete') {
    // 翡翠绿双人（右后人在后偏上，左前人头带白色高光孔）
    const green = (
      <linearGradient id={gid} x1="0.3" y1="0" x2="0.7" y2="1">
        <stop offset="0" stopColor="#3EE0AC" />
        <stop offset="1" stopColor="#00C184" />
      </linearGradient>
    )
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>{green}</defs>
        {/* 右后人 */}
        <circle cx="31" cy="16.5" r="6.2" fill={`url(#${gid})`} opacity="0.95" />
        <path fill={`url(#${gid})`} opacity="0.95" d="M22.8 33.6a8.6 8.6 0 0 1 17.2 0z" />
        {/* 左前人 */}
        <circle cx="17.8" cy="16.4" r="7.6" fill={`url(#${gid})`} />
        <ellipse cx="18" cy="16.2" rx="2.4" ry="1.5" fill="#fff" transform="rotate(-12 18 16.2)" />
        <path fill={`url(#${gid})`} d="M5.4 36.4a12.4 12.4 0 0 1 24.8 0z" />
      </svg>
    )
  }
  // mentor：蓝色学士帽（菱形帽板带白菱孔 + 帽身 + 流苏 + 底座）
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>{blue}</defs>
      {/* 帽身 */}
      <path fill={`url(#${gid})`} d="M14.8 23.2 24 27.8l9.2-4.6v5.3a9.2 6.1 0 0 1-18.4 0z" />
      {/* 流苏 */}
      <path d="M43.6 18.6v8.2" stroke={`url(#${gid})`} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="43.6" cy="29" r="2.5" fill={`url(#${gid})`} />
      {/* 帽板（后画，覆盖帽身上缘） */}
      <path fill={`url(#${gid})`} d="M24 7.6 45 17.7 24 27.8 3 17.7z" />
      <path fill="#fff" d="m24 15.5 3.9 2.2L24 19.9l-3.9-2.2z" />
      {/* 底座 */}
      <path fill={`url(#${gid})`} d="M16.6 42.6a7.6 5.8 0 0 1 15.2 0z" />
    </svg>
  )
}

export function SectionHeader({ title, sub, moreText = '更多', onMore }: { title: string; sub?: string; moreText?: string; onMore?: () => void }) {
  return (
    <div className="sec-head">
      <div className="flex">
        <div className="sec-title">{title}</div>
        {sub && <div className="sec-sub">{sub}</div>}
      </div>
      {onMore && (
        <button className="sec-more" onClick={onMore}>
          {moreText} <Icon name="arrow-r" size={12} />
        </button>
      )}
    </div>
  )
}

/* 胶囊 chips（可横滑） */
export function Chips({
  options,
  value,
  onChange,
  dotColors,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (k: string) => void
  dotColors?: Record<string, string>
}) {
  return (
    <div className="chip-row">
      {options.map((o) => (
        <button key={o.key} className={`chip ${value === o.key ? 'active' : ''}`} onClick={() => onChange(o.key)}>
          {dotColors && dotColors[o.key] && <span className="chip-dot" style={{ background: dotColors[o.key] }} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  small,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
  small?: boolean
}) {
  return (
    <div className={`seg ${small ? 'seg-sm' : ''}`}>
      {options.map((o) => (
        <button key={o.key} className={`seg-item ${value === o.key ? 'active' : ''}`} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* 底部抽屉 */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <>
      <div className="sheet-mask" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-head">
          <div className="sh-title">{title}</div>
          <button className="icon-btn" onClick={onClose} style={{ width: 32, height: 32 }}>
            <Icon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

/* 空态 */
export function EmptyState({ title, desc, icon = 'grid', action }: { title: string; desc?: string; icon?: string; action?: ReactNode }) {
  return (
    <div className="state-box">
      <div className="sb-icon">
        <Icon name={icon} size={30} />
      </div>
      <div className="sb-title">{title}</div>
      {desc && <div className="sb-desc">{desc}</div>}
      {action && <div className="mt12">{action}</div>}
    </div>
  )
}

/* 加载骨架（首页信息流模拟加载） */
export function FeedSkeleton() {
  return (
    <div className="grid2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i}>
          <div className="skeleton" style={{ height: 96, borderRadius: 14 }} />
          <div className="skeleton mt8" style={{ height: 14, width: '88%' }} />
          <div className="skeleton mt4" style={{ height: 12, width: '55%' }} />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="row-item">
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 14, width: '55%' }} />
            <div className="skeleton mt4" style={{ height: 11, width: '80%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* 错误/无网络原型 */
export function ErrorState({ desc = '网络似乎不太顺畅，演示环境可稍后重试。', onRetry }: { desc?: string; onRetry?: () => void }) {
  return (
    <div className="state-box">
      <div className="sb-icon">
        <Icon name="flash" size={30} />
      </div>
      <div className="sb-title">加载失败</div>
      <div className="sb-desc">{desc}</div>
      {onRetry && (
        <div className="mt12">
          <button className="btn btn-primary btn-sm" onClick={onRetry}>
            重试
          </button>
        </div>
      )}
    </div>
  )
}

/* Toast 宿主 */
export function ToastHost() {
  const toasts = useApp((s) => s.toasts)
  if (!toasts.length) return null
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.msg}
        </div>
      ))}
    </div>
  )
}

/* 演示数据页脚声明 */
export function MockFooter({ text }: { text?: string }) {
  return (
    <div className="footer-note">
      {text || '本页面的账号、数据、状态均为演示模拟数据 · 专体 PERSON SPORTS 高保真交互演示'}
      <br />
      本阶段不含商城、商品与交易功能
    </div>
  )
}

export function InfoRow({ icon, label, value }: { icon?: string; label: string; value: ReactNode }) {
  return (
    <div className="kv">
      <span className="k">
        {icon && <Icon name={icon} size={13} />}
        {label}
      </span>
      <span className="v">{value}</span>
    </div>
  )
}
