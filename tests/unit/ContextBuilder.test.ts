/**
 * ContextBuilder 单元测试
 */

import { describe, test, expect } from "bun:test"
import {
  buildSystemPrompt,
  buildEventMessage,
  getExecutableTasks,
  type Event,
} from "../../src/utils/ContextBuilder"
import type { Task, Memory, RoleMetadata } from "../../src/types"

describe("ContextBuilder", () => {
  describe("buildSystemPrompt", () => {
    test("should build system prompt with role and memory", () => {
      const rolePrompt = "你是一个计算器员工"
      const memory: Memory = {
        knowledge: ["我擅长数学计算", "用户经常问我简单问题"],
        tasks: [],
        args: {},
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "test-role",
        ".cclover/workspace"
      )
      expect(result).toContain("你是一个计算器员工")
      expect(result).toContain("我擅长数学计算")
      expect(result).toContain("用户经常问我简单问题")
    })

    test("should include custom data in JSON format", () => {
      const rolePrompt = "你是一个 PM"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {
          team_members: ["alice", "bob"],
          current_sprint: "sprint_5",
        },
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "pm",
        ".cclover/workspace"
      )
      expect(result).toContain("team_members")
      expect(result).toContain("alice")
      expect(result).toContain("sprint_5")
    })

    test("should include task graph", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [
          {
            name: "任务1",
            status: "completed",
            description: "完成的任务",
            dependencies: [],
            created: "2026-03-01T10:00:00Z",
          },
        ],
        args: {},
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "employee",
        ".cclover/workspace"
      )
      expect(result).toContain("Task Management")
      expect(result).toContain("graph TD")
    })

    test("should include workspace files section with employee name", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {},
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace"
      )
      expect(result).toContain("# Workspace Files")
      expect(result).toContain(".cclover/workspace/employees/alice/")
      expect(result).toContain("messages/{peer}/chat.yaml")
      expect(result).toContain("events.jsonl")
      expect(result).toContain("memory.yaml")
    })

    test("should include supervisor section when supervisor exists", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {},
      }
      const supervisor = { name: "bob", role: "project-manager" }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace",
        undefined,
        supervisor
      )
      expect(result).toContain("# Your Supervisor")
      expect(result).toContain("You were hired by: bob (Role: project-manager)")
      expect(result).toContain(
        "If you have any questions or difficulties, please send a message to your supervisor for help."
      )
    })

    test("should omit supervisor section when supervisor is undefined", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {},
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace"
      )
      expect(result).not.toContain("# Your Supervisor")
      expect(result).not.toContain("You were hired by:")
    })

    test("should place workspace files after current memory", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: ["知识1"],
        tasks: [],
        args: {},
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace"
      )
      const memoryIndex = result.indexOf("# Current Memory")
      const workspaceIndex = result.indexOf("# Workspace Files")
      expect(workspaceIndex).toBeGreaterThan(memoryIndex)
    })

    test("should place supervisor section before task management", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [
          {
            name: "任务1",
            status: "pending",
            description: "待办任务",
            dependencies: [],
            created: "2026-03-01T10:00:00Z",
          },
        ],
        args: {},
      }
      const supervisor = { name: "bob", role: "pm" }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace",
        undefined,
        supervisor
      )
      const supervisorIndex = result.indexOf("# Your Supervisor")
      const taskIndex = result.indexOf("# Task Management")
      expect(supervisorIndex).toBeGreaterThan(0)
      expect(taskIndex).toBeGreaterThan(supervisorIndex)
    })

    test("should include resolved role contexts in system prompt", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {},
      }
      const roleMetadata: RoleMetadata = {
        name: "developer",
        id: "developer",
        description: "A developer role",
        contextIds: ["coding-standards"],
        resolvedContexts: [
          {
            id: "coding-standards",
            description: "Follow coding standards strictly",
            documents: [
              {
                path: "/tmp/context-doc.md",
                content: "# Coding Standards\n\nUse double quotes.",
              },
            ],
          },
        ],
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace",
        roleMetadata
      )

      expect(result).toContain("# Role Context Materials")
      expect(result).toContain("coding-standards")
      expect(result).toContain("Follow coding standards strictly")
      expect(result).toContain("/tmp/context-doc.md")
      expect(result).toContain("Use double quotes.")
    })
  })

  describe("buildEventMessage", () => {
    test("should format message event", () => {
      const event: Event = {
        projectId: "test",
        type: "message",
        timestamp: "2026-03-01T10:00:00Z",
        details: {
          from: "alice",
          content: "计算 1+1",
        },
      }

      const result = buildEventMessage(event)
      expect(result).toContain("Type: message")
      expect(result).toContain("From: alice")
      expect(result).toContain("Content: 计算 1+1")
    })

    test("should format agent_completed event", () => {
      const event: Event = {
        projectId: "test",
        type: "agent_completed",
        timestamp: "2026-03-01T10:05:00Z",
        details: {
          agentId: "agent_001",
          taskName: "复杂计算",
          result: "结果是 456831",
        },
      }

      const result = buildEventMessage(event)
      expect(result).toContain("Type: agent_completed")
      expect(result).toContain("Agent ID: agent_001")
      expect(result).toContain("Related Task: 复杂计算")
      expect(result).toContain("Result: 结果是 456831")
    })
  })

  describe("getExecutableTasks", () => {
    test("should return tasks with no dependencies", () => {
      const tasks: Task[] = [
        {
          name: "任务A",
          status: "pending",
          description: "独立任务",
          dependencies: [],
          created: "2026-03-01T10:00:00Z",
        },
      ]

      const result = getExecutableTasks(tasks)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("任务A")
    })

    test("should return tasks whose dependencies are completed", () => {
      const tasks: Task[] = [
        {
          name: "任务A",
          status: "completed",
          description: "已完成",
          dependencies: [],
          created: "2026-03-01T10:00:00Z",
        },
        {
          name: "任务B",
          status: "completed",
          description: "已完成",
          dependencies: [],
          created: "2026-03-01T10:01:00Z",
        },
        {
          name: "任务C",
          status: "pending",
          description: "等待执行",
          dependencies: ["任务A", "任务B"],
          created: "2026-03-01T10:02:00Z",
        },
      ]

      const result = getExecutableTasks(tasks)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("任务C")
    })

    test("should not return tasks with incomplete dependencies", () => {
      const tasks: Task[] = [
        {
          name: "任务A",
          status: "completed",
          description: "已完成",
          dependencies: [],
          created: "2026-03-01T10:00:00Z",
        },
        {
          name: "任务B",
          status: "in_progress",
          description: "进行中",
          dependencies: [],
          created: "2026-03-01T10:01:00Z",
        },
        {
          name: "任务C",
          status: "pending",
          description: "等待执行",
          dependencies: ["任务A", "任务B"],
          created: "2026-03-01T10:02:00Z",
        },
      ]

      const result = getExecutableTasks(tasks)
      expect(result).toHaveLength(0)
    })

    test("should not return non-pending tasks", () => {
      const tasks: Task[] = [
        {
          name: "任务A",
          status: "completed",
          description: "已完成",
          dependencies: [],
          created: "2026-03-01T10:00:00Z",
        },
        {
          name: "任务B",
          status: "in_progress",
          description: "进行中",
          dependencies: [],
          created: "2026-03-01T10:01:00Z",
        },
      ]

      const result = getExecutableTasks(tasks)
      expect(result).toHaveLength(0)
    })
  })

  describe("Role Arguments and Missing Parameters", () => {
    test("should display args before knowledge", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: ["知识1", "知识2"],
        tasks: [],
        args: {
          project_name: "test-project",
          team_size: 5,
        },
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace"
      )

      const argsIndex = result.indexOf("## Role Arguments")
      const knowledgeIndex = result.indexOf("## Knowledge")
      expect(argsIndex).toBeGreaterThan(0)
      expect(knowledgeIndex).toBeGreaterThan(argsIndex)
      expect(result).toContain("project_name")
      expect(result).toContain("test-project")
    })

    test("should handle empty args", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {},
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace"
      )

      // Should not show Role Arguments section when args is empty
      expect(result).not.toContain("## Role Arguments")
    })

    test("should show missing required parameters", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {
          project_name: "test-project",
        },
      }
      const roleMetadata: RoleMetadata = {
        name: "developer",
        id: "developer",
        description: "A developer role",
        requiredArgs: {
          project_name: {
            type: "string",
            description: "The name of the project",
          },
          repository_url: {
            type: "string",
            description: "The URL of the git repository",
          },
          branch: {
            type: "string",
            description: "The branch to work on",
          },
        },
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace",
        roleMetadata
      )

      expect(result).toContain("## ⚠️ Missing Required Parameters")
      expect(result).toContain("repository_url")
      expect(result).toContain("branch")
      expect(result).toContain("The URL of the git repository")
      expect(result).toContain("The branch to work on")

      // project_name should appear in Role Arguments but not in Missing Parameters section
      const missingParamsStart = result.indexOf(
        "## ⚠️ Missing Required Parameters"
      )
      const missingParamsEnd = result.indexOf("# Workspace Files")
      const missingParamsSection = result.substring(
        missingParamsStart,
        missingParamsEnd
      )
      expect(missingParamsSection).not.toContain("project_name")
    })

    test("should not show missing parameters section when all required args are provided", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {
          project_name: "test-project",
          repository_url: "https://github.com/test/repo",
        },
      }
      const roleMetadata: RoleMetadata = {
        name: "developer",
        description: "A developer role",
        requiredArgs: {
          project_name: {
            type: "string",
            description: "The name of the project",
          },
          repository_url: {
            type: "string",
            description: "The URL of the git repository",
          },
        },
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace",
        roleMetadata
      )

      expect(result).not.toContain("## ⚠️ Missing Required Parameters")
    })

    test("should not show missing parameters section when roleMetadata has no requiredArgs", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {},
      }
      const roleMetadata: RoleMetadata = {
        name: "developer",
        description: "A developer role",
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace",
        roleMetadata
      )

      expect(result).not.toContain("## ⚠️ Missing Required Parameters")
    })

    test("should treat null and undefined args as missing", () => {
      const rolePrompt = "你是一个员工"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        args: {
          field1: null,
          field2: undefined,
          field3: "",
        },
      }
      const roleMetadata: RoleMetadata = {
        name: "developer",
        description: "A developer role",
        requiredArgs: {
          field1: { type: "string", description: "Field 1" },
          field2: { type: "string", description: "Field 2" },
          field3: { type: "string", description: "Field 3" },
        },
      }

      const result = buildSystemPrompt(
        rolePrompt,
        memory,
        "alice",
        ".cclover/workspace",
        roleMetadata
      )

      expect(result).toContain("## ⚠️ Missing Required Parameters")
      expect(result).toContain("field1")
      expect(result).toContain("field2")

      // field3 should appear in Role Arguments but not in Missing Parameters section (empty string is valid)
      const missingParamsStart = result.indexOf(
        "## ⚠️ Missing Required Parameters"
      )
      const missingParamsEnd = result.indexOf("# Workspace Files")
      const missingParamsSection = result.substring(
        missingParamsStart,
        missingParamsEnd
      )
      expect(missingParamsSection).not.toContain("field3")
    })
  })
})
