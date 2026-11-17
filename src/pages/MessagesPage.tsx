// 消息页 v2：一比一还原高保真原型
// 结构：品牌顶栏 → 五分类切换 → 品牌横幅 → 消息列表（互动/系统/业务/师徒/授权） → 已加载全部
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MESSAGES } from '../data/db'
import { useApp } from '../store/store'
import type { MsgItem } from '../types'
import Icon from '../components/Icon'
import { BrandLogo, EmptyState, MockFooter } from '../components/ui'

type Cat = 'all' | 'system' | 'interact' | 'biz' | 'mentor'

const CATS: { key: Cat; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'system', label: '系统通知' },
  { key: 'interact', label: '互动消息' },
  { key: 'biz', label: '业务通知' },
  { key: 'mentor', label: '师徒消息' },
]

const KIND_STYLE: Record<MsgItem['kind'], { icon: string; bg: string }> = {
  system: { icon: 'bell', bg: 'linear-gradient(160deg,#4d9bff,#1677ff)' },
  follow: { icon: 'user', bg: 'linear-gradient(160deg,#3f8bff,#0765fe)' },
  like: { icon: 'thumb', bg: 'linear-gradient(160deg,#5aa0ff,#2e7cf6)' },
  comment: { icon: 'comment', bg: 'linear-gradient(160deg,#5aa0ff,#2e6be6)' },
  dm: { icon: 'comment', bg: 'linear-gradient(160deg,#5aa0ff,#2e6be6)' },
  course: { icon: 'calendar', bg: 'linear-gradient(160deg,#ffb14e,#ff8a1e)' },
  event: { icon: 'trophy', bg: 'linear-gradient(160deg,#9b7bff,#7c5ce0)' },
  mentorship: { icon: 'users', bg: 'linear-gradient(160deg,#3ed488,#17b26a)' },
  auth: { icon: 'shield', bg: 'linear-gradient(160deg,#5aa0ff,#2e7cf6)' },
}

export default function MessagesPage() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [cat, setCat] = useState<Cat>((sp.get('cat') as Cat) || 'all')
  const readMsgs = useApp((s) => s.readMsgs)
  const markRead = useApp((s) => s.markRead)
  const pushToast = useApp((s) => s.pushToast)

  // 支持从其他消息行跳转到指定分类（?cat=system）
  useEffect(() => {
    const c = sp.get('cat') as Cat | null
    if (c) setCat(c)
  }, [sp])

  const items = MESSAGES.filter((m) => cat === 'all' || m.cat === cat)
  const totalUnread = MESSAGES.reduce((n, m) => n + (m.unread && !readMsgs[m.id] ? m.badge || 1 : 0), 0)
  const catCount = (c: Cat) => (c === 'all' ? MESSAGES.length : MESSAGES.filter((m) => m.cat === c).length)

  const openMsg = (m: MsgItem) => {
    markRead(m.id)
    if (m.target) nav(m.target)
    else pushToast('该消息暂无跳转目标（演示）')
  }

  return (
    <>
      {/* 顶部消息栏：品牌 / 标题 / 设置 */}
      <div className="v2-top" style={{ justifyContent: 'space-between' }}>
        <BrandLogo small />
        <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)' }}>消息</div>
        <button
          className="bell-btn"
          onClick={() => pushToast('消息设置为演示原型')}
          aria-label="消息设置"
        >
          <Icon name="gear" size={20} style={{ color: 'var(--ink-2)' }} />
        </button>
      </div>

      <div className="page" style={{ paddingTop: 0 }}>
        {/* 消息分类 */}
        <div className="msg-tabs">
          {CATS.map((c) => (
            <button key={c.key} className={`msg-tab ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>
              {c.label}
              {c.key === 'all' && ` (${catCount('all')})`}
            </button>
          ))}
        </div>

        {/* 体育主题品牌横幅（原型裁切图） */}
        <div className="banner-img" style={{ marginBottom: 12 }}>
          <img src="/img/msg_banner.jpg" alt="连接体育·传递价值" />
        </div>

        {/* 消息列表 */}
        {items.length === 0 ? (
          <EmptyState title="暂无消息" desc="该分类下还没有消息（演示）。" icon="bell" />
        ) : (
          <div className="msg2-list">
            {items.map((m) => {
              const st = KIND_STYLE[m.kind]
              const unreadBadge = m.unread && !readMsgs[m.id] ? m.badge || 1 : 0
              return (
                <div key={m.id} className="msg2-row" onClick={() => openMsg(m)}>
                  {m.avatar ? (
                    <span className="msg2-avatar" style={{ display: 'block', position: 'relative' }}>
                      <img src={m.avatar} alt={m.title} className="msg2-avatar" />
                      {unreadBadge > 0 && <span className="rb" style={miniBadge}>{unreadBadge}</span>}
                    </span>
                  ) : (
                    <span className="msg2-ic" style={{ background: st.bg }}>
                      <Icon name={st.icon} size={21} filled={m.kind === 'like'} />
                      {unreadBadge > 0 && <span className="rb">{unreadBadge}</span>}
                    </span>
                  )}
                  <div className="msg2-main">
                    <div className="msg2-title-row">
                      <span className="msg2-title">{m.title}</span>
                      {m.verified && (
                        <span className="badge badge-blue" style={{ padding: 2, borderRadius: '50%' }}>
                          <Icon name="check" size={9} />
                        </span>
                      )}
                      <span className="msg2-time">{m.time}</span>
                    </div>
                    <div className="msg2-body">
                      <span className="t">{m.body}</span>
                      {unreadBadge > 0 && <span className="msg2-badge">{unreadBadge}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="msg2-foot">已加载全部消息</div>
        {totalUnread > 0 && (
          <div className="demo-strip">当前未读 {totalUnread} 条（红色数字提示）；点击消息卡片即标记已读并跳转对应详情（演示）。</div>
        )}
        <MockFooter />
      </div>
    </>
  )
}

const miniBadge: CSSProperties = {
  position: 'absolute',
  top: -4,
  right: -4,
  minWidth: 18,
  height: 18,
  padding: '0 4px',
  borderRadius: 9,
  background: '#f43f3f',
  color: '#fff',
  fontSize: 10.5,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1.5px solid #fff',
}
