// 体育项目中心：列表 / 详情（分类·标签·分支·竞赛小项·关联业务·版本历史）/ 主数据编辑（平台运营）
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { App, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Timeline, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { get, patch, post } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'
import { hasPerm } from '@/store/auth'

export default function ProjectsPage() {
  const { id } = useParams()
  if (id) return <ProjectDetail id={id} />
  return <ProjectList />
}

function ProjectList() {
  const nav = useNavigate()
  const { modal } = App.useApp()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const canWrite = hasPerm('projects.write')
  const fetch = useFetch(async () => {
    const q = new URLSearchParams()
    if (keyword) q.set('keyword', keyword)
    if (status) q.set('status', status)
    return get(`/projects?${q.toString()}`)
  }, [keyword, status])

  return (
    <PageWrap fetch={fetch}>
      <Card
        title="体育项目中心"
        extra={
          <Space>
            <Input.Search placeholder="名称 / 简介" allowClear onSearch={setKeyword} style={{ width: 220 }} />
            <Select placeholder="状态" allowClear style={{ width: 120 }} value={status} onChange={setStatus}
              options={[{ value: 'active', label: '生效中' }, { value: 'deprecated', label: '已停用' }, { value: 'draft', label: '草稿' }]} />
            {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建项目</Button>}
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={fetch.loading}
          dataSource={fetch.data as any[]}
          pagination={{ pageSize: 10, total: (fetch.data as any)?.length }}
          columns={[
            { title: '项目', dataIndex: 'name', render: (v: string, r: any) => (
              <Typography.Link onClick={() => nav(`/projects/${r.id}`)}>
                {v} <Tag>{r.slug}</Tag>
              </Typography.Link>
            ) },
            { title: '英文名', dataIndex: 'name_en', width: 140 },
            { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag status={v} /> },
            { title: '来源口径', dataIndex: 'source', ellipsis: true },
            { title: '版本', dataIndex: 'version', width: 70, render: (v: number) => `v${v}` },
            { title: '更新时间', dataIndex: 'updated_at', width: 120, render: (v: string) => v?.slice(0, 10) },
          ]}
        />
        <Typography.Text type="secondary" className="workbench-note">
          项目为核心主数据：分类 / 标签 / 分支 / 竞赛小项分别建模；变更保留版本历史；删除采用软停用（deprecated）。
        </Typography.Text>
      </Card>
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); modal.info({ title: '已创建（草稿）', content: '可在详情中补充分类/标签/分支并激活' }) }} />
    </PageWrap>
  )
}

function CreateProjectModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  return (
    <Modal title="新建体育项目" open={open} onCancel={onClose} destroyOnClose
      onOk={async () => {
        const v = await form.validateFields()
        setSaving(true)
        try {
          await post('/projects', { ...v, slug: v.slug || `p-${Date.now()}` })
          onDone()
        } catch (e) { message.error((e as Error).message) } finally { setSaving(false) }
      }}>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="name_en" label="多语言名（英文）"><Input /></Form.Item>
        <Form.Item name="intro" label="介绍"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="source" label="规则/资料来源（口径注明）"><Input /></Form.Item>
      </Form>
    </Modal>
  )
}

