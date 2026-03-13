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
import { sessionRegistry } from "../utils/SessionRegistry"
import { logger } from "../lib/logger"
import type { EmployeeId } from "../types/employee"
import { formatBossId } from "../types/employee"

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
    },
    async execute(args, context) {
      try {
        // 1. Get caller identity
        let hiredBy: string | undefined
        let hiredByEmployeeId: EmployeeId | undefined
        // 2. First try to get from SessionRegistry (employee)
        const employeeId = sessionRegistry.getEmployeeId(context.sessionID)
        if (employeeId) {
          const employee = stateManager.getEmployee(employeeId)
          if (employee) {
            hiredBy = employee.name
            hiredByEmployeeId = employee.employeeId
          }
        }
        // 3. If not in SessionRegistry, try to get from context.agent (might be boss)
        if (!hiredBy && context.agent) {
          const agentName = context.agent
          // Check if it's a boss
          if (bossManager?.isBoss(agentName)) {
            hiredBy = agentName
            hiredByEmployeeId = formatBossId(agentName)
          }
        }
        if (!hiredBy) {
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
            args.role,
            stateManager,
            roleManager,
            bossManager
          )
        ) {
          return `Error: You do not have permission to hire role '${args.role}'. Use show_hireable_roles tool to see roles you can hire.`
        }

        // 4. Determine taskId and employeeId based on hiring logic
        let taskId: number
        let newEmployeeId: EmployeeId

        // Check if role is soul (defaults to true if not specified)
        const isSoulRole = roleDefinition.soul !== false

        if (bossManager?.isBoss(hiredBy)) {
          // Boss hiring logic
          if (isSoulRole) {
            // Soul employee hired by boss gets taskId=0
            taskId = 0
            newEmployeeId = formatBossId(args.name)
          } else {
            // Non-soul employee hired by boss gets generated taskId
            taskId = await generateNextTaskId(stateManager)
            newEmployeeId = `${taskId}-${args.name}` as EmployeeId
          }
        } else {
          // Non-boss hiring logic
          const parentEmployee = stateManager.getEmployee(hiredByEmployeeId!)
          if (!parentEmployee) {
            return `Error: Parent employee not found`
          }

          if (isSoulRole) {
            // Soul employee can only be hired by boss (taskId=0)
            if (parentEmployee.taskId > 0) {
              return `Error: Only boss (taskId=0) can hire soul employees. Your taskId is ${parentEmployee.taskId}.`
            }
            taskId = 0
            newEmployeeId = formatBossId(args.name)
          } else {
            // Non-soul employee inherits parent's taskId
            taskId = parentEmployee.taskId
            newEmployeeId = `${taskId}-${args.name}` as EmployeeId
          }
        }

        // 5. Check if employee already exists
        const existing = stateManager.getEmployee(newEmployeeId)
        if (existing) {
          return `Error: Employee '${newEmployeeId}' already exists`
        }

        // 6. Register employee (automatically persisted)
        await stateManager.registerEmployee({
          employeeId: newEmployeeId,
          name: args.name,
          taskId,
          role: args.role,
          status: "offline",
          paused: false,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          hiredBy: hiredByEmployeeId!,
          activeSessionId: null,
        })

        // 6. Record employee_hired event
        const hiredEvent = {
          projectId: stateManager.getProjectId(),
          type: "employee_hired" as const,
          timestamp: new Date().toISOString(),
          employeeId: newEmployeeId,
          employeeName: args.name,
          details: {
            hiredBy: hiredByEmployeeId!,
            role: args.role,
            initialMessage: args.initial_message,
          },
        }
        await stateManager.addEvent(hiredEvent)

        // 7. Start employee's EventLoop
        await startEmployee(project, newEmployeeId, roleDefinition)

        logger.info(
          `[HireEmployeeTool] Employee '${args.name}' hired by '${hiredBy}' with role '${args.role}'`
        )

        // 8. Build success message with parameter reminder
        let successMessage = `Successfully hired employee '${newEmployeeId}' (name: ${args.name}), role: ${args.role}`

        // 9. Add required parameters reminder if role has requiredArgs
        if (roleDefinition.requiredArgs) {
          const requiredParams = Object.entries(roleDefinition.requiredArgs)
          if (requiredParams.length > 0) {
            successMessage += `\n\nIMPORTANT: This role requires the following parameters to be set:\n`
            for (const [key, value] of requiredParams) {
              successMessage += `- ${key} (${value.type}): ${value.description}\n`
            }
            successMessage += `\nPlease send a message to '${args.name}' with these parameters.`
          }
        }

        // 10. Send message to new employee
        if (args.initial_message) {
          // 如果提供了 initial_message，发送自定义消息
          await project.messageService.send(
            hiredByEmployeeId!,
            newEmployeeId,
            args.initial_message
          )
          logger.info(
            `[HireEmployeeTool] Initial message sent to '${args.name}' from '${hiredBy}'`
          )
          successMessage += `\n\nInitial message sent.`
        } else {
          // 如果没有提供 initial_message，发送默认消息
          let defaultMessage = `Hello! I am ${hiredBy}, and I just hired you. Your role is ${args.role}.`

          // 如果角色有 requiredArgs，添加参数提醒
          if (roleDefinition.requiredArgs) {
            const requiredParams = Object.entries(roleDefinition.requiredArgs)
            if (requiredParams.length > 0) {
              defaultMessage += `\n\nYour role requires the following parameters:\n`
              for (const [key, value] of requiredParams) {
                defaultMessage += `- ${key} (${value.type}): ${value.description}\n`
              }
              defaultMessage += `\n\nPlease check your memory to confirm these parameters are provided. If missing, ask your employer.`
            }
          }

          defaultMessage += `\n\nPlease start working according to your role definition.`

          await project.messageService.send(
            hiredByEmployeeId!,
            newEmployeeId,
            defaultMessage
          )
          logger.info(
            `[HireEmployeeTool] Default message sent to '${args.name}' from '${hiredBy}'`
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
  targetRole: string,
  stateManager: StateManager,
  roleManager: RoleManager,
  bossManager?: BossManager
): boolean {
  // Boss 可以雇佣任何角色
  if (bossManager?.isBoss(hiredByName)) {
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
  return roleManager.canHire(employee.role, targetRole)
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
    const { parseEmployeeId } = await import("../types/employee")

    // Parse employeeId to get name for MessageClient
    const { name } = parseEmployeeId(employeeId)

    const messageClient = project.messageService.getClient(name)
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
      project.stateManager
    )

    // Store in project.eventLoops (use name as key for backward compatibility)
    project.eventLoops.set(name, eventLoop)

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

/**
 * Generate next taskId by finding max taskId from existing employees
 * TODO: Use TaskManager.createTask() when TaskManager is fully integrated
 */
async function generateNextTaskId(stateManager: StateManager): Promise<number> {
  const employees = stateManager.getEmployees()
  let maxTaskId = 0
  for (const employee of employees) {
    if (employee.taskId > maxTaskId) {
      maxTaskId = employee.taskId
    }
  }
  return maxTaskId + 1
}
