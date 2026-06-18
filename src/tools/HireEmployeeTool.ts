/**
 * hire_employee tool
 *
 * Hire new employee
 */

import { tool } from "@opencode-ai/plugin"
import type { StateManager } from "../state/StateManager"
import type { RoleManager } from "../core/RoleManager"
import type { ProjectInstance } from "../server/ProjectRegistry"
import type { BossManager } from "../core/BossManager"
import { resolveToolActor } from "../meeting-mode"
import { logger } from "../lib/logger"
import type { EmployeeId } from "../types/employee"
import { createEmployeeId } from "../types/employee"

export function createHireEmployeeTool(
  stateManager: StateManager,
  roleManager: RoleManager,
  project: ProjectInstance,
  bossManager?: BossManager
) {
  return tool({
    description: "Hire new employee",
    args: {
      name: tool.schema.string().describe("Employee name"),
      role: tool.schema.string().describe("Role type"),
      initial_message: tool.schema
        .string()
        .optional()
        .describe(
          "Optional: First message to send to the new employee immediately after hiring"
        ),
      initial_args: tool.schema
        .array(
          tool.schema.object({
            name: tool.schema.string().describe("Parameter name"),
            value: tool.schema.string().describe("Parameter value"),
          })
        )
        .optional()
        .describe(
          "Optional: Initial arguments for roles with requiredArgs. Array of {name, value} objects."
        ),
    },
    async execute(args, context) {
      try {
        const actor = resolveToolActor(
          context,
          stateManager,
          bossManager,
          roleManager
        )
        const hiredBy = actor?.actorName
        const hiredByEmployeeId = actor?.actorEmployeeId as
          | EmployeeId
          | undefined

        if (!hiredBy || !hiredByEmployeeId) {
          return `Error: Unable to identify caller (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
        }

        // 2. Verify role exists
        const roleDefinition = roleManager.getRole(args.role)
        if (!roleDefinition) {
          return `Error: Role '${args.role}' does not exist. Use show_hireable_roles tool to see available roles.`
        }

        // 3. Check hiring permission
        if (
          !checkHiringPermission(
            hiredBy,
            hiredByEmployeeId,
            actor?.hasBossAuthority || false,
            args.role,
            stateManager,
            roleManager,
            bossManager
          )
        ) {
          return `Error: You do not have permission to hire role '${args.role}'. Use show_hireable_roles tool to see roles you can hire.`
        }

        // 4. Validate requiredArgs if role has them
        if (roleDefinition.requiredArgs) {
          const requiredArgNames = Object.keys(roleDefinition.requiredArgs)
          const providedArgNames = new Set(
            (args.initial_args || []).map((arg) => arg.name)
          )

          const missingArgs = requiredArgNames.filter(
            (name) => !providedArgNames.has(name)
          )

          if (missingArgs.length > 0) {
            return `Error: Role '${args.role}' requires the following parameters: ${missingArgs.join(", ")}. Provide them via initial_args parameter.`
          }
        }

        // 5. Validate name parameter
        if (args.name === undefined || typeof args.name !== "string") {
          return "Error: Employee name is required"
        }

        const trimmedName = args.name.trim()
        if (trimmedName === "") {
          return "Error: Employee name cannot be empty or whitespace"
        }

        // 6. 生成与任务无关的稳定 employeeId
        const newEmployeeId = createEmployeeId()

        if (!(actor?.hasBossAuthority || bossManager?.isBoss(hiredBy))) {
          const parentEmployee = stateManager.getEmployee(hiredByEmployeeId!)
          if (!parentEmployee) {
            return `Error: Parent employee not found`
          }
        }

        // 7. Check if employee already exists
        const existing = stateManager.getEmployee(newEmployeeId)
        if (existing) {
          return `Error: Employee '${newEmployeeId}' already exists`
        }

        // 8. Register employee (automatically persisted)
        await stateManager.registerEmployee({
          employeeId: newEmployeeId,
          name: trimmedName,
          roleId: args.role,
          status: "offline",
          paused: false,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          hiredBy: hiredByEmployeeId!,
          activeSessionId: null,
        })

        // 9. Persist initial_args to memory if provided
        if (args.initial_args && args.initial_args.length > 0) {
          const argsRecord: Record<string, string> = {}
          for (const arg of args.initial_args) {
            argsRecord[arg.name] = arg.value
          }
          await project.memoryManager.updateArgs(newEmployeeId, argsRecord)
        }

        // 10. Record employee_hired event
        const hiredEvent = {
          projectId: stateManager.getProjectId(),
          type: "employee_hired" as const,
          timestamp: new Date().toISOString(),
          employeeId: newEmployeeId,
          employeeName: trimmedName,
          details: {
            hiredBy: hiredByEmployeeId!,
            role: args.role,
            initialMessage: args.initial_message,
          },
        }
        await stateManager.addEvent(hiredEvent)

        // 11. Start employee's EventLoop
        await startEmployee(project, newEmployeeId, roleDefinition)

        // 12. Record or clear session mapping if hirer is Boss
        // Only record if session is from a meeting-mode role, otherwise clear
        const hirerBossId = hiredByEmployeeId!.startsWith("0-")
          ? hiredByEmployeeId!.substring(2)
          : null
        const isHirerBoss =
          hirerBossId !== null && bossManager?.isBoss(hirerBossId)

        if (isHirerBoss && bossManager) {
          // Check if agent is a valid meeting-mode role
          const isValidRole =
            context.sessionID &&
            context.agent &&
            roleManager?.getRole(context.agent)

          if (isValidRole) {
            await bossManager.recordSession(
              hirerBossId!,
              newEmployeeId,
              context.sessionID!
            )
            logger.debug(
              `[HireEmployeeTool] Recorded session mapping for Boss ${hirerBossId} → ${newEmployeeId}`
            )
          } else {
            await bossManager.clearSession(hirerBossId!, newEmployeeId)
            logger.debug(
              `[HireEmployeeTool] Cleared session mapping for Boss ${hirerBossId} → ${newEmployeeId}`
            )
          }
        }

        logger.info(
          `[HireEmployeeTool] Employee '${trimmedName}' hired by '${hiredBy}' with role '${args.role}'`
        )

        // 13. Build success message
        let successMessage = `Successfully hired employee '${newEmployeeId}' (name: ${trimmedName}), role: ${args.role}`

        // 14. Send message to new employee
        if (args.initial_message) {
          // 如果提供了 initial_message，发送自定义消息
          await project.messageService.send(
            hiredByEmployeeId!,
            newEmployeeId,
            args.initial_message
          )
          logger.info(
            `[HireEmployeeTool] Initial message sent to '${trimmedName}' from '${hiredBy}'`
          )
          successMessage += `\n\nInitial message sent.`
        } else {
          // 如果没有提供 initial_message，发送默认消息
          const defaultMessage = `Hello! I am ${hiredBy}, and I just hired you. Your role is ${args.role}.\n\nPlease start working according to your role definition.`

          await project.messageService.send(
            hiredByEmployeeId!,
            newEmployeeId,
            defaultMessage
          )
          logger.info(
            `[HireEmployeeTool] Default message sent to '${trimmedName}' from '${hiredBy}'`
          )
          successMessage += `\n\nDefault message sent.`
        }

        return successMessage
      } catch (error: any) {
        logger.error(`[HireEmployeeTool] Failed to hire employee:`, error)
        return `Failed to hire: ${error.message}`
      }
    },
  })
}

/**
 * 检查雇佣权限
 * @param hiredBy 雇佣者名称
 * @param targetRole 目标角色名称
 * @param stateManager 状态管理器
 * @param roleManager 角色管理器
 * @param bossManager Boss 管理器
 * @returns 是否有权限雇佣
 */
function checkHiringPermission(
  hiredByName: string,
  hiredByEmployeeId: EmployeeId | undefined,
  hasBossAuthority: boolean,
  targetRole: string,
  stateManager: StateManager,
  roleManager: RoleManager,
  bossManager?: BossManager
): boolean {
  // Boss 可以雇佣任何角色
  if (hasBossAuthority || bossManager?.isBoss(hiredByName)) {
    return true
  }

  // 获取雇佣者的角色
  if (!hiredByEmployeeId) {
    return false
  }
  const employee = stateManager.getEmployee(hiredByEmployeeId)
  if (!employee) {
    return false
  }

  // 检查雇佣者的角色是否允许雇佣目标角色
  return roleManager.canHire(employee.roleId, targetRole)
}

/**
 * Start employee's EventLoop
 */
async function startEmployee(
  project: ProjectInstance,
  employeeId: EmployeeId,
  role: { name: string; systemPrompt: string }
): Promise<void> {
  try {
    // Dynamically import EventLoop (avoid circular dependency)
    const { EventLoop } = await import("../core/eventloop")
    const { GlobalCcloverService } = await import("../server/GlobalServer")
    const employee = project.stateManager.getEmployee(employeeId)
    const eventLoopKey = employee?.employeeId ?? employeeId

    const messageClient = project.messageService.getClient(employeeId)
    const globalService = await GlobalCcloverService.getInstance()
    const opcodeClient = globalService.getOpencodeClient()

    const eventLoop = new EventLoop(
      project.directory,
      employeeId,
      role.name,
      project.roleManager,
      messageClient,
      project.memoryManager,
      opcodeClient,
      project.modelConfigManager,
      project.stateManager
    )

    project.eventLoops.set(eventLoopKey, eventLoop)

    // Run in background
    eventLoop.run().catch((error: any) => {
      logger.error(`[${employeeId}] EventLoop crashed:`, error)
    })

    logger.debug(
      `[startEmployee] EventLoop started for employee: ${employeeId}`
    )
  } catch (error: any) {
    // 在单元测试环境中，GlobalCcloverService 可能未初始化
    // 这种情况下跳过 EventLoop 启动
    logger.debug(
      `[startEmployee] Skipping EventLoop startup for ${employeeId}: ${error.message}`
    )
  }
}
