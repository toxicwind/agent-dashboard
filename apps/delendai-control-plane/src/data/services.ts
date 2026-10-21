import type { IServiceRow } from '@/types'

/**
 * Services grid — the estate's live 25xxx surfaces. This is the real mesh:
 * values drawn from config/ports.env SSOT and live listener probes
 * (indexed by the service registry). `health` is the last-known health.
 */
export const SERVICES_FIXTURES: readonly IServiceRow[] = [
  {
    name: 'herd',
    port: 25100,
    status: 'up',
    kind: 'inference',
    health: 100,
    description: 'model gateway / llama-swap alias shims',
  },
  {
    name: 'model-guard',
    port: 25101,
    status: 'up',
    kind: 'ops',
    health: 100,
    description: 'guard plane in front of herd',
  },
  {
    name: 'gatehouse',
    port: 25127,
    status: 'up',
    kind: 'orchestration',
    health: 100,
    description: 'mcpproxy-go MCP gateway',
  },
  {
    name: 'estate-chat',
    port: 25120,
    status: 'up',
    kind: 'ops',
    health: 100,
    description: 'fleet chat plane (tailnet)',
  },
  {
    name: 'mqdrant',
    port: 25133,
    status: 'degraded',
    kind: 'data',
    health: 82,
    description: 'vector store (grpc :25134)',
  },
  {
    name: 'redis',
    port: 25203,
    status: 'up',
    kind: 'data',
    health: 98,
    description: 'valkey key-value store',
  },
  {
    name: 'oracle-core',
    port: 25151,
    status: 'up',
    kind: 'orchestration',
    health: 100,
    description: 'oracle procurement market',
  },
  {
    name: 'fleet-feed',
    port: 25158,
    status: 'up',
    kind: 'ops',
    health: 100,
    description: 'realtime fleet feed bus',
  },
  {
    name: 'ralph-dashboard',
    port: 25194,
    status: 'degraded',
    kind: 'web',
    health: 76,
    description: 'ralph work dashboard backend',
  },
  {
    name: 'kite-daemon',
    port: 0,
    status: 'down',
    kind: 'ops',
    health: 0,
    description: 'kite-cli daemon (suspended)',
  },
  {
    name: 'delendai-web',
    port: 25197,
    status: 'up',
    kind: 'web',
    health: 100,
    description: 'DelendAI Astro dashboard',
  },
  {
    name: 'delendai-control-plane',
    port: 25156,
    status: 'up',
    kind: 'web',
    health: 100,
    description: 'this control-plane SPA',
  },
] as const

export const SERVICE_KIND_LABEL: Record<IServiceRow['kind'], string> = {
  inference: 'inference',
  orchestration: 'orchestration',
  web: 'web',
  data: 'data',
  ops: 'ops',
}

export function serviceTone(
  status: IServiceRow['status']
): 'ok' | 'warn' | 'danger' {
  switch (status) {
    case 'up':
      return 'ok'
    case 'degraded':
      return 'warn'
    case 'down':
      return 'danger'
    default:
      return 'warn'
  }
}

export function countByStatus(
  services: readonly IServiceRow[]
): Record<IServiceRow['status'], number> {
  return {
    up: services.filter((s) => s.status === 'up').length,
    degraded: services.filter((s) => s.status === 'degraded').length,
    down: services.filter((s) => s.status === 'down').length,
  }
}
