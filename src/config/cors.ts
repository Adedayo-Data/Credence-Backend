import { CorsOptions } from 'cors';

/**
 * CORS configuration for the Credence API.
 *
 * Origins are read lazily from the ALLOWED_ORIGINS environment variable on
 * each request so that the value can be changed without restarting the server
 * and so that tests can set/reset it via process.env.
 *
 * @example
 * ALLOWED_ORIGINS=http://localhost:5173,https://app.credence.xyz
 */
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, server-to-server, curl)
    if (!origin) return callback(null, true);

    // Read allowed origins lazily on every request
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : [];

    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
};