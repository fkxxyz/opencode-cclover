/**
 * refresh_roles 工具
 *
 * 刷新 role 列表，重新加载所有 role 定义
 */

import { tool } from "@opencode-ai/plugin"
import type { ProjectInstance } from "../server/ProjectRegistry"

/**
 * 创建 refresh_roles 工具
 *
 * @param project 项目实例
 */
export function createRefreshRolesTool(project: ProjectInstance) {
  return tool({
    description:
      "Refresh role list, reload all role definitions from preset, global, and project directories",
    args: {},
    async execute() {
      // 1. 调用 RoleManager 的 refresh 方法
      await project.roleManager.refresh()

      // 2. 刷新所有正在运行的员工的系统提示词
      const refreshPromises: Promise<void>[] = []
      for (const [employeeName, eventLoop] of project.eventLoops.entries()) {
        refreshPromises.push(eventLoop.refreshSystemPrompt())
      }
      await Promise.all(refreshPromises)

      const roleNames = project.roleManager.getRoleNames()
      return `Roles refreshed successfully. Available roles: ${roleNames.join(", ")}. Updated system prompts for ${project.eventLoops.size} running employee(s).`
    },
  })
}
