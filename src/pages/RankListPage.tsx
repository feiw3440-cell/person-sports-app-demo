// 全量榜单页：七类榜单 × 三模式 × 周期（服务端 ranking_snapshot 为唯一权威数据源）
// 阶段五 A.1：移除 buildRanking / RANK_POOL 静态数据；按服务端 state 展示真实状态与空状态。
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { COURSES, EVENTS, ORGS, PROJECTS, userById } from '../data/db'
import { CAT_FIELD_LABEL, MODE_WEIGHT_NOTE } from '../services/api'
import { fetchRanking, type ServerRanking } from '../services/rankings'
import type { Period, RankCategory, RankMode, RankRow } from '../types'
import Icon from '../components/Icon'
import { Chips, EmptyState, Sheet } from '../components/ui'
import { RankRowView } from '../components/cards'

const MODES: { key: RankMode; label: string; icon: string }[] = [
  { key: 'overall', label: '综合榜', icon: 'trophy' },
  { key: 'pro', label: '专业榜', icon: 'star' },
  { key: 'popularity', label: '人气榜', icon: 'flame' },
]

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: '周榜' },
  { key: 'month', label: '月榜' },
  { key: 'total', label: '总榜' },
]

const CAT_TITLES: Record<RankCategory, string> = {
  athlete: '运动员 TOP',
  mentor: '导师 TOP',
  project: '体育项目 TOP',
  course: '课程 TOP',
  event: '赛事 TOP',
  org: '体育机构 TOP',
  city: '城市 TOP',
}

