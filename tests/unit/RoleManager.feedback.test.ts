import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { RoleManager } from "../../src/core/RoleManager"

describe("RoleManager - Feedback System (isCoreLead)", () => {
  let tempDir: string
  let roleManager: RoleManager

  beforeEach(async () => {
    tempDir = path.join(
      import.meta.dir,
      "..",
      "fixtures",
      `role-test-${Date.now()}`
    )
    await fs.mkdir(tempDir, { recursive: true })
    const presetRolesDir = path.join(tempDir, "preset-roles")
    await fs.mkdir(presetRolesDir, { recursive: true })
    roleManager = new RoleManager(tempDir, presetRolesDir, tempDir)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe("isCoreLead parsing", () => {
    test("should parse isCoreLead=true from role frontmatter", async () => {
      const rolesDir = path.join(tempDir, ".cclover", "roles")
      await fs.mkdir(rolesDir, { recursive: true })
      await fs.writeFile(
        path.join(rolesDir, "project-manager.md"),
        '---\nname: "Project Manager"\nid: "project-manager"\nisCoreLead: true\n---\nYou are a project manager.'
      )
      await roleManager.refresh()
      const role = roleManager.getRole("Project Manager")
      expect(role).toBeDefined()
      expect(role!.isCoreLead).toBe(true)
    })

    test("should parse isCoreLead=false from role frontmatter", async () => {
      const rolesDir = path.join(tempDir, ".cclover", "roles")
      await fs.mkdir(rolesDir, { recursive: true })
      await fs.writeFile(
        path.join(rolesDir, "developer.md"),
        '---\nname: "Developer"\nid: "developer"\nisCoreLead: false\n---\nYou are a developer.'
      )
      await roleManager.refresh()
      const role = roleManager.getRole("Developer")
      expect(role).toBeDefined()
      expect(role!.isCoreLead).toBe(false)
    })

    test("should default to false when isCoreLead not specified", async () => {
      const rolesDir = path.join(tempDir, ".cclover", "roles")
      await fs.mkdir(rolesDir, { recursive: true })
      await fs.writeFile(
        path.join(rolesDir, "tester.md"),
        '---\nname: "Tester"\nid: "tester"\n---\nYou are a tester.'
      )
      await roleManager.refresh()
      const role = roleManager.getRole("Tester")
      expect(role).toBeDefined()
      expect(role!.isCoreLead).toBe(false)
    })

    test("should expose isCoreLead via getRole()", async () => {
      const rolesDir = path.join(tempDir, ".cclover", "roles")
      await fs.mkdir(rolesDir, { recursive: true })
      await fs.writeFile(
        path.join(rolesDir, "lead.md"),
        '---\nname: "Lead"\nid: "lead"\nisCoreLead: true\n---\nYou are a lead.'
      )
      await roleManager.refresh()
      const role = roleManager.getRole("Lead")
      expect(role).toBeDefined()
      expect(role!.isCoreLead).toBe(true)
      expect(role!.name).toBe("Lead")
    })

    test("should not change getRole() signature", async () => {
      const rolesDir = path.join(tempDir, ".cclover", "roles")
      await fs.mkdir(rolesDir, { recursive: true })
      await fs.writeFile(
        path.join(rolesDir, "test-role.md"),
        '---\nname: "Test Role"\nid: "test-role"\n---\nTest prompt.'
      )
      await roleManager.refresh()
      const role = roleManager.getRole("Test Role")
      expect(role).toBeDefined()
      const nonExistent = roleManager.getRole("non-existent")
      expect(nonExistent).toBeUndefined()
    })
  })
})