function ProjectDetail({ id }: { id: string }) {
  const nav = useNavigate()
  const fetch = useFetch(async () => get(`/projects/${id}`), [id])
  const versions = useFetch(async () => get(`/projects/${id}/versions`), [id])
  const d = fetch.data as any
  const canWrite = hasPerm('projects.write')
  const [editOpen, setEditOpen] = useState(false)

  return (
    <PageWrap fetch={fetch}>
      <Card
        title={<Space><Typography.Link onClick={() => nav('/projects')}>体育项目中心</Typography.Link> / {String(d?.name ?? '')} <StatusTag status={d?.status} /></Space>}
        extra={
          <Space>
            {canWrite && <Button onClick={() => setEditOpen(true)}>编辑主数据</Button>}
            {canWrite && d?.status === 'draft' && (
              <Button type="primary" onClick={async () => { await post(`/projects/${id}/actions`, { action: 'activate', version: d.version }); fetch.reload() }}>激活</Button>
            )}
            {canWrite && d?.status === 'active' && (
              <Button danger onClick={async () => { await post(`/projects/${id}/actions`, { action: 'deprecate', version: d.version }); fetch.reload() }}>软停用</Button>
            )}
          </Space>
        }
      >
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="名称">{String(d?.name)}</Descriptions.Item>
          <Descriptions.Item label="英文名">{String(d?.name_en ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="Slug"><Tag>{String(d?.slug)}</Tag></Descriptions.Item>
          <Descriptions.Item label="介绍" span={2}>{String(d?.intro ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="规则来源">{String(d?.source ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="分类">
            {(d?.categories ?? []).map((c: any) => <Tag key={c.id} color="blue">{c.name}</Tag>)}
          </Descriptions.Item>
          <Descriptions.Item label="标签">
            {(d?.tags ?? []).map((t: any) => <Tag key={t.id}>{t.name}</Tag>)}
          </Descriptions.Item>
          <Descriptions.Item label="版本">v{Number(d?.version)} · 更新 {String(d?.updated_at).slice(0, 10)}</Descriptions.Item>
        </Descriptions>

        <Tabs
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'units', label: '分支与竞赛小项',
              children: (
                <div>
                  {(d?.branches ?? []).map((b: any) => (
                    <Card key={b.id} size="small" title={`分支：${b.name}`} style={{ marginBottom: 12 }}>
                      <Table
                        size="small"
                        rowKey="id"
                        dataSource={(d?.competition_units ?? []).filter((u: any) => u.branch_id === b.id)}
                        columns={[
                          { title: '竞赛小项', dataIndex: 'name' },
                          { title: '性别', dataIndex: 'gender', width: 80 },
                          { title: '组别', dataIndex: 'group_name', width: 110 },
                          { title: '规则版本', dataIndex: 'rule_version' },
                        ]}
                        pagination={false}
                      />
                    </Card>
                  ))}
                  {(d?.branches ?? []).length === 0 && <Typography.Text type="secondary">该项目暂未维护分支/小项</Typography.Text>}
                </div>
              ),
            },
            {
              key: 'relations', label: '关联业务',
              children: (
                <Descriptions column={5} size="small" bordered>
                  {['profile', 'content', 'course', 'competition', 'org'].map((t) => {
                    const found = (d?.relation_counts ?? []).find((r: any) => r.entity_type === t)
                    const labelMap: Record<string, string> = { profile: '人员档案', content: '内容', course: '课程', competition: '赛事', org: '机构' }
                    return <Descriptions.Item key={t} label={labelMap[t]}>{found?.count ?? 0} 项（多对多关联）</Descriptions.Item>
                  })}
                </Descriptions>
              ),
            },
            {
              key: 'versions', label: '版本历史',
              children: (
                <Timeline
                  items={(versions.data as any[] ?? []).map((v: any) => ({
                    children: <Space>v{v.version} · {v.change_summary} <Typography.Text type="secondary">{v.created_at?.slice(0, 19).replace('T', ' ')}</Typography.Text></Space>,
                  }))}
                />
              ),
            },
          ]}
        />
      </Card>
      <EditProjectModal id={id} open={editOpen} current={d} onClose={() => setEditOpen(false)} onDone={() => { setEditOpen(false); fetch.reload(); versions.reload() }} />
    </PageWrap>
  )
}

function EditProjectModal({ id, open, current, onClose, onDone }: { id: string; open: boolean; current?: any; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  return (
    <Modal title={`编辑主数据（版本 v${current?.version}，乐观锁）`} open={open} onCancel={onClose} destroyOnClose
      onOk={async () => {
        const v = await form.validateFields()
        setSaving(true)
        try {
          await patch(`/projects/${id}`, { ...v, version: current.version, change_summary: v.change_summary || '编辑主数据' })
          message.success('已保存（生成新版本）')
          onDone()
        } catch (e) { message.error((e as Error).message) } finally { setSaving(false) }
      }}>
      <Form form={form} layout="vertical" initialValues={{ name: current?.name, intro: current?.intro, source: current?.source }}>
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="intro" label="介绍"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="source" label="规则/资料来源"><Input /></Form.Item>
        <Form.Item name="change_summary" label="变更说明（写入版本历史）"><Input /></Form.Item>
      </Form>
    </Modal>
  )
}
