import { describe, expect, it } from "bun:test"
import { getEvents } from "../../src/api/events"
import { StateManager } from "../../src/state/StateManager"

describe("Events API", () => {
  it("filters by employeeId, rootTaskId, workItemId, type, and limit", async () => {
    const stateManager = new StateManager("test-project")

    await stateManager.addEvent({
      projectId: "test-project",
      type: "work_item_created",
      timestamp: "2026-06-19T00:00:00.000Z",
      employeeId: "emp-worker",
      rootTaskId: "rt-alpha",
      workItemId: "wi-alpha",
      details: { workItemId: "wi-alpha" },
    })
    await stateManager.addEvent({
      projectId: "test-project",
      type: "root_task_created",
      timestamp: "2026-06-19T00:01:00.000Z",
      employeeId: "emp-other",
      rootTaskId: "rt-beta",
      details: { rootTaskId: "rt-beta" },
    })

    const response = getEvents(
      {
        employeeId: "emp-worker",
        rootTaskId: "rt-alpha",
        workItemId: "wi-alpha",
        type: "work_item_created",
        limit: 1,
      },
      stateManager
    )

    expect(response.success).toBe(true)
    expect(response.data.events).toHaveLength(1)
    expect(response.data.events[0]).toMatchObject({
      employeeId: "emp-worker",
      rootTaskId: "rt-alpha",
      workItemId: "wi-alpha",
      type: "work_item_created",
    })
  })
})
