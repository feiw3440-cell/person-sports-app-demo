// 赛事活动：列表 / 创建 / 状态机动作 / 报名审核（闭环 PC 侧）/ 赛程 / 成绩（录入·确认·修订留痕）
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App, Button, Card, Descriptions, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { get, post, patch } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'
import { hasPerm, useAuth } from '@/store/auth'

export default function CompetitionsPage() {
  const { id } = useParams()
  if (id) return <CompetitionDetail id={id} />
  return <CompetitionList />
}

function CompetitionList() {
  const nav = useNavigate()
  const [status, setStatus] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const canWrite = hasPerm('competitions.write')
  const fetch = useFetch(async () => get(`/competitions${status ? `?status=${status}` : ''}`), [status])

  return (
    <PageWrap fetch={fetch}>
      <Card
        title="赛事活动中心"
        extra={
          <Space>
            <Select placeholder="状态" allowClear style={{ width: 150 }} value={status} onChange={setStatus}
              options={['draft', 'pending_review', 'published', 'registration_closed', 'in_progress', 'completed', 'cancelled'].map((s) => ({ value: s, label: s }))} />
            {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>创建赛事</Button>}
          </Space>
        }
      >
        <Table
          rowKey="id"
          dataSource={fetch.data as any[]}
          pagination={{ pageSize: 10 }}
          onRow={(r) => ({ onClick: () => nav(`/competitions/${r.id}`), style: { cursor: 'pointer' } })}
          columns={[
            { title: '赛事', dataIndex: 'name', render: (v: string, r: any) => <Typography.Link onClick={() => nav(`/competitions/${r.id}`)}>{v}</Typography.Link> },
            { title: '主办方', dataIndex: 'org_name', width: 150, render: (v) => v || '-' },
            { title: '时间', dataIndex: 'date_start', width: 110, render: (v: string) => v?.slice(0, 10) },
            { title: '地点', dataIndex: 'location', width: 140 },
            { title: '项目', dataIndex: 'projects', render: (ps: any[]) => ps?.map((p) => <Tag key={p.id} color="blue">{p.name}</Tag>) },
            { title: '名额', width: 110, render: (_: unknown, r: any) => `${r.approved_count ?? 0} / ${r.quota ?? '∞'}` },
            { title: '待审', dataIndex: 'pending_count', width: 70, render: (v: number) => (v > 0 ? <Tag color="red">{v}</Tag> : '0') },
            { title: '状态', dataIndex: 'status', width: 110, render: (v: string) => <StatusTag status={v} /> },
          ]}
        />
        <Typography.Text type="secondary" className="workbench-note">
          赛事状态机：draft → pending_review → published → registration_closed → in_progress → completed/cancelled；成绩修订保留版本与审核痕迹。
        </Typography.Text>
      </Card>
      <CreateCompetitionModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => setCreateOpen(false)} />
    </PageWrap>
  )
}

function CreateCompetitionModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm()
  const projects = useFetch(() => get('/projects'), [])
  const [saving, setSaving] = useState(false)
  return (
    <Modal title="创建赛事（组织者）" open={open} onCancel={onClose} destroyOnClose
      onOk={async () => {
        const v = await form.validateFields()
        setSaving(true)
        try {
          await post('/competitions', v)
          message.success('赛事已创建（草稿）')
          onDone()
        } catch (e) { message.error((e as Error).message) } finally { setSaving(false) }
      }}>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="赛事名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="date_start" label="开始日期" rules={[{ required: true }]}><Input placeholder="2026-12-31" /></Form.Item>
        <Form.Item name="date_end" label="结束日期" rules={[{ required: true }]}><Input placeholder="2027-01-01" /></Form.Item>
        <Form.Item name="location" label="地点"><Input /></Form.Item>
        <Form.Item name="quota" label="名额"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="intro" label="赛事介绍"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="project_ids" label="关联项目">
          <Select mode="multiple" allowClear options={(projects.data as any[] ?? []).map((p) => ({ value: p.id, label: p.name }))} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function CompetitionDetail({ id }: { id: string }) {
  const nav = useNavigate()
  const { modal } = App.useApp()
  const fetch = useFetch(async () => get(`/competitions/${id}`), [id])
  const registrations = useFetch(async () => get(`/registrations?competition_id=${id}`), [id])
  const schedule = useFetch(async () => get(`/competitions/${id}/schedule`), [id])
  const results = useFetch(async () => get(`/competitions/${id}/results`), [id])
  const d = fetch.data as any
  const ctxOrgId = useAuth((s) => s.orgId)
  const canManage = hasPerm('registrations.review') && (d?.organizer_org_id === ctxOrgId || hasPerm('competitions.write'))

  const doAction = async (action: string) => {
    try {
      await post(`/competitions/${id}/actions`, { action, version: d.version })
      message.success(`已执行 ${action}`)
      fetch.reload()
    } catch (e) { message.error((e as Error).message) }
  }

  const reviewReg = (r: any, action: 'approve' | 'reject') => {
    let reason = ''
    modal.confirm({
      title: action === 'approve' ? `通过 ${r.account_name} 的报名` : `驳回 ${r.account_name} 的报名`,
      content: (
        <Form layout="vertical">
          <Form.Item label="审核意见（必填·留痕·通知报名人）">
            <Input.TextArea onChange={(e) => { reason = e.target.value }} />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (!reason) { message.error('审核必须填写意见'); throw new Error('reason required') }
        try {
          await post(`/registrations/${r.id}/actions`, { action, reason, version: r.version })
          message.success('审核完成；APP 端状态与消息将更新')
          registrations.reload()
          fetch.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }

  const addResult = (r: { account_id: string; account_name: string }) => {
    let unit = ''
    let rank: number | undefined
    let score = ''
    let source = ''
    modal.confirm({
      title: `录入成绩：${r.account_name}`,
      content: (
        <Form layout="vertical">
          <Form.Item label="小项"><Input onChange={(e) => { unit = e.target.value }} /></Form.Item>
          <Form.Item label="名次"><InputNumber onChange={(v) => { rank = typeof v === 'number' ? v : undefined }} /></Form.Item>
          <Form.Item label="成绩"><Input onChange={(e) => { score = e.target.value }} /></Form.Item>
          <Form.Item label="成绩来源（必填）"><Input onChange={(e) => { source = e.target.value }} /></Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (!unit || !source) { message.error('小项与来源必填'); throw new Error('invalid') }
        try {
          await post(`/competitions/${id}/results`, { account_id: r.account_id, unit_name: unit, rank, score, source })
          message.success('成绩已录入（provisional）')
          results.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }

  const reviseResult = (r: any) => {
    let rank: number | undefined
    let score = ''
    let reason = ''
    modal.confirm({
      title: '修订成绩（留版本与原因）',
      content: (
        <Form layout="vertical">
          <Form.Item label="新名次"><InputNumber onChange={(v) => { rank = typeof v === 'number' ? v : undefined }} /></Form.Item>
          <Form.Item label="新成绩"><Input onChange={(e) => { score = e.target.value }} /></Form.Item>
          <Form.Item label="修订原因（必填）"><Input.TextArea onChange={(e) => { reason = e.target.value }} /></Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (!reason) { message.error('修订必须填写原因'); throw new Error('reason required') }
        try {
          await post(`/results/${r.id}/revisions`, { rank, score, reason, version: r.version })
          message.success('修订完成（result_revisions 已留痕）')
          results.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }

  return (
    <PageWrap fetch={fetch}>
      <Card
        title={<Space><Typography.Link onClick={() => nav('/competitions')}>赛事中心</Typography.Link> / {String(d?.name ?? '')} <StatusTag status={d?.status} /></Space>}
        extra={
          canManage && (
            <Space>
              {d?.status === 'draft' && <Button onClick={() => doAction('submit_review')}>提交审核</Button>}
              {d?.status === 'pending_review' && <Button type="primary" onClick={() => doAction('publish')}>发布（开放报名）</Button>}
              {d?.status === 'published' && <Button onClick={() => doAction('close_registration')}>截止报名</Button>}
              {d?.status === 'registration_closed' && <Button type="primary" onClick={() => doAction('start')}>开赛</Button>}
              {d?.status === 'in_progress' && <Button type="primary" onClick={() => doAction('complete')}>完赛</Button>}
              <Button danger onClick={() => doAction('cancel')}>取消赛事</Button>
            </Space>
          )
        }
      >
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="主办方">{String(d?.org_name ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="时间">{String(d?.date_start?.slice(0, 10))} ~ {String(d?.date_end?.slice(0, 10))}</Descriptions.Item>
          <Descriptions.Item label="名额">{Number(d?.approved_count ?? 0)} / {d?.quota ?? '∞'}（待审 {Number(d?.pending_count ?? 0)}）</Descriptions.Item>
          <Descriptions.Item label="地点">{String(d?.location ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="项目" span={2}>{(d?.projects ?? []).map((p: any) => <Tag key={p.id} color="blue">{p.name}</Tag>)}</Descriptions.Item>
          <Descriptions.Item label="介绍" span={3}>{String(d?.intro ?? '-')}</Descriptions.Item>
        </Descriptions>

        <Card size="small" title="报名审核（APP 报名 → 此处审核 → APP 收状态与消息）" style={{ marginTop: 16 }}>
          <Table size="small" rowKey="id" dataSource={registrations.data as any[]} pagination={false}
            columns={[
              { title: '报名人', dataIndex: 'account_name' },
              { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
              { title: '审核意见', dataIndex: 'reason', ellipsis: true },
              { title: '申请时间', dataIndex: 'created_at', width: 140, render: (v: string) => v?.slice(0, 19).replace('T', ' ') },
              {
                title: '动作', width: 190,
                render: (_: unknown, r: any) => (
                  <Space>
                    {canManage && r.status === 'pending' && (
                      <>
                        <Button size="small" type="primary" onClick={() => reviewReg(r, 'approve')}>通过</Button>
                        <Button size="small" danger onClick={() => reviewReg(r, 'reject')}>驳回</Button>
                      </>
                    )}
                    {canManage && r.status === 'approved' && <Button size="small" onClick={() => addResult(r)}>录入成绩</Button>}
                  </Space>
                ),
              },
            ]} />
        </Card>

        <Card size="small" title="赛程" style={{ marginTop: 16 }}>
          <Table size="small" rowKey="id" dataSource={schedule.data as any[]} pagination={false}
            columns={[
              { title: '小项', dataIndex: 'unit_name' }, { title: '阶段', dataIndex: 'phase' },
              { title: '开始', dataIndex: 'start_at', render: (v: string) => v?.slice(0, 19).replace('T', ' ') },
              { title: '场地', dataIndex: 'venue' },
            ]} />
        </Card>

        <Card size="small" title="成绩（来源必填 · provisional→confirmed · 修订留痕）" style={{ marginTop: 16 }}>
          <Table size="small" rowKey="id" dataSource={results.data as any[]} pagination={false}
            columns={[
              { title: '小项', dataIndex: 'unit_name' },
              { title: '运动员', dataIndex: 'account_name' },
              { title: '名次', dataIndex: 'rank', width: 70 },
              { title: '成绩', dataIndex: 'score', width: 100 },
              { title: '来源', dataIndex: 'source', ellipsis: true },
              { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => (v === 'confirmed' ? <Tag color="green">已确认</Tag> : <Tag color="orange">暂定</Tag>) },
              {
                title: '动作', width: 150,
                render: (_: unknown, r: any) =>
                  canManage ? (
                    <Space>
                      {r.status === 'provisional' && (
                        <Button size="small" type="primary" onClick={async () => {
                          try { await post(`/results/${r.id}/actions`, { action: 'confirm', version: r.version }); results.reload() } catch (e) { message.error((e as Error).message) }
                        }}>确认</Button>
                      )}
                      <Button size="small" onClick={() => reviseResult(r)}>修订</Button>
                    </Space>
                  ) : null,
              },
            ]} />
        </Card>
      </Card>
    </PageWrap>
  )
}
