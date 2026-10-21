/**
 * surface-registry — the auto-composed registry of the estate's agent-chat
 * web surfaces.
 *
 * The registry is generated from the estate's own SSOTs
 * (`config/ports.env`, `pitchfork.d/*.toml`, `mise.toml`) so that no consumer
 * ever hardcodes a port. `generate` writes the committed artifacts, `check`
 * is the machine gate that fails when they drift.
 */

export {
  composeManifest,
  daemonPort,
  daemonPortKey,
  daemonKeyStem,
  manifestToJson,
  miseTaskForPort,
  relayOriginToWebOrigin,
  type ComposeInput,
} from './compose.ts'
export {
  DEFAULT_ESTATE_ROOT,
  estateRootExists,
  readEstateSources,
  readTauRelayUrl,
  type EstateSources,
} from './estate.ts'
export { checkDrift, type DriftOptions, type DriftResult } from './drift.ts'
export {
  deriveManifest,
  defaultOutDir,
  generate,
  GENERATED_DIR_NAME,
  MANIFEST_JSON_NAME,
  MANIFEST_TS_NAME,
  renderManifestModule,
  type GenerateOptions,
  type GenerateResult,
} from './generate.ts'
export {
  daemonById,
  emptyManifest,
  surfaceForAgent,
  type AgentKind,
  type ManifestDaemon,
  type ManifestSources,
  type ManifestSurface,
  type SurfaceAuthMode,
  type SurfaceManifest,
} from './manifest.ts'
export {
  parseMise,
  parseMiseDocuments,
  portsInText,
  type MiseEnv,
  type MiseModel,
  type MiseTask,
} from './mise.ts'
export {
  parsePitchforkDaemons,
  parsePitchforkManifests,
  portFromUrl,
  type PitchforkDaemon,
  type PitchforkHealthHttp,
} from './pitchfork.ts'
export {
  parsePortsEnv,
  parsePortsEnvEntries,
  parsePortsEnvValues,
  portsEnvKeys,
  stripPortsEnvComment,
  type PortsEnvEntry,
} from './ports-env.ts'
export {
  AGENT_SURFACE_RULES,
  ruleForAgent,
  type AgentSurfaceRule,
} from './rules.ts'
export {
  parseToml,
  TomlParseError,
  type TomlDocument,
  type TomlTable,
  type TomlValue,
} from './toml.ts'
