// 商业化 / 收入与结算（F-4）：概览、收入明细、待结算、模拟结算、结算记录
// 所有金额由服务端按订单快照计算；前端仅格式化展示，不参与金额计算。
import { useState } from 'react'
import { App, Button, Card, Col, Descriptions, Drawer, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd'
import { get, getRaw, newIdempotencyKey, patch, post } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'
import { hasPerm, useAuth } from '@/store/auth'

const fmt = (cents: number | null | undefined) => (cents == null ? '-' : `¥${(cents / 100).toFixed(2)}`)

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  paid: { text: '已支付', color: 'green' },
  refund_requested: { text: '退款申请中', color: 'orange' },
  refunded: { text: '已退款', color: 'red' },
}

export default function RevenuePage() {
  const { message } = App.useApp()
  const me = useAuth((s) => s.me)
  const [tab, setTab] = useState('summary')
  const [settleOpen, setSettleOpen] = useState(false)
  const [mentorId, setMentorId] = useState<string | undefined>()
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)
  const [feeOpen, setFeeOpen] = useState(false)
  const [feePercent, setFeePercent] = useState(10)
  const identities = (me?.identities ?? []) as { identity_type: string }[]
  const isPlatformAdmin = identities.some((i) => i.identity_type === 'platform_admin')

  const summary = useFetch(() => get('/revenue/summary'), [])
  const orders = useFetch(() => getRaw('/revenue/orders?page_size=100'), [])
  const pending = useFetch(() => getRaw('/revenue/pending'), [])
  const settlements = useFetch(() => getRaw('/revenue/settlements'), [])
  const canSettle = hasPerm('revenue.settle')

  const s = (summary.data ?? {}) as any
  const pendingData = (pending.data ?? {}) as any
  const mentors: any[] = pendingData.mentors ?? []
  const orderRows: any[] = ((orders.data as any)?.data ?? []) as any[]
  const settlementRows: any[] = ((settlements.data as any)?.data ?? []) as any[]

  const reloadAll = () => {
    summary.reload(); orders.reload(); pending.reload(); settlements.reload()
  }

  const doSettle = async () => {
    const target = mentorId ?? (mentors.length === 1 ? mentors[0].mentor_account_id : undefined)
    if (!target) { message.error('请选择要结算的导师'); return }
    setSaving(true)
    try {
      const res = await post('/revenue/settlements', {
        mentor_account_id: target,
        period_start: periodStart || undefined,
        period_end: periodEnd || undefined,
      }, newIdempotencyKey())
      message.success(`已生成结算单 ${res.settlement_no}（模拟，无真实资金划转）`)
      setSettleOpen(false); setMentorId(undefined); setPeriodStart(''); setPeriodEnd('')
      reloadAll()
    } catch (e) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const openDetail = async (row: any) => {
    try {
      const d = await get(`/revenue/settlements/${row.id}`)
      setDetail(d)
    } catch (e) { message.error((e as Error).message) }
  }

  const saveFee = async () => {
    if (feePercent < 0 || feePercent > 50) { message.error('演示费率范围为 0% - 50%'); return }
    setSaving(true)
    try {
      await patch('/revenue/config', { fee_rate: Math.round(feePercent * 10) / 1000 })
      message.success('演示费率已更新：仅影响之后创建的新订单')
      setFeeOpen(false)
      summary.reload()
    } catch (e) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const tabItems = [
    {
      key: 'summary',
      label: '收入概览',
      children: (
        <>
          <Row gutter={[12, 12]}>
            <Col span={6}><Card size="small"><Statistic title="已支付总额（快照）" value={s.gross_paid_cents ?? 0} formatter={(v) => fmt(Number(v))} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="退款总额（模拟）" value={s.refunded_cents ?? 0} formatter={(v) => fmt(Number(v))} valueStyle={{ color: '#cf1322' }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="平台净收入" value={s.platform_income_cents ?? 0} formatter={(v) => fmt(Number(v))} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="导师净收入" value={s.mentor_income_cents ?? 0} formatter={(v) => fmt(Number(v))} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="待结算（导师）" value={s.pending_settlement_cents ?? 0} formatter={(v) => fmt(Number(v))} valueStyle={{ color: '#d46b08' }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="已结算（导师）" value={s.settlement_total_cents ?? 0} formatter={(v) => fmt(Number(v))} valueStyle={{ color: '#389e0d' }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="有效订单数" value={s.order_count ?? 0} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="结算单数" value={s.settlement_count ?? 0} /></Card></Col>
          </Row>
          <Card
            size="small" style={{ marginTop: 16 }} title="平台服务费率（演示参数，待产品决策）"
            extra={isPlatformAdmin ? (
              <Button size="small" onClick={() => { setFeePercent(Math.round(Number(s.fee_rate ?? 0.1) * 1000) / 10); setFeeOpen(true) }}>调整演示费率</Button>
            ) : <Tag>仅平台管理员可调整</Tag>}
          >
            <Space size="large">
              <Statistic title="当前费率（仅影响新订单）" value={Number(s.fee_rate ?? 0.1) * 100} precision={1} suffix="%" />
              <Typography.Text type="secondary" style={{ maxWidth: 620 }}>
                {s.fee_note ?? '最终平台服务费与导师分成规则待产品决策。'} 历史订单已保存费率快照，不随配置回溯。
              </Typography.Text>
            </Space>
          </Card>
          <Card size="small" style={{ marginTop: 16 }} title="口径说明">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="平台服务费率">{s.fee_rate_label ?? '-'}（当前配置，演示参数）</Descriptions.Item>
              <Descriptions.Item label="费率规则">{s.fee_note ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="结算口径">{s.settlement_note ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="数据范围">
                {hasPerm('revenue.read') ? '按当前身份/组织上下文由服务端裁剪（导师本人 / 本组织 / 全平台）' : '无收入读取权限'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </>
      ),
    },
    {
      key: 'orders',
      label: '收入明细',
      children: (
        <Table
          rowKey="id" size="small" dataSource={orderRows} loading={orders.loading} pagination={{ pageSize: 12 }}
          columns={[
            { title: '订单号', dataIndex: 'order_no', width: 160 },
            { title: '课程', dataIndex: 'course_name' },
            { title: '导师', dataIndex: 'mentor_name', width: 120 },
            { title: '购买人', dataIndex: 'account_name', width: 130 },
            { title: '实付', dataIndex: 'amount_cents', width: 100, render: fmt },
            { title: '平台净额', dataIndex: 'platform_net_cents', width: 110, render: fmt },
            { title: '导师净额', dataIndex: 'mentor_net_cents', width: 110, render: fmt },
            { title: '费率快照', dataIndex: 'fee_rate_snapshot', width: 90, render: (v: string) => `${(Number(v) * 100).toFixed(0)}%` },
            { title: '状态', dataIndex: 'status', width: 120, render: (v: string) => <Tag color={STATUS_LABEL[v]?.color}>{STATUS_LABEL[v]?.text ?? v}</Tag> },
            { title: '结算', dataIndex: 'settled', width: 80, render: (v: number) => (v ? <Tag color="green">已结算</Tag> : <Tag>未结算</Tag>) },
          ]}
        />
      ),
    },
    {
      key: 'pending',
      label: `待结算${mentors.length ? `（${mentors.length} 位导师）` : ''}`,
      children: (
        <>
          <Card size="small" title="待结算导师汇总" extra={
            canSettle ? <Button type="primary" onClick={() => setSettleOpen(true)} disabled={mentors.length === 0}>模拟结算</Button> : <Typography.Text type="secondary">无结算权限</Typography.Text>
          }>
            <Table
              rowKey="mentor_account_id" size="small" dataSource={mentors} loading={pending.loading} pagination={false}
              columns={[
                { title: '导师', dataIndex: 'mentor_name' },
                { title: '待结算订单', dataIndex: 'order_count', width: 120 },
                { title: '待结算金额', dataIndex: 'pending_cents', width: 150, render: fmt },
              ]}
            />
          </Card>
          <Card size="small" title="待结算订单（已支付且未被结算引用）" style={{ marginTop: 16 }}>
            <Table
              rowKey="id" size="small" dataSource={pendingData.data ?? []} pagination={{ pageSize: 10 }}
              columns={[
                { title: '订单号', dataIndex: 'order_no', width: 160 },
                { title: '课程', dataIndex: 'course_name' },
                { title: '导师', dataIndex: 'mentor_name', width: 120 },
                { title: '实付', dataIndex: 'amount_cents', width: 100, render: fmt },
                { title: '导师收入', dataIndex: 'mentor_amount_cents', width: 110, render: fmt },
                { title: '支付时间', dataIndex: 'paid_at', width: 160, render: (v: string) => v?.slice(0, 16).replace('T', ' ') },
              ]}
            />
          </Card>
        </>
      ),
    },
    {
      key: 'settlements',
      label: '结算记录',
      children: (
        <Table
          rowKey="id" size="small" dataSource={settlementRows} loading={settlements.loading} pagination={{ pageSize: 12 }}
          columns={[
            { title: '结算单号', dataIndex: 'settlement_no', width: 190, render: (v: string, r: any) => <Typography.Link onClick={() => openDetail(r)}>{v}</Typography.Link> },
            { title: '导师', dataIndex: 'mentor_name', width: 130 },
            { title: '组织', dataIndex: 'org_name', width: 160, render: (v) => v || '-' },
            { title: '订单数', dataIndex: 'order_count', width: 90 },
            { title: '成交总额', dataIndex: 'gross_amount_cents', width: 120, render: fmt },
            { title: '平台费', dataIndex: 'platform_fee_cents', width: 110, render: fmt },
            { title: '导师结算', dataIndex: 'mentor_amount_cents', width: 120, render: fmt },
            { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag color="green">{v === 'settled' ? '已结算（模拟）' : v}</Tag> },
            { title: '操作人', dataIndex: 'settled_by_name', width: 130 },
            { title: '结算时间', dataIndex: 'settled_at', width: 160, render: (v: string) => v?.slice(0, 16).replace('T', ' ') },
          ]}
        />
      ),
    },
  ]

  return (
    <PageWrap fetch={summary}>
      <Card title="商业化 / 收入与结算" extra={<Button onClick={reloadAll}>刷新</Button>}>
        <Tabs activeKey={tab} onChange={setTab} items={tabItems} />
        <Typography.Text type="secondary" className="workbench-note">
          当前登录：{String(me?.display_name ?? '')}。结算为模拟口径，不触发真实资金划转；导师/组织之间数据范围由服务端裁剪。
          已结算订单不可直接退款（结算冲正待产品决策）。
        </Typography.Text>
      </Card>

      <Modal title="模拟结算" open={settleOpen} confirmLoading={saving} onOk={doSettle} onCancel={() => setSettleOpen(false)} destroyOnClose>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 6 }}>导师（待结算）</div>
            <Select
              style={{ width: '100%' }} placeholder="选择导师" value={mentorId} onChange={setMentorId}
              options={mentors.map((m) => ({ value: m.mentor_account_id, label: `${m.mentor_name} · ${fmt(m.pending_cents)} / ${m.order_count} 单` }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>支付日期范围（可选）</div>
            <Space>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              <span>至</span>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </Space>
          </div>
          <Typography.Text type="secondary">
            服务端将重新计算可结算订单与金额；已结算订单不会重复结算。模拟结算只生成本地结算记录。
          </Typography.Text>
        </Space>
      </Modal>

      <Modal title="调整平台服务费率（演示参数）" open={feeOpen} confirmLoading={saving} onOk={saveFee} onCancel={() => setFeeOpen(false)} destroyOnClose>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 6 }}>费率（%）</div>
            <InputNumber min={0} max={50} step={0.5} precision={1} value={feePercent} onChange={(v) => setFeePercent(Number(v ?? 0))} style={{ width: 180 }} addonAfter="%" />
          </div>
          <Typography.Text type="secondary">
            仅影响更新之后创建的新订单；订单会写入 fee_rate_snapshot，历史订单与已结算数据不回溯。
            该费率是演示参数，不是正式商业政策，正式费率与导师分成规则待产品决策。
          </Typography.Text>
        </Space>
      </Modal>

      <Drawer title={`结算单详情 · ${detail?.settlement_no ?? ''}`} width={720} open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="导师">{detail.mentor_name}</Descriptions.Item>
              <Descriptions.Item label="组织">{detail.org_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="成交总额">{fmt(detail.gross_amount_cents)}</Descriptions.Item>
              <Descriptions.Item label="平台服务费">{fmt(detail.platform_fee_cents)}</Descriptions.Item>
              <Descriptions.Item label="导师结算">{fmt(detail.mentor_amount_cents)}</Descriptions.Item>
              <Descriptions.Item label="订单数">{detail.order_count}</Descriptions.Item>
              <Descriptions.Item label="操作人">{detail.settled_by_name}</Descriptions.Item>
              <Descriptions.Item label="结算时间">{String(detail.settled_at).slice(0, 19).replace('T', ' ')}</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}><Tag color="green">已结算（模拟）</Tag></Descriptions.Item>
            </Descriptions>
            <Table
              size="small" rowKey="id" pagination={false} dataSource={detail.items ?? []}
              columns={[
                { title: '订单号', dataIndex: 'order_no', width: 160 },
                { title: '课程', dataIndex: 'course_name' },
                { title: '购买人', dataIndex: 'account_name', width: 130 },
                { title: '实付', dataIndex: 'amount_cents', width: 100, render: fmt },
                { title: '导师收入', dataIndex: 'mentor_amount_cents', width: 110, render: fmt },
                { title: '订单状态', dataIndex: 'order_status', width: 110, render: (v: string) => <StatusTag status={v} /> },
              ]}
            />
          </>
        )}
      </Drawer>
    </PageWrap>
  )
}
