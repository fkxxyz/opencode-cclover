import type { ServerDependencies } from "./types"
import * as employees from "../api/employees"
import * as messages from "../api/messages"
import * as tasks from "../api/tasks"
import * as hierarchy from "../api/hierarchy"
import * as events from "../api/events"
import * as stats from "../api/stats"
import * as health from "../api/health"

/**
 * 路由分发器
 * 根据 URL 和 HTTP 方法分发到对应的 API 处理器
 */
export class Router {
  private deps: ServerDependencies

  constructor(deps: ServerDependencies) {
    this.deps = deps
  }

  /**
   * 处理 HTTP 请求
   */
  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const pathname = url.pathname
    const method = req.method

    try {
      // 健康检查
      if (pathname === "/api/health" && method === "GET") {
        return this.jsonResponse(health.getHealth())
      }

      // 获取所有员工
      if (pathname === "/api/employees" && method === "GET") {
        return this.jsonResponse(employees.getEmployees(this.deps.stateManager))
      }

      // 获取员工雇佣关系树（必须在 /:name 之前）
      if (pathname === "/api/employees/hierarchy" && method === "GET") {
        return this.jsonResponse(hierarchy.getHierarchy(this.deps.stateManager))
      }

      // 获取全局事件
      if (pathname === "/api/events" && method === "GET") {
        const limit = url.searchParams.get("limit")
          ? parseInt(url.searchParams.get("limit")!)
          : 50
        const employeeName = url.searchParams.get("employeeName") || undefined
        return this.jsonResponse(
          events.getEvents({ limit, employeeName }, this.deps.stateManager)
        )
      }

      // 获取全局统计
      if (pathname === "/api/stats" && method === "GET") {
        return this.jsonResponse(
          await stats.getStats(this.deps.stateManager, this.deps.memoryManager)
        )
      }

      // 获取员工详情或消息或任务
      const employeeMatch = pathname.match(
        /^\/api\/employees\/([^/]+)(?:\/(.+))?$/
      )
      if (employeeMatch && method === "GET") {
        const employeeName = employeeMatch[1]
        const subpath = employeeMatch[2]

        if (subpath === "messages") {
          const peer = url.searchParams.get("peer") || undefined
          const limit = url.searchParams.get("limit")
            ? parseInt(url.searchParams.get("limit")!)
            : 50
          return this.jsonResponse(
            await messages.getMessages(
              employeeName,
              peer,
              limit,
              this.deps.messageService
            )
          )
        }

        if (subpath === "tasks") {
          return this.jsonResponse(
            await tasks.getTasks(employeeName, this.deps.memoryManager)
          )
        }

        // 获取员工详情
        if (!subpath) {
          return this.jsonResponse(
            await employees.getEmployeeDetail(
              employeeName,
              this.deps.stateManager,
              this.deps.memoryManager,
              this.deps.agentRegistry,
              this.deps.workspaceRoot
            )
          )
        }
      }

      // 404
      return this.jsonResponse(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `路由 ${method} ${pathname} 不存在`,
          },
        },
        404
      )
    } catch (error: any) {
      console.error("Router error:", error)
      return this.jsonResponse(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error.message || "内部服务器错误",
          },
        },
        500
      )
    }
  }

  /**
   * 返回 JSON 响应
   */
  private jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }
}
