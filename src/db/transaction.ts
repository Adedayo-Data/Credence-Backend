import type { Pool, PoolClient } from 'pg'

export const PG_LOCK_TIMEOUT_CODE = '55P03'

export enum LockTimeoutPolicy {
  READONLY = 'readonly',
  DEFAULT = 'default',
  CRITICAL = 'critical',
}

export interface LockTimeoutConfig {
  readonly: number
  default: number
  critical: number
}

export interface TransactionOptions {
  policy?: LockTimeoutPolicy
  timeoutMs?: number
  isolationLevel?: string
  retryOnLockTimeout?: boolean
  maxRetries?: number
  retryDelayMs?: number
}

export class LockTimeoutError extends Error {
  constructor(
    message: string,
    public readonly policy: LockTimeoutPolicy,
    public readonly timeoutMs: number
  ) {
    super(message)
    this.name = 'LockTimeoutError'
  }
}

export class TransactionManager {
  private readonly timeouts: LockTimeoutConfig

  constructor(
    private readonly pool: Pool,
    timeouts?: Partial<LockTimeoutConfig>
  ) {
    this.timeouts = {
      readonly: timeouts?.readonly ?? 1000,
      default: timeouts?.default ?? 2000,
      critical: timeouts?.critical ?? 5000,
    }
  }

  /**
   * Execute a function within a database transaction with configurable lock timeout.
   * 
   * @param fn - Function to execute within the transaction
   * @param options - Transaction configuration options
   * @returns Promise that resolves with the result of the function
   * @throws {LockTimeoutError} When lock timeout occurs
   */
  async withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const {
      policy = LockTimeoutPolicy.DEFAULT,
      timeoutMs,
      isolationLevel = 'READ COMMITTED',
      retryOnLockTimeout = false,
      maxRetries = 3,
      retryDelayMs = 100,
    } = options

    const effectiveTimeout = timeoutMs ?? this.getTimeoutForPolicy(policy)
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const client = await this.pool.connect()
      
      try {
        await client.query('BEGIN')
        
        // Set lock timeout (PostgreSQL expects seconds)
        await client.query('SET lock_timeout = $1', [`${effectiveTimeout / 1000}s`])
        
        // Set isolation level if specified
        if (isolationLevel) {
          await client.query('SET TRANSACTION ISOLATION LEVEL ' + isolationLevel)
        }

        const result = await fn(client)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {
          // Ignore rollback errors
        })

        if (error instanceof Error && this.isLockTimeoutError(error)) {
          lastError = new LockTimeoutError(
            `Lock timeout after ${effectiveTimeout}ms`,
            policy,
            effectiveTimeout
          )

          // Don't retry if retries are disabled or we've exhausted retries
          if (!retryOnLockTimeout || attempt >= maxRetries) {
            throw lastError
          }

          // Wait with exponential backoff before retrying
          const delay = retryDelayMs * Math.pow(2, attempt)
          await this.sleep(delay)
          continue
        }

        // For non-lock-timeout errors, don't retry
        throw error
      } finally {
        client.release()
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Transaction failed')
  }

  private getTimeoutForPolicy(policy: LockTimeoutPolicy): number {
    switch (policy) {
      case LockTimeoutPolicy.READONLY:
        return this.timeouts.readonly
      case LockTimeoutPolicy.DEFAULT:
        return this.timeouts.default
      case LockTimeoutPolicy.CRITICAL:
        return this.timeouts.critical
      default:
        return this.timeouts.default
    }
  }

  private isLockTimeoutError(error: Error): boolean {
    return 'code' in error && error.code === PG_LOCK_TIMEOUT_CODE
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}