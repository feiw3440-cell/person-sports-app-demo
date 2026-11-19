// 商业化 / 订单管理：服务端权威订单状态、模拟支付与退款审核（F-2）
// 金额全部来自服务端订单快照（整数分），前端仅做展示格式化。
import { useState } from 'react'
import { App, Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { getRaw, post } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'
import { hasPerm } from '@/store/auth'

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  created: { label: '待支付（模拟）', color: 'default' },
  paid: { label: '已支付', color: 'green' },
  refund_requested: { label: '退款申请中', color: 'orange' },
  refunded: { label: '已退款', color: 'red' },
  cancelled: { label: '已取消', color: 'default' },
}

/** 资金流水类型标签（含退款拆分冲减类型，兼容 history 数据与新增分录） */
const ENTRY_TYPE: Record<string, { label: string }> = {
  payment: { label: '支付收款' },
  platform_fee: { label: '平台服务费' },
  mentor_income: { label: '导师收入' },
  refund: { label: '退款（全额）' },
  platform_fee_refund: { label: '平台费冲减' },
  mentor_income_refund: { label: '导师收入冲减' },
}

export function yuan(cents: number | null | undefined): string {
  if (cents == null) return '-'
  return `¥${(cents / 100).toFixed(2)}`
}

export default function OrdersPage() {
  const { message, modal } = App.useApp()
  const [status, setStatus] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [ledgerFor, setLedgerFor] = useState<any | null>(null)
  const [ledger, setLedger] = useState<any[] | null>(null)
  const canSettle = hasPerm('revenue.settle')

  const fetch = useFetch(async () => {
    const q = new URLSearchParams({ page: String(page), page_size: '20' })
    if (status) q.set('status', status)
    return getRaw(`/orders?${q.toString()}`)
  }, [status, page])
  const rows = (fetch.data as any)?.data ?? []
  const meta = (fetch.data as any)?.meta ?? { total: 0 }

  const openLedger = async (row: any) => {
    setLedgerFor(row)
    // null=加载中 / []=（真正）空流水或接口失败；二者由 loading 与 emptyText 区分，不混淆
    setLedger(null)
    try {
      // 服务端返回 { data: LedgerRow[], meta: { total } }；client.get() 会解包一层 data，
      // 若用 get() 再取 .data 得到 undefined → 始终空表。这里用 getRaw 保留完整响应后显式取 data。
      const res = await getRaw<{ data?: unknown; meta?: { total?: number } }>(`/orders/${row.id}/ledger`)
      setLedger(Array.isArray(res?.data) ? (res.data as any[]) : [])
    } catch (e) {
      message.error(`读取订单流水失败：${(e as Error).message}`)
      setLedger([])
    }
  }

  const approveRefund = (row: any) => {
    let reason = ''
    modal.confirm({
      title: `同意退款：${row.order_no}`,
      content: (
        <Form layout="vertical">
          <Form.Item label="退款原因（必填，写入订单与审计）">
            <Input.TextArea onChange={(e) => { reason = e.target.value }} placeholder="如：用户申请，未开课" />
          </Form.Item>
          <Typography.Text type="secondary">模拟退款：全额原路退回为本地状态记录，不触发真实资金划转。</Typography.Text>
        </Form>
      ),
      onOk: async () => {
        if (!reason.trim()) { message.error('退款必须填写原因（留痕）'); throw new Error('reason required') }
        try {
          await post(`/orders/${row.id}/actions`, { action: 'refund', reason: reason.trim(), version: row.version })
          message.success('退款已完成（模拟），报名已撤销并通知用户')
          fetch.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }

  return (
    <PageWrap fetch={fetch}>
      <Card
        title="商业化 / 订单管理"
        extra={
          <Space>
            <Select placeholder="订单状态" allowClear style={{ width: 150 }} value={status}
              onChange={(v) => { setStatus(v); setPage(1) }}
              options={Object.entries(ORDER_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
            <Button onClick={fetch.reload}>刷新</Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          dataSource={rows}
          loading={fetch.loading}
          pagination={{ current: page, pageSize: 20, total: meta.total, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: '订单号', dataIndex: 'order_no', width: 170, render: (v: string, r: any) => <Typography.Link onClick={() => openLedger(r)}>{v}</Typography.Link> },
            { title: '课程', dataIndex: 'course_name' },
            { title: '购买人', dataIndex: 'account_name', width: 140 },
            { title: '导师', dataIndex: 'mentor_name', width: 130 },
            { title: '实付', dataIndex: 'amount_cents', width: 110, render: yuan },
            { title: '平台费 / 导师收入', width: 170, render: (_: unknown, r: any) => <span>{yuan(r.platform_fee_cents)} / {yuan(r.mentor_amount_cents)}</span> },
            {
              title: '状态', dataIndex: 'status', width: 130,
              render: (v: string) => <Tag color={ORDER_STATUS[v]?.color}>{ORDER_STATUS[v]?.label ?? v}</Tag>,
            },
            { title: '结算', dataIndex: 'settled', width: 90, render: (v: number) => (v ? <Tag color="green">已结算</Tag> : <Tag>未结算</Tag>) },
            { title: '创建时间', dataIndex: 'created_at', width: 160, render: (v: string) => v?.slice(0, 16).replace('T', ' ') },
            {
              title: '动作', width: 170,
              render: (_: unknown, r: any) => (
                <Space>
                  <Button size="small" onClick={() => openLedger(r)}>流水</Button>
                  {r.status === 'refund_requested' && canSettle && (
                    <Button size="small" danger onClick={() => approveRefund(r)}>同意退款</Button>
                  )}
                  {r.status === 'refund_requested' && !canSettle && <Typography.Text type="secondary">待退款审核</Typography.Text>}
                </Space>
              ),
            },
          ]}
        />
        <Typography.Text type="secondary" className="workbench-note">
          订单金额与分成均由服务端按订单快照计算（整数分）；模拟支付/退款不接入真实支付网关。已结算订单不允许直接退款（冲正流程待产品决策）。
        </Typography.Text>
      </Card>

      <Drawer title={`订单资金流水 · ${ledgerFor?.order_no ?? ''}`} width={560} open={!!ledgerFor} onClose={() => setLedgerFor(null)}>
        {ledgerFor && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="课程">{ledgerFor.course_name}</Descriptions.Item>
              <Descriptions.Item label="金额（快照）">{yuan(ledgerFor.amount_cents)}（平台 {yuan(ledgerFor.platform_fee_cents)} · 导师 {yuan(ledgerFor.mentor_amount_cents)}）</Descriptions.Item>
              <Descriptions.Item label="费率快照">{Number(ledgerFor.fee_rate_snapshot) * 100}%</Descriptions.Item>
              <Descriptions.Item label="状态"><StatusTag status={ledgerFor.status} /></Descriptions.Item>
              {ledgerFor.refund_reason && <Descriptions.Item label="退款原因">{ledgerFor.refund_reason}</Descriptions.Item>}
            </Descriptions>
            <Table
              size="small" rowKey="id" pagination={false} loading={ledger === null}
              dataSource={ledger ?? []}
              locale={{ emptyText: ledger === null ? '加载中…' : '该订单暂无资金流水' }}
              columns={[
                { title: '类型', dataIndex: 'entry_type', width: 130, render: (v: string) => ENTRY_TYPE[v]?.label ?? v },
                { title: '金额', dataIndex: 'amount_cents', width: 110, render: yuan },
                { title: '关联订单', width: 170, render: () => ledgerFor?.order_no ?? '-' },
                { title: '说明 / 操作记录', dataIndex: 'memo' },
                { title: '时间', dataIndex: 'created_at', width: 150, render: (v: string) => v?.slice(0, 16).replace('T', ' ') },
              ]}
            />
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
              流水为追加式账本（支付收款 / 平台服务费 / 导师收入 / 退款及冲减），不可修改；每笔操作均留痕。
            </Typography.Text>
          </>
        )}
      </Drawer>
    </PageWrap>
  )
}
