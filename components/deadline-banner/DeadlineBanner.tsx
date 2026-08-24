'use client';

// components/deadline-banner/DeadlineBanner.tsx
// Task 2.9: primary alert surface for compliance status.
//
// Props are explicit -- today and projectStart are never derived from
// new Date() inside this component. The caller controls the date so tests
// can pin it (task 3.9) and so SSR and client renders agree.
//
// Four states with distinct treatments: VIOLATED, AT_RISK, OK, ABSTAIN.
// ABSTAIN is a first-class designed state, not an error.
//
// Every state pairs its indicator color with a text label. Never color alone.
// Status colors used: --color-violated, --color-at-risk, --color-ok only.
// --color-accent is not used here (reserved for focus / nav / selection).
//
// No notification permissions, no service worker, no network calls.

import { buildGraph } from '@/engine/graph';
import { computeCriticalPath } from '@/engine/critical-path';
import type { MissionInput, Verdict } from '@/engine/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeadlineBannerProps {
  mission: MissionInput;
  /** ISO date string for "today". Never call new Date() here -- the caller
   *  injects this so tests can pin it and SSR/client renders agree. */
  today: string;
  /** ISO date string for when project planning starts (the forward-pass anchor). */
  projectStart: string;
}

// ---------------------------------------------------------------------------
// Verdict rank for picking the "worst" across all nodes
// ---------------------------------------------------------------------------

const VERDICT_RANK: Record<Verdict, number> = {
  VIOLATED: 3,
  AT_RISK: 2,
  OK: 1,
  ABSTAIN: 0,
};

// ---------------------------------------------------------------------------
// Per-verdict presentation: all pairs color + text label together.
// The color token is used for the left border and the badge background.
// The text label is always rendered alongside it -- never color alone.
// ---------------------------------------------------------------------------

const STATE_CONFIG: Record<
  Verdict,
  {
    token: string;      // CSS custom-property reference
    badge: string;      // Short text label inside the colored badge
    borderOpacity: string; // left-border color (same token, full opacity)
  }
> = {
  VIOLATED: {
    token: 'var(--color-violated)',
    badge: 'VIOLATED',
    borderOpacity: 'var(--color-violated)',
  },
  AT_RISK: {
    token: 'var(--color-at-risk)',
    badge: 'AT RISK',
    borderOpacity: 'var(--color-at-risk)',
  },
  OK: {
    token: 'var(--color-ok)',
    badge: 'OK',
    borderOpacity: 'var(--color-ok)',
  },
  ABSTAIN: {
    token: 'var(--color-muted)',
    badge: 'ABSTAIN',
    borderOpacity: 'var(--color-border)',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeadlineBanner({ mission, today, projectStart }: DeadlineBannerProps) {
  // Run the engine. Both calls are pure and synchronous.
  const { nodes, edges } = buildGraph(mission);
  const result = computeCriticalPath(
    nodes,
    edges,
    mission.deliveryDate,
    projectStart,
    today,
  );

  // Find the worst verdict across all nodes and the node that drives it.
  // When two nodes share the worst verdict, prefer the one with the most
  // negative float (deepest overrun).
  let worstVerdict: Verdict = 'OK';
  let worstNodeLabel = '';
  let worstNodeFloat: number | null = null;

  for (const node of result.nodes.values()) {
    const rank = VERDICT_RANK[node.verdict];
    const currentRank = VERDICT_RANK[worstVerdict];

    if (rank > currentRank) {
      worstVerdict = node.verdict;
      worstNodeLabel = node.label;
      worstNodeFloat = node.float;
    } else if (
      rank === currentRank &&
      worstNodeFloat !== null &&
      node.float !== null &&
      node.float < worstNodeFloat
    ) {
      worstNodeLabel = node.label;
      worstNodeFloat = node.float;
    }
  }

  const cfg = STATE_CONFIG[worstVerdict];

  // Days overrun (positive integer) for VIOLATED headline
  const overrunDays =
    worstVerdict === 'VIOLATED' && result.totalViolatedDays > 0
      ? result.totalViolatedDays
      : null;

  // Delivery date formatted for display (ISO string, kept mono)
  const deliveryDisplay = mission.deliveryDate;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Compliance status: ${cfg.badge}`}
      style={{
        borderLeft: `3px solid ${cfg.borderOpacity}`,
        backgroundColor: 'var(--color-surface)',
        padding: '0.85rem 1.1rem',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '0 0.9rem',
        alignItems: 'start',
        marginBottom: '1rem',
      }}
    >
      {/* Left column: colored badge -- text label paired with color */}
      <div
        aria-hidden="true"
        style={{
          backgroundColor: cfg.token,
          color: 'var(--color-bg)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          padding: '2px 6px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
          marginTop: '1px',
          // For ABSTAIN use fg-on-surface contrast instead of bg-on-color
          ...(worstVerdict === 'ABSTAIN'
            ? {
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-muted)',
              }
            : {}),
        }}
      >
        {cfg.badge}
      </div>

      {/* Right column: headline + detail */}
      <div>
        {/* Screen-reader-accessible label repeats the badge text inline */}
        <p
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-fg)',
            margin: '0 0 0.2rem',
          }}
        >
          <span className="sr-only">{cfg.badge}: </span>
          {headlineText(worstVerdict, worstNodeLabel, overrunDays)}
        </p>

        {/* Detail line */}
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-muted)',
            margin: 0,
            lineHeight: '1.5',
          }}
        >
          {detailText(
            worstVerdict,
            worstNodeLabel,
            worstNodeFloat,
            deliveryDisplay,
            result.totalViolatedDays,
          )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy helpers: plain language, no regulatory section numbers hardcoded.
// Node labels and float values come from the engine.
// ---------------------------------------------------------------------------

function headlineText(
  verdict: Verdict,
  drivingLabel: string,
  overrunDays: number | null,
): string {
  switch (verdict) {
    case 'VIOLATED':
      return overrunDays !== null && overrunDays > 0
        ? `${overrunDays} days of violated deadline across the critical path`
        : `Deadline violated: ${drivingLabel}`;
    case 'AT_RISK':
      return `On the critical path with no float: ${drivingLabel}`;
    case 'OK':
      return 'All milestones within schedule bounds';
    case 'ABSTAIN':
      return 'Schedule cannot be computed without a delivery date';
  }
}

function detailText(
  verdict: Verdict,
  drivingLabel: string,
  drivingFloat: number | null,
  deliveryDisplay: string,
  totalViolatedDays: number,
): string {
  switch (verdict) {
    case 'VIOLATED': {
      const days = drivingFloat !== null ? Math.abs(drivingFloat) : 0;
      return (
        `The binding node is "${drivingLabel}" (${days} day${days !== 1 ? 's' : ''} past feasible). ` +
        `Delivery wall: ${deliveryDisplay}. ` +
        `Total violated days across all nodes: ${totalViolatedDays}.`
      );
    }
    case 'AT_RISK':
      return (
        `"${drivingLabel}" has zero float. Any slip here pushes the delivery date. ` +
        `Delivery wall: ${deliveryDisplay}.`
      );
    case 'OK':
      return `Delivery wall: ${deliveryDisplay}. Float exists on all milestone nodes.`;
    case 'ABSTAIN':
      return (
        'Set a delivery date and project start to compute the schedule. ' +
        'No regulatory status can be determined without a timeline.'
      );
  }
}
