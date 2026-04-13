/**
 * Model Configuration Integration Tests
 * Tests EventLoop and CreateAgentTool model injection
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { ModelConfigManager } from "../../src/config/ModelConfigManager"
import type { PresetConfig } from "../../src/config/ModelConfigManager"
import type { CcloverConfig } from "../../src/config/ConfigManager"
import { RoleManager } from "../../src/core/RoleManager"
import { StateManager } from "../../src/state/StateManager"
import { BossManager } from "../../src/core/BossManager"
import { createCreateAgentTool } from "../../src/tools/CreateAgentTool"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import type { Employee } from "../../src/types/index"

describe("Model Configuration Integration", () => {
  const testDir = path.join(
    process.cwd(),
    "tests/fixtures/model-config-integration"
  )
  const projectPath = path.join(testDir, "project")
  const workspaceRoot = path.join(projectPath, ".cclover/workspace")
  const rolesDir = path.join(projectPath, ".cclover", "roles")

  beforeEach(async () => {
    await fs.mkdir(rolesDir, { recursive: true })
    await fs.mkdir(workspaceRoot, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("EventLoop model injection", () => {
    test("should inject model config from role's model_type", async () => {
      const roleContent = `---
name: "Fast Responder"
id: "fast-responder"
description: "A role that uses fast model"
model_type: "fast"
---

You are a fast responder.`

      await fs.writeFile(
        path.join(rolesDir, "fast-responder.md"),
        roleContent,
        "utf-8"
      )

      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          fast: { model: "anthropic/claude-3-haiku-20240307" },
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }
      const presetConfig: PresetConfig = {}
      const modelConfigManager = new ModelConfigManager(
        globalConfig,
        presetConfig
      )
      modelConfigManager.validate()

      const roleManager = new RoleManager(projectPath)
      await roleManager.refresh()

      const role = roleManager.getRole("Fast Responder")
      expect(role).toBeDefined()
      expect(role?.model_type).toBe("fast")

      const modelConfig = modelConfigManager.resolve("fast")
      expect(modelConfig).toEqual({
        providerID: "anthropic",
        modelID: "claude-3-haiku-20240307",
      })
    })

    test("should use default model when role has no model_type", async () => {
      const roleContent = `---
name: "Default Responder"
id: "default-responder"
description: "A role without model_type"
---

You are a default responder.`

      await fs.writeFile(
        path.join(rolesDir, "default-responder.md"),
        roleContent,
        "utf-8"
      )

      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }
      const presetConfig: PresetConfig = {}
      const modelConfigManager = new ModelConfigManager(
        globalConfig,
        presetConfig
      )
      modelConfigManager.validate()

      const roleManager = new RoleManager(projectPath)
      await roleManager.refresh()

      const role = roleManager.getRole("Default Responder")
      expect(role).toBeDefined()
      expect(role?.model_type).toBeUndefined()

      const modelType = role?.model_type || "default"
      expect(modelType).toBe("default")

      const modelConfig = modelConfigManager.resolve(modelType)
      expect(modelConfig).toEqual({
        providerID: "anthropic",
        modelID: "claude-3-5-sonnet-20241022",
      })
    })

    test("should fallback to preset when global config missing", async () => {
      const roleContent = `---
name: "Test Role"
description: "Test role"
model_type: "default"
---

Test role.`

      await fs.writeFile(
        path.join(rolesDir, "Test Role.md"),
        roleContent,
        "utf-8"
      )

      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          fast: { model: "anthropic/claude-3-haiku-20240307" },
        },
      }
      const presetConfig: PresetConfig = {
        modelTypes: {
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }
      const modelConfigManager = new ModelConfigManager(
        globalConfig,
        presetConfig
      )
      modelConfigManager.validate()

      const modelConfig = modelConfigManager.resolve("default")
      expect(modelConfig).toEqual({
        providerID: "anthropic",
        modelID: "claude-3-5-sonnet-20241022",
      })
    })
  })

  describe("CreateAgentTool model injection", () => {
    test("should inject model config when creating agent", async () => {
      const roleContent = `---
name: "Agent Creator"
id: "agent-creator"
description: "Role that creates agents"
model_type: "fast"
---

You create agents.`

      await fs.writeFile(
        path.join(rolesDir, "agent-creator.md"),
        roleContent,
        "utf-8"
      )

      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          fast: { model: "anthropic/claude-3-haiku-20240307" },
        },
      }
      const presetConfig: PresetConfig = {}
      const modelConfigManager = new ModelConfigManager(
        globalConfig,
        presetConfig
      )
      modelConfigManager.validate()

      const roleManager = new RoleManager(projectPath)
      await roleManager.refresh()

      const stateManager = new StateManager(
        "test-project",
        workspaceRoot,
        projectPath
      )
      const bossManager = new BossManager(globalConfig, workspaceRoot)

      const employee: Employee = {
        employeeId: "0-agent-creator",
        name: "agent-creator",
        taskId: 0,
        role: "Agent Creator",
        status: "idle",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }
      await stateManager.registerEmployee(employee)

      const mockOpcodeClient: any = {
        session: {
          create: mock(async () => ({
            data: { id: "test-agent-id" },
          })),
          prompt: mock(async (input: any) => {
            expect(input.body.model).toBeDefined()
            expect(input.body.model.providerID).toBe("anthropic")
            expect(input.body.model.modelID).toBe("claude-3-haiku-20240307")
            return { data: {} }
          }),
        },
      }

      const createAgentTool = createCreateAgentTool(
        mockOpcodeClient,
        stateManager,
        bossManager,
        roleManager,
        modelConfigManager
      )

      // Register session for actor resolution
      sessionRegistry.register("test-session", "0-agent-creator")

      await createAgentTool.execute(
        {
          task_name: "test-task",
          prompt: "test prompt",
        },
        {
          sessionID: "test-session",
          agent: "agent-creator",
        }
      )

      expect(mockOpcodeClient.session.prompt).toHaveBeenCalled()
    })

    test("should not inject model when config returns null", async () => {
      const roleContent = `---
name: "Default Agent Creator"
id: "default-agent-creator"
description: "Role that creates agents with default model"
---

You create agents.`

      await fs.writeFile(
        path.join(rolesDir, "default-agent-creator.md"),
        roleContent,
        "utf-8"
      )

      const globalConfig: CcloverConfig = {
        projects: [],
      }
      const presetConfig: PresetConfig = {}
      const modelConfigManager = new ModelConfigManager(
        globalConfig,
        presetConfig
      )
      modelConfigManager.validate()

      const roleManager = new RoleManager(projectPath)
      await roleManager.refresh()

      const stateManager = new StateManager(
        "test-project",
        workspaceRoot,
        projectPath
      )
      const bossManager = new BossManager(globalConfig, workspaceRoot)

      const employee: Employee = {
        employeeId: "0-default-creator",
        name: "default-creator",
        taskId: 0,
        role: "Default Agent Creator",
        status: "idle",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }
      await stateManager.registerEmployee(employee)

      const mockOpcodeClient: any = {
        session: {
          create: mock(async () => ({
            data: { id: "test-agent-id" },
          })),
          prompt: mock(async (input: any) => {
            expect(input.body.model).toBeUndefined()
            return { data: {} }
          }),
        },
      }

      const createAgentTool = createCreateAgentTool(
        mockOpcodeClient,
        stateManager,
        bossManager,
        roleManager,
        modelConfigManager
      )

      // Register session for actor resolution
      sessionRegistry.register("test-session-2", "0-default-creator")

      await createAgentTool.execute(
        {
          task_name: "test-task",
          prompt: "test prompt",
        },
        {
          sessionID: "test-session-2",
          agent: "default-creator",
        }
      )

      expect(mockOpcodeClient.session.prompt).toHaveBeenCalled()
    })
  })
})
