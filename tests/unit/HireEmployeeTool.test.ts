import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { BossManager } from "../../src/core/BossManager"
import { StateManager } from "../../src/state/StateManager"
import { RoleManager } from "../../src/core/RoleManager"
import { MemoryManager } from "../../src/core/MemoryManager"
import { createHireEmployeeTool } from "../../src/tools/HireEmployeeTool"
import type { CcloverConfig } from "../../src/config/ConfigManager"
import type { ProjectInstance } from "../../src/server/ProjectRegistry"
import type { Employee } from "../../src/types/employee"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../fixtures/hire-employee-tool-test"
)

describe("HireEmployeeTool", () => {
  let bossManager: BossManager
  let messageService: MessageService
  let stateManager: StateManager
  let roleManager: RoleManager
  let memoryManager: MemoryManager
  let hireEmployeeTool: any
  let project: ProjectInstance

  function findEmployeeByName(name: string): Employee | undefined {
    return stateManager
      .getEmployees()
      .find((employee) => employee.name === name)
  }

  function expectStableEmployee(
    employee: Employee | undefined,
    expected: { name: string; roleId: string; hiredBy: string | null }
  ): Employee {
    expect(employee).toBeDefined()
    expect(employee!.employeeId).toMatch(/^emp_[0-9a-f]{32}$/)
    expect(employee!.employeeId).not.toContain(employee!.name)
    expect(employee!.name).toBe(expected.name)
    expect(employee!.roleId).toBe(expected.roleId)
    expect(employee!.hiredBy).toBe(expected.hiredBy)
    expect("taskId" in employee!).toBe(false)
    expect("role" in employee!).toBe(false)
    return employee!
  }

  async function expectMissingFile(filePath: string): Promise<void> {
    try {
      await fs.stat(filePath)
      throw new Error(`Expected missing file: ${filePath}`)
    } catch (error: any) {
      expect(error.code).toBe("ENOENT")
    }
  }

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建测试角色目录
    const rolesDir = path.join(TEST_WORKSPACE, ".cclover/roles")
    await fs.mkdir(rolesDir, { recursive: true })

    // 创建测试角色文件
    // 1. developer 角色（有 requiredArgs）
    await fs.writeFile(
      path.join(rolesDir, "developer.md"),
      `---
name: developer
id: developer
description: Software developer
requiredArgs:
  projectPath:
    type: string
    description: Path to the project directory
  language:
    type: string
    description: Primary programming language
canHire:
  - tester
  - designer
  - worker
groups:
  - engineering
---

You are a software developer.`
    )

    // 2. tester 角色（无 requiredArgs）
    await fs.writeFile(
      path.join(rolesDir, "tester.md"),
      `---
name: tester
id: tester
description: Software tester
canHire: []
groups:
  - engineering
---

You are a software tester.`
    )

    // 2b. worker 角色（无 requiredArgs，非 soul - 用于跨任务测试）
    await fs.writeFile(
      path.join(rolesDir, "worker.md"),
      `---
name: worker
id: worker
description: General worker
soul: false
canHire: []
groups:
  - engineering
---

You are a general worker.`
    )

    // 3. designer 角色（无 requiredArgs）
    await fs.writeFile(
      path.join(rolesDir, "designer.md"),
      `---
name: designer
id: designer
description: UI/UX designer
canHire: []
groups:
  - design
---

You are a UI/UX designer.`
    )

    // 4. manager 角色（可以雇佣所有 engineering 组）
    await fs.writeFile(
      path.join(rolesDir, "manager.md"),
      `---
name: manager
id: manager
description: Project manager
canHire:
  - group:engineering
groups:
  - management
---

You are a project manager.`
    )

    // 创建 BossManager
    const config: CcloverConfig = {
      bosses: ["boss"],
      projects: [],
    }
    bossManager = new BossManager(config, TEST_WORKSPACE)

    // 创建 StateManager
    stateManager = new StateManager("test-project", TEST_WORKSPACE)

    // 注册 boss 员工
    await stateManager.registerEmployee({
      employeeId: "0-boss",
      name: "boss",
      hiredBy: null,
      roleId: "manager",
      paused: false,
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    })

    // 注册测试员工
    await stateManager.registerEmployee({
      employeeId: "emp_alice",
      name: "alice",
      hiredBy: null,
      roleId: "developer",
      paused: false,
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    })

    await stateManager.registerEmployee({
      employeeId: "emp_bob",
      name: "bob",
      hiredBy: null,
      roleId: "manager",
      paused: false,
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    })

    // 创建 RoleManager 并加载角色
    roleManager = new RoleManager(TEST_WORKSPACE)
    await roleManager.refresh()

    // 创建 MemoryManager
    memoryManager = new MemoryManager(TEST_WORKSPACE)

    // 创建 MessageService
    messageService = new MessageService(
      TEST_WORKSPACE,
      stateManager,
      "test-project",
      bossManager
    )

    // 创建 ProjectInstance mock
    project = {
      directory: TEST_WORKSPACE,
      messageService,
      memoryManager,
      stateManager,
      roleManager,
      eventLoops: new Map(),
    } as any

    // 创建 HireEmployeeTool
    hireEmployeeTool = createHireEmployeeTool(
      stateManager,
      roleManager,
      project,
      bossManager
    )
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  describe("Permission Check", () => {
    test("boss can hire any role", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "charlie",
          id: "charlie",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: charlie)")
      expect(result).toContain("role: developer")

      // 验证员工已注册
      expectStableEmployee(findEmployeeByName("charlie"), {
        name: "charlie",
        roleId: "developer",
        hiredBy: "0-boss",
      })
    })

    test("projected meeting agent can hire with boss-compatible authority", async () => {
      const context = {
        sessionID: "test-session-meeting-agent",
        agent: "manager",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "meeting-hire",
          id: "meeting-hire",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: meeting-hire)")

      expectStableEmployee(findEmployeeByName("meeting-hire"), {
        name: "meeting-hire",
        roleId: "developer",
        hiredBy: "0-manager",
      })
    })

    test("projected meeting agent does not depend on boss-session mapping", async () => {
      const multiBossManager = new BossManager(
        {
          bosses: ["boss-a", "boss-b"],
          projects: [],
        },
        TEST_WORKSPACE,
        roleManager
      )

      // 建立 session 映射（模拟 Boss 先发送消息）
      await multiBossManager.recordSession(
        "boss-b",
        "emp_some_employee",
        "test-session-meeting-agent-boss-b"
      )

      const multiBossTool = createHireEmployeeTool(
        stateManager,
        roleManager,
        project,
        multiBossManager
      )

      const result = await multiBossTool.execute(
        {
          name: "meeting-hire-b",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        {
          sessionID: "test-session-meeting-agent-boss-b",
          agent: "manager",
        } as any
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: meeting-hire-b)")

      expectStableEmployee(findEmployeeByName("meeting-hire-b"), {
        name: "meeting-hire-b",
        roleId: "developer",
        hiredBy: "0-manager",
      })
    })

    test("employee can hire permitted role", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-alice", "emp_alice")

      const context = {
        sessionID: "test-session-alice",
        agent: undefined,
      }

      // alice (developer) 可以雇佣 tester
      const result = await hireEmployeeTool.execute(
        {
          name: "dave",
          id: "dave",
          role: "tester",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: dave)")
      expect(result).toContain("role: tester")

      // 验证员工已注册
      expectStableEmployee(findEmployeeByName("dave"), {
        name: "dave",
        roleId: "tester",
        hiredBy: "emp_alice",
      })

      sessionRegistry.unregister("test-session-alice")
    })

    test("employee cannot hire unpermitted role", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-alice", "emp_alice")

      const context = {
        sessionID: "test-session-alice",
        agent: undefined,
      }

      // alice (developer) 不能雇佣 manager
      const result = await hireEmployeeTool.execute(
        {
          name: "eve",
          id: "eve",
          role: "manager",
        },
        context
      )

      expect(result).toContain("Error: You do not have permission to hire")
      expect(result).toContain("show_hireable_roles")

      // 验证员工未注册
      expect(findEmployeeByName("eve")).toBeUndefined()

      sessionRegistry.unregister("test-session-alice")
    })

    test("employee can hire role via group reference", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-bob", "emp_bob")

      const context = {
        sessionID: "test-session-bob",
        agent: undefined,
      }

      // bob (manager) 可以雇佣 engineering 组的角色（developer, tester）
      const result = await hireEmployeeTool.execute(
        {
          name: "frank",
          id: "frank",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: frank)")
      expect(result).toContain("role: developer")

      expectStableEmployee(findEmployeeByName("frank"), {
        name: "frank",
        roleId: "developer",
        hiredBy: "emp_bob",
      })

      sessionRegistry.unregister("test-session-bob")
    })
  })

  describe("Required Parameters Validation", () => {
    test("rejects hire when requiredArgs missing", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "george",
          id: "george",
          role: "developer",
        },
        context
      )

      expect(result).toContain("Error: Role 'developer' requires")
      expect(result).toContain("projectPath, language")
      expect(result).toContain("Provide them via initial_args parameter")

      // Verify employee was NOT created
      expect(findEmployeeByName("george")).toBeUndefined()
    })

    test("rejects hire when requiredArgs partially provided", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "helen",
          id: "helen",
          role: "developer",
          initial_args: [{ name: "projectPath", value: "/tmp/project" }],
        },
        context
      )

      expect(result).toContain("Error: Role 'developer' requires")
      expect(result).toContain("language")
      expect(result).not.toContain("projectPath")

      // Verify employee was NOT created
      expect(findEmployeeByName("helen")).toBeUndefined()
    })

    test("succeeds when all requiredArgs provided", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "ivan",
          id: "ivan",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: ivan)")
      expect(result).not.toContain("IMPORTANT: This role requires")

      // Verify employee was created
      expectStableEmployee(findEmployeeByName("ivan"), {
        name: "ivan",
        roleId: "developer",
        hiredBy: "0-boss",
      })
    })

    test("persists initial_args to memory", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      await hireEmployeeTool.execute(
        {
          name: "julia",
          id: "julia",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/home/user/project" },
            { name: "language", value: "Python" },
          ],
        },
        context
      )

      // Verify args persisted to memory
      const employee = expectStableEmployee(findEmployeeByName("julia"), {
        name: "julia",
        roleId: "developer",
        hiredBy: "0-boss",
      })
      const memory = await memoryManager.read(employee.employeeId)
      expect(memory.args).toBeDefined()
      expect(memory.args.projectPath).toBe("/home/user/project")
      expect(memory.args.language).toBe("Python")
    })

    test("succeeds for role without requiredArgs", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "kate",
          id: "kate",
          role: "tester",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: kate)")
      expect(result).not.toContain("Error:")

      // Verify employee was created
      expectStableEmployee(findEmployeeByName("kate"), {
        name: "kate",
        roleId: "tester",
        hiredBy: "0-boss",
      })
    })

    test("includes initial_message with requiredArgs", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "leo",
          id: "leo",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "JavaScript" },
          ],
          initial_message: "Welcome to the team!",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: leo)")
      expect(result).toContain("Initial message sent")

      // Verify message was sent
      const employee = expectStableEmployee(findEmployeeByName("leo"), {
        name: "leo",
        roleId: "developer",
        hiredBy: "0-boss",
      })
      const leoClient = messageService.getClient(employee.employeeId)
      const messages = await leoClient.history("0-boss")
      expect(messages.length).toBeGreaterThan(0)
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.content).toBe("Welcome to the team!")
    })
  })

  describe("Error Messages", () => {
    test("suggests show_hireable_roles when role does not exist", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "judy",
          id: "judy",
          role: "nonexistent",
        },
        context
      )

      expect(result).toContain("Error: Role 'nonexistent' does not exist")
      expect(result).toContain("show_hireable_roles")
    })

    test("suggests show_hireable_roles when permission denied", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-alice", "emp_alice")

      const context = {
        sessionID: "test-session-alice",
        agent: undefined,
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "kate",
          id: "kate",
          role: "manager",
        },
        context
      )

      expect(result).toContain("Error: You do not have permission to hire")
      expect(result).toContain("show_hireable_roles")

      sessionRegistry.unregister("test-session-alice")
    })

    test("rejects when employee already exists", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "alice",
          id: "alice", // 已存在
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain("Error: Employee name 'alice' already exists")
    })

    test("rejects when caller cannot be identified", async () => {
      const context = {
        sessionID: "test-session-unknown",
        agent: undefined,
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "leo",
          id: "leo",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain("Error: Unable to identify caller")
    })
  })

  describe("Name Validation", () => {
    test("rejects undefined name", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: undefined,
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain("Error: Employee name is required")

      // 验证员工未注册
      const employees = stateManager.getEmployees()
      const undefinedEmployee = employees.find((e) => e.name === undefined)
      expect(undefinedEmployee).toBeUndefined()
    })

    test("rejects empty string name", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain(
        "Error: Employee name cannot be empty or whitespace"
      )

      // 验证员工未注册
      const employees = stateManager.getEmployees()
      const emptyEmployee = employees.find((e) => e.name === "")
      expect(emptyEmployee).toBeUndefined()
    })

    test("rejects whitespace-only name", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "   ",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain(
        "Error: Employee name cannot be empty or whitespace"
      )

      // 验证员工未注册
      const employees = stateManager.getEmployees()
      const whitespaceEmployee = employees.find((e) => e.name.trim() === "")
      expect(whitespaceEmployee).toBeUndefined()
    })

    test("trims leading and trailing whitespace from name", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "  trimmed-name  ",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: trimmed-name)")

      // 验证员工已注册，且名称已被 trim
      expectStableEmployee(findEmployeeByName("trimmed-name"), {
        name: "trimmed-name",
        roleId: "developer",
        hiredBy: "0-boss",
      })
    })

    test("uses trimmed name in success message", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "  success-test  ",
          role: "tester",
        },
        context
      )

      // 验证成功消息使用 trimmed name
      expect(result).toContain("name: success-test")
      expect(result).not.toContain("name:   success-test  ")
    })

    test("uses trimmed name in required parameters reminder", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "  param-test  ",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      // 验证参数提醒使用 trimmed name
      expect(result).toContain("Successfully hired employee")
      expect(result).not.toContain("Please send a message to '  param-test  '")
    })
  })

  describe("Role Name Usage", () => {
    test("uses role name field instead of filename", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      // 使用角色的 name 字段（developer），而不是文件名
      const result = await hireEmployeeTool.execute(
        {
          name: "mike",
          id: "mike",
          role: "developer", // 这是 name 字段，不是文件名
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: mike)")
      expect(result).toContain("role: developer")

      // 验证员工的角色是 name 字段
      expectStableEmployee(findEmployeeByName("mike"), {
        name: "mike",
        roleId: "developer",
        hiredBy: "0-boss",
      })
    })
  })

  describe("Employee Hired Event", () => {
    test("records employee_hired event after hiring", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      await hireEmployeeTool.execute(
        {
          name: "nancy",
          id: "nancy",
          role: "developer",
          initial_args: [
            { name: "projectPath", value: "/tmp/project" },
            { name: "language", value: "TypeScript" },
          ],
        },
        context
      )

      // 验证事件已记录
      const events = stateManager.getEvents({ limit: 50 })
      const hiredEvent = events.find((e) => e.type === "employee_hired")

      expect(hiredEvent).toBeDefined()
      const employee = expectStableEmployee(findEmployeeByName("nancy"), {
        name: "nancy",
        roleId: "developer",
        hiredBy: "0-boss",
      })
      expect(hiredEvent?.employeeId).toBe(employee.employeeId)
      expect(hiredEvent?.details.hiredBy).toBe("0-boss")
      expect(hiredEvent?.details.roleId).toBe("developer")
      expect("role" in hiredEvent!.details).toBe(false)
      expect(hiredEvent?.details.initialMessage).toBeUndefined()
    })

    test("records employee_hired event with initial_message", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      await hireEmployeeTool.execute(
        {
          name: "oliver",
          id: "oliver",
          role: "tester",
          initial_message: "Welcome aboard!",
        },
        context
      )

      // 验证事件已记录
      const events = stateManager.getEvents({ limit: 50 })
      const hiredEvent = events.find((e) => e.type === "employee_hired")

      expect(hiredEvent).toBeDefined()
      const employee = expectStableEmployee(findEmployeeByName("oliver"), {
        name: "oliver",
        roleId: "tester",
        hiredBy: "0-boss",
      })
      expect(hiredEvent?.employeeId).toBe(employee.employeeId)
      expect(hiredEvent?.details.hiredBy).toBe("0-boss")
      expect(hiredEvent?.details.roleId).toBe("tester")
      expect("role" in hiredEvent!.details).toBe(false)
      expect(hiredEvent?.details.initialMessage).toBe("Welcome aboard!")
    })
  })

  describe("Default Message", () => {
    test("sends default message when no initial_message provided", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "peter",
          id: "peter",
          role: "tester",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: peter)")
      expect(result).toContain("Default message sent")

      // 验证消息已发送
      const employee = expectStableEmployee(findEmployeeByName("peter"), {
        name: "peter",
        roleId: "tester",
        hiredBy: "0-boss",
      })
      const peterClient = messageService.getClient(employee.employeeId)
      const messages = await peterClient.history("0-boss")
      expect(messages.length).toBeGreaterThan(0)

      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.from).toBe("0-boss")
      expect(lastMessage.to).toBe(employee.employeeId)
      expect(lastMessage.content).toContain("Hello! I am boss")
      expect(lastMessage.content).toContain("Your role is tester")
      expect(lastMessage.content).toContain(
        "Please start working according to your role definition"
      )
    })

    test("default message does not include parameters reminder for role without requiredArgs", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      await hireEmployeeTool.execute(
        {
          name: "rachel",
          id: "rachel",
          role: "tester",
        },
        context
      )

      // 验证消息已发送
      const employee = expectStableEmployee(findEmployeeByName("rachel"), {
        name: "rachel",
        roleId: "tester",
        hiredBy: "0-boss",
      })
      const rachelClient = messageService.getClient(employee.employeeId)
      const messages = await rachelClient.history("0-boss")
      expect(messages.length).toBeGreaterThan(0)

      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.content).not.toContain(
        "Your role requires the following parameters"
      )
      expect(lastMessage.content).toContain(
        "Please start working according to your role definition"
      )
    })

    test("sends custom initial_message instead of default message", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "sam",
          id: "sam",
          role: "designer",
          initial_message: "Welcome to the design team!",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'emp_")
      expect(result).toContain("(name: sam)")
      expect(result).toContain("Initial message sent")
      expect(result).not.toContain("Default message sent")

      // 验证消息已发送
      const employee = expectStableEmployee(findEmployeeByName("sam"), {
        name: "sam",
        roleId: "designer",
        hiredBy: "0-boss",
      })
      const samClient = messageService.getClient(employee.employeeId)
      const messages = await samClient.history("0-boss")
      expect(messages.length).toBeGreaterThan(0)

      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.content).toBe("Welcome to the design team!")
    })
  })

  describe("Stable Employee Identity", () => {
    test("boss-hired employee gets stable ID without taskId", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      await hireEmployeeTool.execute(
        {
          name: "tom",
          id: "tom",
          role: "tester", // soul role
        },
        context
      )

      expectStableEmployee(findEmployeeByName("tom"), {
        name: "tom",
        roleId: "tester",
        hiredBy: "0-boss",
      })
    })

    test("employee-hired worker does not inherit parent taskId", async () => {
      // 注册一个稳定 ID 的员工
      await stateManager.registerEmployee({
        employeeId: "emp_parentalice000000000000000000000",
        name: "parent-alice",
        hiredBy: "0-boss",
        roleId: "developer",
        paused: false,
        status: "idle",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      // 注册 alice 到 SessionRegistry
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register(
        "test-session-parent-alice",
        "emp_parentalice000000000000000000000"
      )

      const context = {
        sessionID: "test-session-parent-alice",
        agent: undefined,
      }

      await hireEmployeeTool.execute(
        {
          name: "jerry",
          id: "jerry",
          role: "worker", // non-soul role
        },
        context
      )

      expectStableEmployee(findEmployeeByName("jerry"), {
        name: "jerry",
        roleId: "worker",
        hiredBy: "emp_parentalice000000000000000000000",
      })

      // 清理
      sessionRegistry.unregister("test-session-parent-alice")
    })

    test("employee hire creates no root task or task group files", async () => {
      // 注册一个稳定 ID 的员工
      await stateManager.registerEmployee({
        employeeId: "emp_parentbob00000000000000000000000",
        name: "parent-bob",
        hiredBy: "0-boss",
        roleId: "manager",
        paused: false,
        status: "idle",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      // 注册 bob 到 SessionRegistry
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register(
        "test-session-parent-bob",
        "emp_parentbob00000000000000000000000"
      )

      const context = {
        sessionID: "test-session-parent-bob",
        agent: undefined,
      }

      await hireEmployeeTool.execute(
        {
          name: "worker-kate",
          id: "worker-kate",
          role: "worker", // non-soul role
        },
        context
      )

      expectStableEmployee(findEmployeeByName("worker-kate"), {
        name: "worker-kate",
        roleId: "worker",
        hiredBy: "emp_parentbob00000000000000000000000",
      })
      await expectMissingFile(
        path.join(TEST_WORKSPACE, ".cclover", "root-tasks.yaml")
      )
      await expectMissingFile(
        path.join(TEST_WORKSPACE, ".cclover", "work-items.yaml")
      )

      // 清理
      sessionRegistry.unregister("test-session-parent-bob")
    })
  })
})
