import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { EmployeeWorkSessionManager } from "../../src/core/EmployeeWorkSessionManager"
import { EventLoop } from "../../src/core/eventloop"
import { MemoryManager } from "../../src/core/MemoryManager"
import { MessageService } from "../../src/core/MessageService"
import { RoleManager } from "../../src/core/RoleManager"
import { BossManager } from "../../src/core/BossManager"
import { StateManager } from "../../src/state"
import {
  DEFAULT_TOOL_PERMISSIONS,
  createEditTasksTool,
  createSendMessageTool,
  createShowTasksTool,
  createTools,
} from "../../src/tools"
import type { EmployeeWorkSessionId } from "../../src/types"
import type { ProjectInstance } from "../../src/server/ProjectRegistry"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import {
  getTestProjectPaths,
  resetTestWorkspace,
} from "../helpers/testWorkspace"

const { suiteRoot, projectPath, workspaceRoot } = getTestProjectPaths(
  "ews-tools-messaging"
)

async function writeRole(
  name: string,
  canHire: string[] = [],
  requiredArgs: Record<string, any> = {}
): Promise<void> {
  const rolesDir = path.join(projectPath, ".cclover", "roles")
  await fs.mkdir(rolesDir, { recursive: true })
  const lines = [
    "---",
    `name: ${name}`,
    `id: ${name}`,
    `description: ${name} role`,
  ]
  if (canHire.length > 0) {
    lines.push("canHire:", ...canHire.map((role) => `  - ${role}`))
  } else {
    lines.push("canHire: []")
  }
  if (Object.keys(requiredArgs).length > 0) {
    lines.push("requiredArgs:")
    for (const [argName, spec] of Object.entries(requiredArgs)) {
      lines.push(
        `  ${argName}:`,
        `    type: ${spec.type}`,
        `    description: ${spec.description}`
      )
    }
  } else {
    lines.push("requiredArgs: {}")
  }
  lines.push("---", `You are ${name}.`, "")
  await fs.writeFile(
    path.join(rolesDir, `${name}.md`),
    lines.join("\n"),
    "utf-8"
  )
}

