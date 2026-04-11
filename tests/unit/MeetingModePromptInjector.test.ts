import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { MeetingModePromptInjector } from "../../src/meeting-mode/PromptInjector"

describe("MeetingModePromptInjector", () => {
  let injector: MeetingModePromptInjector
  let currentTime: number
  let originalDateNow: () => number

  beforeEach(() => {
    currentTime = 0
    originalDateNow = Date.now
    Date.now = () => currentTime
    injector = new MeetingModePromptInjector("project-1", "test-project")
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  test("records session to agent mappings per project", () => {
    injector.recordSession("session-1", "Calculator")

    expect(injector.getAgentName("session-1")).toBe("Calculator")
  })

  test("disables hook after three consecutive failures", () => {
    injector.recordHookSuccess()
    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("first"))
    injector.recordHookFailure(new Error("second"))

    expect(injector.isHookEnabled()).toBe(true)

    injector.recordHookFailure(new Error("third"))

    expect(injector.isHookEnabled()).toBe(false)
    expect(injector.getDisableReason()).toContain("3 consecutive failures")
  })

  test("resets consecutive failures after a successful execution", () => {
    injector.recordHookSuccess()
    injector.recordHookSuccess()
    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("first"))
    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("second"))
    injector.recordHookFailure(new Error("third"))

    expect(injector.isHookEnabled()).toBe(true)
  })

  test("disables hook when failure rate exceeds 50 percent within five minutes", () => {
    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("first"))

    expect(injector.isHookEnabled()).toBe(true)

    injector.recordHookFailure(new Error("second"))

    expect(injector.isHookEnabled()).toBe(false)
    expect(injector.getDisableReason()).toContain("failure rate exceeded 50%")
  })

  test("ignores executions outside the five minute failure-rate window", () => {
    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("old-failure"))

    currentTime = 6 * 60 * 1000

    injector.recordHookSuccess()
    injector.recordHookFailure(new Error("recent-failure"))

    expect(injector.isHookEnabled()).toBe(true)
  })
})
