import * as path from "node:path"
import type {
  RoleArgType,
  RoleMemoryFieldType,
  RoleMetadata,
  RoleMemoryFieldSpec,
  RoleRequiredArgSpec,
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

  const normalizedName =
    typeof raw.name === "string" ? raw.name.trim() : undefined

  if (
    normalizedName &&
    options?.expectedRoleName &&
    normalizedName !== options.expectedRoleName
  ) {
    issues.push({
      level: "warning",
      field: "name",
      message: `name '${normalizedName}' does not match filename '${options.expectedRoleName}'`,
    })
  }

  if (typeof raw.description === "string" && raw.description.length > 200) {
    issues.push({
      level: "warning",
      field: "description",
      message: "description is longer than 200 characters",
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

export function formatRoleValidationIssue(
  issue: RoleValidationIssue,
  filePath: string
): string {
  const fieldSuffix = issue.field ? ` (${issue.field})` : ""
  const relativePath = filePath ? path.basename(filePath) : filePath
  return `[RoleManager] Role file ${relativePath}${fieldSuffix}: ${issue.message}`
}
