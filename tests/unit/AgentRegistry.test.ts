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
      employeeId: "0-calculator",
      taskName: "复杂计算",
    }

    agentRegistry.register("agent_001", info)

    const retrieved = agentRegistry.getInfo("agent_001")
    expect(retrieved).toEqual(info)
  })

  test("should return undefined for unregistered agent", () => {
    const info = agentRegistry.getInfo("unknown_agent")
    expect(info).toBeUndefined()
  })

  test("should check if agent is registered", () => {
    const info: AgentInfo = {
      employeeId: "0-calculator",
      taskName: "复杂计算",
    }

    agentRegistry.register("agent_001", info)

    expect(agentRegistry.isOurAgent("agent_001")).toBe(true)
    expect(agentRegistry.isOurAgent("unknown_agent")).toBe(false)
  })

  test("should unregister agent", () => {
    const info: AgentInfo = {
      employeeId: "0-calculator",
      taskName: "复杂计算",
    }

    agentRegistry.register("agent_001", info)
    agentRegistry.unregister("agent_001")

    expect(agentRegistry.isOurAgent("agent_001")).toBe(false)
    expect(agentRegistry.getInfo("agent_001")).toBeUndefined()
  })

  test("should get agents by employee", () => {
    agentRegistry.register("agent_001", {
      employeeId: "0-calculator",
      taskName: "任务1",
    })
    agentRegistry.register("agent_002", {
      employeeId: "0-calculator",
      taskName: "任务2",
    })
    agentRegistry.register("agent_003", {
      employeeId: "0-coder",
      taskName: "任务3",
    })

    const calculatorAgents = agentRegistry.getAgentsByEmployee("0-calculator")
    expect(calculatorAgents).toHaveLength(2)
    expect(calculatorAgents).toContain("agent_001")
    expect(calculatorAgents).toContain("agent_002")

    const coderAgents = agentRegistry.getAgentsByEmployee("0-coder")
    expect(coderAgents).toHaveLength(1)
    expect(coderAgents).toContain("agent_003")
  })

  test("should clear all registrations", () => {
    agentRegistry.register("agent_001", {
      employeeId: "0-calculator",
      taskName: "任务1",
    })
    agentRegistry.register("agent_002", {
      employeeId: "0-coder",
      taskName: "任务2",
    })

    agentRegistry.clear()

    expect(agentRegistry.isOurAgent("agent_001")).toBe(false)
    expect(agentRegistry.isOurAgent("agent_002")).toBe(false)
  })
})
