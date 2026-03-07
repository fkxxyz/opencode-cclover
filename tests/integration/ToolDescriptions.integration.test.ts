import { describe, test, expect, beforeAll } from "bun:test"
import { createTools } from "../../src/tools"
import type { MessageService } from "../../src/core/MessageService"
import type { MemoryManager } from "../../src/core/MemoryManager"
import type { StateManager } from "../../src/state/StateManager"
import type { BossManager } from "../../src/core/BossManager"
import type { ProjectInstance } from "../../src/server/ProjectRegistry"

/**
 * Integration tests for tool creation
 *
 * Note: We cannot test the actual parameter descriptions here because they are only
 * available in the tool.definition hook (which OpenCode calls at runtime).
 * These tests verify that all tools are created successfully.
 */

describe("Tool Creation Integration", () => {
  let tools: any

  beforeAll(() => {
    // Create mock dependencies
    const mockDeps = {
      messageService: {} as MessageService,
      memoryManager: {} as MemoryManager,
      opcodeClient: {} as any,
      stateManager: {} as StateManager,
      bossManager: {} as BossManager,
      project: {} as ProjectInstance,
    }
    tools = createTools(mockDeps)
  })

  test("all expected tools are created", () => {
    const expectedTools = [
      "send_message",
      "edit_tasks",
      "create_agent",
      "hire_employee",
      "refresh_roles",
      "show_tasks",
    ]

    for (const toolName of expectedTools) {
      expect(tools[toolName]).toBeDefined()
      expect(typeof tools[toolName].execute).toBe("function")
    }
  })

  test("send_message tool is properly configured", () => {
    const tool = tools.send_message
    expect(tool).toBeDefined()
    expect(tool.description).toBe(
      "Send message to other employees. If any tasks depend on receiving a reply to this message, update those tasks to 'waiting_for_message' status using edit_tasks."
    )
    expect(tool.args).toBeDefined()
    expect(typeof tool.execute).toBe("function")
  })

  test("edit_tasks tool is properly configured", () => {
    const tool = tools.edit_tasks
    expect(tool).toBeDefined()
    expect(tool.description).toBe(
      "Batch edit task list (add, update, delete tasks)"
    )
    expect(tool.args).toBeDefined()
    expect(typeof tool.execute).toBe("function")
  })

  test("create_agent tool is properly configured", () => {
    const tool = tools.create_agent
    expect(tool).toBeDefined()
    expect(tool.description).toBe("Create OpenCode agent to execute task")
    expect(tool.args).toBeDefined()
    expect(typeof tool.execute).toBe("function")
  })

  test("hire_employee tool is properly configured", () => {
    const tool = tools.hire_employee
    expect(tool).toBeDefined()
    expect(tool.description).toBe("Hire new employee")
    expect(tool.args).toBeDefined()
    expect(typeof tool.execute).toBe("function")
  })

  test("refresh_roles tool is properly configured", () => {
    const tool = tools.refresh_roles
    expect(tool).toBeDefined()
    expect(tool.description).toBe(
      "Refresh role list, reload all role definitions from preset, global, and project directories"
    )
    expect(tool.args).toBeDefined()
    expect(typeof tool.execute).toBe("function")
  })

  test("show_tasks tool is properly configured", () => {
    const tool = tools.show_tasks
    expect(tool).toBeDefined()
    expect(tool.description).toBe(
      "Display all tasks with dependency graph visualization"
    )
    expect(tool.args).toBeDefined()
    expect(typeof tool.execute).toBe("function")
  })
})
