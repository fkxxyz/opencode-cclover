import { useEffect, useState } from "react"
import type { Event } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"
export function useEvents(
  projectId: string | undefined,
  options?: { limit?: number; employeeName?: string }
) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribe } = useWebSocket()
  const limit = options?.limit || 50
  // 初始加载
  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    apiClient
      .getEvents(projectId, options)
      .then(setEvents)
      .catch((err: Error) => {
        console.error("获取事件失败:", err)
        setEvents([])
      })
      .finally(() => setLoading(false))
  }, [projectId, options?.limit, options?.employeeName])
  // 实时更新
  useEffect(() => {
    const unsubscribe = subscribe("message", (event) => {
      setEvents((prev) => [event, ...prev].slice(0, limit))
    })
    return unsubscribe
  }, [subscribe, limit])
  return { events, loading }
}
