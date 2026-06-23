import { describe, expect, test } from "bun:test"
import type {
  RecipientResolution,
  RecipientResolvedBy,
  RecipientTargetType,
} from "../../src/types"
import { RoutingRules } from "../../src/types/message-routing"

describe("Message routing contract", () => {
  test("defines recipient resolution with EWS and boss targets only", () => {
    const byEmployeeWorkSessionId: RecipientResolution = {
      targetId: "ews_designer_api",
      targetType: "employee-work-session",
      resolvedBy: "employee_work_session_id",
    }

    const byBossId: RecipientResolution = {
      targetId: "boss_bayecao",
      targetType: "boss",
      resolvedBy: "boss_id",
    }

    const targetType: RecipientTargetType = "employee-work-session"
    const resolvedBy: RecipientResolvedBy = "employee_work_session_id"

    expect(byEmployeeWorkSessionId).toEqual({
      targetId: "ews_designer_api",
      targetType,
      resolvedBy,
    })
    expect(byBossId.targetType).toBe("boss")

    // @ts-expect-error Phase 1.4 removes same-task routing state from the contract.
    byEmployeeWorkSessionId.isSameTask
    // @ts-expect-error Phase 1.4 removes task-derived targetEmployeeId from the contract.
    byEmployeeWorkSessionId.targetEmployeeId
  })

  test("recognizes stable EWS and boss identifiers without employee targets", () => {
    expect(RoutingRules.isEmployeeWorkSessionId("ews_designer_api")).toBe(true)
    expect(RoutingRules.isEmployeeWorkSessionId("emp_designer_api")).toBe(false)

    expect(RoutingRules.isEmployeeId("emp_designer_api")).toBe(true)
    expect(RoutingRules.isEmployeeId("emp_123456")).toBe(true)
    expect(RoutingRules.isEmployeeId("1-designer-api")).toBe(false)
    expect(RoutingRules.isEmployeeId("designer-api")).toBe(false)

    expect(RoutingRules.isBossId("boss_bayecao")).toBe(true)
    expect(RoutingRules.isBossId("0-bayecao")).toBe(false)
    expect(RoutingRules.extractNameFromBossId("boss_bayecao")).toBe("bayecao")

    expect("buildSameTaskEmployeeId" in RoutingRules).toBe(false)
    expect("isFullEmployeeId" in RoutingRules).toBe(false)
    expect("isBossOrNonTask" in RoutingRules).toBe(false)
  })
})
