import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MemoryManager } from "../../src/core/MemoryManager"
import { StateManager } from "../../src/state/StateManager"
import { createShowTasksTool } from "../../src/tools/ShowTasksTool"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../fixtures/show-tasks-tool-test"
)

describe("ShowTasksTool", () => {
  let memoryManager: MemoryManager
  let stateManager: StateManager
  let showTasksTool: any

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建 StateManager 并注册测试员工
    stateManager = new StateManager(
      "test-project",
      TEST_WORKSPACE,
      TEST_WORKSPACE
    )
    await stateManager.registerEmployee({
      employeeId: "0-alice",
      taskId: 0,
      name: "alice",
      role: "test",
      status: "offline",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "boss1",
    })

    // 创建 MemoryManager
    memoryManager = new MemoryManager(TEST_WORKSPACE, stateManager)

    // 初始化员工记忆
    await memoryManager.write("0-alice", {
      knowledge: [],
      tasks: [],
      args: {},
    })

    // 创建 ShowTasksTool
    showTasksTool = createShowTasksTool(memoryManager, stateManager)

    // 注册 session
    sessionRegistry.register("test-session-alice", "0-alice")
  })

  afterEach(async () => {
    // 清理
    sessionRegistry.unregister("test-session-alice")
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("should return message when no tasks exist", async () => {
    const context = {
      sessionID: "test-session-alice",
    }

    const result = await showTasksTool.execute({}, context)

    expect(result).toBe("Currently no tasks")
  })

  test("should display task dependency graph", async () => {
    // 添加一些任务
    await memoryManager.addTask("0-alice", {
      name: "Task A",
      status: "pending",
      description: "First task",
      dependencies: [],
    })
    await memoryManager.addTask("0-alice", {
      name: "Task B",
      status: "pending",
      description: "Second task",
      dependencies: ["Task A"],
    })

    const context = {
      sessionID: "test-session-alice",
    }

    const result = await showTasksTool.execute({}, context)

    // 验证包含三个部分
    expect(result).toContain("## Task Dependency Graph")
    expect(result).toContain("## Executable Tasks")
    expect(result).toContain("The following tasks can be started:")
  })

  test("should list executable tasks correctly", async () => {
    // 添加任务：Task A 可执行，Task B 依赖 Task A
    await memoryManager.addTask("0-alice", {
      name: "Task A",
      status: "pending",
      description: "First task",
      dependencies: [],
    })
    await memoryManager.addTask("0-alice", {
      name: "Task B",
      status: "pending",
      description: "Second task",
      dependencies: ["Task A"],
    })

    const context = {
      sessionID: "test-session-alice",
    }

    const result = await showTasksTool.execute({}, context)

    // 验证可执行任务列表
    expect(result).toContain("The following tasks can be started:")
    expect(result).toContain("- Task A")
    expect(result).not.toContain("- Task B") // Task B 依赖 Task A，不可执行
  })

  test("should show message when no executable tasks", async () => {
    // 添加一个正在进行的任务
    await memoryManager.addTask("0-alice", {
      name: "Task A",
      status: "in_progress",
      description: "First task",
      dependencies: [],
    })
    // 添加一个依赖 Task A 的任务
    await memoryManager.addTask("0-alice", {
      name: "Task B",
      status: "pending",
      description: "Second task",
      dependencies: ["Task A"],
    })

    const context = {
      sessionID: "test-session-alice",
    }

    const result = await showTasksTool.execute({}, context)

    // 验证无可执行任务的消息
    expect(result).toContain(
      "Currently no tasks are immediately executable (all pending tasks have incomplete dependencies)."
    )
  })

  test("should display tasks in progress", async () => {
    // 添加正在进行的任务
    await memoryManager.addTask("0-alice", {
      name: "Task A",
      status: "in_progress",
      description: "First task",
      dependencies: [],
    })
    await memoryManager.addTask("0-alice", {
      name: "Task B",
      status: "in_progress",
      description: "Second task",
      dependencies: [],
    })
    await memoryManager.addTask("0-alice", {
      name: "Task C",
      status: "pending",
      description: "Third task",
      dependencies: [],
    })

    const context = {
      sessionID: "test-session-alice",
    }

    const result = await showTasksTool.execute({}, context)

    // 验证正在进行的任务部分
    expect(result).toContain("## Tasks In Progress")
    expect(result).toContain(
      "You currently have 2 tasks in progress: Task A, Task B"
    )
    expect(result).toContain(
      "Please continue working on these tasks. If a task depends on external messages to proceed, please set the task status to waiting_for_message."
    )
  })

  test("should not display tasks in progress section when none exist", async () => {
    // 只添加 pending 任务
    await memoryManager.addTask("0-alice", {
      name: "Task A",
      status: "pending",
      description: "First task",
      dependencies: [],
    })

    const context = {
      sessionID: "test-session-alice",
    }

    const result = await showTasksTool.execute({}, context)

    // 验证不包含正在进行的任务部分
    expect(result).not.toContain("## Tasks In Progress")
  })

  test("should handle unrecognized session", async () => {
    const context = {
      sessionID: "unknown-session",
    }

    const result = await showTasksTool.execute({}, context)

    expect(result).toContain("Error: Unable to identify caller")
  })

  test("should display complete output format", async () => {
    // 创建完整的任务场景
    await memoryManager.addTask("0-alice", {
      name: "Setup",
      status: "completed",
      description: "Setup environment",
      dependencies: [],
    })
    await memoryManager.addTask("0-alice", {
      name: "Development",
      status: "in_progress",
      description: "Write code",
      dependencies: ["Setup"],
    })
    await memoryManager.addTask("0-alice", {
      name: "Testing",
      status: "pending",
      description: "Run tests",
      dependencies: ["Development"],
    })
    await memoryManager.addTask("0-alice", {
      name: "Documentation",
      status: "pending",
      description: "Write docs",
      dependencies: [],
    })

    const context = {
      sessionID: "test-session-alice",
    }

    const result = await showTasksTool.execute({}, context)

    // 验证完整输出格式
    expect(result).toContain("## Task Dependency Graph")
    expect(result).toContain("## Executable Tasks")
    expect(result).toContain("## Tasks In Progress")
    expect(result).toContain("- Documentation") // 可执行任务
    expect(result).toContain(
      "You currently have 1 tasks in progress: Development"
    )
  })
})
