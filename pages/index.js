import { useState, useEffect } from 'react'
import Head from 'next/head'

// Primary, canonical control-plane dashboard. Every tab renders this SAME
// surface via the iframe below, so N tabs always land on one coherent real
// state — the estate's own control plane (:25156).
const CONTROL_PLANE_URL = 'http://127.0.0.1:25156/'

export default function Home() {
  const [estate, setEstate] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Single real Next API route. It server-side aggregates the canonical
    // control-plane API (:25162) + real nvidia-smi, so every tab that calls it
    // receives the same real estate state (there is no per-tab random source).
    fetch('/api/agents')
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
      )
      .then(setEstate)
      .catch((e) => setError(e.message))
  }, [])

  const s = estate?.summary
  const gpu = estate?.gpu
  const agents = estate?.agents ?? []

  return (
    <div style={styles.page}>
      <Head>
        <title>cs3_forge • Estate Agent Fleet</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Estate Agent Fleet</h1>
            <p style={styles.subtitle}>
              Real control-plane data — not fabricated.
            </p>
          </div>
          <div style={styles.livePill}>
            <span
              style={{
                ...styles.dot,
                background: estate?.controlPlane?.live ? '#22c55e' : '#ef4444',
              }}
            />
            <span>
              {estate?.controlPlane?.live
                ? 'Control plane live'
                : error
                  ? 'Control plane unreachable'
                  : 'Loading…'}
            </span>
          </div>
        </header>

        {/* Canonical control-plane splash + link (primary surface). */}
        <section style={styles.splash}>
          <div style={styles.splashCopy}>
            <h2 style={styles.splashTitle}>DelendAI Control Plane</h2>
            <p style={styles.splashText}>
              This is the canonical, real estate dashboard — services grid,
              provider & router dashboards, and chat channels. Every browser tab
              frames this same surface, so the fleet always shows one
              consistent, truthful state.
            </p>
            <a
              href={CONTROL_PLANE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.splashBtn}
            >
              Open full control plane ↗
            </a>
          </div>
        </section>

        {/* Real summary — live counts from /api/agents. */}
        <section style={styles.statsGrid}>
          <StatCard
            label="Active daemons"
            value={s ? String(s.activeDaemons) : '…'}
            hint={s ? `of ${s.totalDaemons} total` : 'loading real count'}
          />
          <StatCard
            label="Decadodes"
            value={s ? String(s.degradedDaemons) : '…'}
            hint="real status"
          />
          <StatCard
            label="GPU memory"
            value={gpu ? `${gpu.usedGb} GB` : error ? 'no GPU' : '…'}
            hint={gpu ? `${gpu.totalGb} GB ${gpu.name}` : 'nvidia-smi'}
          />
          <StatCard
            label="Providers"
            value={s ? String(s.providersAvailable) : '…'}
            hint={s ? `of ${s.providersTotal} reachable` : 'real roster'}
          />
        </section>

        {/* Real per-agent fleet. */}
        <section style={styles.agentsSection}>
          <h2 style={styles.sectionTitle}>Agent fleet</h2>
          {genesLoading(estate, error) && (
            <p style={styles.muted}>Loading real roster…</p>
          )}
          {error && (
            <p style={styles.err}>Could not reach control-plane API: {error}</p>
          )}
          {estate && (
            <div style={styles.agentGrid}>
              {agents.map((a) => (
                <div key={a.name} style={styles.agentCard}>
                  <div style={styles.agentRow}>
                    <span style={styles.agentName}>
                      {a.name.replace(/^estate\//, '')}
                    </span>
                    <span style={statusPill(a.online)}>
                      {a.online ? 'online' : a.status}
                    </span>
                  </div>
                  <div style={styles.agentMeta}>
                    <span>{a.kind}</span>
                    {a.port ? <span style={styles.port}>:{a.port}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Every tab frames the SAME canonical control-plane dashboard. */}
        <section style={styles.frameSection}>
          <h2 style={styles.sectionTitle}>
            Canonical control plane (same for every tab)
          </h2>
          <iframe
            title="DelendAI Control Plane"
            src={CONTROL_PLANE_URL}
            style={styles.frame}
            loading="eager"
          />
        </section>
      </main>

      <footer style={styles.footer}>
        Real sources: pitchfork list · delendai-control-api (:25162) · herd
        models (:25100) · pinax providers · nvidia-smi
      </footer>

      <style jsx global>{`
        body {
          margin: 0;
          background: #0a0f1e;
        }
      `}</style>
    </div>
  )
}

function genesLoading(estate, error) {
  return !estate && !error
}

function StatCard({ label, value, hint }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statHint}>{hint}</div>
    </div>
  )
}

function statusPill(online) {
  return {
    ...styles.pill,
    background: online ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)',
    color: online ? '#4ade80' : '#f87171',
  }
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg,#0a0f1e,#0f172a 55%,#020617)',
    color: '#e2e8f0',
    fontFamily:
      'ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
  },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '2.2rem',
    background: 'linear-gradient(90deg,#22d3ee,#3b82f6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: { margin: '4px 0 0', color: '#94a3b8' },
  livePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '999px',
    padding: '8px 14px',
    fontSize: '0.85rem',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'pulse 1.6s infinite',
  },
  splash: {
    display: 'flex',
    background:
      'linear-gradient(120deg,rgba(34,211,238,0.14),rgba(59,130,246,0.10))',
    border: '1px solid rgba(34,211,238,0.25)',
    borderRadius: '14px',
    padding: '24px 28px',
    marginBottom: '24px',
  },
  splashCopy: { display: 'flex', flexDirection: 'column', gap: '8px' },
  splashTitle: { margin: 0, fontSize: '1.4rem', color: '#e0f2fe' },
  splashText: { margin: 0, color: '#cbd5e1', maxWidth: '720px' },
  splashBtn: {
    alignSelf: 'flex-start',
    marginTop: '6px',
    background: '#0ea5e9',
    color: '#fff',
    fontWeight: 600,
    padding: '10px 16px',
    borderRadius: '10px',
    textDecoration: 'none',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
    gap: '14px',
    marginBottom: '28px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '14px',
    padding: '18px',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  statValue: { fontSize: '2rem', fontWeight: 700, margin: '6px 0 2px' },
  statHint: { color: '#64748b', fontSize: '0.78rem' },
  agentsSection: { marginBottom: '28px' },
  sectionTitle: { fontSize: '1.25rem', margin: '0 0 12px', color: '#e2e8f0' },
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
    gap: '12px',
  },
  agentCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '14px',
  },
  agentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  agentName: { fontWeight: 600, fontSize: '0.92rem' },
  pill: {
    fontSize: '0.72rem',
    padding: '3px 10px',
    borderRadius: '999px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  agentMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    color: '#64748b',
    fontSize: '0.75rem',
  },
  port: { color: '#38bdf8' },
  frameSection: { marginTop: '12px' },
  frame: {
    width: '100%',
    height: '720px',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '12px',
    background: '#0f172a',
  },
  footer: {
    textAlign: 'center',
    color: '#475569',
    fontSize: '0.75rem',
    padding: '24px',
  },
  muted: { color: '#64748b' },
  err: { color: '#f87171' },
}
