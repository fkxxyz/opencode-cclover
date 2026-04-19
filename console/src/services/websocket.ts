import type { Event, EventType, WebSocketMessage } from "../types/index"
import { getWebSocketUrlFromRuntime } from "../lib/backend-config"

const WS_URL = getWebSocketUrlFromRuntime()
const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const HEARTBEAT_TIMEOUT = 60000 // 60 seconds
const MAX_RECONNECT_ATTEMPTS = 10
const BASE_RECONNECT_DELAY = 1000 // 1 second
const SLOW_RETRY_DELAY = 60000 // 60 seconds for slow retry after max attempts

export class WebSocketClient {
  private ws: WebSocket | null = null
  private eventHandlers: Map<EventType, Set<(event: Event) => void>> = new Map()
  private reconnectAttempts = 0
  private heartbeatInterval: NodeJS.Timeout | null = null
  private heartbeatTimeout: NodeJS.Timeout | null = null
  private connecting = false
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true
  connect(): void {
    // 如果已经连接或正在连接中，直接返回
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING ||
      this.connecting
    ) {
      return
    }

    // 如果离线，等待网络恢复
    if (!this.isOnline) {
      console.log("Network offline, waiting for recovery...")
      this.emit("disconnected")
      return
    }

    this.connecting = true
    this.emit("connecting")
    this.ws = new WebSocket(WS_URL)
    this.ws.onopen = () => {
      console.log("WebSocket connected")
      this.connecting = false
      this.reconnectAttempts = 0
      this.emit("connected")
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
      this.connecting = false
      this.emit("error", error)
    }
    this.ws.onclose = () => {
      console.log("WebSocket disconnected")
      this.connecting = false
      this.stopHeartbeat()
      this.emit("disconnected")
      this.reconnect()
    }
  }
  disconnect(): void {
    this.connecting = false
    this.stopHeartbeat()
    this.clearReconnectTimeout()
    this.ws?.close()
    this.ws = null
  }

  manualReconnect(): void {
    console.log("Manual reconnect requested")
    this.disconnect()
    this.reconnectAttempts = 0
    this.connect()
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

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }
  private reconnect(): void {
    // 永不放弃重连：达到最大尝试次数后，使用慢速重试（60秒间隔）
    let delay: number

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      // 指数退避：1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s
      delay = BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts)
      this.reconnectAttempts++
      console.log(
        `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
      )
    } else {
      // 达到最大尝试次数后，使用慢速重试（60秒）
      delay = SLOW_RETRY_DELAY
      console.log(
        `Max reconnection attempts reached, retrying in ${delay}ms (slow retry)...`
      )
    }

    this.reconnectTimeout = setTimeout(() => this.connect(), delay)
  }

  private setupNetworkListeners(): void {
    // 监听网络状态变化
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        console.log("Network online detected")
        this.isOnline = true
        // 网络恢复时，立即尝试重连
        if (!this.connecting && this.ws?.readyState !== WebSocket.OPEN) {
          this.reconnectAttempts = 0
          this.connect()
        }
      })

      window.addEventListener("offline", () => {
        console.log("Network offline detected")
        this.isOnline = false
        this.emit("disconnected")
      })
    }
  }

  private emit(eventType: string, data?: any): void {
    // 发送连接状态事件
    const handlers = this.eventHandlers.get(eventType as EventType)
    if (handlers) {
      handlers.forEach((handler) => handler(data as Event))
    }
  }
  private handleEvent(event: Event): void {
    // 触发特定类型的处理器
    const handlers = this.eventHandlers.get(event.type)
    if (handlers) {
      handlers.forEach((handler) => handler(event))
    }
    // 触发通配符处理器
    const wildcardHandlers = this.eventHandlers.get("*" as EventType)
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(event))
    }
  }

  constructor() {
    this.setupNetworkListeners()
  }
}
