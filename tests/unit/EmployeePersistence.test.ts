import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import { EmployeePersistence } from "../../src/state/EmployeePersistence"
import type { Employee } from "../../src/types/index"

const testWorkspace = "./workspace_test_persistence"

beforeEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
  await fs.mkdir(testWorkspace, { recursive: true })
})

afterEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
})

describe("EmployeePersistence", () => {
  it("should save and load employees", async () => {
    const persistence = new EmployeePersistence(testWorkspace)

    const employees: Employee[] = [
      {
        employeeId: "0-calculator",
        taskId: 0,
        name: "calculator",
        role: "calculator",
        status: "active",
        paused: false,
        activeSessionId: null,
        createdAt: "2024-01-01T00:00:00Z",
        lastActiveAt: "2024-01-01T00:00:00Z",
        hiredBy: "boss1",
      },
      {
        employeeId: "1-coder",
        taskId: 1,
        name: "coder",
        role: "coder",
        status: "idle",
        paused: false,
        activeSessionId: null,
        createdAt: "2024-01-02T00:00:00Z",
        lastActiveAt: "2024-01-02T00:00:00Z",
        hiredBy: "0-calculator",
      },
    ]

    await persistence.save(employees)

    const loaded = await persistence.load()
    expect(loaded).toEqual(employees)
  })

  it("should return empty array when file does not exist", async () => {
    const persistence = new EmployeePersistence(testWorkspace)
    const loaded = await persistence.load()
    expect(loaded).toEqual([])
  })

  it("should overwrite existing file", async () => {
    const persistence = new EmployeePersistence(testWorkspace)

    const employees1: Employee[] = [
      {
        employeeId: "0-calculator",
        taskId: 0,
        name: "calculator",
        role: "calculator",
        status: "active",
        paused: false,
        activeSessionId: null,
        createdAt: "2024-01-01T00:00:00Z",
        lastActiveAt: "2024-01-01T00:00:00Z",
        hiredBy: "boss1",
      },
    ]

    await persistence.save(employees1)

    const employees2: Employee[] = [
      {
        employeeId: "1-coder",
        taskId: 1,
        name: "coder",
        role: "coder",
        status: "active",
        paused: false,
        activeSessionId: null,
        createdAt: "2024-01-02T00:00:00Z",
        lastActiveAt: "2024-01-02T00:00:00Z",
        hiredBy: "boss1",
      },
    ]

    await persistence.save(employees2)

    const loaded = await persistence.load()
    expect(loaded).toEqual(employees2)
  })
})
