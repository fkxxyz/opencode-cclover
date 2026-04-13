/**
 * Context registry type definitions
 *
 * This file defines the formal contract for context.yml files,
 * which provide reusable working context for role definitions.
 */

/**
 * Context source location
 *
 * Defines where a context definition was loaded from.
 */
export type ContextSource = "preset" | "global" | "project"

/**
 * Raw context definition from context.yml
 *
 * Represents a single context entry as authored in a context.yml file.
 * This is the structure that appears under each key in the `contexts` mapping.
 */
export interface RawContextDefinition {
  /** Optional human-readable description of what this context provides */
  description?: string

  /** List of document paths to include in this context */
  documents?: string[]
}

/**
 * Loaded context definition
 *
 * Extends RawContextDefinition with metadata about where the definition was loaded from.
 * This is the internal representation used by RoleManager after loading context.yml files.
 */
export interface ContextDefinition extends RawContextDefinition {
  /** Absolute path to the context.yml file that defined this context */
  sourceFile: string
}

/**
 * Context registry structure
 *
 * Represents the complete structure of a context.yml file.
 * The file must have a root `contexts` key containing a mapping of context IDs to definitions.
 */
export interface ContextRegistry {
  /** Mapping of context IDs to their definitions */
  contexts: Record<string, RawContextDefinition>
}
