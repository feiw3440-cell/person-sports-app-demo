// 线性图标库（PRD §9.2：图标线性统一）
import type { CSSProperties } from 'react'

const PATHS: Record<string, JSX.Element> = {
  home: (
    <path d="M4 11.2 12 4.8l8 6.4V19a1.2 1.2 0 0 1-1.2 1.2h-4.3v-5.4h-5v5.4H5.2A1.2 1.2 0 0 1 4 19z" />
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M15 9l-1.9 4.7L8.4 15.5l1.9-4.7z" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4.5h9V10a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6H5a2.6 2.6 0 0 0 2.6 3.4M16.5 6H19a2.6 2.6 0 0 1-2.6 3.4" />
      <path d="M12 14.5v3M9.5 20.5h5M10.2 17.5h3.6a1.8 1.8 0 0 1 1.8 1.8v1.2H8.4v-1.2a1.8 1.8 0 0 1 1.8-1.8z" />
    </>
  ),
  message: (
    <path d="M4.5 6.6A2.1 2.1 0 0 1 6.6 4.5h10.8a2.1 2.1 0 0 1 2.1 2.1v7.2a2.1 2.1 0 0 1-2.1 2.1H9.8l-4.4 3.9a.5.5 0 0 1-.9-.4z" />
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.5" />
      <path d="M5.2 19.6a7 7 0 0 1 13.6 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.4" />
      <path d="M19.8 19.8 15.6 15.6" />
    </>
  ),
  back: <path d="M14.5 5 8 12l6.5 7" />,
  'arrow-r': <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  heart: (
    <path d="M12 20s-7.2-4.5-9.3-8.9C1.3 8.4 3.3 5.4 6.5 5.4c2 0 3.7 1.2 4.5 2.8.8-1.6 2.5-2.8 4.5-2.8 3.2 0 5.2 3 3.8 5.7C19.2 15.5 12 20 12 20z" />
  ),
  star: <path d="M12 4.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16.3l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z" />,
  comment: <path d="M5 5.5h14a1 1 0 0 1 1 1v8.4a1 1 0 0 1-1 1H9.6L5.6 19.6a.6.6 0 0 1-1-.5V6.5a1 1 0 0 1 .4-1z" />,
  share: <path d="M12 14.5V4.5M8.2 8.3 12 4.5l3.8 3.8M5.5 13v5.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13" />,
  bell: (
    <>
      <path d="M6.2 15.8v-5a5.8 5.8 0 1 1 11.6 0v5l1.6 2.6H4.6z" />
      <path d="M10 21a2.3 2.3 0 0 0 4 0" />
    </>
  ),
  check: <path d="M5 12.6l4.3 4.2L19 7.2" />,
  shield: (
    <>
      <path d="M12 3.2 19 5.8v6c0 4.6-3 7.7-7 9.2-4-1.5-7-4.6-7-9.2v-6z" />
      <path d="M9.2 11.8l2.1 2.1 3.9-4" />
    </>
  ),
  filter: <path d="M4.5 6.5h15M7.5 12h9M10.5 17.5h3" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2.2" />
    </>
  ),
  location: (
    <>
      <path d="M12 20.6s6.3-5.5 6.3-9.9a6.3 6.3 0 1 0-12.6 0c0 4.4 6.3 9.9 6.3 9.9z" />
      <circle cx="12" cy="10.4" r="2.1" />
    </>
  ),
  play: <path d="M8.5 5.8v12.4L18.6 12z" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  eye: (
    <>
      <path d="M2.8 12S6.2 6 12 6s9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  flame: <path d="M12 3.6s4.6 3.8 4.6 8.4a4.6 4.6 0 0 1-9.2 0c0-1.8.9-3.2 1.9-4.2.1 1.7.9 2.6 1.8 2.9-.4-2.6.9-5.6.9-7.1z" />,
  medal: (
    <>
      <circle cx="12" cy="14.2" r="4.6" />
      <path d="M9.2 4 11 9.8M14.8 4 13 9.8" />
    </>
  ),
  chevdown: <path d="M6.5 9.5 12 15l5.5-5.5" />,
  doc: (
    <>
      <path d="M7 3.5h7.2l3.8 4v13H7z" />
      <path d="M14 3.5V8h4M9.5 12h5M9.5 15.5h5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.6" r="3.1" />
      <path d="M3.5 19a5.8 5.8 0 0 1 11 0" />
      <path d="M15.5 5.9a3.1 3.1 0 0 1 0 5.4M17.2 13.4a5.6 5.6 0 0 1 3.3 4.4" />
    </>
  ),
  building: (
    <>
      <path d="M5 20V6.2L12 4v16M12 20h7V10.4L12 8.6" />
      <path d="M8 9h1.5M8 12.5h1.5M15 12.5h1.5M15 16h1.5M9.5 20v-3h2v3" />
    </>
  ),
  calendar: (
    <>
      <rect x="4.5" y="5.5" width="15" height="15" rx="2" />
      <path d="M4.5 10h15M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 11v5M12 8v.2" />
    </>
  ),
  swap: <path d="M7.5 4.5 4 8l3.5 3.5M4 8h13M16.5 20 20 16.5 16.5 13M20 16.5H7" />,
  grid: (
    <>
      <rect x="4.5" y="4.5" width="6.4" height="6.4" rx="1.6" />
      <rect x="13.1" y="4.5" width="6.4" height="6.4" rx="1.6" />
      <rect x="4.5" y="13.1" width="6.4" height="6.4" rx="1.6" />
      <rect x="13.1" y="13.1" width="6.4" height="6.4" rx="1.6" />
    </>
  ),
  flash: <path d="M13 3 6 13.5h4.4L10 21l7-10.5h-4.4z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 2.2v3M12 18.8v3M2.2 12h3M18.8 12h3" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.5A2 2 0 0 1 6.5 4H19v14.5H6.8A2.3 2.3 0 0 0 4.5 21z" />
      <path d="M4.5 18.7A2.3 2.3 0 0 1 6.8 18.5H19" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.4 13 5.6a6.8 6.8 0 0 1 2.3 1l2.3-.8 1.7 3-1.7 1.7a6.9 6.9 0 0 1 0 2.9l1.7 1.7-1.7 3-2.3-.8a6.8 6.8 0 0 1-2.3 1L12 20.6 11 18.4a6.8 6.8 0 0 1-2.3-1l-2.3.8-1.7-3 1.7-1.7a6.9 6.9 0 0 1 0-2.9L4.7 9.9l1.7-3 2.3.8a6.8 6.8 0 0 1 2.3-1z" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.5" y="6" width="17" height="13" rx="2.5" />
      <path d="M3.5 9.5h17M16 14.2h1.6" />
    </>
  ),
  grad: (
    <>
      <path d="M3.5 9.2 12 5l8.5 4.2L12 13.5z" />
      <path d="M6.8 11v4.3c0 1.4 2.3 2.7 5.2 2.7s5.2-1.3 5.2-2.7V11M20 10v5" />
    </>
  ),
  clip: (
    <>
      <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
      <path d="M9 3.5h6v3H9zM9 11h6M9 14.5h4" />
    </>
  ),
  wrestle: (
    <>
      <circle cx="7" cy="5.5" r="1.9" />
      <circle cx="17" cy="5.5" r="1.9" />
      <path d="M7 7.8c-2 1.6-3.2 3.6-3.2 6M17 7.8c2 1.6 3.2 3.6 3.2 6M8.6 8.2l6.8 0M9.5 10.5l5-0.2" />
      <path d="M6.4 20.5c.6-3.4 2.6-5.4 5.6-5.4s5 2 5.6 5.4" />
    </>
  ),
  lock: (
    <>
      <rect x="6" y="10.5" width="12" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      <path d="M12 14.2v2.4" />
    </>
  ),
  thumb: (
    <>
      <path d="M7 10.5v9" />
      <path d="M7 11.5l3.2-6.8c.3-1.3 1.1-1.9 2.2-1.7 1 .2 1.6 1.1 1.5 2.3l-.4 3.2h4c1.3 0 2.1.9 1.9 2.1l-.9 5.3c-.2 1.2-1 2-2.3 2H7" />
    </>
  ),
  /* —— 首页快捷入口填充图标（白色填充 + 挖孔细节，垫在渐变圆角方块上） —— */
  trophyF: (
    <>
      <path d="M7.7 3.4h8.6a1 1 0 0 1 1 1v5.1a5.3 5.3 0 0 1-10.6 0V4.4a1 1 0 0 1 1-1z" />
      <path d="M7 5.4H4.3a3.1 3.1 0 0 0 3.4 3.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 5.4h2.7a3.1 3.1 0 0 1-3.4 3.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.9 14.5h2.2v2.9h-2.2z" />
      <path d="M7.7 17.6h8.6c.45 0 .8.36.8.8v1.1a.8.8 0 0 1-.8.8H7.7a.8.8 0 0 1-.8-.8v-1.1c0-.44.35-.8.8-.8z" />
    </>
  ),
  playF: (
    <path d="M9.3 6.9c0-1.6 1.7-2.6 3.1-1.8l7.7 4.5c1.4.8 1.4 2.9 0 3.7l-7.7 4.5c-1.4.8-3.1-.2-3.1-1.8z" />
  ),
  calF: (
    <>
      <path d="M7.6 2.5h1.7c.4 0 .7.3.7.7v2c0 .4-.3.7-.7.7H7.6a.7.7 0 0 1-.7-.7v-2c0-.4.3-.7.7-.7z" />
      <path d="M14.7 2.5h1.7c.4 0 .7.3.7.7v2c0 .4-.3.7-.7.7h-1.7a.7.7 0 0 1-.7-.7v-2c0-.4.3-.7.7-.7z" />
      <path
        fillRule="evenodd"
        d="M4.2 7.2A2.9 2.9 0 0 1 7.1 4.3h9.8a2.9 2.9 0 0 1 2.9 2.9v9.3a3.7 3.7 0 0 1-3.7 3.7H7.9a3.7 3.7 0 0 1-3.7-3.7zM8.7 11h1.9v1.9H8.7zm2.55 0h1.9v1.9h-1.9zm2.55 0h1.9v1.9h-1.9zM8.7 14.6h1.9v1.9H8.7zm2.55 0h1.9v1.9h-1.9zm2.55 0h1.9v1.9h-1.9z"
      />
    </>
  ),
  usersF: (
    <>
      <circle cx="16.3" cy="7.5" r="2.6" />
      <path d="M13.7 12.9a4.9 4.9 0 0 1 7.3 4.3v2.3h-3.2a7.2 7.2 0 0 0-4.1-6.6z" />
      <circle cx="8.7" cy="8.3" r="3.1" />
      <path d="M2.9 19.8a5.8 5.8 0 0 1 11.6 0z" />
    </>
  ),
  gradF: (
    <>
      <path d="M12 3.5 21.8 8.7 12 13.9 2.2 8.7z" />
      <path d="M6.3 11.2v3.3c0 1.9 2.6 3.4 5.7 3.4s5.7-1.5 5.7-3.4v-3.3L12 14.3z" />
      <path d="M20.7 9.6v4.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="20.7" cy="15.6" r="1.1" />
    </>
  ),
}

export default function Icon({
  name,
  size = 20,
  style,
  filled,
}: {
  name: string
  size?: number
  style?: CSSProperties
  filled?: boolean
}) {
  const path = PATHS[name]
  if (!path) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {path}
    </svg>
  )
}
