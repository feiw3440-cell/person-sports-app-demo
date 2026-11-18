// 资质审核中心：GET /v1/credentials（review 权限）列表 + 审核动作（通过/驳回→identity 升级/拒绝）
// 与 APP「导师申请」闭环：APP 提交 → 本页审核 → identity 置 active → APP 身份页可切换导师
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Form, Input, Modal, Segmented, Space, Table, Tag, Typography, message } from 'antd'
import { get, post } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'

const KIND_LABELS: Record<string, string> = {
  mentor: '导师', coach: '教练', athlete: '运动员',
}

const STATUS_OPTIONS = [
  { value: 'submitted', label: '待审核（submitted）' },
  { value: 'under_review', label: '审核中（under_review）' },
  { value: 'approved', label: '已通过（approved）' },
  { value: 'rejected', label: '已驳回（rejected）' },
  { value: 'resubmitted', label: '重新提交（resubmitted）' },
] as const

const STATUS_MAP: Record<string, string> = {
  submitted: 'pending', under_review: 'pending', resubmitted: 'pending', approved: 'approved', rejected: 'rejected',
}

export default function CredentialsPage() {
  const nav = useNavigate()
  const [status, setStatus] = useState<string>('submitted')
  const list = useFetch(async () => {
    const q = new URLSearchParams({ status, page_size: '50' })
    return get(`/credentials?${q.toString()}`)
  }, [status])

  const review = (credId: string, action: 'approve' | 'reject') => {
    let reason = ''
    Modal.confirm({
      title: action === 'approve' ? '通过资质（对应身份将开通）' : '驳回资质',
      content: (
        <Form layout="vertical">
          <Form.Item label={action === 'approve' ? '审核意见（留痕）' : '驳回原因（必填，将展示给申请人）'}>
            <Input.TextArea onChange={(e) => { reason = e.target.value }} />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (action === 'reject' && !reason) { message.error('驳回必须填写原因'); throw new Error('reason required') }
        try {
          await post(`/credentials/${credId}/actions`, { action, reason: reason || '审核通过' })
          message.success(action === 'approve' ? '已通过：身份已开通（申请人刷新 APP 可见）' : '已驳回（申请人可修改后重新提交）')
          list.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }

  const startReview = async (credId: string) => {
    try {
      await post(`/credentials/${credId}/actions`, { action: 'start_review' })
      message.success('已开始审核')
      list.reload()
    } catch (e) { message.error((e as Error).message) }
  }

  // PC client 自动解包 { data, meta } → data 数组；total 以当前页行数计（page_size=50 覆盖演示规模）
  const rows = ((list.data ?? []) as unknown) as Array<Record<string, unknown>>

  return (
    <PageWrap fetch={list}>
      <Card
        title="资质审核中心"
        extra={
          <Space>
            <Segmented
              value={status}
              onChange={(v) => setStatus(v as string)}
              options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label.split('（')[0] }))}
            />
          </Space>
        }
      >
        <Table
          rowKey="id"
          dataSource={rows as Array<Record<string, unknown>>}
          pagination={{ pageSize: 10, total: rows.length }}
          columns={[
            { title: '申请人', dataIndex: 'display_name', width: 130 },
            { title: '身份类型', dataIndex: 'identity_type', width: 90, render: (v: string) => <Tag color="geekblue">{KIND_LABELS[v] ?? v}</Tag> },
            { title: '资质名称', dataIndex: 'kind' },
            { title: '来源', dataIndex: 'source', width: 120 },
            { title: '证据说明', dataIndex: 'evidence', ellipsis: true, render: (v: unknown) => (v ? String(v) : <Typography.Text type="secondary">（未填写）</Typography.Text>) },
            { title: '身份状态', dataIndex: 'identity_status', width: 90, render: (v: string) => <StatusTag status={STATUS_MAP[v] ?? v} /> },
            { title: '申请时间', dataIndex: 'created_at', width: 110, render: (v: string) => v?.slice(0, 10) },
            {
              title: '操作',
              width: 220,
              render: (_: unknown, r: Record<string, unknown>) => {
                const id = String(r.id)
                const st = String(r.status)
                const pendingActions = ['submitted', 'resubmitted'].includes(st)
                const underReview = st === 'under_review'
                return (
                  <Space size="small">
                    {!!r.profile_id && <Button size="small" type="link" onClick={() => nav(`/people/${String(r.profile_id)}`)}>档案</Button>}
                    {pendingActions && <Button size="small" onClick={() => void startReview(id)}>开始审核</Button>}
                    {(pendingActions || underReview) && (
                      <>
                        <Button size="small" type="primary" onClick={() => review(id, 'approve')}>通过</Button>
                        <Button size="small" danger onClick={() => review(id, 'reject')}>驳回</Button>
                      </>
                    )}
                    {st === 'approved' && <Tag color="green">已开通</Tag>}
                    {st === 'rejected' && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{String(r.reason ?? '已驳回')}</Typography.Text>}
                  </Space>
                )
              },
            },
          ]}
        />
        <Typography.Text type="secondary" className="workbench-note">
          审核通过后关联身份自动转为开通（identities.status=active），申请人在 APP 刷新即可切换该身份；驳回须填写原因并展示给申请人。全部动作写入审计留痕。
        </Typography.Text>
      </Card>
    </PageWrap>
  )
}
