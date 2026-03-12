import type { ServerDependencies } from "./types"
import * as employees from "../api/employees"
import * as messages from "../api/messages"
import * as tasks from "../api/tasks"
import * as hierarchy from "../api/hierarchy"
import * as events from "../api/events"
import * as stats from "../api/stats"
import * as health from "../api/health"
import * as projectsApi from "../api/projects"
import * as timeline from "../api/timeline"
import * as roles from "../api/roles"

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
   * 获取 boss 列表
   *
   * @endpoint GET /api/projects/:projectId/bosses
   * @description 获取指定项目的所有 boss 基本信息
   *
   * @pathParams
   *   - projectId: 项目ID
   *
   * @response {
   *   success: true,
   *   data: {
   *     bosses: [
   *       {
   *         name: "bayecao",
   *         role: "Boss",
   *         status: "busy",
   *         createdAt: "2026-03-01T10:00:00.000Z",
   *         lastActiveAt: "2026-03-01T10:05:00.000Z"
   *       }
   *     ]
   *   }
   * }
   *
   * @example
   * GET /api/projects/abc123/bosses
   * Response: { success: true, data: { bosses: [...] } }
   */
  ["GET:/bosses", (req, params, deps) => employees.getBosses(deps.bossManager)],

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
   *           status: "busy",
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
    (req, params, deps) =>
      hierarchy.getHierarchy(deps.stateManager, deps.bossManager),
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

  /**
   * 刷新 role 列表
   *
   * @endpoint POST /api/projects/:projectId/roles/refresh
   * @description 扫描三个位置（预设、全局、项目）并重新加载所有 role
   *
   * @pathParams
   *   - projectId: 项目ID
   *
   * @response {
   *   success: true,
   *   data: {
   *     message: "Roles refreshed successfully",
   *     count: 3,
   *     roles: [
   *       { name: "calculator", source: "preset" },
   *       { name: "coder", source: "global" },
   *       { name: "custom-role", source: "project" }
   *     ]
   *   }
   * }
   *
   * @example
   * POST /api/projects/abc123/roles/refresh
   * Response: { success: true, data: { message: "Roles refreshed successfully", count: 3, ... } }
   */
  [
    "POST:/roles/refresh",
    async (req, params, deps) => roles.refreshRoles(deps.roleManager),
  ],

  /**
   * 获取所有 role（包含元数据）
   *
   * @endpoint GET /api/projects/:projectId/roles
   * @description 获取所有可用的 role 列表，包含元数据
   *
   * @pathParams
   *   - projectId: 项目ID
   *
   * @response {
   *   success: true,
   *   data: {
   *     roles: [
   *       {
   *         name: "calculator",
   *         source: "preset",
   *         systemPrompt: "你是一个计算器员工...",
   *         description: "计算器角色",
   *         requiredArgs: {},
   *         canHire: [],
   *         groups: []
   *       }
   *     ]
   *   }
   * }
   *
   * @example
   * GET /api/projects/abc123/roles
   * Response: { success: true, data: { roles: [...] } }
   */
  ["GET:/roles", async (req, params, deps) => roles.getRoles(deps.roleManager)],
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
   *       args: { preferences: { language: "zh-CN" } }
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
   * 获取 boss 详情
   *
   * @endpoint GET /api/projects/:projectId/boss/:name
   * @description 获取指定 boss 的详细信息，包括记忆、任务、Agent 执行记录
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - name: Boss 名称
   *
   * @response {
   *   success: true,
   *   data: {
   *     name: "bayecao",
   *     role: "Boss",
   *     status: "busy",
   *     createdAt: "2024-01-01T00:00:00.000Z",
   *     lastActiveAt: "2024-01-01T12:00:00.000Z",
   *     memory: {
   *       knowledge: ["..."],
   *       tasks: [...],
   *       args: {}
   *     },
   *     tasks: [...],
   *     agents: [...]
   *   }
   * }
   *
   * @errors
   *   - BOSS_NOT_FOUND: Boss 不存在
   *   - FILE_READ_ERROR: 读取数据失败
   *
   * @example
   * GET /api/projects/abc123/boss/bayecao
   * Response: { success: true, data: { name: "bayecao", ... } }
   */
  [
    "GET:/boss/:name",
    async (req, params, deps) =>
      await employees.getBossDetail(
        params.name,
        deps.bossManager,
        deps.agentRegistry,
        deps.workspaceRoot
      ),
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
   * 获取员工的对话对象列表
   *
   * @endpoint GET /api/projects/:projectId/employees/:name/peers
   * @description 获取指定员工的所有对话对象（peers）列表
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - name: 员工名称
   *
   * @response {
   *   success: true,
   *   data: {
   *     peers: ["bayecao", "alice", "bob"]
   *   }
   * }
   *
   * @errors
   *   - INVALID_PARAMETER: 员工名称为空
   *   - FILE_READ_ERROR: 读取对话列表失败
   *   - INTERNAL_ERROR: 消息服务未初始化
   *
   * @example
   * GET /api/projects/abc123/employees/calculator/peers
   * Response: { success: true, data: { peers: ["bayecao", "alice"] } }
   */
  [
    "GET:/employees/:name/peers",
    async (req, params, deps) => {
      const employeeName = params.name
      return messages.getPeers(
        employeeName,
        deps.messageService,
        deps.stateManager,
        deps.bossManager
      )
    },
  ],

  /**
   * 发送消息
   *
   * @endpoint POST /api/projects/:projectId/employees/:name/messages
   * @description 发送消息给指定对象
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - name: 员工名称
   *
   * @requestBody {
   *   to: "接收者名称",
   *   content: "消息内容"
   * }
   *
   * @response {
   *   success: true,
   *   data: {
   *     message: "消息发送成功"
   *   }
   * }
   *
   * @errors
   *   - INVALID_PARAMETER: 参数为空
   *   - MESSAGE_SEND_ERROR: 发送失败
   *   - INTERNAL_ERROR: 消息服务未初始化
   *
   * @example
   * POST /api/projects/abc123/employees/calculator/messages
   * Body: { to: "alice", content: "Hello" }
   * Response: { success: true, data: { message: "消息发送成功" } }
   */
  [
    "POST:/employees/:name/messages",
    async (req, params, deps) => {
      const employeeName = params.name
      const body = (await req.json()) as { to: string; content: string }
      return messages.sendMessage(
        employeeName,
        body.to,
        body.content,
        deps.messageService,
        deps.stateManager,
        params.projectId
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
  /**
   * 获取员工的时间线（消息 + 事件混合）
   *
   * @endpoint GET /api/projects/:projectId/employees/:name/timeline
   * @description 获取指定员工的时间线，包括消息和事件按时间排序
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - name: 员工名称
   *
   * @queryParams
   *   - limit: 返回数量，默认 50，最大 200（可选）
   *   - before: 游标时间戳，返回此时间之前的消息（可选）
   *
   * @response {
   *   success: true,
   *   data: {
   *     timeline: [
   *       {
   *         type: "message",
   *         timestamp: "2026-03-03T10:00:00.000Z",
   *         data: {
   *           from: "alice",
   *           to: "calculator",
   *           content: "计算 1+1",
   *           direction: "receive"
   *         }
   *       },
   *       {
   *         type: "event",
   *         timestamp: "2026-03-03T10:00:05.000Z",
   *         data: {
   *           type: "task_completed",
   *           employeeName: "calculator",
   *           details: { taskName: "Task1", result: "2" }
   *         }
   *       }
   *     ]
   *   }
   * }
   *
   * @example
   * GET /api/projects/abc123/employees/calculator/timeline?limit=10
   * GET /api/projects/abc123/employees/calculator/timeline?limit=50&before=2026-03-03T10:00:00.000Z
   * Response: { success: true, data: { timeline: [...] } }
   */
  [
    "GET:/employees/:name/timeline",
    async (req, params, deps) => {
      const url = new URL(req.url)
      const employeeName = params.name
      const limit = url.searchParams.get("limit")
        ? parseInt(url.searchParams.get("limit")!)
        : 50
      const before = url.searchParams.get("before") || undefined
      return timeline.getTimeline(
        employeeName,
        deps.messageService,
        deps.stateManager,
        limit,
        before
      )
    },
  ],

  /**
   * 获取员工的角色元数据
   *
   * @endpoint GET /api/projects/:projectId/employees/:name/role
   * @description 获取指定员工的角色元数据
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - name: 员工名称
   *
   * @response {
   *   success: true,
   *   data: {
   *     role: {
   *       name: "calculator",
   *       source: "preset",
   *       systemPrompt: "你是一个计算器员工...",
   *       description: "计算器角色",
   *       requiredArgs: {},
   *       canHire: [],
   *       groups: []
   *     }
   *   }
   * }
   *
   * @errors
   *   - EMPLOYEE_NOT_FOUND: 员工不存在
   *   - ROLE_NOT_FOUND: 角色不存在
   *
   * @example
   * GET /api/projects/abc123/employees/calculator/role
   * Response: { success: true, data: { role: {...} } }
   */
  [
    "GET:/employees/:name/role",
    async (req, params, deps) =>
      roles.getEmployeeRole(params.name, deps.stateManager, deps.roleManager),
  ],

  /**
   * 获取指定 role（包含元数据）
   *
   * @endpoint GET /api/projects/:projectId/roles/:name
   * @description 获取指定名称的 role 详情，包含元数据
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - name: role 名称
   *
   * @response {
   *   success: true,
   *   data: {
   *     role: {
   *       name: "calculator",
   *       source: "preset",
   *       systemPrompt: "你是一个计算器员工...",
   *       description: "计算器角色",
   *       requiredArgs: {},
   *       canHire: [],
   *       groups: []
   *     }
   *   }
   * }
   *
   * @errors
   *   - ROLE_NOT_FOUND: role 不存在
   *
   * @example
   * GET /api/projects/abc123/roles/calculator
   * Response: { success: true, data: { role: {...} } }
   */
  [
    "GET:/roles/:name",
    async (req, params, deps) => roles.getRole(deps.roleManager, params.name),
  ],

  /**
   * 暂停员工（放假）
   *
   * @endpoint POST /api/projects/:projectId/employees/:employeeName/pause
   * @description 暂停员工的 EventLoop，员工将进入离线状态
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - employeeName: 员工名称
   *
   * @requestBody {} (empty)
   *
   * @response {
   *   success: true,
   *   data: {
   *     message: "Employee 'xxx' has been paused. EventLoop will stop shortly."
   *   }
   * }
   *
   * @errors
   *   - PROJECT_NOT_FOUND (404): 项目不存在
   *   - EMPLOYEE_NOT_FOUND (400): 员工不存在
   *   - PERMISSION_DENIED (400): 权限不足
   *   - ACTIVE_TASKS (400): 有待处理或进行中的任务
   *
   * @example
   * POST /api/projects/abc123/employees/calculator/pause
   * Response: { success: true, data: { message: "Employee 'calculator' has been paused..." } }
   */
  [
    "POST:/employees/:employeeName/pause",
    async (req, params, deps) => {
      try {
        const { employeeName } = params

        // 查找员工 ID
        const allEmployees = deps.stateManager.getEmployees()
        const employee = allEmployees.find((e: any) => e.name === employeeName)
        if (!employee) {
          return {
            success: false,
            error: {
              code: "EMPLOYEE_NOT_FOUND",
              message: `Employee '${employeeName}' not found`,
            },
          }
        }

        // 创建 pause_employee 工具（直接使用 deps 中的服务）
        const { createPauseEmployeeTool } = await import("../tools")
        const pauseTool = createPauseEmployeeTool(
          deps.stateManager,
          deps.memoryManager,
          deps.bossManager
        )

        // 获取第一个 Boss 作为操作者
        const bosses = deps.bossManager.getBosses()
        if (bosses.length === 0) {
          return {
            success: false,
            error: {
              code: "NO_BOSS_FOUND",
              message: "No boss found in project",
            },
          }
        }
        const operatorName = bosses[0]

        // 注册临时 sessionID
        const { sessionRegistry } = await import("../utils/SessionRegistry")
        const tempSessionID = `http-pause-${Date.now()}`
        sessionRegistry.register(tempSessionID, operatorName)

        // 执行工具
        const result = await pauseTool.execute(
          { employeeId: employee.employeeId },
          {
            sessionID: tempSessionID,
          } as any
        )

        // 清理临时 sessionID
        sessionRegistry.unregister(tempSessionID)

        return {
          success: true,
          data: { message: result },
        }
      } catch (error: any) {
        return {
          success: false,
          error: {
            code: "PAUSE_FAILED",
            message: error.message,
          },
        }
      }
    },
  ],

  /**
   * 恢复员工（结束假期）
   *
   * @endpoint POST /api/projects/:projectId/employees/:employeeName/resume
   * @description 恢复员工的 EventLoop，员工将从离线状态恢复
   *
   * @pathParams
   *   - projectId: 项目ID
   *   - employeeName: 员工名称
   *
   * @requestBody {} (empty)
   *
   * @response {
   *   success: true,
   *   data: {
   *     message: "Employee 'xxx' has been resumed. EventLoop is starting."
   *   }
   * }
   *
   * @errors
   *   - PROJECT_NOT_FOUND (404): 项目不存在
   *   - EMPLOYEE_NOT_FOUND (400): 员工不存在
   *   - PERMISSION_DENIED (400): 权限不足
   *   - NOT_ON_VACATION (400): 员工不在离线状态
   *
   * @example
   * POST /api/projects/abc123/employees/calculator/resume
   * Response: { success: true, data: { message: "Employee 'calculator' has been resumed..." } }
   */
  [
    "POST:/employees/:employeeName/resume",
    async (req, params, deps) => {
      try {
        const { employeeName } = params

        // 查找员工 ID
        const allEmployees = deps.stateManager.getEmployees()
        const employee = allEmployees.find((e: any) => e.name === employeeName)
        if (!employee) {
          return {
            success: false,
            error: {
              code: "EMPLOYEE_NOT_FOUND",
              message: `Employee '${employeeName}' not found`,
            },
          }
        }

        // 创建 resume_employee 工具（直接使用 deps 中的服务）
        const { createResumeEmployeeTool } = await import("../tools")
        const resumeTool = createResumeEmployeeTool(
          deps.stateManager,
          deps.bossManager,
          deps.projectId
        )

        // 获取第一个 Boss 作为操作者
        const bosses = deps.bossManager.getBosses()
        if (bosses.length === 0) {
          return {
            success: false,
            error: {
              code: "NO_BOSS_FOUND",
              message: "No boss found in project",
            },
          }
        }
        const operatorName = bosses[0]

        // 注册临时 sessionID
        const { sessionRegistry } = await import("../utils/SessionRegistry")
        const tempSessionID = `http-resume-${Date.now()}`
        sessionRegistry.register(tempSessionID, operatorName)

        // 执行工具
        const result = await resumeTool.execute(
          { employeeId: employee.employeeId },
          {
            sessionID: tempSessionID,
          } as any
        )

        // 清理临时 sessionID
        sessionRegistry.unregister(tempSessionID)

        return {
          success: true,
          data: { message: result },
        }
      } catch (error: any) {
        return {
          success: false,
          error: {
            code: "RESUME_FAILED",
            message: error.message,
          },
        }
      }
    },
  ],
])
