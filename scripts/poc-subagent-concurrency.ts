#!/usr/bin/env bun
/**
 * poc-subagent-concurrency.ts — reproduce why background subagents get
 * cancelled: freeinference hard-caps concurrent model requests at 2, so a 3rd
 * concurrent subagent's turn 429s ("Too many concurrent requests (limit: 2)")
 * and the agent-runtime auto-repairs it (cancels the resident).
 *
 * Spawns N concurrent freeinference chat-completions (each = one subagent "turn")
 * with concurrency 3 and records each request's status/body. Expect req #3 to
 * 429. Run: bun scripts/poc-subagent-concurrency.ts <n>
 */
const N = Number(process.argv[2] ?? 3)
const key =
  process.env.FREEINFERENCE_API_KEY || (process.env.DEEPSEEK_API_KEY ?? '')
const URL = 'https://freeinference.org/v1/chat/completions'
const bible = Array.from({ length: N }, (_, i) =>
  fetch(URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: `subagent turn ${i}` }],
      max_tokens: 4,
    }),
  }).then(async (r) => ({
    i,
    status: r.status,
    body: (await r.text()).slice(0, 120),
  }))
)
// Race them all; note which exceed the freeinference 2-slot cap.
const started = Date.now()
const results = await Promise.all(bible)
for (const r of results.sort((a, b) => a.i - b.i)) {
  console.log(
    `turn ${r.i}: http ${r.status} ${r.status >= 200 && r.status < 300 ? 'OK' : 'NOT-OK'} ${r.body.includes('Too many') ? '<- CONCURRENCY CAP HIT' : ''}`
  )
}
console.log(
  `\n[poc] ${N} concurrent subagent-turns took ${Date.now() - started}ms; count 429 = ${results.filter((r) => r.status === 429).length}`
)
