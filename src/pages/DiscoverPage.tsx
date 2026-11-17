// 发现页 v2：一比一还原高保真原型
// 结构：搜索顶栏 → 标题 → 八大快捷分类 → 项目筛选 → 内容瀑布流 → 推荐导师 → 热门赛事
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CONTENTS, COURSES, DISCOVER_CATS, DISCOVER_MENTORS, EVENTS, MESSAGES, ORGS, USERS, userById } from '../data/db'
import { useApp } from '../store/store'
import Icon from '../components/Icon'
import { Avatar, BrandLogo, DiscoverGlyph, EmptyState, MockFooter } from '../components/ui'
import type { DiscoverGlyphType } from '../components/ui'
import { CourseRow, EventRow, FollowButton, PersonRow, fmt } from '../components/cards'

type Tile = 'project' | 'video' | 'athlete' | 'mentor' | 'course' | 'event' | 'school' | 'club'

const TILES: { key: Tile; label: string; glyph: DiscoverGlyphType }[] = [
  { key: 'project', label: '体育项目', glyph: 'wrestle' },
  { key: 'video', label: '视频内容', glyph: 'video' },
  { key: 'athlete', label: '运动员', glyph: 'athlete' },
  { key: 'mentor', label: '教练与导师', glyph: 'coach' },
  { key: 'course', label: '课程', glyph: 'course' },
  { key: 'event', label: '赛事', glyph: 'event' },
  { key: 'school', label: '体育学校', glyph: 'school' },
  { key: 'club', label: '俱乐部', glyph: 'club' },
]

function MsgBadge() {
  const readMsgs = useApp((s) => s.readMsgs)
  const unread = MESSAGES.filter((m) => m.unread && !readMsgs[m.id]).length
  if (!unread) return null
  return <span className="rb">{unread}</span>
}

