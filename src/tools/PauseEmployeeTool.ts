/**
 * pause_employee tool
 *
 * Pause an employee (put on vacation)
 */

import { tool } from "@opencode-ai/plugin"
import type { StateManager } from "../state/StateManager"
import type { MemoryManager } from "../core/MemoryManager"
import type { BossManager } from "../core/BossManager"
import type { RoleManager } from "../core/RoleManager"
import { resolveToolActor } from "../meeting-mode"
import { vacationRegistry } from "../utils/VacationRegistry"

/**
 * Create pause_employee tool
 *
 * @param stateManager State manager instance
 * @param memoryManager Memory manager instance
 * @param bossManager Boss manager instance
 */
export function createPauseEmployeeTool(
  stateManager: StateManager,
  memoryManager: MemoryManager,
  bossManager: BossManager,
  roleManager?: RoleManager
) {
  return tool({
    description:
      "Pause an employee (put on vacation). Employee's EventLoop will stop. Can only be called by Boss or direct supervisor.",
    args: {
      employeeId: tool.schema.string().describe("ID of employee to pause"),
    },
    async execute(args, context) {
      // 1. 获取操作者名称
      const actor = resolveToolActor(
        context,
        stateManager,
        bossManager,
        roleManager
      )
      const operatorEmployeeId = actor?.actorEmployeeId
      const operatorName = actor?.actorName
      if (!operatorName) {
        throw new Error("Cannot identify operator")
      }

      // 2. 获取目标员工 (by employeeId)
      const employee = stateManager.getEmployee(args.employeeId)
      if (!employee) {
        throw new Error(`Employee '${args.employeeId}' not found`)
      }

      // 3. 检查权限
      const isBoss = actor?.hasBossAuthority || false
      // Check if operator is supervisor by employeeId
      let isSupervisor = false
      if (operatorEmployeeId) {
        isSupervisor = employee.hiredBy === operatorEmployeeId
      }
      if (!isBoss && !isSupervisor) {
        throw new Error(
          `Permission denied. Only Boss or direct supervisor can pause employees.`
        )
      }

      // 4. 检查是否已经离线
      if (employee.status === "offline") {
        return `Employee '${employee.name}' (${args.employeeId}) is already on vacation.`
      }

      // 5. 检查是否有待处理或进行中的任务
      const memory = await memoryManager.read(args.employeeId)
      const activeTasks = memory.tasks.filter(
        (t) => t.status === "pending" || t.status === "in_progress"
      )
      if (activeTasks.length > 0) {
        throw new Error(
          `Cannot pause employee with pending or in-progress tasks. ` +
            `Please complete or cancel all tasks first. ` +
            `Active tasks: ${activeTasks.map((t) => t.name).join(", ")}`
        )
      }

      // 6. 发送假期通知
      vacationRegistry.addVacationEvent(args.employeeId, {
        type: "vacation_requested",
        employeeId: args.employeeId,
        timestamp: new Date().toISOString(),
      })

      // 7. 暂停员工（更新配置并持久化）
      await stateManager.pauseEmployee(args.employeeId)

      return `Employee '${employee.name}' (${args.employeeId}) has been paused. EventLoop will stop shortly.`
    },
  })
}
