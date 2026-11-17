// 关于：演示数据声明与范围说明
import DetailHeader from '../components/DetailHeader'
import { MockFooter } from '../components/ui'

export default function AboutPage() {
  return (
    <>
      <DetailHeader title="关于演示数据与范围" sub="专体 PERSON SPORTS 高保真交互演示" />
      <div className="page page-nofoot">
        <div className="card">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            模拟数据声明（PRD §9.3）
          </div>
          <div className="t-sub mt8" style={{ lineHeight: 1.8 }}>
            本演示中的全部账号、成绩、认证状态、排名、互动量、消息、赛事与课程均为<b>演示模拟数据</b>，
            不代表任何真实人物、机构或平台事实；不伪造真实认证、真实比赛成绩或平台已核实的事实；
            不接入真实支付、消息推送或线上用户数据。
          </div>
        </div>

        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            本次 Demo 范围
          </div>
          <div className="t-sub mt8" style={{ lineHeight: 1.8 }}>
            包含：五大导航（首页/发现/TOP/消息/我的）、项目发现与详情、视频图文内容与互动、运动员/导师主页、
            七类榜单 × 综合/专业/人气三模式、身份管理与切换、导师申请状态、师徒关系与授权链路、
            课程/赛事/机构展示与报名原型。
          </div>
          <div className="divider" />
          <div className="t-sub" style={{ lineHeight: 1.8 }}>
            明确排除：<b>商城完全不在本次 Demo 中</b>——无商城入口、商品、商家、推荐商品、佣金或任何交易流程；
            亦不包含完整支付、订单、收益分账、后台管理与真实数据接入。商城仅作为未来扩展方向保留。
          </div>
        </div>

        <div className="card mt12">
          <div className="sec-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
            待确认事项（演示中已按占位处理）
          </div>
          <div className="t-sub mt8" style={{ lineHeight: 1.8 }}>
            · 综合榜具体指标与权重（演示采用示意权重 6:4）<br />
            · 导师等级准确名称与晋级标准（演示用"认证/高级/体系导师"占位）<br />
            · 师徒授权跨级授权、模板与审批流程（演示仅展示链路与状态）<br />
            · 课程/赛事报名未来业务规则与实名/监护人流程<br />
            · 真实项目分类、成绩数据来源与机构资质审核口径
          </div>
        </div>

        <MockFooter />
      </div>
    </>
  )
}
