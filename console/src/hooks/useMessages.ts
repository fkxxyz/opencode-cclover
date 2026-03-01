import { useEffect, useState } from "react"
import type { Message } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"

export function useMessages(employeeName: string, peer?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribe } = useWebSocket()

  // 初始加载
  useEffect(() => {
    setLoading(true)
    apiClient
      .getMessages(employeeName, peer)
      .then(setMessages)
      .catch((err: Error) => {
        console.error("获取消息失败:", err)
        setMessages([])
      })
      .finally(() => setLoading(false))
  }, [employeeName, peer])

  // 实时更新
  useEffect(() => {
    const unsubscribe = subscribe("message", (event) => {
      const messageData = event.details as unknown as Message
      if (
        messageData &&
        ((messageData.from === employeeName &&
          (!peer || messageData.to === peer)) ||
          (messageData.to === employeeName &&
            (!peer || messageData.from === peer)))
      ) {
        setMessages((prev) => [...prev, messageData])
      }
    })
    return unsubscribe
  }, [subscribe, employeeName, peer])

  return { messages, loading }
}
