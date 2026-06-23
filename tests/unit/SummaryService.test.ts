import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { MemoryManager } from "../../src/core/MemoryManager"
import { SummaryService } from "../../src/core/eventloop/SummaryService"

describe("SummaryService", () => {
  let workspaceRoot: string
  let memoryManager: MemoryManager

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "summary-service-test-")
    )
    memoryManager = new MemoryManager(workspaceRoot)
  })

  afterEach(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true })
  })

  test("should preserve EWS OpenCode session fields when saving summary", async () => {
    await memoryManager.write("ews_summary", {
      knowledge: ["existing knowledge"],
      tasks: [
        {
          name: "task-1",
          status: "in_progress",
          description: "Keep task state",
          dependencies: [],
          created: "2026-06-22T00:00:00.000Z",
        },
      ],
      args: { worktree_path: "/tmp/old" },
      roleData: { existing: true },
      opencodeSessionId: "session-ews-summary",
      sessionSnapshot: {
        knowledge: ["snapshot knowledge"],
        tasks: [],
        args: { worktree_path: "/tmp/snapshot" },
        timestamp: "2026-06-22T00:00:01.000Z",
      },
    })

    const summaryService = new SummaryService(
      "/tmp/project",
      "ews_summary",
      "developer",
      { getRole: () => undefined } as any,
      memoryManager,
      {} as any
    )

    await summaryService.saveSummary({
      knowledge: ["new knowledge"],
      args: { worktree_path: "/tmp/new" },
      roleData: { summarized: true },
    })

    const memory = await memoryManager.read("ews_summary")
    expect(memory.knowledge).toEqual(["existing knowledge", "new knowledge"])
    expect(memory.args).toEqual({ worktree_path: "/tmp/new" })
    expect(memory.roleData).toEqual({ existing: true, summarized: true })
    expect(memory.opencodeSessionId).toBe("session-ews-summary")
    expect(memory.sessionSnapshot).toEqual({
      knowledge: ["snapshot knowledge"],
      tasks: [],
      args: { worktree_path: "/tmp/snapshot" },
      timestamp: "2026-06-22T00:00:01.000Z",
    })
  })
})
