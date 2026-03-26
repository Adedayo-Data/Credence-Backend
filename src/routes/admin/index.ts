import { Router, Request, Response } from 'express'
import { AuthenticatedRequest, requireUserAuth, requireAdminRole, UserRole } from '../../middleware/auth.js'
import {
  buildPaginationMeta,
  parsePaginationParams,
} from '../../lib/pagination.js'
import { AdminService } from '../../services/admin/index.js'
import { auditLogService } from '../../services/audit/index.js'
import { AppError, ErrorCode, ValidationError } from '../../lib/errors.js'
import type { AssignRoleRequest, RevokeApiKeyRequest } from '../../services/admin/types.js'

/**
 * Create the admin router with role and user management endpoints
 * All endpoints require admin authentication
 */
export function createAdminRouter(): Router {
  const router = Router()
  const adminService = new AdminService(auditLogService)

  /**
   * GET /api/admin/users
   */
  router.get('/users', requireUserAuth, requireAdminRole, (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const user = authReq.user!

      const { page, limit, offset } = parsePaginationParams(req.query as Record<string, unknown>, { defaultLimit: 50 })

      // Parse filter parameters
      const filters: any = {}
      if (req.query.role) {
        const validRoles = Object.values(UserRole)
        if (!validRoles.includes(req.query.role as UserRole)) {
          throw new ValidationError(`Invalid role: ${req.query.role}`)
        }
        filters.role = req.query.role as UserRole
      }
      if (req.query.active !== undefined) {
        filters.active = req.query.active === 'true'
      }

      // Get users
      const result = adminService.listUsers(user.id, user.email, { page, limit, offset }, filters)

      res.status(200).json({
        success: true,
        data: {
          ...result,
          ...buildPaginationMeta(result.total, page, limit),
        },
      })
    } catch (error) {
      next(error)
    }
  })

  /**
   * POST /api/admin/roles/assign
   */
  router.post('/roles/assign', requireUserAuth, requireAdminRole, (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const user = authReq.user!
      const assignRequest = req.body as AssignRoleRequest

      // Validate request body
      if (!assignRequest.userId || !assignRequest.role) {
        throw new ValidationError('Missing required fields: userId, role')
      }

      const result = adminService.assignRole(user.id, user.email, assignRequest)

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.user,
      })
    } catch (error) {
      next(error)
    }
  })

  /**
   * POST /api/admin/keys/revoke
   */
  router.post('/keys/revoke', requireUserAuth, requireAdminRole, (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const user = authReq.user!
      const revokeRequest = req.body as RevokeApiKeyRequest

      // Validate request body
      if (!revokeRequest.userId || !revokeRequest.apiKey) {
        throw new ValidationError('Missing required fields: userId, apiKey')
      }

      const result = adminService.revokeApiKey(user.id, user.email, revokeRequest)

      res.status(200).json({
        success: true,
        message: result.message,
      })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /api/admin/audit-logs
   */
  router.get('/audit-logs', requireUserAuth, requireAdminRole, (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const user = authReq.user!

      const { page, limit, offset } = parsePaginationParams(req.query as Record<string, unknown>, { defaultLimit: 50 })

      // Build filter object from query params
      const filters: any = {}
      if (req.query.action) filters.action = req.query.action
      if (req.query.adminId) filters.adminId = req.query.adminId
      if (req.query.targetUserId) filters.targetUserId = req.query.targetUserId
      if (req.query.status) filters.status = req.query.status

      const result = adminService.getAuditLogs(user.id, user.email, filters, limit, offset)

      res.status(200).json({
        success: true,
        data: {
          ...result,
          ...buildPaginationMeta(result.total, page, limit),
        },
      })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /api/admin/audit-logs/export
   */
  router.get('/audit-logs/export', requireUserAuth, requireAdminRole, async (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const user = authReq.user!

      if (!req.query.startDate || !req.query.endDate) {
        throw new ValidationError('Missing required query parameters: startDate, endDate')
      }

      const startDate = new Date(req.query.startDate as string)
      const endDate = new Date(req.query.endDate as string)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new ValidationError('Invalid date format. Use ISO strings.')
      }
      
      if (startDate > endDate) {
        throw new ValidationError('startDate must be before or equal to endDate')
      }

      const stream = adminService.exportAuditLogs(user.id, user.email, startDate, endDate)

      // Set headers for NDJSON streaming
      res.setHeader('Content-Type', 'application/x-ndjson')
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.ndjson"')
      
      const metadata = {
        _meta: {
          exportedAt: new Date().toISOString(),
          exportedBy: user.email,
          dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
          schemaVersion: "1.0"
        }
      }
      res.write(JSON.stringify(metadata) + '\n')

      let count = 0
      for await (const log of stream) {
        res.write(JSON.stringify(log) + '\n')
        count++
      }

      adminService.logExportCompletion(user.id, user.email, startDate, endDate, count)
      res.end()
    } catch (error) {
      if (!res.headersSent) {
        next(error)
      } else {
        res.end()
      }
    }
  })

  return router
}
