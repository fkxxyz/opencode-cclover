import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { StateManager } from "../../src/state"
import type { Employee } from "../../src/types"
import {
  getTestProjectPaths,
  resetTestWorkspace,
} from "../helpers/testWorkspace"

const { suiteRoot, projectPath, workspaceRoot } = getTestProjectPaths(
  "state-manager-employee-validation"
)

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    employeeId: "emp_worker",
    name: "worker",
    roleId: "developer",
    description: "Implements scoped work",
    contextPaths: ["docs/context.md"],
    hiredBy: "boss_alice",
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(async () => {
  await resetTestWorkspace(suiteRoot)
  await fs.mkdir(path.join(projectPath, "docs"), { recursive: true })
  await fs.writeFile(path.join(projectPath, "docs", "context.md"), "context")
})

afterEach(async () => {
  await fs.rm(suiteRoot, { recursive: true, force: true })
})

function createStateManager(): StateManager {
  return new StateManager("test", workspaceRoot, projectPath)
}

describe("StateManager employee metadata validation", () => {
  it("validates context paths when registering employee metadata", async () => {
    const stateManager = createStateManager()

    for (const [contextPath, message] of [
      ["/absolute.md", "must be project-relative"],
      ["docs", "must be a readable file, not a directory"],
      ["docs/*.md", "must not contain glob patterns"],
      ["../outside.md", "must stay inside project root"],
      ["docs/missing.md", "must exist and be readable"],
    ] as const) {
      await expect(
        stateManager.registerEmployee(
          createEmployee({
            employeeId: `emp_${message.replace(/[^a-z]/g, "_")}`,
            name: message.replace(/[^a-z]/g, "-"),
            contextPaths: [contextPath],
          })
        )
      ).rejects.toThrow(message)
    }
  })

  it("validates context paths when updating employee metadata", async () => {
    const stateManager = createStateManager()
    await stateManager.registerEmployee(createEmployee())

    await expect(
      stateManager.updateEmployee("emp_worker", {
        name: "worker",
        description: "Updated description",
        contextPaths: ["docs/*.md"],
      })
    ).rejects.toThrow("must not contain glob patterns")
  })
})
