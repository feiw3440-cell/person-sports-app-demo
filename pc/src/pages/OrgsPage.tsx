// 机构与组织：列表 / 详情（成员·邀请·岗位）/ 成员动作（accept/decline/revoke）
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App, Button, Card, Descriptions, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, UserAddOutlined } from '@ant-design/icons'
import { get, post } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'
import { useAuth } from '@/store/auth'

const ROLE_LABELS: Record<string, string> = { org_admin: '管理员', coach: '教练', member: '成员', athlete: '运动员' }
const ORG_TYPE_LABELS: Record<string, string> = { club: '俱乐部', school: '体育学校', venue: '场馆', association: '协会' }

export default function OrgsPage() {
  const { id } = useParams()
  if (id) return <OrgDetail id={id} />
  return <OrgList />
}

function OrgList() {
  const nav = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const fetch = useFetch(() => get('/organizations'), [])
  const data = fetch.data as any[]
  return (
    <PageWrap fetch={fetch}>
      <Card title="机构与组织" extra={<Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>创建组织</Button>}>
        <Table
          rowKey={(r: any) => r.id}
          dataSource={data ?? []}
          pagination={false}
          onRow={(r) => ({ onClick: () => nav(`/orgs/${r.id}`), style: { cursor: 'pointer' } })}
          columns={[
            { title: '组织', dataIndex: 'name', render: (v: string, r: any) => <Typography.Link onClick={() => nav(`/orgs/${r.id}`)}>{v}</Typography.Link> },
            { title: '类型', dataIndex: 'type', render: (v: string) => <Tag color="blue">{ORG_TYPE_LABELS[v] ?? v}</Tag> },
            { title: '地区', dataIndex: 'region', width: 100 },
            { title: '我的角色', dataIndex: 'my_role', render: (v: string) => (v ? <Tag>{ROLE_LABELS[v] ?? v}</Tag> : '（平台视角）') },
            { title: '我的状态', dataIndex: 'my_status', render: (v: string) => (v ? <StatusTag status={v} /> : '-') },
          ]}
        />
        <Typography.Text type="secondary" className="workbench-note">
          组织管理员仅能操作本组织；跨组织访问由服务端拒绝（默认拒绝原则）。无组织时可在成员邀请中输入登录名接受邀请，或创建新组织。
        </Typography.Text>
      </Card>
      <CreateOrgModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageWrap>
  )
}

function CreateOrgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm()
  return (
    <Modal title="创建组织（创建者成为管理员）" open={open} onCancel={onClose} destroyOnClose
      onOk={async () => {
        const v = await form.validateFields()
        try {
          await post('/organizations', v)
          message.success('组织已创建，您已成为管理员')
          onClose()
          window.location.reload()
        } catch (e) { message.error((e as Error).message) }
      }}>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="type" label="类型" rules={[{ required: true }]} initialValue="club">
          <Select options={[{ value: 'club', label: '俱乐部' }, { value: 'school', label: '体育学校' }, { value: 'venue', label: '场馆' }, { value: 'association', label: '协会' }]} />
        </Form.Item>
        <Form.Item name="region" label="地区" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="intro" label="介绍"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  )
}

function OrgDetail({ id }: { id: string }) {
  const nav = useNavigate()
  const { modal } = App.useApp()
  const orgId = useAuth((s) => s.orgId)
  const fetch = useFetch(async () => get(`/organizations/${id}`), [id])
  const members = useFetch(async () => get(`/organizations/${id}/members`), [id])
  const d = fetch.data as any
  const isAdmin = useAuth((s) => s.orgId === id && !!s.me?.perm_summary?.['members.invite'])

  const invite = () => {
    let loginName = ''
    let role = 'member'
    let position = ''
    modal.confirm({
      title: '邀请成员加入（生成 pending 邀请，对方在 APP/个人通知中接受）',
      content: (
        <Form layout="vertical">
          <Form.Item label="登录名"><Input placeholder="如 demo@local" onChange={(e) => { loginName = e.target.value }} /></Form.Item>
          <Form.Item label="组织角色">
            <Select defaultValue="member" style={{ width: '100%' }} onChange={(v) => { role = v }}
              options={Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          </Form.Item>
          <Form.Item label="岗位"><Input onChange={(e) => { position = e.target.value }} /></Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (!loginName) { message.error('登录名必填'); throw new Error('name required') }
        try {
          await post(`/organizations/${id}/invitations`, { login_name: loginName, role, position })
          message.success('邀请已发出（对方将收到通知）')
          members.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }

  return (
    <PageWrap fetch={fetch}>
      <Card
        title={<Space><Typography.Link onClick={() => nav('/orgs')}>机构与组织</Typography.Link> / {String(d?.name ?? '')}</Space>}
        extra={isAdmin && <Button type="primary" icon={<UserAddOutlined />} onClick={invite}>邀请成员</Button>}
      >
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="类型">{ORG_TYPE_LABELS[d?.type] ?? d?.type}</Descriptions.Item>
          <Descriptions.Item label="地区">{String(d?.region)}</Descriptions.Item>
          <Descriptions.Item label="成员数">{Number(d?.member_count)}</Descriptions.Item>
          <Descriptions.Item label="介绍" span={3}>{String(d?.intro ?? '-')}</Descriptions.Item>
        </Descriptions>
        <Card size="small" title="成员与岗位" style={{ marginTop: 16 }}>
          <Table size="small" rowKey="id" dataSource={members.data as any[]} pagination={false}
            columns={[
              { title: '姓名', dataIndex: 'display_name' },
              { title: '登录名', dataIndex: 'login_name' },
              { title: '组织角色', dataIndex: 'role', render: (v: string) => <Tag color="blue">{ROLE_LABELS[v] ?? v}</Tag> },
              { title: '岗位', dataIndex: 'position', render: (v) => v || '-' },
              { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
              { title: '有效期', dataIndex: 'valid_until', render: (v: string) => v?.slice(0, 10) ?? '-' },
              {
                title: '动作', width: 120,
                render: (_: unknown, r: any) => (
                  isAdmin ? (
                    <Space>
                      <Popconfirm title="撤销该成员/邀请？" onConfirm={async () => {
                        try { await post(`/memberships/${r.id}/actions`, { action: 'revoke', version: r.version, reason: '管理员撤销（演示）' }); members.reload() } catch (e) { message.error((e as Error).message) }
                      }}>
                        <Button size="small" danger>撤销</Button>
                      </Popconfirm>
                    </Space>
                  ) : null
                ),
              },
            ]} />
          <Typography.Text type="secondary" className="workbench-note">
            邀请状态机：pending → accepted/declined/expired/revoked；成员变动即时影响权限（perm_version 递增）。
            {orgId === id ? '（当前组织上下文即本组织）' : ''}
          </Typography.Text>
        </Card>
      </Card>
    </PageWrap>
  )
}
