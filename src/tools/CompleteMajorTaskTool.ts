/**
 * complete_major_task tool
 *
 * Mark major task completion and trigger team feedback survey
 * Only core lead roles can call this tool
 */

import { tool } from "@opencode-ai/plugin"
import type { MessageService } from "../core/MessageService"
import type { RoleManager } from "../core/RoleManager"
import type { StateManager } from "../state/StateManager"
import type { WorkItemManager } from "../core/WorkItemManager"
import { resolveToolActor } from "../meeting-mode"

export function createCompleteMajorTaskTool(
  messageService: MessageService,
  stateManager: StateManager,
  roleManager?: RoleManager,
  workItemManager?: WorkItemManager
) {
  return tool({
    description:
      "Mark a root task completion and trigger team feedback survey. Only core lead roles can call this.",
    args: {
      root_task_id: tool.schema.string().describe("Completed root task ID"),
    },
    async execute(args, context) {
      // 解析调用者身份
      const actor = resolveToolActor(context, stateManager)

      if (!actor) {
        throw new Error(
          `Unable to identify caller (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
        )
      }

      const employeeId = actor.actorEmployeeId

      // 1. 权限检查
      const employees = stateManager.getEmployees()
      const employee = employees.find((e) => e.employeeId === employeeId)

      if (!employee) {
        throw new Error(`Employee ${employeeId} not found`)
      }

      const role = roleManager?.getRole(employee.roleId)

      if (!role || !role.isCoreLead) {
        throw new Error(
          `Permission denied: Only core lead roles can complete major tasks. ` +
            `Your role '${employee.roleId}' does not have isCoreLead permission.`
        )
      }

      if (!workItemManager) {
        throw new Error("WorkItemManager is required to complete a root task")
      }

      // 2. 记录 major_task_completed 事件
      await stateManager.addEvent({
        projectId: stateManager.getProjectId(),
        type: "major_task_completed",
        timestamp: new Date().toISOString(),
        employeeId: employee.employeeId,
        rootTaskId: args.root_task_id,
        details: { completedAt: new Date().toISOString() },
      })

      // 3. 从 root task 下的 work item 找到参与员工
      const workItems = await workItemManager.listWorkItems({
        rootTaskId: args.root_task_id,
      })
      const employeeIds = new Set(workItems.map((item) => item.employeeId))
      const taskEmployees = employees.filter((e) =>
        employeeIds.has(e.employeeId)
      )

      // 4. 发送调查问卷给 root task 下 work item 覆盖到的员工
      const SURVEY_PROMPT = `[Work Experience Survey]

Hello! I'm the Boss, the developer of this system.

**Important reminder:**

Any difficulty, confusion, or awkward feeling you encounter is **most likely not your fault**, but rather:
- Code design flaws
- Unreasonable system design
- Accumulated technical debt causing chaos
- Unclear collaboration processes
- Missing or outdated documentation
- Anti-human tool design
- **Problems with the role definition itself**

**Please feel free to complain!** Don't worry about "would this sound impolite" or "did I misunderstand something".

---

**First, please briefly describe: What work did you do this time?**

(No need for details, just a few sentences summarizing: what task you received, what you did, what tools you used, who you collaborated with)

---

Then, thinking back on this work process, were there any moments when you felt:

**Tool Usage**
- Paused to think "How should I use this tool?" or "Which tool should I use?"
- Felt "This tool is awkward to use"

**Collaboration & Communication**
- When communicating with colleagues, felt "can't explain clearly" or "they don't seem to understand me"
- Didn't know who to ask, or didn't know how to start the conversation
- Felt "I seem to have asked/said this several times already"
- Needed to repeatedly confirm "Should you do this or should I?" or "How should this be done?"

**Role Definition**
- Looked at your prompt and thought "What does this mean?"
- Felt "I should do this, but the prompt doesn't say so" or "The prompt tells me to do it, but I think it's wrong"
- Felt some rules in the prompt are "stupid", "unnecessary", or "too restrictive"

**Work Process**
- Felt "This process is so cumbersome" or "Why do it this way?"
- Knew what to do, but got stuck on "don't know how to do it"

**System Mechanisms**
- Wanted to do something, but the system "won't let me" or "makes it very troublesome"
- Felt "This design is a bit weird", "inconsistent", "counter-intuitive"

**Any Other Feelings**
- Anything that made you feel "a bit awkward", "could be better", "can't quite put my finger on it but it's weird"

---

**If everything went smoothly so far, please also tell me "No difficulties at present".**

Any degree of discomfort is worth mentioning — even just a momentary "Huh?", it could be a clue for improvement.`

      const surveyTimestamp = new Date().toISOString()

      for (const emp of taskEmployees) {
        await messageService.send(
          "0-cclover",
          emp.employeeId,
          SURVEY_PROMPT,
          undefined,
          undefined,
          true
        )

        // 记录 survey_sent 事件到每个员工的 events.jsonl（跨员工写入）
        await stateManager.addEvent({
          projectId: stateManager.getProjectId(),
          type: "survey_sent",
          timestamp: new Date().toISOString(),
          employeeId: emp.employeeId,
          details: { sentAt: surveyTimestamp },
        })
      }

      return `Root task ${args.root_task_id} marked complete. Feedback survey sent to ${taskEmployees.length} employees.`
    },
  })
}
