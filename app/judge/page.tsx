'use client';

// app/judge/page.tsx
// Task 3.3: judge view, wired with live /api/status data.
//
// ItineraryItem is preserved exactly from the stub. Its citation prop
// behavior is unchanged: when citation is absent, the abstention line
// renders. corpus_amddate == "PENDING_CORPUS_FREEZE" -> no citation passed.
//
// Client component: needs useState to receive the StatusPanel payload for
// corpus_amddate gating. The fetch itself lives in components/judge/StatusPanel.
//
// No regulatory text typed into JSX. Citation strings come from the payload.
// No em-dashes and no double-hyphens in copy or comments.

import { useState, useCallback } from 'react';
import { StatusPanel } from '@/components/judge/StatusPanel';
import type { StatusPayload } from '@/components/judge/StatusPanel';

// ---------------------------------------------------------------------------
// ItineraryItem: kept verbatim from the stub (task 1.17).
// citation absent -> abstention line. citation present -> source line.
// ---------------------------------------------------------------------------

function ItineraryItem({
  step,
  heading,
  description,
  verifyInstruction,
  citation,
}: {
  step: number;
  heading: string;
  description: string;
  verifyInstruction: string;
  citation?: string;
}) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '2rem 1fr',
        gap: '0 0.75rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Step number */}
      <span
        aria-hidden="true"
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--color-muted)',
          paddingTop: '2px',
        }}
      >
        {String(step).padStart(2, '0')}
      </span>

      <div>
        <p
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-fg)',
            margin: '0 0 0.25rem',
          }}
        >
          {heading}
        </p>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--color-muted)',
            margin: '0 0 0.5rem',
            lineHeight: '1.6',
          }}
        >
          {description}
        </p>
        {/* Verification instruction: how to check the claim independently */}
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-muted)',
            margin: 0,
            borderLeft: '2px solid var(--color-border)',
            paddingLeft: '0.6rem',
            lineHeight: '1.5',
          }}
        >
          <span style={{ fontWeight: 600 }}>Verify: </span>
          {verifyInstruction}
        </p>
        {citation ? (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--color-fg)',
              margin: '0.5rem 0 0',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--color-muted)' }}>
              Source:{' '}
            </span>
            {citation}
          </p>
        ) : (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--color-muted)',
              margin: '0.5rem 0 0',
            }}
          >
            Source: citation pending corpus snapshot
          </p>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Section label style (reuse globals.css tokens, no new colors)
// ---------------------------------------------------------------------------

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--color-muted)',
  margin: '0 0 1rem',
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const CORPUS_PENDING = 'PENDING_CORPUS_FREEZE';

