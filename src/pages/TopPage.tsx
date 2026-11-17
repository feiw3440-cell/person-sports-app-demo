// TOP 总览页 v2：一比一还原高保真原型
// 结构：主视觉 → 三大榜单切换 → 七大榜单分类 → 本期焦点 → 运动员排行榜（前三荣誉） → 热门导师榜
// 完整榜单（含筛选与异常状态）在 /top/rank/:category
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HOT_MENTORS, MESSAGES, PODIUM, userById } from '../data/db'
import { useApp } from '../store/store'
import type { RankCategory, RankMode } from '../types'
import Icon from '../components/Icon'
import { MockFooter } from '../components/ui'

const MODES: { key: RankMode; label: string; icon: string; valLabel: string }[] = [
  { key: 'overall', label: '综合榜', icon: 'trophy', valLabel: '综合指数' },
  { key: 'pro', label: '专业榜', icon: 'star', valLabel: '专业指数' },
  { key: 'popularity', label: '人气榜', icon: 'flame', valLabel: '人气指数' },
]

const CATS: { key: RankCategory; label: string; sub: string; icon: string }[] = [
  { key: 'project', label: '项目TOP', sub: '热门项目', icon: 'target' },
  { key: 'athlete', label: '运动员TOP', sub: '优秀运动员', icon: 'medal' },
  { key: 'mentor', label: '导师TOP', sub: '专业导师', icon: 'grad' },
  { key: 'course', label: '课程TOP', sub: '优质课程', icon: 'book' },
  { key: 'event', label: '赛事TOP', sub: '热门赛事', icon: 'trophy' },
  { key: 'org', label: '机构TOP', sub: '优质机构', icon: 'building' },
  { key: 'city', label: '城市TOP', sub: '城市活跃度', icon: 'location' },
]

function Crown({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 24 17" fill="currentColor" aria-hidden>
      <path d="M2 3.6 6.6 8 12 1.4 17.4 8 22 3.6l-1.8 11.2H3.8z" />
      <rect x="3.8" y="15" width="16.4" height="1.8" rx="0.9" />
    </svg>
  )
}

export default function TopPage() {
  const nav = useNavigate()
  const [mode, setMode] = useState<RankMode>('overall')
  const readMsgs = useApp((s) => s.readMsgs)
  const modeDef = MODES.find((m) => m.key === mode)!
  const podium = [...PODIUM].sort((a, b) => a.rank - b.rank)
  const ordered = [podium[1], podium[0], podium[2]] // 展示顺序：亚军·冠军·季军
  const unread = MESSAGES.filter((m) => m.unread && !readMsgs[m.id]).reduce((n, m) => n + (m.badge || 1), 0)

  return (
    <>
      {/* 主视觉（原型裁切，含品牌与标题；右上角搜索 + 消息通知入口） */}
      <div className="top-hero">
        <img src="img/top_hero.jpg" alt="TOP 榜单" />
        <button className="top-hero-bell" onClick={() => nav('/messages')} aria-label="消息通知">
          <Icon name="bell" size={19} />
          {unread > 0 && <span className="rb">{unread}</span>}
        </button>
        <button className="search-hit" style={{ top: '13.5%' }} onClick={() => nav('/search')} aria-label="搜索" />
      </div>

      <div className="page" style={{ paddingTop: 0 }}>
        {/* 三大榜单切换 */}
        <div className="mode-pills">
          {MODES.map((m) => (
            <button key={m.key} className={`mode-pill ${mode === m.key ? 'active' : ''}`} onClick={() => setMode(m.key)}>
              <Icon name={m.icon} size={15} filled={m.key === 'pro'} />
              {m.label}
            </button>
          ))}
        </div>

        {/* 七大榜单分类 */}
        <div className="cat-grid">
          {CATS.slice(0, 4).map((c) => (
            <CatItem key={c.key} c={c} onClick={() => nav(`/top/rank/${c.key}`)} />
          ))}
          {CATS.slice(4).map((c) => (
            <CatItem key={c.key} c={c} onClick={() => nav(`/top/rank/${c.key}`)} />
          ))}
        </div>

        {/* 本期焦点（原型裁切图 + 查看详情热区） */}
        <button
          className="banner-img"
          style={{ marginTop: 14 }}
          onClick={() => nav('/athlete/nw1')}
          aria-label="本期焦点：体育之星 榜样力量"
        >
          <img src="img/top_focus.jpg" alt="体育之星·榜样力量" />
        </button>

        {/* 运动员排行榜（前三荣誉展示） */}
        <div className="sec2">
          <div className="t">运动员排行榜</div>
          <button className="more" onClick={() => nav('/top/rank/athlete')}>
            查看全部 <Icon name="arrow-r" size={12} />
          </button>
        </div>
        <div className="podium">
          {ordered.map((p) => {
            const u = userById(p.id)!
            return (
              <button key={p.id} className={`pd-card r${p.rank}`} onClick={() => nav(`/athlete/${p.id}`)}>
                <div className="pd-crown">
                  <Crown size={p.rank === 1 ? 30 : 24} />
                </div>
                <img className="pd-avatar" src={u.photo} alt={u.name} />
                <div className="pd-name">{u.name}</div>
                <div className="pd-sub">{(u.title || '').replace('运动员', '')}</div>
                <div className="pd-val">
                  {modeDef.valLabel} {p.vals[mode]}
                </div>
              </button>
            )
          })}
        </div>

        {/* 热门导师榜 */}
        <div className="sec2">
          <div className="t">热门导师榜</div>
          <button className="more" onClick={() => nav('/top/rank/mentor')}>
            查看全部 <Icon name="arrow-r" size={12} />
          </button>
        </div>
        <div className="hm-grid">
          {HOT_MENTORS.map((h, i) => {
            const u = userById(h.id)!
            return (
              <button key={h.id} className="hm-card" onClick={() => nav(`/mentor/${h.id}`)}>
                <span className={`hm-rank ${i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>{i + 1}</span>
                <span className="hm-verify">
                  <Icon name="shield" size={8} /> 认证
                </span>
                <img className="hm-avatar" src={u.photo} alt={u.name} />
                <div className="hm-name">{u.name}</div>
                <div className="hm-sub">
                  {(u.title || '').replace('导师', '')} · {u.mentorInfo?.level.split('（')[0]}
                </div>
                <div className="hm-heat">
                  <Icon name="flame" size={12} />
                  {h.heat}
                </div>
              </button>
            )
          })}
        </div>

        <MockFooter text="榜单人物、指数与排序均为演示数据 · 正式榜单规则待确认" />
      </div>
    </>
  )
}

function CatItem({ c, onClick }: { c: { key: RankCategory; label: string; sub: string; icon: string }; onClick: () => void }) {
  return (
    <button className="cg-item" onClick={onClick}>
      <span className="ic">
        <Icon name={c.icon} size={22} />
      </span>
      <span>{c.label}</span>
      <small>{c.sub}</small>
    </button>
  )
}
