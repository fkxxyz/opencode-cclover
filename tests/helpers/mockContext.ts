import type { ToolContext } from "@opencode-ai/plugin"

/**
 * Create a mock ToolContext for testing
 *
 * Provides sensible defaults for all required ToolContext fields,
 * allowing tests to override only the fields they care about.
 *
 * @param overrides Partial ToolContext to override defaults
 * @returns Complete ToolContext object
 */
export function createMockToolContext(
  overrides: Partial<ToolContext> = {}
): ToolContext {
  return {
    sessionID: "test-session",
    messageID: "test-message",
    agent: "test-agent",
    directory: "/tmp/test",
    worktree: "/tmp/test",
    abort: new AbortController().signal,
    metadata: () => {},
    ask: async () => {},
    ...overrides,
  }
}
