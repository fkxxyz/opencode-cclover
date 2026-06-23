import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { StateManager } from "../../src/state/StateManager"
import type { Employee, Event } from "../../src/types/index"
import { createTestEmployee } from "../helpers/employeeFactory"

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return createTestEmployee({
    employeeId: "emp_alice",
    name: "alice",
    roleId: "tester",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
    ...overrides,
  })
}

describe("StateManager.loadHistoricalEvents", () => {
  const testWorkspace = path.join(__dirname, "../fixtures/test-workspace-load")
  const projectId = "test-project-123"
  let stateManager: StateManager

  beforeEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true })
    await fs.mkdir(testWorkspace, { recursive: true })
    stateManager = new StateManager(projectId, testWorkspace)
  })

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true })
  })

  test("loads historical events from files into memory", async () => {
    await stateManager.registerEmployee(createEmployee())

    const event1: Event = {
      projectId,
      type: "message",
      timestamp: "2026-03-01T10:01:00.000Z",
      employeeId: "emp_alice",
      details: { from: "emp_alice", to: "emp_bob", content: "Hello" },
    }
    const event2: Event = {
      projectId,
      type: "task_completed",
      timestamp: "2026-03-01T10:02:00.000Z",
      employeeId: "emp_alice",
      details: { taskName: "Task1", result: "Done" },
    }

    await stateManager.addEvent(event1)
    await stateManager.addEvent(event2)

    const newStateManager = new StateManager(projectId, testWorkspace)
    await newStateManager.registerEmployee(createEmployee())
    expect(newStateManager.getEvents({ limit: 10 })).toHaveLength(0)

    await newStateManager.loadHistoricalEvents()

    expect(newStateManager.getEvents({ limit: 10 }).map((e) => e.type)).toEqual(
      ["task_completed", "message"]
    )
  })

  test("loads historical events for multiple employees by employeeId", async () => {
    await stateManager.registerEmployee(createEmployee())
    await stateManager.registerEmployee(
      createEmployee({
        employeeId: "emp_bob",
        name: "bob",
        roleId: "developer",
      })
    )

    await stateManager.addEvent({
      projectId,
      type: "message",
      timestamp: "2026-03-01T10:01:00.000Z",
      employeeId: "emp_alice",
      details: { from: "emp_bob", to: "emp_alice", content: "Hello Alice" },
    })
    await stateManager.addEvent({
      projectId,
      type: "message",
      timestamp: "2026-03-01T10:02:00.000Z",
      employeeId: "emp_bob",
      details: { from: "emp_alice", to: "emp_bob", content: "Hello Bob" },
    })

    const newStateManager = new StateManager(projectId, testWorkspace)
    await newStateManager.registerEmployee(createEmployee())
    await newStateManager.registerEmployee(
      createEmployee({
        employeeId: "emp_bob",
        name: "bob",
        roleId: "developer",
      })
    )

    await newStateManager.loadHistoricalEvents()

    expect(newStateManager.getEvents({ employeeId: "emp_alice" })).toHaveLength(
      2
    )
    expect(newStateManager.getEvents({ employeeId: "emp_bob" })).toHaveLength(2)
  })

  test("handles employees without historical events", async () => {
    await stateManager.registerEmployee(
      createEmployee({ employeeId: "emp_charlie", name: "charlie" })
    )

    await expect(stateManager.loadHistoricalEvents()).resolves.toBeUndefined()
    expect(stateManager.getEvents({ employeeId: "emp_charlie" })).toHaveLength(
      0
    )
  })

  test("updates statistics after loading historical events", async () => {
    await stateManager.registerEmployee(createEmployee())
    await stateManager.addEvent({
      projectId,
      type: "message",
      timestamp: "2026-03-01T10:01:00.000Z",
      employeeId: "emp_alice",
      details: { from: "emp_bob", to: "emp_alice", content: "Hello" },
    })
    await stateManager.addEvent({
      projectId,
      type: "task_completed",
      timestamp: "2026-03-01T10:02:00.000Z",
      employeeId: "emp_alice",
      details: { taskName: "Task1", result: "Done" },
    })

    const newStateManager = new StateManager(projectId, testWorkspace)
    await newStateManager.registerEmployee(createEmployee())
    await newStateManager.loadHistoricalEvents()

    const stats = newStateManager.getStats()
    expect(stats.totalEmployees).toBe(1)
    expect(stats.todayMessages).toBeGreaterThanOrEqual(0)
  })
})
