// 页面状态演示：加载中 / 空数据 / 无网络（PRD §9.1 必要反馈原型）
import { useEffect, useState } from 'react'
import { ListSkeleton, EmptyState, ErrorState, FeedSkeleton } from '../components/ui'
import DetailHeader from '../components/DetailHeader'
import { MockFooter } from '../components/ui'

type Demo = 'loading' | 'empty' | 'error'

export default function StatesPage() {
  const [demo, setDemo] = useState<Demo>('loading')
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    if (demo === 'loading') {
      const t = setTimeout(() => setDemo('empty'), 2200)
      return () => clearTimeout(t)
    }
  }, [demo, reloading])

  return (
    <>
      <DetailHeader title="页面状态演示" sub="加载 / 空态 / 失败原型" />
      <div className="page page-nofoot">
        <div className="seg">
          {(
            [
              ['loading', '加载中'],
              ['empty', '空数据'],
              ['error', '无网络/失败'],
            ] as [Demo, string][]
          ).map(([k, label]) => (
            <button key={k} className={`seg-item ${demo === k ? 'active' : ''}`} onClick={() => setDemo(k)}>
              {label}
            </button>
          ))}
        </div>

        <div className="card mt12" style={{ minHeight: 320 }}>
          {demo === 'loading' && (
            <>
              <div className="t-mini mb12">信息流加载骨架（约 2.2 秒后自动切换为空态演示）：</div>
              <FeedSkeleton />
              <div className="mt16">
                <div className="t-mini mb8">列表加载骨架：</div>
                <ListSkeleton />
              </div>
            </>
          )}
          {demo === 'empty' && (
            <EmptyState
              title="这里还没有内容"
              desc="示例：用户尚未关注任何人时，首页「关注」频道展示的空态原型。"
              icon="grid"
              action={<button className="btn btn-primary btn-sm">去发现内容</button>}
            />
          )}
          {demo === 'error' && (
            <ErrorState onRetry={() => setReloading((r) => !r)} />
          )}
        </div>

        <div className="demo-strip">
          所有列表页在真实环境中会接入同样的加载/空态/失败反馈；本页集中呈现三类状态原型。
        </div>
        <MockFooter />
      </div>
    </>
  )
}
