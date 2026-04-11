import * as path from "node:path"
import type {
  RoleArgType,
  RoleMemoryFieldType,
  RoleMetadata,
  RoleMemoryFieldSpec,
  RoleRequiredArgSpec,
  WorkflowDefinition,
  PhaseDefinition,
  TaskDefinition,
  ActionDefinition,
  SpecificationDefinition,
} from "../types"

const VALID_ROLE_ARG_TYPES: RoleArgType[] = ["string"]

const VALID_ROLE_MEMORY_FIELD_TYPES: RoleMemoryFieldType[] = [
  "string",
  "string[]",
  "object",
  "array",
  "number",
  "boolean",
]

export interface RoleValidationIssue {
  level: "error" | "warning"
  field?: string
  message: string
}

export interface RoleValidationResult {
  valid: boolean
  normalized?: RoleMetadata
  issues: RoleValidationIssue[]
}

export function validateRoleFrontmatter(
  frontmatterData: unknown,
  options?: {
    filePath?: string
    expectedRoleName?: string
  }
): RoleValidationResult {
  const issues: RoleValidationIssue[] = []

  if (
    !frontmatterData ||
    typeof frontmatterData !== "object" ||
    Array.isArray(frontmatterData)
  ) {
    return {
      valid: false,
      issues: [
        {
          level: "error",
          message: "frontmatter must be an object",
        },
      ],
    }
  }

  const raw = frontmatterData as Record<string, unknown>

  if (raw.resolvedContexts !== undefined) {
    issues.push({
      level: "error",
      field: "resolvedContexts",
      message:
        "resolvedContexts is internal-only and must not appear in frontmatter",
    })
  }

  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    issues.push({
      level: "error",
      field: "name",
      message: "name must be a non-empty string",
    })
  }

  if (raw.description !== undefined && typeof raw.description !== "string") {
    issues.push({
      level: "error",
      field: "description",
      message: "description must be a string",
    })
  }

  if (raw.soul !== undefined && typeof raw.soul !== "boolean") {
    issues.push({
      level: "error",
      field: "soul",
      message: "soul must be a boolean",
    })
  }

  validateStringArrayField(raw.responsibilities, "responsibilities", issues)
  validateStringArrayField(raw.boundaries, "boundaries", issues)
  validateStringArrayField(raw.contextIds, "contextIds", issues)
  validateStringArrayField(raw.canHire, "canHire", issues)
  validateStringArrayField(raw.groups, "groups", issues)

  if (raw.requiredArgs !== undefined) {
    validateRequiredArgs(raw.requiredArgs, issues)
  }

  if (raw.memorySchema !== undefined) {
    validateMemorySchema(raw.memorySchema, issues)
  }

  // @experimental internal — 验证 workflow 元数据（可选）
  let normalizedWorkflow: WorkflowDefinition | undefined
  if (raw.workflow !== undefined) {
    normalizedWorkflow = validateWorkflow(raw.workflow, issues)
  }

  const normalizedName =
    typeof raw.name === "string" ? raw.name.trim() : undefined

  // Note: We do NOT validate that name matches filename
  // Filename uses kebab-case for filesystem compatibility (e.g., "project-manager.md")
  // But name uses human-readable format for system usage (e.g., "Project Manager")
  // The name field is what gets stored in employee.role and used for getRole() lookups

  if (typeof raw.description === "string" && raw.description.length > 512) {
    issues.push({
      level: "warning",
      field: "description",
      message: "description is longer than 512 characters",
    })
  }

  const hasError = issues.some((issue) => issue.level === "error")

  if (hasError || !normalizedName) {
    return {
      valid: false,
      issues,
    }
  }

  return {
    valid: true,
    normalized: {
      name: normalizedName,
      description:
        typeof raw.description === "string" ? raw.description : undefined,
      soul: typeof raw.soul === "boolean" ? raw.soul : true,
      responsibilities: raw.responsibilities as string[] | undefined,
      boundaries: raw.boundaries as string[] | undefined,
      contextIds: raw.contextIds as string[] | undefined,
      requiredArgs: raw.requiredArgs as
        | Record<string, RoleRequiredArgSpec>
        | undefined,
      canHire: raw.canHire as string[] | undefined,
      groups: raw.groups as string[] | undefined,
      memorySchema: raw.memorySchema as
        | Record<string, RoleMemoryFieldSpec>
        | undefined,
      workflow: normalizedWorkflow,
    },
    issues,
  }
}

function validateStringArrayField(
  value: unknown,
  field: string,
  issues: RoleValidationIssue[]
): void {
  if (value === undefined) {
    return
  }

  if (!Array.isArray(value)) {
    issues.push({
      level: "error",
      field,
      message: `${field} must be a string array`,
    })
    return
  }

  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      issues.push({
        level: "error",
        field,
        message: `${field} must contain only non-empty strings`,
      })
      return
    }
  }
}

