// TOP 总览页 v2：一比一还原高保真原型
// 结构：主视觉 → 三大榜单切换 → 七大榜单分类 → 本期焦点 → 运动员排行榜（前三荣誉） → 热门导师榜
// 完整榜单（含筛选与异常状态）在 /top/rank/:category
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DATA_SOURCE, MESSAGES, PODIUM, userById } from '../data/db'
import { rankingRows } from '../data/rankings'
import { mentorCards } from '../services/mentorCards'
import { fetchAllAndHydrate } from '../services/serverData'
import { useApp } from '../store/store'
import type { RankCategory, RankMode } from '../types'
import Icon from '../components/Icon'
import { EmptyState, MockFooter } from '../components/ui'

type PodiumEntry = {
  id: string
  rank: number
  name: string
  color: string
  photo?: string
  title: string
  vals: Partial<Record<RankMode, number>>
  hasProfile: boolean
}

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
  const [refreshing, setRefreshing] = useState(false)
  const pushToast = useApp((s) => s.pushToast)
  const readMsgs = useApp((s) => s.readMsgs)
  const modeDef = MODES.find((m) => m.key === mode)!
  const unread = MESSAGES.filter((m) => m.unread && !readMsgs[m.id]).reduce((n, m) => n + (m.badge || 1), 0)

  // 三种模式的名次分数：服务端榜单为准（Mock 模式仍用本地演示值）
  const scoreByMode = new Map<string, Partial<Record<RankMode, number>>>()
  if (DATA_SOURCE !== 'mock') {
    for (const item of MODES) {
      for (const row of rankingRows('athlete', item.key)) {
        const eid = row.target_id || row.entity_id
        if (!eid) continue
        const scores = scoreByMode.get(eid) || {}
        scores[item.key] = row.score
        scoreByMode.set(eid, scores)
      }
    }
  }

  const podium: PodiumEntry[] =
    DATA_SOURCE === 'mock'
      ? PODIUM.map((item) => {
          const user = userById(item.id)
          return {
            id: item.id,
            rank: item.rank,
            name: user?.name || '运动员',
            color: user?.color || '#2872B8',
            photo: user?.photo,
            title: (user?.title || '运动员').replace('运动员', '').trim() || '运动员',
            vals: item.vals,
            hasProfile: !!user,
          }
        }).sort((a, b) => a.rank - b.rank)
      : rankingRows('athlete', 'overall')
          .slice(0, 3)
          .map((row) => {
            const eid = row.target_id || row.entity_id || ''
            const rowName = row.display_name || row.name || ''
            const user = userById(eid)
            return {
              id: eid,
              rank: row.rank,
              name: user?.name || rowName || '运动员',
              color: user?.color || '#2872B8',
              photo: user?.photo,
              title: (user?.title || '运动员').replace('运动员', '').trim() || '运动员',
              vals: scoreByMode.get(eid) || { overall: row.score },
              hasProfile: !!user,
            }
          }).filter((p) => p.id)

  const ordered = podium.length >= 3 ? [podium[1], podium[0], podium[2]] : podium
  const mentors = mentorCards('popularity', 3)

  /** 手动刷新：重新水合（榜单/实体均为服务端权威快照） */
  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await fetchAllAndHydrate()
      pushToast('榜单数据已刷新')
    } catch {
      pushToast('刷新失败（网络异常），已保留当前数据')
    } finally {
      setRefreshing(false)
    }
  }

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
          <button
            className="mode-pill"
            style={{ marginLeft: 'auto', minWidth: 44 }}
            disabled={refreshing}
            onClick={() => void refresh()}
            aria-label="刷新榜单"
          >
            <Icon name="refresh" size={15} />
          </button>
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
          onClick={() => nav(podium[0]?.hasProfile ? `/athlete/${podium[0].id}` : '/top/rank/athlete')}
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
        {ordered.length === 0 ? (
          <div className="card">
            <EmptyState title="暂无运动员榜单数据" desc="共享 API 尚未返回运动员榜单快照。" icon="trophy" />
          </div>
        ) : (
          <div className="podium">
            {ordered.map((p) => (
              <button
                key={p.id}
                className={`pd-card r${p.rank}`}
                onClick={() => nav(p.hasProfile ? `/athlete/${p.id}` : '/top/rank/athlete')}
              >
                <div className="pd-crown">
                  <Crown size={p.rank === 1 ? 30 : 24} />
                </div>
                {p.photo ? (
                  <img className="pd-avatar" src={p.photo} alt={p.name} />
                ) : (
                  <div
                    className="pd-avatar"
                    style={{
                      background: `linear-gradient(135deg, ${p.color}, ${p.color}CC)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: p.rank === 1 ? 30 : 26,
                      fontWeight: 900,
                    }}
                  >
                    {p.name.slice(0, 1)}
                  </div>
                )}
                <div className="pd-name">{p.name}</div>
                <div className="pd-sub">{p.title}</div>
                <div className="pd-val">
                  {modeDef.valLabel} {p.vals[mode] ?? '—'}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 热门导师榜 */}
        <div className="sec2">
          <div className="t">热门导师榜</div>
          <button className="more" onClick={() => nav('/top/rank/mentor')}>
            查看全部 <Icon name="arrow-r" size={12} />
          </button>
        </div>
        {mentors.length === 0 ? (
          <div className="card">
            <EmptyState title="暂无导师榜单数据" desc="共享 API 当前未返回导师榜单或导师档案。" icon="grad" />
          </div>
        ) : (
          <>
            <div className="hm-grid">
              {mentors.map((m, i) => {
                const sub =
                  [m.title?.replace('导师', '').trim(), m.level?.split('（')[0]].filter(Boolean).join(' · ') ||
                  (m.source === 'mentorship' ? '与你建立师徒关系' : '导师')
                return (
                  <button
                    key={m.id}
                    className="hm-card"
                    onClick={() => nav(m.hasProfile ? `/mentor/${m.id}` : '/mentorship')}
                  >
                    <span className={`hm-rank ${i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>{i + 1}</span>
                    <span className="hm-verify">
                      <Icon name="shield" size={8} /> {m.verify === 'verified' ? '认证' : '导师'}
                    </span>
                    {m.photo ? (
                      <img className="hm-avatar" src={m.photo} alt={m.name} />
                    ) : (
                      <div
                        className="hm-avatar"
                        style={{
                          background: `linear-gradient(135deg, ${m.color}, ${m.color}CC)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 28,
                          fontWeight: 900,
                        }}
                      >
                        {m.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="hm-name">{m.name}</div>
                    <div className="hm-sub">{sub}</div>
                    <div className="hm-heat">
                      {m.score !== undefined ? (
                        <>
                          <Icon name="flame" size={12} />
                          {m.score}
                        </>
                      ) : (
                        <>
                          <Icon name="grad" size={12} />
                          我的导师
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            {mentors.every((m) => m.source === 'mentorship') && (
              <div className="demo-strip">服务端暂无导师榜快照，以下展示与当前账号有师徒关系的导师。</div>
            )}
          </>
        )}

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
