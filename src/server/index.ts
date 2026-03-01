import type { ServerDependencies, ServerConfig } from "./types"
import { Router } from "./router"
import { WebSocketManager } from "./websocket"
import type { Event } from "../types/index"

const DEFAULT_PORT = 4097

/**
 * HTTP/WebSocket 服务器
 * 使用 Bun.serve 提供 API 和实时事件推送
 */
export class ConsoleServer {
  private port: number
  private router: Router
  private wsManager: WebSocketManager
  private deps: ServerDependencies
  private server: any = null

  constructor(config: ServerConfig, deps: ServerDependencies) {
    this.port = config.port || DEFAULT_PORT
    this.deps = deps
    this.router = new Router(deps)
    this.wsManager = new WebSocketManager()
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    this.server = Bun.serve({
      port: this.port,
      fetch: (req: Request, server: any) => this.handleFetch(req, server),
      websocket: {
        open: (ws: any) => this.wsManager.open(ws),
        message: (ws: any, message: any) => this.wsManager.message(ws, message),
        close: (ws: any) => this.wsManager.close(ws),
      },
    })

    console.log(`Console server started on port ${this.port}`)

    // 监听 StateManager 事件并广播
    this.setupEventBroadcasting()
  }

  /**
   * 处理 HTTP 请求和 WebSocket 升级
   */
  private async handleFetch(req: Request, server: any): Promise<Response> {
    const url = new URL(req.url)

    // WebSocket 升级
    if (url.pathname === "/ws") {
      const success = server.upgrade(req)
      if (success) {
        return undefined as any
      }
      return new Response("WebSocket upgrade failed", { status: 500 })
    }

    // OPTIONS 请求处理（CORS 预检）
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      })
    }

    // HTTP 请求处理
    return this.router.handle(req)
  }

  /**
   * 设置事件广播
   * 监听 StateManager 的事件并通过 WebSocket 广播
   */
  private setupEventBroadcasting(): void {
    // 如果 StateManager 有事件发射器，监听事件
    if (
      this.deps.stateManager &&
      typeof this.deps.stateManager.on === "function"
    ) {
      this.deps.stateManager.on("event", (event: Event) => {
        this.wsManager.broadcast(event)
      })
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop()
      this.server = null
    }
  }

  /**
   * 获取 WebSocket 连接数
   */
  getClientCount(): number {
    return this.wsManager.getClientCount()
  }

  /**
   * 广播事件（用于测试或手动广播）
   */
  broadcastEvent(event: Event): void {
    this.wsManager.broadcast(event)
  }
}

/**
 * 创建并启动服务器
 */
export async function createAndStartServer(
  config: ServerConfig,
  deps: ServerDependencies
): Promise<ConsoleServer> {
  const server = new ConsoleServer(config, deps)
  await server.start()
  return server
}
