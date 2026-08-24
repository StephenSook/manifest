'use client';

// components/deorbit/DeorbitPanel.tsx
// Task 2.7: deorbit compliance panel. The innovation surface.
//
// FIELD SEMANTICS (load-bearing, do not invert):
//   lifetimeYearsLow  = solar MINIMUM (F10.7=70) = LONGEST lifetime = WORST
//                       case for compliance. High F10.7 drives density up,
//                       drag up, lifetime down.
//   lifetimeYearsHigh = solar MAXIMUM (F10.7=200) = SHORTEST lifetime = BEST
//                       case for compliance.
//
// The central claim: same satellite, same orbit, opposite legal answer
// depending on where the solar cycle sits. The swing table is the headline.
//
// CITATION HANDLING: result.citation.amddate will equal the literal string
// "VERIFY_FROM_SNAPSHOT" until Tylin's task 1.1 corpus freeze. The section
// reference (cfrTitle, part, section) and sourceUrl are rendered. The
// paragraph path and amddate are NOT shown while the sentinel is present.
// When the snapshot lands, both appear automatically.
//
// Surya and live NOAA F10.7 arrive through Stephen's /api/solar route
// (task 2.8). A typed optional prop is reserved for each. The panel
// renders the nominal decay-table value in the meantime.
//
// No regulatory text is typed into JSX. Every citation value comes from
// result.citation. No new colors introduced. Status tokens used:
// --color-violated, --color-at-risk, --color-ok, --color-muted, --color-fg.

import { computeDeorbitCompliance } from '@/engine/interlocks/deorbit-compliance';
import type { DeorbitComplianceResult } from '@/engine/interlocks/deorbit-compliance';
import type { MissionInput, Verdict } from '@/engine/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeorbitPanelProps {
  mission: MissionInput;
  /**
   * Live NOAA F10.7 solar flux index. When provided, the nominal lifetime
   * is re-evaluated using the override correction in the engine. Arrives
   * from Stephen's /api/solar route (task 2.8). Optional until wired.
   */
  f107Override?: number;
  /**
   * Surya activity index. Displayed beside the NOAA envelope when present.
   * Arrives from /api/solar (task 2.8). This value is an ESTIMATED scalar
   * proxy from AIA 94A intensity, not a calibrated flux forecast.
   * Optional until wired.
   */
  suryaActivityIndex?: number;
}

// ---------------------------------------------------------------------------
// Sentinel value from the engine -- paragraph path not yet verified
// ---------------------------------------------------------------------------

const SNAPSHOT_SENTINEL = 'VERIFY_FROM_SNAPSHOT';

// ---------------------------------------------------------------------------
// Verdict presentation (color + text label -- never color alone)
// ---------------------------------------------------------------------------

const VERDICT_CONFIG: Record<
  Verdict,
  { token: string; label: string; textOnToken: string }
> = {
  VIOLATED: {
    token: 'var(--color-violated)',
    label: 'VIOLATED',
    textOnToken: 'var(--color-bg)',
  },
  AT_RISK: {
    token: 'var(--color-at-risk)',
    label: 'AT RISK',
    textOnToken: 'var(--color-bg)',
  },
  OK: {
    token: 'var(--color-ok)',
    label: 'OK',
    textOnToken: 'var(--color-bg)',
  },
  ABSTAIN: {
    token: 'transparent',
    label: 'ABSTAIN',
    textOnToken: 'var(--color-muted)',
  },
};

// ---------------------------------------------------------------------------
// Inline style helpers (reuse globals.css tokens, no new colors)
// ---------------------------------------------------------------------------

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--color-muted)',
  margin: '0 0 0.75rem',
};

const ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.1rem 0',
  marginBottom: '0.5rem',
};

const ROW_LABEL: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-muted)',
};

const ROW_VALUE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-fg)',
  fontWeight: 500,
};

const DIVIDER: React.CSSProperties = {
  borderBottom: '1px solid var(--color-border)',
  margin: '0.85rem 0',
};

const MUTED_NOTE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-muted)',
  lineHeight: '1.5',
};

