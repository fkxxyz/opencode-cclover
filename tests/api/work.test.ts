import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs/promises"
import { RootTaskManager } from "../../src/core/RootTaskManager"
import { WorkItemManager } from "../../src/core/WorkItemManager"
import { StateManager } from "../../src/state/StateManager"
import { getRootTasks, getWorkItems } from "../../src/api/work"
import type { Employee } from "../../src/types"

const testWorkspace = "./workspace_test_work_api"

beforeEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
  await fs.mkdir(testWorkspace, { recursive: true })
})

afterEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
})

describe("Work model API", () => {
  it("returns root tasks and work items with stable IDs", async () => {
    const stateManager = new StateManager(
      "test-project",
      testWorkspace,
      testWorkspace
    )
    const employee: Employee = {
      employeeId: "emp-worker",
      name: "worker",
      roleId: "developer",
      status: "idle",
      paused: false,
      hiredBy: null,
      activeSessionId: null,
      createdAt: "2026-06-19T00:00:00.000Z",
      lastActiveAt: "2026-06-19T00:00:00.000Z",
    }
    await stateManager.registerEmployee(employee)
    const rootTaskManager = new RootTaskManager(testWorkspace, stateManager)
    const workItemManager = new WorkItemManager(testWorkspace, stateManager)
    const rootTask = await rootTaskManager.createRootTask({
      summary: "Build API compatibility",
      createdBy: "emp-worker",
    })
    const workItem = await workItemManager.createWorkItem({
      rootTaskId: rootTask.rootTaskId,
      employeeId: "emp-worker",
      description: "Update backend contracts",
    })

    const rootResponse = await getRootTasks(rootTaskManager)
    const workResponse = await getWorkItems(workItemManager, {
      rootTaskId: rootTask.rootTaskId,
      employeeId: "emp-worker",
    })

    expect(rootResponse.success).toBe(true)
    expect(workResponse.success).toBe(true)
    expect(rootResponse.data.rootTasks[0].rootTaskId).toStartWith("rt_")
    expect(workResponse.data.workItems[0]).toMatchObject({
      workItemId: workItem.workItemId,
      rootTaskId: rootTask.rootTaskId,
      employeeId: "emp-worker",
    })
  })
})
