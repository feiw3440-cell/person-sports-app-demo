// 课程详情（F-2/F-3 闭环）：服务端价格与购买（模拟支付）、报名、评价
// 原则：金额、订单状态、评价资格全部由服务端权威计算；APP 只展示与发起动作。
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useViewHistory } from '../../services/viewHistory'
import { courseById, projectById, userById } from '../../data/db'
import { useApp } from '../../store/store'
import { api } from '../../services/apiClient'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { EmptyState, InfoRow, MockFooter } from '../../components/ui'

interface MyEnroll {
  id: string
  course_id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed'
  reason: string | null
}

interface OrderRow {
  id: string
  order_no: string
  status: 'created' | 'paid' | 'refund_requested' | 'refunded' | 'cancelled'
  amount_cents: number
  platform_fee_cents: number
  mentor_amount_cents: number
  fee_rate_snapshot: string
  course_name?: string
  created_at: string
  paid_at: string | null
}

interface ReviewRow {
  id: string
  rating: number
  comment: string | null
  account_name: string
  created_at: string
}

interface ServerCourse {
  id: string
  name: string
  status: string
  format: string
  price_cents: number | null
  price_note: string | null
  review_count: number
  rating_avg: number | null
  outline: string[]
  mentor_name?: string
  org_name?: string | null
  audience?: string | null
  sessions?: string | null
  region?: string | null
}

const EN_LABEL: Record<string, string> = {
  pending: '已提交 · 待审核',
  approved: '报名通过',
  rejected: '报名被驳回',
  cancelled: '已取消',
  completed: '已完成',
}

const ORDER_LABEL: Record<string, string> = {
  created: '待支付',
  paid: '已支付',
  refund_requested: '退款申请中',
  refunded: '已退款',
  cancelled: '已取消',
}

function yuan(cents: number | null | undefined): string {
  return cents == null ? '-' : `¥${(cents / 100).toFixed(2)}`
}

function Stars({ n }: { n: number }) {
  return <span style={{ color: '#F5A623', letterSpacing: 1 }}>{'★'.repeat(n)}{'☆'.repeat(Math.max(0, 5 - n))}</span>
}