export default function RankListPage() {
  const { category = 'athlete' } = useParams()
  const cat = category as RankCategory
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const mode = (sp.get('mode') as RankMode) || 'overall'
  // 与首页/TOP 保持一致：默认读取服务端 total 快照
  const [period, setPeriod] = useState<Period>('total')
  const [sheet, setSheet] = useState<'period' | null>(null)
  const [ranking, setRanking] = useState<ServerRanking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setRanking(null)
    fetchRanking(cat, mode, period)
      .then((data) => { if (!cancelled) setRanking(data) })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRanking(null)
          setError(e instanceof Error ? e.message : '榜单加载失败')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cat, mode, period])

  const rows = useMemo<RankRow[]>(() => {
    if (!ranking) return []
    return (ranking.rows || []).map((r) => {
      const profile = userById(r.entity_id)
      let href: string | undefined
      if (cat === 'athlete' || cat === 'mentor') {
        href = profile ? `/${cat}/${profile.id}` : undefined
      } else if (cat === 'project' && PROJECTS.some((p) => p.id === r.entity_id)) {
        href = `/project/${r.entity_id}`
      } else if (cat === 'course' && COURSES.some((k) => k.id === r.entity_id)) {
        href = `/course/${r.entity_id}`
      } else if (cat === 'event' && EVENTS.some((e) => e.id === r.entity_id)) {
        href = `/event/${r.entity_id}`
      } else if (cat === 'org' && ORGS.some((o) => o.id === r.entity_id)) {
        href = `/org/${r.entity_id}`
      }
      return {
        entity: {
          id: r.entity_id,
          type: cat,
          name: r.name,
          prof: r.score,
          profVerified: !!r.verified,
          influence: 0,
          views: 0,
          likes: 0,
          favs: 0,
          comments: 0,
          follows: 0,
          delta: { week: r.delta, month: r.delta, total: r.delta },
        },
        score: r.score,
        delta: r.delta,
        reason: r.note || '服务端 ranking_snapshot 权威数据',
        subLabel: `${MODES.find((m) => m.key === mode)?.label || ''} · 服务端榜单`,
        href,
      }
    })
  }, [ranking, cat, mode])

  const serverState = ranking?.state ?? 'empty'
  const modeLabel = MODES.find((m) => m.key === mode)?.label || ''

  return (
    <>
      <div className="ranklist-hero">
        <button className="icon-btn" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }} onClick={() => nav('/top')} aria-label="返回">
          <Icon name="back" size={18} />
        </button>
        <div style={{ height: 8 }} />
        <div className="rl-title">{CAT_TITLES[cat]}</div>
        <div className="rl-sub">数据来源：共享 API · ranking_snapshot（服务端权威）</div>
        <Icon name="trophy" size={110} style={{ position: 'absolute', right: -10, top: -12, opacity: 0.25 }} />
      </div>

      <div className="page" style={{ paddingTop: 0 }}>
        <div className="mode-pills">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`mode-pill ${mode === m.key ? 'active' : ''}`}
              onClick={() => { sp.set('mode', m.key); setSp(sp, { replace: true }) }}
            >
              <Icon name={m.icon} size={14} filled={m.key === 'pro'} />
              {m.label}
            </button>
          ))}
        </div>

        <div className="mode-note">
          <span className="mn-ic"><Icon name="info" size={15} /></span>
          <span>{MODE_WEIGHT_NOTE[mode]}</span>
        </div>

        <Chips
          options={(Object.keys(CAT_TITLES) as RankCategory[]).map((k) => ({ key: k, label: CAT_TITLES[k] }))}
          value={cat}
          onChange={(k) => nav(`/top/rank/${k}?mode=${mode}`)}
        />

        <div className="filter-bar">
          <button className={`filter-pill ${period !== 'total' ? 'active' : ''}`} onClick={() => setSheet('period')}>
            <Icon name="clock" size={13} />
            <span>{PERIODS.find((p) => p.key === period)?.label}</span>
          </button>
          <span className="t-mini" style={{ alignSelf: 'center' }}>服务端榜单暂不支持项目/地区筛选</span>
        </div>

        <div className="section">
          <div className="sec-head">
            <div className="sec-title">
              {CAT_FIELD_LABEL[cat]} · {PERIODS.find((p) => p.key === period)?.label}
            </div>
            <div className="sec-sub">{rows.length > 0 ? `共 ${rows.length} 位（服务端榜单）` : ''}</div>
          </div>

          {loading && (
            <div className="state-box">
              <div className="sb-icon"><Icon name="clock" size={30} /></div>
              <div className="sb-title">榜单加载中</div>
              <div className="sb-desc">正在从共享 API 读取服务端榜单快照。</div>
            </div>
          )}

          {!loading && error && (
            <EmptyState
              title="榜单加载失败"
              desc={error}
              icon="info"
              action={<button className="btn btn-primary btn-sm" onClick={() => setPeriod((p) => (p === 'total' ? 'week' : 'total'))}>重试</button>}
            />
          )}

          {!loading && !error && serverState === 'updating' && (
            <div className="state-box">
              <div className="sb-icon"><Icon name="clock" size={30} /></div>
              <div className="sb-title">数据更新中</div>
              <div className="sb-desc">该榜单快照正在更新或尚未生成（服务端 state=updating），请稍后再试或切换其他模式。</div>
            </div>
          )}

          {!loading && !error && serverState === 'empty' && (
            <EmptyState title="暂无榜单数据" desc="服务端当前没有该维度/周期的榜单快照（state=empty），未使用本地演示数据补齐。" icon="info" />
          )}

          {!loading && !error && serverState === 'ok' && rows.length === 0 && (
            <EmptyState title="榜单为空" desc="服务端榜单快照存在但暂无行数据。" icon="info" />
          )}

          {!loading && !error && serverState === 'ok' && rows.length > 0 && (
            <div className="list">
              {rows.map((r, i) => (
                <RankRowView key={r.entity.id} row={r} rank={i + 1} category={cat} />
              ))}
            </div>
          )}

          {!loading && !error && ranking?.updated_at && (
            <div className="t-mini mt8">快照更新时间：{String(ranking.updated_at).slice(0, 19).replace('T', ' ')}</div>
          )}
        </div>

        <div className="footer-note">
          榜单人物、排名与分数均来自共享 API 的 ranking_snapshot；无本地 Mock 数据参与。
          <br />
          {modeLabel}口径以服务端 formula 为准，示意权重说明仅供参考。
        </div>
      </div>

      <Sheet open={sheet === 'period'} title="统计周期" onClose={() => setSheet(null)}>
        <div className="filter-options">
          {PERIODS.map((p) => (
            <button key={p.key} className={`fo-item ${period === p.key ? 'active' : ''}`} onClick={() => { setPeriod(p.key); setSheet(null) }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="t-mini mt12">周期参数直接传递给服务端榜单 API；无快照时显示真实状态。</div>
      </Sheet>
    </>
  )
}
