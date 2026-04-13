import { describe, test, expect } from "bun:test"
import {
  validateRoleFrontmatter,
  formatRoleValidationIssue,
} from "../../src/core/RoleFrontmatterValidator"
import type { RoleValidationIssue } from "../../src/core/RoleFrontmatterValidator"

// ===== 基础验证测试 =====

describe("RoleFrontmatterValidator — basic validation", () => {
  test("should reject non-object frontmatter", () => {
    const result = validateRoleFrontmatter("not an object")
    expect(result.valid).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].message).toBe("frontmatter must be an object")
  })

  test("should reject array frontmatter", () => {
    const result = validateRoleFrontmatter([])
    expect(result.valid).toBe(false)
  })

  test("should reject null frontmatter", () => {
    const result = validateRoleFrontmatter(null)
    expect(result.valid).toBe(false)
  })

  test("should accept minimal valid frontmatter", () => {
    const result = validateRoleFrontmatter({
      name: "testRole?",
      id: "testRole?",
    })
    expect(result.valid).toBe(true)
    expect(result.normalized?.name).toBe("testRole?")
  })

  test("should reject missing name", () => {
    const result = validateRoleFrontmatter({ description: "no name" })
    expect(result.valid).toBe(false)
  })

  test("should reject empty name", () => {
    const result = validateRoleFrontmatter({ name: "  ", id: "--" })
    expect(result.valid).toBe(false)
  })
})

// ===== Workflow 元数据验证测试 =====

