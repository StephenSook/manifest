// app/mission/page.tsx
// Mission view: dependency graph + timeline + compliance panels.
// Task 2.1 (mission setup flow) and 2.2 (graph view) wire the live content.
// Until those land, this page renders a designed empty state that explains
// exactly what will appear and why it is empty.
//
// Server component. Graph (React Flow) and timeline (vis-timeline) are
// client components that mount later -- see tasks 1.14, 2.2, 2.3.
// They are NOT imported here yet: SSR sizing breaks both libraries and
// dynamic import with ssr:false is required. Those imports land in
// components/graph/ and components/timeline/ (tasks 1.14, 2.2, 2.3).
//
// Regulatory citations are never hardcoded here. Every claim flows through
// a citation prop once the corpus is wired (task 2.4).

// Surface dimensions used for spacing
const PANEL_STYLE: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
  padding: '1.25rem 1.5rem',
  backgroundColor: 'var(--color-surface)',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: 'var(--color-muted)',
  marginBottom: '0.5rem',
};

const EMPTY_RULE_STYLE: React.CSSProperties = {
  borderLeft: '2px solid var(--color-border)',
  paddingLeft: '0.75rem',
  color: 'var(--color-muted)',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '0',
};

export default function MissionPage() {
  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '1.5rem 1.25rem',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1.25rem',
      }}
    >
      {/* Page title + state badge */}
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
          Mission planner
        </h1>
        {/* State badge: text + shape, never color alone */}
        <span
          aria-label="Status: no mission data"
          style={{
            fontSize: '11px',
            padding: '1px 6px',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            color: 'var(--color-muted)',
            fontWeight: 500,
          }}
        >
          No mission data
        </span>
      </div>

      {/* Dependency graph panel */}
      <section aria-labelledby="graph-heading" style={PANEL_STYLE}>
        <p id="graph-heading" style={LABEL_STYLE}>
          Dependency graph
        </p>
        <p style={EMPTY_RULE_STYLE}>
          The regulatory dependency graph for your mission will appear here.
          It maps the 12 licensing milestones (IARU coordination, ITU advance
          publication, FCC application and grant, NOAA CRSRA if imaging,
          NASA debris assessment, deorbit compliance, and launch-provider
          delivery) as a directed graph, with each node showing the earliest
          feasible completion date, the float remaining before the delivery
          wall, and the compliance verdict.
        </p>
        <p
          style={{
            ...EMPTY_RULE_STYLE,
            marginTop: '0.75rem',
            borderLeftColor: 'var(--color-border)',
          }}
        >
          Waiting for: mission entry (task 2.1). The graph engine is live at
          <code
            style={{
              fontSize: '12px',
              backgroundColor: 'var(--color-bg)',
              padding: '1px 4px',
              borderRadius: '2px',
              marginLeft: '0.25rem',
            }}
          >
            /api/status
          </code>
          {' '}and returns the GT-1 seed mission on every unauthenticated
          request. The visual layer (React Flow + dagre layout) wires in
          task 1.14.
        </p>
      </section>

      {/* Timeline panel */}
      <section aria-labelledby="timeline-heading" style={PANEL_STYLE}>
        <p id="timeline-heading" style={LABEL_STYLE}>
          Schedule timeline
        </p>
        <p style={EMPTY_RULE_STYLE}>
          A Gantt-style timeline will appear here showing each milestone on
          a horizontal time axis with the critical path highlighted and
          violated deadlines marked by label. The rendering library is
          vis-timeline, mounted as a client component (task 2.3) to avoid
          SSR sizing issues.
        </p>
        <p style={{ ...EMPTY_RULE_STYLE, marginTop: '0.75rem' }}>
          Waiting for: mission entry (task 2.1) and the timeline client
          component (task 2.3).
        </p>
      </section>

      {/* Deorbit compliance panel */}
      <section aria-labelledby="deorbit-heading" style={PANEL_STYLE}>
        <p id="deorbit-heading" style={LABEL_STYLE}>
          Deorbit compliance
        </p>
        <p style={EMPTY_RULE_STYLE}>
          This panel shows the deorbit compliance verdict for your mission
          orbit: the estimated atmospheric reentry lifetime at nominal solar
          flux, at the NOAA solar-minimum bound, and at the solar-maximum
          bound. The same orbit can produce different compliance outcomes
          depending on where the solar cycle sits across the mission life.
          The solar activity outlook from the Surya model (NASA/IBM) narrows
          the near-term end of the NOAA envelope when available.
        </p>
        <p style={{ ...EMPTY_RULE_STYLE, marginTop: '0.75rem' }}>
          The compliance verdict is already computed for the GT-1 seed
          mission. Enter a mission (task 2.1) to see your orbit's verdict.
          The full panel with the swing visualization wires in task 2.7.
        </p>
      </section>

      {/* Citation panel */}
      <section aria-labelledby="citation-heading" style={PANEL_STYLE}>
        <p id="citation-heading" style={LABEL_STYLE}>
          Regulatory citations
        </p>
        <p style={EMPTY_RULE_STYLE}>
          Every compliance verdict displayed on this page carries a
          section-level citation from the ingested regulatory corpus,
          including the snapshot date the text was retrieved from. Citations
          appear in-line with the claim they support. When the retrieval
          system cannot produce a citation with sufficient confidence, the
          panel shows the retrieved sections and abstains rather than
          presenting an unsupported answer.
        </p>
        <p style={{ ...EMPTY_RULE_STYLE, marginTop: '0.75rem' }}>
          Waiting for: corpus freeze (task 1.3) and citation panel component
          (task 2.4).
        </p>
      </section>
    </div>
  );
}
