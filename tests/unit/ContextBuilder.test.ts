/**
 * ContextBuilder 单元测试
 */

import { describe, test, expect } from "bun:test"
import {
  buildSystemPrompt,
  buildEventMessage,
  getExecutableTasks,
  type Memory,
  type Event,
} from "../../src/utils/ContextBuilder"
import type { Task } from "../../src/utils/MermaidGenerator"

describe("ContextBuilder", () => {
  describe("buildSystemPrompt", () => {
    test("should build system prompt with role and memory", () => {
      const rolePrompt = "你是一个计算器员工"
      const memory: Memory = {
        knowledge: ["我擅长数学计算", "用户经常问我简单问题"],
        tasks: [],
        custom: {},
      }

      const result = buildSystemPrompt(rolePrompt, memory)
      expect(result).toContain("你是一个计算器员工")
      expect(result).toContain("我擅长数学计算")
      expect(result).toContain("用户经常问我简单问题")
    })

    test("should include custom data in JSON format", () => {
      const rolePrompt = "你是一个 PM"
      const memory: Memory = {
        knowledge: [],
        tasks: [],
        custom: {
          team_members: ["alice", "bob"],
          current_sprint: "sprint_5",
        },
      }

      const result = buildSystemPrompt(rolePrompt, memory)
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
        custom: {},
      }

      const result = buildSystemPrompt(rolePrompt, memory)
      expect(result).toContain("任务状态")
      expect(result).toContain("graph TD")
    })
  })

  describe("buildEventMessage", () => {
    test("should format message event", () => {
      const event: Event = {
        type: "message",
        from: "alice",
        content: "计算 1+1",
        timestamp: "2026-03-01T10:00:00Z",
      }

      const result = buildEventMessage(event)
      expect(result).toContain("类型: message")
      expect(result).toContain("发送者: alice")
      expect(result).toContain("内容: 计算 1+1")
    })

    test("should format agent_completed event", () => {
      const event: Event = {
        type: "agent_completed",
        agentId: "agent_001",
        taskName: "复杂计算",
        result: "结果是 456831",
        timestamp: "2026-03-01T10:05:00Z",
      }

      const result = buildEventMessage(event)
      expect(result).toContain("类型: agent_completed")
      expect(result).toContain("Agent ID: agent_001")
      expect(result).toContain("关联任务: 复杂计算")
      expect(result).toContain("执行结果: 结果是 456831")
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
})
