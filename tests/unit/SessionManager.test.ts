import { describe, test, expect, beforeEach } from "bun:test"
import { SessionManager } from "../../src/core/eventloop/SessionManager"
import { MemoryManager } from "../../src/core/MemoryManager"
import { RoleManager } from "../../src/core/RoleManager"
import { StateManager } from "../../src/state/StateManager"
import type { Employee } from "../../src/types"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"

describe("SessionManager", () => {
  let projectPath: string
  let workspaceRoot: string
  let roleManager: RoleManager
  let memoryManager: MemoryManager
  let stateManager: StateManager

  beforeEach(async () => {
    projectPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "session-manager-test-")
    )
    workspaceRoot = path.join(projectPath, ".cclover/workspace")
    roleManager = new RoleManager(projectPath)
    memoryManager = new MemoryManager(workspaceRoot)
    stateManager = new StateManager("test-project", workspaceRoot)
  })

  test("should propagate resolved role contexts into active session prompts", async () => {
    await fs.mkdir(path.join(projectPath, ".cclover/roles"), {
      recursive: true,
    })
    await fs.writeFile(
      path.join(projectPath, ".cclover/roles/context-role.md"),
      `---
name: context-role
id: context-role
description: Role with context ids
contextIds:
  - delivery-brief
---

You are a context aware employee.`
    )
    await fs.writeFile(
      path.join(projectPath, ".cclover/context.yml"),
      `contexts:
  delivery-brief:
    description: Delivery instructions
    documents:
      - brief.md
`
    )
    // With new path resolution, relative paths resolve from project root
    await fs.writeFile(
      path.join(projectPath, "brief.md"),
      "Deliver the context-aware feature."
    )

    await roleManager.refresh()

    const employee: Employee = {
      employeeId: "1-dev",
      name: "dev",
      id: "dev",
      taskId: 1,
      role: "context-role",
      hiredBy: null,
      status: "idle",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    }
    await stateManager.registerEmployee(employee)

    await memoryManager.write("1-dev", {
      knowledge: [],
      tasks: [],
      args: {},
    })

    const opcodeClient = {
      session: {
        create: async () => ({ data: { id: "session-1" } }),
        get: async () => ({ data: { id: "session-1" } }),
        messages: async () => ({ data: [] }),
      },
    } as any

    const sessionManager = new SessionManager(
      projectPath,
      "1-dev",
      "context-role",
      roleManager,
      memoryManager,
      opcodeClient,
      stateManager
    )

    const session = await sessionManager.ensureSession()

    expect(session.systemPrompt).toContain("# Role Context Materials")
    expect(session.systemPrompt).toContain("delivery-brief")
    expect(session.systemPrompt).toContain("Delivery instructions")
    expect(session.systemPrompt).toContain("Deliver the context-aware feature.")
  })
})
