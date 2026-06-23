import { describe, expect, it, mock } from "bun:test"
import { EventLoop } from "../../src/core/eventloop"
import type { MessageClient } from "../../src/core/MessageService"
import type { MemoryManager } from "../../src/core/MemoryManager"
import type { RoleManager } from "../../src/core/RoleManager"
import type { EmployeeWorkSessionManager } from "../../src/core/EmployeeWorkSessionManager"
import type { EmployeeWorkSessionId } from "../../src/types"

function createMessageClient(): MessageClient {
  return {
    send: mock(async () => {}),
    recv: mock(async () => new Promise(() => {})),
    history: mock(async () => []),
    service: {
      getUnreadQueue: mock(() => []),
      hasPendingUrgentInterruption: mock(() => false),
      clearPendingUrgentInterruption: mock(() => {}),
    },
  } as any
}

function createMemoryManager(): MemoryManager {
  const memories = new Map<string, any>()
  return {
    read: mock(
      async (id: string) =>
        memories.get(id) ?? { knowledge: [], tasks: [], args: {} }
    ),
    write: mock(async (id: string, memory: any) => {
      memories.set(id, memory)
    }),
    getExecutableTasks: mock(async () => []),
    getInProgressTasks: mock(async () => []),
  } as any
}

function createRoleManager(): RoleManager {
  return {
    getRole: mock(() => ({
      name: "developer",
      systemPrompt: "You are a developer.",
    })),
  } as any
}

function createOpencodeClient(sessionId: string): any {
  return {
    session: {
      create: mock(async () => ({ data: { id: sessionId } })),
      get: mock(async () => ({ data: { id: sessionId } })),
      messages: mock(async () => ({
        data: [
          {
            info: { role: "assistant", tokens: { total: 1 } },
            parts: [{ type: "text", text: "ok" }],
          },
        ],
      })),
      prompt: mock(async () => ({
        data: { info: { role: "assistant", time: { completed: Date.now() } } },
      })),
    },
  }
}

function createEmployeeWorkSessionManager(): EmployeeWorkSessionManager {
  return {
    updateStatus: mock(async () => {}),
    updateOpenCodeSessionId: mock(async () => {}),
    setPromptRecovery: mock(async () => {}),
    clearPromptRecovery: mock(async () => {}),
    getEmployeeWorkSession: mock(async () => ({
      employeeWorkSessionId: "ews_runtime",
      employeeId: "emp_worker",
      opencodeSessionId: null,
      description: "runtime task",
      args: {},
      contextPathsSnapshot: [],
      worktreeRef: null,
      status: "idle",
      closedAt: null,
      closedBy: null,
      closeReason: null,
      createdAt: "2026-06-22T00:00:00.000Z",
      updatedAt: "2026-06-22T00:00:00.000Z",
    })),
  } as any
}

describe("EWS runtime lifecycle", () => {
  it("keeps same-employee parallel EventLoops separated by EWS key", () => {
    const eventLoops = new Map<EmployeeWorkSessionId, EventLoop>()
    const roleManager = createRoleManager()
    const memoryManager = createMemoryManager()
    const modelConfigManager = { resolve: mock(() => null) }

    const first = new EventLoop(
      "/project",
      "ews_first",
      "emp_same",
      "developer",
      roleManager,
      createMessageClient(),
      memoryManager,
      createOpencodeClient("session-1"),
      modelConfigManager,
      createEmployeeWorkSessionManager()
    )
    const second = new EventLoop(
      "/project",
      "ews_second",
      "emp_same",
      "developer",
      roleManager,
      createMessageClient(),
      memoryManager,
      createOpencodeClient("session-2"),
      modelConfigManager,
      createEmployeeWorkSessionManager()
    )

    eventLoops.set("ews_first", first)
    eventLoops.set("ews_second", second)

    expect(eventLoops.get("ews_first")).toBe(first)
    expect(eventLoops.get("ews_second")).toBe(second)
    expect(eventLoops.size).toBe(2)
  })

  it("writes status and prompt recovery through EmployeeWorkSessionManager", async () => {
    const ewsManager = createEmployeeWorkSessionManager()
    const eventLoop = new EventLoop(
      "/project",
      "ews_runtime",
      "emp_worker",
      "developer",
      createRoleManager(),
      createMessageClient(),
      createMemoryManager(),
      createOpencodeClient("session-runtime"),
      { resolve: mock(() => null) },
      ewsManager,
      {
        getEmployee: mock(() => ({
          employeeId: "emp_worker",
          name: "worker",
          roleId: "developer",
          description: "worker",
          contextPaths: [],
          hiredBy: null,
          createdAt: "2026-06-22T00:00:00.000Z",
          updatedAt: "2026-06-22T00:00:00.000Z",
        })),
        addEvent: mock(async () => {}),
      } as any
    )

    await (eventLoop as any).handleEvent({
      projectId: "project",
      type: "task_available",
      timestamp: "2026-06-22T00:00:00.000Z",
      details: { tasks: [] },
    })

    expect(ewsManager.setPromptRecovery).toHaveBeenCalledWith("ews_runtime", {
      version: 1,
      sessionId: "session-runtime",
      startedAt: expect.any(String),
      triggerEventType: "task_available",
    })
    expect(ewsManager.clearPromptRecovery).toHaveBeenCalledWith("ews_runtime")
  })
})
