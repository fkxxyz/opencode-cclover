import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { RoleManager } from "../../src/core/RoleManager"
import { MeetingModePromptInjector } from "../../src/meeting-mode/PromptInjector"

describe("MeetingModePromptInjector", () => {
  let injector: MeetingModePromptInjector
  let currentTime: number
  let originalDateNow: () => number

  beforeEach(() => {
    currentTime = 0
    originalDateNow = Date.now
    Date.now = () => currentTime
    injector = new MeetingModePromptInjector("project-1", "test-project")
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  test("records session to agent mappings per project", () => {
    injector.recordSession("session-1", "TestRole")

    expect(injector.getAgentName("session-1")).toBe("TestRole")
  })

  test("records meeting role name when recordSession receives an agent object", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "meeting-mode-injector-")
    )
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })
    await fs.writeFile(
      path.join(projectRolesDir, "Soul Developer.md"),
      `---
name: Soul Developer
---

Soul Developer prompt`
    )

    const roleManager = new RoleManager(tempDir)
    await roleManager.refresh()

    injector.recordSession("session-role-object", "Soul Developer")
    injector.recordSession("session-role-object", {
      name: "Soul Developer",
      mode: "primary",
    } as unknown as string)

    const result = injector.buildInjectedPrompt(
      "session-role-object",
      roleManager
    )

    expect(injector.getAgentName("session-role-object")).toBe("Soul Developer")
    expect(result.injected).toBe(true)
    expect(result.agentName).toBe("Soul Developer")
  })

  test("does not let hidden title agent overwrite active meeting role", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "meeting-mode-injector-")
    )
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })
    await fs.writeFile(
      path.join(projectRolesDir, "Soul Developer.md"),
      `---
name: Soul Developer
---

Soul Developer prompt`
    )

    const roleManager = new RoleManager(tempDir)
    await roleManager.refresh()

    injector.recordSession("session-title-overwrite", "Soul Developer")
    injector.recordSession("session-title-overwrite", {
      name: "title",
      hidden: true,
      native: true,
      mode: "primary",
    } as unknown as string)

    const result = injector.buildInjectedPrompt(
      "session-title-overwrite",
      roleManager
    )

    expect(injector.getAgentName("session-title-overwrite")).toBe(
      "Soul Developer"
    )
    expect(result.injected).toBe(true)
    expect(result.agentName).toBe("Soul Developer")
  })

  test("does not let non-meeting agent overwrite active meeting role", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "meeting-mode-injector-")
    )
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })
    await fs.writeFile(
      path.join(projectRolesDir, "Soul Developer.md"),
      `---
name: Soul Developer
---

Soul Developer prompt`
    )

    const roleManager = new RoleManager(tempDir)
    await roleManager.refresh()

    injector.recordSession("session-non-meeting-overwrite", "Soul Developer")
    injector.recordSession("session-non-meeting-overwrite", {
      name: "Unknown Agent",
      mode: "primary",
    } as unknown as string)

    const result = injector.buildInjectedPrompt(
      "session-non-meeting-overwrite",
      roleManager
    )

    expect(injector.getAgentName("session-non-meeting-overwrite")).toBe(
      "Soul Developer"
    )
    expect(result.injected).toBe(true)
    expect(result.agentName).toBe("Soul Developer")
  })

  test("disables hook after three consecutive failures", () => {
    injector.recordHookSuccess()
    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("first"))
    injector.recordHookFailure(new Error("second"))

    expect(injector.isHookEnabled()).toBe(true)

    injector.recordHookFailure(new Error("third"))

    expect(injector.isHookEnabled()).toBe(false)
    expect(injector.getDisableReason()).toContain("3 consecutive failures")
  })

  test("resets consecutive failures after a successful execution", () => {
    injector.recordHookSuccess()
    injector.recordHookSuccess()
    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("first"))
    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("second"))
    injector.recordHookFailure(new Error("third"))

    expect(injector.isHookEnabled()).toBe(true)
  })

  test("disables hook when failure rate exceeds 50 percent within five minutes", () => {
    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("first"))

    expect(injector.isHookEnabled()).toBe(true)

    injector.recordHookFailure(new Error("second"))

    expect(injector.isHookEnabled()).toBe(false)
    expect(injector.getDisableReason()).toContain("failure rate exceeded 50%")
  })

  test("ignores executions outside the five minute failure-rate window", () => {
    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("old-failure"))

    currentTime = 6 * 60 * 1000

    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("recent-failure"))

    expect(injector.isHookEnabled()).toBe(true)
  })
})
