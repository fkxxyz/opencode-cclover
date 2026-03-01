/**
 * 工具系统基础框架
 * 
 * 提供工具注册机制、类型定义和权限管理
 */

import type { ToolDefinition } from "@opencode-ai/plugin"

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
 * 第一版所有员工都可以使用所有工具（除了 hire_employee）
 */
export const DEFAULT_TOOL_PERMISSIONS: ToolPermissions = {
  send_message: true,
  edit_tasks: true,
  create_agent: true,
  hire_employee: false, // 第一版不开放
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
export { sendMessageTool } from "./SendMessageTool"
export { editTasksTool } from "./EditTasksTool"
export { createAgentTool } from "./CreateAgentTool"
export { hireEmployeeTool } from "./HireEmployeeTool"
