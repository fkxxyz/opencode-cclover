import type { BossId, EmployeeId } from "./employee"

export type RootTaskId = string
export type WorkItemId = string
export type WorktreeRef = string

export interface RootTask {
  rootTaskId: RootTaskId
  summary: string
  createdBy: EmployeeId | BossId
  createdAt: string
}

export interface WorkItem {
  workItemId: WorkItemId
  rootTaskId: RootTaskId
  parentWorkItemId: WorkItemId | null
  employeeId: EmployeeId
  description: string
  dependsOn: WorkItemId[]
  worktreeRef: WorktreeRef | null
  createdAt: string
  updatedAt: string
}

export interface CreateRootTaskInput {
  summary: string
  createdBy: EmployeeId | BossId
}

export interface CreateWorkItemInput {
  rootTaskId: RootTaskId
  employeeId: EmployeeId
  description: string
  parentWorkItemId?: WorkItemId | null
  dependsOn?: WorkItemId[]
  worktreeRef?: WorktreeRef | null
}

export interface UpdateWorkItemInput {
  description?: string
  parentWorkItemId?: WorkItemId | null
  dependsOn?: WorkItemId[]
  worktreeRef?: WorktreeRef | null
}

export interface WorkItemFilters {
  rootTaskId?: RootTaskId
  employeeId?: EmployeeId
  parentWorkItemId?: WorkItemId | null
  dependsOn?: WorkItemId
}
