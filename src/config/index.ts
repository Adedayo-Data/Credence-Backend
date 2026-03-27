import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

export const envSchema = z.object({
  // Server
  PORT: z
    .string()
    .default('3000')
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535)),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Database
  DB_URL: z.string().url({ message: 'DB_URL must be a valid URL' }),

  // Redis
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid URL' }),

  // Auth
  JWT_SECRET: z
    .string()
    .min(32, { message: 'JWT_SECRET must be at least 32 characters' }),
  JWT_EXPIRY: z.string().default('1h'),

  // Feature flags
  ENABLE_TRUST_SCORING: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  ENABLE_BOND_EVENTS: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

  // Outbox
  OUTBOX_ENABLED: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  OUTBOX_POLL_INTERVAL_MS: z
    .string()
    .default('1000')
    .transform(Number)
    .pipe(z.number().int().min(100)),
  OUTBOX_BATCH_SIZE: z
    .string()
    .default('100')
    .transform(Number)
    .pipe(z.number().int().min(1)),
  OUTBOX_PUBLISHED_RETENTION_DAYS: z
    .string()
    .default('7')
    .transform(Number)
    .pipe(z.number().int().min(1)),
  OUTBOX_FAILED_RETENTION_DAYS: z
    .string()
    .default('30')
    .transform(Number)
    .pipe(z.number().int().min(1)),
  OUTBOX_CLEANUP_INTERVAL_MS: z
    .string()
    .default('3600000')
    .transform(Number)
    .pipe(z.number().int().min(60000)),

  // Horizon (optional)
  HORIZON_URL: z.string().url().optional(),

  // CORS
  CORS_ORIGIN: z.string().default('*'),
})

export type Env = z.infer<typeof envSchema>

export interface Config {
  port: number
  nodeEnv: 'development' | 'production' | 'test'
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  db: {
    url: string
  }
  redis: {
    url: string
  }
  jwt: {
    secret: string
    expiry: string
  }
  features: {
    trustScoring: boolean
    bondEvents: boolean
  }
  outbox: {
    enabled: boolean
    pollIntervalMs: number
    batchSize: number
    publishedRetentionDays: number
    failedRetentionDays: number
    cleanupIntervalMs: number
  }
  horizon?: {
    url: string
  }
  cors: {
    origin: string
  }
}

function mapEnvToConfig(env: Env): Config {
  const config: Config = {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    db: {
      url: env.DB_URL,
    },
    redis: {
      url: env.REDIS_URL,
    },
    jwt: {
      secret: env.JWT_SECRET,
      expiry: env.JWT_EXPIRY,
    },
    features: {
      trustScoring: env.ENABLE_TRUST_SCORING,
      bondEvents: env.ENABLE_BOND_EVENTS,
    },
    outbox: {
      enabled: env.OUTBOX_ENABLED,
      pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
      batchSize: env.OUTBOX_BATCH_SIZE,
      publishedRetentionDays: env.OUTBOX_PUBLISHED_RETENTION_DAYS,
      failedRetentionDays: env.OUTBOX_FAILED_RETENTION_DAYS,
      cleanupIntervalMs: env.OUTBOX_CLEANUP_INTERVAL_MS,
    },
    cors: {
      origin: env.CORS_ORIGIN,
    },
  }

  if (env.HORIZON_URL) {
    config.horizon = { url: env.HORIZON_URL }
  }

  return config
}

export class ConfigValidationError extends Error {
  public readonly issues: z.ZodIssue[]

  constructor(issues: z.ZodIssue[]) {
    const formatted = issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    super(`Environment validation failed:\n${formatted}`)
    this.name = 'ConfigValidationError'
    this.issues = issues
  }
}

export function validateConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env)

  if (!result.success) {
    throw new ConfigValidationError(result.error.issues)
  }

  return mapEnvToConfig(result.data)
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  try {
    return validateConfig(env)
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      console.error(`\n❌ ${err.message}`)
      console.error('\nPlease check your .env file or environment variables.\n')
      process.exit(1)
    }
    throw err
  }
}