export default function JudgePage() {
  // Receive the payload from StatusPanel so we can gate citation rendering
  // on whether corpus_amddate is a real snapshot date.
  const [payload, setPayload] = useState<StatusPayload | null>(null);

  const handleLoad = useCallback((data: StatusPayload) => {
    setPayload(data);
  }, []);

  // corpus_amddate gating: only pass a citation string when the snapshot
  // is real. Until task 1.3 lands, corpus_amddate == PENDING_CORPUS_FREEZE
  // and the abstention line renders in ItineraryItem.
  const corpusSnapshotDate =
    payload?.corpus_amddate && payload.corpus_amddate !== CORPUS_PENDING
      ? payload.corpus_amddate
      : null;

  const step1Citation = corpusSnapshotDate
    ? `GT-1 seed mission, engine run anchored ${payload?.today}. Corpus snapshot: ${corpusSnapshotDate}.`
    : undefined;

  const step2Citation = corpusSnapshotDate
    ? `Deorbit swing from /api/status. Corpus snapshot: ${corpusSnapshotDate}.`
    : undefined;

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '1.5rem 1.25rem',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1.5rem',
      }}
    >
      {/* Page title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h1
          style={{
            fontSize: '15px',
            fontWeight: 600,
            margin: 0,
            color: 'var(--color-fg)',
          }}
        >
          Judge view
        </h1>
        <span
          aria-label="Status: live"
          style={{
            fontSize: '11px',
            padding: '1px 6px',
            border: '1px solid var(--color-ok)',
            borderRadius: '3px',
            color: 'var(--color-fg)',           
           fontWeight: 500,
          }}
        >
          Live
        </span>
      </div>

      {/* Purpose statement */}
      <section
        aria-labelledby="purpose-heading"
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '1.25rem 1.5rem',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <p
          id="purpose-heading"
          style={SECTION_LABEL}
        >
          Purpose
        </p>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--color-fg)',
            margin: '0 0 0.5rem',
            lineHeight: '1.6',
          }}
        >
          Every claim on this page is reachable without logging in, without
          a key, and without running anything locally. The seeded GT-1
          mission ensures an empty state is impossible: the engine recomputes
          on every page load. The data blocks under steps 1, 2 and 5 are
          fetched live from /api/status on this page load. Step 5 prints
          who is actually answering (runtime.generation_backend), not only
          the configured model IDs.
        </p>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--color-muted)',
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          The numbered itinerary below guides a three-minute evaluation pass.
          Each step names the claim, the surface that proves it, and a
          one-line verification instruction requiring no special access.
        </p>
      </section>

      {/* Live data panel: steps 1, 2 and 5 data blocks */}
      <StatusPanel onLoad={handleLoad} />

      {/* Three-minute itinerary */}
      <section aria-labelledby="itinerary-heading">
        <p id="itinerary-heading" style={SECTION_LABEL}>
          Three-minute itinerary
        </p>

        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: '0',
          }}
        >
          <ItineraryItem
            step={1}
            heading="Headline number: violated deadline days"
            description={
              'The engine recomputes the GT-1 seed mission on every request ' +
              'and returns the worst single overrun in days among violated ' +
              "licensing nodes. This figure is the product's primary claim. " +
              'The data block above shows the live value, node count, and ' +
              'compute time.'
            }
            verifyInstruction={
              'GET /api/status (no key). Read deadline_violations_days ' +
              'from the JSON response. The value is recomputed live, not cached.'
            }
            citation={step1Citation}
          />
          <ItineraryItem
            step={2}
            heading="Deorbit compliance swing: same orbit, different verdict"
            description={
              'The same 3U at 550 km perigee can be compliant or non-compliant ' +
              'depending on where the solar cycle sits. Solar minimum produces ' +
              'the longest lifetime and the worst compliance outcome. Solar ' +
              'maximum produces the shortest lifetime and the best compliance ' +
              'outcome. The swing table above shows both verdicts.'
            }
            verifyInstruction={
              'GET /api/status. Read deorbit_swing: ' +
              'lifetimeYears_solar_min with verdict_solar_min vs ' +
              'lifetimeYears_solar_max with verdict_solar_max.'
            }
            citation={step2Citation}
          />
          <ItineraryItem
            step={3}
            heading="Eval score: citations correct, abstention traps refused"
            description={
              'The 28 regulatory questions and 6 abstention traps are scored ' +
              'by eval/runner.py. The published score in docs/FACTS.json is ' +
              'the credential-free extractive path (eval_live on the deployed ' +
              'URL, eval on committed fixtures). The 90 percent bar applies ' +
              'only when watsonx generation and Guardian actually run. Diff ' +
              'runtime.generation_backend on /api/status against the score ' +
              'you are reading. CI re-runs fixtures on every PR.'
            }
            verifyInstruction={
              'Read docs/FACTS.json eval and eval_live. GET /api/status and ' +
              'read runtime.generation_backend. CI re-runs the eval against ' +
              'committed fixtures on every PR.'
            }
          />
          <ItineraryItem
            step={4}
            heading="Solar inputs: live NOAA F10.7, NOAA envelope, Surya outlook"
            description={
              'GET /api/solar returns the live F10.7 reading from NOAA SWPC, ' +
              'the NOAA predicted-flux envelope for the mission window, and ' +
              'the Surya activity outlook. All three are labelled by source. ' +
              'The deorbit verdict uses the NOAA envelope, not the Surya ' +
              'index. If Surya is absent (cut per D7), the panel says so.'
            }
            verifyInstruction={
              'GET /api/solar (no key). Read f107_live, predicted_envelope, ' +
              'and surya_outlook (or surya_absent: true). ' +
              'Cross-check f107_live against ' +
              'services.swpc.noaa.gov/products/summary/10cm-flux.json.'
            }
          />
          <ItineraryItem
            step={5}
            heading="IBM Bob usage: modes, skills, eval MCP"
            description={
              'Five write-scoped Bob modes enforce lane ownership across ' +
              'three contributors. Four regulatory skills (Part 97, Part 5, ' +
              'NOAA CRSRA, eval bank) are loaded at authoring time. The eval ' +
              'bank is exposed to Bob as a stdio MCP tool (eval/mcp_server.py, ' +
              '.bob/mcp.json). Bob 2.0.3 switcher: Agent, Plan, Ask, plus those ' +
              'five workspace modes. The runtime block above shows who is ' +
              'answering this request. The model inventory lists configured IDs.'
            }
            verifyInstruction={
              'Read .bob/custom_modes.yaml (five modes with fileRegex scopes). ' +
              'Read docs/bob-evidence/lane-enforcement.md and run ' +
              'tests/test_bob_lane_enforcement.py. ' +
              'Read docs/bob-evidence/plan-mode-critical-path.md ' +
              '(Plan-mode session was never captured; that file is the honesty log). ' +
              'Read .bob/skills/ (four SKILL.md files). ' +
              'Read .bob/mcp.json. GET /api/status and compare models against ' +
              'runtime.generation_backend.'
            }
          />
        </ol>
      </section>

      {/* What remains unwired */}
      <section
        aria-labelledby="pending-heading"
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '1.25rem 1.5rem',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <p id="pending-heading" style={SECTION_LABEL}>
          What is not wired yet
        </p>

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  color: 'var(--color-muted)',
                  fontWeight: 600,
                  paddingBottom: '0.4rem',
                  borderBottom: '1px solid var(--color-border)',
                  paddingRight: '1rem',
                  width: '40%',
                }}
              >
                Surface
              </th>
              <th
                style={{
                  textAlign: 'left',
                  color: 'var(--color-muted)',
                  fontWeight: 600,
                  paddingBottom: '0.4rem',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                Waiting for
              </th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['Eval score panel (live)', 'Task 1.5 (eval runner), docs/FACTS.json'],
                ['Solar panel (/api/solar)', 'Task 2.8 (solar route, Surya)'],
                ['Citation panel with snapshot date', 'Task 1.3 (corpus freeze)'],
                ['Abstention screen (Q&A)', 'Task 1.6 (Guardian wiring), 2.5'],
                ['Timeline view', 'Task 2.3 (vis-timeline)'],
              ] as const
            ).map(([surface, waiting]) => (
              <tr key={surface}>
                <td
                  style={{
                    paddingTop: '0.5rem',
                    paddingRight: '1rem',
                    color: 'var(--color-fg)',
                    verticalAlign: 'top',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '0.5rem',
                  }}
                >
                  {surface}
                </td>
                <td
                  style={{
                    paddingTop: '0.5rem',
                    color: 'var(--color-muted)',
                    verticalAlign: 'top',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '0.5rem',
                  }}
                >
                  {waiting}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
