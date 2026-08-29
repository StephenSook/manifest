'use client';

// components/judge/StatusPanel.tsx
// Task 3.3: fetches GET /api/status and renders the live values for steps
// 1, 2 and 5 of the judge itinerary. Step 5 prints runtime (who is
// answering) above the configured model IDs.
//
// Three states:
//   loading  -- designed skeleton, not a spinner
//   error    -- designed message, verify instruction stays visible
//   loaded   -- live values from the payload
//
// Rules:
//   - No number is hardcoded. Every figure comes from the fetched payload.
//   - corpus_amddate == "PENDING_CORPUS_FREEZE" -> no citation rendered,
//     the caller passes no citation prop to ItineraryItem.
//   - Status colors always paired with a text label, never color alone.
//   - No em-dashes and no double-hyphens in copy or comments.

import { useState, useEffect } from 'react';
import { apiBase } from '@/lib/api-base';

// ---------------------------------------------------------------------------
// Response shape (mirrors app/api/status/route.ts)
// ---------------------------------------------------------------------------

interface DeorbitCompliance {
  verdict: string;
  lifetime_years: number;
  fcc_limit_years: number;
  method: string;
  citation: string;
}

interface DeorbitSwing {
  perigeeKm: number;
  ballisticCoefficient: number;
  lifetimeYears_nominal: number;
  lifetimeYears_solar_min: number;
  lifetimeYears_solar_max: number;
  fcc_limit_years: number;
  verdict_nominal: string;
  verdict_solar_min: string;
  verdict_solar_max: string;
  note: string;
}

interface SeedMission {
  id: string;
  name: string;
  source: string;
  perigeeKm: number;
  pathway: string;
}

interface Models {
  generation: string;
  audit: string;
  embedding: string;
  surya: string;
  local_fallback: string;
}

// Runtime is who is actually answering THIS request. Models (below) are
// the configured IDs. A judge who only reads the inventory will think
// Granite is running when watsonx credentials are absent.
interface Runtime {
  generation_backend: string;
  embedding_backend: string;
  guardian_audit: string;
  corpus_source: string;
  note: string;
  /**
   * What each value above is derived from. Writer and Guardian come from
   * credential presence, which is not a health check; Embedding and Corpus
   * are read from the loaded artifact. Rendering this is the difference
   * between a table that reports and a table that asserts.
   */
  basis?: Record<string, string>;
}

interface StatusPayload {
  deadline_violations_days: number;
  violated_day_sum_all_nodes: number;
  critical_path: string[];
  violated_nodes: string[];
  at_risk_nodes: string[];
  node_count: number;
  compute_ms: number;
  response_ms: number;
  deorbit_compliance: DeorbitCompliance;
  deorbit_swing: DeorbitSwing;
  seed_mission: SeedMission;
  models: Models;
  runtime?: Runtime;
  corpus_amddate: string;
  computed_at: string;
  today: string;
}

// ---------------------------------------------------------------------------
// Sentinel: corpus snapshot not yet frozen
// ---------------------------------------------------------------------------

const CORPUS_PENDING = 'PENDING_CORPUS_FREEZE';

// ---------------------------------------------------------------------------
// Shared style constants (reuse globals.css tokens, no new colors)
// ---------------------------------------------------------------------------

const LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--color-muted)',
  margin: '0 0 0.6rem',
};

const CARD: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
  padding: '1rem 1.25rem',
  backgroundColor: 'var(--color-surface)',
  marginBottom: '0.75rem',
};

const ROW: React.CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  flexWrap: 'wrap',
  marginBottom: '0.4rem',
};

const KICKER: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-muted)',
};

const VALUE: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: 'var(--color-fg)',
  lineHeight: 1.1,
};

const MUTED: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-muted)',
  lineHeight: 1.5,
};

// ---------------------------------------------------------------------------
// Verdict badge: color token + text label together, never color alone
// ---------------------------------------------------------------------------

