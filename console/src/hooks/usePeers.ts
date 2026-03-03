import { useEffect, useState } from "react"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"

export function usePeers(projectId: string | undefined, employeeName: string) {
  const [peers, setPeers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribe } = useWebSocket()

  // 初始加载
  useEffect(() => {
    if (!projectId) return

    setLoading(true)
    apiClient
      .getPeers(projectId, employeeName)
      .then(setPeers)
      .catch((err: Error) => {
        console.error("获取对话列表失败:", err)
        setPeers([])
      })
      .finally(() => setLoading(false))
  }, [projectId, employeeName])

  // 实时更新：收到新消息时更新对话列表
  useEffect(() => {
    const unsubscribe = subscribe("message", (event) => {
      const messageData = event.details as any
      if (!messageData) return

      // 如果消息涉及当前员工，更新 peers 列表
      if (
        messageData.from === employeeName ||
        messageData.to === employeeName
      ) {
        const newPeer =
          messageData.from === employeeName ? messageData.to : messageData.from

        setPeers((prev) => {
          if (!prev.includes(newPeer)) {
            return [...prev, newPeer]
          }
          return prev
        })
      }
    })

    return unsubscribe
  }, [subscribe, employeeName])

  return { peers, loading }
}
