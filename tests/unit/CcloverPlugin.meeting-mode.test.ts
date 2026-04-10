import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { RoleManager } from "../../src/core/RoleManager"

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

  test("config hook registers resolved roles as primary agents with original names", async () => {
    const roleManager = new RoleManager(tempDir)
    await roleManager.refresh()

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
            roleManager,
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
      "Project calculator role prompt"
    )
    expect(config.agent.Calculator.prompt).toContain(
      "This is a direct working meeting with the boss"
    )
  })

  test("meeting-mode roles with contextIds inject contexts into prompt", async () => {
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
            roleManager,
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

    // 验证 prompt 包含角色提示词
    expect(config.agent.ContextRole.prompt).toContain(
      "Role with context prompt"
    )

    // 验证 prompt 包含上下文内容
    expect(config.agent.ContextRole.prompt).toContain(
      "# Role Context Materials"
    )
    expect(config.agent.ContextRole.prompt).toContain(
      "## Context: test-context"
    )
    expect(config.agent.ContextRole.prompt).toContain(
      "Test context description"
    )
    expect(config.agent.ContextRole.prompt).toContain(
      "Test context document content"
    )

    // 验证 prompt 包含会议模式增强
    expect(config.agent.ContextRole.prompt).toContain(
      "This is a direct working meeting with the boss"
    )

    // 验证 prompt 不包含员工基础设施（记忆、任务、工作区）
    expect(config.agent.ContextRole.prompt).not.toContain("# Current Memory")
    expect(config.agent.ContextRole.prompt).not.toContain("# Task Management")
    expect(config.agent.ContextRole.prompt).not.toContain("# Workspace Files")
  })
})
