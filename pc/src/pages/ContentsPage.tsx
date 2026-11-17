// 内容与影响力：内容列表 / 审核动作（submit/publish/offline）/ TOP 榜单定义与快照
import { useState } from 'react'
import { Card, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { get, post } from '@/api/client'
import { PageWrap, StatusTag, useFetch } from '@/components/common'
import { hasPerm } from '@/store/auth'

export default function ContentsPage() {
  const [tab, setTab] = useState('contents')
  return (
    <Card title="内容与影响力中心">
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'contents', label: '内容管理', children: <ContentTable /> },
        { key: 'rankings', label: 'TOP 榜单', children: <RankingsPanel /> },
      ]} />
    </Card>
  )
}

function ContentTable() {
  const [status, setStatus] = useState<string | undefined>('pending_review')
  const canReview = hasPerm('contents.review')
  const fetch = useFetch(async () => get(`/contents${status ? `?status=${status}` : ''}`), [status])
  return (
    <PageWrap fetch={fetch}>
      <Space style={{ marginBottom: 12 }}>
        <Typography.Text>状态筛选：</Typography.Text>
        {['pending_review', 'published', 'offline', 'draft'].map((s) => (
          <Tag key={s} style={{ cursor: 'pointer', padding: '2px 10px' }} color={status === s ? 'blue' : undefined} onClick={() => setStatus(s)}>
            <StatusTag status={s} />
          </Tag>
        ))}
      </Space>
      <Table
        rowKey="id"
        dataSource={fetch.data as any[]}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: '标题', dataIndex: 'title', ellipsis: true },
          { title: '类型', dataIndex: 'type', width: 80, render: (v: string) => <Tag>{v === 'video' ? '视频' : '图文'}</Tag> },
          { title: '作者', dataIndex: 'author_name', width: 140 },
          { title: '项目', dataIndex: 'projects', render: (ps: any[]) => ps?.map((p) => <Tag color="blue">{p.name}</Tag>) },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag status={v} /> },
          { title: '互动', width: 150, render: (_: unknown, r: any) => `播放 ${r.views} · 赞 ${r.likes}` },
          {
            title: '动作', width: 160,
            render: (_: unknown, r: any) =>
              canReview ? (
                <Space>
                  {r.status === 'pending_review' && (
                    <a onClick={async () => { try { await post(`/contents/${r.id}/actions`, { action: 'publish', version: r.version }); fetch.reload() } catch (e) { message.error((e as Error).message) } }}>发布</a>
                  )}
                  {r.status === 'published' && (
                    <a onClick={async () => { try { await post(`/contents/${r.id}/actions`, { action: 'offline', version: r.version }); fetch.reload() } catch (e) { message.error((e as Error).message) } }}>下架</a>
                  )}
                </Space>
              ) : null,
          },
        ]}
      />
      <Typography.Text type="secondary" className="workbench-note">
        内容状态：draft → pending_review → published → offline；发布/下架动作留审计。TOP 榜单明确口径、周期、来源与更新时间（见「TOP 榜单」页签）。
      </Typography.Text>
    </PageWrap>
  )
}

function RankingsPanel() {
  const fetch = useFetch(() => get('/ranking-definitions'), [])
  const [selected, setSelected] = useState<any>(null)
  const snapshot = useFetch(async () => (selected ? get(`/rankings/${selected.category}?mode=${selected.mode}&period=${selected.period}`) : Promise.resolve(null)), [selected])
  return (
    <div>
      <Table
        size="small"
        rowKey="id"
        dataSource={fetch.data as any[]}
        pagination={{ pageSize: 10 }}
        onRow={(r) => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
        columns={[
          { title: '类别', dataIndex: 'category', width: 100 },
          { title: '模式', dataIndex: 'mode', width: 110, render: (v: string) => <Tag color="blue">{({ overall: '综合榜', pro: '专业榜', popularity: '人气榜' } as Record<string, string>)[v]}</Tag> },
          { title: '周期', dataIndex: 'period', width: 80 },
          { title: '口径', dataIndex: 'formula', render: (f: any) => f?.note },
          { title: '更新', dataIndex: 'updated_at', width: 110, render: (v: string) => v?.slice(0, 10) },
        ]}
      />
      {selected && (
        <Card size="small" title={`快照预览：${selected.category} · ${selected.mode} · ${selected.period}`} style={{ marginTop: 12 }}>
          <Table
            size="small"
            rowKey={(r: any) => String(r.entity_id ?? r.rank)}
            dataSource={(snapshot.data as any)?.rows ?? []}
            pagination={false}
            columns={[
              { title: '名次', dataIndex: 'rank', width: 70, render: (_: unknown, __: unknown, i: number) => i + 1 },
              { title: '对象', dataIndex: 'name' },
              { title: '得分', dataIndex: 'score', width: 100 },
              { title: '名次变化', dataIndex: 'delta', width: 90, render: (v: number) => (v > 0 ? <Tag color="red">▲{v}</Tag> : v < 0 ? <Tag color="green">▼{-v}</Tag> : '-') },
              { title: '口径说明', dataIndex: 'note', ellipsis: true },
            ]}
          />
          <Typography.Text type="secondary" className="workbench-note">
            来源：{(snapshot.data as any)?.source} · 更新时间 {(snapshot.data as any)?.updated_at?.slice(0, 19).replace('T', ' ') ?? '-'} · 榜单人物与排序均为演示数据
          </Typography.Text>
        </Card>
      )}
      {hasPerm('rankings.write') && (
        <Typography.Text type="secondary">（平台运营可编辑榜单口径：formula JSON 与状态；当前账号具备 rankings.write 权限）</Typography.Text>
      )}
    </div>
  )
}
