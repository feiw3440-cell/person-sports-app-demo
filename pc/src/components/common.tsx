// 通用：状态标签 / 数据获取 Hook / 页面状态（加载/错误/空/无权）
import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Spin, Tag } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { STATUS_COLORS, STATUS_LABELS } from '@/theme'
import { ApiError } from '@/api/client'

export function StatusTag({ status }: { status?: string }) {
  if (!status) return null
  return <Tag color={STATUS_COLORS[status] ?? 'default'}>{STATUS_LABELS[status] ?? status}</Tag>
}

export interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  errorCode: string | null
  reload: () => void
}

export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setErrorCode(null)
    fn()
      .then((d) => alive && setData(d))
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
        setErrorCode(e instanceof ApiError ? e.code : null)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  return { data, loading, error, errorCode, reload }
}

export function PageWrap({ fetch, children, skeleton }: { fetch: FetchState<unknown>; children: React.ReactNode; skeleton?: React.ReactNode }) {
  if (fetch.loading) return <div style={{ padding: 48, textAlign: 'center' }}>{skeleton ?? <Spin size="large" />}</div>
  if (fetch.error) {
    const denied = fetch.errorCode === 'FORBIDDEN'
    return (
      <Alert
        type={denied ? 'warning' : 'error'}
        showIcon
        message={denied ? '无权访问' : '加载失败'}
        description={fetch.error}
        action={
          <Button size="small" icon={<ReloadOutlined />} onClick={fetch.reload}>
            重试
          </Button>
        }
      />
    )
  }
  if (fetch.data === null) return <Alert type="info" showIcon message="暂无数据" />
  return <>{children}</>
}
