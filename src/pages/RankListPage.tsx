// 全量榜单页：七类榜单 × 三模式 × 筛选（保留 PRD 全部榜单要求，科技蓝风格）
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PROJECTS, REGIONS } from '../data/db'
import { buildRanking, CATEGORY_FILTERS, CAT_FIELD_LABEL, MODE_WEIGHT_NOTE, entityName } from '../services/api'
import type { Period, RankCategory, RankMode } from '../types'
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
  const [period, setPeriod] = useState<Period>('week')
  const [projectFilter, setProjectFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [sheet, setSheet] = useState<'period' | 'project' | 'region' | null>(null)

  const { state, rows } = useMemo(
    () => buildRanking(cat, mode, { project: projectFilter, region: regionFilter, period }),
    [cat, mode, period, projectFilter, regionFilter],
  )
  const supports = CATEGORY_FILTERS[cat]

  return (
    <>
      {/* 科技蓝头 + 返回 */}
      <div className="ranklist-hero">
        <button className="icon-btn" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }} onClick={() => nav('/top')} aria-label="返回">
          <Icon name="back" size={18} />
        </button>
        <div style={{ height: 8 }} />
        <div className="rl-title">{CAT_TITLES[cat]}</div>
        <div className="rl-sub">让优秀的体育力量被看见（排序均为演示数据）</div>
        <Icon name="trophy" size={110} style={{ position: 'absolute', right: -10, top: -12, opacity: 0.25 }} />
      </div>

      <div className="page" style={{ paddingTop: 0 }}>
        {/* 三模式切换 */}
        <div className="mode-pills">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`mode-pill ${mode === m.key ? 'active' : ''}`}
              onClick={() => {
                sp.set('mode', m.key)
                setSp(sp, { replace: true })
              }}
            >
              <Icon name={m.icon} size={14} filled={m.key === 'pro'} />
              {m.label}
            </button>
          ))}
        </div>

        <div className="mode-note">
          <span className="mn-ic">
            <Icon name="info" size={15} />
          </span>
          <span>{MODE_WEIGHT_NOTE[mode]}</span>
        </div>

        {/* 榜单类别切换 */}
        <Chips
          options={(Object.keys(CAT_TITLES) as RankCategory[]).map((k) => ({ key: k, label: CAT_TITLES[k] }))}
          value={cat}
          onChange={(k) => nav(`/top/rank/${k}?mode=${mode}`)}
        />

        {/* 筛选栏 */}
        <div className="filter-bar">
          <button className={`filter-pill ${period !== 'week' ? 'active' : ''}`} onClick={() => setSheet('period')}>
            <Icon name="clock" size={13} />
            <span>{PERIODS.find((p) => p.key === period)!.label}</span>
          </button>
          {supports.project && (
            <button className={`filter-pill ${projectFilter ? 'active' : ''}`} onClick={() => setSheet('project')}>
              <Icon name="target" size={13} />
              <span>{projectFilter ? entityName(projectFilter, 'project') : '项目'}</span>
            </button>
          )}
          {supports.region && (
            <button className={`filter-pill ${regionFilter ? 'active' : ''}`} onClick={() => setSheet('region')}>
              <Icon name="location" size={13} />
              <span>{regionFilter || '地区'}</span>
            </button>
          )}
        </div>

        {/* 榜单列表 */}
        <div className="section">
          <div className="sec-head">
            <div className="sec-title">
              {CAT_FIELD_LABEL[cat]}
              {PERIODS.find((p) => p.key === period)!.label}
            </div>
            <div className="sec-sub">{rows.length > 0 && `共 ${rows.length} 位（演示）`}</div>
          </div>

          {state === 'updating' && (
            <div className="state-box">
              <div className="sb-icon">
                <Icon name="clock" size={30} />
              </div>
              <div className="sb-title">数据更新中</div>
              <div className="sb-desc">专业榜数据正在核验与更新（演示状态），请稍后切换其他模式查看。</div>
            </div>
          )}
          {state === 'empty' && <EmptyState title="暂无数据" desc="本期未纳入统计（演示状态）。可切换其他榜单模式查看。" icon="info" />}
          {state === 'ok' && rows.length === 0 && (
            <EmptyState title="暂无符合筛选的数据" desc="当前筛选组合下没有可展示的对象（演示）。试试清除项目或地区筛选。" icon="filter" />
          )}
          {state === 'ok' && rows.length > 0 && (
            <div className="list">
              {rows.map((r, i) => (
                <RankRowView key={r.entity.id} row={r} rank={i + 1} category={cat} />
              ))}
            </div>
          )}

          {cat === 'athlete' && mode === 'pro' && (
            <div className="demo-strip">榜单状态说明（演示）：「未核验」成绩不作为正式专业评价依据；「申诉处理中」的排名仍在复核。</div>
          )}
        </div>

        <div className="footer-note">
          榜单人物与排序均为演示数据 · 综合榜权重为示意口径（正式规则待确认）
          <br />
          人气榜由互动行为构成，非仅按点赞排序
        </div>
      </div>

      {/* 筛选抽屉 */}
      <Sheet open={sheet === 'period'} title="统计周期（演示）" onClose={() => setSheet(null)}>
        <div className="filter-options">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`fo-item ${period === p.key ? 'active' : ''}`}
              onClick={() => {
                setPeriod(p.key)
                setSheet(null)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="t-mini mt12">切换周期会影响名次与变化标识（模拟）。</div>
      </Sheet>
      <Sheet open={sheet === 'project'} title="按项目筛选" onClose={() => setSheet(null)}>
        <div className="filter-options">
          {[{ key: '', label: '全部项目' }, ...PROJECTS.map((p) => ({ key: p.id, label: p.name }))].map((o) => (
            <button
              key={o.key}
              className={`fo-item ${projectFilter === o.key ? 'active' : ''}`}
              onClick={() => {
                setProjectFilter(o.key)
                setSheet(null)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'region'} title="按地区筛选" onClose={() => setSheet(null)}>
        <div className="filter-options">
          {[{ key: '', label: '全部地区' }, ...REGIONS.map((r) => ({ key: r, label: r }))].map((o) => (
            <button
              key={o.key}
              className={`fo-item ${regionFilter === o.key ? 'active' : ''}`}
              onClick={() => {
                setRegionFilter(o.key)
                setSheet(null)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}
