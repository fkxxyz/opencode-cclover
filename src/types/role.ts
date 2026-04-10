/**
 * Role metadata and related type definitions
 *
 * This file contains the core type definitions for the role system,
 * including role metadata, context resolution, and role definitions.
 */

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
  description: string

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
  requiredArgs?: Record<
    string,
    {
      /** Argument type (e.g., "string", "number", "boolean") */
      type: string
      /** Description of what this argument is for */
      description: string
    }
  >

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
  memorySchema?: Record<
    string,
    {
      /** Data type: "string" | "string[]" | "object" | "array" | "number" | "boolean" */
      type: string
      /** Description of what this field stores */
      description: string
      /** Whether this field is required */
      required?: boolean
    }
  >

  /**
   * Resolved role contexts (internal use only)
   * This field is populated by RoleManager after loading the role
   * and contains the fully resolved context documents
   */
  resolvedContexts?: ResolvedRoleContext[]
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
  source: "preset" | "global" | "project"
}
