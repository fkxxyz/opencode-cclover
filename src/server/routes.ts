import type { ServerDependencies } from "./types"
import * as employees from "../api/employees"
import * as messages from "../api/messages"
import * as tasks from "../api/tasks"
import * as hierarchy from "../api/hierarchy"
import * as events from "../api/events"
import * as stats from "../api/stats"
import * as health from "../api/health"
import * as projectsApi from "../api/projects"

/**
 * 路由处理器函数类型
 */
export type RouteHandler = (
  req: Request,
  params: Record<string, string>,
  deps?: ServerDependencies | any
) => Promise<any> | any

/**
 * ============================================================================
 * 静态路由定义（直接 Map 查找，O(1) 复杂度）
 * ============================================================================
 *
 * 键格式: "METHOD:PATH"
 * 值: 路由处理器函数
 */
export const staticRoutes = new Map<string, RouteHandler>([
  /**
   * 健康检查
   *
   * @endpoint GET /api/health
   * @description 检查服务是否正常运行
   *
   * @response {
   *   success: true,
   *   data: {
   *     status: "ok",
   *     timestamp: "2026-03-01T10:00:00.000Z",
   *     version: "1.0.0"
   *   }
   * }
   *
   * @example
   * GET /api/health
   * Response: { success: true, data: { status: "ok", ... } }
   */
  ["GET:/api/health", () => health.getHealth()],

  /**
   * 获取所有项目列表
   *
   * @endpoint GET /api/projects
   * @description 获取所有已注册的项目列表
   *
   * @response {
   *   success: true,
   *   data: {
   *     projects: [
   *       {
   *         projectId: "abc123",
   *         projectName: "my-project",
   *         directory: "/path/to/project"
   *       }
   *     ]
   *   }
   * }
   *
   * @example
   * GET /api/projects
   * Response: { success: true, data: { projects: [...] } }
   */
  [
    "GET:/api/projects",
    (req, params, deps) => {
      const projects = deps.projectRegistry.getAll().map((p: any) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        directory: p.directory,
      }))
      return {
        success: true,
        data: { projects },
      }
    },
  ],

  /**
   * 获取候选项目列表
   *
   * @endpoint GET /api/candidate-projects
   * @description 扫描文件系统，获取可以添加的候选项目列表
   *
   * @response {
   *   success: true,
   *   data: {
   *     candidates: [
   *       {
   *         name: "project-name",
   *         path: "/path/to/project",
   *         hasGit: true
   *       }
   *     ]
   *   }
   * }
   *
   * @example
   * GET /api/candidate-projects
   * Response: { success: true, data: { candidates: [...] } }
   */
  [
    "GET:/api/candidate-projects",
    async () => projectsApi.getCandidateProjects(),
  ],

  /**
   * 添加项目
   *
   * @endpoint POST /api/projects
   * @description 添加新项目到系统
   *
   * @requestBody {
   *   name: "project-name",
   *   path: "/path/to/project"
   * }
   *
   * @response {
   *   success: true,
   *   data: {
   *     projectId: "abc123",
   *     message: "项目添加成功"
   *   }
   * }
   *
   * @example
   * POST /api/projects
   * Body: { name: "my-project", path: "/path/to/project" }
   * Response: { success: true, data: { projectId: "abc123", message: "..." } }
   */
  [
    "POST:/api/projects",
    async (req) => {
      const body = (await req.json()) as { name: string; path: string }
      return projectsApi.addProject(body.name, body.path)
    },
  ],

  /**
   * 删除项目
   *
   * @endpoint POST /api/projects/delete
   * @description 从系统中删除项目
   *
   * @requestBody {
   *   path: "/path/to/project"
   * }
   *
   * @response {
   *   success: true,
   *   data: {
   *     message: "项目删除成功"
   *   }
   * }
   *
   * @example
   * POST /api/projects/delete
   * Body: { path: "/path/to/project" }
   * Response: { success: true, data: { message: "项目删除成功" } }
   */
  [
    "POST:/api/projects/delete",
    async (req) => {
      const body = (await req.json()) as { path: string }
      return projectsApi.deleteProject(body.path)
    },
  ],

  /**
   * 更新项目
   *
   * @endpoint POST /api/projects/update
   * @description 更新项目配置（名称、启用状态等）
   *
   * @requestBody {
   *   path: "/path/to/project",
   *   updates: {
   *     name: "new-name",
   *     enabled: true
   *   }
   * }
   *
   * @response {
   *   success: true,
   *   data: {
   *     message: "项目更新成功"
   *   }
   * }
   *
   * @example
   * POST /api/projects/update
   * Body: { path: "/path/to/project", updates: { name: "new-name" } }
   * Response: { success: true, data: { message: "项目更新成功" } }
   */
  [
    "POST:/api/projects/update",
    async (req) => {
      const body = (await req.json()) as {
        path: string
        updates: { name?: string; enabled?: boolean }
      }
      return projectsApi.updateProject(body.path, body.updates)
    },
  ],
])

