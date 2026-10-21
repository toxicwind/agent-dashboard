#!/usr/bin/env bun
/**
 * poc-coverage-v8-crash.ts — reproduce the @vitest/coverage-v8 crash under
 * `vitest run --coverage` (observed `Object.takeCoverage` error + 0% report).
 *
 * Repro: `bunx vitest run --coverage` in apps/delendai-control-plane crashes in
 * node_modules/@vitest/coverage-v8/dist/index.js:71 (takeCoverage) and reports
 * 0/0 coverage. This script isolates that runtime error with the actual config.
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const app = '/home/toxic/estate/ranch/range/apps/delendai-control-plane'
console.log('[poc] running vitest --coverage in', app)
const res = spawnSync(
  '/home/toxic/.bun/bin/bunx',
  ['vitest', 'run', '--coverage'],
  {
    cwd: app,
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: '.vitest-tmp' },
  }
)
console.log('exit', res.status)
console.log('--- stdout tail ---')
console.log(res.stdout.slice(-800))
console.log('--- stderr tail ---')
console.log(res.stderr.slice(-600))
console.log('[poc] reproduce-done (exit %d)', res.status ?? -1)
