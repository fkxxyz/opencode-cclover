/**
 * 员工持久化
 * 负责将员工列表保存到文件和从文件加载
 * 使用 employeeId 作为主键
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import type { Employee } from "../types/index"
import { createEmployeeId, isValidEmployeeName } from "../types/index"
import { logger } from "../lib/logger"

export class EmployeePersistence {
  private filePath: string

  constructor(projectPath: string) {
    this.filePath = path.join(projectPath, ".cclover", "employees.yaml")
  }

  /**
   * 保存员工列表到文件
   */
  async save(employees: Employee[]): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.filePath)
      await fs.mkdir(dir, { recursive: true })

      const persistedEmployees = employees.map((employee) =>
        this.toPersistedEmployee(employee)
      )

      // 转换为 YAML
      const content = yaml.stringify({ employees: persistedEmployees })

      // 直接写入文件（简化版本，不使用文件锁）
      await fs.writeFile(this.filePath, content, "utf-8")

      logger.debug(
        `[EmployeePersistence] Saved ${persistedEmployees.length} employees`
      )
    } catch (error: any) {
      logger.error(
        `[EmployeePersistence] Failed to save employees: ${error.message}`
      )
      throw error
    }
  }

  /**
   * 从文件加载员工列表
   */
  async load(): Promise<Employee[]> {
    try {
      const content = await fs.readFile(this.filePath, "utf-8")
      const data = yaml.parse(content)

      if (!data || !Array.isArray(data.employees)) {
        logger.warn("[EmployeePersistence] Invalid employees file format")
        return []
      }

      // 迁移旧格式到新格式
      const employees = data.employees
        .map((emp: any) => {
          // 如果是旧格式（没有 employeeId 字段），进行迁移
          if (!emp.employeeId) {
            // 旧格式: { name, role, ... }
            // 新格式: { employeeId, name, roleId, hiredBy, ... }

            // 验证 name 格式
            if (!isValidEmployeeName(emp.name)) {
              logger.warn(
                `[EmployeePersistence] Invalid employee name format: ${emp.name}, skipping`
              )
              return null
            }

            const employeeId = createEmployeeId()

            return this.toPersistedEmployee({
              employeeId,
              name: emp.name,
              roleId: emp.role ?? emp.roleId ?? "employee",
              hiredBy: emp.hiredBy ?? null,
              status: "idle" as const, // 重置运行时状态
              paused: emp.paused ?? false,
              createdAt: emp.createdAt,
              lastActiveAt: emp.lastActiveAt,
              activeSessionId: null, // 旧员工默认无活跃 session
              promptRecovery: emp.promptRecovery,
            })
          }

          // 新格式，直接返回
          // 如果旧格式（没有 'paused' 字段），默认为未暂停
          if (emp.paused === undefined) {
            return this.toPersistedEmployee({
              ...emp,
              paused: false,
              status: "idle",
            })
          }
          return this.toPersistedEmployee({
            ...emp,
            promptRecovery: emp.promptRecovery,
          })
        })
        .filter((emp: any) => emp !== null) // 过滤掉无效的员工

      logger.debug(`[EmployeePersistence] Loaded ${employees.length} employees`)
      return employees
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // 文件不存在，返回空数组
        logger.debug("[EmployeePersistence] No employees file found")
        return []
      }
      logger.error(
        `[EmployeePersistence] Failed to load employees: ${error.message}`
      )
      throw error
    }
  }

  private toPersistedEmployee(employee: Employee): Employee {
    return {
      employeeId: employee.employeeId,
      name: employee.name,
      roleId: employee.roleId,
      handbookPath: employee.handbookPath,
      hiredBy: employee.hiredBy,
      status: employee.status,
      paused: employee.paused,
      createdAt: employee.createdAt,
      lastActiveAt: employee.lastActiveAt,
      activeSessionId: employee.activeSessionId,
      promptRecovery: employee.promptRecovery,
    }
  }
}
