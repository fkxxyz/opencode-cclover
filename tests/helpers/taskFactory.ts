import type { Task } from "../../src/types"

/**
 * 创建测试用的任务对象
 * 自动填充必需字段（如 created 时间戳）
 */
export function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    name: "test-task",
    description: "Test task",
    status: "pending",
    dependencies: [],
    created: new Date().toISOString(),
    ...overrides,
  }
}
