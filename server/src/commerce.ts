// 商业化公共参数：平台服务费率（演示参数，待产品决策）
// 费率只由服务端读取；订单创建时写入 fee_rate_snapshot，历史订单不随改价/改率回溯。
import { kvGet, kvSet } from './db'
import { err } from './util'

export const DEFAULT_PLATFORM_FEE_RATE = 0.1

/** 当前平台服务费率（0-0.5）；非法配置回落默认值并保持只读容错 */
export function getPlatformFeeRate(): number {
  const raw = kvGet('platform_fee_rate')
  const n = raw == null ? NaN : Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 0.5) return DEFAULT_PLATFORM_FEE_RATE
  return n
}

export function setPlatformFeeRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.5) throw err.validation('费率需在 0-0.5 之间（演示配置）')
  kvSet('platform_fee_rate', String(rate))
}

/** 费率展示（避免浮点尾差；仅用于文案） */
export function feeRatePercent(rate: number): string {
  return `${Math.round(rate * 10000) / 100}%`
}
