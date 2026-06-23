import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import { EmployeePersistence } from "../../src/state/EmployeePersistence"
import type { Employee } from "../../src/types/index"
import { getTestWorkspace, resetTestWorkspace } from "../helpers/testWorkspace"

const testWorkspace = getTestWorkspace("employee-persistence")

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    employeeId: "emp_current",
    name: "current-worker",
    roleId: "developer",
    description: "Implements current tasks",
    contextPaths: [],
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
    hiredBy: "boss_creator",
    ...overrides,
  }
}

beforeEach(async () => {
  await resetTestWorkspace(testWorkspace)
})

afterEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
})

describe("EmployeePersistence", () => {
  it("saves and loads employees with the new task-independent shape", async () => {
    const persistence = new EmployeePersistence(testWorkspace)
    const employees: Employee[] = [
      createEmployee(),
      createEmployee({
        employeeId: "emp_reviewer",
        name: "review-worker",
        roleId: "reviewer",
        description: "Reviews current tasks",
        contextPaths: ["docs/review.md"],
        hiredBy: null,
      }),
    ]

    await persistence.save(employees)

    const loaded = await persistence.load()
    expect(loaded).toEqual(employees)

    const persisted = yaml.parse(
      await fs.readFile(
        path.join(testWorkspace, ".cclover", "employees.yaml"),
        "utf-8"
      )
    )
    expect(persisted.employees).toHaveLength(2)
    expect("status" in persisted.employees[0]).toBe(false)
    expect("activeSessionId" in persisted.employees[0]).toBe(false)
  })

  it("does not persist legacy runtime fields from widened inputs", async () => {
    const persistence = new EmployeePersistence(testWorkspace)
    const employeeWithLegacyFields = {
      ...createEmployee(),
      taskId: 42,
      role: "legacy-developer",
      status: "busy",
      paused: true,
      activeSessionId: "session-1",
    } as Employee & { taskId: number; role: string }

    await persistence.save([employeeWithLegacyFields])

    const persisted = yaml.parse(
      await fs.readFile(
        path.join(testWorkspace, ".cclover", "employees.yaml"),
        "utf-8"
      )
    )
    expect(persisted.employees[0]).toEqual(createEmployee())

    const loaded = await persistence.load()
    expect(loaded).toEqual([createEmployee()])
  })

  it("ignores records missing employeeId or roleId instead of migrating legacy shape", async () => {
    await fs.mkdir(path.join(testWorkspace, ".cclover"), { recursive: true })
    await fs.writeFile(
      path.join(testWorkspace, ".cclover", "employees.yaml"),
      yaml.stringify({
        employees: [
          {
            name: "legacy-worker",
            taskId: 7,
            role: "legacy-role",
            hiredBy: "0-boss",
            status: "busy",
            paused: true,
            activeSessionId: "old-session",
            createdAt: "2026-06-18T00:00:00.000Z",
            lastActiveAt: "2026-06-18T01:00:00.000Z",
          },
          {
            employeeId: "emp_missing_role",
            name: "missing-role-worker",
            hiredBy: "0-boss",
            status: "idle",
            paused: false,
            activeSessionId: null,
            createdAt: "2026-06-18T00:00:00.000Z",
            lastActiveAt: "2026-06-18T01:00:00.000Z",
          },
          createEmployee({ employeeId: "emp_valid" }),
        ],
      }),
      "utf-8"
    )

    const persistence = new EmployeePersistence(testWorkspace)
    const loaded = await persistence.load()

    expect(loaded).toEqual([createEmployee({ employeeId: "emp_valid" })])
    expect(
      loaded.some(
        (employee) =>
          "taskId" in employee ||
          "role" in employee ||
          "status" in employee ||
          "activeSessionId" in employee
      )
    ).toBe(false)
  })

  it("returns empty array when file does not exist", async () => {
    const persistence = new EmployeePersistence(testWorkspace)
    const loaded = await persistence.load()
    expect(loaded).toEqual([])
  })

  it("overwrites existing file", async () => {
    const persistence = new EmployeePersistence(testWorkspace)

    await persistence.save([createEmployee({ employeeId: "emp_first" })])
    await persistence.save([createEmployee({ employeeId: "emp_second" })])

    const loaded = await persistence.load()
    expect(loaded).toEqual([createEmployee({ employeeId: "emp_second" })])
  })
})
