import { describe, expect, it } from "bun:test"
import { RootTaskManager } from "../../src/core/RootTaskManager"
import { WorkItemManager } from "../../src/core/WorkItemManager"
import type { StateManager } from "../../src/state"

const stateManager = {} as StateManager

describe("RootTaskManager contract", () => {
  it("exposes the Phase 1.2 root task manager API", () => {
    const manager = new RootTaskManager("/tmp/project")

    expect(manager.createRootTask).toBeFunction()
    expect(manager.getRootTask).toBeFunction()
    expect(manager.listRootTasks).toBeFunction()
    expect(manager.deleteRootTask).toBeFunction()
  })

  it("keeps Phase 2 storage behavior unimplemented", async () => {
    const manager = new RootTaskManager("/tmp/project")

    await expect(
      manager.createRootTask({
        summary: "Coordinate the three-layer task model refactor",
        createdBy: "boss-fkxxyz",
      })
    ).rejects.toThrow("RootTaskManager persistence is not implemented")
  })
})

describe("WorkItemManager contract", () => {
  it("exposes the Phase 1.2 work item manager API", () => {
    const manager = new WorkItemManager("/tmp/project", stateManager)

    expect(manager.createWorkItem).toBeFunction()
    expect(manager.updateWorkItem).toBeFunction()
    expect(manager.deleteWorkItem).toBeFunction()
    expect(manager.getWorkItem).toBeFunction()
    expect(manager.listWorkItems).toBeFunction()
    expect(manager.validateDependencies).toBeFunction()
  })

  it("keeps Phase 2 work item storage and DAG validation unimplemented", async () => {
    const manager = new WorkItemManager("/tmp/project", stateManager)

    await expect(
      manager.createWorkItem({
        rootTaskId: "rt_three_layer_refactor",
        employeeId: "emp_architect",
        description: "Define manager contracts",
      })
    ).rejects.toThrow("WorkItemManager persistence is not implemented")
  })
})
