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

  test("buildMeetingModePrimaryAgents uses resolved role set from RoleManager", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "Calculator.md"),
      `---
name: Calculator
description: Project override calculator description
---

Project override calculator prompt`
    )

    await roleManager.refresh()

    const agents = buildMeetingModePrimaryAgents(roleManager)

    expect(agents.Calculator).toBeDefined()
    expect(agents.Calculator.mode).toBe("primary")
    expect(agents.Calculator.description).toBe(
      "Project override calculator description"
    )
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
      tempDir
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

    expect(actor).toEqual({
      actorName: "Calculator",
      actorEmployeeId: "0-boss-b",
      actorType: "meeting-role",
      isBoss: false,
      hasBossAuthority: true,
      projectedRoleName: "Calculator",
    })
  })
})
