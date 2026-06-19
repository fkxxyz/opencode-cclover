import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import { WorkItemManager } from "../../src/core/WorkItemManager"
import { StateManager } from "../../src/state/StateManager"
import type { Employee, Event } from "../../src/types/index"

const testRoot = path.join(__dirname, "../fixtures/work-item-manager-test")

function createEmployee(employeeId: string): Employee {
  return {
    employeeId,
    name: employeeId,
    roleId: "developer",
    hiredBy: null,
    status: "idle",
    paused: false,
    createdAt: "2026-06-19T00:00:00.000Z",
    lastActiveAt: "2026-06-19T00:00:00.000Z",
    activeSessionId: null,
  }
}

async function writeRootTasks(rootTaskIds: string[]): Promise<void> {
  const ccloverDir = path.join(testRoot, ".cclover")
  await fs.mkdir(ccloverDir, { recursive: true })
  await fs.writeFile(
    path.join(ccloverDir, "root-tasks.yaml"),
    yaml.stringify({
      rootTasks: rootTaskIds.map((rootTaskId) => ({
        rootTaskId,
        summary: rootTaskId,
        createdBy: "0-boss",
        createdAt: "2026-06-19T00:00:00.000Z",
      })),
    }),
    "utf-8"
  )
}

describe("WorkItemManager", () => {
  let stateManager: StateManager
  let manager: WorkItemManager

  beforeEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true })
    await fs.mkdir(testRoot, { recursive: true })
    stateManager = new StateManager("work_item_manager_test")
    await stateManager.registerEmployee(createEmployee("emp-alpha"))
    await stateManager.registerEmployee(createEmployee("emp-beta"))
    await writeRootTasks(["rt-alpha", "rt-beta"])
    manager = new WorkItemManager(testRoot, stateManager)
  })

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true })
  })

  it("creates, persists, gets, and lists work items", async () => {
    const created = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-alpha",
      description: "Implement alpha",
      worktreeRef: "feature/alpha",
    })

    expect(created.workItemId).toStartWith("wi_")
    expect(created.parentWorkItemId).toBeNull()
    expect(created.dependsOn).toEqual([])
    expect(created.worktreeRef).toBe("feature/alpha")
    expect(created.createdAt).toBeString()
    expect(created.updatedAt).toBe(created.createdAt)

    const reloaded = new WorkItemManager(testRoot, stateManager)
    await expect(reloaded.getWorkItem(created.workItemId)).resolves.toEqual(
      created
    )
    await expect(reloaded.listWorkItems()).resolves.toEqual([created])
  })

  it("updates mutable fields while preserving employeeId", async () => {
    const parent = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-alpha",
      description: "Parent",
    })
    const dependency = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-alpha",
      description: "Dependency",
    })
    const child = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-beta",
      description: "Child",
    })

    const updated = await manager.updateWorkItem(child.workItemId, {
      description: "Updated child",
      parentWorkItemId: parent.workItemId,
      dependsOn: [dependency.workItemId],
      worktreeRef: "feature/updated",
      employeeId: "emp-alpha",
    } as any)

    expect(updated.employeeId).toBe("emp-beta")
    expect(updated.description).toBe("Updated child")
    expect(updated.parentWorkItemId).toBe(parent.workItemId)
    expect(updated.dependsOn).toEqual([dependency.workItemId])
    expect(updated.worktreeRef).toBe("feature/updated")
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(updated.createdAt)
    )
  })

  it("deletes leaf work items and rejects deleting parents or dependencies", async () => {
    const parent = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-alpha",
      description: "Parent",
    })
    const dependency = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-alpha",
      description: "Dependency",
    })
    const child = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-beta",
      description: "Child",
      parentWorkItemId: parent.workItemId,
      dependsOn: [dependency.workItemId],
    })

    await expect(manager.deleteWorkItem(parent.workItemId)).rejects.toThrow(
      "has child work items"
    )
    await expect(manager.deleteWorkItem(dependency.workItemId)).rejects.toThrow(
      "is depended on by other work items"
    )

    await manager.deleteWorkItem(child.workItemId)
    expect(await manager.getWorkItem(child.workItemId)).toBeNull()
  })

  it("filters by root task, employee, explicit null parent, parent, and dependency", async () => {
    const rootAlpha = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-alpha",
      description: "Root alpha",
    })
    const rootBeta = await manager.createWorkItem({
      rootTaskId: "rt-beta",
      employeeId: "emp-beta",
      description: "Root beta",
    })
    const child = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-beta",
      description: "Child alpha",
      parentWorkItemId: rootAlpha.workItemId,
      dependsOn: [rootBeta.workItemId],
    })

    expect(
      (await manager.listWorkItems({ rootTaskId: "rt-alpha" })).map(
        (item) => item.workItemId
      )
    ).toEqual([rootAlpha.workItemId, child.workItemId])
    expect(
      (await manager.listWorkItems({ employeeId: "emp-beta" })).map(
        (item) => item.workItemId
      )
    ).toEqual([rootBeta.workItemId, child.workItemId])
    expect(
      (await manager.listWorkItems({ parentWorkItemId: null })).map(
        (item) => item.workItemId
      )
    ).toEqual([rootAlpha.workItemId, rootBeta.workItemId])
    expect(
      (
        await manager.listWorkItems({ parentWorkItemId: rootAlpha.workItemId })
      ).map((item) => item.workItemId)
    ).toEqual([child.workItemId])
    expect(
      (await manager.listWorkItems({ dependsOn: rootBeta.workItemId })).map(
        (item) => item.workItemId
      )
    ).toEqual([child.workItemId])
  })

  it("validates root task, employee, parent, and dependency references", async () => {
    await expect(
      manager.createWorkItem({
        rootTaskId: "missing-root",
        employeeId: "emp-alpha",
        description: "Missing root",
      })
    ).rejects.toThrow("Root task 'missing-root' does not exist")

    await expect(
      manager.createWorkItem({
        rootTaskId: "rt-alpha",
        employeeId: "missing-employee",
        description: "Missing employee",
      })
    ).rejects.toThrow("Employee 'missing-employee' does not exist")

    await expect(
      manager.createWorkItem({
        rootTaskId: "rt-alpha",
        employeeId: "emp-alpha",
        description: "Missing parent",
        parentWorkItemId: "missing-parent",
      })
    ).rejects.toThrow("Parent work item 'missing-parent' does not exist")

    await expect(
      manager.createWorkItem({
        rootTaskId: "rt-alpha",
        employeeId: "emp-alpha",
        description: "Missing dependency",
        dependsOn: ["missing-dependency"],
      })
    ).rejects.toThrow(
      "Dependency work item 'missing-dependency' does not exist"
    )
  })

  it("rejects cross-root parent relationships on create and update", async () => {
    const alphaParent = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-alpha",
      description: "Alpha parent",
    })
    const betaChild = await manager.createWorkItem({
      rootTaskId: "rt-beta",
      employeeId: "emp-beta",
      description: "Beta child",
    })

    await expect(
      manager.createWorkItem({
        rootTaskId: "rt-beta",
        employeeId: "emp-beta",
        description: "Invalid beta child",
        parentWorkItemId: alphaParent.workItemId,
      })
    ).rejects.toThrow("must belong to the same root task")

    await expect(
      manager.updateWorkItem(betaChild.workItemId, {
        parentWorkItemId: alphaParent.workItemId,
      })
    ).rejects.toThrow("must belong to the same root task")
  })

  it("rejects self-parent, self-dependency, and dependency cycles", async () => {
    const first = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-alpha",
      description: "First",
    })
    const second = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-beta",
      description: "Second",
      dependsOn: [first.workItemId],
    })

    await expect(
      manager.updateWorkItem(first.workItemId, {
        parentWorkItemId: first.workItemId,
      })
    ).rejects.toThrow("cannot be its own parent")
    await expect(
      manager.validateDependencies(first.workItemId, [first.workItemId])
    ).rejects.toThrow("cannot depend on itself")
    await expect(
      manager.updateWorkItem(first.workItemId, {
        dependsOn: [second.workItemId],
      })
    ).rejects.toThrow("cycle")
  })

  it("emits lifecycle events with root task, work item, employee, and change metadata", async () => {
    const events: Event[] = []
    stateManager.on("event", (event: Event) => {
      if (event.type.startsWith("work_item_")) {
        events.push(event)
      }
    })

    const created = await manager.createWorkItem({
      rootTaskId: "rt-alpha",
      employeeId: "emp-alpha",
      description: "Evented",
    })
    const updated = await manager.updateWorkItem(created.workItemId, {
      description: "Evented update",
    })
    await manager.deleteWorkItem(created.workItemId)

    expect(events.map((event) => event.type)).toEqual([
      "work_item_created",
      "work_item_updated",
      "work_item_deleted",
    ])
    expect(events.map((event) => event.rootTaskId)).toEqual([
      "rt-alpha",
      "rt-alpha",
      "rt-alpha",
    ])
    expect(events.map((event) => event.workItemId)).toEqual([
      created.workItemId,
      created.workItemId,
      created.workItemId,
    ])
    expect(events.map((event) => event.employeeId)).toEqual([
      "emp-alpha",
      "emp-alpha",
      "emp-alpha",
    ])
    expect(events[0].details.workItem).toEqual(created)
    expect(events[1].details.changes).toEqual({
      description: "Evented update",
    })
    expect(events[1].details.workItem).toEqual(updated)
    expect(events[2].details.workItem).toEqual(updated)
  })
})
