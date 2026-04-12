/**
 * Identity ID validation utility
 *
 * Validates identity IDs for roles and configured bosses.
 * Identity IDs must follow the pattern: /^[a-z][a-z0-9-]{0,63}$/
 * - Must start with a lowercase letter
 * - May contain lowercase letters, digits, and hyphens
 * - Maximum 64 characters total
 */

const IDENTITY_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/

/**
 * Validate an identity ID
 * @param id The identity ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidIdentityId(id: string): boolean {
  return IDENTITY_ID_PATTERN.test(id)
}

/**
 * Get a human-readable error message for an invalid identity ID
 * @param id The invalid identity ID
 * @returns Error message explaining why the ID is invalid
 */
export function getIdentityIdValidationError(id: string): string {
  if (typeof id !== "string" || id.length === 0) {
    return "Identity ID must be a non-empty string"
  }

  if (id.length > 64) {
    return `Identity ID must be at most 64 characters (got ${id.length})`
  }

  if (!/^[a-z]/.test(id)) {
    return "Identity ID must start with a lowercase letter"
  }

  if (!/^[a-z0-9-]+$/.test(id)) {
    return "Identity ID may only contain lowercase letters, digits, and hyphens"
  }

  return "Identity ID is invalid"
}