/* 推荐导师卡的「+ 关注」按钮（浅蓝底样式，与原型一致） */
function MentorFollow({ id }: { id: string }) {
  const follows = useApp((s) => s.follows)
  const toggleFollow = useApp((s) => s.toggleFollow)
  const pushToast = useApp((s) => s.pushToast)
  const on = !!follows[id]
  return (
    <button
      className={`dm-follow-btn ${on ? 'on' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        const next = toggleFollow(id)
        pushToast(next ? '已关注（演示状态）' : '已取消关注（演示状态）')
      }}
    >
      {!on && <Icon name="plus" size={12} />}
      {on ? '已关注' : '关注'}
    </button>
  )
}

export default function DiscoverPage() {
  const nav = useNavigate()
  const [tile, setTile] = useState<Tile>('project')
  const [cat, setCat] = useState<string>('全部')
  const pushToast = useApp((s) => s.pushToast)
  const readMsgs = useApp((s) => s.readMsgs)
  void readMsgs

  const feed = useMemo(() => {
    if (tile !== 'project' && tile !== 'video') return []
    const list = CONTENTS.filter((c) => c.photo)
    if (cat === '全部') return list
    return list.filter((c) => c.cats?.includes(cat))
  }, [tile, cat])

  const mentors = DISCOVER_MENTORS.map((id) => userById(id)!)
  const isFeed = tile === 'project' || tile === 'video'
  const unread = MESSAGES.filter((m) => m.unread && !readMsgs[m.id]).length

  return (
    <>
      {/* 顶部：Logo / 搜索 / 通知 */}
      <div className="v2-top">
        <BrandLogo small />
        <div className="search-pill" onClick={() => nav('/search')}>
          <Icon name="search" size={16} />
          <span>搜索运动员、导师、课程...</span>
        </div>
        <button className="bell-btn" onClick={() => nav('/messages')} aria-label="通知">
          <Icon name="bell" size={21} />
          {unread > 0 && <span className="rb">{unread}</span>}
        </button>
      </div>

      <div className="page" style={{ paddingTop: 0 }}>
        <div className="disc-title">
          发现<span className="slash">/</span>
          <span className="sub">探索更多体育精彩</span>
          <span className="slash">/</span>
        </div>

        {/* 八大快捷分类 */}
        <div className="cat-tiles">
          {TILES.slice(0, 5).map((t) => (
            <button key={t.key} className={`cat-tile ${tile === t.key ? 'active' : ''}`} onClick={() => setTile(t.key)}>
              <span className="ic">
                <DiscoverGlyph type={t.glyph} size={30} />
              </span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="cat-tiles" style={{ marginTop: 8 }}>
          {TILES.slice(5).map((t) => (
            <button key={t.key} className={`cat-tile ${tile === t.key ? 'active' : ''}`} onClick={() => setTile(t.key)}>
              <span className="ic">
                <DiscoverGlyph type={t.glyph} size={30} />
              </span>
              {t.label}
            </button>
          ))}
        </div>

        {/* 项目筛选（内容视图下生效） */}
        {isFeed && (
          <div className="filter-row">
            {['全部', ...DISCOVER_CATS].map((c) => (
              <button key={c} className={`filter-chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
                {c}
                {c !== '全部' && <Icon name="chevdown" size={12} />}
              </button>
            ))}
            <button className="filter-gear" onClick={() => pushToast('更多筛选为演示原型（分类已可直接切换）')}>
              <Icon name="filter" size={17} />
            </button>
          </div>
        )}

        {/* 内容区 */}
        {isFeed && (
          <>
            {feed.length === 0 ? (
              <EmptyState title="暂无相关内容" desc="当前筛选下没有内容（演示数据范围有限）。" icon="play" />
            ) : (
              <div className="wf-grid">
                {feed.map((c) => {
                  const author = userById(c.authorId)
                  return (
                    <div key={c.id} className="wf-card" onClick={() => nav(`/content/${c.id}`)}>
                      <div className="wf-photo">
                        <img src={c.photo} alt={c.title} />
                      </div>
                      <div className="wf-author">
                        <Avatar name={author?.name || '?'} color={author?.color || '#0765FE'} size="sm" />
                        <span className="ellipsis1">{author?.name}</span>
                        <span className="wf-views">
                          <Icon name="play" size={11} /> {fmt(c.metrics.views)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tile === 'athlete' && (
          <div className="list">
            {USERS.filter((u) => u.kind === 'athlete').map((u) => (
              <PersonRow key={u.id} u={u} right={<FollowButton targetId={u.id} />} onClick={() => nav(`/athlete/${u.id}`)} />
            ))}
          </div>
        )}

        {tile === 'mentor' && (
          <div className="list">
            {USERS.filter((u) => u.kind === 'mentor').map((u) => (
              <PersonRow key={u.id} u={u} right={<FollowButton targetId={u.id} />} onClick={() => nav(`/mentor/${u.id}`)} />
            ))}
          </div>
        )}

        {tile === 'course' && (
          <div className="list">
            {COURSES.map((k) => (
              <CourseRow key={k.id} k={k} />
            ))}
          </div>
        )}

        {tile === 'event' && (
          <div className="list">
            {EVENTS.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </div>
        )}

        {(tile === 'school' || tile === 'club') && (
          <div className="list">
            {ORGS.filter((o) => (tile === 'school' ? o.type === '体育学校' : o.type === '俱乐部')).map((o) => (
              <div key={o.id} className="row-item" onClick={() => nav(`/org/${o.id}`)}>
                <div className="msg-icon" style={{ background: `linear-gradient(135deg, ${o.colorA}, ${o.colorB})` }}>
                  <Icon name="building" size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex gap6">
                    <span className="t-title" style={{ fontSize: 13.5 }}>
                      {o.name}
                    </span>
                    <span className="badge badge-blue">{o.type}</span>
                  </div>
                  <div className="t-mini mt4 ellipsis1">{o.intro}</div>
                </div>
                <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
              </div>
            ))}
            <div className="demo-strip">体育学校与俱乐部均归属机构主页展示（场馆类型可在搜索中查看）。</div>
          </div>
        )}

        {/* 推荐导师（原型默认视图） */}
        {isFeed && (
          <>
            <div className="sec2">
              <div className="t">
                <span style={{ color: 'var(--blue-strong)' }}>/</span> 推荐导师
              </div>
              <button className="more" onClick={() => nav('/list/mentors')}>
                查看更多 <Icon name="arrow-r" size={12} />
              </button>
            </div>
            <div className="d-mentor-grid">
              {mentors.map((m) => (
                <div key={m.id} className="d-mentor" onClick={() => nav(`/mentor/${m.id}`)}>
                  <div className="dm-top">
                    <Avatar name={m.name} color={m.color} size="md" photo={m.photo} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="dm-name ellipsis1">{m.name}</div>
                      <div className="flex mt4">
                        <span className={`badge ${m.mentorInfo?.level.includes('高级') ? 'badge-senior' : 'badge-cert'}`}>
                          <Icon name="shield" size={8} /> {m.mentorInfo?.level.split('（')[0]}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="dm-spec ellipsis1">{m.title}</div>
                  <MentorFollow id={m.id} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* 热门赛事（原型默认视图：裁切横幅 1:1，整体可点进赛事详情） */}
        {isFeed && (
          <>
            <div className="sec2">
              <div className="t">热门赛事</div>
              <button className="more" onClick={() => nav('/list/events')}>
                查看更多 <Icon name="arrow-r" size={12} />
              </button>
            </div>
            <button className="banner-img" style={{ width: '100%' }} onClick={() => nav('/event/e1')} aria-label="全国青少年体育锦标赛 立即报名">
              <img src="img/disc_event.jpg?v=3" alt="全国青少年体育锦标赛" />
            </button>
          </>
        )}

        <MockFooter />
      </div>
    </>
  )
}
