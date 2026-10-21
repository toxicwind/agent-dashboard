import { describe, expect, it } from 'vitest'
import {
  loadTauSessions,
  loadKappaSessions,
  loadUnifiedChats,
} from '@/data/unified-chats'
import type { IChatChannel } from '@/types'

describe('unified-chats — tau sessions', () => {
  it('loads .jsonl files as sessions', async () => {
    const io = {
      readDir: async (_d: string) => [
        'tau-001-main-session.jsonl',
        '.hidden.jsonl',
        'not-a-session.txt',
      ],
      readFile: async () => 'system: hello\nuser: test',
      stat: async () => ({ mtimeMs: Date.now() }),
    }
    const sessions = await loadTauSessions('/tau', io)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].source).toBe('tau')
    expect(sessions[0].title).toBe('Main Session')
  })

  it('returns empty when root does not exist', async () => {
    const io = {
      readDir: async () => {
        throw new Error('ENOENT')
      },
      readFile: async () => '',
      stat: async () => ({ mtimeMs: 0 }),
    }
    expect(await loadTauSessions('/nope', io)).toEqual([])
  })
})

describe('unified-chats — kappa sessions', () => {
  it('maps channels to kappa sessions', async () => {
    const channels: IChatChannel[] = [
      {
        name: 'ops-discussion',
        members: ['tau', 'kappa'],
        topic: 'ops',
        created: null,
        messageCount: 5,
        lastMessageAt: '2026-10-21T00:00:00Z',
        messages: [
          {
            seq: 1,
            from: 'tau',
            to: 'all',
            channel: 'ops-discussion',
            ts: '2026-10-21T00:00:00Z',
            status: null,
            title: 'Ops update',
            body: 'Everything is fine.',
          },
        ],
      },
    ]
    const sessions = await loadKappaSessions(channels)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].source).toBe('kappa')
    expect(sessions[0].id).toBe('kappa:ops-discussion')
    expect(sessions[0].messageCount).toBe(5)
    expect(sessions[0].preview).toBe('Ops update')
  })

  it('returns empty when channels is null', async () => {
    expect(await loadKappaSessions(null)).toEqual([])
  })

  it('returns empty when channels is undefined', async () => {
    expect(await loadKappaSessions(undefined)).toEqual([])
  })

  it('returns empty when channels is empty', async () => {
    expect(await loadKappaSessions([])).toEqual([])
  })
})

describe('unified-chats — aggregator', () => {
  it('combines tau, kappa, and kimi sessions when tauIo is provided', async () => {
    const io = {
      readDir: async (_d: string) => ['test-session.jsonl'],
      readFile: async () => 'system: hi',
      stat: async () => ({ mtimeMs: Date.now() }),
    }
    const channels: IChatChannel[] = [
      {
        name: 'test',
        members: [],
        topic: '',
        created: null,
        messageCount: 1,
        lastMessageAt: null,
        messages: [],
      },
    ]
    // kimiPorts=[] disables kimi polling
    const result = await loadUnifiedChats({
      tauRoot: '/fake',
      kappaChannels: channels,
      tauIo: io,
      kimiPorts: [],
    })
    expect(result.summary.total).toBe(2)
    expect(result.summary.bySource.tau).toBe(1)
    expect(result.summary.bySource.kappa).toBe(1)
    expect(result.summary.bySource.kimi).toBe(0)
  })

  it('handles all sources absent gracefully (no tauIo)', async () => {
    const result = await loadUnifiedChats({
      kimiPorts: [],
    })
    expect(result.summary.total).toBe(0)
    expect(result.sessions).toEqual([])
    expect(result.summary.bySource.tau).toBe(0)
  })
})
