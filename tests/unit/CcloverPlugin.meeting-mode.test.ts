import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { RoleManager } from "../../src/core/RoleManager"
import { MeetingModePromptInjector } from "../../src/meeting-mode/PromptInjector"

describe("CcloverPlugin Meeting Mode config hook", () => {
  let tempDir: string
  let originalEnable: string | undefined

  beforeEach(async () => {
    originalEnable = process.env.CCLOVER_ENABLE
    process.env.CCLOVER_ENABLE = "1"
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meeting-mode-plugin-"))

    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })
    await fs.writeFile(
      path.join(projectRolesDir, "Calculator.md"),
      `---
name: Calculator
description: Project calculator role
---

Project calculator role prompt`
    )
  })

  afterEach(async () => {
    if (originalEnable === undefined) {
      delete process.env.CCLOVER_ENABLE
    } else {
      process.env.CCLOVER_ENABLE = originalEnable
    }

    await fs.rm(tempDir, { recursive: true, force: true })
    mock.restore()
  })

  test("config hook registers resolved roles as placeholder primary agents with original names", async () => {
    const roleManager = new RoleManager(tempDir)
    await roleManager.refresh()
    const promptInjector = new MeetingModePromptInjector(
      "test-project",
      "test-project"
    )

    mock.module("../../src/server/GlobalServer", () => ({
      GlobalCcloverService: {
        setOpencodeClient: mock(() => {}),
        getInstance: mock(async () => ({
          getProject: mock(() => ({
            projectName: "test-project",
            directory: tempDir,
            messageService: {},
            memoryManager: {},
            stateManager: {},
            projectId: "test-project",
            roleManager,
            meetingModePromptInjector: promptInjector,
          })),
          getBossManager: mock(() => undefined),
          startEmployees: mock(async () => {}),
        })),
      },
    }))

    mock.module("../../src/config/CandidateProjectsManager", () => ({
      CandidateProjectsManager: {
        addCandidate: mock(async () => {}),
      },
    }))

    const { CcloverPlugin } = await import("../../src/index")

    const plugin = await CcloverPlugin({
      directory: tempDir,
      client: {},
    } as any)

    const config: Record<string, any> = { agent: {} }
    expect(plugin.config).toBeDefined()
    await plugin.config!(config)

    expect(config.agent.Calculator).toBeDefined()
    expect(config.agent.Calculator.mode).toBe("primary")
    expect(config.agent.Calculator.description).toBe("Project calculator role")
    expect(config.agent.Calculator.prompt).toContain(
      "Meeting mode prompt is injected dynamically"
    )
  })

  test("plugin exposes meeting-mode hooks and unshifts injected prompt for mapped session", async () => {
    const roleManager = new RoleManager(tempDir)
    await roleManager.refresh()
    const promptInjector = new MeetingModePromptInjector(
      "test-project",
      "test-project"
    )

    mock.module("../../src/server/GlobalServer", () => ({
      GlobalCcloverService: {
        setOpencodeClient: mock(() => {}),
        getInstance: mock(async () => ({
          getProject: mock(() => ({
            projectName: "test-project",
            directory: tempDir,
            messageService: {},
            memoryManager: {},
            stateManager: {},
            projectId: "test-project",
            roleManager,
            meetingModePromptInjector: promptInjector,
          })),
          getBossManager: mock(() => undefined),
          startEmployees: mock(async () => {}),
        })),
      },
    }))

    mock.module("../../src/config/CandidateProjectsManager", () => ({
      CandidateProjectsManager: {
        addCandidate: mock(async () => {}),
      },
    }))

    const { CcloverPlugin } = await import("../../src/index")

    const plugin = await CcloverPlugin({
      directory: tempDir,
      client: {},
    } as any)

    expect(plugin["chat.params"]).toBeDefined()
    expect(plugin["chat.message"]).toBeDefined()
    expect(plugin["experimental.chat.system.transform"]).toBeDefined()

    await plugin["chat.params"]!(
      {
        sessionID: "meeting-session-1",
        agent: "Calculator",
        model: { id: "test", name: "test" } as any,
        provider: { source: "env", info: {} as any, options: {} },
        message: { role: "user", content: "hello" } as any,
      },
      { temperature: 0, topP: 0, topK: 0, options: {} }
    )

    const output = { system: ["existing system prompt"] }
    await plugin["experimental.chat.system.transform"]!(
      {
        sessionID: "meeting-session-1",
        model: { id: "test", name: "test" } as any,
      },
      output
    )

    expect(output.system[0]).toContain("Project calculator role prompt")
    expect(output.system[0]).toContain(
      "This is a direct working meeting with the boss"
    )
    expect(output.system[1]).toBe("existing system prompt")
  })

  test("meeting-mode roles with contextIds inject contexts into dynamic system prompt", async () => {
    // 创建带有 contextIds 的角色
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.writeFile(
      path.join(projectRolesDir, "ContextRole.md"),
      `---
name: ContextRole
description: Role with context
contextIds:
  - test-context
---

Role with context prompt`
    )

    // 创建 context.yml 文件
    await fs.writeFile(
      path.join(tempDir, ".cclover/context.yml"),
      `contexts:
  test-context:
    description: Test context description
    documents:
      - .cclover/test-doc.md`
    )

    // 创建 context 文档
    await fs.writeFile(
      path.join(tempDir, ".cclover/test-doc.md"),
      "Test context document content"
    )

    const roleManager = new RoleManager(tempDir)
    await roleManager.refresh()
    const promptInjector = new MeetingModePromptInjector(
      "test-project",
      "test-project"
    )

    mock.module("../../src/server/GlobalServer", () => ({
      GlobalCcloverService: {
        setOpencodeClient: mock(() => {}),
        getInstance: mock(async () => ({
          getProject: mock(() => ({
            projectName: "test-project",
            directory: tempDir,
            messageService: {},
            memoryManager: {},
            stateManager: {},
            projectId: "test-project",
            roleManager,
            meetingModePromptInjector: promptInjector,
          })),
          getBossManager: mock(() => undefined),
          startEmployees: mock(async () => {}),
        })),
      },
    }))

    mock.module("../../src/config/CandidateProjectsManager", () => ({
      CandidateProjectsManager: {
        addCandidate: mock(async () => {}),
      },
    }))

    const { CcloverPlugin } = await import("../../src/index")

    const plugin = await CcloverPlugin({
      directory: tempDir,
      client: {},
    } as any)

    const config: Record<string, any> = { agent: {} }
    expect(plugin.config).toBeDefined()
    await plugin.config!(config)

    // 验证 ContextRole 存在
    expect(config.agent.ContextRole).toBeDefined()
    expect(config.agent.ContextRole.mode).toBe("primary")
    expect(config.agent.ContextRole.prompt).toContain(
      "Meeting mode prompt is injected dynamically"
    )

    await plugin["chat.params"]!(
      {
        sessionID: "meeting-session-context",
        agent: "ContextRole",
        model: { id: "test", name: "test" } as any,
        provider: { source: "env", info: {} as any, options: {} },
        message: { role: "user", content: "hello" } as any,
      },
      { temperature: 0, topP: 0, topK: 0, options: {} }
    )

    const output = { system: [] as string[] }
    await plugin["experimental.chat.system.transform"]!(
      {
        sessionID: "meeting-session-context",
        model: { id: "test", name: "test" } as any,
      },
      output
    )

    expect(output.system[0]).toContain("Role with context prompt")

    // 验证 prompt 包含上下文内容
    expect(output.system[0]).toContain("# Role Context Materials")
    expect(output.system[0]).toContain("## Context: test-context")
    expect(output.system[0]).toContain("Test context description")
    expect(output.system[0]).toContain("Test context document content")

    // 验证 prompt 包含会议模式增强
    expect(output.system[0]).toContain(
      "This is a direct working meeting with the boss"
    )

    // 验证 prompt 不包含员工基础设施（记忆、任务、工作区）
    expect(output.system[0]).not.toContain("# Current Memory")
    expect(output.system[0]).not.toContain("# Task Management")
    expect(output.system[0]).not.toContain("# Workspace Files")
  })
})
