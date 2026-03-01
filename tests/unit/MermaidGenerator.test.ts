/**
 * MermaidGenerator 单元测试
 */

import { describe, test, expect } from "bun:test"
import { generateMermaid, type Task } from "../../src/utils/MermaidGenerator"

describe("MermaidGenerator", () => {
  test("should generate empty graph for empty task list", () => {
    const result = generateMermaid([])
    expect(result).toContain("graph TD")
    expect(result).toContain("Empty[无任务]")
  })

  test("should generate nodes for tasks", () => {
    const tasks: Task[] = [
      {
        name: "计算1+1",
        status: "completed",
        description: "计算 1+1",
        result: "2",
        dependencies: [],
        created: "2026-03-01T10:00:00Z",
        completed: "2026-03-01T10:00:05Z",
      },
      {
        name: "计算3+4",
        status: "in_progress",
        description: "计算 3+4",
        dependencies: [],
        created: "2026-03-01T10:01:00Z",
      },
    ]

    const result = generateMermaid(tasks)
    expect(result).toContain("graph TD")
    expect(result).toContain("completed: 计算1+1")
    expect(result).toContain("in_progress: 计算3+4")
  })

  test("should generate edges for dependencies", () => {
    const tasks: Task[] = [
      {
        name: "任务A",
        status: "completed",
        description: "任务A",
        dependencies: [],
        created: "2026-03-01T10:00:00Z",
      },
      {
        name: "任务B",
        status: "completed",
        description: "任务B",
        dependencies: [],
        created: "2026-03-01T10:01:00Z",
      },
      {
        name: "任务C",
        status: "pending",
        description: "任务C",
        dependencies: ["任务A", "任务B"],
        created: "2026-03-01T10:02:00Z",
      },
    ]

    const result = generateMermaid(tasks)
    expect(result).toContain("任务A --> 任务C")
    expect(result).toContain("任务B --> 任务C")
  })

  test("should sanitize node IDs with special characters", () => {
    const tasks: Task[] = [
      {
        name: "计算(1+2)*3",
        status: "pending",
        description: "复杂计算",
        dependencies: [],
        created: "2026-03-01T10:00:00Z",
      },
    ]

    const result = generateMermaid(tasks)
    // 特殊字符应该被替换为下划线
    expect(result).toContain("计算_1_2__3")
  })
})
