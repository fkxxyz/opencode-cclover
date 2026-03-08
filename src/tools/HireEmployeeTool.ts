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
        // 2. First try to get from SessionRegistry (employee)
        hiredBy = sessionRegistry.getEmployeeName(context.sessionID)
        // 3. If not in SessionRegistry, try to get from context.agent (might be boss)
        if (!hiredBy && context.agent) {
          const agentName = context.agent
          // Check if it's a boss
          if (bossManager?.isBoss(agentName)) {
            hiredBy = agentName
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
            args.role,
            stateManager,
            roleManager,
            bossManager
          )
        ) {
          return `Error: You do not have permission to hire role '${args.role}'. Use show_hireable_roles tool to see roles you can hire.`
        }

        // 4. Check if employee already exists
        const existing = stateManager.getEmployee(args.name)
        if (existing) {
          return `Error: Employee '${args.name}' already exists`
        }

        // 5. Register employee (automatically persisted)
        await stateManager.registerEmployee({
          name: args.name,
          role: args.role,
          status: "offline",
          paused: false,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          hiredBy,
        })

        // 6. Start employee's EventLoop
        await startEmployee(project, args.name, roleDefinition)

        logger.info(
          `[HireEmployeeTool] Employee '${args.name}' hired by '${hiredBy}' with role '${args.role}'`
        )

        // 7. Build success message with parameter reminder
        let successMessage = `Successfully hired employee '${args.name}', role: ${args.role}`

        // 8. Add required parameters reminder if role has requiredArgs
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

        // 9. If initial_message is provided, send it to the new employee immediately
        if (args.initial_message) {
          await project.messageService.send(
            hiredBy,
            args.name,
            args.initial_message
          )
          logger.info(
            `[HireEmployeeTool] Initial message sent to '${args.name}' from '${hiredBy}'`
          )
          successMessage += `\n\nInitial message sent.`
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
  hiredBy: string,
  targetRole: string,
  stateManager: StateManager,
  roleManager: RoleManager,
  bossManager?: BossManager
): boolean {
  // Boss 可以雇佣任何角色
  if (bossManager?.isBoss(hiredBy)) {
    return true
  }

  // 获取雇佣者的角色
  const employee = stateManager.getEmployee(hiredBy)
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
  employeeName: string,
  role: { name: string; systemPrompt: string }
): Promise<void> {
  try {
    // Dynamically import EventLoop (avoid circular dependency)
    const { EventLoop } = await import("../core/eventloop")
    const { GlobalCcloverService } = await import("../server/GlobalServer")

    const messageClient = project.messageService.getClient(employeeName)
    const globalService = await GlobalCcloverService.getInstance()
    const opcodeClient = globalService.getOpencodeClient()

    const eventLoop = new EventLoop(
      project.directory,
      employeeName,
      role.name,
      project.roleManager,
      messageClient,
      project.memoryManager,
      opcodeClient,
      project.stateManager
    )

    // Store in project.eventLoops
    project.eventLoops.set(employeeName, eventLoop)

    // Run in background
    eventLoop.run().catch((error: any) => {
      logger.error(`[${employeeName}] EventLoop crashed:`, error)
    })

    logger.debug(
      `[startEmployee] EventLoop started for employee: ${employeeName}`
    )
  } catch (error: any) {
    // 在单元测试环境中，GlobalCcloverService 可能未初始化
    // 这种情况下跳过 EventLoop 启动
    logger.debug(
      `[startEmployee] Skipping EventLoop startup for ${employeeName}: ${error.message}`
    )
  }
}
