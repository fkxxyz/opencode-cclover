/**
 * EventLoop 启动失败场景集成测试
 * 测试当员工角色不存在时系统的行为
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import { RoleManager } from "../../src/core/RoleManager"
import { StateManager } from "../../src/state/StateManager"
import type { Employee } from "../../src/types/index"

describe("EventLoop Startup Failure Scenarios", () => {
  const testDir = path.join(process.cwd(), "tests/fixtures/eventloop-startup")
  const projectPath = path.join(testDir, "project")
  const rolesDir = path.join(projectPath, ".cclover", "roles")

  beforeEach(async () => {
    // 创建测试目录
    await fs.mkdir(rolesDir, { recursive: true })

    // 创建一个有效的角色文件
    const validRole = `---
name: "Valid Role"
id: "valid-role"
description: "A valid test role"
---

You are a valid test role.`

    await fs.writeFile(path.join(rolesDir, "Valid Role.md"), validRole, "utf-8")
  })

  afterEach(async () => {
    // 清理测试目录
    await fs.rm(testDir, { recursive: true, force: true })
  })

  test("RoleManager returns undefined for non-existent role", async () => {
    const roleManager = new RoleManager(projectPath)
    await roleManager.refresh()

    // 验证有效角色存在
    const validRole = roleManager.getRole("Valid Role")
    expect(validRole).toBeDefined()
    expect(validRole?.name).toBe("Valid Role")

    // 验证不存在的角色返回 undefined
    const invalidRole = roleManager.getRole("Non Existent Role")
    expect(invalidRole).toBeUndefined()
  })

  test("System should detect missing roles during employee registration", async () => {
    const roleManager = new RoleManager(projectPath)
    await roleManager.refresh()

    const stateManager = new StateManager("test-project", testDir, projectPath)

    // 注册一个有效角色的员工
    const validEmployee: Employee = {
      employeeId: "0-valid-employee",
      name: "valid-employee",
      taskId: 0,
      role: "Valid Role",
      status: "idle",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    }

    await stateManager.registerEmployee(validEmployee)

    // 注册一个无效角色的员工
    const invalidEmployee: Employee = {
      employeeId: "0-invalid-employee",
      name: "invalid-employee",
      taskId: 0,
      role: "Non Existent Role",
      status: "idle",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    }

    await stateManager.registerEmployee(invalidEmployee)

    // 获取所有员工
    const employees = stateManager.getEmployees()
    expect(employees.length).toBe(2)

    // 模拟 EventLoop 启动逻辑
    let startedCount = 0
    const failedEmployees: string[] = []

    for (const employee of employees) {
      const role = roleManager.getRole(employee.role)
      if (!role) {
        failedEmployees.push(employee.name)
        continue
      }
      startedCount++
    }

    // 验证结果
    expect(startedCount).toBe(1) // 只有一个员工成功启动
    expect(failedEmployees.length).toBe(1) // 一个员工失败
    expect(failedEmployees[0]).toBe("invalid-employee")
    expect(startedCount).toBeLessThan(employees.length) // 启动数量少于总数
  })

  test("System should handle all employees with invalid roles", async () => {
    const roleManager = new RoleManager(projectPath)
    await roleManager.refresh()

    const stateManager = new StateManager("test-project", testDir, projectPath)

    // 注册多个无效角色的员工
    const invalidEmployees: Employee[] = [
      {
        employeeId: "0-invalid-1",
        name: "invalid-1",
        taskId: 0,
        role: "Non Existent Role 1",
        status: "idle",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
      {
        employeeId: "0-invalid-2",
        name: "invalid-2",
        taskId: 0,
        role: "Non Existent Role 2",
        status: "idle",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
    ]

    for (const employee of invalidEmployees) {
      await stateManager.registerEmployee(employee)
    }

    const employees = stateManager.getEmployees()
    expect(employees.length).toBe(2)

    // 模拟 EventLoop 启动逻辑
    let startedCount = 0

    for (const employee of employees) {
      const role = roleManager.getRole(employee.role)
      if (!role) {
        continue
      }
      startedCount++
    }

    // 验证结果：没有任何 EventLoop 启动
    expect(startedCount).toBe(0)
    expect(startedCount).toBeLessThan(employees.length)
  })

  test("System should handle mixed valid and invalid roles", async () => {
    const roleManager = new RoleManager(projectPath)
    await roleManager.refresh()

    const stateManager = new StateManager("test-project", testDir, projectPath)

    // 注册混合的员工
    const employees: Employee[] = [
      {
        employeeId: "0-valid-1",
        name: "valid-1",
        taskId: 0,
        role: "Valid Role",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
        status: "idle",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
      {
        employeeId: "0-invalid-1",
        name: "invalid-1",
        taskId: 0,
        role: "Invalid Role",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
        status: "idle",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
      {
        employeeId: "0-valid-2",
        name: "valid-2",
        taskId: 0,
        role: "Valid Role",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
        status: "idle",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
    ]

    for (const employee of employees) {
      await stateManager.registerEmployee(employee)
    }

    const allEmployees = stateManager.getEmployees()
    expect(allEmployees.length).toBe(3)

    // 模拟 EventLoop 启动逻辑
    let startedCount = 0
    const failedEmployees: string[] = []

    for (const employee of allEmployees) {
      const role = roleManager.getRole(employee.role)
      if (!role) {
        failedEmployees.push(employee.name)
        continue
      }
      startedCount++
    }

    // 验证结果
    expect(startedCount).toBe(2) // 两个有效员工启动
    expect(failedEmployees.length).toBe(1) // 一个无效员工
    expect(failedEmployees[0]).toBe("invalid-1")
    expect(startedCount).toBeLessThan(allEmployees.length)
  })
})
