/**
 * 归档和恢复系统的类型定义
 */

// 员工 ID 类型（员工名称）
export type EmployeeId = string

// 任务 ID 类型（任务名称）
export type TaskId = string

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
   * 归档整个任务树
   *
   * @param taskId - 要归档的任务
   * @returns 成功或错误（包含忙碌的员工）
   */
  archiveTask(taskId: TaskId): Promise<ArchiveValidation>

  /**
   * 归档单个员工（仅限灵魂员工或非任务员工）
   *
   * @param employeeId - 要归档的员工
   * @returns 成功或错误
   */
  archiveEmployee(employeeId: EmployeeId): Promise<ArchiveValidation>

  /**
   * 恢复任务树
   *
   * @param taskId - 要恢复的任务
   * @returns 成功或错误（包含冲突）
   */
  restoreTask(taskId: TaskId): Promise<RestoreValidation>

  /**
   * 恢复单个员工
   *
   * @param employeeId - 要恢复的员工
   * @returns 成功或错误（包含冲突）
   */
  restoreEmployee(employeeId: EmployeeId): Promise<RestoreValidation>

  /**
   * 列出已归档的任务
   */
  listArchivedTasks(): Promise<TaskId[]>

  /**
   * 列出已归档的员工
   */
  listArchivedEmployees(): Promise<EmployeeId[]>
}

/**
 * 归档错误消息
 */
export const ArchiveErrors = {
  TASK_HAS_BUSY_EMPLOYEES: (taskId: TaskId, busyEmployees: EmployeeId[]) =>
    `Cannot archive task ${taskId}: The following employees are busy: ${busyEmployees.join(", ")}`,

  EMPLOYEE_IS_BUSY: (employeeId: EmployeeId, status: string) =>
    `Cannot archive employee ${employeeId}: Employee is ${status}`,

  TASK_NOT_FOUND: (taskId: TaskId) => `Task ${taskId} not found in archive`,

  EMPLOYEE_NOT_FOUND: (employeeId: EmployeeId) =>
    `Employee ${employeeId} not found in archive`,

  RESTORE_CONFLICT: (conflicts: EmployeeId[]) =>
    `Cannot restore: The following employeeIds already exist: ${conflicts.join(", ")}`,

  TASK_EMPLOYEE_CANNOT_BE_ARCHIVED_INDIVIDUALLY: (employeeId: EmployeeId) =>
    `Task employee ${employeeId} can only be archived via task archiving`,
}
