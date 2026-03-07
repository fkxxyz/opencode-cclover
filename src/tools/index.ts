/**
 * 工具系统基础框架
 *
 * 提供工具注册机制、类型定义和权限管理
 */
import type { ToolDefinition } from "@opencode-ai/plugin"
import type { MessageService } from "../core/MessageService"
import type { MemoryManager } from "../core/MemoryManager"
import type { BossManager } from "../core/BossManager"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { ProjectInstance } from "../server/ProjectRegistry"
import { createSendMessageTool } from "./SendMessageTool"
import { createEditTasksTool } from "./EditTasksTool"
import { createCreateAgentTool } from "./CreateAgentTool"
import { createHireEmployeeTool } from "./HireEmployeeTool"
import { createRefreshRolesTool } from "./RefreshRolesTool"
import { createShowTasksTool } from "./ShowTasksTool"
import { createShowHireableRolesTool } from "./ShowHireableRolesTool"
import { createResumeEmployeeTool } from "./ResumeEmployeeTool"

/**
 * 工具定义类型
 */
export type CcloverTool = ToolDefinition

/**
 * 工具注册表类型
 */
export interface ToolRegistry {
  [toolName: string]: CcloverTool
}

/**
 * 工具权限配置
 *
 * 用于控制不同员工可以使用哪些工具
 */
export interface ToolPermissions {
  [toolName: string]: boolean
}

/**
 * 默认工具权限
 *
 * 所有员工都可以使用所有工具
 */
export const DEFAULT_TOOL_PERMISSIONS: ToolPermissions = {
  send_message: true,
  edit_tasks: true,
  create_agent: true,
  hire_employee: true, // 启用雇佣功能
  refresh_roles: true,
  show_tasks: true,
  show_hireable_roles: true,
  resume_employee: true,
}

/**
 * 获取员工可用的工具列表
 *
 * @param employeeName 员工名称
 * @param customPermissions 自定义权限（可选）
 * @returns 工具权限配置
 */
export function getToolPermissions(
  employeeName: string,
  customPermissions?: ToolPermissions
): ToolPermissions {
  // 第一版使用默认权限
  // 未来可以根据员工角色或名称返回不同权限
  return customPermissions || DEFAULT_TOOL_PERMISSIONS
}

/**
 * 工具导出
 *
 * 从各个工具文件导入并统一导出
 */
export { createSendMessageTool } from "./SendMessageTool"
export { createEditTasksTool } from "./EditTasksTool"
export { createCreateAgentTool } from "./CreateAgentTool"
export { createHireEmployeeTool } from "./HireEmployeeTool"
export { createRefreshRolesTool } from "./RefreshRolesTool"
export { createShowTasksTool } from "./ShowTasksTool"
export { createShowHireableRolesTool } from "./ShowHireableRolesTool"
export { createResumeEmployeeTool } from "./ResumeEmployeeTool"

/**
 * 创建所有工具
 *
 * @param deps 依赖项
 * @returns 工具注册表
 */
export function createTools(deps: {
  messageService: MessageService
  memoryManager: MemoryManager
  opcodeClient: OpencodeClient
  bossManager?: BossManager
  stateManager?: any
  project?: ProjectInstance
}): ToolRegistry {
  return {
    send_message: createSendMessageTool(
      deps.messageService,
      deps.bossManager,
      deps.stateManager
    ),
    edit_tasks: createEditTasksTool(deps.memoryManager),
    create_agent: createCreateAgentTool(deps.opcodeClient, deps.stateManager),
    hire_employee: deps.project
      ? createHireEmployeeTool(
          deps.stateManager,
          deps.project.roleManager,
          deps.project,
          deps.bossManager
        )
      : createHireEmployeeTool(deps.stateManager, null as any, null as any), // fallback
    refresh_roles: deps.project
      ? createRefreshRolesTool(deps.project)
      : (null as any), // fallback
    show_tasks: createShowTasksTool(deps.memoryManager),
    show_hireable_roles: deps.project
      ? createShowHireableRolesTool(
          deps.project.roleManager,
          deps.stateManager,
          deps.bossManager
        )
      : (null as any), // fallback
    resume_employee: deps.project
      ? createResumeEmployeeTool(
          deps.stateManager,
          deps.bossManager!,
          deps.project
        )
      : (null as any), // fallback
  }
}
