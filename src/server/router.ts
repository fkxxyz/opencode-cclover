import type { ServerDependencies } from "./types"
import { staticRoutes, projectRoutes, projectParamRoutes } from "./routes"

/**
 * 路由分发器
 * 使用 Map 查找路由，性能优化版本
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
      // 1. 先查静态路由（O(1) 查找）
      const staticKey = `${method}:${pathname}`
      const staticHandler = staticRoutes.get(staticKey)
      if (staticHandler) {
        const result = await staticHandler(
          req,
          {},
          {
            projectRegistry: this.projectRegistry,
          }
        )
        return this.jsonResponse(result)
      }

      // 2. 再查项目级路由
      const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)\/(.+)$/)
      if (projectMatch) {
        const [, projectId, subpath] = projectMatch

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

        // 构建依赖对象
        const deps: ServerDependencies = {
          stateManager: project.stateManager,
          memoryManager: project.memoryManager,
          messageService: project.messageService,
          agentRegistry: project.agentRegistry,
          bossManager: project.bossManager,
          workspaceRoot: project.workspaceRoot,
        }

        // 2.1 查找精确匹配的项目路由
        const projectKey = `${method}:/${subpath}`
        const projectHandler = projectRoutes.get(projectKey)
        if (projectHandler) {
          const result = await projectHandler(req, {}, deps)
          return this.jsonResponse(result)
        }

        // 2.2 查找带参数的项目路由
        const paramRoute = this.matchParamRoute(method, `/${subpath}`)
        if (paramRoute) {
          const result = await paramRoute.handler(req, paramRoute.params, deps)
          return this.jsonResponse(result)
        }
      }

      // 3. 路径不匹配，返回 400 或 404
      if (!pathname.startsWith("/api/projects/")) {
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

      // 4. 404
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
   * 匹配参数路由（只在 Map 查找失败后调用）
   */
  private matchParamRoute(
    method: string,
    path: string
  ): { handler: any; params: Record<string, string> } | null {
    for (const [pattern, handler] of projectParamRoutes) {
      if (!pattern.startsWith(`${method}:`)) continue

      const pathPattern = pattern.substring(method.length + 1)
      const params = this.matchPath(pathPattern, path)
      if (params) {
        return { handler, params }
      }
    }
    return null
  }

  /**
   * 路径参数匹配
   * 例如: matchPath("/employees/:name", "/employees/calculator")
   * 返回: { name: "calculator" }
   */
  private matchPath(
    pattern: string,
    path: string
  ): Record<string, string> | null {
    const patternParts = pattern.split("/")
    const pathParts = path.split("/")

    if (patternParts.length !== pathParts.length) return null

    const params: Record<string, string> = {}
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        // 参数部分
        params[patternParts[i].substring(1)] = pathParts[i]
      } else if (patternParts[i] !== pathParts[i]) {
        // 静态部分不匹配
        return null
      }
    }
    return params
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