const VERDICT_TOKEN: Record<string, string> = {
  OK: 'var(--color-ok)',
  AT_RISK: 'var(--color-at-risk)',
  VIOLATED: 'var(--color-violated)',
  ABSTAIN: 'transparent',
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const token = VERDICT_TOKEN[verdict] ?? 'transparent';
  const isAbstain = verdict === 'ABSTAIN' || !(verdict in VERDICT_TOKEN);
  return (
    <span
      aria-label={`Verdict: ${verdict}`}
      style={{
        backgroundColor: isAbstain ? 'transparent' : token,
        color: isAbstain ? 'var(--color-muted)' : 'var(--color-bg)',
        border: isAbstain ? '1px solid var(--color-border)' : 'none',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        padding: '2px 6px',
        borderRadius: '2px',
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      {verdict}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Step 1 content: headline number
// ---------------------------------------------------------------------------

function Step1Content({ data }: { data: StatusPayload }) {
  const { deadline_violations_days, node_count, compute_ms, computed_at } = data;
  return (
    <div>
      <div style={ROW}>
        <div>
          <p style={KICKER}>Violated deadline days</p>
          <p style={VALUE}>{deadline_violations_days}</p>
        </div>
        <div>
          <p style={KICKER}>Nodes computed</p>
          <p style={VALUE}>{node_count}</p>
        </div>
        <div>
          <p style={KICKER}>Compute time</p>
          <p style={VALUE}>{compute_ms} ms</p>
        </div>
      </div>
      <p style={MUTED}>
        Recomputed live. Engine anchor:{' '}
        <span style={{ color: 'var(--color-fg)' }}>{computed_at}</span>
      </p>
      {data.violated_nodes.length > 0 && (
        <p style={{ ...MUTED, marginTop: '0.4rem' }}>
          Violated nodes: {data.violated_nodes.join(', ')}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 content: deorbit swing
// ---------------------------------------------------------------------------

function Step2Content({ data }: { data: StatusPayload }) {
  const s = data.deorbit_swing;
  const c = data.deorbit_compliance;

  return (
    <div>
      <p style={{ ...MUTED, marginBottom: '0.75rem' }}>
        Seed orbit: {s.perigeeKm} km perigee,{' '}
        Bc = {s.ballisticCoefficient} kg/m&sup2;.
        Limit: {s.fcc_limit_years} yr.
        Nominal lifetime: {s.lifetimeYears_nominal.toFixed(1)} yr{' '}
        <VerdictBadge verdict={c.verdict} />
      </p>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}
        aria-label="Deorbit lifetime swing by solar activity"
      >
        <thead>
          <tr>
            {(['Solar scenario', 'Lifetime (yr)', 'Verdict'] as const).map(
              (h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    color: 'var(--color-muted)',
                    fontWeight: 600,
                    paddingBottom: '0.3rem',
                    borderBottom: '1px solid var(--color-border)',
                    paddingRight: '1rem',
                  }}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {/* Solar minimum: low F10.7, LONGEST lifetime, often the FAILING case */}
          <SwingRow
            label="Solar minimum (F10.7 = 70)"
            sublabel="longest lifetime, worst for compliance"
            lifetime={s.lifetimeYears_solar_min}
            verdict={s.verdict_solar_min}
          />
          {/* Solar maximum: high F10.7, SHORTEST lifetime, best for compliance */}
          <SwingRow
            label="Solar maximum (F10.7 = 200)"
            sublabel="shortest lifetime, best for compliance"
            lifetime={s.lifetimeYears_solar_max}
            verdict={s.verdict_solar_max}
          />
        </tbody>
      </table>
      {s.note && (
        <p style={{ ...MUTED, marginTop: '0.5rem' }}>
          {s.note}
        </p>
      )}
    </div>
  );
}

function SwingRow({
  label,
  sublabel,
  lifetime,
  verdict,
}: {
  label: string;
  sublabel: string;
  lifetime: number;
  verdict: string;
}) {
  return (
    <tr>
      <td
        style={{
          paddingTop: '0.4rem',
          paddingRight: '1rem',
          color: 'var(--color-fg)',
          verticalAlign: 'top',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.4rem',
        }}
      >
        {label}
        <br />
        <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>
          {sublabel}
        </span>
      </td>
      <td
        style={{
          paddingTop: '0.4rem',
          paddingRight: '1rem',
          fontWeight: 600,
          color: 'var(--color-fg)',
          verticalAlign: 'top',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.4rem',
        }}
      >
        {lifetime.toFixed(1)}
      </td>
      <td
        style={{
          paddingTop: '0.4rem',
          verticalAlign: 'top',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.4rem',
        }}
      >
        <VerdictBadge verdict={verdict} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Step 5 content: who is answering (runtime) then configured model IDs
// ---------------------------------------------------------------------------

function RuntimeCard({ runtime }: { runtime: Runtime }) {
  // The third column is the point of this table. On 2026-08-29 the watsonx
  // token quota was exhausted, every generation call returned 403, and this
  // card kept printing "watsonx" and "active" under a header that read
  // "Running now". Two of these four values are read from credential
  // presence and cannot see an outage, so the card now says which is which
  // rather than presenting all four as measured state.
  const basis = runtime.basis ?? {};
  const rows: [string, string, string][] = [
    ['Writer', runtime.generation_backend, basis.generation_backend ?? 'configured'],
    ['Embedding', runtime.embedding_backend, basis.embedding_backend ?? 'measured'],
    ['Guardian audit', runtime.guardian_audit, basis.guardian_audit ?? 'configured'],
    ['Corpus', runtime.corpus_source, basis.corpus_source ?? 'measured'],
  ];
  return (
    <div>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}
        aria-label="Who is answering this request"
      >
        <thead>
          <tr>
            {(['Role', 'Reported', 'Basis'] as const).map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  color: 'var(--color-muted)',
                  fontWeight: 600,
                  paddingBottom: '0.3rem',
                  borderBottom: '1px solid var(--color-border)',
                  paddingRight: '1rem',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([role, value, why]) => (
            <tr key={role}>
              <td
                style={{
                  paddingTop: '0.35rem',
                  paddingRight: '1rem',
                  color: 'var(--color-muted)',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '0.35rem',
                }}
              >
                {role}
              </td>
              <td
                style={{
                  paddingTop: '0.35rem',
                  paddingRight: '1rem',
                  color: 'var(--color-fg)',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '0.35rem',
                  fontFamily: 'inherit',
                  fontWeight: role === 'Writer' ? 600 : 400,
                }}
              >
                {value}
              </td>
              <td
                style={{
                  paddingTop: '0.35rem',
                  color: 'var(--color-muted)',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '0.35rem',
                }}
              >
                {why}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {runtime.note && (
        <p style={{ ...MUTED, marginTop: '0.5rem' }}>{runtime.note}</p>
      )}
    </div>
  );
}

function ModelsTable({ models }: { models: Models }) {
  const rows: [string, string][] = [
    ['Generation', models.generation],
    ['Audit (Guardian)', models.audit],
    ['Embedding', models.embedding],
    ['Solar/Surya', models.surya],
    ['Local fallback', models.local_fallback],
  ];
  return (
    <table
      style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}
      aria-label="Model inventory: claimed vs invoked"
    >
      <thead>
        <tr>
          {(['Role', 'Model ID'] as const).map((h) => (
            <th
              key={h}
              style={{
                textAlign: 'left',
                color: 'var(--color-muted)',
                fontWeight: 600,
                paddingBottom: '0.3rem',
                borderBottom: '1px solid var(--color-border)',
                paddingRight: '1rem',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([role, id]) => (
          <tr key={role}>
            <td
              style={{
                paddingTop: '0.35rem',
                paddingRight: '1rem',
                color: 'var(--color-muted)',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '0.35rem',
              }}
            >
              {role}
            </td>
            <td
              style={{
                paddingTop: '0.35rem',
                color: 'var(--color-fg)',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '0.35rem',
                fontFamily: 'inherit',
              }}
            >
              {id}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton: designed, not a spinner
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  const bar = (w: string) => (
    <div
      style={{
        height: '12px',
        width: w,
        backgroundColor: 'var(--color-border)',
        borderRadius: '2px',
        marginBottom: '0.4rem',
      }}
    />
  );
  return (
    <div style={{ ...CARD, opacity: 0.6 }} aria-label="Loading status data">
      {bar('40%')}
      {bar('60%')}
      {bar('30%')}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state: designed, verify instructions remain visible
// ---------------------------------------------------------------------------

function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        ...CARD,
        borderLeft: '3px solid var(--color-violated)',
      }}
    >
      <p style={{ ...LABEL, color: 'var(--color-violated)' }}>
        <span aria-hidden="true">! </span>Fetch failed
      </p>
      <p style={{ fontSize: '13px', color: 'var(--color-fg)', margin: '0 0 0.4rem' }}>
        {message}
      </p>
      <p style={MUTED}>
        The live figures are unavailable. The verify instructions below still
        work: open a terminal and run the curl command to check by hand.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export interface StatusPanelProps {
  /** Callback: passes the loaded payload up to the page for citation gating */
  onLoad?: (payload: StatusPayload) => void;
}

export type { StatusPayload };

export function StatusPanel({ onLoad }: StatusPanelProps) {
  const [status, setStatus] = useState<
    | { state: 'loading' }
    | { state: 'error'; message: string }
    | { state: 'loaded'; data: StatusPayload }
  >({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase()}/api/status`)
      .then((res) => {
        if (!res.ok) throw new Error(`/api/status returned HTTP ${res.status}`);
        return res.json() as Promise<StatusPayload>;
      })
      .then((data) => {
        if (cancelled) return;
        setStatus({ state: 'loaded', data });
        onLoad?.(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : 'Unknown fetch error';
        setStatus({ state: 'error', message: msg });
      });
    return () => { cancelled = true; };
  }, [onLoad]);

  if (status.state === 'loading') {
    return <LoadingSkeleton />;
  }

  if (status.state === 'error') {
    return <ErrorState message={status.message} />;
  }

  const { data } = status;

  return (
    <div>
      {/* Step 1 data block */}
      <div style={{ ...CARD, marginBottom: '0.75rem' }} id="step1-data">
        <p style={LABEL}>Step 1: headline</p>
        <Step1Content data={data} />
      </div>

      {/* Step 2 data block */}
      <div style={{ ...CARD, marginBottom: '0.75rem' }} id="step2-data">
        <p style={LABEL}>Step 2: deorbit swing</p>
        <Step2Content data={data} />
      </div>

      {/* Step 5 data block: runtime writer, then configured IDs */}
      <div style={CARD} id="step5-data">
        <p style={LABEL}>Step 5: who is answering (runtime)</p>
        {data.runtime ? (
          <RuntimeCard runtime={data.runtime} />
        ) : (
          <p style={MUTED}>
            runtime block missing from this /api/status response. Do not
            assume Granite is answering.
          </p>
        )}
        <p style={{ ...LABEL, marginTop: '1rem' }}>
          Configured model IDs (not the running path)
        </p>
        <ModelsTable models={data.models} />
        <p style={{ ...MUTED, marginTop: '0.5rem' }}>
          Source: {data.seed_mission.name} ({data.seed_mission.source})
        </p>
      </div>
    </div>
  );
}
