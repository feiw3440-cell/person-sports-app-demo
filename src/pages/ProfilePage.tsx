// 我的页 v2：一比一还原高保真原型（蓝白国际体育科技风）
// 结构：个人资料区 → 个人数据 → 专体VIP → 我的功能 → 专体服务 → 赛事宣传入口
// 范围说明：订单/钱包/VIP/积分为原型占位（未来交易能力，本阶段未接入，点击有明确提示）
import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { DATA_SOURCE, MESSAGES, ROLE_LABEL, SELF_ID, userById } from '../data/db'
// 个人资料页：账号资料可能尚未水合或无公开档案；所有展示名/ID 都必须有兜底，禁止非空断言
import { currentRole, unreadCount, useApp } from '../store/store'
import { useSession } from '../services/session'
import { api } from '../services/apiClient'
import Icon from '../components/Icon'
import { BrandLogo, FuncGlyph, MockFooter } from '../components/ui'
import type { FuncGlyphType } from '../components/ui'

function Crown({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 24 17" fill="currentColor" aria-hidden>
      <path d="M2 3.6 6.6 8 12 1.4 17.4 8 22 3.6l-1.8 11.2H3.8z" />
      <rect x="3.8" y="15" width="16.4" height="1.8" rx="0.9" />
    </svg>
  )
}

const FUNCS: { glyph: FuncGlyphType; label: string; to?: string; toast?: string }[] = [
  { glyph: 'home', label: '我的主页', to: '/athlete/u0' },
  { glyph: 'course', label: '我的课程', to: '/list/my-courses' },
  { glyph: 'event', label: '我的赛事', to: '/list/my-events' },
  { glyph: 'favs', label: '我的收藏', to: '/list/my-favs' },
  { glyph: 'heart', label: '我的关注', to: '/list/my-follows' },
  { glyph: 'history', label: '浏览历史', to: '/list/my-history' },
  { glyph: 'order', label: '我的订单', toast: '「我的订单」属于未来交易能力，本阶段为原型占位（PRD 范围排除项）' },
  { glyph: 'handshake', label: '我的师徒', to: '/mentorship' },
  { glyph: 'auth', label: '我的授权', to: '/mentorship' },
  { glyph: 'review', label: '我的评价', toast: '「我的评价」为演示原型入口' },
  { glyph: 'wallet', label: '我的钱包', toast: '「我的钱包」属于未来交易能力，本阶段为原型占位（PRD 范围排除项）' },
  { glyph: 'gear', label: '设置中心', toast: '「设置中心」为演示原型入口' },
]

