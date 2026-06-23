/**
 * API 客户端辅助工具
 *
 * 提供类型安全的 API 调用函数，用于集成测试
 */
import type { SuccessResponse, ErrorResponse } from "../../src/types/index"
import type {
  Employee,
  EmployeeHierarchy,
  Message,
  Task,
} from "../../src/types/index"

// ============================================================================
// API 响应数据类型定义
// ============================================================================

/**
 * 健康检查响应数据
 */
export interface HealthData {
  status: string
  timestamp: string
  version: string
}

/**
 * 员工列表响应数据
 */
export interface EmployeeListData {
  employees: Employee[]
}

/**
 * 员工详情响应数据
 */
export interface EmployeeDetailData {
  name: string
  roleId: string
  memory: any
  tasks: Task[]
}

/**
 * 消息列表响应数据
 */
export interface MessageListData {
  messages: Message[]
}

/**
 * 任务列表响应数据
 */
export interface TaskListData {
  tasks: Task[]
  executableTasks: string[]
}

/**
 * 雇佣关系树响应数据
 */
export interface HierarchyData {
  hierarchy: EmployeeHierarchy[]
}

/**
 * 事件列表响应数据
 */
export interface EventListData {
  events: any[]
}

/**
 * 统计数据响应
 */
export interface StatsData {
  totalEmployees: number
  activeEmployees: number
  pendingTasks: number
  todayMessages: number
}

/**
 * 员工急停响应数据
 */
export interface EmployeeWorkSessionHaltData {
  employeeWorkSessionId: string
  halted: true
}

/**
 * 角色列表响应数据
 */
export interface RoleListData {
  roles: Array<{
    name: string
    id: string
    description?: string
    systemPrompt: string
    source: string
    requiredArgs?: Record<string, any>
    canHire?: string[]
    groups?: string[]
  }>
}

/**
 * 角色详情响应数据
 */
export interface RoleDetailData {
  name: string
  id: string
  description?: string
  systemPrompt: string
  source: string
  requiredArgs?: Record<string, any>
  canHire?: string[]
  groups?: string[]
}

// ============================================================================
// API 响应类型（联合类型）
// ============================================================================

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

// ============================================================================
// 类型安全的 API 调用函数
// ============================================================================

/**
 * 发起 API 请求并返回类型化的响应
 *
 * @param url - 请求 URL
 * @param options - fetch 选项
 * @returns 包含 response 和类型化 json 的对象
 */
export async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<{ response: Response; json: ApiResponse<T> }> {
  const response = await fetch(url, options)
  const json = (await response.json()) as ApiResponse<T>
  return { response, json }
}
