import { describe, test, expect, beforeAll } from "bun:test"
import { RoleManager } from "../../src/core/RoleManager"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

describe("RoleManager", () => {
  let tempDir: string
  let roleManager: RoleManager

  beforeAll(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rolemanager-test-"))
    roleManager = new RoleManager(tempDir)
  })

  test("should load preset roles", async () => {
    await roleManager.refresh()

    // 应该加载 calculator.md
    const calculator = roleManager.getRole("Calculator")
    expect(calculator).toBeDefined()
    expect(calculator?.name).toBe("Calculator")
    expect(calculator?.source).toBe("preset")
    expect(calculator?.systemPrompt).toContain("计算器员工")
  })

  test("should return all role names", async () => {
    await roleManager.refresh()

    const names = roleManager.getRoleNames()
    expect(names).toContain("Calculator")
    expect(names.length).toBeGreaterThan(0)
  })

  test("should return all roles", async () => {
    await roleManager.refresh()

    const roles = roleManager.getAllRoles()
    expect(roles.length).toBeGreaterThan(0)
    expect(roles.some((r) => r.name === "Calculator")).toBe(true)
  })

  test("should return undefined for unknown role", async () => {
    await roleManager.refresh()

    const role = roleManager.getRole("unknown-role-xyz")
    expect(role).toBeUndefined()
  })

  test("should load project roles with higher priority", async () => {
    // 创建项目 role 目录
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // 创建一个覆盖 calculator 的项目 role (with frontmatter)
    const roleContent = [
      "---",
      "name: Calculator",
      "description: Project-specific calculator",
      "---",
      "Project-specific calculator role",
    ].join("\n")
    await fs.writeFile(path.join(projectRolesDir, "calculator.md"), roleContent)

    // 刷新并检查
    await roleManager.refresh()
    const calculator = roleManager.getRole("Calculator")
    expect(calculator?.source).toBe("project")
    expect(calculator?.systemPrompt).toBe("Project-specific calculator role")

    // 清理
    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should load custom project roles", async () => {
    // 创建项目 role 目录
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // 创建自定义 role (with frontmatter)
    const roleContent = [
      "---",
      "name: custom-role",
      "description: Custom role",
      "---",
      "Custom role prompt",
    ].join("\n")
    await fs.writeFile(
      path.join(projectRolesDir, "custom-role.md"),
      roleContent
    )

    // 刷新并检查
    await roleManager.refresh()
    const customRole = roleManager.getRole("custom-role")
    expect(customRole).toBeDefined()
    expect(customRole?.name).toBe("custom-role")
    expect(customRole?.source).toBe("project")
    expect(customRole?.systemPrompt).toBe("Custom role prompt")

    // 清理
    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("calculator role should have correct content", async () => {
    await roleManager.refresh()

    const calculator = roleManager.getRole("Calculator")
    expect(calculator).toBeDefined()

    const prompt = calculator!.systemPrompt

    // 检查关键内容
    expect(prompt).toContain("计算器员工")
    expect(prompt).toContain("数学计算")
    expect(prompt).toContain("send_message")
    expect(prompt).toContain("edit_tasks")
    expect(prompt).toContain("create_agent")
    expect(prompt).toContain("简单计算")
    expect(prompt).toContain("复杂计算")
    expect(prompt).toContain("示例工作流程")
  })

  test("should parse YAML frontmatter correctly", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // 创建带 YAML frontmatter 的角色文件
    const roleContent = `---
name: test-role
description: A test role with metadata
requiredArgs:
  arg1:
    type: string
    description: First argument
canHire:
  - developer
  - tester
groups:
  - engineering
---

This is the system prompt for the test role.`

    await fs.writeFile(path.join(projectRolesDir, "test-role.md"), roleContent)

    await roleManager.refresh()
    const testRole = roleManager.getRole("test-role")

    expect(testRole).toBeDefined()
    expect(testRole?.name).toBe("test-role")
    expect(testRole?.description).toBe("A test role with metadata")
    expect(testRole?.systemPrompt).toBe(
      "This is the system prompt for the test role."
    )
    expect(testRole?.requiredArgs).toEqual({
      arg1: {
        type: "string",
        description: "First argument",
      },
    })
    expect(testRole?.canHire).toEqual(["developer", "tester"])
    expect(testRole?.groups).toEqual(["engineering"])

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should parse memorySchema from YAML frontmatter", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: module-maintainer
description: Maintains a module
memorySchema:
  ownedUnits:
    type: string[]
    description: List of owned code units
    required: true
  delegatedUnits:
    type: object
    description: Delegated units mapping
    required: false
---

You are a module maintainer.`

    await fs.writeFile(
      path.join(projectRolesDir, "module-maintainer.md"),
      roleContent
    )

    await roleManager.refresh()
    const role = roleManager.getRole("module-maintainer")

    expect(role).toBeDefined()
    expect(role?.memorySchema).toEqual({
      ownedUnits: {
        type: "string[]",
        description: "List of owned code units",
        required: true,
      },
      delegatedUnits: {
        type: "object",
        description: "Delegated units mapping",
        required: false,
      },
    })

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should parse responsibilities and boundaries from YAML frontmatter", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: reviewer
description: Reviews code changes
responsibilities:
  - Review code quality
  - Identify correctness risks
boundaries:
  - Do not modify production code directly
  - Do not approve without evidence
---

You are a reviewer.`

    await fs.writeFile(path.join(projectRolesDir, "reviewer.md"), roleContent)

    await roleManager.refresh()
    const role = roleManager.getRole("reviewer")

    expect(role).toBeDefined()
    expect(role?.responsibilities).toEqual([
      "Review code quality",
      "Identify correctness risks",
    ])
    expect(role?.boundaries).toEqual([
      "Do not modify production code directly",
      "Do not approve without evidence",
    ])

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should work without memorySchema (backward compatibility)", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: simple-role
description: A simple role without memorySchema
---

You are a simple role.`

    await fs.writeFile(
      path.join(projectRolesDir, "simple-role.md"),
      roleContent
    )

    await roleManager.refresh()
    const role = roleManager.getRole("simple-role")

    expect(role).toBeDefined()
    expect(role?.memorySchema).toBeUndefined()

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should reject old format without frontmatter", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // Create old format role file without frontmatter
    await fs.writeFile(
      path.join(projectRolesDir, "old-format.md"),
      "This is an old format role without frontmatter."
    )

    await roleManager.refresh()
    const oldRole = roleManager.getRole("old-format")

    // Should not load old format files
    expect(oldRole).toBeUndefined()

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("resolveGroup should return roles in group", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // 创建多个角色，部分属于同一组
    await fs.writeFile(
      path.join(projectRolesDir, "dev1.md"),
      `---
name: dev1
description: Developer 1
groups:
  - developers
---
Dev 1 prompt`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "dev2.md"),
      `---
name: dev2
description: Developer 2
groups:
  - developers
---
Dev 2 prompt`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
description: Tester
groups:
  - qa
---
Tester prompt`
    )

    await roleManager.refresh()

    const devGroup = roleManager.resolveGroup("group:developers")
    expect(devGroup).toHaveLength(4) // 2 from preset (General Developer, Soul Developer) + 2 from test
    expect(devGroup).toContain("dev1")
    expect(devGroup).toContain("dev2")
    expect(devGroup).toContain("General Developer")
    expect(devGroup).toContain("Soul Developer")

    const qaGroup = roleManager.resolveGroup("group:qa")
    expect(qaGroup).toHaveLength(1)
    expect(qaGroup).toContain("tester")

    const emptyGroup = roleManager.resolveGroup("group:nonexistent")
    expect(emptyGroup).toHaveLength(0)

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("resolveCanHire should resolve exact names", async () => {
    await roleManager.refresh()

    const resolved = roleManager.resolveCanHire(["Calculator"])
    expect(resolved).toContain("Calculator")
  })

  test("resolveCanHire should resolve glob patterns", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "dev-frontend.md"),
      `---
name: dev-frontend
description: Frontend developer
---
Frontend dev`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "dev-backend.md"),
      `---
name: dev-backend
description: Backend developer
---
Backend dev`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
description: Tester
---
Tester`
    )

    await roleManager.refresh()

    // Test *
    const all = roleManager.resolveCanHire(["*"])
    expect(all.length).toBeGreaterThan(0)

    // Test prefix*
    const devs = roleManager.resolveCanHire(["dev-*"])
    expect(devs).toContain("dev-frontend")
    expect(devs).toContain("dev-backend")
    expect(devs).not.toContain("tester")

    // Test *suffix
    const backends = roleManager.resolveCanHire(["*-backend"])
    expect(backends).toContain("dev-backend")
    expect(backends).not.toContain("dev-frontend")

    // Test *middle*
    const frontends = roleManager.resolveCanHire(["*front*"])
    expect(frontends).toContain("dev-frontend")
    expect(frontends).not.toContain("dev-backend")

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("resolveCanHire should resolve group references", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "dev1.md"),
      `---
name: dev1
groups:
  - developers
---
Dev 1`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "dev2.md"),
      `---
name: dev2
groups:
  - developers
---
Dev 2`
    )

    await roleManager.refresh()

    const resolved = roleManager.resolveCanHire(["group:developers"])
    expect(resolved).toHaveLength(4) // 2 from preset + 2 from test
    expect(resolved).toContain("dev1")
    expect(resolved).toContain("dev2")
    expect(resolved).toContain("General Developer")
    expect(resolved).toContain("Soul Developer")

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("resolveCanHire should resolve mixed patterns", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "dev1.md"),
      `---
name: dev1
groups:
  - developers
---
Dev 1`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
description: Tester
---
Tester`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "reviewer.md"),
      `---
name: reviewer
description: Reviewer
---
Reviewer`
    )

    await roleManager.refresh()

    const resolved = roleManager.resolveCanHire([
      "group:developers",
      "tester",
      "*viewer",
    ])
    expect(resolved).toContain("dev1")
    expect(resolved).toContain("tester")
    expect(resolved).toContain("reviewer")

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("canHire should check if role A can hire role B", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "manager.md"),
      `---
name: manager
canHire:
  - developer
  - tester
---
Manager`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "developer.md"),
      `---
name: developer
description: Developer
---
Developer`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
description: Tester
---
Tester`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "designer.md"),
      `---
