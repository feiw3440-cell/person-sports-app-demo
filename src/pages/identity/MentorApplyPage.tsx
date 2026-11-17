// 导师申请：材料占位 + 审核中/通过/驳回/补充材料状态演示（PRD §7.2，不暗示真实审核）
import { useNavigate } from 'react-router-dom'
import { currentRole, useApp } from '../../store/store'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { MockFooter } from '../../components/ui'
import { Segmented } from '../../components/ui'

const STATUSES = ['审核中', '补充材料', '已通过', '已驳回'] as const
type S = (typeof STATUSES)[number]

export default function MentorApplyPage() {
  const nav = useNavigate()
  const status = useApp((s) => s.mentorApplyStatus)
  const setApplyStatus = useApp((s) => s.setApplyStatus)
  const role = currentRole()
  void role

  return (
    <>
      <DetailHeader title="导师申请" sub="准入与审核状态演示（PRD §7.2）" />
      <div className="page page-nofoot">
        <div className="card">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div className="t-title" style={{ fontSize: 14 }}>
              申请状态
            </div>
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

        {/* 演示控制 */}
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
          <div className="t-mini mt8">切换控制可预览不同审核状态下页面的呈现；实际审核流程不在此实现。</div>
        </div>

        {/* 申请材料占位 */}
        <div className="section">
          <div className="sec-head">
            <div className="sec-title">申请材料（占位）</div>
          </div>
          <div className="card">
            <MaterialRow icon="user" label="身份与资质证明" value="已上传（占位文件）" ok />
            <MaterialRow icon="medal" label="运动等级 / 执教经历" value="已上传（占位文件）" ok />
            <MaterialRow icon="doc" label="教学大纲 / 培养体系" value="已上传（占位文件）" ok />
            <MaterialRow icon="shield" label="安全与规范承诺" value="待签署（演示）" ok={false} />
          </div>
        </div>

        {/* 各状态的说明 */}
        {status === '补充材料' && (
          <div className="demo-strip" style={{ background: '#fff3e0', borderColor: '#ecd9a0' }}>
            补充材料提示（演示）：请补传「执教年限证明」，材料将在 3 个工作日内复核。
          </div>
        )}
        {status === '已通过' && (
          <div className="card mt12" style={{ border: '1.5px solid #bfe8cf' }}>
            <div className="flex gap6">
              <span className="badge badge-verified">已通过（演示）</span>
              <span className="badge badge-brand">认证导师（占位名称）</span>
            </div>
            <div className="t-sub mt8" style={{ lineHeight: 1.7 }}>
              本状态仅用于展示通过后的界面形态：<b>不代表真实资质审核已完成</b>，导师等级名称与晋级标准为演示占位。
            </div>
          </div>
        )}
        {status === '已驳回' && (
          <div className="card mt12" style={{ border: '1.5px solid #f3c1bb' }}>
            <div className="flex gap6">
              <span className="badge badge-unverified">已驳回（演示）</span>
            </div>
            <div className="t-sub mt8">驳回原因（演示）：教学大纲材料不完整。可修改后重新提交申请。</div>
            <button className="btn btn-primary btn-sm mt12" onClick={() => setApplyStatus('审核中')}>
              重新提交（演示）
            </button>
          </div>
        )}

        <div className="section">
          <div className="t-mini" style={{ lineHeight: 1.8 }}>
            规则说明：普通用户不能直接获得认证导师身份；导师等级（认证/高级/体系）准确名称、准入材料与晋级标准待产品负责人确认，当前均为演示占位。
          </div>
        </div>

        <MockFooter text="本页所有申请与审核状态均为演示模拟数据，不冒充真实认证" />
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

function MaterialRow({ icon, label, value, ok }: { icon: string; label: string; value: string; ok?: boolean }) {
  return (
    <div className="kv">
      <span className="k">
        <Icon name={icon} size={13} />
        材料
      </span>
      <span className="v" style={{ fontSize: 12.5 }}>
        {label}
        <div className="t-mini">{value}</div>
      </span>
      <span className={`badge ${ok ? 'badge-verified' : 'badge-pending'}`}>{ok ? '已提交' : '待完成'}</span>
    </div>
  )
}
