import { useEffect, useState } from "react"
import type { Message } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"
export function useMessages(
  projectId: string | undefined,
  employeeName: string,
  peer?: string
) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribe } = useWebSocket()
  // 初始加载
  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    apiClient
      .getMessages(projectId, employeeName, peer)
      .then(setMessages)
      .catch((err: Error) => {
        console.error("获取消息失败:", err)
        setMessages([])
      })
      .finally(() => setLoading(false))
  }, [projectId, employeeName, peer])
  // 实时更新
  useEffect(() => {
    const unsubscribe = subscribe("message", (event) => {
      // 从 Event 对象中提取消息数据
      const details = event.details as any
      if (!details || !details.from || !details.to) {
        return
      }

      const from = details.from as string
      const to = details.to as string
      const content = details.content as string

      // 检查消息是否与当前员工和对话对象相关
      const isRelevant =
        (from === employeeName && (!peer || to === peer)) ||
        (to === employeeName && (!peer || from === peer))

      if (isRelevant) {
        // 构造完整的 Message 对象
        const message: Message = {
          from,
          to,
          content,
          timestamp: event.timestamp,
          direction: from === employeeName ? "send" : "receive",
        }
        setMessages((prev) => [...prev, message])
      }
    })
    return unsubscribe
  }, [subscribe, employeeName, peer])
  return { messages, loading }
}
