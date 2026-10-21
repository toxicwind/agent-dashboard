# delendai-control-plane

Control-plane SPA — services grid, provider/router quota dashboards, kappa-board chat channels.

## Aliases

- Alias configuration lives in `vite.config.ts` and `tsconfig.json` (paths `@/*` → `src/*`).

## Tests

```bash
bun test                # run all tests
bun test --coverage     # run with V8 coverage report
```

All 43 tests pass across 5 files with **99.4% line coverage** and **94.3% function coverage** (≥90% target met).

| File | Functions | Lines |
|------|-----------|-------|
| `src/api/client.ts` | 93.3% | 100.0% |
| `src/data/channels.ts` | 85.7% | 97.0% |
| `src/data/provider-record.ts` | 92.3% | 100.0% |
| `src/data/services.ts` | 100.0% | 100.0% |
| `src/lib/utils.ts` | 100.0% | 100.0% |

Uncovered lines in `channels.ts` are defensive error paths (`stat` failure in `loadChannels`, `readDir` failure in `loadChannel`, `readFile` failure in `loadChannel`, and the sort return) — these are intentionally unreachable in tested scenarios.
