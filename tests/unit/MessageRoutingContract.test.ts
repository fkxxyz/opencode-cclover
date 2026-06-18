import { describe, expect, test } from "bun:test"
import type {
  RecipientResolution,
  RecipientResolvedBy,
  RecipientTargetType,
} from "../../src/types"
import { RoutingRules } from "../../src/types/message-routing"

describe("Message routing contract", () => {
  test("defines recipient resolution without task-coupled fields", () => {
    const byEmployeeId: RecipientResolution = {
      targetId: "emp_designer_api",
      targetType: "employee",
      resolvedBy: "employee_id",
    }

    const byUniqueName: RecipientResolution = {
      targetId: "emp_reviewer_api",
      targetType: "employee",
      resolvedBy: "unique_name",
    }

    const byBossId: RecipientResolution = {
      targetId: "0-bayecao",
      targetType: "boss",
      resolvedBy: "boss_id",
    }

    const byMeetingRole: RecipientResolution = {
      targetId: "president",
      targetType: "meeting-role",
      resolvedBy: "meeting_role",
    }

    const targetType: RecipientTargetType = "employee"
    const resolvedBy: RecipientResolvedBy = "employee_id"

    expect(byEmployeeId).toEqual({
      targetId: "emp_designer_api",
      targetType,
      resolvedBy,
    })
    expect(byUniqueName.resolvedBy).toBe("unique_name")
    expect(byBossId.targetType).toBe("boss")
    expect(byMeetingRole.targetType).toBe("meeting-role")

    // @ts-expect-error Phase 1.4 removes same-task routing state from the contract.
    byEmployeeId.isSameTask
    // @ts-expect-error Phase 1.4 removes task-derived targetEmployeeId from the contract.
    byEmployeeId.targetEmployeeId
  })

  test("recognizes stable employee and boss identifiers without inferring task ids", () => {
    expect(RoutingRules.isEmployeeId("emp_designer_api")).toBe(true)
    expect(RoutingRules.isEmployeeId("emp_123456")).toBe(true)
    expect(RoutingRules.isEmployeeId("1-designer-api")).toBe(false)
    expect(RoutingRules.isEmployeeId("designer-api")).toBe(false)

    expect(RoutingRules.isBossId("0-bayecao")).toBe(true)
    expect(RoutingRules.isBossId("boss-bayecao")).toBe(false)
    expect(RoutingRules.extractNameFromBossId("0-bayecao")).toBe("bayecao")

    expect("buildSameTaskEmployeeId" in RoutingRules).toBe(false)
    expect("isFullEmployeeId" in RoutingRules).toBe(false)
    expect("isBossOrNonTask" in RoutingRules).toBe(false)
  })
})
