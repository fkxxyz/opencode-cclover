import type { Event, EventType, WebSocketMessage } from "../types/index"

const WS_URL = "ws://localhost:4097/ws"
const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const HEARTBEAT_TIMEOUT = 60000 // 60 seconds
const MAX_RECONNECT_ATTEMPTS = 10
const BASE_RECONNECT_DELAY = 1000 // 1 second

export class WebSocketClient {
  private ws: WebSocket | null = null
  private eventHandlers: Map<EventType, Set<(event: Event) => void>> = new Map()
  private reconnectAttempts = 0
  private heartbeatInterval: NodeJS.Timeout | null = null
  private heartbeatTimeout: NodeJS.Timeout | null = null
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }
    this.ws = new WebSocket(WS_URL)
    this.ws.onopen = () => {
      console.log("WebSocket connected")
      this.reconnectAttempts = 0
      this.startHeartbeat()
    }
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage
        if (message.type === "event") {
          this.handleEvent(message.data)
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error)
      }
    }
    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error)
    }
    this.ws.onclose = () => {
      console.log("WebSocket disconnected")
      this.stopHeartbeat()
      this.reconnect()
    }
  }
  disconnect(): void {
    this.stopHeartbeat()
    this.ws?.close()
    this.ws = null
  }
  on(eventType: EventType, handler: (event: Event) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set())
    }
    this.eventHandlers.get(eventType)!.add(handler)
  }
  off(eventType: EventType, handler: (event: Event) => void): void {
    this.eventHandlers.get(eventType)?.delete(handler)
  }
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }))
        // Set timeout to detect if pong is not received
        this.heartbeatTimeout = setTimeout(() => {
          console.warn("Heartbeat timeout, reconnecting...")
          this.ws?.close()
        }, HEARTBEAT_TIMEOUT)
      }
    }, HEARTBEAT_INTERVAL)
  }
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }
  private reconnect(): void {
    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts)
      console.log(`Reconnecting in ${delay}ms...`)
      setTimeout(() => this.connect(), delay)
      this.reconnectAttempts++
    } else {
      console.error("Max reconnection attempts reached, stopping reconnection")
    }
  }
  private handleEvent(event: Event): void {
    const handlers = this.eventHandlers.get(event.type)
    if (handlers) {
      handlers.forEach((handler) => handler(event))
    }
  }
}
