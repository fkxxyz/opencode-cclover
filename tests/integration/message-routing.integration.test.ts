/**
 * Message Routing Integration Tests
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { StateManager } from "../../src/state/StateManager"
import { MessageService } from "../../src/core/MessageService"
import { BossManager } from "../../src/core/BossManager"
import type { EmployeeId } from "../../src/types/employee"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../.test-workspace-message-routing"
)

describe("Message Routing Integration", () => {
  let stateManager: StateManager
  let messageService: MessageService
  let bossManager: BossManager

  beforeEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    stateManager = new StateManager("test-project", TEST_WORKSPACE)
    bossManager = new BossManager({ bosses: ["test-boss"], projects: [] })
    messageService = new MessageService(TEST_WORKSPACE, stateManager)
  })

  afterEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("same-task employees use short names", async () => {
    // Register two employees in same task
    await stateManager.registerEmployee({
      employeeId: "1-dev-001" as EmployeeId,
      name: "dev-001",
      taskId: 1,
      role: "General Developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    await stateManager.registerEmployee({
      employeeId: "1-dev-002" as EmployeeId,
      name: "dev-002",
      taskId: 1,
      role: "General Developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    // Send message using short name
    await messageService.send(
      "1-dev-001" as EmployeeId,
      "dev-002",
      "Hello from dev-001"
    )

    // Verify message received
    const dev002Client = messageService.getClient("1-dev-002" as EmployeeId)
    const messages = await dev002Client.history("1-dev-001" as EmployeeId)

    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe("Hello from dev-001")
    expect(messages[0].from).toBe("1-dev-001")
  })

  test("cross-task employees use full employeeIds", async () => {
    // Register employees in different tasks
    await stateManager.registerEmployee({
      employeeId: "1-dev-001" as EmployeeId,
      name: "dev-001",
      taskId: 1,
      role: "General Developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    await stateManager.registerEmployee({
      employeeId: "2-dev-001" as EmployeeId,
      name: "dev-001",
      taskId: 2,
      role: "General Developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    // Send message using full employeeId
    await messageService.send(
      "1-dev-001" as EmployeeId,
      "2-dev-001",
      "Hello from task 1"
    )

    // Verify message received
    const dev2Client = messageService.getClient("2-dev-001" as EmployeeId)
    const messages = await dev2Client.history("1-dev-001" as EmployeeId)

    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe("Hello from task 1")
    expect(messages[0].from).toBe("1-dev-001")
  })

  test("boss messages task employees", async () => {
    // Register boss and employee
    await stateManager.registerEmployee({
      employeeId: "1-dev-001" as EmployeeId,
      name: "dev-001",
      taskId: 1,
      role: "General Developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    // Boss sends message
    await messageService.send(
      "0-test-boss" as EmployeeId,
      "1-dev-001",
      "Task assignment from boss"
    )

    // Verify message received
    const devClient = messageService.getClient("1-dev-001" as EmployeeId)
    const messages = await devClient.history("0-test-boss" as EmployeeId)

    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe("Task assignment from boss")
    expect(messages[0].from).toBe("0-test-boss")
  })

  test("name conflict handling across tasks", async () => {
    // Register two employees with same name in different tasks
    await stateManager.registerEmployee({
      employeeId: "1-dev-001" as EmployeeId,
      name: "dev-001",
      taskId: 1,
      role: "General Developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    await stateManager.registerEmployee({
      employeeId: "2-dev-001" as EmployeeId,
      name: "dev-001",
      taskId: 2,
      role: "General Developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    // Both employees exist with same name but different employeeIds
    const emp1 = stateManager.getEmployee("1-dev-001" as EmployeeId)
    const emp2 = stateManager.getEmployee("2-dev-001" as EmployeeId)

    expect(emp1?.name).toBe("dev-001")
    expect(emp2?.name).toBe("dev-001")
    expect(emp1?.employeeId).not.toBe(emp2?.employeeId)
  })
})
