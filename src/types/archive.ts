import type { RootTaskId } from "./work"

/**
 * 归档和恢复系统的类型定义
 */

// 员工 ID 类型（员工名称）
export type EmployeeId = string

/**
 * 归档验证结果
 */
export interface ArchiveValidation {
  valid: boolean
  busyEmployees: Array<{
    employeeId: EmployeeId
    status: string
  }>
}

/**
 * 恢复验证结果
 */
export interface RestoreValidation {
  valid: boolean
  conflicts: EmployeeId[]
}

/**
 * 归档管理器接口
 */
export interface ArchiveManager {
  /**
   * 归档整个根任务树
   *
   * @param rootTaskId - 要归档的根任务
   * @returns 成功或错误（包含忙碌的员工）
   */
  archiveRootTask(rootTaskId: RootTaskId): Promise<ArchiveValidation>

  /**
   * 归档单个员工（仅限灵魂员工或非任务员工）
   *
   * @param employeeId - 要归档的员工
   * @returns 成功或错误
   */
  archiveEmployee(employeeId: EmployeeId): Promise<ArchiveValidation>

  /**
   * 恢复根任务树
   *
   * @param rootTaskId - 要恢复的根任务
   * @returns 成功或错误（包含冲突）
   */
  restoreRootTask(rootTaskId: RootTaskId): Promise<RestoreValidation>

  /**
   * 恢复单个员工
   *
   * @param employeeId - 要恢复的员工
   * @returns 成功或错误（包含冲突）
   */
  restoreEmployee(employeeId: EmployeeId): Promise<RestoreValidation>

  /**
   * 列出已归档的根任务
   */
  listArchivedRootTasks(): Promise<RootTaskId[]>

  /**
   * 列出已归档的员工
   */
  listArchivedEmployees(): Promise<EmployeeId[]>
}

/**
 * 归档错误消息
 */
export const ArchiveErrors = {
  ROOT_TASK_HAS_BUSY_EMPLOYEES: (
    rootTaskId: RootTaskId,
    busyEmployees: EmployeeId[]
  ) =>
    `Cannot archive root task ${rootTaskId}: The following employees are busy: ${busyEmployees.join(", ")}`,

  EMPLOYEE_IS_BUSY: (employeeId: EmployeeId, status: string) =>
    `Cannot archive employee ${employeeId}: Employee is ${status}`,

  ROOT_TASK_NOT_FOUND: (rootTaskId: RootTaskId) =>
    `Root task ${rootTaskId} not found in archive`,

  EMPLOYEE_NOT_FOUND: (employeeId: EmployeeId) =>
    `Employee ${employeeId} not found in archive`,

  RESTORE_CONFLICT: (conflicts: EmployeeId[]) =>
    `Cannot restore: The following employeeIds already exist: ${conflicts.join(", ")}`,

  ROOT_TASK_EMPLOYEE_CANNOT_BE_ARCHIVED_INDIVIDUALLY: (
    employeeId: EmployeeId
  ) =>
    `Root task employee ${employeeId} can only be archived via root task archiving`,
}
