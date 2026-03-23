import { beforeEach, describe, expect, it, vi } from 'vitest'

const streamState = vi.hoisted(() => ({
  onmessage: undefined as undefined | ((op: any) => Promise<void>),
}))

vi.mock('@stellar/stellar-sdk', () => {
  class ServerMock {
    operations() {
      return {
        forAsset: () => ({
          cursor: () => ({
            stream: ({ onmessage }: { onmessage: (op: any) => Promise<void> }) => {
              streamState.onmessage = onmessage
            },
          }),
        }),
      }
    }
  }

  return { Horizon: { Server: ServerMock } }
})

vi.mock('../services/identityService', () => ({
  upsertIdentity: vi.fn().mockResolvedValue(undefined),
  upsertBond: vi.fn().mockResolvedValue(undefined),
}))

import { subscribeBondCreationEvents } from '../listeners/horizonBondEvents.js'
import { upsertBond, upsertIdentity } from '../services/identityService.js'

describe('Horizon Bond Creation Listener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    streamState.onmessage = undefined
  })

  it('subscribes without throwing', () => {
    const onEvent = vi.fn()
    expect(() => subscribeBondCreationEvents(onEvent)).not.toThrow()
    expect(streamState.onmessage).toBeTypeOf('function')
  })

  it('parses and upserts create_bond events', async () => {
    const onEvent = vi.fn()
    subscribeBondCreationEvents(onEvent)

    const op = {
      type: 'create_bond',
      source_account: 'GABC123',
      id: 'bond123',
      amount: '1000',
      duration: '365',
      paging_token: 'token-1',
    }

    await streamState.onmessage?.(op)

    expect(upsertIdentity).toHaveBeenCalledWith({ id: 'GABC123' })
    expect(upsertBond).toHaveBeenCalledWith({ id: 'bond123', amount: '1000', duration: '365' })
    expect(onEvent).toHaveBeenCalledTimes(1)
  })

  it('ignores non-bond events', async () => {
    const onEvent = vi.fn()
    subscribeBondCreationEvents(onEvent)

    await streamState.onmessage?.({
      type: 'payment',
      id: 'not-bond',
      paging_token: 'token-2',
    })

    expect(upsertIdentity).not.toHaveBeenCalled()
    expect(upsertBond).not.toHaveBeenCalled()
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('supports undefined callback', () => {
    expect(() => subscribeBondCreationEvents(undefined)).not.toThrow()
  })
})
