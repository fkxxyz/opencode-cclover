import { useEffect, useState } from "react"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"
interface Stats {
  totalEmployees: number
  activeEmployees: number
  pendingTasks: number
  todayMessages: number
}
export function useStats(projectId: string | undefined) {
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
    if (!projectId) {
      setLoading(false)
      return
    }
    setLoading(true)
    apiClient
      .getStats(projectId)
      .then(setStats)
      .catch((err: Error) => {
        console.error("获取统计数据失败:", err)
      })
      .finally(() => setLoading(false))
  }, [projectId])
  // 实时更新 - 监听相关事件
  useEffect(() => {
    if (!projectId) return
    const unsubscribeHired = subscribe("employee_hired", () => {
      apiClient.getStats(projectId).then(setStats)
    })
    const unsubscribeStatus = subscribe("employee_status_changed", () => {
      apiClient.getStats(projectId).then(setStats)
    })
    const unsubscribeTask = subscribe("task_modified", () => {
      apiClient.getStats(projectId).then(setStats)
    })
    const unsubscribeMessage = subscribe("message", () => {
      apiClient.getStats(projectId).then(setStats)
    })
    return () => {
      unsubscribeHired()
      unsubscribeStatus()
      unsubscribeTask()
      unsubscribeMessage()
    }
  }, [subscribe, projectId])
  return { stats, loading }
}
