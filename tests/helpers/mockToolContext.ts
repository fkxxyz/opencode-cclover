import type { ToolContext } from "@opencode-ai/plugin"

/**
 * 创建模拟的 ToolContext 对象用于测试
 *
 * @param overrides - 可选的字段覆盖
 * @returns 完整的 ToolContext 对象
 */
export function createMockToolContext(
  overrides?: Partial<ToolContext>
): ToolContext {
  return {
    sessionID: "test-session",
    messageID: "test-message",
    agent: "test-agent",
    directory: "/test/directory",
    worktree: "/test/worktree",
    abort: new AbortController().signal,
    metadata: () => {},
    ask: async () => {},
    ...overrides,
  }
}
