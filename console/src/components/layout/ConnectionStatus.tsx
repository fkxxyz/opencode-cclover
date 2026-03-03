import { useEffect } from "react"

export function ConnectionStatus() {
  useEffect(() => {
    // WebSocket 连接状态监控已通过 wsClient 内部处理
    // 此组件保留用于未来扩展
  }, [])

  // 可以在 UI 中显示连接状态指示器
  return null // 或者返回一个状态指示器组件
}
