import { beforeEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { RoleManager } from "../../src/core/RoleManager"
import { BossManager } from "../../src/core/BossManager"
import {
  buildMeetingModePrimaryAgents,
  composeMeetingModePrompt,
  isMeetingModeProjectedAgent,
  resolveToolActor,
} from "../../src/meeting-mode"

describe("Meeting Mode helpers", () => {
  let tempDir: string
  let roleManager: RoleManager

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meeting-mode-test-"))
    roleManager = new RoleManager(tempDir)
  })

  test("buildMeetingModePrimaryAgents uses placeholder prompts when dynamic injection is enabled", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "Calculator.md"),
      `---
name: Calculator
id: calculator
description: Project override calculator description
---

Project override calculator prompt`
    )

    await roleManager.refresh()

    const agents = buildMeetingModePrimaryAgents(roleManager, {
      useDynamicPromptInjection: true,
    })

    expect(agents.Calculator).toBeDefined()
    expect(agents.Calculator.mode).toBe("primary")
    expect(agents.Calculator.description).toBe(
      "Project override calculator description"
    )
    expect(agents.Calculator.prompt).toContain(
      "Meeting mode prompt is injected dynamically"
    )
    expect(agents.Calculator.prompt).not.toContain(
      "Project override calculator prompt"
    )
  })

  test("buildMeetingModePrimaryAgents uses static prompts when dynamic injection is disabled", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "Calculator.md"),
      `---
name: Calculator
id: calculator
description: Project override calculator description
---

Project override calculator prompt`
    )

    await roleManager.refresh()

    const agents = buildMeetingModePrimaryAgents(roleManager, {
      useDynamicPromptInjection: false,
    })

    expect(agents.Calculator.prompt).toContain(
      "Project override calculator prompt"
    )
    expect(agents.Calculator.prompt).toContain(
      "The boss is personally talking with you"
    )
  })

  test("composeMeetingModePrompt appends stable meeting augmentation after role prompt", () => {
    const prompt = composeMeetingModePrompt("Original role prompt")

    expect(prompt.startsWith("Original role prompt")).toBe(true)
    expect(prompt).toContain("This is a direct working meeting with the boss")
    expect(prompt).toContain("normal hiring restrictions are lifted")
    expect(prompt).toContain("hire them immediately and proceed")
  })

  test("isMeetingModeProjectedAgent matches resolved role names only", async () => {
    await roleManager.refresh()

    expect(isMeetingModeProjectedAgent(roleManager, "Calculator")).toBe(true)
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
    await bossManager.recordSession("boss-b", "0-worker", "meeting-session-b")

    const actor = resolveToolActor(
      {
        sessionID: "meeting-session-b",
        agent: "Calculator",
      },
      undefined,
      bossManager,
      roleManager
    )

    // Meeting-mode agent uses role.id as identity, not Boss from session
    expect(actor).toEqual({
      actorName: "Calculator",
      actorEmployeeId: "0-calculator",
      actorType: "meeting-role",
      isBoss: false,
      hasBossAuthority: true,
      projectedRoleName: "Calculator",
    })
  })
})
