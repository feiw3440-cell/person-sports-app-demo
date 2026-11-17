// 系统管理：账号身份 / 操作日志（platform_admin，服务端强校验）
import { useState } from 'react'
import { App, Button, Card, Input, Popconfirm, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { get, post } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'

export default function AdminPage() {
  const [tab, setTab] = useState('accounts')
  return (
    <Card title="系统管理（平台管理员 · 服务端强校验）">
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'accounts', label: '账号与身份', children: <AccountsPanel /> },
        { key: 'audit', label: '操作日志（审计）', children: <AuditPanel /> },
      ]} />
    </Card>
  )
}

function AccountsPanel() {
  const { modal } = App.useApp()
  const [keyword, setKeyword] = useState('')
  const fetch = useFetch(async () => get(`/admin/accounts${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`), [keyword])
  return (
    <PageWrap fetch={fetch}>
      <Input.Search placeholder="登录名 / 姓名" allowClear style={{ width: 240, marginBottom: 12 }} onSearch={setKeyword} />
      <Table
        size="small"
        rowKey="id"
        dataSource={fetch.data as any[]}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: '姓名', dataIndex: 'display_name' },
          { title: '登录名', dataIndex: 'login_name' },
          { title: '身份', dataIndex: 'identity_types', render: (v: string) => (v ? v.split(',').map((t) => <Tag key={t} color="blue">{t}</Tag>) : '-') },
          { title: '组织', dataIndex: 'orgs', render: (v: string) => (v ? v.split(',').map((o) => <Tag key={o}>{o}</Tag>) : '-') },
          { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v === 'active' ? 'active' : 'revoked'} /> },
          {
            title: '动作', width: 110,
            render: (_: unknown, r: any) => (
              <Popconfirm
                title={`${r.status === 'active' ? '停用' : '启用'}账号（高风险操作，需填原因并写审计）`}
                description={<Input id="admin-reason" placeholder="原因（必填）" style={{ width: 200, marginTop: 8 }} />}
                onConfirm={async () => {
                  const reason = (document.getElementById('admin-reason') as HTMLInputElement)?.value
                  if (!reason) { message.error('必须填写原因（审计）'); throw new Error('reason') }
                  try {
                    await post(`/admin/accounts/${r.id}/actions`, { action: r.status === 'active' ? 'disable' : 'enable', reason })
                    message.success('已执行（审计已记录）')
                    fetch.reload()
                  } catch (e) { message.error((e as Error).message) }
                }}
              >
                <Button size="small" danger={r.status === 'active'}>{r.status === 'active' ? '停用' : '启用'}</Button>
              </Popconfirm>
            ),
          },
        ]}
      />
    </PageWrap>
  )
}

function AuditPanel() {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const fetch = useFetch(async () => {
    const q = new URLSearchParams({ page: String(page), page_size: '15' })
    if (action) q.set('action', action)
    return get(`/admin/audit-logs?${q.toString()}`)
  }, [action, page])
  const d = fetch.data as any
  return (
    <PageWrap fetch={fetch}>
      <Space style={{ marginBottom: 12 }}>
        <Input.Search placeholder="动作（如 enrollment.approve）" allowClear style={{ width: 260 }} onSearch={(v) => { setAction(v); setPage(1) }} />
        <Typography.Text type="secondary">共 {d?.meta?.total ?? 0} 条</Typography.Text>
      </Space>
      <Table
        size="small"
        rowKey="id"
        loading={fetch.loading}
        dataSource={d?.rows ?? []}
        pagination={{ current: page, pageSize: 15, total: d?.meta?.total ?? 0, onChange: setPage }}
        columns={[
          { title: '时间', dataIndex: 'created_at', width: 150, render: (v: string) => v?.slice(0, 19).replace('T', ' ') },
          { title: '操作者', dataIndex: 'actor_name', width: 130 },
          { title: '动作', dataIndex: 'action', width: 170, render: (v: string) => <Tag>{v}</Tag> },
          { title: '对象', width: 150, render: (_: unknown, r: any) => `${r.resource_type}${r.resource_id ? `:${String(r.resource_id).slice(0, 12)}` : ''}` },
          { title: '来源端', dataIndex: 'client', width: 80, render: (v: string) => <Tag>{v}</Tag> },
          { title: '原因', dataIndex: 'reason', ellipsis: true },
          {
            title: '前后值', ellipsis: true,
            render: (_: unknown, r: any) => (
              <Typography.Text style={{ fontSize: 12 }} type="secondary">
                {r.before_json ? `前 ${JSON.stringify(JSON.parse(r.before_json))}` : ''} {r.after_json ? `→ 后 ${JSON.stringify(JSON.parse(r.after_json))}` : ''}
              </Typography.Text>
            ),
          },
        ]}
      />
    </PageWrap>
  )
}
