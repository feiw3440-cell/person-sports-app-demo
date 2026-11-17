// 数据分析：领域报表（项目/教学/赛事/组织）· 口径注明 · 授权导出（留审计）
import { useState } from 'react'
import { App, Button, Card, Table, Tabs, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { get } from '@/api/client'
import { PageWrap, useFetch } from '@/components/common'
import { hasPerm, useAuth } from '@/store/auth'

export default function AnalyticsPage() {
  const [domain, setDomain] = useState('project')
  const { message } = App.useApp()
  const overview = useFetch(async () => get(`/analytics/overview?domain=${domain}`), [domain])
  const d = overview.data as any
  const canExport = hasPerm('analytics.export')

  const columnsByDomain: Record<string, any[]> = {
    project: [
      { title: '项目', dataIndex: 'name' },
      { title: '关联人员', dataIndex: 'people', width: 110 },
      { title: '关联课程', dataIndex: 'courses', width: 110 },
      { title: '关联赛事', dataIndex: 'competitions', width: 110 },
    ],
    training: [
      { title: '课程', dataIndex: 'name' },
      { title: '状态', dataIndex: 'status' },
      { title: '已通过报名', dataIndex: 'approved', width: 120 },
      { title: '待审报名', dataIndex: 'pending', width: 110 },
    ],
    competition: [
      { title: '赛事', dataIndex: 'name' },
      { title: '状态', dataIndex: 'status' },
      { title: '名额', dataIndex: 'quota', width: 80 },
      { title: '已通过', dataIndex: 'approved', width: 100 },
      { title: '待审', dataIndex: 'pending', width: 90 },
    ],
    org: [
      { title: '组织', dataIndex: 'org_name' },
      { title: '类型', dataIndex: 'org_type', width: 110 },
      { title: '成员', dataIndex: 'members', width: 90 },
      { title: '课程', dataIndex: 'courses', width: 90 },
      { title: '赛事', dataIndex: 'competitions', width: 90 },
    ],
  }

  return (
    <PageWrap fetch={overview}>
      <Card
        title="数据分析中心"
        extra={
          canExport && (
            <Button icon={<DownloadOutlined />} onClick={async () => {
              try {
                const access = useAuth.getState().access
                const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8787'}/v1/analytics/export`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
                  body: JSON.stringify({ domain }),
                })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const blob = await res.blob()
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `analytics-${domain}.csv`
                a.click()
                message.success('导出成功（已写审计日志）')
              } catch (e) { message.error('导出失败：' + (e as Error).message) }
            }}>导出（单独授权 · 留审计）</Button>
          )
        }
      >
        <Tabs activeKey={domain} onChange={setDomain} items={[
          { key: 'project', label: '项目维度' },
          { key: 'training', label: '教学维度' },
          { key: 'competition', label: '赛事维度' },
          { key: 'org', label: '组织维度' },
        ]} />
        <Table
          size="small"
          rowKey={(r: any) => JSON.stringify(r)}
          dataSource={d?.rows ?? []}
          pagination={false}
          columns={columnsByDomain[domain]}
        />
        <Typography.Text type="secondary" className="workbench-note">
          口径：{String(d?.note ?? '')} · 生成时间 {String(d?.generated_at ?? '').slice(0, 19).replace('T', ' ')} · 全部指标遵守当前数据范围（组织隔离）
        </Typography.Text>
      </Card>
    </PageWrap>
  )
}
