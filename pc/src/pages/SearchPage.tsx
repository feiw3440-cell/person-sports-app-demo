// 全局搜索：同关键词按类型分栏（项目/人员/课程/赛事）
import { useSearchParams } from 'react-router-dom'
import { Card, Input, Table, Tabs, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { get } from '@/api/client'
import { useFetch } from '@/components/common'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const q = params.get('q') ?? ''
  const projects = useFetch(async () => get(`/projects?keyword=${encodeURIComponent(q)}`), [q])
  const people = useFetch(async () => get(`/people?keyword=${encodeURIComponent(q)}`), [q])
  const courses = useFetch(async () => get(`/courses?keyword=${encodeURIComponent(q)}`), [q])
  const competitions = useFetch(async () => get(`/competitions?keyword=${encodeURIComponent(q)}`), [q])

  const counts = {
    projects: (projects.data as any[] | null)?.length ?? 0,
    people: (people.data as any[] | null)?.length ?? 0,
    courses: (courses.data as any[] | null)?.length ?? 0,
    competitions: (competitions.data as any[] | null)?.length ?? 0,
  }

  return (
    <Card title={<span>全局搜索：<Tag color="blue">{q}</Tag></span>} extra={
      <Input.Search
        placeholder="输入关键词"
        defaultValue={q}
        style={{ width: 260 }}
        onSearch={(v) => setParams({ q: v })}
      />
    }>
      <Tabs items={[
        {
          key: 'projects', label: `体育项目 (${counts.projects})`,
          children: (
            <Table size="small" rowKey="id" dataSource={projects.data as any[]} pagination={false}
              onRow={(r) => ({ onClick: () => nav(`/projects/${r.id}`), style: { cursor: 'pointer' } })}
              columns={[{ title: '项目', dataIndex: 'name' }, { title: '介绍', dataIndex: 'intro', ellipsis: true }]} />
          ),
        },
        {
          key: 'people', label: `人员 (${counts.people})`,
          children: (
            <Table size="small" rowKey="id" dataSource={people.data as any[]} pagination={false}
              onRow={(r) => ({ onClick: () => nav(`/people/${r.id}`), style: { cursor: 'pointer' } })}
              columns={[{ title: '姓名', dataIndex: 'display_name' }, { title: '类型', dataIndex: 'kind' }, { title: '头衔', dataIndex: 'title' }]} />
          ),
        },
        {
          key: 'courses', label: `课程 (${counts.courses})`,
          children: (
            <Table size="small" rowKey="id" dataSource={courses.data as any[]} pagination={false}
              onRow={(r) => ({ onClick: () => nav(`/training/courses/${r.id}`), style: { cursor: 'pointer' } })}
              columns={[{ title: '课程', dataIndex: 'name' }, { title: '导师', dataIndex: 'mentor_name' }]} />
          ),
        },
        {
          key: 'competitions', label: `赛事 (${counts.competitions})`,
          children: (
            <Table size="small" rowKey="id" dataSource={competitions.data as any[]} pagination={false}
              onRow={(r) => ({ onClick: () => nav(`/competitions/${r.id}`), style: { cursor: 'pointer' } })}
              columns={[{ title: '赛事', dataIndex: 'name' }, { title: '状态', dataIndex: 'status' }]} />
          ),
        },
      ]} />
      <Typography.Text type="secondary" className="workbench-note">搜索结果遵守当前身份/组织的数据范围（服务端过滤）</Typography.Text>
    </Card>
  )
}