function validateRequiredArgs(
  value: unknown,
  issues: RoleValidationIssue[]
): void {
  if (!isPlainObject(value)) {
    issues.push({
      level: "error",
      field: "requiredArgs",
      message: "requiredArgs must be an object mapping arg names to specs",
    })
    return
  }

  for (const [key, spec] of Object.entries(value)) {
    if (key.trim().length === 0) {
      issues.push({
        level: "error",
        field: "requiredArgs",
        message: "requiredArgs keys must be non-empty strings",
      })
      return
    }

    if (!isPlainObject(spec)) {
      issues.push({
        level: "error",
        field: `requiredArgs.${key}`,
        message: "requiredArgs spec must be an object",
      })
      return
    }

    if (
      typeof spec.type !== "string" ||
      !VALID_ROLE_ARG_TYPES.includes(spec.type as RoleArgType)
    ) {
      issues.push({
        level: "error",
        field: `requiredArgs.${key}.type`,
        message: `requiredArgs type must be one of: ${VALID_ROLE_ARG_TYPES.join(", ")}`,
      })
      return
    }

    if (
      typeof spec.description !== "string" ||
      spec.description.trim().length === 0
    ) {
      issues.push({
        level: "error",
        field: `requiredArgs.${key}.description`,
        message: "requiredArgs description must be a non-empty string",
      })
      return
    }
  }
}

