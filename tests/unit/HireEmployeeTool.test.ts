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
description: Software tester
canHire: []
groups:
  - engineering
---

You are a software tester.`
    )

    // 3. designer 角色（无 requiredArgs）
    await fs.writeFile(
      path.join(rolesDir, "designer.md"),
      `---
name: designer
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
    bossManager = new BossManager(config)

    // 创建 StateManager
    stateManager = new StateManager("test-project", TEST_WORKSPACE)

    // 注册测试员工
    await stateManager.registerEmployee({
      name: "alice",
      role: "developer",
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    await stateManager.registerEmployee({
      name: "bob",
      role: "manager",
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
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
          role: "developer",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'charlie'")
      expect(result).toContain("role: developer")

      // 验证员工已注册
      const employee = stateManager.getEmployee("charlie")
      expect(employee).toBeDefined()
      expect(employee?.role).toBe("developer")
    })

    test("employee can hire permitted role", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-alice", "alice")

      const context = {
        sessionID: "test-session-alice",
        agent: undefined,
      }

      // alice (developer) 可以雇佣 tester
      const result = await hireEmployeeTool.execute(
        {
          name: "dave",
          role: "tester",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'dave'")
      expect(result).toContain("role: tester")

      // 验证员工已注册
      const employee = stateManager.getEmployee("dave")
      expect(employee).toBeDefined()
      expect(employee?.role).toBe("tester")

      sessionRegistry.unregister("test-session-alice")
    })

    test("employee cannot hire unpermitted role", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-alice", "alice")

      const context = {
        sessionID: "test-session-alice",
        agent: undefined,
      }

      // alice (developer) 不能雇佣 manager
      const result = await hireEmployeeTool.execute(
        {
          name: "eve",
          role: "manager",
        },
        context
      )

      expect(result).toContain("Error: You do not have permission to hire")
      expect(result).toContain("show_hireable_roles")

      // 验证员工未注册
      const employee = stateManager.getEmployee("eve")
      expect(employee).toBeUndefined()

      sessionRegistry.unregister("test-session-alice")
    })

    test("employee can hire role via group reference", async () => {
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-bob", "bob")

      const context = {
        sessionID: "test-session-bob",
        agent: undefined,
      }

      // bob (manager) 可以雇佣 engineering 组的角色（developer, tester）
      const result = await hireEmployeeTool.execute(
        {
          name: "frank",
          role: "developer",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'frank'")
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
          role: "developer",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'george'")
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
          role: "tester",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'helen'")
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
          role: "developer",
          initial_message: "Welcome to the team!",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'ivan'")
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
      sessionRegistry.register("test-session-alice", "alice")

      const context = {
        sessionID: "test-session-alice",
        agent: undefined,
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "kate",
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
          name: "alice", // 已存在
          role: "developer",
        },
        context
      )

      expect(result).toContain("Error: Employee 'alice' already exists")
    })

    test("rejects when caller cannot be identified", async () => {
      const context = {
        sessionID: "test-session-unknown",
        agent: undefined,
      }

      const result = await hireEmployeeTool.execute(
        {
          name: "leo",
          role: "developer",
        },
        context
      )

      expect(result).toContain("Error: Unable to identify caller")
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
          role: "developer", // 这是 name 字段，不是文件名
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'mike'")
      expect(result).toContain("role: developer")

      // 验证员工的角色是 name 字段
      const employee = stateManager.getEmployee("mike")
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
          role: "developer",
        },
        context
      )

      // 验证事件已记录
      const events = stateManager.getEvents("nancy")
      const hiredEvent = events.find((e) => e.type === "employee_hired")

      expect(hiredEvent).toBeDefined()
      expect(hiredEvent?.employeeName).toBe("nancy")
      expect(hiredEvent?.details.hiredBy).toBe("boss")
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
          role: "tester",
          initial_message: "Welcome aboard!",
        },
        context
      )

      // 验证事件已记录
      const events = stateManager.getEvents("oliver")
      const hiredEvent = events.find((e) => e.type === "employee_hired")

      expect(hiredEvent).toBeDefined()
      expect(hiredEvent?.employeeName).toBe("oliver")
      expect(hiredEvent?.details.hiredBy).toBe("boss")
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
          role: "tester",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'peter'")
      expect(result).toContain("Default message sent")

      // 验证消息已发送
      const peterClient = messageService.getClient("peter")
      const messages = await peterClient.history("boss")
      expect(messages.length).toBeGreaterThan(0)

      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.from).toBe("boss")
      expect(lastMessage.to).toBe("peter")
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
          role: "developer",
        },
        context
      )

      // 验证消息已发送
      const quinnClient = messageService.getClient("quinn")
      const messages = await quinnClient.history("boss")
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
          role: "tester",
        },
        context
      )

      // 验证消息已发送
      const rachelClient = messageService.getClient("rachel")
      const messages = await rachelClient.history("boss")
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
          role: "designer",
          initial_message: "Welcome to the design team!",
        },
        context
      )

      expect(result).toContain("Successfully hired employee 'sam'")
      expect(result).toContain("Initial message sent")
      expect(result).not.toContain("Default message sent")

      // 验证消息已发送
      const samClient = messageService.getClient("sam")
      const messages = await samClient.history("boss")
      expect(messages.length).toBeGreaterThan(0)

      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.content).toBe("Welcome to the design team!")
    })
  })
})
