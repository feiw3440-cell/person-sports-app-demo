// 导师申请：API 模式走服务端真实申请（POST /v1/credentials → 平台审核 → identity 升级）；
// Mock 模式保留演示状态控制（开发隔离）。审核通过后身份页将出现可切换的认证导师身份。
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { currentRole, useApp } from '../../store/store'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { MockFooter, Segmented } from '../../components/ui'
import { api, ApiError } from '../../services/apiClient'
import { DATA_SOURCE } from '../../data/db'

const STATUSES = ['审核中', '补充材料', '已通过', '已驳回'] as const
type S = (typeof STATUSES)[number]

type MineRow = {
  id: string
  kind: string
  source: string
  evidence: string | null
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'resubmitted'
  reason: string | null
  reviewed_at: string | null
  created_at: string
  version: number
  identity_type: string
  label: string
  identity_status: 'active' | 'pending' | 'rejected' | 'disabled'
}

const STATUS_TEXT: Record<MineRow['status'], string> = {
  draft: '草稿', submitted: '审核中', under_review: '审核中', approved: '已通过', rejected: '已驳回', resubmitted: '审核中',
}

/** API 模式：服务端权威的申请与进度 */
function ApiApplyFlow() {
  const nav = useNavigate()
  const pushToast = useApp((s) => s.pushToast)
  const [rows, setRows] = useState<MineRow[] | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [kind, setKind] = useState('')
  const [evidence, setEvidence] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await api<{ data: MineRow[] }>('GET', '/credentials/mine')
      setRows(d.data)
      setLoadErr('')
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const mentorRows = (rows ?? []).filter((r) => r.identity_type === 'mentor')
  const latest = mentorRows[0]
  const activeMentor = mentorRows.some((r) => r.identity_status === 'active')
  const inProgress = !!latest && ['draft', 'submitted', 'under_review', 'resubmitted'].includes(latest.status) && !activeMentor

  const submit = async () => {
    if (!kind.trim()) {
      setSubmitErr('请填写资质名称')
      return
    }
    setSubmitting(true)
    setSubmitErr('')
    try {
      await api('POST', '/credentials', { kind: kind.trim(), source: 'app_self_apply', evidence: evidence.trim() || undefined }, { idempotency: true })
      pushToast('申请已提交，等待平台审核')
      setKind('')
      setEvidence('')
      await load()
    } catch (e) {
      if (e instanceof ApiError) setSubmitErr(e.code === 'APPLICATION_IN_PROGRESS' ? '已有进行中的申请（审核中）' : e.message)
      else setSubmitErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadErr && rows === null) {
    return (
      <div className="card state-box" style={{ padding: '16px 0' }}>
        <div className="sb-title">无法加载申请进度</div>
        <div className="sb-desc">{loadErr}</div>
        <button className="btn btn-primary btn-sm mt12" onClick={() => void load()}>重试</button>
      </div>
    )
  }
  if (rows === null) {
    return (
      <div className="card t-sub" style={{ padding: 18 }}>
        正在读取申请进度…
      </div>
    )
  }

  return (
    <>
      {activeMentor && (
        <div className="card" style={{ border: '1.5px solid #bfe8cf' }}>
          <div className="flex gap6">
            <span className="badge badge-verified">已通过</span>
            <span className="badge badge-brand">认证导师（等级名称占位）</span>
          </div>
          <div className="t-sub mt8" style={{ lineHeight: 1.7 }}>
            认证导师身份已开通，可在「身份管理」中切换为导师视角；导师等级名称与晋级标准待产品确认（占位）。
          </div>
        </div>
      )}

      {!activeMentor && latest && (
        <div className="card">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div className="t-title" style={{ fontSize: 14 }}>申请进度</div>
            <span className={`badge ${latest.status === 'approved' ? 'badge-verified' : latest.status === 'rejected' ? 'badge-unverified' : 'badge-pending'}`}>
              {STATUS_TEXT[latest.status]}
            </span>
          </div>
          <div className="timeline mt12" style={{ marginTop: 14 }}>
            <Step done label="提交申请材料" note={fmtTime(latest.created_at) + ' · ' + latest.kind} />
            <Step
              done={latest.status === 'approved'}
              label="平台审核"
              note={latest.status === 'rejected' ? '未通过' + (latest.reason ? '：' + latest.reason : '') : '审核由平台进行（PC 管理端）'}
            />
            <Step done={latest.status === 'approved'} label="获得认证导师身份" note={latest.status === 'approved' ? '身份已开通' : '待审核通过后开启'} />
          </div>
        </div>
      )}

      {activeMentor ? (
        <div className="demo-strip" style={{ background: '#eef8f0', borderColor: '#bfe8cf' }}>
          已拥有认证导师身份，无需再次申请；如需提交其他资质请从身份管理进入对应流程。
        </div>
      ) : inProgress ? (
        <div className="demo-strip" style={{ background: '#eef4ff', borderColor: '#c3d7f5' }}>
          申请审核中：资质审核由平台（PC 管理端）进行，通过后自动开通认证导师身份，无需重复提交。
        </div>
      ) : (
        <div className="section">
          <div className="sec-head">
            <div className="sec-title">{latest && latest.status === 'rejected' ? '重新提交申请' : '提交申请'}</div>
            <span className="badge badge-brand">服务端权威</span>
          </div>
          <div className="card">
            <div className="pub-field">
              <div className="t-mini">资质名称（必填）</div>
              <input
                className="pub-input"
                placeholder="如：摔跤执教经历与运动等级"
                value={kind}
                maxLength={100}
                onChange={(e) => setKind(e.target.value)}
              />
            </div>
            <div className="pub-field">
              <div className="t-mini">证明材料说明（文本；正式版接入材料上传）</div>
              <textarea
                className="pub-textarea mt4"
                rows={3}
                placeholder="如：省级摔跤比赛前八名 + 三年青少年执教经历"
                value={evidence}
                maxLength={300}
                onChange={(e) => setEvidence(e.target.value)}
              />
            </div>
            {submitErr && <div className="t-mini mt8" style={{ color: '#c0392b' }}>{submitErr}</div>}
            <button className="btn btn-primary btn-block mt12" disabled={submitting} onClick={() => void submit()}>
              {submitting ? '提交中…' : latest && latest.status === 'rejected' ? '重新提交申请' : '提交导师申请'}
            </button>
            <div className="t-mini mt8">提交后进入平台审核（身份置为待开通）；驳回可修改后重新提交。</div>
          </div>
        </div>
      )}

      <div className="section">
        <div className="t-mini" style={{ lineHeight: 1.8 }}>
          规则说明：普通用户不能直接获得认证导师身份；导师等级（认证/高级/体系）准确名称、准入材料与晋级标准待产品负责人确认，当前均为演示占位。
        </div>
      </div>
      <button className="btn btn-ghost btn-block" onClick={() => nav('/identity')}>返回身份管理</button>
    </>
  )
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso.slice(0, 16)
  }
}

