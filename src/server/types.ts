import type { Event } from "../types/index"

// WebSocket 消息类型
export interface WebSocketMessage {
  type: "event"
  data: Event
}

// 路由处理器类型
export type RouteHandler = (
  req: Request,
  params: Record<string, string>
) => Promise<Response>

// 路由定义
export interface Route {
  method: string
  path: string
  handler: RouteHandler
}

// 服务器配置
export interface ServerConfig {
  port: number
  workspaceRoot: string
}

// 服务器依赖
export interface ServerDependencies {
  projectId: string
  stateManager: any
  memoryManager: any
  messageService: any
  opcodeClient?: any
  agentRegistry: any
  bossManager: any
  roleManager: any
  workspaceRoot: string
}
