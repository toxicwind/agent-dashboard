import { describe, expect, it } from 'vitest'
import {
  channelStub,
  loadChannels,
  parseChannelsIndex,
  parseMessageFile,
} from '@/data/channels'
import type { IChatChannel } from '@/types'

const SAMPLE_MSG = `---
seq: 1
from: osprey
to: all
channel: estate-chat
ts: 2026-10-15T22:51:44.512060+00:00
status: discussion
title: msg
---
nvidia credential repair complete.`

describe('channels model (squawk-root / kappa board)', () => {
  it('parses a frontmatter message file into an IChatMessage', () => {
    const m = parseMessageFile(SAMPLE_MSG, 'estate-chat', 99)
    expect(m.seq).toBe(1)
    expect(m.from).toBe('osprey')
    expect(m.to).toBe('all')
    expect(m.channel).toBe('estate-chat')
    expect(m.status).toBe('discussion')
    expect(m.title).toBe('msg')
    expect(m.body).toContain('nvidia credential repair complete')
  })

  it('degrades a body without frontmatter to a bare message', () => {
    const m = parseMessageFile('just a note\nsecond line', 'chan', 3)
    expect(m.seq).toBe(3)
    expect(m.from).toBe('unknown')
    expect(m.body).toBe('just a note\nsecond line')
  })

  it('loads channels from an injected bridge root io', async () => {
    const io = {
      readDir: async (dir: string) =>
        dir === '/bridge'
          ? ['kappa_board', '.channels-index']
          : ['1-osprey-msg.md'],
      stat: async (_p: string) => ({ isDirectory: () => true }),
      readFile: async () => SAMPLE_MSG,
    }
    const channels = (await loadChannels(
      '/bridge',
      io
    )) as unknown as IChatChannel[]
    expect(channels).toHaveLength(1)
    expect(channels[0].name).toBe('kappa_board')
    expect(channels[0].messageCount).toBe(1)
    expect(channels[0].lastMessageAt).toBe('2026-10-15T22:51:44.512060+00:00')
  })

  it('returns an empty list when the bridge root is missing', async () => {
    const io = {
      readDir: async () => {
        throw new Error('ENOENT')
      },
      stat: async () => ({ isDirectory: () => true }),
      readFile: async () => '',
    }
    expect(await loadChannels('/nope', io)).toEqual([])
  })

  it('parses the squawk channels-index lines', () => {
    const map = parseChannelsIndex(
      '2026-10-13T00:41:55-06:00\t#ops\n2026-10-20T22:24:18-06:00\tkappa_board'
    )
    expect(map.get('kappa_board')).toBe('2026-10-20T22:24:18-06:00')
    expect(map.get('#ops')).toBe('2026-10-13T00:41:55-06:00')
  })

  it('channelStub returns a populated stub with one bridged message', () => {
    const stub = channelStub()
    expect(stub[0].name).toBe('kappa_board')
    expect(stub[0].messageCount).toBe(1)
    expect(stub[0].messages[0].from).toBe('springboard')
  })
})