export default function MentorApplyPage() {
  const nav = useNavigate()
  const status = useApp((s) => s.mentorApplyStatus)
  const setApplyStatus = useApp((s) => s.setApplyStatus)
  const role = currentRole()
  void role

  return (
    <>
      <DetailHeader title="导师申请" sub={DATA_SOURCE === 'api' ? '准入与审核（服务端权威 · PRD §7.2）' : '准入与审核状态演示（PRD §7.2）'} />
      <div className="page page-nofoot">
        {DATA_SOURCE === 'api' ? (
          <ApiApplyFlow />
        ) : (
          <>
            <div className="card">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <div className="t-title" style={{ fontSize: 14 }}>申请状态</div>
                <span className={`badge ${status === '审核中' ? 'badge-pending' : status === '已通过' ? 'badge-verified' : 'badge-unverified'}`}>
                  {status}（演示）
                </span>
              </div>
              <div className="timeline mt12" style={{ marginTop: 14 }}>
                <Step done label="提交申请材料" note="2026-11-15（演示时间）" />
                <Step done={status !== '审核中'} label="平台审核" note={status === '审核中' ? '正在审核中…' : status === '补充材料' ? '需要补充材料' : status === '已驳回' ? '未通过（演示）' : '已通过（演示）'} />
                <Step done={status === '已通过'} label="获得认证导师身份" note={status === '已通过' ? '演示状态：仅用于展示，不代表真实认证' : '待审核通过后开启'} />
              </div>
            </div>
            <div className="card mt12">
              <div className="sec-head" style={{ marginBottom: 8 }}>
                <div className="sec-title">状态演示控制</div>
                <span className="badge badge-mock">仅演示 · 非真实审核</span>
              </div>
              <Segmented
                small
                options={STATUSES.map((s) => ({ key: s, label: s }))}
                value={status}
                onChange={(v) => setApplyStatus(v as S)}
              />
              <div className="t-mini mt8">Mock 数据源下的演示控制；共享 API 模式下本页为真实申请流程。</div>
            </div>
            <MockFooter text="本页（Mock 模式）所有申请与审核状态均为演示模拟数据，不冒充真实认证" />
          </>
        )}
      </div>
    </>
  )
}

function Step({ done, label, note }: { done?: boolean; label: string; note: string }) {
  return (
    <div className="timeline-item">
      <div className="tl-dot" style={{ background: done ? 'var(--teal)' : 'var(--ink-3)' }} />
      <div>
        <div className="flex gap6">
          <span className="t-title" style={{ fontSize: 13.5 }}>
            {label}
          </span>
          {done && <Icon name="check" size={14} style={{ color: 'var(--teal)' }} />}
        </div>
        <div className="t-mini mt4">{note}</div>
      </div>
    </div>
  )
}
