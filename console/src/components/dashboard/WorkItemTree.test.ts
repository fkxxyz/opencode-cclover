import { describe, expect, test } from "bun:test"
import type { RootTask, WorkItem } from "../../types"
import { buildWorkItemTree, getLatestRootTask } from "./workItemTreeModel"

const rootTasks: RootTask[] = [
  {
    rootTaskId: "older-root",
    summary: "Older root",
    createdBy: "boss",
    createdAt: "2026-06-19T10:00:00.000Z",
  },
  {
    rootTaskId: "latest-root",
    summary: "Latest root",
    createdBy: "boss",
    createdAt: "2026-06-19T12:00:00.000Z",
  },
]

const workItems: WorkItem[] = [
  {
    workItemId: "child",
    rootTaskId: "latest-root",
    parentWorkItemId: "parent",
    employeeId: "employee-2",
    description: "Child work item",
    dependsOn: ["parent"],
    worktreeRef: "feature/child",
    createdAt: "2026-06-19T12:02:00.000Z",
    updatedAt: "2026-06-19T12:03:00.000Z",
  },
  {
    workItemId: "orphan",
    rootTaskId: "latest-root",
    parentWorkItemId: "missing-parent",
    employeeId: "unknown-employee",
    description: "Orphan work item",
    dependsOn: [],
    worktreeRef: null,
    createdAt: "2026-06-19T12:04:00.000Z",
    updatedAt: "2026-06-19T12:05:00.000Z",
  },
  {
    workItemId: "parent",
    rootTaskId: "latest-root",
    parentWorkItemId: null,
    employeeId: "employee-1",
    description: "Parent work item",
    dependsOn: [],
    worktreeRef: null,
    createdAt: "2026-06-19T12:01:00.000Z",
    updatedAt: "2026-06-19T12:01:00.000Z",
  },
]

describe("dashboard work item tree helpers", () => {
  test("selects the latest root task by createdAt", () => {
    expect(getLatestRootTask(rootTasks)?.rootTaskId).toBe("latest-root")
    expect(getLatestRootTask([])).toBeNull()
  })

  test("builds a decomposition tree and groups missing parents as orphans", () => {
    const tree = buildWorkItemTree(workItems)

    expect(tree.rootNodes.map((node) => node.workItem.workItemId)).toEqual([
      "parent",
    ])
    expect(tree.rootNodes[0].children[0].workItem.workItemId).toBe("child")
    expect(tree.orphanNodes.map((node) => node.workItem.workItemId)).toEqual([
      "orphan",
    ])
    expect(tree.orphanNodes[0].unresolvedParentWorkItemId).toBe(
      "missing-parent"
    )
  })
})