name: designer
description: Designer
---
Designer`
    )

    await roleManager.refresh()

    expect(roleManager.canHire("manager", "developer")).toBe(true)
    expect(roleManager.canHire("manager", "tester")).toBe(true)
    expect(roleManager.canHire("manager", "designer")).toBe(false)
    expect(roleManager.canHire("developer", "tester")).toBe(false)

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("canHire should work with glob patterns", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "manager.md"),
      `---
name: manager
canHire:
  - dev-*
---
Manager`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "dev-frontend.md"),
      `---
name: dev-frontend
description: Frontend developer
---
Frontend`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "dev-backend.md"),
      `---
name: dev-backend
description: Backend developer
---
Backend`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
description: Tester
---
Tester`
    )

    await roleManager.refresh()

    expect(roleManager.canHire("manager", "dev-frontend")).toBe(true)
    expect(roleManager.canHire("manager", "dev-backend")).toBe(true)
    expect(roleManager.canHire("manager", "tester")).toBe(false)

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("canHire should work with group references", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "manager.md"),
      `---
name: manager
canHire:
  - group:developers
---
Manager`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "dev1.md"),
      `---
name: dev1
groups:
  - developers
---
Dev 1`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "dev2.md"),
      `---
name: dev2
groups:
  - developers
---
Dev 2`
    )

    await fs.writeFile(path.join(projectRolesDir, "tester.md"), "Tester")

    await roleManager.refresh()

    expect(roleManager.canHire("manager", "dev1")).toBe(true)
    expect(roleManager.canHire("manager", "dev2")).toBe(true)
    expect(roleManager.canHire("manager", "tester")).toBe(false)

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("canHire should return false for role without canHire", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(path.join(projectRolesDir, "developer.md"), "Developer")
    await fs.writeFile(path.join(projectRolesDir, "tester.md"), "Tester")

    await roleManager.refresh()

    expect(roleManager.canHire("developer", "tester")).toBe(false)

    await fs.rm(projectRolesDir, { recursive: true })
  })
})