/**
 * ============================================================================
 * 项目级动态路由定义（需要 projectId 参数）
 * ============================================================================
 *
 * 键格式: "METHOD:subpath"
 * 值: 路由处理器函数
 *
 * 这些路由的完整路径为: /api/projects/:projectId{subpath}
 */
export const projectRoutes = new Map<string, RouteHandler>([
  /**
   * 获取员工列表
   *
   * @endpoint GET /api/projects/:projectId/employees
   * @description 获取指定项目的所有员工基本信息
   *
   * @pathParams
   *   - projectId: 项目ID
   *
   * @response {
   *   success: true,
   *   data: {
   *     employees: [
   *       {
   *         name: "calculator",
   *         role: "Calculator",
   *         status: "idle",
   *         createdAt: "2026-03-01T10:00:00.000Z",
   *         lastActiveAt: "2026-03-01T10:05:00.000Z",
   *         hiredBy: null
   *       }
   *     ]
   *   }
   * }
   *
   * @example
   * GET /api/projects/abc123/employees
   * Response: { success: true, data: { employees: [...] } }
   */
  [
    "GET:/employees",
    (req, params, deps) => employees.getEmployees(deps.stateManager),
  ],

  /**
   * 获取员工雇佣关系树
   *
   * @endpoint GET /api/projects/:projectId/employees/hierarchy
   * @description 获取员工雇佣关系的树状结构
   *
   * @pathParams
   *   - projectId: 项目ID
   *
   * @response {
   *   success: true,
   *   data: {
   *     hierarchy: {
   *       name: "calculator",
   *       role: "Calculator",
   *       status: "idle",
   *       children: [
   *         {
   *           name: "coder",
   *           role: "Coder",
   *           status: "active",
   *           children: []
   *         }
   *       ]
   *     }
   *   }
   * }
   *
   * @example
   * GET /api/projects/abc123/employees/hierarchy
   * Response: { success: true, data: { hierarchy: {...} } }
   */
  [
    "GET:/employees/hierarchy",
    (req, params, deps) => hierarchy.getHierarchy(deps.stateManager),
  ],

  /**
   * 获取事件历史
   *
   * @endpoint GET /api/projects/:projectId/events
   * @description 获取项目的全局事件历史
   *
   * @pathParams
   *   - projectId: 项目ID
   *
   * @queryParams
   *   - limit: 返回事件数量，默认 50，最大 200（可选）
   *   - employeeName: 筛选特定员工的事件（可选）
   *
   * @response {
   *   success: true,
   *   data: {
   *     events: [
   *       {
   *         type: "message",
   *         timestamp: "2026-03-01T10:00:00.000Z",
   *         employeeName: "calculator",
   *         details: {
   *           from: "alice",
   *           to: "calculator",
   *           content: "计算 1+1"
   *         }
   *       }
   *     ]
   *   }
   * }
   *
   * @example
   * GET /api/projects/abc123/events?limit=10&employeeName=calculator
   * Response: { success: true, data: { events: [...] } }
   */
  [
    "GET:/events",
    (req, params, deps) => {
      const url = new URL(req.url)
      const limit = url.searchParams.get("limit")
        ? parseInt(url.searchParams.get("limit")!)
        : 50
      const employeeName = url.searchParams.get("employeeName") || undefined
      return events.getEvents({ limit, employeeName }, deps.stateManager)
    },
  ],

  /**
   * 获取统计数据
   *
   * @endpoint GET /api/projects/:projectId/stats
   * @description 获取项目的全局统计数据
   *
   * @pathParams
   *   - projectId: 项目ID
   *
   * @response {
   *   success: true,
   *   data: {
   *     totalEmployees: 5,
   *     activeEmployees: 2,
   *     pendingTasks: 8,
   *     todayMessages: 42
   *   }
   * }
   *
   * @example
   * GET /api/projects/abc123/stats
   * Response: { success: true, data: { totalEmployees: 5, ... } }
   */
  [
    "GET:/stats",
    async (req, params, deps) =>
      stats.getStats(deps.stateManager, deps.memoryManager),
  ],
])

/**
 * ============================================================================
 * 项目级参数路由定义（包含路径参数，如 :name）
 * ============================================================================
 *
 * 键格式: "METHOD:subpath_with_params"
 * 值: 路由处理器函数
 *
 * 这些路由需要进行路径匹配，性能略低于静态路由
 */
