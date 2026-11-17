// 全局搜索页：同一关键词按类型分栏查看（PRD §5.2，避免只返回视频）
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HOT_KEYWORDS, searchAll } from '../services/api'
import Icon from '../components/Icon'
import { CourseRow, EventRow, OrgRow, PersonRow, ProjectBanner, ContentRow } from '../components/cards'
import { EmptyState } from '../components/ui'

type Scope = 'all' | 'project' | 'content' | 'athlete' | 'mentor' | 'course' | 'event' | 'org'

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'project', label: '项目' },
  { key: 'content', label: '内容' },
  { key: 'athlete', label: '运动员' },
  { key: 'mentor', label: '导师' },
  { key: 'course', label: '课程' },
  { key: 'event', label: '赛事' },
  { key: 'org', label: '机构/场馆' },
]

export default function SearchPage() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const results = useMemo(() => searchAll(q), [q])

  const show = (s: Scope) => scope === 'all' || scope === s
  const total =
    results.projects.length +
    results.contents.length +
    results.athletes.length +
    results.mentors.length +
    results.courses.length +
    results.events.length +
    results.orgs.length

  return (
    <>
      <div className="search-hero">
        <div className="flex" style={{ gap: 10 }}>
          <button className="icon-btn" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }} onClick={() => nav(-1)}>
            <Icon name="back" size={18} />
          </button>
          <div className="search-bar" style={{ flex: 1, marginTop: 0 }}>
            <Icon name="search" size={17} style={{ color: 'var(--ink-3)' }} />
            <input
              autoFocus
              placeholder="搜索项目、运动员、导师、课程、赛事、机构"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button onClick={() => setQ('')} aria-label="清空">
                <Icon name="close" size={15} style={{ color: 'var(--ink-3)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page" style={{ paddingTop: 0 }}>
        {q === '' ? (
          <>
            <div className="section">
              <div className="sec-head">
                <div className="sec-title">热门搜索</div>
              </div>
              <div className="flex wrap gap8">
                {HOT_KEYWORDS.map((k) => (
                  <button key={k} className="chip" onClick={() => setQ(k)}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <div className="demo-strip">
              搜索范围：体育项目、运动员、教练/导师、体育学校/俱乐部/场馆、赛事、课程与内容。同一关键词可按类型分栏查看。
            </div>
          </>
        ) : (
          <>
            {/* 结果类型筛选 */}
            <div className="chip-row" style={{ marginTop: 10 }}>
              {SCOPES.map((s) => {
                let count = 0
                if (s.key === 'all') count = total
                else if (s.key === 'project') count = results.projects.length
                else if (s.key === 'content') count = results.contents.length
                else if (s.key === 'athlete') count = results.athletes.length
                else if (s.key === 'mentor') count = results.mentors.length
                else if (s.key === 'course') count = results.courses.length
                else if (s.key === 'event') count = results.events.length
                else if (s.key === 'org') count = results.orgs.length
                return (
                  <button key={s.key} className={`chip ${scope === s.key ? 'active' : ''}`} onClick={() => setScope(s.key)}>
                    {s.label}
                    {count > 0 && s.key !== 'all' ? ` ${count}` : ''}
                  </button>
                )
              })}
            </div>

            {total === 0 && (
              <EmptyState
                title={`未找到与「${q}」相关的内容`}
                desc="换个关键词试试，比如「摔跤」「训练营」「上海」（演示数据范围有限）。"
                icon="search"
              />
            )}

            {show('project') && results.projects.length > 0 && (
              <div className="section">
                <div className="sec-head">
                  <div className="sec-title">体育项目 · {results.projects.length}</div>
                </div>
                <div className="list">
                  {results.projects.map((p) => (
                    <ProjectBanner key={p.id} p={p} onClick={() => nav(`/project/${p.id}`)} />
                  ))}
                </div>
              </div>
            )}

            {show('content') && results.contents.length > 0 && (
              <div className="section">
                <div className="sec-head">
                  <div className="sec-title">视频 / 图文 · {results.contents.length}</div>
                </div>
                <div className="list">
                  {results.contents.map((c) => (
                    <ContentRow key={c.id} c={c} />
                  ))}
                </div>
              </div>
            )}

            {show('athlete') && results.athletes.length > 0 && (
              <div className="section">
                <div className="sec-head">
                  <div className="sec-title">运动员 · {results.athletes.length}</div>
                </div>
                <div className="list">
                  {results.athletes.map((u) => (
                    <PersonRow key={u.id} u={u} onClick={() => nav(`/athlete/${u.id}`)} />
                  ))}
                </div>
              </div>
            )}

            {show('mentor') && results.mentors.length > 0 && (
              <div className="section">
                <div className="sec-head">
                  <div className="sec-title">教练 / 导师 · {results.mentors.length}</div>
                </div>
                <div className="list">
                  {results.mentors.map((u) => (
                    <PersonRow key={u.id} u={u} onClick={() => nav(`/mentor/${u.id}`)} />
                  ))}
                </div>
              </div>
            )}

            {show('course') && results.courses.length > 0 && (
              <div className="section">
                <div className="sec-head">
                  <div className="sec-title">课程 · {results.courses.length}</div>
                </div>
                <div className="list">
                  {results.courses.map((k) => (
                    <CourseRow key={k.id} k={k} />
                  ))}
                </div>
              </div>
            )}

            {show('event') && results.events.length > 0 && (
              <div className="section">
                <div className="sec-head">
                  <div className="sec-title">赛事 · {results.events.length}</div>
                </div>
                <div className="list">
                  {results.events.map((e) => (
                    <EventRow key={e.id} e={e} />
                  ))}
                </div>
              </div>
            )}

            {show('org') && results.orgs.length > 0 && (
              <div className="section">
                <div className="sec-head">
                  <div className="sec-title">学校 / 俱乐部 / 场馆 · {results.orgs.length}</div>
                </div>
                <div className="list">
                  {results.orgs.map((o) => (
                    <OrgRow key={o.id} o={o} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
