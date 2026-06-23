import type { BossId, EmployeeWorkSessionId } from "./employee"

/**
 * Boss Manager interface
 * Defines the contract for boss identity management
 */
export interface IBossManager {
  /**
   * Check if a name is a boss
   */
  isBoss(name: string): boolean

  /**
   * Get boss name from BossId
   */
  getBossName(bossId: BossId): string | null

  /**
   * Get all boss names
   */
  getBosses(): string[]

  /**
   * Reload configuration
   */
  reload(roleManager?: any): Promise<void>

  /**
   * Add a boss
   */
  addBoss(name: string): void

  /**
   * Remove a boss
   */
  removeBoss(name: string): void

  /**
   * Record boss-employee session mapping
   */
  recordSession(
    bossName: string,
    employeeId: EmployeeWorkSessionId,
    sessionId: string
  ): Promise<void>

  /**
   * Get session ID for boss-employee pair
   */
  getSession(
    bossName: string,
    employeeId: EmployeeWorkSessionId
  ): Promise<string | undefined>

  /**
   * Clear session mapping
   */
  clearSession(
    bossName: string,
    employeeId: EmployeeWorkSessionId
  ): Promise<void>
}
