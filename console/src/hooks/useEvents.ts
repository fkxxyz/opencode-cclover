import { useEffect, useState, useRef, useMemo } from "react"
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
  const employeeNameRef = useRef(options?.employeeName)
  const limitRef = useRef(options?.limit)

  // 更新 refs
  useEffect(() => {
    employeeNameRef.current = options?.employeeName
    limitRef.current = options?.limit
  }, [options?.employeeName, options?.limit])

  // 使用 useMemo 稳定 options 对象
  const stableOptions = useMemo(
    () => ({
      limit: options?.limit,
      employeeName: options?.employeeName,
    }),
    [options?.limit, options?.employeeName]
  )

  // 初始加载
  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    apiClient
      .getEvents(projectId, stableOptions)
      .then(setEvents)
      .catch((err: Error) => {
        console.error("获取事件失败:", err)
        setEvents([])
      })
      .finally(() => setLoading(false))
  }, [projectId, stableOptions])

  // 实时更新
  useEffect(() => {
    const unsubscribe = subscribe("*", (event) => {
      // 过滤掉消息相关的事件，这些由 useTimeline 处理
      if (
        event.type === "message" ||
        event.type === "message_sent" ||
        event.type === "message_received"
      ) {
        return
      }

      // 如果指定了 employeeName，只接收该员工的事件
      if (
        employeeNameRef.current &&
        event.employeeName !== employeeNameRef.current
      ) {
        return
      }
      setEvents((prev) => {
        // 新事件添加到数组开头（显示在列表顶部）
        const newEvents = [event, ...prev]
        // 只保留最近的 MAX_EVENTS 条（从开头截取）
        return newEvents.slice(0, MAX_EVENTS)
      })
    })
    return unsubscribe
  }, [subscribe])

  return { events, loading }
}
