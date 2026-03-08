/**
 * 员工持久化
 * 负责将员工列表保存到文件和从文件加载
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
      const employees = data.employees.map((emp: any) => {
        // 如果旧格式（没有 'paused' 字段），默认为未暂停
        if (emp.paused === undefined) {
          return {
            ...emp,
            paused: false, // 默认为未暂停（旧系统没有显式暂停配置）
            status: "idle", // 重置运行时状态（将在启动时重新计算）
          }
        }
        return emp
      })

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
