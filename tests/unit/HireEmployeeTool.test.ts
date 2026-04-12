import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { BossManager } from "../../src/core/BossManager"
import { StateManager } from "../../src/state/StateManager"
import { RoleManager } from "../../src/core/RoleManager"
import { MemoryManager } from "../../src/core/MemoryManager"
import { createHireEmployeeTool } from "../../src/tools/HireEmployeeTool"
import type { CcloverConfig } from "../../src/config/ConfigManager"
import type { ProjectInstance } from "../../src/server/ProjectRegistry"
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
      id: "boss",
      taskId: 0,
      hiredBy: null,
      role: "manager",
      paused: false,
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    })

    // 注册测试员工
    await stateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      id: "alice",
      taskId: 0,
      hiredBy: null,
      role: "developer",
      paused: false,
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    })

    await stateManager.registerEmployee({
      employeeId: "0-bob",
      name: "bob",
      id: "bob",
      taskId: 0,
      hiredBy: null,
      role: "manager",
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
        },
        context
      )

      expect(result).toContain(
        "Successfully hired employee '0-charlie' (name: charlie)"
      )
      expect(result).toContain("role: developer")

      // 验证员工已注册
      const employee = stateManager.getEmployee("0-charlie")
      expect(employee).toBeDefined()
      expect(employee?.role).toBe("developer")
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
        },
        context
      )

      expect(result).toContain(
        "Successfully hired employee '0-meeting-hire' (name: meeting-hire)"
      )

      const employee = stateManager.getEmployee("0-meeting-hire")
      expect(employee).toBeDefined()
      expect(employee?.role).toBe("developer")
      // Meeting-mode agent uses role.id as identity
      expect(employee?.hiredBy).toBe("0-manager")
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
        "0-some-employee",
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
          id: "meeting-hire-b",
          role: "developer",
        },
        {
          sessionID: "test-session-meeting-agent-boss-b",
          agent: "manager",
        } as any
      )

      expect(result).toContain(
        "Successfully hired employee '0-meeting-hire-b' (name: meeting-hire-b)"
      )

      const employee = stateManager.getEmployee("0-meeting-hire-b")
      expect(employee).toBeDefined()
      // Meeting-mode agent uses role.id, not Boss from session
      expect(employee?.hiredBy).toBe("0-manager")
    })

    test("employee can hire permitted role", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-alice", "0-alice")

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

      expect(result).toContain(
        "Successfully hired employee '0-dave' (name: dave)"
      )
      expect(result).toContain("role: tester")

      // 验证员工已注册
      const employee = stateManager.getEmployee("0-dave")
      expect(employee).toBeDefined()
      expect(employee?.role).toBe("tester")

      sessionRegistry.unregister("test-session-alice")
    })

    test("employee cannot hire unpermitted role", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-alice", "0-alice")

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
      const employee = stateManager.getEmployee("0-eve")
      expect(employee).toBeUndefined()

      sessionRegistry.unregister("test-session-alice")
    })

    test("employee can hire role via group reference", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-bob", "0-bob")

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
        },
        context
      )

      expect(result).toContain(
        "Successfully hired employee '0-frank' (name: frank)"
      )
      expect(result).toContain("role: developer")

      sessionRegistry.unregister("test-session-bob")
    })
  })

  describe("Required Parameters Reminder", () => {
    test("displays required parameters for role with requiredArgs", async () => {
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

      expect(result).toContain(
        "Successfully hired employee '0-george' (name: george)"
      )
      expect(result).toContain(
        "IMPORTANT: This role requires the following parameters"
      )
      expect(result).toContain(
        "projectPath (string): Path to the project directory"
      )
      expect(result).toContain(
        "language (string): Primary programming language"
      )
      expect(result).toContain(
        "Please send a message to 'george' with these parameters"
      )
    })

    test("no reminder for role without requiredArgs", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "helen",
          id: "helen",
          role: "tester",
        },
        context
      )

      expect(result).toContain(
        "Successfully hired employee '0-helen' (name: helen)"
      )
      expect(result).not.toContain("IMPORTANT: This role requires")
    })

    test("includes initial message sent confirmation", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "ivan",
          id: "ivan",
          role: "developer",
          initial_message: "Welcome to the team!",
        },
        context
      )

      expect(result).toContain(
        "Successfully hired employee '0-ivan' (name: ivan)"
      )
      expect(result).toContain("IMPORTANT: This role requires")
      expect(result).toContain("Initial message sent")
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
      sessionRegistry.register("test-session-alice", "0-alice")

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
        },
        context
      )

      expect(result).toContain("Error: Employee '0-alice' already exists")
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
        },
        context
      )

      expect(result).toContain(
        "Successfully hired employee '0-trimmed-name' (name: trimmed-name)"
      )

      // 验证员工已注册，且名称已被 trim
      const employee = stateManager.getEmployee("0-trimmed-name")
      expect(employee).toBeDefined()
      expect(employee?.name).toBe("trimmed-name")
      expect(employee?.employeeId).toBe("0-trimmed-name")
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
        },
        context
      )

      // 验证参数提醒使用 trimmed name
      expect(result).toContain("Please send a message to 'param-test'")
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
        },
        context
      )

      expect(result).toContain(
        "Successfully hired employee '0-mike' (name: mike)"
      )
      expect(result).toContain("role: developer")

      // 验证员工的角色是 name 字段
      const employee = stateManager.getEmployee("0-mike")
      expect(employee?.role).toBe("developer")
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
        },
        context
      )

      // 验证事件已记录
      const events = stateManager.getEvents({ limit: 50 })
      const hiredEvent = events.find((e) => e.type === "employee_hired")

      expect(hiredEvent).toBeDefined()
      expect(hiredEvent?.employeeId).toBe("0-nancy")
      expect(hiredEvent?.details.hiredBy).toBe("0-boss")
      expect(hiredEvent?.details.role).toBe("developer")
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
      expect(hiredEvent?.employeeId).toBe("0-oliver")
      expect(hiredEvent?.details.hiredBy).toBe("0-boss")
      expect(hiredEvent?.details.role).toBe("tester")
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

      expect(result).toContain(
        "Successfully hired employee '0-peter' (name: peter)"
      )
      expect(result).toContain("Default message sent")

      // 验证消息已发送
      const peterClient = messageService.getClient("0-peter")
      const messages = await peterClient.history("0-boss")
      expect(messages.length).toBeGreaterThan(0)

      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.from).toBe("0-boss")
      expect(lastMessage.to).toBe("0-peter")
      expect(lastMessage.content).toContain("Hello! I am boss")
      expect(lastMessage.content).toContain("Your role is tester")
      expect(lastMessage.content).toContain(
        "Please start working according to your role definition"
      )
    })

    test("default message includes role parameters reminder for role with requiredArgs", async () => {
      const context = {
        sessionID: "test-session-boss",
        agent: "boss",
      }

      await hireEmployeeTool.execute(
        {
          name: "quinn",
          id: "quinn",
          role: "developer",
        },
        context
      )

      // 验证消息已发送
      const quinnClient = messageService.getClient("0-quinn")
      const messages = await quinnClient.history("0-boss")
      expect(messages.length).toBeGreaterThan(0)

      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.content).toContain(
        "Your role requires the following parameters"
      )
      expect(lastMessage.content).toContain("projectPath (string)")
      expect(lastMessage.content).toContain("Path to the project directory")
      expect(lastMessage.content).toContain("language (string)")
      expect(lastMessage.content).toContain("Primary programming language")
      expect(lastMessage.content).toContain(
        "Please check your memory to confirm these parameters are provided"
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
      const rachelClient = messageService.getClient("0-rachel")
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

      expect(result).toContain(
        "Successfully hired employee '0-sam' (name: sam)"
      )
      expect(result).toContain("Initial message sent")
      expect(result).not.toContain("Default message sent")

      // 验证消息已发送
      const samClient = messageService.getClient("0-sam")
      const messages = await samClient.history("0-boss")
      expect(messages.length).toBeGreaterThan(0)

      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.content).toBe("Welcome to the design team!")
    })
  })

  describe("TaskId Inheritance", () => {
    test("boss-hired soul employee gets taskId=0", async () => {
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

      // 验证员工的 taskId
      const employee = await stateManager.getEmployee("0-tom")
      expect(employee).toBeDefined()
      expect(employee!.taskId).toBe(0)
      expect(employee!.employeeId).toBe("0-tom")
      expect(employee!.hiredBy).toBe("0-boss") // Boss-hired employees have hiredBy set to boss ID
    })

    test("employee-hired worker inherits hirer's taskId", async () => {
      // 注册一个 taskId=1 的员工
      await stateManager.registerEmployee({
        employeeId: "1-alice",
        name: "alice",
        id: "alice",
        taskId: 1,
        hiredBy: "0-boss",
        role: "developer",
        paused: false,
        status: "idle",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      // 注册 alice 到 SessionRegistry
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-alice", "1-alice")

      const context = {
        sessionID: "test-session-alice",
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

      // 验证新员工继承了 alice 的 taskId
      const employee = await stateManager.getEmployee("1-jerry")
      expect(employee).toBeDefined()
      expect(employee!.taskId).toBe(1)
      expect(employee!.employeeId).toBe("1-jerry")
      expect(employee!.hiredBy).toBe("1-alice")

      // 清理
      sessionRegistry.unregister("test-session-alice")
    })

    test("employee in different task can hire with correct taskId", async () => {
      // 注册一个 taskId=2 的员工
      await stateManager.registerEmployee({
        employeeId: "2-bob",
        name: "bob",
        id: "bob",
        taskId: 2,
        hiredBy: "0-boss",
        role: "manager",
        paused: false,
        status: "idle",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      // 注册 bob 到 SessionRegistry
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-bob", "2-bob")

      const context = {
        sessionID: "test-session-bob",
        agent: undefined,
      }

      await hireEmployeeTool.execute(
        {
          name: "kate",
          id: "kate",
          role: "worker", // non-soul role
        },
        context
      )

      // 验证新员工的 taskId=2
      const employee = await stateManager.getEmployee("2-kate")
      expect(employee).toBeDefined()
      expect(employee!.taskId).toBe(2)
      expect(employee!.employeeId).toBe("2-kate")
      expect(employee!.hiredBy).toBe("2-bob")

      // 清理
      sessionRegistry.unregister("test-session-bob")
    })
  })
})
