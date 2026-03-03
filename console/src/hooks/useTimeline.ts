import { useEffect, useState } from "react"
import type { TimelineItem } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"

const MAX_TIMELINE_ITEMS = 500

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
        // 如果是消息事件，转换为消息格式
        if (
          event.type === "message" ||
          event.type === "message_sent" ||
          event.type === "message_received"
        ) {
          const messageItem: TimelineItem = {
            type: "message",
            timestamp: event.timestamp,
            data: {
              timestamp: event.timestamp,
              from: event.details.from as string,
              to: event.details.to as string,
              content: event.details.content as string,
              direction:
                event.details.from === employeeName
                  ? ("send" as const)
                  : ("receive" as const),
            },
          }
          setTimeline((prev) => {
            const newTimeline = [...prev, messageItem]
            // 只保留最近的 MAX_TIMELINE_ITEMS 条
            return newTimeline.slice(-MAX_TIMELINE_ITEMS)
          })
        } else {
          // 其他事件保持原样
          setTimeline((prev) => {
            const newTimeline = [
              ...prev,
              {
                type: "event" as const,
                timestamp: event.timestamp,
                data: event,
              },
            ]
            // 只保留最近的 MAX_TIMELINE_ITEMS 条
            return newTimeline.slice(-MAX_TIMELINE_ITEMS)
          })
        }
      }
    })

    return unsubscribe
  }, [subscribe, employeeName])

  return { timeline, loading }
}
