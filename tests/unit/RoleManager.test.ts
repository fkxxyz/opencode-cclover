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
    const calculator = roleManager.getRole("calculator")
    expect(calculator).toBeDefined()
    expect(calculator?.name).toBe("calculator")
    expect(calculator?.source).toBe("preset")
    expect(calculator?.systemPrompt).toContain("计算器员工")
  })

  test("should return all role names", async () => {
    await roleManager.refresh()

    const names = roleManager.getRoleNames()
    expect(names).toContain("calculator")
    expect(names.length).toBeGreaterThan(0)
  })

  test("should return all roles", async () => {
    await roleManager.refresh()

    const roles = roleManager.getAllRoles()
    expect(roles.length).toBeGreaterThan(0)
    expect(roles.some((r) => r.name === "calculator")).toBe(true)
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

    // 创建一个覆盖 calculator 的项目 role
    await fs.writeFile(
      path.join(projectRolesDir, "calculator.md"),
      "Project-specific calculator role"
    )

    // 刷新并检查
    await roleManager.refresh()
    const calculator = roleManager.getRole("calculator")
    expect(calculator?.source).toBe("project")
    expect(calculator?.systemPrompt).toBe("Project-specific calculator role")

    // 清理
    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should load custom project roles", async () => {
    // 创建项目 role 目录
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // 创建自定义 role
    await fs.writeFile(
      path.join(projectRolesDir, "custom-role.md"),
      "Custom role prompt"
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

    const calculator = roleManager.getRole("calculator")
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
})
