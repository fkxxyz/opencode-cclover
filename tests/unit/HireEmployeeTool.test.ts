import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { BossManager } from "../../src/core/BossManager"
import { StateManager } from "../../src/state/StateManager"
import { RoleManager } from "../../src/core/RoleManager"
import { MemoryManager } from "../../src/core/MemoryManager"
import { EmployeeWorkSessionManager } from "../../src/core/EmployeeWorkSessionManager"
import { createHireEmployeeTool } from "../../src/tools/HireEmployeeTool"
import type { CcloverConfig } from "../../src/config/ConfigManager"
import type { ProjectInstance } from "../../src/server/ProjectRegistry"
import type { Employee } from "../../src/types/employee"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { createTestEmployee } from "../helpers/employeeFactory"
import {
  getTestProjectPaths,
  resetTestWorkspace,
} from "../helpers/testWorkspace"

const { suiteRoot, projectPath, workspaceRoot } =
  getTestProjectPaths("hire-employee-tool")

describe("HireEmployeeTool", () => {
  let bossManager: BossManager
  let messageService: MessageService
  let stateManager: StateManager
  let roleManager: RoleManager
  let memoryManager: MemoryManager
  let employeeWorkSessionManager: EmployeeWorkSessionManager
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
    await resetTestWorkspace(suiteRoot)

    // 创建测试角色目录
    const rolesDir = path.join(projectPath, ".cclover/roles")
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
    bossManager = new BossManager(config, workspaceRoot)

    // 创建 StateManager
    stateManager = new StateManager("test-project", workspaceRoot, projectPath)

    // 注册 boss 员工
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "boss_boss",
        name: "boss",
        hiredBy: null,
        roleId: "manager",
      } as Partial<Employee>)
    )

    // 注册测试员工
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_alice",
        name: "alice",
        hiredBy: null,
        roleId: "developer",
      })
    )

    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_bob",
        name: "bob",
        hiredBy: null,
        roleId: "manager",
      })
    )

    // 创建 RoleManager 并加载角色
    roleManager = new RoleManager(projectPath)
    await roleManager.refresh()

    // 创建 MemoryManager
    memoryManager = new MemoryManager(workspaceRoot)

    // 创建 EmployeeWorkSessionManager
    employeeWorkSessionManager = new EmployeeWorkSessionManager(
      projectPath,
      stateManager,
      roleManager
    )

    // 创建 MessageService
    messageService = new MessageService(
      workspaceRoot,
      stateManager,
      "test-project",
      bossManager
    )

    // 创建 ProjectInstance mock
    project = {
      directory: projectPath,
      messageService,
      memoryManager,
      employeeWorkSessionManager,
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
    await fs.rm(suiteRoot, { recursive: true, force: true })
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
          role_id: "developer",
          description: "Test employee metadata",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: charlie)")
      expect(result).toContain("role: developer")

      // 验证员工已注册
      expectStableEmployee(findEmployeeByName("charlie"), {
        name: "charlie",
        roleId: "developer",
        hiredBy: "boss_boss",
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
          role_id: "developer",
          description: "Test employee metadata",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: meeting-hire)")

      expectStableEmployee(findEmployeeByName("meeting-hire"), {
        name: "meeting-hire",
        roleId: "developer",
        hiredBy: "boss_manager",
      })
    })

    test("projected meeting agent does not depend on boss-session mapping", async () => {
      const multiBossManager = new BossManager(
        {
          bosses: ["boss-a", "boss-b"],
          projects: [],
        },
        workspaceRoot,
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
          role_id: "developer",
          description: "Test employee metadata",
        },
        {
          sessionID: "test-session-meeting-agent-boss-b",
          agent: "manager",
        } as any
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: meeting-hire-b)")

      expectStableEmployee(findEmployeeByName("meeting-hire-b"), {
        name: "meeting-hire-b",
        roleId: "developer",
        hiredBy: "boss_manager",
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
          role_id: "tester",
          description: "Test employee metadata",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
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

    test("employee work session caller can hire permitted role", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      const aliceEws =
        await employeeWorkSessionManager.createEmployeeWorkSession({
          employeeId: "emp_alice",
          description: "Alice runtime session",
          args: {
            projectPath: "/tmp/project",
            language: "TypeScript",
          },
          createdBy: "boss_boss" as any,
        })
      sessionRegistry.register(
        "test-session-alice-ews",
        aliceEws.employeeWorkSessionId
      )

      const result = await hireEmployeeTool.execute(
        {
          name: "ews-dave",
          role_id: "tester",
          description: "Test employee metadata",
        },
        {
          sessionID: "test-session-alice-ews",
          agent: undefined,
        }
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: ews-dave)")
      expectStableEmployee(findEmployeeByName("ews-dave"), {
        name: "ews-dave",
        roleId: "tester",
        hiredBy: aliceEws.employeeWorkSessionId,
      })

      sessionRegistry.unregister("test-session-alice-ews")
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
          role_id: "manager",
          description: "Test employee metadata",
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
          role_id: "developer",
          description: "Test employee metadata",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
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

  describe("Metadata-only hire contract", () => {
    test("ignores role requiredArgs during metadata hire", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "george",
          id: "george",
          role_id: "developer",
          description: "Test employee metadata",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: george)")
      expect(result).not.toContain("requires")
      expect(result).not.toContain("initial_args")

      expectStableEmployee(findEmployeeByName("george"), {
        name: "george",
        roleId: "developer",
        hiredBy: "boss_boss",
      })
    })

    test("ignores supplied initial_args and creates metadata only", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "helen",
          id: "helen",
          role_id: "developer",
          description: "Test employee metadata",
          initial_args: [{ name: "projectPath", value: "/tmp/project" }],
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: helen)")
      expect(result).not.toContain("requires")
      expect(result).not.toContain("initial_args")

      const employee = expectStableEmployee(findEmployeeByName("helen"), {
        name: "helen",
        roleId: "developer",
        hiredBy: "boss_boss",
      })
      const memory = await memoryManager.read(employee.employeeId)
      expect(memory.args).toEqual({})
    })

    test("creates developer metadata without required-parameter reminder", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "ivan",
          id: "ivan",
          role_id: "developer",
          description: "Test employee metadata",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: ivan)")
      expect(result).not.toContain("requires")
      expect(result).not.toContain("Please send a message")

      expectStableEmployee(findEmployeeByName("ivan"), {
        name: "ivan",
        roleId: "developer",
        hiredBy: "boss_boss",
      })
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
          role_id: "tester",
          description: "Test employee metadata",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: kate)")
      expect(result).not.toContain("Error:")

      // Verify employee was created
      expectStableEmployee(findEmployeeByName("kate"), {
        name: "kate",
        roleId: "tester",
        hiredBy: "boss_boss",
      })
    })

    test("ignores initial_message during metadata hire", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "leo",
          id: "leo",
          role_id: "developer",
          description: "Test employee metadata",
          initial_message: "Welcome to the team!",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: leo)")
      expect(result).not.toContain("Initial message sent")
      expect(result).not.toContain("Default message sent")

      const employee = expectStableEmployee(findEmployeeByName("leo"), {
        name: "leo",
        roleId: "developer",
        hiredBy: "boss_boss",
      })
      const leoClient = messageService.getClient(employee.employeeId)
      const messages = await leoClient.history("boss_boss")
      expect(messages).toEqual([])
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
          role_id: "nonexistent",
          description: "Test employee metadata",
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
          role_id: "manager",
          description: "Test employee metadata",
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
          role_id: "developer",
          description: "Test employee metadata",
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
          role_id: "developer",
          description: "Test employee metadata",
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
          role_id: "developer",
          description: "Test employee metadata",
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
          role_id: "developer",
          description: "Test employee metadata",
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
          role_id: "developer",
          description: "Test employee metadata",
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
          role_id: "developer",
          description: "Test employee metadata",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: trimmed-name)")

      // 验证员工已注册，且名称已被 trim
      expectStableEmployee(findEmployeeByName("trimmed-name"), {
        name: "trimmed-name",
        roleId: "developer",
        hiredBy: "boss_boss",
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
          role_id: "tester",
          description: "Test employee metadata",
        },
        context
      )

      // 验证成功消息使用 trimmed name
      expect(result).toContain("name: success-test")
      expect(result).not.toContain("name:   success-test  ")
    })

    test("uses trimmed name in metadata success message", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "  param-test  ",
          role_id: "developer",
          description: "Test employee metadata",
        },
        context
      )

      // 验证 metadata 成功消息使用 trimmed name
      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: param-test)")
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
          role_id: "developer", // 这是 name 字段，不是文件名
          description: "Test employee metadata",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: mike)")
      expect(result).toContain("role: developer")

      // 验证员工的角色是 name 字段
      expectStableEmployee(findEmployeeByName("mike"), {
        name: "mike",
        roleId: "developer",
        hiredBy: "boss_boss",
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
          role_id: "developer",
          description: "Test employee metadata",
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
        hiredBy: "boss_boss",
      })
      expect(hiredEvent?.employeeId).toBe(employee.employeeId)
      expect(hiredEvent?.details.hiredBy).toBe("boss_boss")
      expect(hiredEvent?.details.roleId).toBe("developer")
      expect("role" in hiredEvent!.details).toBe(false)
      expect(hiredEvent?.details.initialMessage).toBeUndefined()
    })

    test("employee_hired event excludes ignored initial_message", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      await hireEmployeeTool.execute(
        {
          name: "oliver",
          id: "oliver",
          role_id: "tester",
          description: "Test employee metadata",
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
        hiredBy: "boss_boss",
      })
      expect(hiredEvent?.employeeId).toBe(employee.employeeId)
      expect(hiredEvent?.details.hiredBy).toBe("boss_boss")
      expect(hiredEvent?.details.roleId).toBe("tester")
      expect("role" in hiredEvent!.details).toBe(false)
      expect(hiredEvent?.details.initialMessage).toBeUndefined()
    })
  })

  describe("No automatic hire messages", () => {
    test("does not send default message when no initial_message provided", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "peter",
          id: "peter",
          role_id: "tester",
          description: "Test employee metadata",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: peter)")
      expect(result).not.toContain("Default message sent")
      expect(result).not.toContain("Initial message sent")

      const employee = expectStableEmployee(findEmployeeByName("peter"), {
        name: "peter",
        roleId: "tester",
        hiredBy: "boss_boss",
      })
      const peterClient = messageService.getClient(employee.employeeId)
      const messages = await peterClient.history("boss_boss")
      expect(messages).toEqual([])
    })

    test("does not send parameter reminder for role without requiredArgs", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      await hireEmployeeTool.execute(
        {
          name: "rachel",
          id: "rachel",
          role_id: "tester",
          description: "Test employee metadata",
        },
        context
      )

      const employee = expectStableEmployee(findEmployeeByName("rachel"), {
        name: "rachel",
        roleId: "tester",
        hiredBy: "boss_boss",
      })
      const rachelClient = messageService.getClient(employee.employeeId)
      const messages = await rachelClient.history("boss_boss")
      expect(messages).toEqual([])
    })

    test("ignores custom initial_message instead of sending it", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "sam",
          id: "sam",
          role_id: "designer",
          description: "Test employee metadata",
          initial_message: "Welcome to the design team!",
        },
        context
      )

      expect(result).toContain("Successfully created employee metadata 'emp_")
      expect(result).toContain("(name: sam)")
      expect(result).not.toContain("Initial message sent")
      expect(result).not.toContain("Default message sent")

      const employee = expectStableEmployee(findEmployeeByName("sam"), {
        name: "sam",
        roleId: "designer",
        hiredBy: "boss_boss",
      })
      const samClient = messageService.getClient(employee.employeeId)
      const messages = await samClient.history("boss_boss")
      expect(messages).toEqual([])
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
          role_id: "tester",
          description: "Test employee metadata", // soul role
        },
        context
      )

      expectStableEmployee(findEmployeeByName("tom"), {
        name: "tom",
        roleId: "tester",
        hiredBy: "boss_boss",
      })
    })

    test("employee-hired worker does not inherit parent taskId", async () => {
      // 注册一个稳定 ID 的员工
      await stateManager.registerEmployee(
        createTestEmployee({
          employeeId: "emp_parentalice000000000000000000000",
          name: "parent-alice",
          hiredBy: "boss_boss",
          roleId: "developer",
        })
      )

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
          role_id: "worker",
          description: "Test employee metadata", // non-soul role
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
      await stateManager.registerEmployee(
        createTestEmployee({
          employeeId: "emp_parentbob00000000000000000000000",
          name: "parent-bob",
          hiredBy: "boss_boss",
          roleId: "manager",
        })
      )

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
          role_id: "worker",
          description: "Test employee metadata", // non-soul role
        },
        context
      )

      expectStableEmployee(findEmployeeByName("worker-kate"), {
        name: "worker-kate",
        roleId: "worker",
        hiredBy: "emp_parentbob00000000000000000000000",
      })
      await expectMissingFile(
        path.join(workspaceRoot, ".cclover", "root-tasks.yaml")
      )
      await expectMissingFile(
        path.join(workspaceRoot, ".cclover", "work-items.yaml")
      )

      // 清理
      sessionRegistry.unregister("test-session-parent-bob")
    })
  })
})
