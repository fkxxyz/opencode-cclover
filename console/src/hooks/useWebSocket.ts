import { useEffect, useState, useCallback } from "react"
import type { Event, EventType } from "../types/index"
import { wsClient } from "../services/index"

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    wsClient.connect()
    setIsConnected(true)

    return () => {
      wsClient.disconnect()
      setIsConnected(false)
    }
  }, [])

  const subscribe = useCallback(
    (eventType: EventType, handler: (event: Event) => void) => {
      wsClient.on(eventType, handler)
      return () => wsClient.off(eventType, handler)
    },
    []
  )

  return { isConnected, subscribe }
}
