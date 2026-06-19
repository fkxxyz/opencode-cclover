import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { RoleManager } from "../../src/core/RoleManager"
import { BossManager } from "../../src/core/BossManager"
import { MeetingModePromptInjector } from "../../src/meeting-mode/PromptInjector"
import {
  buildMeetingModePrimaryAgents,
  composeMeetingModePrompt,
  getMeetingModeAugmentation,
  isMeetingModeProjectedAgent,
  resolveToolActor,
} from "../../src/meeting-mode"

function suppressExpectedHookLogs<T>(callback: () => T): T {
  const originalError = console.error
  const originalWarn = console.warn
  console.error = () => {}
  console.warn = () => {}

  try {
    return callback()
  } finally {
    console.error = originalError
    console.warn = originalWarn
  }
}

describe("Meeting Mode helpers", () => {
  let tempDir: string
  let roleManager: RoleManager

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meeting-mode-test-"))
    roleManager = new RoleManager(tempDir)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test("buildMeetingModePrimaryAgents uses placeholder prompts when dynamic injection is enabled", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "test-role.md"),
      `---
name: TestRole
id: test-role
description: Project override test-role description
---

Project override test-role prompt`
    )

    await roleManager.refresh()

    const agents = await buildMeetingModePrimaryAgents(roleManager, {
      useDynamicPromptInjection: true,
    })

    expect(agents.TestRole).toBeDefined()
    expect(agents.TestRole.mode).toBe("primary")
    expect(agents.TestRole.description).toBe(
      "Project override test-role description"
    )
    expect(agents.TestRole.prompt).toContain(
      "Meeting mode prompt is injected dynamically"
    )
    expect(agents.TestRole.prompt).not.toContain(
      "Project override test-role prompt"
    )
  })

  test("buildMeetingModePrimaryAgents uses static prompts when dynamic injection is disabled", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "test-role.md"),
      `---
name: TestRole
id: test-role
description: Project override test-role description
---

Project override test-role prompt`
    )

    await roleManager.refresh()

    const agents = await buildMeetingModePrimaryAgents(roleManager, {
      useDynamicPromptInjection: false,
    })

    expect(agents.TestRole.prompt).toContain(
      "Project override test-role prompt"
    )
    expect(agents.TestRole.prompt).toContain(
      "Meeting mode is a direct working session between the boss"
    )
  })

  test("composeMeetingModePrompt appends stable meeting augmentation after role prompt", async () => {
    const augmentation = await getMeetingModeAugmentation()
    const prompt = composeMeetingModePrompt(
      "Original role prompt",
      augmentation
    )

    expect(prompt.startsWith("Original role prompt")).toBe(true)
    expect(prompt).toContain(
      "Meeting mode is a direct working session between the boss"
    )
    expect(prompt).toContain("Hiring Restrictions Lifted")
    expect(prompt).toContain("hire them immediately")
  })

  test("isMeetingModeProjectedAgent matches resolved role names only", async () => {
    await roleManager.refresh()

    expect(isMeetingModeProjectedAgent(roleManager, "TestRole")).toBe(true)
    expect(isMeetingModeProjectedAgent(roleManager, "non-existent-role")).toBe(
      false
    )
  })

  test("resolveToolActor maps projected meeting agent to the invoking boss session", async () => {
    const bossManager = new BossManager(
      {
        bosses: ["boss-a", "boss-b"],
        projects: [],
      },
      tempDir,
      roleManager
    )

    await roleManager.refresh()
    await bossManager.recordSession("boss-b", "emp_worker", "meeting-session-b")

    const actor = resolveToolActor(
      {
        sessionID: "meeting-session-b",
        agent: "TestRole",
      },
      undefined,
      bossManager,
      roleManager
    )

    // Meeting-mode agent uses role.id as identity, not Boss from session
    expect(actor).toEqual({
      actorName: "TestRole",
      actorEmployeeId: "0-test-role",
      actorType: "meeting-role",
      isBoss: false,
      hasBossAuthority: true,
      projectedRoleName: "TestRole",
    })
  })
})

describe("MeetingModePromptInjector", () => {
  let tempDir: string
  let roleManager: RoleManager
  let promptInjector: MeetingModePromptInjector

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompt-injector-test-"))

    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })
    await fs.writeFile(
      path.join(projectRolesDir, "test-role.md"),
      `---
name: TestRole
id: test-role
description: Project test-role role
---

Project test-role role prompt`
    )

    roleManager = new RoleManager(tempDir)
    await roleManager.refresh()

    promptInjector = new MeetingModePromptInjector(
      "test-project",
      "test-project"
    )
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test("builds injected prompt for mapped session", async () => {
    // 模拟 chat.params 记录 session
    promptInjector.recordSession("meeting-session-1", "TestRole")

    // 测试 buildInjectedPrompt
    const result = await promptInjector.buildInjectedPrompt(
      "meeting-session-1",
      roleManager
    )

    expect(result.injected).toBe(true)
    expect(result.agentName).toBe("TestRole")
    expect(result.prompt).toContain("Project test-role role prompt")
    expect(result.prompt).toContain(
      "Meeting mode is a direct working session between the boss"
    )
  })

  test("does not inject for unmapped session", async () => {
    const result = await promptInjector.buildInjectedPrompt(
      "unknown-session",
      roleManager
    )

    expect(result.injected).toBe(false)
    expect(result.reason).toBe("session mapping not found")
  })

  test("injects contexts for roles with contextIds", async () => {
    // 创建带有 contextIds 的角色
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.writeFile(
      path.join(projectRolesDir, "ContextRole.md"),
      `---
name: ContextRole
id: contextrole
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

    // 重新加载角色
    await roleManager.refresh()

    // 记录 session
    promptInjector.recordSession("meeting-session-context", "ContextRole")

    // 构建注入的 prompt
    const result = await promptInjector.buildInjectedPrompt(
      "meeting-session-context",
      roleManager
    )

    expect(result.injected).toBe(true)
    expect(result.prompt).toContain("Role with context prompt")

    // 验证 prompt 包含上下文内容
    expect(result.prompt).toContain("# Role Context Materials")
    expect(result.prompt).toContain("## Context: test-context")
    expect(result.prompt).toContain("Test context description")
    expect(result.prompt).toContain("Test context document content")

    // 验证 prompt 包含会议模式增强
    expect(result.prompt).toContain(
      "Meeting mode is a direct working session between the boss"
    )

    // 验证 prompt 不包含员工基础设施（记忆、任务、工作区）
    expect(result.prompt).not.toContain("# Current Memory")
    expect(result.prompt).not.toContain("# Task Management")
    expect(result.prompt).not.toContain("# Workspace Files")
  })

  test("records hook success and failure", () => {
    expect(promptInjector.isHookEnabled()).toBe(true)

    suppressExpectedHookLogs(() => {
      // 记录成功
      promptInjector.recordHookSuccess()
      expect(promptInjector.isHookEnabled()).toBe(true)

      // 记录失败（不足以禁用）
      promptInjector.recordHookFailure(new Error("test error"))
      expect(promptInjector.isHookEnabled()).toBe(true)

      // 连续失败 3 次应该禁用
      promptInjector.recordHookFailure(new Error("error 1"))
      promptInjector.recordHookFailure(new Error("error 2"))
      promptInjector.recordHookFailure(new Error("error 3"))
    })
    expect(promptInjector.isHookEnabled()).toBe(false)
  })
})
