/**
 * mise — reader for the estate's mise task definitions.
 *
 * `/home/toxic/estate/mise.toml` (plus the `mise/conf.d/*.toml` fragments
 * mise loads alphabetically) declares `[tasks.<name>]` and an `[env]` table.
 * The surface registry only needs the task names, their run lines and the
 * port references inside them, so the reader stays narrow.
 */

import { parseToml, type TomlTable, type TomlValue } from './toml.ts'

export interface MiseTask {
  readonly name: string
  readonly run: string | null
  readonly description: string | null
  readonly dir: string | null
  readonly sources: readonly string[]
  readonly outputs: readonly string[]
  /** Every `:port` referenced by the task's own text. */
  readonly ports: readonly number[]
}

export interface MiseEnv {
  readonly vars: Record<string, string>
  readonly files: readonly string[]
}

export interface MiseModel {
  readonly tasks: readonly MiseTask[]
  readonly env: MiseEnv
}

function asString(value: TomlValue | undefined): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return null
}

function asStringArray(value: TomlValue | undefined): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    const str = asString(item)
    if (str !== null) out.push(str)
  }
  return out
}

/** Every `:port` mentioned in a blob of text. */
export function portsInText(text: string | null): number[] {
  if (!text) return []
  const out = new Set<number>()
  const urlPort = /[a-z][a-z0-9+.-]*:\/\/[^/\s:]+:(\d{2,5})/gi
  let match = urlPort.exec(text)
  while (match) {
    out.add(Number(match[1]))
    match = urlPort.exec(text)
  }
  const flagPort = /(?:^|\s)-p[= ](\d{2,5})\b/g
  match = flagPort.exec(text)
  while (match) {
    out.add(Number(match[1]))
    match = flagPort.exec(text)
  }
  return [...out].sort((a, b) => a - b)
}

function taskFromTable(name: string, table: TomlTable): MiseTask {
  const run = asString(table.run)
  const description = asString(table.description)
  const dir = asString(table.dir)
  const sources = asStringArray(table.sources)
  const outputs = asStringArray(table.outputs)
  const ports = new Set<number>(portsInText(run))
  for (const extra of [...sources, ...outputs]) {
    for (const port of portsInText(extra)) ports.add(port)
  }
  return {
    name,
    run,
    description,
    dir,
    sources,
    outputs,
    ports: [...ports].sort((a, b) => a - b),
  }
}

/** Parse one mise TOML document into tasks + env. */
export function parseMise(source: string): MiseModel {
  const doc = parseToml(source)
  const tasks: MiseTask[] = []
  const rawTasks = doc.tasks
  if (rawTasks && typeof rawTasks === 'object' && !Array.isArray(rawTasks)) {
    for (const [name, raw] of Object.entries(rawTasks as TomlTable)) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
      tasks.push(taskFromTable(name, raw as TomlTable))
    }
  }
  tasks.sort((a, b) => a.name.localeCompare(b.name))

  const vars: Record<string, string> = {}
  const files: string[] = []
  const rawEnv = doc.env
  if (rawEnv && typeof rawEnv === 'object' && !Array.isArray(rawEnv)) {
    for (const [key, raw] of Object.entries(rawEnv as TomlTable)) {
      if (key === '_' || key === '_.file') {
        files.push(...asStringArray(raw))
        continue
      }
      const value = asString(raw)
      if (value !== null) vars[key] = value
    }
  }

  return { tasks, env: { vars, files: [...files].sort() } }
}

/** Parse several mise documents, merging tasks by name. */
export function parseMiseDocuments(
  sources: ReadonlyArray<{ file: string; source: string }>
): MiseModel {
  const byName = new Map<string, MiseTask>()
  const vars: Record<string, string> = {}
  const files = new Set<string>()

  for (const { source } of [...sources].sort((a, b) =>
    a.file.localeCompare(b.file)
  )) {
    const model = parseMise(source)
    for (const task of model.tasks) {
      const existing = byName.get(task.name)
      if (!existing) {
        byName.set(task.name, task)
        continue
      }
      byName.set(task.name, {
        name: task.name,
        run: task.run ?? existing.run,
        description: task.description ?? existing.description,
        dir: task.dir ?? existing.dir,
        sources: task.sources.length ? task.sources : existing.sources,
        outputs: task.outputs.length ? task.outputs : existing.outputs,
        ports: [...new Set([...existing.ports, ...task.ports])].sort(
          (a, b) => a - b
        ),
      })
    }
    Object.assign(vars, model.env.vars)
    for (const file of model.env.files) files.add(file)
  }

  return {
    tasks: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
    env: { vars, files: [...files].sort() },
  }
}
