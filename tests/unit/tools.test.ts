/**
 * 工具系统基础框架测试
 */

import { describe, test, expect } from "bun:test"
import {
  sendMessageTool,
  editTasksTool,
  createAgentTool,
  hireEmployeeTool,
  DEFAULT_TOOL_PERMISSIONS,
  getToolPermissions,
} from "../../dist/tools"
import { sessionRegistry } from "../../dist/utils/SessionRegistry"
import { agentRegistry } from "../../dist/utils/AgentRegistry"

describe("工具系统基础框架", () => {
  describe("工具定义", () => {
    test("sendMessageTool 应该有正确的结构", () => {
      expect(sendMessageTool).toBeDefined()
      expect(sendMessageTool.description).toBe("发送消息给其他员工")
      expect(sendMessageTool.args).toBeDefined()
      expect(sendMessageTool.execute).toBeInstanceOf(Function)
    })

    test("editTasksTool 应该有正确的结构", () => {
      expect(editTasksTool).toBeDefined()
      expect(editTasksTool.description).toBe(
        "批量编辑任务列表（添加、更新、删除任务）"
      )
      expect(editTasksTool.args).toBeDefined()
      expect(editTasksTool.execute).toBeInstanceOf(Function)
    })

    test("createAgentTool 应该有正确的结构", () => {
      expect(createAgentTool).toBeDefined()
      expect(createAgentTool.description).toBe("创建 OpenCode agent 执行任务")
      expect(createAgentTool.args).toBeDefined()
      expect(createAgentTool.execute).toBeInstanceOf(Function)
    })

    test("hireEmployeeTool 应该有正确的结构", () => {
      expect(hireEmployeeTool).toBeDefined()
      expect(hireEmployeeTool.description).toBe("雇佣新员工")
      expect(hireEmployeeTool.args).toBeDefined()
      expect(hireEmployeeTool.execute).toBeInstanceOf(Function)
    })
  })

  describe("工具权限", () => {
    test("DEFAULT_TOOL_PERMISSIONS 应该包含所有工具", () => {
      expect(DEFAULT_TOOL_PERMISSIONS.send_message).toBe(true)
      expect(DEFAULT_TOOL_PERMISSIONS.edit_tasks).toBe(true)
      expect(DEFAULT_TOOL_PERMISSIONS.create_agent).toBe(true)
      expect(DEFAULT_TOOL_PERMISSIONS.hire_employee).toBe(false)
    })

    test("getToolPermissions 应该返回默认权限", () => {
      const permissions = getToolPermissions("calculator")
      expect(permissions).toEqual(DEFAULT_TOOL_PERMISSIONS)
    })

    test("getToolPermissions 应该支持自定义权限", () => {
      const customPermissions = {
        send_message: false,
        edit_tasks: true,
        create_agent: false,
        hire_employee: true,
      }
      const permissions = getToolPermissions("calculator", customPermissions)
      expect(permissions).toEqual(customPermissions)
    })
  })

  describe("SessionRegistry", () => {
    test("应该能注册和获取 session", () => {
      sessionRegistry.clear()
      sessionRegistry.register("session-1", "calculator")
      expect(sessionRegistry.getEmployeeName("session-1")).toBe("calculator")
    })

    test("应该能检查 session 是否存在", () => {
      sessionRegistry.clear()
      sessionRegistry.register("session-2", "alice")
      expect(sessionRegistry.has("session-2")).toBe(true)
      expect(sessionRegistry.has("session-3")).toBe(false)
    })

    test("应该能取消注册", () => {
      sessionRegistry.clear()
      sessionRegistry.register("session-4", "bob")
      expect(sessionRegistry.has("session-4")).toBe(true)
      sessionRegistry.unregister("session-4")
      expect(sessionRegistry.has("session-4")).toBe(false)
    })

    test("应该能获取所有 session", () => {
      sessionRegistry.clear()
      sessionRegistry.register("session-5", "alice")
      sessionRegistry.register("session-6", "bob")
      const sessions = sessionRegistry.getAllSessions()
      expect(sessions).toContain("session-5")
      expect(sessions).toContain("session-6")
      expect(sessions.length).toBe(2)
    })
  })

  describe("AgentRegistry", () => {
    test("应该能注册和获取 agent 信息", () => {
      agentRegistry.register("agent-1", {
        employeeName: "calculator",
        taskName: "计算1+1",
      })
      const info = agentRegistry.getInfo("agent-1")
      expect(info?.employeeName).toBe("calculator")
      expect(info?.taskName).toBe("计算1+1")
    })

    test("应该能检查是否是我们的 agent", () => {
      agentRegistry.clear()
      agentRegistry.register("agent-2", {
        employeeName: "alice",
        taskName: "任务A",
      })
      expect(agentRegistry.isOurAgent("agent-2")).toBe(true)
      expect(agentRegistry.isOurAgent("agent-3")).toBe(false)
    })

    test("应该能取消注册", () => {
      agentRegistry.clear()
      agentRegistry.register("agent-4", {
        employeeName: "bob",
        taskName: "任务B",
      })
      expect(agentRegistry.isOurAgent("agent-4")).toBe(true)
      agentRegistry.unregister("agent-4")
      expect(agentRegistry.isOurAgent("agent-4")).toBe(false)
    })

    test("应该能获取某个员工的所有 agent", () => {
      agentRegistry.clear()
      agentRegistry.register("agent-5", {
        employeeName: "calculator",
        taskName: "任务1",
      })
      agentRegistry.register("agent-6", {
        employeeName: "calculator",
        taskName: "任务2",
      })
      agentRegistry.register("agent-7", {
        employeeName: "alice",
        taskName: "任务3",
      })
      const agents = agentRegistry.getAgentsByEmployee("calculator")
      expect(agents).toContain("agent-5")
      expect(agents).toContain("agent-6")
      expect(agents).not.toContain("agent-7")
      expect(agents.length).toBe(2)
    })
  })
})
