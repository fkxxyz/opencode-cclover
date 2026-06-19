import { beforeEach, describe, expect, test } from "bun:test"
import { createCompleteMajorTaskTool } from "../../src/tools/CompleteMajorTaskTool"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import type { Employee, Role, WorkItem } from "../../src/types"

const now = "2026-06-19T00:00:00.000Z"

function employee(employeeId: string, roleId: string): Employee {
  return {
    employeeId,
    name: employeeId.replace(/^emp_/, ""),
    roleId,
    hiredBy: "0-boss",
    status: "idle",
    paused: false,
    createdAt: now,
    lastActiveAt: now,
    activeSessionId: null,
  }
}

function role(id: string, isCoreLead: boolean): Role {
  return {
    id,
    name: id,
    description: id,
    systemPrompt: "",
    source: "project",
    requiredArgs: {},
    canHire: [],
    groups: [],
    isCoreLead,
  }
}

function workItem(
  workItemId: string,
  rootTaskId: string,
  employeeId: string
): WorkItem {
  return {
    workItemId,
    rootTaskId,
    parentWorkItemId: null,
    employeeId,
    description: workItemId,
    dependsOn: [],
    worktreeRef: null,
    createdAt: now,
    updatedAt: now,
  }
}

function createHarness(options?: {
  employees?: Employee[]
  roles?: Record<string, Role>
  workItems?: WorkItem[]
  includeWorkItemManager?: boolean
}) {
  const employees = options?.employees ?? [employee("emp_lead", "lead")]
  const events: any[] = []
  const sentMessages: any[] = []
  const roleLookups: string[] = []
  const workItemFilters: any[] = []

  const stateManager = {
    getEmployees: () => employees,
    getEmployee: (employeeId: string) =>
      employees.find((candidate) => candidate.employeeId === employeeId),
    getProjectId: () => "test-project",
    addEvent: async (event: any) => {
      events.push(event)
    },
  }

  const roleManager = {
    getRole: (roleId: string) => {
      roleLookups.push(roleId)
      return options?.roles?.[roleId]
    },
  }

  const messageService = {
    send: async (...args: any[]) => {
      sentMessages.push(args)
    },
  }

  const workItemManager =
    options?.includeWorkItemManager === false
      ? undefined
      : {
          listWorkItems: async (filters: any) => {
            workItemFilters.push(filters)
            return (options?.workItems ?? []).filter(
              (item) => item.rootTaskId === filters.rootTaskId
            )
          },
        }

  const tool = createCompleteMajorTaskTool(
    messageService as any,
    stateManager as any,
    roleManager as any,
    workItemManager as any
  )

  return {
    tool,
    events,
    sentMessages,
    roleLookups,
    workItemFilters,
  }
}

describe("CompleteMajorTaskTool", () => {
  beforeEach(() => {
    sessionRegistry.clear()
  })

  test("executes actual tool when caller role has isCoreLead=true", async () => {
    const lead = employee("emp_lead", "technical-lead")
    const developer = employee("emp_dev", "developer")
    const harness = createHarness({
      employees: [lead, developer],
      roles: {
        "technical-lead": role("technical-lead", true),
        developer: role("developer", false),
      },
      workItems: [workItem("wi_dev", "rt_phase3", developer.employeeId)],
    })
    sessionRegistry.register("session-lead", lead.employeeId)

    const result = await harness.tool.execute({ root_task_id: "rt_phase3" }, {
      sessionID: "session-lead",
    } as any)

    expect(result).toContain("Root task rt_phase3 marked complete")
    expect(harness.roleLookups).toEqual(["technical-lead"])
    expect(harness.sentMessages).toHaveLength(1)
  })

  test("denies actual tool execution when caller role has isCoreLead=false", async () => {
    const developer = employee("emp_dev", "developer")
    const harness = createHarness({
      employees: [developer],
      roles: { developer: role("developer", false) },
      workItems: [workItem("wi_dev", "rt_phase3", developer.employeeId)],
    })
    sessionRegistry.register("session-dev", developer.employeeId)

    await expect(
      harness.tool.execute({ root_task_id: "rt_phase3" }, {
        sessionID: "session-dev",
      } as any)
    ).rejects.toThrow("isCoreLead permission")
    expect(harness.roleLookups).toEqual(["developer"])
    expect(harness.sentMessages).toHaveLength(0)
  })

  test("records major_task_completed event with rootTaskId", async () => {
    const lead = employee("emp_lead", "lead")
    const harness = createHarness({
      employees: [lead],
      roles: { lead: role("lead", true) },
      workItems: [],
    })
    sessionRegistry.register("session-lead", lead.employeeId)

    await harness.tool.execute({ root_task_id: "rt_phase3" }, {
      sessionID: "session-lead",
    } as any)

    expect(harness.events[0]).toMatchObject({
      type: "major_task_completed",
      employeeId: lead.employeeId,
      rootTaskId: "rt_phase3",
    })
  })

  test("sends surveys once per unique employee from root task work items only", async () => {
    const lead = employee("emp_lead", "lead")
    const devA = employee("emp_dev_a", "developer")
    const devB = employee("emp_dev_b", "developer")
    const unrelated = employee("emp_unrelated", "developer")
    const harness = createHarness({
      employees: [lead, devA, devB, unrelated],
      roles: { lead: role("lead", true), developer: role("developer", false) },
      workItems: [
        workItem("wi_a_1", "rt_phase3", devA.employeeId),
        workItem("wi_a_2", "rt_phase3", devA.employeeId),
        workItem("wi_b", "rt_phase3", devB.employeeId),
        workItem("wi_unrelated", "rt_other", unrelated.employeeId),
      ],
    })
    sessionRegistry.register("session-lead", lead.employeeId)

    await harness.tool.execute({ root_task_id: "rt_phase3" }, {
      sessionID: "session-lead",
    } as any)

    const recipients = harness.sentMessages.map((args) => args[1])
    expect(harness.workItemFilters).toEqual([{ rootTaskId: "rt_phase3" }])
    expect(recipients).toEqual([devA.employeeId, devB.employeeId])
    expect(new Set(recipients).size).toBe(recipients.length)
    expect(recipients).not.toContain(unrelated.employeeId)
    expect(harness.sentMessages.every((args) => args[0] === "0-cclover")).toBe(
      true
    )
    expect(harness.sentMessages.every((args) => args[5] === true)).toBe(true)
    expect(
      harness.events
        .filter((event) => event.type === "survey_sent")
        .map((event) => event.employeeId)
    ).toEqual([devA.employeeId, devB.employeeId])
  })

  test("keeps missing WorkItemManager as a hard error", async () => {
    const lead = employee("emp_lead", "lead")
    const harness = createHarness({
      employees: [lead],
      roles: { lead: role("lead", true) },
      includeWorkItemManager: false,
    })
    sessionRegistry.register("session-lead", lead.employeeId)

    await expect(
      harness.tool.execute({ root_task_id: "rt_phase3" }, {
        sessionID: "session-lead",
      } as any)
    ).rejects.toThrow("WorkItemManager is required")
  })
})
