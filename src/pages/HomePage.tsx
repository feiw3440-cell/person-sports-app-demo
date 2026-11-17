// 首页 v2：一比一还原高保真原型（蓝白国际体育科技风）
// 结构：品牌顶栏 → 主视觉 Banner → 快捷入口 → 项目发现三卡 → TOP 榜单预览卡 → 赛事宣传
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MESSAGES, SELF_ID, userById } from '../data/db'
import { buildRanking } from '../services/api'
import { currentRole, useApp } from '../store/store'
import type { RankMode } from '../types'
import Icon from '../components/Icon'
import { Avatar, BrandLogo, FlameGlyph, MockFooter, QuickGlyph, RankMedal } from '../components/ui'

const MODES: { key: RankMode; label: string }[] = [
  { key: 'overall', label: '综合榜' },
  { key: 'pro', label: '专业榜' },
  { key: 'popularity', label: '人气榜' },
]

const QUICK: { glyph: 'top' | 'video' | 'event' | 'athlete' | 'mentor'; label: string; sub?: string; to: string }[] = [
  { glyph: 'top', label: 'TOP榜', sub: '(排行榜)', to: '/top' },
  { glyph: 'video', label: '教学课程', to: '/list/courses' },
  { glyph: 'event', label: '赛事活动', to: '/list/events' },
  { glyph: 'athlete', label: '运动员', to: '/list/athletes' },
  { glyph: 'mentor', label: '导师', to: '/list/mentors' },
]

const PROJECT_CARDS = [
  { img: '/img/home_swim.jpg', pid: 'p4' },
  { img: '/img/home_wrestle.jpg', pid: 'p1' },
  { img: '/img/home_fence.jpg', pid: 'p7' },
]

export default function HomePage() {
  const nav = useNavigate()
  const [mode, setMode] = useState<RankMode>('overall')
  const readMsgs = useApp((s) => s.readMsgs)
  const me = userById(SELF_ID)!
  const role = currentRole()
  void role

  const unread = MESSAGES.filter((m) => m.unread && !readMsgs[m.id]).length
  // 综合分（演示）= 榜单得分 ×100，与原型数字一致
  const preview = useMemo(() => buildRanking('athlete', mode, { period: 'total' }).rows.slice(0, 3), [mode])

  return (
    <>
      {/* 顶部区域：Logo / 搜索框 / 通知 / 头像 */}
      <div className="v2-top">
        <div onClick={() => nav('/')} style={{ flex: 'none' }}>
          <BrandLogo small />
        </div>
        <div className="search-pill" onClick={() => nav('/search')}>
          <Icon name="search" size={16} />
          <span>搜索运动员、导师、课程...</span>
        </div>
        <button className="bell-btn" onClick={() => nav('/messages')} aria-label="通知">
          <Icon name="bell" size={21} />
          {unread > 0 && <span className="rb">{unread}</span>}
        </button>
        <button onClick={() => nav('/me')} aria-label="我的" style={{ flex: 'none' }}>
          <Avatar name={me.name} color={me.color} size="sm" photo={me.photo} />
        </button>
      </div>

      <div className="page">
        {/* 主视觉 Banner：摔跤竞技场景 */}
        <button className="hero-img" onClick={() => nav('/list/projects')} aria-label="专注体育 连接专业">
          <img src="/img/home_hero.jpg" alt="专注体育 连接专业" />
        </button>

        {/* 快捷入口 */}
        <div className="quick-grid">
          {QUICK.map((q) => (
            <button key={q.label} className="quick-item" onClick={() => nav(q.to)}>
              <span className="quick-glyph">
                <QuickGlyph type={q.glyph} size={44} />
              </span>
              <span>
                {q.label}
                {q.sub && <br />}
                {q.sub}
              </span>
            </button>
          ))}
        </div>

        {/* 体育项目发现 */}
        <div className="sec2">
          <div className="t">
            发现<i>·</i>
            <small>探索更多体育精彩</small>
          </div>
          <button className="more" onClick={() => nav('/discover')}>
            查看全部 <Icon name="arrow-r" size={12} />
          </button>
        </div>
        <div className="proj-photo-grid">
          {PROJECT_CARDS.map((c) => (
            <button key={c.pid} className="proj-photo" onClick={() => nav(`/project/${c.pid}`)}>
              <img src={c.img} alt="体育项目" />
            </button>
          ))}
        </div>

        {/* TOP 榜单预览卡 */}
        <div className="top-card">
          <div className="tc-head">
            <FlameGlyph size={22} />
            <div>
              <div className="tc-title">TOP 榜单</div>
              <div className="tc-sub">见证实力，致敬榜样（演示数据）</div>
            </div>
            <button className="sec-more" style={{ marginLeft: 'auto', color: 'var(--blue-strong)' }} onClick={() => nav('/top')}>
              进入TOP <Icon name="arrow-r" size={12} />
            </button>
          </div>
          <div className="mini-tabs">
            {MODES.map((m) => (
              <button key={m.key} className={mode === m.key ? 'active' : ''} onClick={() => setMode(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="rank-preview">
            {preview.map((r, i) => {
              const u = userById(r.entity.id)
              return (
                <div key={r.entity.id} className="rp-row" onClick={() => nav(`/athlete/${r.entity.id}`)}>
                  <RankMedal rank={(i + 1) as 1 | 2 | 3} size={30} />
                  {u && <Avatar name={u.name} color={u.color} size="md" photo={u.photo} />}
                  <div style={{ minWidth: 0 }}>
                    <div className="t-title" style={{ fontSize: 14.5 }}>
                      {u?.name}
                    </div>
                    <div className="t-mini mt4 ellipsis1">{(u?.title || '').replace('运动员', '').trim()}</div>
                  </div>
                  <div className="rp-score">
                    <div className="s">
                      <b>{mode === 'popularity' ? '人气值' : mode === 'pro' ? '专业分' : '综合分'}</b>
                      {mode === 'overall' ? Math.floor(r.score * 100) : r.score}
                    </div>
                  </div>
                  <span className="delta-red">{r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${-r.delta}` : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 赛事宣传 Banner */}
        <button className="banner-img" style={{ marginTop: 16 }} onClick={() => nav('/event/e1')} aria-label="2025 专体杯全国体育赛事 立即报名">
          <img src="/img/home_event.jpg?v=2" alt="2025 专体杯全国体育赛事" />
        </button>

        <MockFooter />
      </div>
    </>
  )
}
