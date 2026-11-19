// 教学与训练：课程库 / 发布与状态机动作 / 班级 / 报名审核（闭环 PC 侧）/ 考勤 / 训练计划
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App, Button, Card, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { EditOutlined, PlusOutlined } from '@ant-design/icons'
import { get, getRaw, patch, post } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'
import { hasPerm, useAuth } from '@/store/auth'

export default function CoursesPage() {
  const { id } = useParams()
  if (id) return <CourseDetail id={id} />
  return <CourseList />
}

function CourseList() {
  const nav = useNavigate()
  const [status, setStatus] = useState<string | undefined>()
  const [keyword, setKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const canWrite = hasPerm('courses.write')
  const fetch = useFetch(async () => {
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    if (keyword) q.set('keyword', keyword)
    return get(`/courses?${q.toString()}`)
  }, [status, keyword])

  return (
    <PageWrap fetch={fetch}>
      <Card
        title="教学与训练 / 课程库"
        extra={
          <Space>
            <Input.Search placeholder="课程名" allowClear onSearch={setKeyword} style={{ width: 180 }} />
            <Select placeholder="状态" allowClear style={{ width: 130 }} value={status} onChange={setStatus}
              options={['draft', 'pending_review', 'published', 'paused', 'archived'].map((s) => ({ value: s, label: s }))} />
            {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建课程</Button>}
          </Space>
        }
      >
        <Table
          rowKey="id"
          dataSource={fetch.data as any[]}
          pagination={{ pageSize: 10 }}
          onRow={(r) => ({ onClick: () => nav(`/training/courses/${r.id}`), style: { cursor: 'pointer' } })}
          columns={[
            { title: '课程', dataIndex: 'name', render: (v: string, r: any) => <Typography.Link onClick={() => nav(`/training/courses/${r.id}`)}>{v}</Typography.Link> },
            { title: '导师', dataIndex: 'mentor_name', width: 130 },
            { title: '机构', dataIndex: 'org_name', width: 150, render: (v) => v || '-' },
            { title: '形式', dataIndex: 'format', width: 80, render: (v: string) => <Tag>{v === 'offline' ? '线下' : '线上'}</Tag> },
            { title: '关联项目', dataIndex: 'projects', render: (ps: any[]) => ps?.map((p) => <Tag key={p.id} color="blue">{p.name}</Tag>) },
            {
              title: '价格', dataIndex: 'price_cents', width: 110,
              render: (v: number | null) => (v == null ? <Tag>免费</Tag> : <Typography.Text strong>¥{(v / 100).toFixed(2)}</Typography.Text>),
            },
            { title: '状态', dataIndex: 'status', width: 110, render: (v: string) => <StatusTag status={v} /> },
            { title: '更新', dataIndex: 'updated_at', width: 110, render: (v: string) => v?.slice(0, 10) },
          ]}
        />
        <Typography.Text type="secondary" className="workbench-note">
          课程状态由服务端状态机控制（draft → pending_review → published → paused/archived）；报名审核在课程详情内完成。
        </Typography.Text>
      </Card>
      <CreateCourseModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => setCreateOpen(false)} />
    </PageWrap>
  )
}

function CreateCourseModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm()
  const projects = useFetch(() => get('/projects'), [])
  const [saving, setSaving] = useState(false)
  return (
    <Modal title="新建课程（导师/机构管理员）" open={open} onCancel={onClose} destroyOnClose
      onOk={async () => {
        const v = await form.validateFields()
        setSaving(true)
        try {
          await post('/courses', v)
          message.success('课程已创建（草稿）')
          onDone()
        } catch (e) { message.error((e as Error).message) } finally { setSaving(false) }
      }}>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="课程名" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="format" label="形式" rules={[{ required: true }]} initialValue="offline">
          <Select options={[{ value: 'offline', label: '线下' }, { value: 'online', label: '线上' }]} />
        </Form.Item>
        <Form.Item name="price_yuan" label="价格（元）" extra="留空 = 免费课程（走报名审核流）；填写后用户需下单支付（模拟支付）">
          <InputNumber min={0} max={100000} precision={2} style={{ width: '100%' }} placeholder="如 128.00" />
        </Form.Item>
        <Form.Item name="audience" label="适用对象"><Input /></Form.Item>
        <Form.Item name="project_ids" label="关联项目（多对多）">
          <Select mode="multiple" allowClear options={(projects.data as any[] ?? []).map((p) => ({ value: p.id, label: p.name }))} />
        </Form.Item>
        <Form.Item name="sessions" label="课程安排"><Input /></Form.Item>
      </Form>
    </Modal>
  )
}

