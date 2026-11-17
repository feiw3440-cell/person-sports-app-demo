// 主框架：左侧可折叠导航（按权限生成）+ 顶部（搜索/通知/组织与身份切换/个人菜单）
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Drawer, Dropdown, Empty, Input, Layout, List, Menu, Popconfirm, Select, Space, Tag, Typography, message } from 'antd'
import {
  DashboardOutlined, ApartmentOutlined, TeamOutlined, ReadOutlined, TrophyOutlined,
  FlagOutlined, BankOutlined, FileTextOutlined, BarChartOutlined, SettingOutlined,
  BellOutlined, SearchOutlined, UserOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'
import { get, patch, post } from '@/api/client'
import { useAuth, hasPerm } from '@/store/auth'
import { STATUS_LABELS } from '@/theme'
import dayjs from 'dayjs'

const { Sider, Header, Content } = Layout

interface Notif { id: string; category: string; kind: string; title: string; body: string | null; read_at: string | null; created_at: string }

export default function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const { me, identityId, orgId, switchContext, setTokens } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [keyword, setKeyword] = useState('')

  const identities = (me?.identities ?? []) as { id: string; identity_type: string; label: string }[]
  const orgs = (me?.memberships ?? []).filter((m: Obj) => m.status === 'accepted')

  const menuItems = useMemo(() => {
    const items: { key: string; icon: React.ReactNode; label: string }[] = [
      { key: '/', icon: <DashboardOutlined />, label: '工作台' },
    ]
    if (hasPerm('projects.read')) items.push({ key: '/projects', icon: <ApartmentOutlined />, label: '体育项目中心' })
    if (hasPerm('people.read')) items.push({ key: '/people', icon: <TeamOutlined />, label: '人员与人才' })
    if (hasPerm('courses.read') || hasPerm('mentorships.read')) items.push({ key: '/training/courses', icon: <ReadOutlined />, label: '教学与训练' })
    if (hasPerm('mentorships.read') || hasPerm('authorizations.read')) items.push({ key: '/mentorship', icon: <TrophyOutlined />, label: '师徒与授权' })
    if (hasPerm('competitions.read')) items.push({ key: '/competitions', icon: <FlagOutlined />, label: '赛事活动' })
    items.push({ key: '/orgs', icon: <BankOutlined />, label: '机构与组织' })
    if (hasPerm('contents.read')) items.push({ key: '/contents', icon: <FileTextOutlined />, label: '内容与影响力' })
    if (hasPerm('analytics.read')) items.push({ key: '/analytics', icon: <BarChartOutlined />, label: '数据分析' })
    if (hasPerm('admin.read')) items.push({ key: '/admin', icon: <SettingOutlined />, label: '系统管理' })
    return items
  }, [me?.perm_summary])

  const loadNotifs = async () => {
    try {
      const d = await get('/notifications?page_size=20')
      setNotifs(d.rows ?? [])
      setUnread(d.meta?.unread ?? 0)
    } catch { /* 通知拉取失败不打扰主界面 */ }
  }
  useEffect(() => {
    loadNotifs()
    const timer = setInterval(loadNotifs, 30000)
    return () => clearInterval(timer)
  }, [identityId, orgId])

  const markRead = async (id: string) => {
    await post(`/notifications/${id}/read`)
    loadNotifs()
  }
  const readAll = async () => {
    await post('/notifications/read-all')
    loadNotifs()
  }

  const switchIdentity = async (id: string | null) => {
    try {
      await switchContext(id, orgId)
      message.success('身份已切换（权限上下文已刷新）')
      nav('/')
    } catch (e) {
      message.error((e as Error).message)
    }
  }
  const switchOrg = async (id: string | null) => {
    try {
      await switchContext(identityId, id)
      message.success('组织已切换（权限上下文已刷新）')
      nav('/')
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const logout = async () => {
    setTokens(null)
    nav('/login', { replace: true })
  }

  const currentOrg = orgs.find((o: Obj) => o.org_id === orgId)
  const currentIdentity = identities.find((i) => i.id === identityId)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} trigger={null} width={220}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="pc-brand" style={{ color: '#fff' }}>
            <span className="logo">体</span>
            {!collapsed && (
              <span>
                专体工作台
                <div className="en" style={{ color: 'rgba(255,255,255,0.55)' }}>PERSON SPORTS PC</div>
              </span>
            )}
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[loc.pathname]}
          items={menuItems}
          onClick={({ key }) => nav(key)}
        />
        <div style={{ position: 'absolute', bottom: 16, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          {!collapsed && <div>演示环境 · 本地权威库</div>}
        </div>
      </Sider>
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', gap: 16, paddingInline: 20, borderBottom: '1px solid var(--line)' }}>
          <span onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer', fontSize: 16 }}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="全局搜索：项目 / 人员 / 课程 / 赛事"
            style={{ width: 320 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => keyword.trim() && nav(`/search?q=${encodeURIComponent(keyword.trim())}`)}
          />
          <div style={{ flex: 1 }} />
          <Space size="middle">
            <Select
              size="middle"
              style={{ minWidth: 180 }}
              placeholder="切换组织"
              value={orgId ?? undefined}
              onChange={(v) => switchOrg(v)}
              options={orgs.map((o: Obj) => ({ value: o.org_id, label: `${o.org_name}（${o.role === 'org_admin' ? '管理员' : '成员'}）` }))}
            />
            <Select
              style={{ minWidth: 150 }}
              placeholder="切换身份"
              value={identityId ?? undefined}
              onChange={(v) => switchIdentity(v)}
              options={identities.map((i) => ({ value: i.id, label: i.label }))}
            />
            <Badge count={unread} offset={[-2, 2]}>
              <BellOutlined style={{ fontSize: 18 }} onClick={() => setNotifOpen(true)} />
            </Badge>
            {currentOrg && <Tag color="blue">{String(currentOrg.org_name)}</Tag>}
            {currentIdentity && <Tag>{currentIdentity.label}</Tag>}
            <Dropdown
              menu={{
                items: [
                  { key: 'settings', icon: <SettingOutlined />, label: '个人设置' },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
                ],
                onClick: ({ key }) => {
                  if (key === 'settings') nav('/settings')
                  if (key === 'logout') void logout()
                },
              }}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <Typography.Text>{String(me?.display_name ?? '')}</Typography.Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
      <Drawer
        title={
          <Space>
            通知中心
            <Typography.Link onClick={readAll}>全部已读</Typography.Link>
          </Space>
        }
        width={420}
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
      >
        {notifs.length === 0 ? (
          <Empty description="暂无通知" />
        ) : (
          <List
            dataSource={notifs}
            renderItem={(n) => (
              <List.Item
                actions={
                  n.read_at
                    ? []
                    : [
                        <Popconfirm key="r" title="标记已读？" onConfirm={() => markRead(n.id)}>
                          <Typography.Link>已读</Typography.Link>
                        </Popconfirm>,
                      ]
                }
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {!n.read_at && <Badge status="processing" />}
                      {n.title}
                      <Tag style={{ marginLeft: 4 }}>{STATUS_LABELS[n.category] ?? n.category}</Tag>
                    </Space>
                  }
                  description={`${n.body ?? ''} · ${dayjs(n.created_at).format('MM-DD HH:mm')}`}
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </Layout>
  )
}

type Obj = Record<string, any>