function validateMemorySchema(
  value: unknown,
  issues: RoleValidationIssue[]
): void {
  if (!isPlainObject(value)) {
    issues.push({
      level: "error",
      field: "memorySchema",
      message: "memorySchema must be an object mapping field names to specs",
    })
    return
  }

  for (const [key, spec] of Object.entries(value)) {
    if (key.trim().length === 0) {
      issues.push({
        level: "error",
        field: "memorySchema",
        message: "memorySchema keys must be non-empty strings",
      })
      return
    }

    if (!isPlainObject(spec)) {
      issues.push({
        level: "error",
        field: `memorySchema.${key}`,
        message: "memorySchema field spec must be an object",
      })
      return
    }

    if (
      typeof spec.type !== "string" ||
      !VALID_ROLE_MEMORY_FIELD_TYPES.includes(spec.type as RoleMemoryFieldType)
    ) {
      issues.push({
        level: "error",
        field: `memorySchema.${key}.type`,
        message: `memorySchema type must be one of: ${VALID_ROLE_MEMORY_FIELD_TYPES.join(", ")}`,
      })
      return
    }

    if (
      typeof spec.description !== "string" ||
      spec.description.trim().length === 0
    ) {
      issues.push({
        level: "error",
        field: `memorySchema.${key}.description`,
        message: "memorySchema description must be a non-empty string",
      })
      return
    }

    if (spec.required !== undefined && typeof spec.required !== "boolean") {
      issues.push({
        level: "error",
        field: `memorySchema.${key}.required`,
        message: "memorySchema required must be a boolean when present",
      })
      return
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

/**
 * @experimental internal
 *
 * 验证 workflow 元数据的结构形状和局部不变量。
 * 不执行语义验证或跨引用检查。
 * 返回归一化后的 WorkflowDefinition，如果验证失败返回 undefined。
 */
function validateWorkflow(
  value: unknown,
  issues: RoleValidationIssue[]
): WorkflowDefinition | undefined {
  if (!isPlainObject(value)) {
    issues.push({
      level: "error",
      field: "workflow",
      message: "workflow must be an object",
    })
    return undefined
  }

  const raw = value as Record<string, unknown>
  let hasError = false

  // 验证可选的 id
  if (raw.id !== undefined && typeof raw.id !== "string") {
    issues.push({
      level: "error",
      field: "workflow.id",
      message: "workflow.id must be a string",
    })
    hasError = true
  }

  // 验证可选的 description
  if (raw.description !== undefined && typeof raw.description !== "string") {
    issues.push({
      level: "error",
      field: "workflow.description",
      message: "workflow.description must be a string",
    })
    hasError = true
  }

  // 验证 phases 数组（必须存在且非空）
  if (!Array.isArray(raw.phases)) {
    issues.push({
      level: "error",
      field: "workflow.phases",
      message: "workflow.phases must be an array",
    })
    hasError = true
  } else if (raw.phases.length === 0) {
    issues.push({
      level: "error",
      field: "workflow.phases",
      message: "workflow.phases must be a non-empty array",
    })
    hasError = true
  }

  if (hasError) {
    return undefined
  }

  // 验证每个 phase
  const phases = raw.phases as Record<string, unknown>[]
  const phaseIds = new Set<string>()
  const normalizedPhases: PhaseDefinition[] = []

  for (let i = 0; i < phases.length; i++) {
    const phaseResult = validatePhase(phases[i], i, phaseIds, issues)
    if (phaseResult === null) {
      hasError = true
    } else {
      normalizedPhases.push(phaseResult)
    }
  }

  if (hasError) {
    return undefined
  }

  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    description:
      typeof raw.description === "string" ? raw.description : undefined,
    phases: normalizedPhases,
  }
}

/**
 * @experimental internal
 *
 * 验证单个 phase 定义。
 * 返回 null 表示验证失败（error级别），返回 PhaseDefinition 表示成功。
 */
function validatePhase(
  value: unknown,
  index: number,
  siblingIds: Set<string>,
  issues: RoleValidationIssue[]
): PhaseDefinition | null {
  if (!isPlainObject(value)) {
    issues.push({
      level: "error",
      field: `workflow.phases[${index}]`,
      message: "phase must be an object",
    })
    return null
  }

  const raw = value as Record<string, unknown>
  let hasError = false

  // 验证 id（必填，非空字符串）
  if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
    issues.push({
      level: "error",
      field: `workflow.phases[${index}].id`,
      message: "phase id must be a non-empty string",
    })
    hasError = true
  } else {
    // 检查同级重复 id（warning，不是 error）
    if (siblingIds.has(raw.id)) {
      issues.push({
        level: "warning",
        field: `workflow.phases[${index}].id`,
        message: `duplicate phase id "${raw.id}" within workflow`,
      })
    }
    siblingIds.add(raw.id)
  }

  // 验证可选的 description
  if (raw.description !== undefined && typeof raw.description !== "string") {
    issues.push({
      level: "error",
      field: `workflow.phases[${index}].description`,
      message: "phase description must be a string",
    })
    hasError = true
  }

  // 验证可选的 tasks 数组
  if (raw.tasks !== undefined) {
    if (!Array.isArray(raw.tasks)) {
      issues.push({
        level: "error",
        field: `workflow.phases[${index}].tasks`,
        message: "phase tasks must be an array",
      })
      hasError = true
    } else {
      const taskIds = new Set<string>()
      const normalizedTasks: TaskDefinition[] = []

      for (let j = 0; j < raw.tasks.length; j++) {
        const taskResult = validateTask(raw.tasks[j], index, j, taskIds, issues)
        if (taskResult === null) {
          hasError = true
        } else {
          normalizedTasks.push(taskResult)
        }
      }

      if (!hasError) {
        return {
          id: raw.id as string,
          description:
            typeof raw.description === "string" ? raw.description : undefined,
          tasks: normalizedTasks,
        }
      }
    }
  }

  if (hasError) {
    return null
  }

  // 没有 tasks 的情况
  return {
    id: raw.id as string,
    description:
      typeof raw.description === "string" ? raw.description : undefined,
    tasks: raw.tasks !== undefined ? [] : undefined,
  }
}

/**
 * @experimental internal
 *
 * 验证单个 task 定义。
 * 返回 null 表示验证失败，返回 TaskDefinition 表示成功。
 */
function validateTask(
  value: unknown,
  phaseIndex: number,
  taskIndex: number,
  siblingIds: Set<string>,
  issues: RoleValidationIssue[]
): TaskDefinition | null {
  if (!isPlainObject(value)) {
    issues.push({
      level: "error",
      field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}]`,
      message: "task must be an object",
    })
    return null
  }

  const raw = value as Record<string, unknown>
  let hasError = false

  // 验证 id（必填，非空字符串）
  if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
    issues.push({
      level: "error",
      field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].id`,
      message: "task id must be a non-empty string",
    })
    hasError = true
  } else {
    if (siblingIds.has(raw.id)) {
      issues.push({
        level: "warning",
        field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].id`,
        message: `duplicate task id "${raw.id}" within phase`,
      })
    }
    siblingIds.add(raw.id)
  }

  // 验证可选的 description
  if (raw.description !== undefined && typeof raw.description !== "string") {
    issues.push({
      level: "error",
      field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].description`,
      message: "task description must be a string",
    })
    hasError = true
  }

  // 验证可选的 actions 数组
  if (raw.actions !== undefined) {
    if (!Array.isArray(raw.actions)) {
      issues.push({
        level: "error",
        field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].actions`,
        message: "task actions must be an array",
      })
      hasError = true
    } else {
      const actionIds = new Set<string>()
      const normalizedActions: ActionDefinition[] = []

      for (let k = 0; k < raw.actions.length; k++) {
        const actionResult = validateAction(
          raw.actions[k],
          phaseIndex,
          taskIndex,
          k,
          actionIds,
          issues
        )
        if (actionResult === null) {
          hasError = true
        } else {
          normalizedActions.push(actionResult)
        }
      }

      if (!hasError) {
        return {
          id: raw.id as string,
          description:
            typeof raw.description === "string" ? raw.description : undefined,
          actions: normalizedActions,
        }
      }
    }
  }

  if (hasError) {
    return null
  }

  return {
    id: raw.id as string,
    description:
      typeof raw.description === "string" ? raw.description : undefined,
    actions: raw.actions !== undefined ? [] : undefined,
  }
}

/**
 * @experimental internal
 *
 * 验证单个 action 定义。
 * 返回 null 表示验证失败，返回 ActionDefinition 表示成功。
 */
function validateAction(
  value: unknown,
  phaseIndex: number,
  taskIndex: number,
  actionIndex: number,
  siblingIds: Set<string>,
  issues: RoleValidationIssue[]
): ActionDefinition | null {
  if (!isPlainObject(value)) {
    issues.push({
      level: "error",
      field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].actions[${actionIndex}]`,
      message: "action must be an object",
    })
    return null
  }

  const raw = value as Record<string, unknown>
  let hasError = false

  // 验证 id（必填，非空字符串）
  if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
    issues.push({
      level: "error",
      field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].actions[${actionIndex}].id`,
      message: "action id must be a non-empty string",
    })
    hasError = true
  } else {
    if (siblingIds.has(raw.id)) {
      issues.push({
        level: "warning",
        field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].actions[${actionIndex}].id`,
        message: `duplicate action id "${raw.id}" within task`,
      })
    }
    siblingIds.add(raw.id)
  }

  // 验证可选的 description
  if (raw.description !== undefined && typeof raw.description !== "string") {
    issues.push({
      level: "error",
      field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].actions[${actionIndex}].description`,
      message: "action description must be a string",
    })
    hasError = true
  }

  // 验证可选的 specifications 数组
  if (raw.specifications !== undefined) {
    if (!Array.isArray(raw.specifications)) {
      issues.push({
        level: "error",
        field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].actions[${actionIndex}].specifications`,
        message: "action specifications must be an array",
      })
      hasError = true
    } else {
      const specIds = new Set<string>()
      const normalizedSpecs: SpecificationDefinition[] = []

      for (let s = 0; s < raw.specifications.length; s++) {
        const specResult = validateSpecification(
          raw.specifications[s],
          phaseIndex,
          taskIndex,
          actionIndex,
          s,
          specIds,
          issues
        )
        if (specResult === null) {
          hasError = true
        } else {
          normalizedSpecs.push(specResult)
        }
      }

      if (!hasError) {
        return {
          id: raw.id as string,
          description:
            typeof raw.description === "string" ? raw.description : undefined,
          specifications: normalizedSpecs,
        }
      }
    }
  }

  if (hasError) {
    return null
  }

  return {
    id: raw.id as string,
    description:
      typeof raw.description === "string" ? raw.description : undefined,
    specifications: raw.specifications !== undefined ? [] : undefined,
  }
}

