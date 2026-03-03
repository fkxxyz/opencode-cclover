import { useEffect, useState } from "react"
import type { TimelineItem } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"

export function useTimeline(
  projectId: string | undefined,
  employeeName: string,
  limit?: number
) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribe } = useWebSocket()

  // 初始加载
  useEffect(() => {
    if (!projectId) return

    setLoading(true)
    apiClient
      .getTimeline(projectId, employeeName, limit)
      .then(setTimeline)
      .catch((err: Error) => {
        console.error("获取时间线失败:", err)
        setTimeline([])
      })
      .finally(() => setLoading(false))
  }, [projectId, employeeName, limit])

  // 实时更新 - 监听所有事件类型
  useEffect(() => {
    const unsubscribe = subscribe("*", (event) => {
      // 只添加与当前员工相关的事件
      if (event.employeeName === employeeName) {
        setTimeline((prev) => [
          ...prev,
          {
            type: "event",
            timestamp: event.timestamp,
            data: event,
          },
        ])
      }
    })

    return unsubscribe
  }, [subscribe, employeeName])

  return { timeline, loading }
}
