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

  // JWT key rotation
  KEY_ROTATION_INTERVAL_SECONDS: z
    .string()
    .default('86400')
    .transform(Number)
    .pipe(z.number().int().positive()),
  KEY_GRACE_PERIOD_SECONDS: z
    .string()
    .default('3600')
    .transform(Number)
    .pipe(z.number().int().nonnegative()),
  /**
   * Clock skew tolerance in seconds.
   * Added to the grace window before a retired key is hard-pruned, and passed
   * as `clockTolerance` to jwtVerify() so tokens from slightly-fast clocks verify.
   * Default: 300 (5 minutes).
   */
  KEY_CLOCK_SKEW_SECONDS: z
    .string()
    .default('300')
    .transform(Number)
    .pipe(z.number().int().nonnegative()),

  // Feature flags
  ENABLE_TRUST_SCORING: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  ENABLE_BOND_EVENTS: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

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
    keyRotationIntervalSeconds: number
    gracePeriodSeconds: number
    /** Clock skew tolerance (seconds) for JWT verification and grace-period pruning. */
    clockSkewSeconds: number
  }
  features: {
    trustScoring: boolean
    bondEvents: boolean
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
      keyRotationIntervalSeconds: env.KEY_ROTATION_INTERVAL_SECONDS,
      gracePeriodSeconds: env.KEY_GRACE_PERIOD_SECONDS,
      clockSkewSeconds: env.KEY_CLOCK_SKEW_SECONDS,
    },
    features: {
      trustScoring: env.ENABLE_TRUST_SCORING,
      bondEvents: env.ENABLE_BOND_EVENTS,
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