/**
 * @experimental internal
 *
 * 验证单个 specification 定义。
 * 返回 null 表示验证失败，返回 SpecificationDefinition 表示成功。
 */
function validateSpecification(
  value: unknown,
  phaseIndex: number,
  taskIndex: number,
  actionIndex: number,
  specIndex: number,
  siblingIds: Set<string>,
  issues: RoleValidationIssue[]
): SpecificationDefinition | null {
  if (!isPlainObject(value)) {
    issues.push({
      level: "error",
      field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].actions[${actionIndex}].specifications[${specIndex}]`,
      message: "specification must be an object",
    })
    return null
  }

  const raw = value as Record<string, unknown>
  let hasError = false

  // 验证 id（必填，非空字符串）
  if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
    issues.push({
      level: "error",
      field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].actions[${actionIndex}].specifications[${specIndex}].id`,
      message: "specification id must be a non-empty string",
    })
    hasError = true
  } else {
    if (siblingIds.has(raw.id)) {
      issues.push({
        level: "warning",
        field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].actions[${actionIndex}].specifications[${specIndex}].id`,
        message: `duplicate specification id "${raw.id}" within action`,
      })
    }
    siblingIds.add(raw.id)
  }

  // 验证可选的 description
  if (raw.description !== undefined && typeof raw.description !== "string") {
    issues.push({
      level: "error",
      field: `workflow.phases[${phaseIndex}].tasks[${taskIndex}].actions[${actionIndex}].specifications[${specIndex}].description`,
      message: "specification description must be a string",
    })
    hasError = true
  }

  if (hasError) {
    return null
  }

  return {
    id: raw.id as string,
    description:
      typeof raw.description === "string" ? raw.description : undefined,
  }
}

export function formatRoleValidationIssue(
  issue: RoleValidationIssue,
  filePath: string
): string {
  const fieldSuffix = issue.field ? ` (${issue.field})` : ""
  const relativePath = filePath ? path.basename(filePath) : filePath
  return `[RoleManager] Role file ${relativePath}${fieldSuffix}: ${issue.message}`
}
