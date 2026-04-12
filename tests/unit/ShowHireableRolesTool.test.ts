import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { RoleManager } from "../../src/core/RoleManager"
import { BossManager } from "../../src/core/BossManager"
import { StateManager } from "../../src/state/StateManager"
import { createShowHireableRolesTool } from "../../src/tools/ShowHireableRolesTool"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../fixtures/show-hireable-roles-tool-test"
)

describe("ShowHireableRolesTool", () => {
  let roleManager: RoleManager
  let bossManager: BossManager
  let stateManager: StateManager
  let showHireableRolesTool: any

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建测试角色目录
    const rolesDir = path.join(TEST_WORKSPACE, ".cclover/roles")
    await fs.mkdir(rolesDir, { recursive: true })

    // 创建测试角色文件
    // Role 1: developer (can hire tester)
    await fs.writeFile(
      path.join(rolesDir, "developer.md"),
      `---
name: developer
id: developer
description: Software developer
canHire:
  - tester
requiredArgs: {}
groups: []
---
You are a software developer.`
    )

    // Role 2: tester (no canHire)
    await fs.writeFile(
      path.join(rolesDir, "tester.md"),
      `---
name: tester
id: tester
description: Software tester
canHire: []
requiredArgs: {}
groups: []
---
You are a software tester.`
    )

    // Role 3: manager (can hire developer and tester using glob)
    await fs.writeFile(
      path.join(rolesDir, "manager.md"),
      `---
name: manager
id: manager
description: Project manager
canHire:
  - "*"
requiredArgs: {}
groups: []
---
You are a project manager.`
    )

    // Role 4: designer (with required args)
    await fs.writeFile(
      path.join(rolesDir, "designer.md"),
      `---
name: designer
id: designer
description: UI/UX designer
canHire: []
requiredArgs:
  design_tool:
    type: string
    description: Preferred design tool (Figma, Sketch, etc.)
groups: []
---
You are a UI/UX designer.`
    )

    // 创建 RoleManager 并加载角色
    roleManager = new RoleManager(TEST_WORKSPACE)
    await roleManager.refresh()

    // 创建 BossManager
    bossManager = new BossManager({ bosses: ["boss-alice"], projects: [] })

    // 创建 StateManager 并注册测试员工
    stateManager = new StateManager(
      "test-project",
      TEST_WORKSPACE,
      TEST_WORKSPACE
    )
    await stateManager.registerEmployee({
      employeeId: "0-alice",
      taskId: 0,
      name: "alice",
      id: "alice",
      role: "developer",
      status: "inactive",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "boss-alice",
    })
    await stateManager.registerEmployee({
      employeeId: "0-bob",
      taskId: 0,
      name: "bob",
      id: "bob",
      role: "tester",
      status: "inactive",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "boss-alice",
    })
    await stateManager.registerEmployee({
      employeeId: "0-charlie",
      taskId: 0,
      name: "charlie",
      id: "charlie",
      role: "manager",
      status: "inactive",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "boss-alice",
    })

    // 创建 ShowHireableRolesTool
    showHireableRolesTool = createShowHireableRolesTool(
      roleManager,
      stateManager,
      bossManager
    )

    // 注册 sessions
    sessionRegistry.register("test-session-alice", "0-alice")
    sessionRegistry.register("test-session-bob", "0-bob")
    sessionRegistry.register("test-session-charlie", "0-charlie")
  })

  afterEach(async () => {
    // 清理
    sessionRegistry.unregister("test-session-alice")
    sessionRegistry.unregister("test-session-bob")
    sessionRegistry.unregister("test-session-charlie")
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("should show all roles for meeting-mode role agent", async () => {
    const context = {
      sessionID: "unknown-session",
      agent: "manager",
    }

    const result = await showHireableRolesTool.execute({}, context)

    expect(result).toContain("You are a boss and can hire any of the")
    expect(result).toContain("available roles")
    expect(result).toContain("- developer: Software developer")
    expect(result).toContain("- tester: Software tester")
    expect(result).toContain("- manager: Project manager")
    expect(result).toContain("- designer: UI/UX designer")
  })

  test("should show all roles for boss", async () => {
    const context = {
      sessionID: "unknown-session",
      agent: "boss-alice",
    }

    const result = await showHireableRolesTool.execute({}, context)

    expect(result).toContain("You are a boss and can hire any of the")
    expect(result).toContain("available roles")
    expect(result).toContain("- developer: Software developer")
    expect(result).toContain("- tester: Software tester")
    expect(result).toContain("- manager: Project manager")
    expect(result).toContain("- designer: UI/UX designer")
  })

  test("should show hireable roles for regular employee", async () => {
    const context = {
      sessionID: "test-session-alice",
    }

    const result = await showHireableRolesTool.execute({}, context)

    expect(result).toContain("You can hire the following 1 roles")
    expect(result).toContain("- tester: Software tester")
    expect(result).not.toContain("- developer:")
    expect(result).not.toContain("- manager:")
  })

  test("should show message when employee cannot hire anyone", async () => {
    const context = {
      sessionID: "test-session-bob",
    }

    const result = await showHireableRolesTool.execute({}, context)

    expect(result).toContain("You (role: tester) cannot hire any employees")
    expect(result).toContain("Your role has no canHire permissions")
  })

  test("should resolve glob patterns in canHire", async () => {
    const context = {
      sessionID: "test-session-charlie",
    }

    const result = await showHireableRolesTool.execute({}, context)

    // Manager has canHire: ["*"], so should see all roles
    expect(result).toContain("You can hire the following")
    expect(result).toContain("roles")
    expect(result).toContain("- developer:")
    expect(result).toContain("- tester:")
    expect(result).toContain("- manager:")
    expect(result).toContain("- designer:")
  })

  test("should display required arguments for roles", async () => {
    const context = {
      sessionID: "unknown-session",
      agent: "boss-alice",
    }

    const result = await showHireableRolesTool.execute({}, context)

    expect(result).toContain("- designer: UI/UX designer")
    expect(result).toContain("Required arguments:")
    expect(result).toContain(
      "- design_tool (string): Preferred design tool (Figma, Sketch, etc.)"
    )
  })

  test("should handle roles without description", async () => {
    // 创建一个没有描述的角色
    const rolesDir = path.join(TEST_WORKSPACE, ".cclover/roles")
    await fs.writeFile(
      path.join(rolesDir, "no-desc.md"),
      `---
name: no-desc
id: no-desc
description: ""
canHire: []
requiredArgs: {}
groups: []
---
You are a role without description.`
    )

    await roleManager.refresh()

    const context = {
      sessionID: "unknown-session",
      agent: "boss-alice",
    }

    const result = await showHireableRolesTool.execute({}, context)

    expect(result).toContain("- no-desc: (no description)")
  })

  test("should handle unrecognized session", async () => {
    const context = {
      sessionID: "unknown-session",
    }

    const result = await showHireableRolesTool.execute({}, context)

    expect(result).toContain("Error: Unable to identify caller")
  })

  test("should handle employee with non-existent role", async () => {
    // 注册一个角色不存在的员工
    await stateManager.registerEmployee({
      employeeId: "0-dave",
      taskId: 0,
      name: "dave",
      id: "dave",
      role: "non-existent-role",
      status: "inactive",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "boss-alice",
    })
    sessionRegistry.register("test-session-dave", "0-dave")

    const context = {
      sessionID: "test-session-dave",
    }

    const result = await showHireableRolesTool.execute({}, context)

    expect(result).toContain(
      "Error: Cannot find role definition for role 'non-existent-role'"
    )

    sessionRegistry.unregister("test-session-dave")
  })

  test("should show preset roles even in empty workspace", async () => {
    // 创建一个空的 RoleManager (will still load preset roles from src/roles)
    const emptyWorkspace = path.join(TEST_WORKSPACE, "empty")
    await fs.mkdir(emptyWorkspace, { recursive: true })
    const emptyRoleManager = new RoleManager(emptyWorkspace)
    await emptyRoleManager.refresh()

    const emptyTool = createShowHireableRolesTool(
      emptyRoleManager,
      stateManager,
      bossManager
    )

    const context = {
      sessionID: "unknown-session",
      agent: "boss-alice",
    }

    const result = await emptyTool.execute({}, context)

    // Should show preset roles (from src/roles)
    expect(result).toContain("You are a boss and can hire any of the")
    expect(result).toContain("available roles")
  })
})