export const projectParamRoutes = new Map<string, RouteHandler>([
  /**
   * 获取员工详情
   *
   * @endpoint GET /api/projects/:projectId/employees/:name
   * @description 获取指定员工的完整信息，包括记忆、任务和 Agent 执行记录
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - name: 员工名称
   *
   * @response {
   *   success: true,
   *   data: {
   *     name: "calculator",
   *     role: "Calculator",
   *     status: "idle",
   *     createdAt: "2026-03-01T10:00:00.000Z",
   *     lastActiveAt: "2026-03-01T10:05:00.000Z",
   *     hiredBy: null,
   *     memory: {
   *       knowledge: ["alice 经常问我数学计算问题"],
   *       custom: { preferences: { language: "zh-CN" } }
   *     },
   *     tasks: [
   *       {
   *         name: "计算1+1",
   *         status: "completed",
   *         description: "为 alice 计算 1+1",
   *         result: "2",
   *         dependencies: [],
   *         created: "2026-03-01T10:00:00.000Z",
   *         completed: "2026-03-01T10:00:05.000Z"
   *       }
   *     ],
   *     agents: [
   *       {
   *         agentId: "agent_123",
   *         taskName: "计算1+1",
   *         status: "completed",
   *         createdAt: "2026-03-01T10:00:00.000Z",
   *         completedAt: "2026-03-01T10:00:05.000Z",
   *         result: "计算完成"
   *       }
   *     ]
   *   }
   * }
   *
   * @errors
   *   - EMPLOYEE_NOT_FOUND (404): 员工不存在
   *
   * @example
   * GET /api/projects/abc123/employees/calculator
   * Response: { success: true, data: { name: "calculator", ... } }
   */
  [
    "GET:/employees/:name",
    async (req, params, deps) => {
      const employeeName = params.name
      return employees.getEmployeeDetail(
        employeeName,
        deps.stateManager,
        deps.memoryManager,
        deps.agentRegistry,
        deps.workspaceRoot
      )
    },
  ],

  /**
   * 获取员工消息历史
   *
   * @endpoint GET /api/projects/:projectId/employees/:name/messages
   * @description 获取指定员工的消息历史
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - name: 员工名称
   *
   * @queryParams
   *   - peer: 对话对象名称，不传则返回所有对话（可选）
   *   - limit: 返回消息数量，默认 50，最大 200（可选）
   *
   * @response {
   *   success: true,
   *   data: {
   *     messages: [
   *       {
   *         timestamp: "2026-03-01T10:00:00.000Z",
   *         from: "alice",
   *         to: "calculator",
   *         content: "计算 1+1",
   *         direction: "receive"
   *       },
   *       {
   *         timestamp: "2026-03-01T10:00:05.000Z",
   *         from: "calculator",
   *         to: "alice",
   *         content: "结果是 2",
   *         direction: "send"
   *       }
   *     ]
   *   }
   * }
   *
   * @example
   * GET /api/projects/abc123/employees/calculator/messages?peer=alice&limit=10
   * Response: { success: true, data: { messages: [...] } }
   */
  [
    "GET:/employees/:name/messages",
    async (req, params, deps) => {
      const url = new URL(req.url)
      const employeeName = params.name
      const peer = url.searchParams.get("peer") || undefined
      const limit = url.searchParams.get("limit")
        ? parseInt(url.searchParams.get("limit")!)
        : 50
      return messages.getMessages(
        employeeName,
        peer,
        limit,
        deps.messageService
      )
    },
  ],

  /**
   * 获取员工任务列表
   *
   * @endpoint GET /api/projects/:projectId/employees/:name/tasks
   * @description 获取指定员工的所有任务，包括可执行任务列表
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - name: 员工名称
   *
   * @response {
   *   success: true,
   *   data: {
   *     tasks: [
   *       {
   *         name: "计算1+1",
   *         status: "completed",
   *         description: "为 alice 计算 1+1",
   *         result: "2",
   *         dependencies: [],
   *         created: "2026-03-01T10:00:00.000Z",
   *         completed: "2026-03-01T10:00:05.000Z"
   *       },
   *       {
   *         name: "计算2+2",
   *         status: "pending",
   *         description: "为 bob 计算 2+2",
   *         dependencies: ["计算1+1"],
   *         created: "2026-03-01T10:01:00.000Z"
   *       }
   *     ],
   *     executableTasks: ["计算2+2", "计算3+3"]
   *   }
   * }
   *
   * @example
   * GET /api/projects/abc123/employees/calculator/tasks
   * Response: { success: true, data: { tasks: [...], executableTasks: [...] } }
   */
  [
    "GET:/employees/:name/tasks",
    async (req, params, deps) => {
      const employeeName = params.name
      return tasks.getTasks(employeeName, deps.memoryManager)
    },
  ],
])