// ---------------------------------------------------------------------------
// Verdict badge: color token + text label together
// ---------------------------------------------------------------------------

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const cfg = VERDICT_CONFIG[verdict];
  const isAbstain = verdict === 'ABSTAIN';
  return (
    <span
      aria-label={`Verdict: ${cfg.label}`}
      style={{
        backgroundColor: isAbstain ? 'transparent' : cfg.token,
        color: isAbstain ? 'var(--color-muted)' : cfg.textOnToken,
        border: isAbstain ? '1px solid var(--color-border)' : 'none',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        padding: '2px 6px',
        borderRadius: '2px',
        display: 'inline-block',
      }}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Swing row: one scenario (solar min or solar max) in the swing table
// ---------------------------------------------------------------------------

function SwingRow({
  scenarioLabel,
  lifetimeYears,
  fccLimitYears,
  f107Label,
}: {
  scenarioLabel: string;
  lifetimeYears: number;
  fccLimitYears: number;
  f107Label: string;
}) {
  // Derive verdict for this scenario from its lifetime vs the limit
  let swingVerdict: Verdict;
  if (lifetimeYears <= fccLimitYears) {
    swingVerdict = 'OK';
  } else if (lifetimeYears <= fccLimitYears * 1.2) {
    swingVerdict = 'AT_RISK';
  } else {
    swingVerdict = 'VIOLATED';
  }

  return (
    <tr>
      <td
        style={{
          padding: '0.35rem 0.5rem 0.35rem 0',
          fontSize: '12px',
          color: 'var(--color-muted)',
          verticalAlign: 'middle',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {scenarioLabel}
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-muted)',
            marginLeft: '0.4rem',
          }}
        >
          {f107Label}
        </span>
      </td>
      <td
        style={{
          padding: '0.35rem 0.5rem 0.35rem 0',
          fontSize: '12px',
          color: 'var(--color-fg)',
          fontWeight: 500,
          verticalAlign: 'middle',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {lifetimeYears.toFixed(1)} yr
      </td>
      <td
        style={{
          padding: '0.35rem 0',
          verticalAlign: 'middle',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <VerdictBadge verdict={swingVerdict} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Citation block
// ---------------------------------------------------------------------------

function CitationBlock({ result }: { result: DeorbitComplianceResult }) {
  const { citation } = result;
  const snapshotPending = citation.amddate === SNAPSHOT_SENTINEL;

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <p style={SECTION_LABEL}>Governing authority</p>
      <p style={{ ...ROW_VALUE, marginBottom: '0.2rem' }}>
        {citation.cfrTitle} CFR {citation.part}.{citation.section}
        {/* Paragraph path only shown once the snapshot is verified */}
        {!snapshotPending && citation.paragraphPath && (
          <span style={{ color: 'var(--color-muted)' }}>
            {citation.paragraphPath}
          </span>
        )}
        {' '}
        <a
          href={citation.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--color-accent)',
            fontSize: '11px',
            textDecoration: 'none',
          }}
        >
          eCFR
        </a>
      </p>
      {snapshotPending && (
        <p style={MUTED_NOTE}>
          Paragraph path pending corpus snapshot (task 1.1). Section-level
          citation confirmed.
        </p>
      )}
      {!snapshotPending && (
        <p style={MUTED_NOTE}>
          Corpus snapshot: {citation.amddate}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DeorbitPanel({
  mission,
  f107Override,
  suryaActivityIndex: _suryaActivityIndex,
}: DeorbitPanelProps) {
  const result = computeDeorbitCompliance(
    mission.perigeeKm,
    mission.ballisticCoefficient,
    f107Override,
  );

  const panelStyle: React.CSSProperties = {
    border: '1px solid var(--color-border)',
    borderLeft: `3px solid ${
      result.verdict === 'VIOLATED'
        ? 'var(--color-violated)'
        : result.verdict === 'AT_RISK'
        ? 'var(--color-at-risk)'
        : result.verdict === 'OK'
        ? 'var(--color-ok)'
        : 'var(--color-border)'
    }`,
    borderRadius: '4px',
    padding: '1.1rem 1.25rem',
    backgroundColor: 'var(--color-surface)',
    marginBottom: '1rem',
  };

  // ---- State: above rule threshold ----------------------------------------
  if (result.aboveRuleThreshold) {
    return (
      <div style={panelStyle}>
        <p style={SECTION_LABEL}>Deorbit compliance</p>
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-fg)', margin: '0 0 0.4rem' }}>
          Five-year rule does not apply
        </p>
        <p style={MUTED_NOTE}>
          This orbit is above the 2000 km threshold. The five-year disposal
          rule applies only to low Earth orbit satellites. No reentry lifetime
          calculation is required.
        </p>
        <CitationBlock result={result} />
      </div>
    );
  }

  // ---- State: table entry not found (abstention, not an error) -------------
  if (result.tableEntryNotFound) {
    return (
      <div style={panelStyle}>
        <p style={SECTION_LABEL}>Deorbit compliance</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <VerdictBadge verdict="ABSTAIN" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-fg)' }}>
            No lifetime estimate available
          </span>
        </div>
        <p style={MUTED_NOTE}>
          No decay table entry exists for this orbit and ballistic coefficient.
          Run pipeline/decay.py to generate estimates. The panel will populate
          once the table covers this configuration.
        </p>
        <p style={{ ...MUTED_NOTE, marginTop: '0.4rem', fontStyle: 'italic' }}>
          {result.method}
        </p>
        <CitationBlock result={result} />
      </div>
    );
  }

  // ---- Normal render -------------------------------------------------------
  return (
    <div style={panelStyle}>
      <p style={SECTION_LABEL}>Deorbit compliance</p>

      {/* Headline verdict row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
        <VerdictBadge verdict={result.verdict} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-fg)' }}>
          {result.verdict === 'OK' && 'Nominal lifetime within the five-year limit'}
          {result.verdict === 'AT_RISK' && 'Nominal lifetime within 20% of the five-year limit'}
          {result.verdict === 'VIOLATED' && 'Nominal lifetime exceeds the five-year limit'}
          {result.verdict === 'ABSTAIN' && 'Compliance cannot be determined'}
        </span>
      </div>

      {/* Nominal scenario */}
      <div style={ROW}>
        <span style={ROW_LABEL}>Reentry lifetime (nominal)</span>
        <span style={ROW_VALUE}>{result.lifetimeYears.toFixed(1)} yr</span>
      </div>
      <div style={ROW}>
        <span style={ROW_LABEL}>Five-year disposal limit</span>
        <span style={ROW_VALUE}>{result.fccLimitYears} yr</span>
      </div>
      <div style={{ ...ROW, marginBottom: '0.2rem' }}>
        <span style={ROW_LABEL}>
          F10.7 used
          {f107Override !== undefined && (
            <span style={{ color: 'var(--color-accent)', marginLeft: '0.3rem', fontSize: '10px' }}>
              (live)
            </span>
          )}
        </span>
        <span style={ROW_VALUE}>{result.f107Assumed} SFU</span>
      </div>

      {/* Closest altitude note */}
      {result.closestAltitudeKmUsed !== null && (
        <p style={{ ...MUTED_NOTE, marginTop: '0.4rem' }}>
          Nearest table entry: {result.closestAltitudeKmUsed} km altitude.
          This orbit ({mission.perigeeKm} km perigee) does not have an exact
          table entry. The figures above and below use the {result.closestAltitudeKmUsed} km
          values and may not reflect the true lifetime at this altitude.
        </p>
      )}

      <div style={DIVIDER} />

      {/* THE SWING: the headline of the panel */}
      <p style={{ ...SECTION_LABEL, marginBottom: '0.5rem' }}>
        The swing: same orbit, different solar activity
      </p>
      <p style={MUTED_NOTE}>
        The five-year rule outcome depends on the solar cycle.
        Higher solar activity increases atmospheric density, which increases
        drag and shortens the reentry lifetime. These are independent
        NRLMSISE-00 estimates, not NASA DAS runs.
      </p>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '0.65rem',
          fontSize: '12px',
        }}
        aria-label="Reentry lifetime swing by solar activity"
      >
        <thead>
          <tr>
            <th style={{ textAlign: 'left', color: 'var(--color-muted)', fontWeight: 600, paddingBottom: '0.35rem', borderBottom: '1px solid var(--color-border)', paddingRight: '0.5rem' }}>
              Solar scenario
            </th>
            <th style={{ textAlign: 'left', color: 'var(--color-muted)', fontWeight: 600, paddingBottom: '0.35rem', borderBottom: '1px solid var(--color-border)', paddingRight: '0.5rem' }}>
              Reentry lifetime
            </th>
            <th style={{ textAlign: 'left', color: 'var(--color-muted)', fontWeight: 600, paddingBottom: '0.35rem', borderBottom: '1px solid var(--color-border)' }}>
              Verdict
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Solar minimum: low F10.7, LONGEST lifetime, WORST for compliance */}
          <SwingRow
            scenarioLabel="Solar minimum"
            lifetimeYears={result.lifetimeYearsLow}
            fccLimitYears={result.fccLimitYears}
            f107Label="(F10.7 = 70, longest lifetime)"
          />
          {/* Solar maximum: high F10.7, SHORTEST lifetime, BEST for compliance */}
          <SwingRow
            scenarioLabel="Solar maximum"
            lifetimeYears={result.lifetimeYearsHigh}
            fccLimitYears={result.fccLimitYears}
            f107Label="(F10.7 = 200, shortest lifetime)"
          />
        </tbody>
      </table>

      <div style={DIVIDER} />

      {/* Method (verbatim from engine, labelled ESTIMATE) */}
      <p style={{ ...MUTED_NOTE, marginBottom: '0.2rem' }}>
        <span style={{ fontWeight: 600 }}>Method (ESTIMATE): </span>
        {result.method}
      </p>

      <CitationBlock result={result} />
    </div>
  );
}