export default function CourseDetail() {
  const { id } = useParams()
  useViewHistory('course', id)
  const nav = useNavigate()
  const k = courseById(id || '')
  const pushToast = useApp((s) => s.pushToast)
  const [course, setCourse] = useState<ServerCourse | null>(null)
  const [myEn, setMyEn] = useState<MyEnroll | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [reviewMeta, setReviewMeta] = useState<{ review_count: number; rating_avg: number | null }>({ review_count: 0, rating_avg: null })
  const [myReviewId, setMyReviewId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [payOrder, setPayOrder] = useState<OrderRow | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const cid = id || ''
  const loadAll = useCallback(async () => {
    if (!cid) return
    const [courseRes, enRes, orderRes, reviewRes, mineRes] = await Promise.allSettled([
      api<{ data: ServerCourse }>('GET', `/courses/${cid}`),
      api<{ data: MyEnroll[] }>('GET', `/enrollments?course_id=${cid}&page_size=100`),
      api<{ data: OrderRow[] }>('GET', `/orders?course_id=${cid}&mine=1&page_size=50`),
      api<{ data: ReviewRow[]; meta: { review_count: number; rating_avg: number | null } }>('GET', `/courses/${cid}/reviews?page_size=50`),
      api<{ data: { id: string; course_id: string }[] }>('GET', '/reviews/mine'),
    ])
    if (courseRes.status === 'fulfilled') setCourse(courseRes.value.data)
    if (enRes.status === 'fulfilled') {
      setMyEn((enRes.value.data || []).find((r) => r.course_id === cid) ?? null)
    }
    if (orderRes.status === 'fulfilled') setOrders(orderRes.value.data || [])
    if (reviewRes.status === 'fulfilled') {
      setReviews(reviewRes.value.data || [])
      setReviewMeta({ review_count: reviewRes.value.meta?.review_count ?? 0, rating_avg: reviewRes.value.meta?.rating_avg ?? null })
    }
    if (mineRes.status === 'fulfilled') {
      const mine = (mineRes.value.data || []).find((r) => r.course_id === cid)
      setMyReviewId(mine?.id ?? null)
    }
  }, [cid])

  useEffect(() => { void loadAll() }, [loadAll])

  if (!k && !course) return <EmptyState title="课程不存在" />
  const title = course?.name || k?.name || '课程'
  const mentor = k ? userById(k.mentorId) : undefined
  const project = k ? projectById(k.projectId) : undefined
  const status = course?.status || ''
  const isPublished = !status || status === 'published'
  const priceCents = course ? course.price_cents : k?.priceCents
  const isPaidCourse = priceCents != null && priceCents > 0
  const activeOrder = orders.find((o) => ['created', 'paid', 'refund_requested'].includes(o.status)) ?? null
  const paidOrder = orders.find((o) => o.status === 'paid') ?? null
  const canReview = !!paidOrder && !myReviewId

  const doEnroll = async () => {
    if (busy || !cid) return
    setBusy(true)
    try {
      await api('POST', '/enrollments', { course_id: cid }, { idempotency: true })
      pushToast('报名已提交，等待导师/机构在 PC 工作台审核')
      await loadAll()
    } catch (err) {
      pushToast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const startBuy = async () => {
    if (busy || !cid) return
    setBusy(true)
    try {
      const res = await api<{ data: OrderRow }>('POST', '/orders', { course_id: cid }, { idempotency: true })
      setPayOrder({ ...res.data, course_name: title })
      await loadAll()
    } catch (err) {
      pushToast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const confirmPay = async () => {
    if (!payOrder || busy) return
    setBusy(true)
    try {
      await api('POST', `/orders/${payOrder.id}/actions`, { action: 'mock_pay' })
      pushToast('模拟支付成功，报名已自动通过')
      setPayOrder(null)
      await loadAll()
    } catch (err) {
      pushToast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitReview = async () => {
    if (busy || !cid) return
    setBusy(true)
    try {
      await api('POST', `/courses/${cid}/reviews`, { rating, comment: comment.trim() || undefined })
      pushToast('评价已发布')
      setReviewOpen(false)
      setComment('')
      setRating(5)
      await loadAll()
    } catch (err) {
      pushToast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DetailHeader title="课程详情" sub={project?.name} />
      <div className="page page-nofoot">
        <div
          className="cover"
          style={{
            background: `linear-gradient(130deg, ${project?.colorA || '#12345B'}, ${project?.colorB || '#2872B8'})`,
            height: 140,
          }}
        >
          <div style={{ padding: 18, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{title}</div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>
              {course?.format === 'online' || k?.format === '线上' ? '线上' : '线下'} · {course?.sessions || k?.sessions}
            </div>
          </div>
        </div>

        <div className="card mt12">
          <div className="flex gap8 wrap" style={{ alignItems: 'center' }}>
            <span className="badge badge-blue">{isPublished ? '已发布' : status}</span>
            {isPaidCourse && <span className="badge badge-brand">付费课程</span>}
            {!isPaidCourse && <span className="badge badge-verified">免费课程</span>}
            {reviewMeta.rating_avg != null && (
              <span className="badge badge-blue">★ {reviewMeta.rating_avg}（{reviewMeta.review_count}）</span>
            )}
          </div>
          <div className="mt12">
            <InfoRow icon="target" label="所属项目" value={project?.name || '-'} />
            <InfoRow icon="users" label="授课导师" value={course?.mentor_name || mentor?.name || '-'} />
            <InfoRow icon="user" label="适用对象" value={course?.audience || k?.audience || '-'} />
            <InfoRow icon="location" label="上课形式" value={`${course?.format === 'online' ? '线上' : '线下'} · ${course?.region || k?.region || '-'}`} />
            <InfoRow icon="calendar" label="课程安排" value={course?.sessions || k?.sessions || '-'} />
          </div>
        </div>

        {/* F-2 价格与交易区：金额来自服务端，客户端不参与计算 */}
        <div className="card mt12">
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div className="t-mini">课程价格</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--brand)' }}>
                {isPaidCourse ? yuan(priceCents) : '免费'}
              </div>
              {course?.price_note && <div className="t-mini mt4">{course.price_note}</div>}
              {isPaidCourse && (
                <div className="t-mini mt4">模拟支付 · 平台服务费由服务端按订单快照计算（当前演示费率 10%）</div>
              )}
            </div>
            {activeOrder && (
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${activeOrder.status === 'paid' ? 'badge-verified' : activeOrder.status === 'refund_requested' ? 'badge-pending' : 'badge-blue'}`}>
                  {ORDER_LABEL[activeOrder.status]}
                </span>
                <div className="t-mini mt4">{activeOrder.order_no}</div>
              </div>
            )}
          </div>

          <div className="mt16">
            {!isPublished ? (
              <div className="t-mini">课程当前状态为「{status}」，暂不可购买或报名。</div>
            ) : !isPaidCourse ? (
              myEn ? (
                <div className="card" style={{ boxShadow: 'none', background: 'var(--bg-2)' }}>
                  <span className={`badge ${myEn.status === 'approved' ? 'badge-brand' : myEn.status === 'rejected' ? 'badge-mock' : 'badge-blue'}`}>
                    {EN_LABEL[myEn.status] || myEn.status}
                  </span>
                  {myEn.reason && <div className="t-mini mt8">审核意见：{myEn.reason}</div>}
                </div>
              ) : (
                <button className="btn btn-primary btn-block" disabled={busy} onClick={doEnroll}>
                  {busy ? '提交中…' : '报名课程（免费）'}
                </button>
              )
            ) : activeOrder?.status === 'paid' ? (
              <div className="card" style={{ boxShadow: 'none', background: 'var(--bg-2)' }}>
                <div className="flex gap8 wrap">
                  <span className="badge badge-verified">已支付（模拟）</span>
                  {myEn && <span className="badge badge-brand">{EN_LABEL[myEn.status] || myEn.status}</span>}
                </div>
                <div className="t-mini mt8">
                  订单 {activeOrder.order_no} · 实付 {yuan(activeOrder.amount_cents)} · 支付时间 {activeOrder.paid_at?.slice(0, 16).replace('T', ' ') || '-'}
                </div>
                <button className="btn btn-ghost btn-sm btn-block mt12" onClick={() => nav('/list/my-orders')}>查看我的订单 / 申请退款</button>
              </div>
            ) : activeOrder?.status === 'refund_requested' ? (
              <div className="card" style={{ boxShadow: 'none', background: 'var(--bg-2)' }}>
                <span className="badge badge-pending">退款申请中</span>
                <div className="t-mini mt8">导师/机构处理后将通知你，可在「我的订单」查看进度。</div>
              </div>
            ) : activeOrder?.status === 'created' ? (
              <button className="btn btn-primary btn-block" disabled={busy} onClick={() => setPayOrder(activeOrder)}>
                继续支付（模拟）{yuan(activeOrder.amount_cents)}
              </button>
            ) : (
              <button className="btn btn-primary btn-block" disabled={busy} onClick={startBuy}>
                {busy ? '创建订单中…' : orders.some((o) => ['refunded', 'cancelled'].includes(o.status)) ? '重新购买课程' : '立即购买课程'}
              </button>
            )}
            {isPaidCourse && !activeOrder && (
              <div className="t-mini center mt8">下单后使用「模拟支付」完成购买；不会发生真实扣款。</div>
            )}
          </div>
        </div>

        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            教学内容大纲
          </div>
          <div className="mt12">
            {(course?.outline || k?.outline || []).map((o, i) => (
              <div key={i} className="flex mt8" style={{ gap: 10 }}>
                <span className="badge badge-blue">第 {i + 1} 单元</span>
                <span className="t-sub">{o}</span>
              </div>
            ))}
          </div>
        </div>

        {mentor && !course && (
          <div className="row-item mt12" onClick={() => nav(`/mentor/${mentor.id}`)}>
            <div className="avatar avatar-md" style={{ background: `linear-gradient(135deg, ${mentor.color}, ${mentor.color}CC)` }}>
              {mentor.name.slice(0, 1)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex gap6">
                <span className="t-title">{mentor.name}</span>
                <span className="badge badge-brand">认证导师</span>
              </div>
              <div className="t-mini mt4">{mentor.title} · 查看教学体系与全部课程</div>
            </div>
            <Icon name="arrow-r" size={16} style={{ color: 'var(--ink-3)' }} />
          </div>
        )}

        {/* F-3 评价区 */}
        <div className="card mt12">
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
              课程评价 {reviewMeta.review_count > 0 && <span className="t-mini">（{reviewMeta.review_count} 条 · 均分 {reviewMeta.rating_avg}）</span>}
            </div>
            {canReview && (
              <button className="btn btn-ghost btn-sm" onClick={() => setReviewOpen(true)}>写评价</button>
            )}
          </div>
          {myReviewId && <div className="t-mini mt8">你已评价过本课程（评价不可重复提交）。</div>}
          {reviews.length === 0 ? (
            <div className="t-mini mt12">暂无评价。完成支付后可发表第一条评价。</div>
          ) : (
            <div className="mt12">
              {reviews.map((r) => (
                <div key={r.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                  <div className="flex" style={{ justifyContent: 'space-between' }}>
                    <span className="t-title" style={{ fontSize: 13 }}>{r.account_name}</span>
                    <Stars n={r.rating} />
                  </div>
                  {r.comment && <div className="t-sub mt4">{r.comment}</div>}
                  <div className="t-mini mt4">{r.created_at.slice(0, 10)}</div>
                </div>
              ))}
            </div>
          )}
          {!canReview && !myReviewId && (
            <div className="t-mini mt8">评价资格：本人需存在该课程的已支付订单（退款后不可评价）。</div>
          )}
        </div>

        <MockFooter text="课程价格、订单、支付与评价均由共享权威 API 提供；支付/退款/结算为模拟口径，不接入真实资金。" />
      </div>

      {/* 模拟支付确认（底部抽屉） */}
      {payOrder && (
        <>
          <div className="sheet-mask" onClick={() => setPayOrder(null)} />
          <div className="sheet">
            <div className="sheet-head">
              <span className="sh-title">确认支付（模拟）</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPayOrder(null)}>关闭</button>
            </div>
            <div className="row-item" style={{ padding: 0 }}>
              <div style={{ flex: 1 }}>
                <div className="t-title" style={{ fontSize: 14 }}>{title}</div>
                <div className="t-mini mt4">订单号 {payOrder.order_no}</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--brand)' }}>{yuan(payOrder.amount_cents)}</div>
            </div>
            <div className="t-mini mt12">
              平台服务费 {yuan(payOrder.platform_fee_cents)} · 导师收入 {yuan(payOrder.mentor_amount_cents)}（费率快照 {Number(payOrder.fee_rate_snapshot) * 100}%）
            </div>
            <div className="t-mini mt4">这是模拟支付，不会调用真实支付网关，也不会发生真实扣款。</div>
            <button className="btn btn-primary btn-block mt16" disabled={busy} onClick={confirmPay}>
              {busy ? '支付处理中…' : `确认模拟支付 ${yuan(payOrder.amount_cents)}`}
            </button>
          </div>
        </>
      )}

      {/* 写评价（底部抽屉） */}
      {reviewOpen && (
        <>
          <div className="sheet-mask" onClick={() => setReviewOpen(false)} />
          <div className="sheet">
            <div className="sheet-head">
              <span className="sh-title">评价课程</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setReviewOpen(false)}>关闭</button>
            </div>
            <div className="t-sub">评分</div>
            <div className="flex gap8 mt8">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`btn btn-sm ${n <= rating ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setRating(n)}
                  aria-label={`${n} 星`}
                >
                  {n} 星
                </button>
              ))}
            </div>
            <div className="t-sub mt12">评价内容（可选，最多 500 字）</div>
            <textarea
              className="input mt8"
              style={{ width: '100%', minHeight: 90, resize: 'vertical' }}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="分享你的学习体验…"
            />
            <button className="btn btn-primary btn-block mt16" disabled={busy} onClick={submitReview}>
              {busy ? '提交中…' : '提交评价'}
            </button>
          </div>
        </>
      )}
    </>
  )
}
