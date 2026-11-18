// 全局错误边界：捕获渲染期错误，显示可恢复的错误界面（避免白屏）
import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown): void {
    // 渲染期错误记录到 window 便于自动化诊断（生产环境应上报日志系统）
    ;(window as unknown as { __ztLastError?: string }).__ztLastError = error.message + (info ? ' | ' + JSON.stringify(info) : '')
    console.error('[ErrorBoundary]', error, info)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#c0392b' }}>页面渲染出现错误</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f6f8fa', padding: 12, borderRadius: 8 }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack?.slice(0, 1200)}
          </pre>
          <button
            onClick={() => {
              this.setState({ error: null })
              location.hash = '#/'
              location.reload()
            }}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0765FE', color: '#fff', fontWeight: 700 }}
          >
            返回首页
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
