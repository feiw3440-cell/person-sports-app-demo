// 内容详情：视频/图文占位 + 作者 + 互动 + 评论示例（PRD §5.4）
import { useParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { contentById, projectById, userById } from '../../data/db'
import { useApp } from '../../store/store'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { Avatar, EmptyState, MockFooter, MockTag, VerifyBadge } from '../../components/ui'
import { fmt } from '../../components/cards'

const COMMENTS = [
  { id: 'cm1', user: '小李', color: '#00897B', text: '讲得很清楚，跟着练了两周，动作稳定多了（模拟评论）。', time: '2小时前' },
  { id: 'cm2', user: '小周', color: '#7E57C2', text: '请问下期进阶课程什么时候出？已收藏！（模拟评论）', time: '5小时前' },
  { id: 'cm3', user: '阿体', color: '#2872B8', text: '来自演示账号的评论示例，评论功能为本地模拟。', time: '昨天' },
]

export default function ContentDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const c = contentById(id || '')
  const likes = useApp((s) => s.likes)
  const favs = useApp((s) => s.favs)
  const follows = useApp((s) => s.follows)
  const toggleLike = useApp((s) => s.toggleLike)
  const toggleFav = useApp((s) => s.toggleFav)
  const toggleFollow = useApp((s) => s.toggleFollow)
  const pushToast = useApp((s) => s.pushToast)

  if (!c) return <EmptyState title="内容不存在" desc="演示数据中未找到该内容。" />
  const author = userById(c.authorId)
  const project = projectById(c.projectId)
  const likeOn = !!likes[c.id]
  const favOn = !!favs[c.id]
  const followOn = !!follows[c.authorId]

  return (
    <>
      <DetailHeader title="内容详情" sub={project?.name} />
      <div className="page page-nofoot">
        {/* 视频/图文占位 */}
        {c.type === 'video' ? (
          <button
            className="video-box full"
            style={{ background: `linear-gradient(135deg, ${c.colorA}, ${c.colorB})` }}
            onClick={() => pushToast('演示提示：视频播放为占位交互，未接入真实视频服务')}
          >
            <div className="vb-mask" />
            <div className="vb-play">
              <Icon name="play" size={26} filled />
            </div>
            <span className="vb-tip">视频占位 · {c.duration} · 演示数据</span>
          </button>
        ) : (
          <div className="cover" style={{ background: `linear-gradient(135deg, ${c.colorA}, ${c.colorB})`, height: 150 }}>
            <div style={{ padding: 18, position: 'relative', zIndex: 1 }}>
              <span className="badge badge-lime">图文</span>
            </div>
          </div>
        )}

        <div className="card mt12">
          <div className="t-title" style={{ fontSize: 17, lineHeight: 1.45 }}>
            {c.title}
          </div>
          <div className="flex gap8 mt8 wrap">
            <span className="tag">{project?.name}</span>
            <span className="tag">{c.type === 'video' ? '视频' : '图文'}</span>
            <MockTag text="演示内容" />
          </div>
          <div className="t-mini mt8">
            发布于 {c.publishAt} · 模拟互动：观看 {fmt(c.metrics.views)} · 点赞 {fmt(c.metrics.likes)} · 收藏 {fmt(c.metrics.favs)} · 评论 {fmt(c.metrics.comments)}
          </div>
          <div className="divider" />
          <div className="t-sub" style={{ lineHeight: 1.7 }}>
            {c.summary}
          </div>
          <div className="t-mini mt8" style={{ color: 'var(--ink-3)' }}>
            正文为演示占位内容：此处展示训练方法、技术要点与运动员故事等完整内容。
          </div>
        </div>

        {/* 作者卡 */}
        <div className="row-item mt12" onClick={() => nav(author?.kind === 'mentor' ? `/mentor/${author.id}` : `/athlete/${author.id}`)}>
          <Avatar name={author?.name || '?'} color={author?.color || '#12345B'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex gap6">
              <span className="t-title">{author?.name}</span>
              <VerifyBadge verify={author?.verify || 'pending'} />
              {author?.kind === 'mentor' && <span className="badge badge-brand">认证导师</span>}
            </div>
            <div className="t-mini mt4">
              {author?.title} · 粉丝 {fmt(author?.followers || 0)}（模拟）
            </div>
          </div>
          <button
            className={`btn btn-sm ${followOn ? 'btn-ghost-gray btn-followed' : 'btn-primary'}`}
            onClick={(e) => {
              e.stopPropagation()
              const next = toggleFollow(c.authorId)
              pushToast(next ? '已关注（演示状态）' : '已取消关注（演示状态）')
            }}
          >
            {followOn ? '已关注' : '关注'}
          </button>
        </div>

        {/* 互动按钮 */}
        <div className="card mt12 flex" style={{ justifyContent: 'space-around' }}>
          <button
            className="flex gap6"
            style={{ color: likeOn ? 'var(--coral)' : 'var(--ink-2)', fontWeight: 700 }}
            onClick={() => {
              const next = toggleLike(c.id)
              pushToast(next ? '已点赞（演示状态）' : '已取消点赞（演示状态）')
            }}
          >
            <Icon name="heart" size={20} filled={likeOn} />
            {fmt(c.metrics.likes + (likeOn ? 1 : 0))}
          </button>
          <button
            className="flex gap6"
            style={{ color: favOn ? 'var(--orange)' : 'var(--ink-2)', fontWeight: 700 }}
            onClick={() => {
              const next = toggleFav(c.id)
              pushToast(next ? '已收藏（演示状态）' : '已取消收藏（演示状态）')
            }}
          >
            <Icon name="star" size={20} filled={favOn} />
            {fmt(c.metrics.favs + (favOn ? 1 : 0))}
          </button>
          <button
            className="flex gap6"
            style={{ color: 'var(--ink-2)', fontWeight: 700 }}
            onClick={() => pushToast('分享为演示交互（未接入外部服务）')}
          >
            <Icon name="share" size={20} />
            分享
          </button>
        </div>

        {/* 评论示例 */}
        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            评论（{COMMENTS.length} · 模拟）
          </div>
          {COMMENTS.map((cm) => (
            <div key={cm.id} className="comment-item">
              <Avatar name={cm.user} color={cm.color} size="sm" />
              <div style={{ flex: 1 }}>
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <span className="t-mini t-bold">{cm.user}</span>
                  <span className="t-mini">{cm.time}</span>
                </div>
                <div className="t-sub" style={{ marginTop: 2 }}>
                  {cm.text}
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost-gray btn-sm btn-block mt8" onClick={() => pushToast('评论输入为演示交互（模拟环境）')}>
            发表评论（演示）
          </button>
        </div>

        <MockFooter />
      </div>
    </>
  )
}