describe("Task 004 EWS tools and messaging surface", () => {
  let stateManager: StateManager
  let roleManager: RoleManager
  let memoryManager: MemoryManager
  let ewsManager: EmployeeWorkSessionManager
  let messageService: MessageService

  beforeEach(async () => {
    await resetTestWorkspace(suiteRoot)
    await fs.mkdir(projectPath, { recursive: true })

    await writeRole("manager", ["worker"], {
      worktree_path: { type: "string", description: "Worktree path" },
    })
    await writeRole("worker")

    stateManager = new StateManager("test", workspaceRoot, projectPath)
    roleManager = new RoleManager(projectPath)
    await roleManager.refresh()
    memoryManager = new MemoryManager(workspaceRoot, stateManager)
    ewsManager = new EmployeeWorkSessionManager(
      projectPath,
      stateManager,
      roleManager
    )
    messageService = new MessageService(
      workspaceRoot,
      stateManager,
      "test",
      undefined,
      undefined,
      ewsManager
    )

    await stateManager.registerEmployee({
      employeeId: "emp_manager",
      name: "manager-one",
      roleId: "manager",
      description: "Manages worker sessions",
      contextPaths: [],
      hiredBy: "boss_alice",
      createdAt: "2026-06-22T00:00:00.000Z",
      updatedAt: "2026-06-22T00:00:00.000Z",
    })
    await stateManager.registerEmployee({
      employeeId: "emp_worker",
      name: "worker-one",
      roleId: "worker",
      description: "Executes worker tasks",
      contextPaths: [],
      hiredBy: "boss_alice",
      createdAt: "2026-06-22T00:00:00.000Z",
      updatedAt: "2026-06-22T00:00:00.000Z",
    })
  })

  afterEach(async () => {
    sessionRegistry.clear()
    await fs.rm(suiteRoot, { recursive: true, force: true })
  })

  it("registers only supported EWS tools and default permissions", () => {
    const tools = createTools({
      messageService,
      memoryManager,
      opcodeClient: {} as any,
      stateManager,
      project: {
        directory: projectPath,
        stateManager,
        roleManager,
        memoryManager,
        messageService,
        employeeWorkSessionManager: ewsManager,
        eventLoops: new Map(),
      } as unknown as ProjectInstance,
    })

    expect(Object.keys(tools).sort()).toEqual([
      "close_employee_work_session",
      "create_employee_work_session",
      "edit_tasks",
      "hire_employee",
      "integrate",
      "refresh_roles",
      "send_message",
      "show_available_employees",
      "show_employee_work_sessions",
      "show_hireable_roles",
      "show_tasks",
      "update_employee",
    ])
    expect(Object.keys(tools)).not.toContain("create_" + "agent")
    expect(Object.keys(tools)).not.toContain("pause_" + "employee")
    expect(Object.keys(tools)).not.toContain("resume_" + "employee")
    expect(Object.keys(tools)).not.toContain("complete_" + "major_task")

    expect(tools.send_message.description).toContain("employee work session")
    expect(tools.send_message.args.to.description).toContain(
      "employee_work_session_id"
    )
    expect(tools.show_tasks.description).toContain(
      "current employee work session"
    )
    expect(
      Object.hasOwn(
        tools.create_employee_work_session.args,
        "parent_employee_work_session_id"
      )
    ).toBe(false)
  })

  it("create_employee_work_session starts runtime and sends initial description", async () => {
    const originalRun = EventLoop.prototype.run
    const originalStop = EventLoop.prototype.stop
    EventLoop.prototype.run = mock(async () => {}) as any
    EventLoop.prototype.stop = mock(async () => {}) as any

    try {
      const caller = await ewsManager.createEmployeeWorkSession({
        employeeId: "emp_manager",
        description: "Manage work",
        args: { worktree_path: ".worktrees/ews-taskplan" },
        createdBy: "boss_alice",
      })
      sessionRegistry.register("session-manager", caller.employeeWorkSessionId)
      const project = {
        directory: projectPath,
        stateManager,
        roleManager,
        memoryManager,
        messageService,
        employeeWorkSessionManager: ewsManager,
        eventLoops: new Map(),
        modelConfigManager: {} as any,
        opcodeClient: {} as any,
      } as unknown as ProjectInstance
      const tools = createTools({
        messageService,
        memoryManager,
        opcodeClient: {} as any,
        stateManager,
        project,
      })

      const result = await tools.create_employee_work_session.execute(
        {
          employee_id: "emp_worker",
          description: "Initial task for worker",
          args: {},
        },
        { sessionID: "session-manager" } as any
      )
      const employeeWorkSessionId = result.match(/ews_[a-f0-9]+/)?.[0] as
        | EmployeeWorkSessionId
        | undefined

      expect(employeeWorkSessionId).toBeDefined()
      const created = await ewsManager.getEmployeeWorkSession(
        employeeWorkSessionId!
      )
      expect(created?.employeeId).toBe("emp_worker")
      expect(created?.parentEmployeeWorkSessionId).toBe(
        caller.employeeWorkSessionId
      )
      expect(project.eventLoops.has(employeeWorkSessionId!)).toBe(true)
      project.eventLoops.get(employeeWorkSessionId!)?.stop()
      const history = await messageService
        .getClient(caller.employeeWorkSessionId)
        .history(employeeWorkSessionId!)
      expect(history.at(-1)?.content).toBe("Initial task for worker")
    } finally {
      EventLoop.prototype.run = originalRun
      EventLoop.prototype.stop = originalStop
    }
  })

  it("create_employee_work_session creates a root EWS when called by a boss", async () => {
    const originalRun = EventLoop.prototype.run
    const originalStop = EventLoop.prototype.stop
    EventLoop.prototype.run = mock(async () => {}) as any
    EventLoop.prototype.stop = mock(async () => {}) as any

    try {
      const bossManager = new BossManager(
        { bosses: ["alice"], projects: [] },
        workspaceRoot,
        roleManager
      )
      const project = {
        directory: projectPath,
        stateManager,
        roleManager,
        memoryManager,
        messageService,
        bossManager,
        employeeWorkSessionManager: ewsManager,
        eventLoops: new Map(),
        modelConfigManager: {} as any,
        opcodeClient: {} as any,
      } as unknown as ProjectInstance
      const tools = createTools({
        messageService,
        memoryManager,
        opcodeClient: {} as any,
        bossManager,
        stateManager,
        project,
      })

      const result = await tools.create_employee_work_session.execute(
        {
          employee_id: "emp_worker",
          description: "Root task for worker",
          args: {},
        },
        { sessionID: "session-boss", agent: "alice" } as any
      )
      const employeeWorkSessionId = result.match(/ews_[a-f0-9]+/)?.[0] as
        | EmployeeWorkSessionId
        | undefined

      expect(employeeWorkSessionId).toBeDefined()
      const created = await ewsManager.getEmployeeWorkSession(
        employeeWorkSessionId!
      )
      expect(created?.employeeId).toBe("emp_worker")
      expect(created?.parentEmployeeWorkSessionId).toBe(null)
      expect(project.eventLoops.has(employeeWorkSessionId!)).toBe(true)
      project.eventLoops.get(employeeWorkSessionId!)?.stop()
      const history = await messageService
        .getClient("boss_alice")
        .history(employeeWorkSessionId!)
      expect(history.at(-1)?.content).toBe("Root task for worker")
    } finally {
      EventLoop.prototype.run = originalRun
      EventLoop.prototype.stop = originalStop
    }
  })

  it("routes messages between EWS IDs and writes EWS-owned histories", async () => {
    const sender = await ewsManager.createEmployeeWorkSession({
      employeeId: "emp_manager",
      description: "Manage work",
      args: { worktree_path: ".worktrees/ews-taskplan" },
      createdBy: "boss_alice",
    })
    const recipient = await ewsManager.createEmployeeWorkSession({
      employeeId: "emp_worker",
      description: "Do work",
      args: {},
      createdBy: sender.employeeWorkSessionId,
    })

    sessionRegistry.register("session-manager", sender.employeeWorkSessionId)
    const tool = createSendMessageTool(messageService, undefined, stateManager)

    const result = await tool.execute(
      {
        to: recipient.employeeWorkSessionId,
        content: "status?",
        expect_reply: true,
      },
      { sessionID: "session-manager" } as any
    )

    expect(result).toBe(`Message sent to ${recipient.employeeWorkSessionId}`)
    await expect(
      fs.stat(
        path.join(
          workspaceRoot,
          "ews",
          sender.employeeWorkSessionId,
          "messages",
          recipient.employeeWorkSessionId,
          "chat.yaml"
        )
      )
    ).resolves.toBeDefined()
    await expect(
      fs.stat(
        path.join(
          workspaceRoot,
          "ews",
          recipient.employeeWorkSessionId,
          "messages",
          sender.employeeWorkSessionId,
          "chat.yaml"
        )
      )
    ).resolves.toBeDefined()
  })

  it("rejects employee IDs, role IDs, and meeting role IDs as message targets", async () => {
    const sender = await ewsManager.createEmployeeWorkSession({
      employeeId: "emp_manager",
      description: "Manage work",
      args: { worktree_path: ".worktrees/ews-taskplan" },
      createdBy: "boss_alice",
    })
    sessionRegistry.register("session-manager", sender.employeeWorkSessionId)
    const tool = createSendMessageTool(
      messageService,
      undefined,
      stateManager,
      roleManager
    )

    for (const unsupportedTarget of ["emp_worker", "worker", "boss_worker"]) {
      await expect(
        tool.execute(
          { to: unsupportedTarget, content: "invalid", expect_reply: false },
          { sessionID: "session-manager" } as any
        )
      ).rejects.toThrow("Unsupported message target")
    }
  })

  it("task tools resolve current caller to EWS memory", async () => {
    const ews = await ewsManager.createEmployeeWorkSession({
      employeeId: "emp_manager",
      description: "Manage work",
      args: { worktree_path: ".worktrees/ews-taskplan" },
      createdBy: "boss_alice",
    })
    sessionRegistry.register("session-manager", ews.employeeWorkSessionId)

    const editTasksTool = createEditTasksTool(memoryManager, stateManager)
    const showTasksTool = createShowTasksTool(memoryManager, stateManager)

    await editTasksTool.execute(
      {
        operations: [
          {
            action: "add",
            name: "ews-task",
            description: "Stored under EWS memory",
          },
        ],
      },
      { sessionID: "session-manager" } as any
    )

    const ewsMemory = await memoryManager.read(ews.employeeWorkSessionId)
    const employeeMemory = await memoryManager.read("emp_manager")
    expect(ewsMemory.tasks.map((task) => task.name)).toEqual(["ews-task"])
    expect(employeeMemory.tasks).toEqual([])
    expect(
      await showTasksTool.execute({}, { sessionID: "session-manager" })
    ).toContain("ews-task")
  })

  it("shows supervisor employee and supervisor EWS in visible surfaces", async () => {
    const supervisor = await ewsManager.createEmployeeWorkSession({
      employeeId: "emp_manager",
      description: "Supervise",
      args: { worktree_path: ".worktrees/ews-taskplan" },
      createdBy: "boss_alice",
    })
    await stateManager.registerEmployee({
      employeeId: "emp_apprentice",
      name: "apprentice-one",
      roleId: "worker",
      description: "Cannot hire manager but must see supervisor",
      contextPaths: [],
      hiredBy: supervisor.employeeWorkSessionId,
      createdAt: "2026-06-22T00:00:00.000Z",
      updatedAt: "2026-06-22T00:00:00.000Z",
    })
    const apprentice = await ewsManager.createEmployeeWorkSession({
      employeeId: "emp_apprentice",
      description: "Report upward",
      args: {},
      createdBy: supervisor.employeeWorkSessionId,
    })
    sessionRegistry.register(
      "session-apprentice",
      apprentice.employeeWorkSessionId
    )
    const tools = createTools({
      messageService,
      memoryManager,
      opcodeClient: {} as any,
      stateManager,
      project: {
        directory: projectPath,
        stateManager,
        roleManager,
        memoryManager,
        messageService,
        employeeWorkSessionManager: ewsManager,
        eventLoops: new Map(),
      } as unknown as ProjectInstance,
    })

    const employees = await tools.show_available_employees.execute({}, {
      sessionID: "session-apprentice",
    } as any)
    const sessions = await tools.show_employee_work_sessions.execute({}, {
      sessionID: "session-apprentice",
    } as any)

    expect(employees).toContain("emp_manager")
    expect(sessions).toContain(supervisor.employeeWorkSessionId)
  })

  it("shows all available employees to a configured boss", async () => {
    const bossManager = new BossManager(
      { bosses: ["alice"], projects: [] },
      workspaceRoot,
      roleManager
    )
    const tools = createTools({
      messageService,
      memoryManager,
      opcodeClient: {} as any,
      bossManager,
      stateManager,
      project: {
        directory: projectPath,
        stateManager,
        roleManager,
        memoryManager,
        messageService,
        employeeWorkSessionManager: ewsManager,
        eventLoops: new Map(),
      } as unknown as ProjectInstance,
    })

    const employees = await tools.show_available_employees.execute({}, {
      sessionID: "session-boss",
      agent: "alice",
    } as any)

    expect(employees).toContain("emp_manager")
    expect(employees).toContain("emp_worker")
  })
})
