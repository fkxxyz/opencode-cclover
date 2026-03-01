import type { Event } from "../types/index"
import type { WebSocketMessage } from "./types"

/**
 * WebSocket 连接管理器
 * 维护客户端连接集合，处理消息和事件广播
 */
export class WebSocketManager {
  private clients: Set<any> = new Set()

  /**
   * 客户端连接时调用
   */
  open(ws: any): void {
    this.clients.add(ws)
  }

  /**
   * 收到客户端消息时调用
   * 目前只处理心跳，实际消息由客户端发送 ping 帧
   */
  message(ws: any, message: any): void {
    // 心跳处理由 Bun 自动处理 ping/pong
    // 这里可以处理其他自定义消息
  }

  /**
   * 客户端断开连接时调用
   */
  close(ws: any): void {
    this.clients.delete(ws)
  }

  /**
   * 广播事件到所有连接的客户端
   */
  broadcast(event: Event): void {
    const message: WebSocketMessage = {
      type: "event",
      data: event,
    }
    const json = JSON.stringify(message)

    for (const client of this.clients) {
      try {
        client.send(json)
      } catch (error) {
        // 客户端可能已断开，忽略错误
      }
    }
  }

  /**
   * 获取连接数
   */
  getClientCount(): number {
    return this.clients.size
  }
}
