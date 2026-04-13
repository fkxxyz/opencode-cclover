import { beforeEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { RoleManager } from "../../src/core/RoleManager"
import { BossManager } from "../../src/core/BossManager"
import {
  buildMeetingModePrimaryAgents,
  composeMeetingModePrompt,
  getMeetingModeAugmentation,
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
    const prompt = composeMeetingModePrompt("Original role prompt", augmentation)

    expect(prompt.startsWith("Original role prompt")).toBe(true)
    expect(prompt).toContain("Meeting mode is a direct working session between the boss")
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
    await bossManager.recordSession("boss-b", "0-worker", "meeting-session-b")

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
