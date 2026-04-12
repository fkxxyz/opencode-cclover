import { useEffect, useState } from "react"
import type { TimelineItem, Message } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"

const MAX_TIMELINE_ITEMS = 500

// 合并两个timeline并去重
function mergeTimelines(
  timeline1: TimelineItem[],
  timeline2: TimelineItem[]
): TimelineItem[] {
  const messageKeys = new Set<string>()
  const merged: TimelineItem[] = []

  // 合并两个timeline
  const all = [...timeline1, ...timeline2]

  for (const item of all) {
    if (item.type === "message") {
      // 消息去重：使用 timestamp-from-to 作为唯一键
      const message = item.data as Message
      const key = `${item.timestamp}-${message.from}-${message.to}`
      if (!messageKeys.has(key)) {
        messageKeys.add(key)
        merged.push(item)
      }
    } else {
      // 事件不会重复，直接添加
      merged.push(item)
    }
  }

  // 按时间戳排序
  return merged.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export function useTimeline(
  projectId: string | undefined,
  employeeId: string,
  peer?: string,
  limit?: number
) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const { subscribe } = useWebSocket()

  // 初始加载
  useEffect(() => {
    if (!projectId) return

    setLoading(true)

    // 如果有peer，同时获取两个timeline
    const promises = [
      apiClient.getTimeline(projectId, employeeId, limit || 100),
    ]
    if (peer) {
      promises.push(apiClient.getTimeline(projectId, peer, limit || 100))
    }

    Promise.all(promises)
      .then((results) => {
        const merged = peer
          ? mergeTimelines(results[0], results[1])
          : results[0]
        setTimeline(merged)
        // 设置最旧的时间戳
        if (merged.length > 0) {
          setOldestTimestamp(merged[0].timestamp)
        }
      })
      .catch((err: Error) => {
        console.error("获取时间线失败:", err)
        setTimeline([])
      })
      .finally(() => setLoading(false))
  }, [projectId, employeeId, peer, limit])

  // 加载更多消息
  const loadMoreMessages = async () => {
    if (!oldestTimestamp || !hasMore || loadingMore || !projectId) return

    setLoadingMore(true)
    try {
      const olderMessages = await apiClient.getTimeline(
        projectId,
        employeeId,
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
      // 检查事件是否与当前员工或peer相关
      let isRelevant = false

      if (event.type === "message") {
        // 消息事件：检查 from 或 to 是否是当前员工或peer
        const details = event.details as any
        const from = details?.from as string
        const to = details?.to as string
        isRelevant =
          from === employeeId ||
          to === employeeId ||
          (!!peer && (from === peer || to === peer))
      } else {
        // 其他事件：检查 employeeId 字段是否是当前员工或peer（向后兼容：回退到 employeeName）
        const eventEmployeeId = event.employeeId || (event as any).employeeName
        isRelevant =
          eventEmployeeId === employeeId || (!!peer && eventEmployeeId === peer)
      }

      if (isRelevant) {
        // 如果是消息事件，只添加消息项
        if (event.type === "message") {
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
                details.from === employeeId
                  ? ("send" as const)
                  : ("receive" as const),
            },
          }
          setTimeline((prev) => {
            // 检查消息是否已存在（去重）
            const message = messageItem.data as Message
            const key = `${messageItem.timestamp}-${message.from}-${message.to}`
            const exists = prev.some((item) => {
              if (item.type === "message") {
                const m = item.data as Message
                return `${item.timestamp}-${m.from}-${m.to}` === key
              }
              return false
            })
            if (exists) return prev

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
  }, [subscribe, employeeId, peer])

  return { timeline, loading, loadMoreMessages, hasMore, loadingMore }
}
