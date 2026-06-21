import type { RootTask, WorkItem } from "../../types"

export interface WorkItemTreeNode {
  workItem: WorkItem
  children: WorkItemTreeNode[]
  unresolvedParentWorkItemId?: string
}

export interface WorkItemTreeModel {
  rootNodes: WorkItemTreeNode[]
  orphanNodes: WorkItemTreeNode[]
}

function compareByCreatedAt(
  a: { createdAt: string },
  b: { createdAt: string }
) {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt)
}

export function getLatestRootTask(rootTasks: RootTask[]): RootTask | null {
  if (rootTasks.length === 0) return null
  return [...rootTasks].sort((a, b) => compareByCreatedAt(b, a))[0]
}

export function buildWorkItemTree(workItems: WorkItem[]): WorkItemTreeModel {
  const nodesById = new Map<string, WorkItemTreeNode>()
  for (const workItem of workItems) {
    nodesById.set(workItem.workItemId, { workItem, children: [] })
  }

  const rootNodes: WorkItemTreeNode[] = []
  const orphanNodes: WorkItemTreeNode[] = []

  for (const node of nodesById.values()) {
    const parentWorkItemId = node.workItem.parentWorkItemId
    if (!parentWorkItemId) {
      rootNodes.push(node)
      continue
    }

    const parent = nodesById.get(parentWorkItemId)
    if (!parent) {
      node.unresolvedParentWorkItemId = parentWorkItemId
      orphanNodes.push(node)
      continue
    }

    parent.children.push(node)
  }

  const sortTree = (nodes: WorkItemTreeNode[]) => {
    nodes.sort((a, b) => compareByCreatedAt(a.workItem, b.workItem))
    for (const node of nodes) sortTree(node.children)
  }
  sortTree(rootNodes)
  sortTree(orphanNodes)

  return { rootNodes, orphanNodes }
}
