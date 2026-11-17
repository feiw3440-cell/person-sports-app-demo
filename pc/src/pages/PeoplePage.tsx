// 人员与人才：搜索筛选 / 档案详情（资质·成绩·项目关联·状态历史）/ 资质审核 / 授权导出
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Timeline, Typography, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { get, post } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'
import { hasPerm, useAuth } from '@/store/auth'

const KIND_LABELS: Record<string, string> = { athlete: '运动员', coach: '教练', mentor: '导师' }

export default function PeoplePage() {
  const { id } = useParams()
  if (id) return <PersonDetail id={id} />
  return <PeopleList />
}

function PeopleList() {
  const nav = useNavigate()
  const [kind, setKind] = useState<string | undefined>()
  const [keyword, setKeyword] = useState('')
  const [verify, setVerify] = useState<string | undefined>()
  const canExport = hasPerm('people.export')
  const list = useFetch(async () => {
    const q = new URLSearchParams()
    if (kind) q.set('kind', kind)
    if (keyword) q.set('keyword', keyword)
    if (verify) q.set('verify', verify)
    return get(`/people?${q.toString()}`)
  }, [kind, keyword, verify])

  return (
    <PageWrap fetch={list}>
      <Card
        title="人员与人才中心"
        extra={
          <Space>
            <Input.Search placeholder="姓名 / 头衔 / 地区" allowClear onSearch={setKeyword} style={{ width: 200 }} />
            <Select placeholder="类型" allowClear style={{ width: 110 }} value={kind} onChange={setKind}
              options={Object.entries(KIND_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            <Select placeholder="核验状态" allowClear style={{ width: 120 }} value={verify} onChange={setVerify}
              options={[{ value: 'verified', label: '已核验' }, { value: 'unverified', label: '未核验' }, { value: 'pending', label: '核验中' }, { value: 'appealing', label: '申诉中' }]} />
            {canExport && (
              <Button icon={<DownloadOutlined />} onClick={async () => {
                try {
                  const access = useAuth.getState().access
                  const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8787'}/v1/people/export`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
                    body: JSON.stringify({ kind }),
                  })
                  if (!res.ok) throw new Error(`HTTP ${res.status}`)
                  const blob = await res.blob()
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = 'people-export.csv'
                  a.click()
                  message.success('导出成功（已记录审计）')
                } catch (e) { message.error('导出失败：' + (e as Error).message) }
              }}>导出 CSV（留审计）</Button>
            )}
          </Space>
        }
      >
        <Table
          rowKey="id"
          dataSource={list.data as any[]}
          pagination={{ pageSize: 10 }}
          onRow={(r) => ({ onClick: () => nav(`/people/${r.id}`), style: { cursor: 'pointer' } })}
          columns={[
            { title: '姓名', dataIndex: 'display_name', width: 140 },
            { title: '类型', dataIndex: 'kind', width: 90, render: (v: string) => <Tag color="blue">{KIND_LABELS[v] ?? v}</Tag> },
            { title: '头衔', dataIndex: 'title' },
            { title: '地区', dataIndex: 'region', width: 90 },
            { title: '核验状态', dataIndex: 'verify_status', width: 100, render: (v: string) => <StatusTag status={v === 'verified' ? 'approved' : v === 'pending' ? 'pending' : 'draft'} /> },
            { title: '联系方式', dataIndex: 'contact_phone', width: 130, render: (v: string) => v || <Typography.Text type="secondary">按隐私范围隐藏</Typography.Text> },
            { title: '更新时间', dataIndex: 'updated_at', width: 120, render: (v: string) => v?.slice(0, 10) },
          ]}
        />
        <Typography.Text type="secondary" className="workbench-note">
          隐私字段按可见性范围与权限裁剪（最小化显示）；成绩/资质须有来源与审核状态；导出为独立授权并强制写审计。
        </Typography.Text>
      </Card>
    </PageWrap>
  )
}

function PersonDetail({ id }: { id: string }) {
  const nav = useNavigate()
  const fetch = useFetch(async () => get(`/people/${id}`), [id])
  const d = fetch.data as any
  const canReview = hasPerm('credentials.review')

  return (
    <PageWrap fetch={fetch}>
      <Card
        title={<Space><Typography.Link onClick={() => nav('/people')}>人员与人才</Typography.Link> / {String(d?.display_name ?? '')} <Tag color="blue">{KIND_LABELS[d?.kind] ?? d?.kind}</Tag></Space>}
      >
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="头衔">{String(d?.title ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="地区">{String(d?.region ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="核验状态">{String(d?.verify_status)}</Descriptions.Item>
          <Descriptions.Item label="简介" span={3}>{String(d?.bio ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="关联项目" span={3}>
            {(d?.projects ?? []).map((p: any) => <Tag key={p.id} color="blue">{p.name}{p.is_primary ? '（主项）' : ''}</Tag>)}
            {(d?.projects ?? []).length === 0 && '-'}
          </Descriptions.Item>
        </Descriptions>

        <Card size="small" title="资质（须有来源与审核状态）" style={{ marginTop: 16 }}
          extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>审核动作由服务端状态机执行并留痕</Typography.Text>}>
          <Table
            size="small"
            rowKey="id"
            dataSource={d?.credentials ?? []}
            pagination={false}
            columns={[
              { title: '资质', dataIndex: 'kind' },
              { title: '来源', dataIndex: 'source' },
              { title: '关联身份', dataIndex: 'identity_type', render: (v: string) => <Tag>{v}</Tag> },
              { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
              { title: '有效期至', dataIndex: 'valid_until', render: (v: string) => v?.slice(0, 10) ?? '-' },
              { title: '审核意见', dataIndex: 'reason', ellipsis: true },
              {
                title: '审核动作',
                width: 170,
                render: (_: unknown, r: any) =>
                  canReview && ['submitted', 'under_review'].includes(r.status) ? (
                    <Space>
                      <Button size="small" type="primary" onClick={() => reviewCredential(r.id, 'approve')}>通过</Button>
                      <Button size="small" danger onClick={() => reviewCredential(r.id, 'reject')}>驳回</Button>
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ),
              },
            ]}
          />
        </Card>

        <Card size="small" title="状态历史（操作者/时间/原因）" style={{ marginTop: 16 }}>
          {(d?.state_history ?? []).length === 0 ? (
            <Typography.Text type="secondary">暂无留痕记录</Typography.Text>
          ) : (
            <Timeline
              items={(d?.state_history ?? []).map((h: any) => ({
                children: <Space wrap>{h.action} · {h.reason ? `原因：${h.reason}` : ''} <Tag>{h.client}</Tag> <Typography.Text type="secondary">{h.created_at?.slice(0, 19).replace('T', ' ')}</Typography.Text></Space>,
              }))}
            />
          )}
        </Card>
      </Card>
    </PageWrap>
  )

  function reviewCredential(credId: string, action: 'approve' | 'reject') {
    let reason = ''
    Modal.confirm({
      title: action === 'approve' ? '通过资质' : '驳回资质',
      content: (
        <Form layout="vertical">
          <Form.Item label={action === 'approve' ? '审核意见（留痕）' : '驳回原因（必填）'}>
            <Input.TextArea onChange={(e) => { reason = e.target.value }} />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (action === 'reject' && !reason) { message.error('驳回必须填写原因'); throw new Error('reason required') }
        try {
          await post(`/credentials/${credId}/actions`, { action, reason: reason || '审核通过（演示）' })
          message.success('已提交审核动作')
          fetch.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }
}
