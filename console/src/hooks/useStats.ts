import { useEffect, useState } from "react"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"

interface Stats {
  totalEmployees: number
  activeEmployees: number
  pendingTasks: number
  todayMessages: number
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingTasks: 0,
    todayMessages: 0,
  })
  const [loading, setLoading] = useState(true)
  const { subscribe } = useWebSocket()

  // 初始加载
  useEffect(() => {
    setLoading(true)
    apiClient
      .getStats()
      .then(setStats)
      .catch((err: Error) => {
        console.error("获取统计数据失败:", err)
      })
      .finally(() => setLoading(false))
  }, [])

  // 实时更新 - 监听相关事件
  useEffect(() => {
    const unsubscribeHired = subscribe("employee_hired", () => {
      apiClient.getStats().then(setStats)
    })

    const unsubscribeStatus = subscribe("employee_status_changed", () => {
      apiClient.getStats().then(setStats)
    })

    const unsubscribeTask = subscribe("task_updated", () => {
      apiClient.getStats().then(setStats)
    })

    const unsubscribeMessage = subscribe("message_sent", () => {
      apiClient.getStats().then(setStats)
    })

    return () => {
      unsubscribeHired()
      unsubscribeStatus()
      unsubscribeTask()
      unsubscribeMessage()
    }
  }, [subscribe])

  return { stats, loading }
}
