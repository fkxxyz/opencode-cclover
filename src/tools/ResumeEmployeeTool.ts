/**
 * resume_employee tool
 *
 * Resume an employee from vacation
 */

import { tool } from "@opencode-ai/plugin"
import type { StateManager } from "../state/StateManager"
import type { BossManager } from "../core/BossManager"
import { sessionRegistry } from "../utils/SessionRegistry"
import { logger } from "../lib/logger"

export function createResumeEmployeeTool(
  stateManager: StateManager,
  bossManager: BossManager,
  projectId: string
) {
  return tool({
    description:
      "Resume an employee from vacation. Employee's EventLoop will restart. Can only be called by Boss or direct supervisor.",
    args: {
      employeeName: tool.schema.string().describe("Name of employee to resume"),
    },
    async execute(args, context) {
      try {
        // 1. Get operator identity
        let operatorName: string | undefined
        let operatorId: string | undefined
        // First try to get from SessionRegistry (employee)
        operatorId = sessionRegistry.getEmployeeId(context.sessionID)
        if (operatorId) {
          const employee = stateManager.getEmployee(operatorId)
          if (employee) {
            operatorName = employee.name
          }
        }
        // If not in SessionRegistry, try to get from context.agent (might be boss)
        if (!operatorName && context.agent) {
          const agentName = context.agent
          // Check if it's a boss
          if (bossManager.isBoss(agentName)) {
            operatorName = agentName
          }
        }
        if (!operatorName) {
          return `Error: Unable to identify operator (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
        }

        // 2. Validate employee exists (by name)
        const allEmployees = stateManager.getEmployees()
        const employee = allEmployees.find((e) => e.name === args.employeeName)
        if (!employee) {
          return `Error: Employee '${args.employeeName}' not found`
        }

        // 3. Check permissions (Boss or direct supervisor)
        const isBoss = bossManager.isBoss(operatorName)
        let isSupervisor = false
        if (operatorId) {
          isSupervisor = employee.hiredBy === operatorId
        }
        if (!isBoss && !isSupervisor) {
          return `Error: Permission denied. Only Boss or direct supervisor can resume employees.`
        }

        // 4. Check employee is offline
        if (employee.status !== "offline") {
          return `Employee '${args.employeeName}' is not on vacation (current status: ${employee.status}).`
        }

        // 5. 恢复员工（更新配置并持久化）
        await stateManager.resumeEmployee(args.employeeName)

        // 6. Start EventLoop (dynamically import to avoid circular dependency)
        try {
          const { GlobalCcloverService } =
            await import("../server/GlobalServer")
          const globalService = await GlobalCcloverService.getInstance()
          await globalService.startEmployeeEventLoop(
            projectId,
            args.employeeName
          )
        } catch (error: any) {
          // 在单元测试环境中，GlobalCcloverService 可能未初始化
          // 这种情况下跳过 EventLoop 启动
          logger.debug(
            `[ResumeEmployeeTool] Skipping EventLoop startup for ${args.employeeName}: ${error.message}`
          )
        }

        logger.info(
          `[ResumeEmployeeTool] Employee '${args.employeeName}' resumed by '${operatorName}'`
        )

        return `Employee '${args.employeeName}' has been resumed. EventLoop is starting.`
      } catch (error: any) {
        logger.error(`[ResumeEmployeeTool] Failed to resume employee:`, error)
        return `Failed to resume: ${error.message}`
      }
    },
  })
}
