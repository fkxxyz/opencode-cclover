import type { RoleMetadata } from "../../src/types"

/**
 * Creates a minimal valid RoleMetadata for testing
 * Provides sensible defaults for required fields
 *
 * @param overrides - Partial RoleMetadata to override defaults
 * @returns Complete RoleMetadata object with all required fields
 */
export function createTestRoleMetadata(
  overrides?: Partial<RoleMetadata>
): RoleMetadata {
  const name = overrides?.name || "test-role"
  return {
    name,
    id: overrides?.id || name,
    ...overrides,
  }
}
