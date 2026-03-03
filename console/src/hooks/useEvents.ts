import { useEffect, useState } from "react"
import type { Event } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"

const MAX_EVENTS = 500

export function useEvents(
  projectId: string | undefined,
  options?: { limit?: number; employeeName?: string }
) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribe } = useWebSocket()
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
      setEvents((prev) => {
        const newEvents = [...prev, event]
        // 只保留最近的 MAX_EVENTS 条
        return newEvents.slice(-MAX_EVENTS)
      })
    })
    return unsubscribe
  }, [subscribe])
  return { events, loading }
}