function CourseDetail({ id }: { id: string }) {
  const nav = useNavigate()
  const { modal } = App.useApp()
  const fetch = useFetch(async () => get(`/courses/${id}`), [id])
  const classes = useFetch(async () => get(`/courses/${id}/classes`), [id])
  const enrollments = useFetch(async () => get(`/enrollments?course_id=${id}`), [id])
  const canModerateReviews = hasPerm('reviews.moderate')
  const reviews = useFetch(async () => (canModerateReviews ? getRaw(`/reviews?course_id=${id}&page_size=100`) : { data: [] }), [id, canModerateReviews])
  const [priceOpen, setPriceOpen] = useState(false)
  const d = fetch.data as any
  const canManage = d && (d.mentor_account_id === useAuth.getState().me?.id || hasPerm('competitions.write'))
  const canReviewEnrollment = hasPerm('enrollments.review')

  const doAction = async (action: string) => {
    try {
      await post(`/courses/${id}/actions`, { action, version: d.version })
      message.success(`已执行 ${action}`)
      fetch.reload()
    } catch (e) { message.error((e as Error).message) }
  }

  const reviewEnrollment = (en: any, action: 'approve' | 'reject') => {
    let reason = ''
    modal.confirm({
      title: action === 'approve' ? `通过 ${en.account_name} 的报名` : `驳回 ${en.account_name} 的报名`,
      content: (
        <Form layout="vertical">
          <Form.Item label="审核意见（必填，写入审计与通知）">
            <Input.TextArea onChange={(e) => { reason = e.target.value }} />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (!reason) { message.error('审核必须填写意见（留痕）'); throw new Error('reason required') }
        try {
          await post(`/enrollments/${en.id}/actions`, { action, reason, version: en.version })
          message.success('审核完成，报名人将在 APP 收到状态与通知')
          enrollments.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }

  const moderateReview = (rv: any, status: 'visible' | 'hidden') => {
    let reason = ''
    modal.confirm({
      title: status === 'hidden' ? '隐藏该评价' : '恢复该评价',
      content: (
        <Form layout="vertical">
          <Form.Item label="操作原因（必填，写入审计并向评价人发送通知）">
            <Input.TextArea onChange={(e) => { reason = e.target.value }} />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (!reason.trim()) { message.error('请填写操作原因（留痕）'); throw new Error('reason required') }
        try {
          await patch(`/reviews/${rv.id}`, { status, reason: reason.trim(), version: rv.version })
          message.success(status === 'hidden' ? '评价已隐藏（不再参与评分聚合）' : '评价已恢复')
          reviews.reload()
          fetch.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }

  return (
    <PageWrap fetch={fetch}>
      <Card
        title={<Space><Typography.Link onClick={() => nav('/training/courses')}>课程库</Typography.Link> / {String(d?.name ?? '')} <StatusTag status={d?.status} /></Space>}
        extra={
          canManage && (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => setPriceOpen(true)}>编辑价格</Button>
              {d?.status === 'draft' && <Button onClick={() => doAction('submit_review')}>提交审核</Button>}
              {d?.status === 'pending_review' && <Button type="primary" onClick={() => doAction('publish')}>发布</Button>}
              {d?.status === 'published' && <Button onClick={() => doAction('pause')}>暂停</Button>}
              {d?.status === 'paused' && <Button onClick={() => doAction('submit_review')}>重新提审</Button>}
              <Popconfirm title="归档后不可恢复？演示环境可观察状态机拒绝非法迁移" onConfirm={() => doAction('archive')}>
                <Button danger>归档</Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="导师">{String(d?.mentor_name)}</Descriptions.Item>
          <Descriptions.Item label="机构">{String(d?.org_name ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="形式">{d?.format === 'offline' ? '线下' : '线上'}</Descriptions.Item>
          <Descriptions.Item label="价格">
            {d?.price_cents == null ? <Tag>免费（报名审核流）</Tag> : <Typography.Text strong>¥{(d.price_cents / 100).toFixed(2)}</Typography.Text>}
            {d?.price_note ? <Typography.Text type="secondary"> · {d.price_note}</Typography.Text> : null}
          </Descriptions.Item>
          <Descriptions.Item label="适用对象" span={2}>{String(d?.audience ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="安排">{String(d?.sessions ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="评价" span={3}>
            {d?.review_count ? <Space><span>★ {d.rating_avg}</span><Typography.Text type="secondary">{d.review_count} 条可见评价</Typography.Text></Space> : <Typography.Text type="secondary">暂无评价</Typography.Text>}
          </Descriptions.Item>
          <Descriptions.Item label="大纲" span={3}>{(d?.outline ?? []).join(' / ') || '-'}</Descriptions.Item>
          <Descriptions.Item label="关联项目" span={3}>{(d?.projects ?? []).map((p: any) => <Tag key={p.id} color="blue">{p.name}</Tag>)}</Descriptions.Item>
        </Descriptions>

        <Card size="small" title="班级" style={{ marginTop: 16 }} extra={canManage && <Button size="small" icon={<PlusOutlined />} onClick={() => createClass()}>新建班级</Button>}>
          <Table size="small" rowKey="id" dataSource={classes.data as any[]} pagination={false}
            columns={[
              { title: '班级', dataIndex: 'name' }, { title: '时间', dataIndex: 'schedule' }, { title: '容量', dataIndex: 'capacity' },
              { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v === 'open' ? 'published' : 'draft'} /> },
            ]} />
        </Card>

        <Card size="small" title="报名审核（跨端闭环：APP 提交 → 此处审核 → APP 收结果）" style={{ marginTop: 16 }}>
          <Table size="small" rowKey="id" dataSource={enrollments.data as any[]} pagination={false}
            columns={[
              { title: '报名人', dataIndex: 'account_name' },
              { title: '班级', dataIndex: 'class_name', render: (v) => v || '-' },
              { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
              { title: '审核意见', dataIndex: 'reason', ellipsis: true },
              { title: '申请时间', dataIndex: 'created_at', width: 130, render: (v: string) => v?.slice(0, 19).replace('T', ' ') },
              {
                title: '动作', width: 160,
                render: (_: unknown, r: any) =>
                  canReviewEnrollment && r.status === 'pending' ? (
                    <Space>
                      <Button size="small" type="primary" onClick={() => reviewEnrollment(r, 'approve')}>通过</Button>
                      <Button size="small" danger onClick={() => reviewEnrollment(r, 'reject')}>驳回</Button>
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ),
              },
            ]} />
          <Typography.Text type="secondary" className="workbench-note">
            报名状态机：pending → approved/rejected/cancelled → completed；重复提交由幂等键防护。
          </Typography.Text>
        </Card>

        <Card size="small" title="评价管理（F-3：仅已支付订单可评价；隐藏不删除原文）" style={{ marginTop: 16 }}>
          {canModerateReviews ? (
            <Table size="small" rowKey="id" dataSource={((reviews.data as any)?.data ?? []) as any[]} pagination={false}
              columns={[
                { title: '评价人', dataIndex: 'account_name', width: 130 },
                { title: '评分', dataIndex: 'rating', width: 90, render: (v: number) => <span>{'★'.repeat(v)}{'☆'.repeat(5 - v)}</span> },
                { title: '内容', dataIndex: 'comment', ellipsis: true, render: (v) => v || <Typography.Text type="secondary">（无文字）</Typography.Text> },
                { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => <Tag color={v === 'visible' ? 'green' : 'default'}>{v === 'visible' ? '可见' : '已隐藏'}</Tag> },
                { title: '时间', dataIndex: 'created_at', width: 150, render: (v: string) => v?.slice(0, 16).replace('T', ' ') },
                {
                  title: '动作', width: 110,
                  render: (_: unknown, r: any) =>
                    r.status === 'visible'
                      ? <Button size="small" danger onClick={() => moderateReview(r, 'hidden')}>隐藏</Button>
                      : <Button size="small" onClick={() => moderateReview(r, 'visible')}>恢复</Button>,
                },
              ]} />
          ) : (
            <Typography.Text type="secondary">当前账号无评价管理权限（需要课程导师 / 机构管理员 / 平台审核权限）。</Typography.Text>
          )}
        </Card>
      </Card>
      <PriceModal
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        onDone={() => { setPriceOpen(false); fetch.reload() }}
        courseId={id}
        version={d?.version}
        priceCents={d?.price_cents ?? null}
        priceNote={d?.price_note ?? null}
      />
    </PageWrap>
  )

  function createClass() {
    let name = ''
    let schedule = ''
    modal.confirm({
      title: '新建班级',
      content: (
        <Form layout="vertical">
          <Form.Item label="班级名"><Input onChange={(e) => { name = e.target.value }} /></Form.Item>
          <Form.Item label="时间安排"><Input onChange={(e) => { schedule = e.target.value }} /></Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (!name) { message.error('班级名必填'); throw new Error('name required') }
        try {
          await post(`/courses/${id}/classes`, { name, schedule })
          message.success('班级已创建')
          classes.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }
}

function PriceModal({ open, onClose, onDone, courseId, version, priceCents, priceNote }: {
  open: boolean; onClose: () => void; onDone: () => void; courseId: string
  version?: number; priceCents: number | null; priceNote: string | null
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) return
    form.setFieldsValue({
      price_yuan: priceCents == null ? undefined : priceCents / 100,
      price_note: priceNote ?? '',
    })
  }, [open, priceCents, priceNote, form])
  return (
    <Modal title="编辑课程价格（服务端以分存储）" open={open} onCancel={onClose} destroyOnClose confirmLoading={saving}
      onOk={async () => {
        const v = await form.validateFields()
        setSaving(true)
        try {
          await patch(`/courses/${courseId}`, {
            price_yuan: v.price_yuan === undefined || v.price_yuan === null ? null : Number(v.price_yuan),
            price_note: v.price_note?.trim() ? v.price_note.trim() : null,
            version,
          })
          message.success('价格已更新；历史订单仍按原价格与费率快照结算')
          onDone()
        } catch (e) { message.error((e as Error).message) } finally { setSaving(false) }
      }}>
      <Form form={form} layout="vertical">
        <Form.Item name="price_yuan" label="价格（元）" extra="留空 = 免费课程（走报名审核流）；修改仅影响新订单，历史订单不回溯">
          <InputNumber min={0} max={100000} precision={2} style={{ width: '100%' }} placeholder="如 128.00" />
        </Form.Item>
        <Form.Item name="price_note" label="价格说明（可选）">
          <Input maxLength={100} placeholder="如：含 6 课时 / 早鸟价" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
