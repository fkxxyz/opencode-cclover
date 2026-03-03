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
      // 如果指定了 employeeName，检查事件是否与该员工相关
      if (employeeNameRef.current) {
        // 对于消息事件，检查 from 或 to 是否是当前员工
        if (
          event.type === "message" ||
          event.type === "message_sent" ||
          event.type === "message_received"
        ) {
          const details = event.details as any
          const from = details?.from as string
          const to = details?.to as string
          if (
            from !== employeeNameRef.current &&
            to !== employeeNameRef.current
          ) {
            return
          }
        } else {
          // 其他事件：检查 employeeName 字段
          if (event.employeeName !== employeeNameRef.current) {
            return
          }
        }
      }

      // 过滤掉消息相关的事件，这些由 useTimeline 处理
      if (
        event.type === "message" ||
        event.type === "message_sent" ||
        event.type === "message_received"
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
