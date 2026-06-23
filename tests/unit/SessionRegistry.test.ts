/**
 * SessionRegistry 单元测试
 */

import { describe, test, expect, beforeEach } from "bun:test"
import { sessionRegistry } from "../../src/utils/SessionRegistry"

describe("SessionRegistry", () => {
  beforeEach(() => {
    // 每个测试前清空注册表
    sessionRegistry.clear()
  })

  test("should register and retrieve EWS session", () => {
    sessionRegistry.register("session_001", "ews_test")

    const employeeWorkSessionId =
      sessionRegistry.getEmployeeWorkSessionId("session_001")
    expect(employeeWorkSessionId).toBe("ews_test")
  })

  test("should return undefined for unregistered session", () => {
    const employeeWorkSessionId =
      sessionRegistry.getEmployeeWorkSessionId("unknown_session")
    expect(employeeWorkSessionId).toBeUndefined()
  })

  test("should check if session exists", () => {
    sessionRegistry.register("session_001", "ews_test")

    expect(sessionRegistry.has("session_001")).toBe(true)
    expect(sessionRegistry.has("unknown_session")).toBe(false)
  })

  test("should unregister session", () => {
    sessionRegistry.register("session_001", "ews_test")
    sessionRegistry.unregister("session_001")

    expect(sessionRegistry.has("session_001")).toBe(false)
    expect(
      sessionRegistry.getEmployeeWorkSessionId("session_001")
    ).toBeUndefined()
  })

  test("should get all registered sessions", () => {
    sessionRegistry.register("session_001", "ews_test")
    sessionRegistry.register("session_002", "ews_coder")

    const sessions = sessionRegistry.getAllSessions()
    expect(sessions).toHaveLength(2)
    expect(sessions).toContain("session_001")
    expect(sessions).toContain("session_002")
  })

  test("should clear all registrations", () => {
    sessionRegistry.register("session_001", "ews_test")
    sessionRegistry.register("session_002", "ews_coder")

    sessionRegistry.clear()

    expect(sessionRegistry.getAllSessions()).toHaveLength(0)
  })
})
