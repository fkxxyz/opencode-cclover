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
  private projectRegistry: any

  constructor(projectRegistry: any) {
    this.projectRegistry = projectRegistry
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

      // 获取所有 project 列表
      if (pathname === "/api/projects" && method === "GET") {
        const projects = this.projectRegistry.getAll().map((p: any) => ({
          projectId: p.projectId,
          projectName: p.projectName,
          directory: p.directory,
        }))
        return this.jsonResponse({ projects })
      }

      // 所有其他 API 都需要 projectId
      const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)\/(.+)$/)
      if (!projectMatch) {
        return this.jsonResponse(
          {
            success: false,
            error: {
              code: "INVALID_PATH",
              message: "API路径必须包含projectId: /api/projects/:projectId/...",
            },
          },
          400
        )
      }

      const projectId = projectMatch[1]
      const subpath = projectMatch[2]

      // 获取 project 实例
      const project = this.projectRegistry.get(projectId)
      if (!project) {
        return this.jsonResponse(
          {
            success: false,
            error: {
              code: "PROJECT_NOT_FOUND",
              message: `Project '${projectId}' not found`,
            },
          },
          404
        )
      }
      // 构建依赖对象(兼容现有API处理器)
      const deps: ServerDependencies = {
        stateManager: project.stateManager,
        memoryManager: project.memoryManager,
        messageService: project.messageService,
        agentRegistry: project.agentRegistry,
        workspaceRoot: project.workspaceRoot,
      }

      // 分发到具体 API 处理器
      if (subpath === "employees" && method === "GET") {
        return this.jsonResponse(employees.getEmployees(deps.stateManager))
      }

      if (subpath === "employees/hierarchy" && method === "GET") {
        return this.jsonResponse(hierarchy.getHierarchy(deps.stateManager))
      }

      if (subpath === "events" && method === "GET") {
        const limit = url.searchParams.get("limit")
          ? parseInt(url.searchParams.get("limit")!)
          : 50
        const employeeName = url.searchParams.get("employeeName") || undefined
        return this.jsonResponse(
          events.getEvents({ limit, employeeName }, deps.stateManager)
        )
      }

      if (subpath === "stats" && method === "GET") {
        return this.jsonResponse(
          await stats.getStats(deps.stateManager, deps.memoryManager)
        )
      }

      // 员工相关 API
      const employeeMatch = subpath.match(/^employees\/([^/]+)(?:\/(.+))?$/)
      if (employeeMatch && method === "GET") {
        const employeeName = employeeMatch[1]
        const employeeSubpath = employeeMatch[2]

        if (employeeSubpath === "messages") {
          const peer = url.searchParams.get("peer") || undefined
          const limit = url.searchParams.get("limit")
            ? parseInt(url.searchParams.get("limit")!)
            : 50
          return this.jsonResponse(
            await messages.getMessages(
              employeeName,
              peer,
              limit,
              deps.messageService
            )
          )
        }

        if (employeeSubpath === "tasks") {
          return this.jsonResponse(
            await tasks.getTasks(employeeName, deps.memoryManager)
          )
        }

        if (!employeeSubpath) {
          return this.jsonResponse(
            await employees.getEmployeeDetail(
              employeeName,
              deps.stateManager,
              deps.memoryManager,
              deps.agentRegistry,
              deps.workspaceRoot
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
