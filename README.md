# Range

Internal project workspace.

## Apps

### delendai-control-plane

Control-plane SPA — services grid, provider/router quota dashboards, kappa-board chat channels.

**Location**: `apps/delendai-control-plane/`

```bash
cd apps/delendai-control-plane
bun test                # run all tests
bun test --coverage     # run with V8 coverage report
```

- **43 tests**, 0 failures, 159 expect() calls — all pass
- **99.4% line coverage**, **94.3% function coverage** (≥90% target met)
- Uncovered lines are defensive error paths in `channels.ts` (stat/readDir/readFile failures)
- Alias config: `@/*` → `src/*` via `vite.config.ts` and `tsconfig.json`

## Packages

Next.js core packages and tooling under `packages/`. Run tests via the standard Next.js test harness (`pnpm test`).

## Scripts

Utility and release scripts under `scripts/`.
