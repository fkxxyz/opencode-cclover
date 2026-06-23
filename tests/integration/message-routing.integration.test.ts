/**
 * Message Routing Integration Tests
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { StateManager } from "../../src/state/StateManager"
import { MessageService } from "../../src/core/MessageService"
import { BossManager } from "../../src/core/BossManager"
import { createTestEmployee } from "../helpers/employeeFactory"
import type { BossId, EmployeeWorkSessionId } from "../../src/types/employee"

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

  test("stable employee work session ids route without taskId expansion", async () => {
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_dev_001",
        name: "dev-001",
        roleId: "general-developer",
        hiredBy: "boss_test-boss" as BossId,
      })
    )
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_dev_002",
        name: "dev-002",
        roleId: "general-developer",
        hiredBy: "boss_test-boss" as BossId,
      })
    )

    // Send message using EWS ID
    await messageService.send(
      "ews_dev_001" as EmployeeWorkSessionId,
      "ews_dev_002",
      "Hello from dev-001"
    )

    const dev002Client = messageService.getClient(
      "ews_dev_002" as EmployeeWorkSessionId
    )
    const messages = await dev002Client.history(
      "ews_dev_001" as EmployeeWorkSessionId
    )

    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe("Hello from dev-001")
    expect(messages[0].from).toBe("ews_dev_001")
  })

  test("stable employeeIds route across former task boundaries", async () => {
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_dev_001",
        name: "dev-001",
        roleId: "general-developer",
        hiredBy: "boss_test-boss" as BossId,
      })
    )
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_dev_003",
        name: "dev-001",
        roleId: "general-developer",
        hiredBy: "boss_test-boss" as BossId,
      })
    )

    await messageService.send(
      "ews_dev_001" as EmployeeWorkSessionId,
      "ews_dev_003",
      "Hello from task 1"
    )

    const dev2Client = messageService.getClient(
      "ews_dev_003" as EmployeeWorkSessionId
    )
    const messages = await dev2Client.history(
      "ews_dev_001" as EmployeeWorkSessionId
    )

    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe("Hello from task 1")
    expect(messages[0].from).toBe("ews_dev_001")
  })

  test("boss messages task employees", async () => {
    // Register boss and employee
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_dev_001",
        name: "dev-001",
        roleId: "general-developer",
        hiredBy: "boss_test-boss" as BossId,
      })
    )

    // Boss sends message
    await messageService.send(
      "boss_test-boss" as BossId,
      "ews_dev_001",
      "Task assignment from boss"
    )

    // Verify message received
    const devClient = messageService.getClient(
      "ews_dev_001" as EmployeeWorkSessionId
    )
    const messages = await devClient.history("boss_test-boss" as BossId)

    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe("Task assignment from boss")
    expect(messages[0].from).toBe("boss_test-boss")
  })

  test("unknown short names are rejected", async () => {
    await expect(
      messageService.send(
        "boss_test-boss" as BossId,
        "missing-dev",
        "Unknown short name"
      )
    ).rejects.toThrow(
      "Unsupported message target 'missing-dev'. Use employee_work_session_id or boss_id."
    )
  })
})
