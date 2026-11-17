// 工作台首页：角色化待办、数据卡片、快捷入口、最近动态（数据来自授权范围，口径与更新时间注明）
import { useNavigate } from 'react-router-dom'
import { Alert, Card, Col, Empty, Row, Statistic, Table, Tag, Typography } from 'antd'
import { ApartmentOutlined, TeamOutlined, ReadOutlined, FlagOutlined } from '@ant-design/icons'
import { get } from '@/api/client'
import { PageWrap, useFetch, StatusTag } from '@/components/common'
import { useAuth } from '@/store/auth'
import dayjs from 'dayjs'

export default function WorkbenchPage() {
  const nav = useNavigate()
  const me = useAuth((s) => s.me)
  const fetch = useFetch(() => get('/analytics/workbench'))
  const d = fetch.data as any

  return (
    <PageWrap fetch={fetch}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message={`欢迎，${String(me?.display_name ?? '')}`}
        description="待办与统计来自当前身份/组织上下文的授权范围；所有指标为本机权威库实时口径。" />
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="待办" size="small">
            {d?.todos?.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前无待办" />
            ) : (
              <div className="responsive-grid">
                {(d?.todos ?? []).map((t: any) => (
                  <Card key={t.ref} size="small" hoverable onClick={() => nav(t.ref)}>
                    <Statistic title={t.label} value={t.count} valueStyle={{ color: '#c0162c' }} />
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="数据总览" size="small" extra={<span className="workbench-note">更新时间 {dayjs(d?.generated_at).format('HH:mm:ss')}</span>}>
            <div className="responsive-grid">
              <Card size="small" hoverable onClick={() => nav('/projects')}>
                <ApartmentOutlined style={{ fontSize: 20, color: '#12345B' }} />
                <div className="workbench-card-num">{d?.cards?.projects ?? '-'}</div>
                <span className="workbench-note">在册体育项目</span>
              </Card>
              <Card size="small" hoverable onClick={() => nav('/people')}>
                <TeamOutlined style={{ fontSize: 20, color: '#2872B8' }} />
                <div className="workbench-card-num">{d?.cards?.people ?? '-'}</div>
                <span className="workbench-note">人员档案</span>
              </Card>
              <Card size="small" hoverable onClick={() => nav('/training/courses')}>
                <ReadOutlined style={{ fontSize: 20, color: '#19B9AC' }} />
                <div className="workbench-card-num">{d?.cards?.courses ?? '-'}</div>
                <span className="workbench-note">已发布课程</span>
              </Card>
              <Card size="small" hoverable onClick={() => nav('/competitions')}>
                <FlagOutlined style={{ fontSize: 20, color: '#FF6B5E' }} />
                <div className="workbench-card-num">{d?.cards?.competitions ?? '-'}</div>
                <span className="workbench-note">进行中赛事</span>
              </Card>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近动态" size="small" extra={<span className="workbench-note">授权范围内的操作留痕</span>}>
            <Table
              size="small"
              rowKey={(r: any) => r.created_at + r.action}
              dataSource={d?.recent_activities ?? []}
              pagination={false}
              columns={[
                { title: '动作', dataIndex: 'action', width: 190, render: (v: string) => <Tag>{v}</Tag> },
                { title: '操作者', dataIndex: 'actor', width: 120 },
                { title: '来源端', dataIndex: 'client', width: 70, render: (v: string) => <Tag>{v}</Tag> },
                { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
              ]}
            />
          </Card>
        </Col>
        <Col span={24}>
          <Card size="small">
            <Typography.Text type="secondary" className="workbench-note">
              说明：本工作台为业务管理端（整体形态 B）。待办计数为状态机中的 pending 对象（服务端实时查询）；「最近动态」来自审计日志授权范围切片。
              <StatusTag status="pending" /> 表示待处理。
            </Typography.Text>
          </Card>
        </Col>
      </Row>
    </PageWrap>
  )
}
