/**
 * 员工持久化
 * 负责将员工列表保存到文件和从文件加载
 * 使用 employeeId 作为主键
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import type { Employee, EmployeeId } from "../types/index"
import { formatEmployeeId, isValidEmployeeName } from "../types/index"
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

      // 转换为 YAML
      const content = yaml.stringify({ employees })

      // 直接写入文件（简化版本，不使用文件锁）
      await fs.writeFile(this.filePath, content, "utf-8")

      logger.debug(`[EmployeePersistence] Saved ${employees.length} employees`)
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
            // 新格式: { employeeId, name, taskId, role, ... }
            
            // 验证 name 格式
            if (!isValidEmployeeName(emp.name)) {
              logger.warn(
                `[EmployeePersistence] Invalid employee name format: ${emp.name}, skipping`
              )
              return null
            }

            // 为旧员工分配 taskId = 1 (默认活跃任务)
            // 注意: 如果需要不同的 taskId 分配策略，需要手动迁移
            const taskId = 1
            const employeeId = formatEmployeeId(taskId, emp.name)

            return {
              employeeId,
              name: emp.name,
              taskId,
              role: emp.role,
              hiredBy: null, // 旧员工默认为 Boss 雇佣
              status: "idle" as const, // 重置运行时状态
              paused: emp.paused ?? false,
              createdAt: emp.createdAt,
              lastActiveAt: emp.lastActiveAt,
              activeSessionId: null, // 旧员工默认无活跃 session
            }
          }

          // 新格式，直接返回
          // 如果旧格式（没有 'paused' 字段），默认为未暂停
          if (emp.paused === undefined) {
            return {
              ...emp,
              paused: false,
              status: "idle",
            }
          }
          return emp
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
}
