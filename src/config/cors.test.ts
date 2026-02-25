import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../index.js';

/**
 * CORS middleware tests.
 *
 * The CORS config reads ALLOWED_ORIGINS from the environment at module load time.
 * We test three scenarios:
 *   1. An allowed origin receives the proper CORS headers.
 *   2. An origin not in the allowlist is rejected with a CORS error.
 *   3. Credentials (Access-Control-Allow-Credentials) header is present.
 */

describe('CORS Middleware', () => {
    const ALLOWED = 'http://localhost:5173';
    const DENIED = 'https://evil.example.com';

    beforeEach(() => {
        process.env.ALLOWED_ORIGINS = ALLOWED;
    });

    afterEach(() => {
        delete process.env.ALLOWED_ORIGINS;
    });

    it('should return CORS headers for a whitelisted origin', async () => {
        const response = await request(app)
            .get('/api/health')
            .set('Origin', ALLOWED);

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    });

    it('should include Access-Control-Allow-Credentials header for allowed origin', async () => {
        const response = await request(app)
            .get('/api/health')
            .set('Origin', ALLOWED);

        expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject a non-whitelisted origin with a CORS error', async () => {
        // The cors package returns a 500 when origin callback fires an error.
        // Supertest will surface this as a non-200 status or missing CORS header.
        const response = await request(app)
            .get('/api/health')
            .set('Origin', DENIED);

        // The key assertion: origin header must NOT be echoed back for denied origins
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should handle preflight OPTIONS requests for allowed origin', async () => {
        const response = await request(app)
            .options('/api/health')
            .set('Origin', ALLOWED)
            .set('Access-Control-Request-Method', 'GET')
            .set('Access-Control-Request-Headers', 'Content-Type');

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
        expect(response.headers['access-control-allow-methods']).toMatch(/GET/);
    });

    it('should allow requests with no origin header (mobile/curl clients)', async () => {
        // No Origin header → CORS middleware passes through by design
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
    });
});
