process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long';
process.env.DB_URL = 'postgres://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '3000';
process.env.LOG_LEVEL = 'error'; // Keep test output clean
