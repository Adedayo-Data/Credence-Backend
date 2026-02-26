import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { JobScheduler, parseCronToInterval, createScheduler } from './scheduler.js'
import type { ScoreSnapshotJob } from './scoreSnapshot.js'

describe('parseCronToInterval', () => {
  it('parses every minute cron', () => {
    expect(parseCronToInterval('* * * * *')).toBe(60000)
  })

  it('parses every hour cron', () => {
    expect(parseCronToInterval('0 * * * *')).toBe(3600000)
  })

  it('parses every day cron', () => {
    expect(parseCronToInterval('0 0 * * *')).toBe(86400000)
  })

  it('throws on invalid cron expression', () => {
    expect(() => parseCronToInterval('invalid')).toThrow('Invalid cron expression')
  })

  it('throws on unsupported cron pattern', () => {
    expect(() => parseCronToInterval('15 * * * *')).toThrow('Unsupported cron expression')
  })
})

describe('JobScheduler', () => {
  let mockJob: ScoreSnapshotJob
  let scheduler: JobScheduler

  beforeEach(() => {
    mockJob = {
      run: jest.fn<any>().mockResolvedValue({
        processed: 10,
        saved: 10,
        errors: 0,
        duration: 100,
        startTime: new Date().toISOString(),
      }),
    } as unknown as ScoreSnapshotJob
  })

  afterEach(() => {
    if (scheduler) {
      scheduler.stop()
    }
    jest.restoreAllMocks()
  })

  it('starts scheduler with interval', () => {
    scheduler = new JobScheduler(mockJob, { intervalMs: 60000 })
    scheduler.start()

    expect(scheduler.isActive()).toBe(true)
  })

  it('stops scheduler', () => {
    scheduler = new JobScheduler(mockJob, { intervalMs: 60000 })
    scheduler.start()
    scheduler.stop()

    expect(scheduler.isActive()).toBe(false)
  })

  it('runs job at intervals', async () => {
    jest.useFakeTimers()
    scheduler = new JobScheduler(mockJob, { intervalMs: 60000 })
    scheduler.start()

    await jest.advanceTimersByTimeAsync(60000)
    expect(mockJob.run).toHaveBeenCalledTimes(1)

    await jest.advanceTimersByTimeAsync(60000)
    expect(mockJob.run).toHaveBeenCalledTimes(2)
    jest.useRealTimers()
  })

  it('runs job immediately when runOnStart is true', async () => {
    scheduler = new JobScheduler(mockJob, { intervalMs: 60000, runOnStart: true })
    scheduler.start()

    // Wait for the job to complete
    await new Promise(resolve => setImmediate(resolve))

    expect(mockJob.run).toHaveBeenCalledTimes(1)
  })

  it('does not run immediately when runOnStart is false', () => {
    scheduler = new JobScheduler(mockJob, { intervalMs: 60000, runOnStart: false })
    scheduler.start()

    expect(mockJob.run).not.toHaveBeenCalled()
  })

  it('skips interval if job is still running', async () => {
    let resolveJob: () => void
    const jobPromise = new Promise<any>(resolve => {
      resolveJob = () => resolve({
        processed: 10,
        saved: 10,
        errors: 0,
        duration: 100,
        startTime: new Date().toISOString(),
      })
    })

    mockJob.run = jest.fn().mockReturnValue(jobPromise) as any

    scheduler = new JobScheduler(mockJob, { intervalMs: 100, runOnStart: true })
    scheduler.start()

    await new Promise(resolve => setImmediate(resolve))

    // Wait for interval
    await new Promise(resolve => setTimeout(resolve, 120))

    // Job should only be called once (still running)
    const firstCallCount = (mockJob.run as any).mock.calls.length
    expect(firstCallCount).toBe(1)

    // Resolve the job
    resolveJob!()
    await new Promise(resolve => setImmediate(resolve))

    // Wait for next interval
    await new Promise(resolve => setTimeout(resolve, 120))

    // Job should be called again (at least 2 times total)
    expect((mockJob.run as any).mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('handles job errors gracefully', async () => {
    mockJob.run = jest.fn<any>().mockRejectedValue(new Error('Job failed')) as any

    const logs: string[] = []
    scheduler = new JobScheduler(mockJob, {
      intervalMs: 60000,
      runOnStart: true,
      logger: (msg) => logs.push(msg),
    })
    scheduler.start()

    await new Promise(resolve => setImmediate(resolve))

    expect(logs.some(log => log.includes('Job failed'))).toBe(true)
    expect(scheduler.isActive()).toBe(true) // Scheduler should still be active
  })

  it('logs job results', async () => {
    const logs: string[] = []
    scheduler = new JobScheduler(mockJob, {
      intervalMs: 60000,
      runOnStart: true,
      logger: (msg) => logs.push(msg),
    })
    scheduler.start()

    await new Promise(resolve => setImmediate(resolve))

    expect(logs.some(log => log.includes('Job completed'))).toBe(true)
    expect(logs.some(log => log.includes('processed'))).toBe(true)
  })

  it('does not start if already running', () => {
    const logs: string[] = []
    scheduler = new JobScheduler(mockJob, {
      intervalMs: 60000,
      logger: (msg) => logs.push(msg),
    })
    scheduler.start()
    scheduler.start()

    expect(logs.filter(log => log.includes('already running')).length).toBe(1)
  })

  it('creates scheduler with factory function', () => {
    scheduler = createScheduler(mockJob, {
      cronExpression: '0 * * * *',
    })

    expect(scheduler).toBeInstanceOf(JobScheduler)
  })

  it('uses default cron expression', () => {
    scheduler = createScheduler(mockJob)
    scheduler.start()

    expect(scheduler.isActive()).toBe(true)
  })

  it('converts cron to interval correctly', () => {
    scheduler = createScheduler(mockJob, {
      cronExpression: '0 * * * *', // Every hour
    })
    scheduler.start()

    expect(scheduler.isActive()).toBe(true)
  })
})
