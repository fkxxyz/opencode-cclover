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
          return `Error: Role '${args.role}' does not exist`
        }

        // 3. Check if employee already exists
        const existing = stateManager.getEmployee(args.name)
        if (existing) {
          return `Error: Employee '${args.name}' already exists`
        }

        // 4. Register employee (automatically persisted)
        await stateManager.registerEmployee({
          name: args.name,
          role: args.role,
          status: "offline",
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          hiredBy,
        })

        // 5. Start employee's EventLoop
        await startEmployee(project, args.name, roleDefinition)

        logger.info(
          `[HireEmployeeTool] Employee '${args.name}' hired by '${hiredBy}' with role '${args.role}'`
        )

        // 6. If initial_message is provided, send it to the new employee immediately
        if (args.initial_message) {
          await project.messageService.send(
            hiredBy,
            args.name,
            args.initial_message
          )
          logger.info(
            `[HireEmployeeTool] Initial message sent to '${args.name}' from '${hiredBy}'`
          )
          return `Successfully hired employee '${args.name}', role: ${args.role}, initial message sent`
        }

        return `Successfully hired employee '${args.name}', role: ${args.role}`
      } catch (error: any) {
        logger.error(`[HireEmployeeTool] Failed to hire employee:`, error)
        return `Failed to hire: ${error.message}`
      }
    },
  })
}

/**
 * Start employee's EventLoop
 */
async function startEmployee(
  project: ProjectInstance,
  employeeName: string,
  role: { name: string; systemPrompt: string }
): Promise<void> {
  // Dynamically import EventLoop (avoid circular dependency)
  const { EventLoop } = await import("../core/EventLoop")
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
  eventLoop.run().catch((error) => {
    logger.error(`[${employeeName}] EventLoop crashed:`, error)
  })

  logger.info(`[startEmployee] EventLoop started for employee: ${employeeName}`)
}
