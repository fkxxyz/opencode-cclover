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

describe.skip("Hiring Flow Integration", () => {
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

  test("boss hires employee with stable identity", async () => {
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
    expect(result).toContain("emp_")

    const employee = stateManager
      .getEmployees()
      .find((candidate) => candidate.name === "calc-001")
    expect(employee).not.toBeNull()
    expect(employee?.employeeId).toMatch(/^emp_[0-9a-f]{32}$/)
    expect("taskId" in employee!).toBe(false)
  })

  test("boss hires soul employee with stable identity", async () => {
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
        initial_args: [{ name: "worktree_path", value: TEST_WORKSPACE }],
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
    expect(result).toContain("emp_")

    const employee = stateManager
      .getEmployees()
      .find((candidate) => candidate.name === "soul-dev")
    expect(employee).not.toBeNull()
    expect(employee?.employeeId).toMatch(/^emp_[0-9a-f]{32}$/)
    expect("taskId" in employee!).toBe(false)
  })

  test("employee hires soul employee without inheriting taskId", async () => {
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

    const pm = stateManager
      .getEmployees()
      .find((candidate) => candidate.name === "pm-001")
    expect(pm).toBeDefined()
    sessionRegistry.register("pm-session", pm!.employeeId as EmployeeId)

    const result = await tool.execute(
      {
        name: "dev-001",
        role: "General Developer",
        initial_args: [{ name: "worktree_path", value: TEST_WORKSPACE }],
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

    const dev = stateManager
      .getEmployees()
      .find((candidate) => candidate.name === "dev-001")
    expect(dev).not.toBeNull()
    expect(dev?.employeeId).toMatch(/^emp_[0-9a-f]{32}$/)
    expect("taskId" in dev!).toBe(false)
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

    const pm = stateManager
      .getEmployees()
      .find((candidate) => candidate.name === "pm-001")
    expect(pm).toBeDefined()
    sessionRegistry.register("pm-session", pm!.employeeId as EmployeeId)

    const result = await tool.execute(
      {
        name: "soul-dev",
        role: "Soul Developer",
        initial_args: [{ name: "worktree_path", value: TEST_WORKSPACE }],
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
    expect(result).toContain("emp_")

    const soulDev = stateManager
      .getEmployees()
      .find((candidate) => candidate.name === "soul-dev")
    expect(soulDev).not.toBeNull()
    expect(soulDev?.employeeId).toMatch(/^emp_[0-9a-f]{32}$/)
    expect("taskId" in soulDev!).toBe(false)
  })
})
