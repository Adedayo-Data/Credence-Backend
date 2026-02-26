import { Request, Response, NextFunction } from 'express'
import { jest, describe, it, expect, beforeEach, } from '@jest/globals'
import { requireApiKey, ApiScope, AuthenticatedRequest } from '../middleware/auth.js'

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let nextFunction: NextFunction

  beforeEach(() => {
    mockRequest = {
      headers: {},
    }
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    }
    nextFunction = jest.fn()
  })

  describe('requireApiKey', () => {
    describe('Missing API Key', () => {
      it('should return 401 when API key header is missing', () => {
        const middleware = requireApiKey(ApiScope.PUBLIC)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(mockResponse.status).toHaveBeenCalledWith(401)
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'Unauthorized',
          message: 'API key is required',
        })
        expect(nextFunction).not.toHaveBeenCalled()
      })

      it('should return 401 when API key header is empty string', () => {
        mockRequest.headers = { 'x-api-key': '' }
        const middleware = requireApiKey(ApiScope.PUBLIC)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(mockResponse.status).toHaveBeenCalledWith(401)
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'Unauthorized',
          message: 'API key is required',
        })
        expect(nextFunction).not.toHaveBeenCalled()
      })
    })

    describe('Invalid API Key', () => {
      it('should return 401 when API key is invalid', () => {
        mockRequest.headers = { 'x-api-key': 'invalid-key-12345' }
        const middleware = requireApiKey(ApiScope.PUBLIC)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(mockResponse.status).toHaveBeenCalledWith(401)
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'Unauthorized',
          message: 'Invalid API key',
        })
        expect(nextFunction).not.toHaveBeenCalled()
      })

      it('should return 401 for random string', () => {
        mockRequest.headers = { 'x-api-key': 'random-string' }
        const middleware = requireApiKey(ApiScope.PUBLIC)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(mockResponse.status).toHaveBeenCalledWith(401)
        expect(nextFunction).not.toHaveBeenCalled()
      })
    })

    describe('Insufficient Scope', () => {
      it('should return 403 when public key is used for enterprise endpoint', () => {
        mockRequest.headers = { 'x-api-key': 'test-public-key-67890' }
        const middleware = requireApiKey(ApiScope.ENTERPRISE)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(mockResponse.status).toHaveBeenCalledWith(403)
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'Forbidden',
          message: 'Enterprise API key required',
        })
        expect(nextFunction).not.toHaveBeenCalled()
      })
    })

    describe('Valid API Keys', () => {
      it('should accept valid public API key for public endpoint', () => {
        mockRequest.headers = { 'x-api-key': 'test-public-key-67890' }
        const middleware = requireApiKey(ApiScope.PUBLIC)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalled()
        expect(mockResponse.status).not.toHaveBeenCalled()
        expect(mockResponse.json).not.toHaveBeenCalled()
      })

      it('should accept valid enterprise API key for public endpoint', () => {
        mockRequest.headers = { 'x-api-key': 'test-enterprise-key-12345' }
        const middleware = requireApiKey(ApiScope.PUBLIC)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalled()
        expect(mockResponse.status).not.toHaveBeenCalled()
      })

      it('should accept valid enterprise API key for enterprise endpoint', () => {
        mockRequest.headers = { 'x-api-key': 'test-enterprise-key-12345' }
        const middleware = requireApiKey(ApiScope.ENTERPRISE)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalled()
        expect(mockResponse.status).not.toHaveBeenCalled()
      })

      it('should attach API key metadata to request', () => {
        mockRequest.headers = { 'x-api-key': 'test-enterprise-key-12345' }
        const middleware = requireApiKey(ApiScope.ENTERPRISE)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        const authReq = mockRequest as AuthenticatedRequest
        expect(authReq.localApiKey).toBeDefined()
        expect(authReq.localApiKey?.key).toBe('test-enterprise-key-12345')
        expect(authReq.localApiKey?.scope).toBe(ApiScope.ENTERPRISE)
      })

      it('should attach correct scope for public key', () => {
        mockRequest.headers = { 'x-api-key': 'test-public-key-67890' }
        const middleware = requireApiKey(ApiScope.PUBLIC)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        const authReq = mockRequest as AuthenticatedRequest
        expect(authReq.localApiKey?.scope).toBe(ApiScope.PUBLIC)
      })
    })

    describe('Case Sensitivity', () => {
      it('should handle header name case-insensitively', () => {
        // Express normalizes headers to lowercase
        mockRequest.headers = { 'x-api-key': 'test-enterprise-key-12345' }
        const middleware = requireApiKey(ApiScope.ENTERPRISE)
        middleware(mockRequest as Request, mockResponse as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalled()
      })
    })
  })

  describe('ApiScope Enum', () => {
    it('should have PUBLIC scope', () => {
      expect(ApiScope.PUBLIC).toBe('public')
    })

    it('should have ENTERPRISE scope', () => {
      expect(ApiScope.ENTERPRISE).toBe('enterprise')
    })
  })
})
