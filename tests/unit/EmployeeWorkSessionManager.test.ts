import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import { EmployeeWorkSessionManager } from "../../src/core/EmployeeWorkSessionManager"
import { RoleManager } from "../../src/core/RoleManager"
import { StateManager } from "../../src/state"
import type { Employee, EmployeeWorkSessionId } from "../../src/types"
import {
  getTestProjectPaths,
  resetTestWorkspace,
} from "../helpers/testWorkspace"

const { suiteRoot, projectPath, workspaceRoot } = getTestProjectPaths(
  "employee-work-session-manager"
)

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    employeeId: "emp_worker",
    name: "worker",
    roleId: "developer",
    description: "Implements scoped tasks",
    contextPaths: ["docs/context.md"],
    hiredBy: "boss_alice",
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
    ...overrides,
  }
}

async function writeRole(
  name: string,
  requiredArgs: Record<string, any> = {}
): Promise<void> {
  const rolesDir = path.join(projectPath, ".cclover", "roles")
  await fs.mkdir(rolesDir, { recursive: true })
  await fs.writeFile(
    path.join(rolesDir, `${name}.md`),
    "---\n" +
      yaml.stringify({
        name,
        id: name,
        description: `${name} role`,
        requiredArgs,
      }) +
      "---\nRole body\n",
    "utf-8"
  )
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

function createManager(stateManager: StateManager): EmployeeWorkSessionManager {
  return new EmployeeWorkSessionManager(
    projectPath,
    stateManager,
    new RoleManager(projectPath)
  )
}

describe("EmployeeWorkSessionManager", () => {
  it("creates, lists, updates, and closes employee work sessions", async () => {
    await writeRole("developer", {
      worktree_path: { type: "string", description: "Worktree path" },
    })
    const stateManager = createStateManager()
    await stateManager.registerEmployee(createEmployee())
    const manager = createManager(stateManager)

    const created = await manager.createEmployeeWorkSession({
      employeeId: "emp_worker",
      description: "Implement foundation",
      args: { worktree_path: ".worktrees/ews-taskplan" },
      createdBy: "boss_alice",
      worktreeRef: ".worktrees/ews-taskplan",
    })

    expect(created.employeeWorkSessionId).toMatch(/^ews_[0-9a-f]{32}$/)
    expect(created.status).toBe("offline")
    expect(created.contextPathsSnapshot).toEqual(["docs/context.md"])
    expect(created.parentEmployeeWorkSessionId).toBe(null)

    await manager.updateStatus(created.employeeWorkSessionId, "idle")
    await manager.updateOpenCodeSessionId(
      created.employeeWorkSessionId,
      "ses_1"
    )
    await manager.setPromptRecovery(created.employeeWorkSessionId, {
      sessionId: "ses_1",
      startedAt: "2026-06-22T00:00:01.000Z",
      triggerEventType: "message",
    })

    const updated = await manager.getEmployeeWorkSession(
      created.employeeWorkSessionId
    )
    expect(updated?.status).toBe("idle")
    expect(updated?.opencodeSessionId).toBe("ses_1")
    expect(updated?.promptRecovery?.sessionId).toBe("ses_1")

    await manager.clearPromptRecovery(created.employeeWorkSessionId)
    expect(
      (await manager.getEmployeeWorkSession(created.employeeWorkSessionId))
        ?.promptRecovery
    ).toBeUndefined()

    const listed = await manager.listEmployeeWorkSessions({
      employeeId: "emp_worker",
      status: "idle",
    })
    expect(listed.map((session) => session.employeeWorkSessionId)).toEqual([
      created.employeeWorkSessionId,
    ])

    const closed = await manager.closeEmployeeWorkSession({
      employeeWorkSessionId: created.employeeWorkSessionId,
      closedBy: "boss_alice",
      reason: "done",
    })
    expect(closed.status).toBe("closed")
    expect(closed.opencodeSessionId).toBe("ses_1")
    expect(closed.closeReason).toBe("done")
  })

  it("preserves concurrent create operations under one locked read-modify-write", async () => {
    await writeRole("developer")
    const stateManager = createStateManager()
    await stateManager.registerEmployee(createEmployee())
    const manager = createManager(stateManager)

    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        manager.createEmployeeWorkSession({
          employeeId: "emp_worker",
          description: `Implement foundation ${index}`,
          args: {},
          createdBy: "boss_alice",
        })
      )
    )

    const listed = await manager.listEmployeeWorkSessions()
    expect(listed).toHaveLength(12)
  })

  it("rejects missing employee, parent EWS, role, required args, and invalid context paths", async () => {
    await writeRole("developer", {
      worktree_path: { type: "string", description: "Worktree path" },
    })
    const stateManager = createStateManager()
    const manager = createManager(stateManager)

    await expect(
      manager.createEmployeeWorkSession({
        employeeId: "emp_missing",
        description: "Implement foundation",
        args: { worktree_path: ".worktrees/ews-taskplan" },
        createdBy: "boss_alice",
      })
    ).rejects.toThrow("Employee 'emp_missing' does not exist")

    await stateManager.registerEmployee(createEmployee())

    await expect(
      manager.createEmployeeWorkSession({
        employeeId: "emp_worker",
        description: "Implement foundation",
        args: { worktree_path: ".worktrees/ews-taskplan" },
        parentEmployeeWorkSessionId: "ews_missing" as EmployeeWorkSessionId,
        createdBy: "boss_alice",
      })
    ).rejects.toThrow(
      "Parent employee work session 'ews_missing' does not exist"
    )

    await expect(
      manager.createEmployeeWorkSession({
        employeeId: "emp_worker",
        description: "Implement foundation",
        args: {},
        createdBy: "boss_alice",
      })
    ).rejects.toThrow("Missing required arg 'worktree_path'")

    await stateManager.registerEmployee(
      createEmployee({
        employeeId: "emp_no_role",
        name: "no-role",
        roleId: "missing-role",
      })
    )
    await expect(
      manager.createEmployeeWorkSession({
        employeeId: "emp_no_role",
        description: "Implement foundation",
        args: {},
        createdBy: "boss_alice",
      })
    ).rejects.toThrow("Role 'missing-role' does not exist")

    for (const [contextPath, message] of [
      ["/absolute.md", "must be project-relative"],
      ["docs", "must be a readable file, not a directory"],
      ["docs/*.md", "must not contain glob patterns"],
      ["../outside.md", "must stay inside project root"],
      ["docs/missing.md", "must exist and be readable"],
    ] as const) {
      const employeeId = `emp_${message.replace(/[^a-z]/g, "_")}` as const
      const ewsOnlyStateManager = new StateManager("test", workspaceRoot)
      await ewsOnlyStateManager.registerEmployee(
        createEmployee({
          employeeId,
          name: employeeId,
          contextPaths: [contextPath],
        })
      )
      const ewsOnlyManager = createManager(ewsOnlyStateManager)
      await expect(
        ewsOnlyManager.createEmployeeWorkSession({
          employeeId,
          description: "Implement foundation",
          args: { worktree_path: ".worktrees/ews-taskplan" },
          createdBy: "boss_alice",
        })
      ).rejects.toThrow(message)
    }
  })
})
