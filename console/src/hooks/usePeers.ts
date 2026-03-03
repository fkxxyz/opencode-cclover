import { useEffect, useState } from "react"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"
import type { PeerWithLastMessage } from "../types/index"

export function usePeers(projectId: string | undefined, employeeName: string) {
  const [peers, setPeers] = useState<PeerWithLastMessage[]>([])
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
      const details = event.details as any
      if (!details || !details.from || !details.to) return

      const from = details.from as string
      const to = details.to as string
      const content = details.content as string

      // 如果消息涉及当前员工，更新 peers 列表
      if (from === employeeName || to === employeeName) {
        const newPeerName = from === employeeName ? to : from
        setPeers((prev) => {
          // 查找是否已存在
          const existingIndex = prev.findIndex((p) => p.name === newPeerName)
          if (existingIndex >= 0) {
            // 已存在，更新最后消息时间和内容
            const updated = [...prev]
            updated[existingIndex] = {
              name: newPeerName,
              lastMessageTime: event.timestamp,
              lastMessageContent: content?.substring(0, 50),
            }
            // 重新排序：最新消息的排在最前
            updated.sort((a, b) => {
              if (a.lastMessageTime && b.lastMessageTime) {
                return (
                  new Date(b.lastMessageTime).getTime() -
                  new Date(a.lastMessageTime).getTime()
                )
              }
              if (a.lastMessageTime && !b.lastMessageTime) return -1
              if (!a.lastMessageTime && b.lastMessageTime) return 1
              return a.name.localeCompare(b.name)
            })
            return updated
          } else {
            // 不存在，添加到列表开头
            return [
              {
                name: newPeerName,
                lastMessageTime: event.timestamp,
                lastMessageContent: content?.substring(0, 50),
              },
              ...prev,
            ]
          }
        })
      }
    })

    return unsubscribe
  }, [subscribe, employeeName])

  return { peers, loading }
}
