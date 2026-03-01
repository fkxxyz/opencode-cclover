import { describe, test, expect } from "bun:test"
import { CalculatorRole, Roles, getRole, getRoleNames } from "../../src/roles"

describe("Calculator Role", () => {
  test("should have correct name", () => {
    expect(CalculatorRole.name).toBe("calculator")
  })

  test("should have system prompt", () => {
    expect(CalculatorRole.systemPrompt).toBeDefined()
    expect(CalculatorRole.systemPrompt.length).toBeGreaterThan(0)
  })

  test("system prompt should contain key instructions", () => {
    const prompt = CalculatorRole.systemPrompt

    // 检查是否包含关键指令
    expect(prompt).toContain("计算器员工")
    expect(prompt).toContain("数学计算")
    expect(prompt).toContain("send_message")
    expect(prompt).toContain("edit_tasks")
    expect(prompt).toContain("create_agent")
  })

  test("system prompt should describe simple vs complex calculation", () => {
    const prompt = CalculatorRole.systemPrompt

    expect(prompt).toContain("简单计算")
    expect(prompt).toContain("复杂计算")
  })

  test("system prompt should include example workflows", () => {
    const prompt = CalculatorRole.systemPrompt

    expect(prompt).toContain("示例工作流程")
    expect(prompt).toContain("场景")
  })
})

describe("Role Registry", () => {
  test("should register calculator role", () => {
    expect(Roles.calculator).toBeDefined()
    expect(Roles.calculator).toBe(CalculatorRole)
  })

  test("getRole should return calculator role", () => {
    const role = getRole("calculator")
    expect(role).toBeDefined()
    expect(role?.name).toBe("calculator")
  })

  test("getRole should return undefined for unknown role", () => {
    const role = getRole("unknown")
    expect(role).toBeUndefined()
  })

  test("getRoleNames should return all role names", () => {
    const names = getRoleNames()
    expect(names).toContain("calculator")
    expect(names.length).toBeGreaterThan(0)
  })
})
