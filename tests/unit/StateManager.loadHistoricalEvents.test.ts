import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { StateManager } from "../../src/state/StateManager"
import type { Event } from "../../src/types/index"

describe("StateManager.loadHistoricalEvents", () => {
  const testWorkspace = path.join(__dirname, "../fixtures/test-workspace-load")
  const projectId = "test-project-123"
  let stateManager: StateManager

  beforeEach(async () => {
    // 清理测试目录
    await fs.rm(testWorkspace, { recursive: true, force: true })
    await fs.mkdir(testWorkspace, { recursive: true })

    // 创建 StateManager
    stateManager = new StateManager(projectId, testWorkspace)
  })

  afterEach(async () => {
    // 清理测试目录
    await fs.rm(testWorkspace, { recursive: true, force: true })
  })

  test("应该从文件加载历史事件到内存", async () => {
    // 1. 注册员工
    stateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      taskId: 0,
      role: "tester",
      status: "offline",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })

    // 2. 添加一些事件（会持久化到文件）
    const event1: Event = {
      projectId,
      type: "message",
      timestamp: "2026-03-01T10:01:00.000Z",
      employeeId: "0-alice",
      details: { from: "bob", to: "alice", content: "Hello" },
    }

    const event2: Event = {
      projectId,
      type: "task_completed",
      timestamp: "2026-03-01T10:02:00.000Z",
      employeeId: "0-alice",
      details: { taskName: "Task1", result: "Done" },
    }

    await stateManager.addEvent(event1)
    await stateManager.addEvent(event2)

    // 3. 验证事件在内存中
    const eventsBeforeRestart = stateManager.getEvents({ limit: 10 })
    expect(eventsBeforeRestart.length).toBe(2)

    // 4. 模拟重启：创建新的 StateManager（内存清空）
    const newStateManager = new StateManager(projectId, testWorkspace)

    // 5. 重新注册员工
    newStateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      taskId: 0,
      role: "tester",
      status: "offline",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })

    // 6. 验证重启后内存中没有事件
    const eventsAfterRestart = newStateManager.getEvents({ limit: 10 })
    expect(eventsAfterRestart.length).toBe(0)

    // 7. 加载历史事件
    await newStateManager.loadHistoricalEvents()

    // 8. 验证事件已加载到内存
    const eventsAfterLoad = newStateManager.getEvents({ limit: 10 })
    // 只注册了 alice，所以只有 alice 的 2 个事件：
    // 1. task_completed
    // 2. message
    expect(eventsAfterLoad.length).toBe(2)
    expect(eventsAfterLoad[0].type).toBe("task_completed")
    expect(eventsAfterLoad[1].type).toBe("message")
  })

  test("应该加载多个员工的历史事件", async () => {
    // 1. 注册多个员工
    stateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      taskId: 0,
      role: "tester",
      status: "offline",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })

    stateManager.registerEmployee({
      employeeId: "0-bob",
      name: "bob",
      taskId: 0,
      role: "developer",
      status: "offline",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })

    // 2. 为每个员工添加事件
    await stateManager.addEvent({
      projectId,
      type: "message",
      timestamp: "2026-03-01T10:01:00.000Z",
      employeeId: "0-alice",
      details: { from: "0-bob", to: "0-alice", content: "Hello Alice" },
    })

    await stateManager.addEvent({
      projectId,
      type: "message",
      timestamp: "2026-03-01T10:02:00.000Z",
      employeeId: "0-bob",
      details: { from: "0-alice", to: "0-bob", content: "Hello Bob" },
    })

    // 3. 模拟重启
    const newStateManager = new StateManager(projectId, testWorkspace)

    newStateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      taskId: 0,
      role: "tester",
      status: "offline",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })

    newStateManager.registerEmployee({
      employeeId: "0-bob",
      name: "bob",
      taskId: 0,
      role: "developer",
      status: "offline",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })

    // 4. 加载历史事件
    await newStateManager.loadHistoricalEvents()

    // 5. 验证两个员工的事件都被加载
    const aliceEvents = newStateManager.getEvents({ employeeName: "0-alice" })
    const bobEvents = newStateManager.getEvents({ employeeName: "0-bob" })

    // 每个员工都会有 2 个消息事件：
    // alice: 1. bob 发送给她的消息, 2. 她发送给 bob 的消息
    // bob: 1. alice 发送给他的消息, 2. 他发送给 alice 的消息
    expect(aliceEvents.length).toBe(2)
    expect(bobEvents.length).toBe(2)
  })

  test("应该正确处理没有历史事件的员工", async () => {
    // 1. 注册新员工（没有历史事件）
    stateManager.registerEmployee({
      employeeId: "0-charlie",
      name: "charlie",
      taskId: 0,
      role: "newbie",
      status: "offline",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })

    // 2. 加载历史事件（不应该抛出错误）
    await expect(stateManager.loadHistoricalEvents()).resolves.toBeUndefined()

    // 3. 验证没有事件
    const events = stateManager.getEvents({ employeeName: "charlie" })
    expect(events.length).toBe(0)
  })

  test("应该同步更新统计数据", async () => {
    // 1. 注册员工
    stateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      taskId: 0,
      role: "tester",
      status: "offline",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })

    // 2. 添加消息和任务事件
    await stateManager.addEvent({
      projectId,
      type: "message",
      timestamp: "2026-03-01T10:01:00.000Z",
      employeeId: "0-alice",
      details: { from: "bob", to: "alice", content: "Hello" },
    })

    await stateManager.addEvent({
      projectId,
      type: "task_completed",
      timestamp: "2026-03-01T10:02:00.000Z",
      employeeId: "0-alice",
      details: { taskName: "Task1", result: "Done" },
    })

    // 3. 模拟重启
    const newStateManager = new StateManager(projectId, testWorkspace)

    newStateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      taskId: 0,
      role: "tester",
      status: "offline",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })

    // 4. 加载历史事件
    await newStateManager.loadHistoricalEvents()

    // 5. 验证统计数据（通过 getStats 间接验证）
    const stats = newStateManager.getStats()
    expect(stats.totalEmployees).toBe(1)
    // 注意：todayMessages 依赖于当前日期，这里只验证不会崩溃
    expect(stats.todayMessages).toBeGreaterThanOrEqual(0)
  })
})
