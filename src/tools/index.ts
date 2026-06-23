/**
 * 工具系统基础框架
 *
 * 提供工具注册机制、类型定义和权限管理
 */
import type { ToolDefinition } from "@opencode-ai/plugin"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { BossManager } from "../core/BossManager"
import type { EmployeeWorkSessionManager } from "../core/EmployeeWorkSessionManager"
import type { MemoryManager } from "../core/MemoryManager"
import type { MessageService } from "../core/MessageService"
import type { ProjectInstance } from "../server/ProjectRegistry"
import { createEditTasksTool } from "./EditTasksTool"
import {
  createCloseEmployeeWorkSessionTool,
  createCreateEmployeeWorkSessionTool,
  createShowAvailableEmployeesTool,
  createShowEmployeeWorkSessionsTool,
  createUpdateEmployeeTool,
} from "./EmployeeTools"
import { createHireEmployeeTool } from "./HireEmployeeTool"
import { createIntegrateTool } from "./IntegrateTool"
import { createRefreshRolesTool } from "./RefreshRolesTool"
import { createSendMessageTool } from "./SendMessageTool"
import { createShowHireableRolesTool } from "./ShowHireableRolesTool"
import { createShowTasksTool } from "./ShowTasksTool"

export type CcloverTool = ToolDefinition

export interface ToolRegistry {
  [toolName: string]: CcloverTool
}

export interface ToolPermissions {
  [toolName: string]: boolean
}

export const DEFAULT_TOOL_PERMISSIONS: ToolPermissions = {
  send_message: true,
  edit_tasks: true,
  hire_employee: true,
  update_employee: true,
  show_available_employees: true,
  create_employee_work_session: true,
  show_employee_work_sessions: true,
  close_employee_work_session: true,
  refresh_roles: true,
  show_tasks: true,
  show_hireable_roles: true,
  integrate: true,
}

export function getToolPermissions(
  _employeeId: string,
  customPermissions?: ToolPermissions
): ToolPermissions {
  return customPermissions || DEFAULT_TOOL_PERMISSIONS
}

export { createSendMessageTool } from "./SendMessageTool"
export { createEditTasksTool } from "./EditTasksTool"
export { createHireEmployeeTool } from "./HireEmployeeTool"
export {
  createCloseEmployeeWorkSessionTool,
  createCreateEmployeeWorkSessionTool,
  createShowAvailableEmployeesTool,
  createShowEmployeeWorkSessionsTool,
  createUpdateEmployeeTool,
} from "./EmployeeTools"
export { createRefreshRolesTool } from "./RefreshRolesTool"
export { createShowTasksTool } from "./ShowTasksTool"
export { createShowHireableRolesTool } from "./ShowHireableRolesTool"
export { createIntegrateTool } from "./IntegrateTool"

export function createTools(deps: {
  messageService: MessageService
  memoryManager: MemoryManager
  opcodeClient: OpencodeClient
  bossManager?: BossManager
  stateManager?: any
  employeeWorkSessionManager?: EmployeeWorkSessionManager
  project?: ProjectInstance
}): ToolRegistry {
  const employeeWorkSessionManager =
    deps.employeeWorkSessionManager ?? deps.project?.employeeWorkSessionManager
  if (!deps.stateManager) {
    throw new Error("createTools requires stateManager")
  }
  if (!deps.project) {
    return {
      send_message: createSendMessageTool(
        deps.messageService,
        deps.bossManager,
        deps.stateManager
      ),
      edit_tasks: createEditTasksTool(deps.memoryManager, deps.stateManager),
      hire_employee: createHireEmployeeTool(
        deps.stateManager,
        null as any,
        null as any,
        deps.bossManager
      ),
      show_tasks: createShowTasksTool(deps.memoryManager, deps.stateManager),
    }
  }
  if (!employeeWorkSessionManager) {
    throw new Error("createTools requires employeeWorkSessionManager")
  }

  return {
    send_message: createSendMessageTool(
      deps.messageService,
      deps.bossManager,
      deps.stateManager,
      deps.project.roleManager
    ),
    edit_tasks: createEditTasksTool(deps.memoryManager, deps.stateManager),
    hire_employee: createHireEmployeeTool(
      deps.stateManager,
      deps.project.roleManager,
      deps.project,
      deps.bossManager
    ),
    update_employee: createUpdateEmployeeTool(
      deps.stateManager,
      deps.project.roleManager,
      employeeWorkSessionManager,
      deps.bossManager
    ),
    show_available_employees: createShowAvailableEmployeesTool(
      deps.stateManager,
      deps.project.roleManager,
      employeeWorkSessionManager,
      deps.bossManager
    ),
    create_employee_work_session: createCreateEmployeeWorkSessionTool(
      deps.project,
      deps.project.roleManager,
      deps.memoryManager,
      employeeWorkSessionManager,
      deps.opcodeClient
    ),
    show_employee_work_sessions: createShowEmployeeWorkSessionsTool(
      deps.stateManager,
      deps.project.roleManager,
      employeeWorkSessionManager,
      deps.bossManager
    ),
    close_employee_work_session: createCloseEmployeeWorkSessionTool(
      deps.project,
      deps.project.roleManager,
      employeeWorkSessionManager
    ),
    refresh_roles: createRefreshRolesTool(deps.project),
    show_tasks: createShowTasksTool(deps.memoryManager, deps.stateManager),
    show_hireable_roles: createShowHireableRolesTool(
      deps.project.roleManager,
      deps.stateManager,
      deps.bossManager
    ),
    integrate: createIntegrateTool(
      deps.stateManager,
      deps.project.roleManager,
      deps.memoryManager,
      employeeWorkSessionManager
    ),
  }
}
