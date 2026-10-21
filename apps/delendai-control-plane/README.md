# delendai-control-plane

Control-plane SPA — services grid, provider/router quota dashboards, unified Chats (tau · kappa · kimi), kappa-board channels, dashboards registry.

## Aliases

- Alias configuration lives in `vite.config.ts` and `tsconfig.json` (paths `@/*` → `src/*`).

## Tests

```bash
bun test                # run all tests
bun test --coverage     # run with V8 coverage report
```

All 50 tests pass across 7 files with **96.7% line coverage** and **90.0% function coverage** (≥90% target met).

| File | Functions | Lines |
|------|-----------|-------|
| `src/api/client.ts` | 93.3% | 100.0% |
| `src/data/channels.ts` | 85.7% | 97.0% |
| `src/data/provider-record.ts` | 92.3% | 100.0% |
| `src/data/services.ts` | 100.0% | 100.0% |
| `src/data/unified-chats.ts` | 68.8% | 83.0% |
| `src/lib/utils.ts` | 100.0% | 100.0% |

Uncovered lines in `channels.ts` are defensive error paths; `unified-chats.ts` uncovered lines are the Node.js `fs` import fallbacks (used only when no `tauIo` is injected from the browser SPA).

## Chats

The unified Chats page (`/chats`) aggregates session data from three estate sources:

- **Tau** — reads JSONL session files from `~/.tau/agent/sessions/`.
- **Kappa** — reads squawk-board channels from the control-plane `/channels` API.
- **Kimi** — probes kimi daemons on ports 4097 and 25159 for `/sessions` endpoints.

Source-filter tabs let you focus on a single estate or see everything together.