export default function ProfilePage() {
  const nav = useNavigate()
  const me = userById(SELF_ID)
  const displayName = me?.name || '未知用户'
  const displayId = me?.id ? String(me.id) : '未获取'
  const role = currentRole()
  const readMsgs = useApp((s) => s.readMsgs)
  const pushToast = useApp((s) => s.pushToast)
  const logoutFn = useSession((s) => s.logout)
  const unread = unreadCount(MESSAGES)
  // C-③：API 模式统计为服务端权威口径（GET /v1/me/stats）；积分体系未实现，不展示假数字
  const [stats, setStats] = useState<{ following: number; followers: number; likes: number } | null>(null)

  useEffect(() => {
    if (DATA_SOURCE === 'mock') return
    let removed = false
    api<{ data: { following: number; followers: number; likes: number } }>('GET', '/me/stats')
      .then((res) => { if (!removed) setStats(res.data) })
      .catch(() => { /* 统计失败保持占位，不打扰主页面 */ })
    return () => { removed = true }
  }, [])

  return (
    <>
      {/* 个人资料区 */}
      <div className="me2-header">
        <img className="bgimg" src="img/me_header.jpg" alt="" aria-hidden />
        <div className="row1">
          <BrandLogo light small />
          <div className="r">
            <button onClick={() => pushToast('设置中心为演示原型入口')} aria-label="设置">
              <Icon name="gear" size={20} />
            </button>
            <button onClick={() => nav('/messages')} aria-label="消息" style={{ position: 'relative' }}>
              <Icon name="bell" size={20} />
              {unread > 0 && <span className="rb" style={bellBadge}>{unread}</span>}
            </button>
          </div>
        </div>
        <div className="me2-id">
          <img className="me2-avatar" src="img/me_avatar.jpg" alt="头像" />
          <div>
            <div className="me2-name">
              {displayName}
              <button onClick={() => pushToast('编辑资料为演示原型')} aria-label="编辑">
                <Icon name="clip" size={15} style={{ opacity: 0.9 }} />
              </button>
            </div>
            <div className="me2-idline">
              ID：{displayId}
              <span className="me2-badge">
                <Icon name="shield" size={11} /> {ROLE_LABEL[role.type] || role.label}
              </span>
            </div>
          </div>
        </div>
        <div className="me2-sig">让体育更专业，让梦想更近一步</div>
      </div>

      <div style={{ paddingBottom: 78 }}>
        {/* 个人数据：API 模式服务端权威（关注/粉丝/获赞）；积分为未实现能力，不展示假数字 */}
        <div className="me2-stats">
          <div className="ms">
            <div className="n">{stats ? stats.following : DATA_SOURCE === 'api' ? '…' : '128'}</div>
            <div className="l">关注</div>
          </div>
          <div className="ms">
            <div className="n">{stats ? stats.followers : DATA_SOURCE === 'api' ? '…' : '356'}</div>
            <div className="l">粉丝</div>
          </div>
          <div className="ms">
            <div className="n">{stats ? stats.likes : DATA_SOURCE === 'api' ? '…' : '1.2万'}</div>
            <div className="l">获赞</div>
          </div>
          <div className="ms">
            <div className="n" style={{ color: 'var(--ink-3)', fontSize: 15 }}>即将上线</div>
            <div className="l">积分</div>
          </div>
        </div>

        {/* 专体 VIP（原型占位） */}
        <button className="vip-banner full" style={{ width: 'auto', display: 'flex' }} onClick={() => pushToast('专体VIP为未来会员能力，本阶段为原型占位')}>
          <span className="v-title">
            <Crown /> 专体VIP
          </span>
          <span className="v-sub">尊享更多专属权益，解锁专业服务</span>
          <span className="v-btn">
            立即开通 <Icon name="arrow-r" size={11} />
          </span>
        </button>

        {/* 我的功能 */}
        <div className="func-card">
          <div className="fc-head">
            <div className="fc-title">我的功能</div>
            <button className="sec-more" style={{ color: 'var(--ink-2)' }} onClick={() => pushToast('全部功能为演示原型')}>
              全部功能 <Icon name="arrow-r" size={12} />
            </button>
          </div>
          <div className="func-grid">
            {FUNCS.map((f) => (
              <button
                key={f.label}
                className="func-item"
                onClick={() => (f.to ? nav(f.to) : pushToast(f.toast!))}
              >
                <span className="func-glyph">
                  <FuncGlyph type={f.glyph} size={40} />
                </span>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 专体服务 */}
        <div className="svc-card">
          <div className="svc-title">专体服务</div>
          <button className="svc-row full" style={{ width: '100%' }} onClick={() => nav('/identity')}>
            <span className="svc-ic" style={{ background: 'linear-gradient(160deg,#3f8bff,#0765fe)' }}>
              <Icon name="swap" size={19} />
            </span>
            <span className="svc-label">身份切换</span>
            <span className="svc-right">
              运动员 / 导师 / 用户
              <span className="svc-cur">当前：{ROLE_LABEL[role.type] || role.label}</span>
            </span>
          </button>
          <button className="svc-row full" style={{ width: '100%' }} onClick={() => pushToast('帮助与反馈为演示原型入口')}>
            <span className="svc-ic" style={{ background: 'linear-gradient(160deg,#5aa0ff,#2e7cf6)' }}>
              <Icon name="info" size={19} />
            </span>
            <span className="svc-label">帮助与反馈</span>
            <span className="svc-right">
              有问题？找我们
              <Icon name="arrow-r" size={13} />
            </span>
          </button>
          <button className="svc-row full" style={{ width: '100%' }} onClick={() => nav('/about')}>
            <span className="svc-ic" style={{ background: 'linear-gradient(160deg,#4d9bff,#1677ff)' }}>
              <Icon name="info" size={19} filled />
            </span>
            <span className="svc-label">关于专体</span>
            <span className="svc-right">
              版本号：v1.0.0
              <Icon name="arrow-r" size={13} />
            </span>
          </button>
          <button className="svc-row full" style={{ width: '100%' }} onClick={() => pushToast('客服热线 400-123-4567（演示占位）')}>
            <span className="svc-ic" style={{ background: 'linear-gradient(160deg,#3f8bff,#0765fe)' }}>
              <Icon name="bell" size={19} />
            </span>
            <span className="svc-label">联系客服</span>
            <span className="svc-right">
              400-123-4567
              <Icon name="arrow-r" size={13} />
            </span>
          </button>
          <button
            className="svc-row full"
            style={{ width: '100%' }}
            onClick={async () => {
              if (!window.confirm('退出登录将撤销当前会话并清理本地令牌与敏感缓存，确定退出？')) return
              await logoutFn()
              nav('/login')
            }}
          >
            <span className="svc-ic" style={{ background: 'linear-gradient(160deg,#5aa0ff,#2e7cf6)' }}>
              <Icon name="swap" size={19} />
            </span>
            <span className="svc-label">退出登录</span>
            <span className="svc-right">
              <Icon name="arrow-r" size={13} />
            </span>
          </button>
        </div>

        {/* 赛事宣传入口 */}
        <button className="me2-banner" onClick={() => nav('/list/events')} aria-label="专体全国体育赛事 立即报名">
          <img src="img/me_event.jpg?v=2" alt="专体全国体育赛事" />
        </button>

        <MockFooter text="个人数据与身份状态均为演示模拟数据" />
      </div>
    </>
  )
}

const bellBadge: CSSProperties = {
  position: 'absolute',
  top: -4,
  right: -6,
  minWidth: 17,
  height: 17,
  padding: '0 4px',
  borderRadius: 9,
  background: '#f43f3f',
  color: '#fff',
  fontSize: 10,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1.5px solid #fff',
}
