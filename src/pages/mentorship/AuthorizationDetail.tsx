// 授权详情/链路：范围字段 + 状态 + 链路可视化（导师 → 授权教练 → 学员）
// 账号 ID 与人员档案 ID 命名空间不同：优先公开档案，缺失时使用服务端授权双方名称
import { useNavigate, useParams } from 'react-router-dom'
import { AUTHORIZATIONS, MENTORSHIPS, userById } from '../../data/db'
import Icon from '../../components/Icon'
import DetailHeader from '../../components/DetailHeader'
import { Avatar, EmptyState, InfoRow, MockFooter } from '../../components/ui'

export default function AuthorizationDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const az = AUTHORIZATIONS.find((a) => a.id === id)
  if (!az) return <EmptyState title="授权记录不存在" />

  const mentor = userById(az.mentorId)
  const grantee = userById(az.granteeId)
  const mentorName = mentor?.name || az.mentorName || '导师'
  const granteeName = grantee?.name || az.granteeName || '被授权方'
  const mentorColor = mentor?.color || '#12345B'
  const granteeColor = grantee?.color || '#2872B8'
  const mentorTitle = mentor?.title || '导师'
  const children = AUTHORIZATIONS.filter((a) => a.parentAuthorizationId === az.id)
  const parent = az.parentAuthorizationId ? AUTHORIZATIONS.find((a) => a.id === az.parentAuthorizationId) : undefined

  return (
    <>
      <DetailHeader title="授权详情" sub={`编号 ${az.id} · 演示数据`} />
      <div className="page page-nofoot">
        <div className="card">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div className="t-title" style={{ fontSize: 14 }}>
              授权状态
            </div>
            <span className={`badge ${az.status === '生效中' ? 'badge-verified' : az.status === '已撤销' ? 'badge-unverified' : 'badge-pending'}`}>
              {az.status}（演示）
            </span>
          </div>
          <div className="mt12">
            <InfoRow icon="target" label="体育项目" value={az.scope.project} />
            <InfoRow icon="book" label="课程/教学内容" value={az.scope.content} />
            <InfoRow icon="location" label="地区范围" value={az.scope.region} />
            <InfoRow icon="clock" label="有效期限" value={az.scope.term} />
            <InfoRow icon="users" label="可否再授权" value={az.allowSubGrant ? '允许（可向学员/下级授权）' : '不允许'} />
          </div>
          {az.status !== '生效中' && (
            <div className="demo-strip" style={{ marginTop: 10 }}>
              该授权已{az.status}：{az.status === '已到期' ? '到期后授权自动失效，可续期后重新生效（演示说明）。' : '授权可由授权方或平台按规则撤销（演示说明）。'}
            </div>
          )}
        </div>

        {/* 授权链路 */}
        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            授权链路
          </div>
          {parent && (
            <div className="t-mini mt8">
              上级授权：{userById(parent.mentorId)?.name || parent.mentorName || '导师'} →{' '}
              {userById(parent.granteeId)?.name || parent.granteeName || '被授权方'}（点击
              <button className="t-blue" onClick={() => nav(`/authorization/${parent.id}`)}>
                查看上级授权
              </button>
              ）
            </div>
          )}
          <div className="mt12">
            <div className={`chain-node ${parent ? '' : 'hot'}`}>
              <Avatar name={mentorName} color={mentorColor} size="sm" />
              <div style={{ flex: 1 }}>
                <div className="t-title" style={{ fontSize: 13.5 }}>
                  {mentorName}
                </div>
                <div className="t-mini">导师（授权方）· {mentorTitle}</div>
              </div>
              <span className="badge badge-brand">导师</span>
            </div>
            <div className="chain-link">
              <Icon name="chevdown" size={16} />
              <span>授权{az.allowSubGrant ? '（可再授权）' : ''}</span>
            </div>
            <div className={`chain-node ${parent ? 'hot' : ''}`}>
              <Avatar name={granteeName} color={granteeColor} size="sm" />
              <div style={{ flex: 1 }}>
                <div className="t-title" style={{ fontSize: 13.5 }}>
                  {granteeName} {grantee?.id === 'u0' && '（我）'}
                </div>
                <div className="t-mini">{grantee?.kind === 'mentor' ? '导师' : '授权教练'} · 被授权方</div>
              </div>
              <span className="badge badge-blue">被授权</span>
            </div>
            {children.length > 0 && (
              <>
                <div className="chain-link">
                  <Icon name="chevdown" size={16} />
                  <span>再授权 × {children.length}</span>
                </div>
                {children.map((c) => {
                  const st = userById(c.granteeId)
                  const stName = st?.name || c.granteeName || '学员'
                  const stColor = st?.color || '#2872B8'
                  return (
                    <div key={c.id}>
                      <div className="chain-node">
                        <Avatar name={stName} color={stColor} size="sm" />
                        <div style={{ flex: 1 }}>
                          <div className="t-title" style={{ fontSize: 13.5 }}>
                            {stName}
                          </div>
                          <div className="t-mini">
                            学员 · {c.scope.content} · {c.scope.term}
                          </div>
                        </div>
                        <button className="btn btn-sm btn-ghost" onClick={() => nav(`/authorization/${c.id}`)}>
                          {c.status}
                        </button>
                      </div>
                      {c !== children[children.length - 1] && <div style={{ height: 8 }} />}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

        <div className="section">
          <div className="t-mini" style={{ lineHeight: 1.8 }}>
            说明：授权链路展示「导师 → 授权教练 → 学员/下级」的层级关系；本 Demo 不处理收益分账。授权模板、跨级授权、审批/撤销流程及未成年人相关规则待产品负责人确认。
          </div>
        </div>

        <MockFooter text="本页授权范围、期限与链路均为演示模拟数据" />
      </div>
    </>
  )
}
