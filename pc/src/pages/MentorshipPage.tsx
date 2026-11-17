// 师徒与授权：关系列表 / 授权列表 / 授权详情（链路图·状态历史）/ 审核·撤销
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App, Button, Card, Descriptions, Form, Input, Space, Table, Tabs, Tag, Timeline, Typography, message } from 'antd'
import { get, post } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'
import { hasPerm, useAuth } from '@/store/auth'

export default function MentorshipPage() {
  const { id } = useParams()
  if (id) return <AuthorizationDetail id={id} />
  return <MentorshipList />
}

function MentorshipList() {
  const nav = useNavigate()
  const [tab, setTab] = useState('mentorships')
  const ms = useFetch(() => get('/mentorships'), [])
  const az = useFetch(() => get('/authorizations'), [])

  return (
    <PageWrap fetch={tab === 'mentorships' ? ms : az}>
      <Card title="师徒与授权中心">
        <Tabs activeKey={tab} onChange={setTab} items={[
          {
            key: 'mentorships', label: '师徒关系（与身份分离建模）',
            children: (
              <Table size="small" rowKey="id" dataSource={ms.data as any[]} pagination={false}
                columns={[
                  { title: '导师', dataIndex: 'mentor_name' },
                  { title: '徒弟/学员', dataIndex: 'mentee_name' },
                  { title: '类型', dataIndex: 'kind', render: (v: string) => <Tag color="blue">{v === 'coach' ? '授权教练' : '学员'}</Tag> },
                  { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v === 'active' ? 'active' : 'expired'} /> },
                  { title: '起始', dataIndex: 'since', render: (v: string) => v?.slice(0, 10) },
                ]} />
            ),
          },
          {
            key: 'authorizations', label: '授权（显式挂接师徒关系）',
            children: (
              <Table size="small" rowKey="id" dataSource={az.data as any[]} pagination={false}
                onRow={(r) => ({ onClick: () => nav(`/mentorship/authorizations/${r.id}`), style: { cursor: 'pointer' } })}
                columns={[
                  { title: '授权方', dataIndex: 'grantor_name' },
                  { title: '被授权人', dataIndex: 'grantee_name' },
                  { title: '项目', dataIndex: 'project', render: (p: any) => p?.name ?? '-' },
                  { title: '地区', dataIndex: 'scope_region', width: 90 },
                  { title: '期限', width: 190, render: (_: unknown, r: any) => `${r.term_start} ~ ${r.term_end}` },
                  { title: '可再授权', dataIndex: 'allow_sub_grant', width: 90, render: (v: number) => (v ? <Tag color="green">允许</Tag> : <Tag>不允许</Tag>) },
                  { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
                  { title: '链路', width: 80, render: (_: unknown, r: any) => ((r.chain_up?.length || r.chain_down?.length) ? <Typography.Link onClick={() => nav(`/mentorship/authorizations/${r.id}`)}>查看</Typography.Link> : '-') },
                ]} />
            ),
          },
        ]} />
        <Typography.Text type="secondary" className="workbench-note">
          授权状态机：draft → submitted → approved/rejected → active → expired/revoked；到期/撤销通知双方；审核动作全部留痕。
        </Typography.Text>
      </Card>
    </PageWrap>
  )
}

function AuthorizationDetail({ id }: { id: string }) {
  const nav = useNavigate()
  const { modal } = App.useApp()
  const accountId = useAuth((s) => s.me?.id ?? null)
  const fetch = useFetch(async () => get(`/authorizations/${id}`), [id])
  const d = fetch.data as any

  const doAction = (action: 'approve' | 'revoke' | 'submit') => {
    let reason = ''
    modal.confirm({
      title: action === 'approve' ? '批准授权' : action === 'revoke' ? '撤销授权（通知双方）' : '提交授权',
      content: (
        <Form layout="vertical">
          <Form.Item label={action === 'revoke' ? '撤销原因（必填）' : '备注（写入审计）'}>
            <Input.TextArea onChange={(e) => { reason = e.target.value }} placeholder={action === 'revoke' ? '必填' : '选填'} />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        if (action === 'revoke' && !reason) { message.error('撤销必须填写原因'); throw new Error('reason required') }
        try {
          await post(`/authorizations/${id}/actions`, { action, reason: reason || undefined, version: d.version })
          message.success('状态已更新（双方将收到通知）')
          fetch.reload()
        } catch (e) { message.error((e as Error).message) }
      },
    })
  }

  return (
    <PageWrap fetch={fetch}>
      <Card
        title={<Space><Typography.Link onClick={() => nav('/mentorship')}>师徒与授权</Typography.Link> / 授权详情 <StatusTag status={d?.status} /></Space>}
        extra={
          <Space>
            {d?.status === 'draft' && <Button onClick={() => doAction('submit')}>提交</Button>}
            {d?.status === 'submitted' && d?.grantor_account_id === accountId && (
              <Button type="primary" onClick={() => doAction('approve')}>批准（授权方）</Button>
            )}
            {['active', 'submitted'].includes(d?.status) && (
              <Button danger onClick={() => doAction('revoke')}>撤销</Button>
            )}
          </Space>
        }
      >
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="授权方">{String(d?.grantor_name)}</Descriptions.Item>
          <Descriptions.Item label="被授权人">{String(d?.grantee_name)}</Descriptions.Item>
          <Descriptions.Item label="挂接师徒关系"><Tag color="blue">{String(d?.mentorship_id)}</Tag></Descriptions.Item>
          <Descriptions.Item label="授权项目">{String(d?.project?.name ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="内容范围">{String(d?.scope_content ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="地区范围">{String(d?.scope_region ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="期限">{String(d?.term_start)} ~ {String(d?.term_end)}</Descriptions.Item>
          <Descriptions.Item label="可否再授权">{d?.allow_sub_grant ? '允许' : '不允许'}</Descriptions.Item>
          <Descriptions.Item label="上级授权">{d?.parent_authorization_id ? <Typography.Link onClick={() => nav(`/mentorship/authorizations/${d.parent_authorization_id}`)}>{String(d.parent_authorization_id)}</Typography.Link> : '（顶级授权）'}</Descriptions.Item>
        </Descriptions>

        <Card size="small" title="授权链路（导师 → 授权教练 → 学员）" style={{ marginTop: 16 }}>
          <Timeline
            items={[
              ...(d?.chain_up ?? []).map((c: any) => ({
                children: (
                  <Space>
                    {`${c.grantor} → ${c.grantee}`}
                    <StatusTag status={c.status} />
                  </Space>
                ),
              })),
              { children: <b>本级：{String(d?.grantor_name)} → {String(d?.grantee_name)}</b> },
              ...(d?.chain_down ?? []).map((c: any) => ({
                children: (
                  <Space>
                    {`${c.grantor} → ${c.grantee}`}
                    <StatusTag status={c.status} />
                  </Space>
                ),
              })),
            ]}
          />
        </Card>

        <Card size="small" title="状态历史（操作者/时间/原因）" style={{ marginTop: 16 }}>
          {(d?.state_history ?? []).length === 0 ? (
            <Typography.Text type="secondary">暂无留痕</Typography.Text>
          ) : (
            <Timeline
              items={(d?.state_history ?? []).map((h: any) => ({
                children: (
                  <Space wrap>
                    {h.action} {h.reason ? `· 原因：${h.reason}` : ''} <Tag>{h.client}</Tag>
                    <Typography.Text type="secondary">{h.created_at?.slice(0, 19).replace('T', ' ')}</Typography.Text>
                  </Space>
                ),
              }))}
            />
          )}
        </Card>
      </Card>
    </PageWrap>
  )
}
