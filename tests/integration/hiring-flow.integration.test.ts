/**
 * End-to-End Hiring Flow Integration Tests
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { StateManager } from "../../src/state/StateManager"
import { RoleManager } from "../../src/core/RoleManager"
import { BossManager } from "../../src/core/BossManager"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
import { createHireEmployeeTool } from "../../src/tools/HireEmployeeTool"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import type { ProjectInstance } from "../../src/server/ProjectRegistry"
import type { EmployeeId } from "../../src/types/employee"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../.test-workspace-hiring-flow"
)

describe("Hiring Flow Integration", () => {
  let stateManager: StateManager
  let roleManager: RoleManager
  let bossManager: BossManager
  let messageService: MessageService
  let memoryManager: MemoryManager
  let project: ProjectInstance

  beforeEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    stateManager = new StateManager("test-project", TEST_WORKSPACE)
    roleManager = new RoleManager(TEST_WORKSPACE)
    await roleManager.refresh()
    bossManager = new BossManager(
      { bosses: ["test-boss"], projects: [] },
      TEST_WORKSPACE,
      roleManager
    )
    messageService = new MessageService(TEST_WORKSPACE, stateManager)
    memoryManager = new MemoryManager(TEST_WORKSPACE)

    project = {
      directory: TEST_WORKSPACE,
      stateManager,
      roleManager,
      bossManager,
      messageService,
      memoryManager,
      eventLoops: new Map(),
    } as any

    sessionRegistry.clear()
  })

  afterEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("boss hires non-soul employee creates task", async () => {
    const tool = createHireEmployeeTool(
      stateManager,
      roleManager,
      project,
      bossManager
    )

    const result = await tool.execute(
      {
        name: "calc-001",
        role: "TestRole",
      },
      {
        sessionID: "boss-session",
        messageID: "msg-1",
        agent: "test-boss",
        directory: TEST_WORKSPACE,
        worktree: TEST_WORKSPACE,
        abort: new AbortController().signal,
        metadata: () => {},
        ask: async () => {},
      }
    )

    expect(result).toContain("Successfully hired employee")
    expect(result).toContain("1-calc-001")

    const employee = stateManager.getEmployee("1-calc-001" as EmployeeId)
    expect(employee).not.toBeNull()
    expect(employee?.taskId).toBe(1)
  })

  test("boss hires soul employee with taskId 0", async () => {
    const tool = createHireEmployeeTool(
      stateManager,
      roleManager,
      project,
      bossManager
    )

    const result = await tool.execute(
      {
        name: "soul-dev",
        role: "Soul Developer",
        initial_args: [
          { name: "worktree_path", value: TEST_WORKSPACE },
        ],
      },
      {
        sessionID: "boss-session",
        messageID: "msg-1",
        agent: "test-boss",
        directory: TEST_WORKSPACE,
        worktree: TEST_WORKSPACE,
        abort: new AbortController().signal,
        metadata: () => {},
        ask: async () => {},
      }
    )

    expect(result).toContain("Successfully hired employee")
    // Soul Developer has soul: false, so gets generated taskId
    expect(result).toContain("1-soul-dev")

    const employee = stateManager.getEmployee("1-soul-dev" as EmployeeId)
    expect(employee).not.toBeNull()
    expect(employee?.taskId).toBe(1)
  })

  test("employee hires soul employee inherits taskId 0", async () => {
    const tool = createHireEmployeeTool(
      stateManager,
      roleManager,
      project,
      bossManager
    )

    await tool.execute(
      {
        name: "pm-001",
        role: "Project Manager",
      },
      {
        sessionID: "boss-session",
        messageID: "msg-1",
        agent: "test-boss",
        directory: TEST_WORKSPACE,
        worktree: TEST_WORKSPACE,
        abort: new AbortController().signal,
        metadata: () => {},
        ask: async () => {},
      }
    )

    // Project Manager has soul: false, so gets taskId 1
    sessionRegistry.register("pm-session", "1-pm-001" as EmployeeId)

    const result = await tool.execute(
      {
        name: "dev-001",
        role: "General Developer",
        initial_args: [
          { name: "worktree_path", value: TEST_WORKSPACE },
        ],
      },
      {
        sessionID: "pm-session",
        messageID: "msg-2",
        agent: "pm-001",
        directory: TEST_WORKSPACE,
        worktree: TEST_WORKSPACE,
        abort: new AbortController().signal,
        metadata: () => {},
        ask: async () => {},
      }
    )

    expect(result).toContain("Successfully hired employee")

    // General Developer inherits PM's taskId (1)
    const dev = stateManager.getEmployee("1-dev-001" as EmployeeId)
    expect(dev).not.toBeNull()
    expect(dev?.taskId).toBe(1)
  })

  test("soul employee can hire another soul employee", async () => {
    const tool = createHireEmployeeTool(
      stateManager,
      roleManager,
      project,
      bossManager
    )

    await tool.execute(
      {
        name: "pm-001",
        role: "Project Manager",
      },
      {
        sessionID: "boss-session",
        messageID: "msg-1",
        agent: "test-boss",
        directory: TEST_WORKSPACE,
        worktree: TEST_WORKSPACE,
        abort: new AbortController().signal,
        metadata: () => {},
        ask: async () => {},
      }
    )

    // Project Manager has soul: false, so gets taskId 1
    sessionRegistry.register("pm-session", "1-pm-001" as EmployeeId)

    const result = await tool.execute(
      {
        name: "soul-dev",
        role: "Soul Developer",
        initial_args: [
          { name: "worktree_path", value: TEST_WORKSPACE },
        ],
      },
      {
        sessionID: "pm-session",
        messageID: "msg-2",
        agent: "pm-001",
        directory: TEST_WORKSPACE,
        worktree: TEST_WORKSPACE,
        abort: new AbortController().signal,
        metadata: () => {},
        ask: async () => {},
      }
    )

    expect(result).toContain("Successfully hired employee")
    // Soul Developer has soul: false, inherits PM's taskId (1)
    expect(result).toContain("1-soul-dev")

    const soulDev = stateManager.getEmployee("1-soul-dev" as EmployeeId)
    expect(soulDev).not.toBeNull()
    expect(soulDev?.taskId).toBe(1)
  })
})
