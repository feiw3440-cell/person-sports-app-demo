// 二级页通用返回头
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'

export default function DetailHeader({ title, sub, transparent }: { title: string; sub?: string; transparent?: boolean }) {
  const nav = useNavigate()
  return (
    <div className="topbar" style={transparent ? { background: 'transparent', boxShadow: 'none' } : undefined}>
      <button className="icon-btn" onClick={() => nav(-1)} aria-label="返回">
        <Icon name="back" size={19} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="title ellipsis1" style={{ fontSize: 16 }}>
          {title}
        </div>
        {sub && <div className="sub ellipsis1">{sub}</div>}
      </div>
    </div>
  )
}
