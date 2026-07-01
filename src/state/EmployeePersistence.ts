/**
 * 员工持久化
 * 负责将员工列表保存到文件和从文件加载
 * 使用 employeeId 作为主键
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import type { Employee } from "../types/index"
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

      const persistedEmployees = employees
        .map((employee) => this.toPersistedEmployee(employee))
        .filter((employee): employee is Employee => employee !== null)

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

      // 只接受当前 Employee 形状；旧字段不会被迁移或保留。
      const employees = data.employees
        .map((emp: any) => this.toPersistedEmployee(emp))
        .filter((emp: Employee | null): emp is Employee => emp !== null)

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

  private toPersistedEmployee(employee: Partial<Employee>): Employee | null {
    if (!employee.employeeId || !employee.roleId) {
      logger.debug(
        "[EmployeePersistence] Skipping employee record missing employeeId or roleId"
      )
      return null
    }

    const persistedEmployee: Employee = {
      employeeId: employee.employeeId,
      name: employee.name ?? "",
      roleId: employee.roleId,
      description: employee.description ?? "",
      contextPaths: Array.isArray(employee.contextPaths)
        ? employee.contextPaths.filter(
            (contextPath) => typeof contextPath === "string"
          )
        : [],
      hiredBy: employee.hiredBy ?? null,
      createdAt: employee.createdAt ?? new Date().toISOString(),
      updatedAt: employee.updatedAt ?? new Date().toISOString(),
    }

    if (employee.dismissedAt) {
      persistedEmployee.dismissedAt = employee.dismissedAt
      persistedEmployee.dismissedBy = employee.dismissedBy ?? null
      persistedEmployee.dismissReason = employee.dismissReason ?? null
    }

    return persistedEmployee
  }
}
