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
    messageService = new MessageService(
      TEST_WORKSPACE,
      stateManager,
      "test-project",
      bossManager
    )
  })

  afterEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("globally unique employee names route without taskId expansion", async () => {
    await stateManager.registerEmployee({
      employeeId: "emp_dev_001" as EmployeeId,
      name: "dev-001",
      roleId: "general-developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    await stateManager.registerEmployee({
      employeeId: "emp_dev_002" as EmployeeId,
      name: "dev-002",
      roleId: "general-developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    // Send message using short name
    await messageService.send(
      "emp_dev_001" as EmployeeId,
      "dev-002",
      "Hello from dev-001"
    )

    const dev002Client = messageService.getClient("emp_dev_002" as EmployeeId)
    const messages = await dev002Client.history("emp_dev_001" as EmployeeId)

    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe("Hello from dev-001")
    expect(messages[0].from).toBe("emp_dev_001")
  })

  test("stable employeeIds route across former task boundaries", async () => {
    await stateManager.registerEmployee({
      employeeId: "emp_dev_001" as EmployeeId,
      name: "dev-001",
      roleId: "general-developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    await stateManager.registerEmployee({
      employeeId: "emp_dev_003" as EmployeeId,
      name: "dev-001",
      roleId: "general-developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    await messageService.send(
      "emp_dev_001" as EmployeeId,
      "emp_dev_003",
      "Hello from task 1"
    )

    const dev2Client = messageService.getClient("emp_dev_003" as EmployeeId)
    const messages = await dev2Client.history("emp_dev_001" as EmployeeId)

    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe("Hello from task 1")
    expect(messages[0].from).toBe("emp_dev_001")
  })

  test("boss messages task employees", async () => {
    // Register boss and employee
    await stateManager.registerEmployee({
      employeeId: "emp_dev_001" as EmployeeId,
      name: "dev-001",
      roleId: "general-developer",
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
      "emp_dev_001",
      "Task assignment from boss"
    )

    // Verify message received
    const devClient = messageService.getClient("emp_dev_001" as EmployeeId)
    const messages = await devClient.history("0-test-boss" as EmployeeId)

    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe("Task assignment from boss")
    expect(messages[0].from).toBe("0-test-boss")
  })

  test("duplicate employee names are rejected for routing", async () => {
    await stateManager.registerEmployee({
      employeeId: "emp_dev_001" as EmployeeId,
      name: "dev-001",
      roleId: "general-developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    await stateManager.registerEmployee({
      employeeId: "emp_dev_003" as EmployeeId,
      name: "dev-001",
      roleId: "general-developer",
      status: "offline",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-test-boss" as EmployeeId,
      activeSessionId: null,
    })

    await expect(
      messageService.send(
        "0-test-boss" as EmployeeId,
        "dev-001",
        "Ambiguous task assignment"
      )
    ).rejects.toThrow("收件人名称 'dev-001' 不唯一，请使用稳定 employeeId")
  })

  test("unknown short names are rejected", async () => {
    await expect(
      messageService.send(
        "0-test-boss" as EmployeeId,
        "missing-dev",
        "Unknown short name"
      )
    ).rejects.toThrow("Boss cannot use unknown short names")
  })
})
