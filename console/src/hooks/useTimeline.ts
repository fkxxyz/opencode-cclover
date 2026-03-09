import { useEffect, useState, useRef } from "react"
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
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const { subscribe } = useWebSocket()
  const prevPeerRef = useRef<string | null>(null)

  // 初始加载
  useEffect(() => {
    if (!projectId) return

    setLoading(true)
    apiClient
      .getTimeline(projectId, employeeName, limit || 100)
      .then((data) => {
        setTimeline(data)
        // 设置最旧的时间戳
        if (data.length > 0) {
          setOldestTimestamp(data[0].timestamp)
        }
      })
      .catch((err: Error) => {
        console.error("获取时间线失败:", err)
        setTimeline([])
      })
      .finally(() => setLoading(false))
  }, [projectId, employeeName, limit])

  // 加载更多消息
  const loadMoreMessages = async () => {
    if (!oldestTimestamp || !hasMore || loadingMore || !projectId) return

    setLoadingMore(true)
    try {
      const olderMessages = await apiClient.getTimeline(
        projectId,
        employeeName,
        50, // 加载 50 条更早的消息
        oldestTimestamp // 游标
      )

      if (olderMessages.length === 0) {
        setHasMore(false)
      } else {
        // 前置更早的消息（保持升序）
        setTimeline((prev) => [...olderMessages, ...prev])
        // 更新游标到最旧的消息
        setOldestTimestamp(olderMessages[0].timestamp)
      }
    } catch (err) {
      console.error("加载更多消息失败:", err)
    } finally {
      setLoadingMore(false)
    }
  }

  // 实时更新 - 监听所有事件类型
  useEffect(() => {
    const unsubscribe = subscribe("*", (event) => {
      // 检查事件是否与当前员工相关
      let isRelevant = false

      if (event.type === "message") {
        // 消息事件：检查 from 或 to 是否是当前员工
        const details = event.details as any
        const from = details?.from as string
        const to = details?.to as string
        isRelevant = from === employeeName || to === employeeName
      } else {
        // 其他事件：检查 employeeName 字段
        isRelevant = event.employeeName === employeeName
      }

      if (isRelevant) {
        // 如果是消息事件，只添加消息项
        if (
          event.type === "message" ||
          event.type === "message_sent" ||
          event.type === "message_received"
        ) {
          const details = event.details as any
          const messageItem: TimelineItem = {
            type: "message",
            timestamp: event.timestamp,
            data: {
              timestamp: event.timestamp,
              from: details.from as string,
              to: details.to as string,
              content: details.content as string,
              direction:
                details.from === employeeName
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

  return { timeline, loading, loadMoreMessages, hasMore, loadingMore }
}
