/**
 * AgentRegistry 单元测试
 */

import { describe, test, expect, beforeEach } from "bun:test"
import { agentRegistry, type AgentInfo } from "../../src/utils/AgentRegistry"

describe("AgentRegistry", () => {
  beforeEach(() => {
    // 每个测试前清空注册表
    agentRegistry.clear()
  })

  test("should register and retrieve agent info", () => {
    const info: AgentInfo = {
      employeeId: "emp_test_role",
      workItemId: "wi-test-001",
      taskName: "复杂计算",
    }

    agentRegistry.register("agent_001", info)

    const retrieved = agentRegistry.getInfo("agent_001")
    expect(retrieved).toEqual(info)
  })

  test("should support work item association without personal task name", () => {
    const info: AgentInfo = {
      employeeId: "emp_test_role",
      workItemId: "wi-test-001",
    }

    agentRegistry.register("agent_001", info)

    expect(agentRegistry.getInfo("agent_001")).toEqual(info)
  })

  test("should return undefined for unregistered agent", () => {
    const info = agentRegistry.getInfo("unknown_agent")
    expect(info).toBeUndefined()
  })

  test("should check if agent is registered", () => {
    const info: AgentInfo = {
      employeeId: "emp_test_role",
      taskName: "复杂计算",
    }

    agentRegistry.register("agent_001", info)

    expect(agentRegistry.isOurAgent("agent_001")).toBe(true)
    expect(agentRegistry.isOurAgent("unknown_agent")).toBe(false)
  })

  test("should unregister agent", () => {
    const info: AgentInfo = {
      employeeId: "emp_test_role",
      taskName: "复杂计算",
    }

    agentRegistry.register("agent_001", info)
    agentRegistry.unregister("agent_001")

    expect(agentRegistry.isOurAgent("agent_001")).toBe(false)
    expect(agentRegistry.getInfo("agent_001")).toBeUndefined()
  })

  test("should get agents by employee", () => {
    agentRegistry.register("agent_001", {
      employeeId: "emp_test_role",
      taskName: "任务1",
    })
    agentRegistry.register("agent_002", {
      employeeId: "emp_test_role",
      taskName: "任务2",
    })
    agentRegistry.register("agent_003", {
      employeeId: "emp_coder",
      taskName: "任务3",
    })

    const testRoleAgents = agentRegistry.getAgentsByEmployee("emp_test_role")
    expect(testRoleAgents).toHaveLength(2)
    expect(testRoleAgents).toContain("agent_001")
    expect(testRoleAgents).toContain("agent_002")

    const coderAgents = agentRegistry.getAgentsByEmployee("emp_coder")
    expect(coderAgents).toHaveLength(1)
    expect(coderAgents).toContain("agent_003")
  })

  test("should get agents by work item", () => {
    agentRegistry.register("agent_001", {
      employeeId: "emp_test_role",
      workItemId: "wi-test-001",
      taskName: "任务1",
    })
    agentRegistry.register("agent_002", {
      employeeId: "emp_coder",
      workItemId: "wi-test-001",
      taskName: "任务2",
    })
    agentRegistry.register("agent_003", {
      employeeId: "emp_test_role",
      workItemId: "wi-test-002",
      taskName: "任务3",
    })
    agentRegistry.register("agent_004", {
      employeeId: "emp_test_role",
      taskName: "个人任务",
    })

    const workItemAgents = agentRegistry.getAgentsByWorkItem("wi-test-001")
    expect(workItemAgents).toHaveLength(2)
    expect(workItemAgents).toContain("agent_001")
    expect(workItemAgents).toContain("agent_002")

    const otherWorkItemAgents = agentRegistry.getAgentsByWorkItem("wi-test-002")
    expect(otherWorkItemAgents).toEqual(["agent_003"])
  })

  test("should clear all registrations", () => {
    agentRegistry.register("agent_001", {
      employeeId: "emp_test_role",
      taskName: "任务1",
    })
    agentRegistry.register("agent_002", {
      employeeId: "emp_coder",
      taskName: "任务2",
    })

    agentRegistry.clear()

    expect(agentRegistry.isOurAgent("agent_001")).toBe(false)
    expect(agentRegistry.isOurAgent("agent_002")).toBe(false)
  })
})
