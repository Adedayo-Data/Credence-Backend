import { pool } from '../../db/pool.js'
import {
  InMemoryAuditLogsRepository,
  PostgresAuditLogsRepository,
  type AuditLogRepository,
} from '../../db/repositories/auditLogsRepository.js'
import type { AuditLogEntry, AuditLogFilters, AuditLogInput } from './types.js'
import { AuditAction } from './types.js'

/**
 * Audit log service for tracking admin actions
 * In production, this would write to a database or centralized logging system
 */
export class AuditLogService {
  constructor(private readonly repository: AuditLogRepository) {}

  /**
   * Log an admin action
   * 
   * @param adminId - ID of the admin performing the action
   * @param adminEmail - Email of the admin
   * @param action - Type of action being performed
   * @param targetUserId - ID of the target user (if applicable)
   * @param targetUserEmail - Email of the target user
   * @param details - Additional details about the action
   * @param status - Whether the action succeeded or failed
   * @param errorMessage - Error message if action failed
   * @param ipAddress - IP address of the requester
   * @returns The created audit log entry
   */
  async logAction(input: AuditLogInput): Promise<AuditLogEntry> {
    return this.repository.append(input)
  }

  /**
   * Get audit logs with optional filtering
   * 
   * @param filters - Optional filters for action, adminId, targetUserId, etc.
   * @param limit - Maximum number of logs to return (default: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Array of matching audit log entries and total count
   */
  async getLogs(
    filters?: AuditLogFilters,
    limit = 100,
    offset = 0
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    return this.repository.query(filters, limit, offset)
  }

  /**
   * Get all audit logs (for testing)
   * @returns All audit log entries
   */
  async getAllLogs(): Promise<AuditLogEntry[]> {
    return this.repository.getAll()
  }

  /**
   * Clear all logs (for testing)
   */
  async clearLogs(): Promise<void> {
    await this.repository.clear()
  }
}

function createRepository(): AuditLogRepository {
  const shouldUsePostgres = process.env.AUDIT_LOG_BACKEND === 'postgres'
  if (!shouldUsePostgres) {
    return new InMemoryAuditLogsRepository()
  }

  return new PostgresAuditLogsRepository(pool)
}

// Create a singleton instance
export const auditLogService = new AuditLogService(createRepository())

// Export types
export { AuditAction } from './types.js'
export type { AuditLogEntry, AuditLogInput, AuditLogFilters } from './types.js'
