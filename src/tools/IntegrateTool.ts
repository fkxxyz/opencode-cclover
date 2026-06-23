/**
 * integrate tool
 *
 * Reset session context for all soulless employees in the current project
 */

import { tool } from "@opencode-ai/plugin"
import type { StateManager } from "../state/StateManager"
import type { RoleManager } from "../core/RoleManager"
import type { MemoryManager } from "../core/MemoryManager"
import type { EmployeeWorkSessionManager } from "../core/EmployeeWorkSessionManager"
import { sessionRegistry } from "../utils/SessionRegistry"

/**
 * Create integrate tool
 *
 * @param stateManager State manager instance
 * @param roleManager Role manager instance
 * @param memoryManager Memory manager instance
 */
export function createIntegrateTool(
  stateManager: StateManager,
  roleManager: RoleManager,
  memoryManager: MemoryManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager
) {
  return tool({
    description:
      "Reset session context for all soulless employees in the current project",
    args: {},
    async execute() {
      // 1. 获取所有员工
      const employees = stateManager.getEmployees()

      // 2. 筛选出 soulless 员工（role.soul === false）
      const soullessEmployees = employees.filter((employee) => {
        const role = roleManager.getRole(employee.roleId)
        return role && role.soul === false
      })

      // 3. 处理每个 soulless 员工
      const resetEmployees: string[] = []
      for (const employee of soullessEmployees) {
        const employeeWorkSessions =
          await employeeWorkSessionManager.listEmployeeWorkSessions({
            employeeId: employee.employeeId,
          })

        for (const employeeWorkSession of employeeWorkSessions) {
          if (employeeWorkSession.status === "closed") {
            continue
          }

          // 读取 EWS 记忆
          const memory = await memoryManager.read(
            employeeWorkSession.employeeWorkSessionId
          )

          // 如果有活跃的 OpenCode session，则重置
          if (!memory.opencodeSessionId) {
            continue
          }

          const opencodeSessionId = memory.opencodeSessionId

          // 清除 OpenCode session 和 sessionSnapshot
          memory.opencodeSessionId = undefined
          memory.sessionSnapshot = undefined

          // 保留 args 和 roleData（不修改）

          // 写回记忆
          await memoryManager.write(
            employeeWorkSession.employeeWorkSessionId,
            memory
          )

          // 从 sessionRegistry 注销
          sessionRegistry.unregister(opencodeSessionId)

          resetEmployees.push(employee.name)
        }
      }

      // 4. 返回总结消息
      if (resetEmployees.length === 0) {
        return "No soulless employees with active sessions found"
      }

      return `Reset ${resetEmployees.length} soulless employee${resetEmployees.length > 1 ? "s" : ""}: ${resetEmployees.join(", ")}`
    },
  })
}
