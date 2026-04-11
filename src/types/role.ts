/**
 * Role metadata and related type definitions
 *
 * This file defines the formal contract for role frontmatter,
 * context resolution, and loaded role definitions.
 */

export type RoleSource = "preset" | "global" | "project"

/**
 * Supported role argument types.
 *
 * Currently only string is supported by the role system.
 */
export type RoleArgType = "string"

/**
 * Supported roleData field types.
 */
export type RoleMemoryFieldType =
  | "string"
  | "string[]"
  | "object"
  | "array"
  | "number"
  | "boolean"

/**
 * Required argument specification for employee memory.args.
 */
export interface RoleRequiredArgSpec {
  /** Currently supported argument type */
  type: RoleArgType
  /** Human-readable explanation of this parameter */
  description: string
}

/**
 * Role-specific memory field definition for memory.roleData.
 */
export interface RoleMemoryFieldSpec {
  /** Supported field type */
  type: RoleMemoryFieldType
  /** Human-readable explanation of this field */
  description: string
  /** Whether this field must be present */
  required?: boolean
}

/**
 * Resolved role context document
 *
 * Represents a single document that has been resolved from a context ID.
 */
export interface ResolvedRoleContextDocument {
  /** Absolute path to the document file */
  path: string
  /** Full content of the document */
  content: string
}

/**
 * Resolved role context
 *
 * Represents a fully resolved context that includes all associated documents.
 * This is the result of resolving a contextId from the role's contextIds array.
 */
export interface ResolvedRoleContext {
  /** Unique identifier for this context */
  id: string
  /** Optional description of what this context provides */
  description?: string
  /** List of documents included in this context */
  documents: ResolvedRoleContextDocument[]
}

/**
 * @experimental internal
 *
 * Specification definition within an action.
 * Represents a structured specification or reasoning atom attached to an action.
 * No runtime consumer exists in this stage; this is authoring metadata only.
 */
export interface SpecificationDefinition {
  /** Unique identifier within sibling specifications of the same action */
  id: string
  /** Optional human-readable description (documentation only, no runtime semantics) */
  description?: string
}

/**
 * @experimental internal
 *
 * Action definition within a task.
 * Represents a practical context bundle or discrete action step.
 * No runtime consumer exists in this stage; this is authoring metadata only.
 */
export interface ActionDefinition {
  /** Unique identifier within sibling actions of the same task */
  id: string
  /** Optional human-readable description (documentation only, no runtime semantics) */
  description?: string
  /** Optional specifications attached to this action; empty array is valid */
  specifications?: SpecificationDefinition[]
}

/**
 * @experimental internal
 *
 * Task definition within a phase.
 * Represents a unit of work or responsibility within a phase.
 * No runtime consumer exists in this stage; this is authoring metadata only.
 */
export interface TaskDefinition {
  /** Unique identifier within sibling tasks of the same phase */
  id: string
  /** Optional human-readable description (documentation only, no runtime semantics) */
  description?: string
  /** Optional actions attached to this task; empty array is valid */
  actions?: ActionDefinition[]
}

/**
 * @experimental internal
 *
 * Phase definition within a workflow.
 * Represents a distinct stage or phase in the workflow lifecycle.
 * No runtime consumer exists in this stage; this is authoring metadata only.
 */
export interface PhaseDefinition {
  /** Unique identifier within sibling phases of the same workflow */
  id: string
  /** Optional human-readable description (documentation only, no runtime semantics) */
  description?: string
  /** Optional tasks attached to this phase; empty array is valid */
  tasks?: TaskDefinition[]
}

/**
 * @experimental internal
 *
 * Workflow definition for a role.
 * Describes the structured workflow metadata embedded in role frontmatter.
 * No runtime consumer exists in this stage; this is authoring metadata only.
 * The handwritten prompt body remains the sole source of behavioral truth.
 */
export interface WorkflowDefinition {
  /** Optional workflow identifier */
  id?: string
  /** Optional human-readable description (documentation only, no runtime semantics) */
  description?: string
  /** Phases of the workflow; must be non-empty when workflow is present */
  phases: PhaseDefinition[]
}

/**
 * Role metadata
 *
 * Defines the metadata structure for a role. This metadata is typically
 * defined in the YAML frontmatter of a role file and controls the role's
 * behavior, permissions, and memory structure.
 */
export interface RoleMetadata {
  /** Role name (must match the filename without .md extension) */
  name: string

  /** Brief description of the role's purpose */
  description?: string

  /**
   * Memory persistence mode
   * - true: Persistent memory with automatic summarization (default)
   * - false: Temporary memory without summarization
   */
  soul?: boolean

  /**
   * List of responsibilities this role should handle
   * Used to clarify the role's scope and duties
   */
  responsibilities?: string[]

  /**
   * List of boundaries or limitations for this role
   * Used to define what the role should NOT do
   */
  boundaries?: string[]

  /**
   * List of context IDs to include in the role's system prompt
   * Context definitions are loaded from context.yml files
   */
  contextIds?: string[]

  /**
   * Required arguments that must be provided when hiring this role
   * Each argument has a type and description
   */
  requiredArgs?: Record<string, RoleRequiredArgSpec>

  /**
   * List of roles this role is allowed to hire
   * Supports exact names, glob patterns (e.g., "dev-*"), and group references (e.g., "group:engineers")
   */
  canHire?: string[]

  /**
   * List of groups this role belongs to
   * Groups can be referenced in other roles' canHire permissions
   */
  groups?: string[]

  /**
   * Memory schema definition for role-specific data
   * Defines the structure of data stored in memory.roleData
   */
  memorySchema?: Record<string, RoleMemoryFieldSpec>

  /**
   * Resolved role contexts (internal use only)
   * This field is populated by RoleManager after loading the role.
   * It is not part of user-authored YAML frontmatter.
   */
  resolvedContexts?: ResolvedRoleContext[]

  /**
   * @experimental internal
   *
   * Workflow metadata for structured role definition.
   * This is authoring scaffolding with no runtime consumer in this stage.
   * The handwritten prompt body remains the sole source of behavioral truth.
   * Optional: roles without workflow metadata load identically.
   */
  workflow?: WorkflowDefinition
}

/**
 * Role definition
 *
 * Complete role definition including metadata and system prompt.
 * This is the structure returned by RoleManager after loading a role file.
 */
export interface Role extends RoleMetadata {
  /** System prompt content (markdown body after frontmatter) */
  systemPrompt: string

  /** Source location where this role was loaded from */
  source: RoleSource
}