describe("RoleFrontmatterValidator — workflow metadata", () => {
  test("should accept role without workflow (backward compatibility)", () => {
    const result = validateRoleFrontmatter({
      name: "simple-role",
      id: "simple-role",
      description: "No workflow",
    })

    expect(result.valid).toBe(true)
    expect(result.normalized?.workflow).toBeUndefined()
    expect(result.issues).toHaveLength(0)
  })

  test("should accept valid minimal workflow with one phase", () => {
    const result = validateRoleFrontmatter({
      name: "workflow-role",
      id: "workflow-role",
      workflow: {
        phases: [{ id: "init" }],
      },
    })

    expect(result.valid).toBe(true)
    expect(result.normalized?.workflow).toEqual({
      id: undefined,
      description: undefined,
      phases: [{ id: "init", description: undefined, tasks: undefined }],
    })
  })

  test("should accept workflow with id and description", () => {
    const result = validateRoleFrontmatter({
      name: "workflow-role",
      id: "workflow-role",
      workflow: {
        id: "main-workflow",
        description: "Main workflow for the role",
        phases: [{ id: "init", description: "Initialization phase" }],
      },
    })

    expect(result.valid).toBe(true)
    expect(result.normalized?.workflow?.id).toBe("main-workflow")
    expect(result.normalized?.workflow?.description).toBe(
      "Main workflow for the role"
    )
    expect(result.normalized?.workflow?.phases[0].description).toBe(
      "Initialization phase"
    )
  })

  test("should accept workflow with deeply nested structure", () => {
    const result = validateRoleFrontmatter({
      name: "complex-workflow-role",
      id: "complex-workflow-role",
      workflow: {
        id: "full-workflow",
        description: "Full nested workflow",
        phases: [
          {
            id: "planning",
            description: "Planning phase",
            tasks: [
              {
                id: "gather-requirements",
                description: "Gather requirements",
                actions: [
                  {
                    id: "interview-stakeholders",
                    description: "Interview stakeholders",
                    specifications: [
                      {
                        id: "stakeholder-list",
                        description: "List of stakeholders",
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "execution",
            description: "Execution phase",
            tasks: [],
          },
        ],
      },
    })

    expect(result.valid).toBe(true)
    const workflow = result.normalized?.workflow
    expect(workflow?.id).toBe("full-workflow")
    expect(workflow?.phases).toHaveLength(2)

    const planning = workflow?.phases[0]
    expect(planning?.id).toBe("planning")
    expect(planning?.tasks).toHaveLength(1)
    expect(planning?.tasks?.[0]?.actions).toHaveLength(1)
    expect(planning?.tasks?.[0]?.actions?.[0]?.specifications).toHaveLength(1)
    expect(planning?.tasks?.[0]?.actions?.[0]?.specifications?.[0]?.id).toBe(
      "stakeholder-list"
    )

    const execution = workflow?.phases[1]
    expect(execution?.tasks).toEqual([])
  })

  test("should accept empty tasks, actions, and specifications arrays", () => {
    const result = validateRoleFrontmatter({
      name: "empty-children-role",
      id: "empty-children-role",
      workflow: {
        phases: [
          {
            id: "phase-with-empty-tasks",
            tasks: [],
          },
          {
            id: "phase-with-task-no-actions",
            tasks: [
              {
                id: "task1",
                actions: [],
              },
              {
                id: "task2",
                actions: [
                  {
                    id: "action1",
                    specifications: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    expect(result.valid).toBe(true)
    expect(result.normalized?.workflow?.phases[0]?.tasks).toEqual([])
    expect(result.normalized?.workflow?.phases[1]?.tasks?.[0]?.actions).toEqual(
      []
    )
    expect(
      result.normalized?.workflow?.phases[1]?.tasks?.[1]?.actions?.[0]
        ?.specifications
    ).toEqual([])
  })
})

// ===== 无效 workflow 元数据测试 =====

describe("RoleFrontmatterValidator — invalid workflow metadata", () => {
  test("should reject workflow that is not an object", () => {
    const result = validateRoleFrontmatter({
      name: "bad-workflow",
      id: "bad-workflow",
      workflow: "not-an-object",
    })

    expect(result.valid).toBe(false)
    expect(
      result.issues.some((i) => i.field === "workflow" && i.level === "error")
    ).toBe(true)
  })

  test("should reject workflow that is an array", () => {
    const result = validateRoleFrontmatter({
      name: "bad-workflow",
      id: "bad-workflow",
      workflow: [],
    })

    expect(result.valid).toBe(false)
  })

  test("should reject workflow without phases", () => {
    const result = validateRoleFrontmatter({
      name: "no-phases",
      id: "no-phases",
      workflow: {
        id: "no-phases-workflow",
      },
    })

    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.field === "workflow.phases")).toBe(true)
  })

  test("should reject workflow with empty phases array", () => {
    const result = validateRoleFrontmatter({
      name: "empty-phases",
      id: "empty-phases",
      workflow: {
        phases: [],
      },
    })

    expect(result.valid).toBe(false)
    expect(
      result.issues.some(
        (i) =>
          i.field === "workflow.phases" && i.message.includes("non-empty array")
      )
    ).toBe(true)
  })

  test("should reject workflow.phases when not an array", () => {
    const result = validateRoleFrontmatter({
      name: "bad-phases",
      id: "bad-phases",
      workflow: {
        phases: "not-array",
      },
    })

    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.field === "workflow.phases")).toBe(true)
  })

  test("should reject workflow.id when not a string", () => {
    const result = validateRoleFrontmatter({
      name: "bad-workflow-id",
      id: "bad-workflow-id",
      workflow: {
        id: 123,
        phases: [{ id: "init" }],
      },
    })

    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.field === "workflow.id")).toBe(true)
  })

  test("should reject workflow.description when not a string", () => {
    const result = validateRoleFrontmatter({
      name: "bad-workflow-desc",
      id: "bad-workflow-desc",
      workflow: {
        description: 42,
        phases: [{ id: "init" }],
      },
    })

    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.field === "workflow.description")).toBe(
      true
    )
  })

  test("should reject phase that is not an object", () => {
    const result = validateRoleFrontmatter({
      name: "bad-phase",
      id: "bad-phase",
      workflow: {
        phases: ["not-an-object"],
      },
    })

    expect(result.valid).toBe(false)
    expect(
      result.issues.some(
        (i) => i.field === "workflow.phases[0]" && i.level === "error"
      )
    ).toBe(true)
  })

  test("should reject phase without id", () => {
    const result = validateRoleFrontmatter({
      name: "phase-no-id",
      id: "phase-no-id",
      workflow: {
        phases: [{ description: "missing id" }],
      },
    })

    expect(result.valid).toBe(false)
    expect(
      result.issues.some(
        (i) => i.field === "workflow.phases[0].id" && i.level === "error"
      )
    ).toBe(true)
  })

  test("should reject phase with empty string id", () => {
    const result = validateRoleFrontmatter({
      name: "phase-empty-id",
      id: "phase-empty-id",
      workflow: {
        phases: [{ id: "  " }],
      },
    })

    expect(result.valid).toBe(false)
    expect(
      result.issues.some(
        (i) => i.field === "workflow.phases[0].id" && i.level === "error"
      )
    ).toBe(true)
  })

  test("should reject phase with non-string description", () => {
    const result = validateRoleFrontmatter({
      name: "bad-phase-desc",
      id: "bad-phase-desc",
      workflow: {
        phases: [{ id: "init", description: 123 }],
      },
    })

    expect(result.valid).toBe(false)
    expect(
      result.issues.some(
        (i) =>
          i.field === "workflow.phases[0].description" && i.level === "error"
      )
    ).toBe(true)
  })

  test("should reject phase.tasks when not an array", () => {
    const result = validateRoleFrontmatter({
      name: "bad-tasks",
      id: "bad-tasks",
      workflow: {
        phases: [{ id: "init", tasks: "not-array" }],
      },
    })

    expect(result.valid).toBe(false)
    expect(
      result.issues.some(
        (i) => i.field === "workflow.phases[0].tasks" && i.level === "error"
      )
    ).toBe(true)
  })

  test("should reject task that is not an object", () => {
    const result = validateRoleFrontmatter({
      name: "bad-task",
      id: "bad-task",
      workflow: {
        phases: [{ id: "init", tasks: ["not-an-object"] }],
      },
    })

    expect(result.valid).toBe(false)
    expect(
      result.issues.some(
        (i) => i.field === "workflow.phases[0].tasks[0]" && i.level === "error"
      )
    ).toBe(true)
  })

  test("should reject task without id", () => {
    const result = validateRoleFrontmatter({
      name: "task-no-id",
      id: "task-no-id",
      workflow: {
        phases: [{ id: "init", tasks: [{ description: "no id" }] }],
      },
    })

    expect(result.valid).toBe(false)
  })

  test("should reject action without id", () => {
    const result = validateRoleFrontmatter({
      name: "action-no-id",
      id: "action-no-id",
      workflow: {
        phases: [
          {
            id: "init",
            tasks: [{ id: "task1", actions: [{ description: "no id" }] }],
          },
        ],
      },
    })

    expect(result.valid).toBe(false)
  })

  test("should reject specification without id", () => {
    const result = validateRoleFrontmatter({
      name: "spec-no-id",
      id: "spec-no-id",
      workflow: {
        phases: [
          {
            id: "init",
            tasks: [
              {
                id: "task1",
                actions: [
                  {
                    id: "action1",
                    specifications: [{ description: "no id" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    expect(result.valid).toBe(false)
  })

  test("should reject task.actions when not an array", () => {
    const result = validateRoleFrontmatter({
      name: "bad-actions",
      id: "bad-actions",
      workflow: {
        phases: [
          { id: "init", tasks: [{ id: "task1", actions: "not-array" }] },
        ],
      },
    })

    expect(result.valid).toBe(false)
  })

  test("should reject action.specifications when not an array", () => {
    const result = validateRoleFrontmatter({
      name: "bad-specs",
      id: "bad-specs",
      workflow: {
        phases: [
          {
            id: "init",
            tasks: [
              {
                id: "task1",
                actions: [{ id: "action1", specifications: "not-array" }],
              },
            ],
          },
        ],
      },
    })

    expect(result.valid).toBe(false)
  })
})

// ===== 重复 id 检测测试 =====

describe("RoleFrontmatterValidator — duplicate sibling id detection", () => {
  test("should warn on duplicate phase ids within workflow", () => {
    const result = validateRoleFrontmatter({
      name: "dup-phases",
      id: "dup-phases",
      workflow: {
        phases: [{ id: "init" }, { id: "init", description: "duplicate init" }],
      },
    })

    // 重复 id 是 warning，不应该导致 invalid
    expect(result.valid).toBe(true)
    expect(
      result.issues.some(
        (i) =>
          i.level === "warning" &&
          i.field === "workflow.phases[1].id" &&
          i.message.includes("duplicate phase id")
      )
    ).toBe(true)
  })

  test("should warn on duplicate task ids within same phase", () => {
    const result = validateRoleFrontmatter({
      name: "dup-tasks",
      id: "dup-tasks",
      workflow: {
        phases: [
          {
            id: "init",
            tasks: [
              { id: "task1" },
              { id: "task1", description: "duplicate task" },
            ],
          },
        ],
      },
    })

    expect(result.valid).toBe(true)
    expect(
      result.issues.some(
        (i) => i.level === "warning" && i.message.includes("duplicate task id")
      )
    ).toBe(true)
  })

  test("should warn on duplicate action ids within same task", () => {
    const result = validateRoleFrontmatter({
      name: "dup-actions",
      id: "dup-actions",
      workflow: {
        phases: [
          {
            id: "init",
            tasks: [
              {
                id: "task1",
                actions: [
                  { id: "act" },
                  { id: "act", description: "duplicate action" },
                ],
              },
            ],
          },
        ],
      },
    })

    expect(result.valid).toBe(true)
    expect(
      result.issues.some(
        (i) =>
          i.level === "warning" && i.message.includes("duplicate action id")
      )
    ).toBe(true)
  })

  test("should warn on duplicate specification ids within same action", () => {
    const result = validateRoleFrontmatter({
      name: "dup-specs",
      id: "dup-specs",
      workflow: {
        phases: [
          {
            id: "init",
            tasks: [
              {
                id: "task1",
                actions: [
                  {
                    id: "action1",
                    specifications: [
                      { id: "spec1" },
                      { id: "spec1", description: "duplicate spec" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    expect(result.valid).toBe(true)
    expect(
      result.issues.some(
        (i) =>
          i.level === "warning" &&
          i.message.includes("duplicate specification id")
      )
    ).toBe(true)
  })

  test("should not warn on same id across different sibling groups", () => {
    // Same task id in different phases is OK
    const result = validateRoleFrontmatter({
      name: "cross-phase-same-id",
      id: "cross-phase-same-id",
      workflow: {
        phases: [
          { id: "phase-a", tasks: [{ id: "task1" }] },
          { id: "phase-b", tasks: [{ id: "task1" }] },
        ],
      },
    })

    expect(result.valid).toBe(true)
    expect(result.issues.some((i) => i.level === "warning")).toBe(false)
  })

  test("should not warn on same id across different nesting levels", () => {
    // A phase id "init" and a task id "init" in a different phase are OK
    const result = validateRoleFrontmatter({
      name: "cross-level-same-id",
      id: "cross-level-same-id",
      workflow: {
        phases: [{ id: "init", tasks: [{ id: "init" }] }],
      },
    })

    expect(result.valid).toBe(true)
    expect(result.issues.some((i) => i.level === "warning")).toBe(false)
  })
})

// ===== 归一化测试 =====

describe("RoleFrontmatterValidator — workflow normalization", () => {
  test("should normalize workflow with all fields present", () => {
    const result = validateRoleFrontmatter({
      name: "norm-role",
      id: "norm-role",
      workflow: {
        id: "main",
        description: "Main workflow",
        phases: [
          {
            id: "phase1",
            description: "First phase",
            tasks: [
              {
                id: "task1",
                description: "First task",
                actions: [
                  {
                    id: "action1",
                    description: "First action",
                    specifications: [
                      {
                        id: "spec1",
                        description: "First spec",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    expect(result.valid).toBe(true)
    expect(result.normalized?.workflow).toEqual({
      id: "main",
      description: "Main workflow",
      phases: [
        {
          id: "phase1",
          description: "First phase",
          tasks: [
            {
              id: "task1",
              description: "First task",
              actions: [
                {
                  id: "action1",
                  description: "First action",
                  specifications: [
                    {
                      id: "spec1",
                      description: "First spec",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  })

  test("should normalize workflow omitting undefined optional fields", () => {
    const result = validateRoleFrontmatter({
      name: "min-norm-role",
      id: "min-norm-role",
      workflow: {
        phases: [{ id: "phase1" }],
      },
    })

    expect(result.valid).toBe(true)
    const workflow = result.normalized?.workflow
    expect(workflow).toEqual({
      id: undefined,
      description: undefined,
      phases: [
        {
          id: "phase1",
          description: undefined,
          tasks: undefined,
        },
      ],
    })
  })

  test("should normalize phases with tasks but no actions", () => {
    const result = validateRoleFrontmatter({
      name: "tasks-no-actions",
      id: "tasks-no-actions",
      workflow: {
        phases: [{ id: "phase1", tasks: [{ id: "task1" }] }],
      },
    })

    expect(result.valid).toBe(true)
    expect(result.normalized?.workflow?.phases[0]?.tasks?.[0]).toEqual({
      id: "task1",
      description: undefined,
      actions: undefined,
    })
  })

  test("should normalize actions with no specifications", () => {
    const result = validateRoleFrontmatter({
      name: "actions-no-specs",
      id: "actions-no-specs",
      workflow: {
        phases: [
          {
            id: "phase1",
            tasks: [{ id: "task1", actions: [{ id: "action1" }] }],
          },
        ],
      },
    })

    expect(result.valid).toBe(true)
    expect(
      result.normalized?.workflow?.phases[0]?.tasks?.[0]?.actions?.[0]
    ).toEqual({
      id: "action1",
      description: undefined,
      specifications: undefined,
    })
  })

  test("should normalize empty arrays as empty arrays (not undefined)", () => {
    const result = validateRoleFrontmatter({
      name: "empty-arrays",
      id: "empty-arrays",
      workflow: {
        phases: [
          {
            id: "phase1",
            tasks: [
              {
                id: "task1",
                actions: [
                  {
                    id: "action1",
                    specifications: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    expect(result.valid).toBe(true)
    expect(
      result.normalized?.workflow?.phases[0]?.tasks?.[0]?.actions?.[0]
        ?.specifications
    ).toEqual([])
  })
})

// ===== formatRoleValidationIssue 测试 =====

describe("formatRoleValidationIssue", () => {
  test("should format issue with field", () => {
    const issue: RoleValidationIssue = {
      level: "error",
      field: "workflow.phases[0].id",
      message: "phase id must be a non-empty string",
    }
    const formatted = formatRoleValidationIssue(issue, "testRole?.md")
    expect(formatted).toContain("testRole?.md")
    expect(formatted).toContain("workflow.phases[0].id")
    expect(formatted).toContain("phase id must be a non-empty string")
  })

  test("should format issue without field", () => {
    const issue: RoleValidationIssue = {
      level: "error",
      message: "frontmatter must be an object",
    }
    const formatted = formatRoleValidationIssue(issue, "any.md")
    expect(formatted).toContain("frontmatter must be an object")
    expect(formatted).not.toContain("undefined")
  })
})
