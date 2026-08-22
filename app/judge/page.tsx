// app/judge/page.tsx
// Judge view: three-minute itinerary for evaluators.
// Task 3.3 wires the live content: live eval score, live engine run, live
// solar verdict, all recomputed on load with no key required.
//
// This stub renders a designed empty state that explains what each section
// will contain and how to verify each claim without credentials.
//
// Server component. No interactive client components are mounted here yet.
// The graph and solar panels that will live here mount as client components
// (tasks 2.2, 2.7) to avoid SSR sizing issues.
//
// Regulatory citations are never hardcoded. Every claim flows through a
// citation prop once the corpus is wired (task 2.4).

// Itinerary item: describes one beat the judge will step through.
// Citation values arrive from the corpus snapshot in task 3.3. Until then
// the abstention branch renders. No unpinned CFR section ships on this page.
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

export default function JudgePage() {
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
          Judge view
        </h1>
        {/* State badge: text label + border, never color alone */}
        <span
          aria-label="Status: itinerary not yet wired"
          style={{
            fontSize: '11px',
            padding: '1px 6px',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            color: 'var(--color-muted)',
            fontWeight: 500,
          }}
        >
          Itinerary wires in task 3.3
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
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            margin: '0 0 0.5rem',
          }}
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
          This page is the judge's door. Every claim it makes is reachable
          without logging in, without a key, and without running anything
          locally. The seeded GT-1 mission ensures an empty state is
          impossible: the engine recomputes on every page load.
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
          Each step names the claim, names the surface that proves it, and
          gives a one-line verification instruction that requires no special
          access. Steps 1 through 5 will be wired in task 3.3.
        </p>
      </section>

      {/* Three-minute itinerary */}
      <section aria-labelledby="itinerary-heading">
        <p
          id="itinerary-heading"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            margin: '0 0 1rem',
          }}
        >
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
              'licensing nodes. This figure is the product\'s primary claim.'
            }
            verifyInstruction={
              'GET /api/status (no key). Read deadline_violations_days ' +
              'from the JSON response. The value is recomputed live, not cached.'
            }
          />
          <ItineraryItem
            step={2}
            heading="Deorbit compliance swing: same orbit, different verdict"
            description={
              'The deorbit compliance node is the core differentiator. ' +
              'The same 3U at 550 km can be compliant or non-compliant ' +
              'depending on where the solar cycle sits. The swing between ' +
              'the NOAA solar-minimum and solar-maximum bounds is reported.'
            }
            verifyInstruction={
              'GET /api/status. Read deorbit_swing: ' +
              'verdict_solar_min vs verdict_solar_max. ' +
              'The lifetime estimates and the F10.7 value that produced ' +
              'the nominal verdict are shown beside them.'
            }
          />
          <ItineraryItem
            step={3}
            heading="Eval score: citations correct, abstention traps refused"
            description={
              'The corpus retrieval and Granite generation pipeline is ' +
              'scored against 34 questions (28 regulatory, 6 abstention ' +
              'traps). The score and the trap result are both reported ' +
              'here when task 3.3 wires the live eval panel.'
            }
            verifyInstruction={
              'The eval score is written to docs/FACTS.json by a real run ' +
              'of eval/runner.py. Read the score from FACTS.json. ' +
              'CI re-runs the eval against committed fixtures on every PR.'
            }
          />
          <ItineraryItem
            step={4}
            heading="Solar verdict: live NOAA F10.7 plus Surya outlook"
            description={
              'GET /api/solar returns the live F10.7 reading from NOAA SWPC, ' +
              'the NOAA predicted-flux envelope for the mission window, and ' +
              'the Surya activity outlook. All three are labelled by source. ' +
              'If Surya is absent (cut per D7), the panel says so.'
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
              'bank is exposed as an MCP tool via IBM Context Forge (task 3.2).'
            }
            verifyInstruction={
              'Read .bob/custom_modes.yaml (five modes with fileRegex scopes). ' +
              'Read .bob/skills/ (four SKILL.md files). ' +
              'Read docs/bob-evidence/ for Bobalytics screenshots and ' +
              'the Orchestrator run transcript.'
            }
          />
        </ol>
      </section>

      {/* What is empty and why */}
      <section
        aria-labelledby="empty-state-heading"
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '1.25rem 1.5rem',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <p
          id="empty-state-heading"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            margin: '0 0 0.75rem',
          }}
        >
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
            {[
              ['Live eval score panel', 'Task 3.3 (judge page wiring)'],
              ['Dependency graph view', 'Task 1.14 (React Flow + dagre), 2.2'],
              ['Timeline view', 'Task 2.3 (vis-timeline client component)'],
              ['Deorbit swing panel', 'Task 2.7 (deorbit panel component)'],
              ['Citation panel', 'Task 1.3 (corpus freeze), 2.4'],
              ['Abstention screen', 'Task 1.6 (Guardian audit wiring), 2.5'],
              ['Mission setup form', 'Task 2.1 (mission entry flow)'],
              ['Deadline banner', 'Task 2.9 (deadline banner component)'],
            ].map(([surface, waiting]) => (
              <tr key={surface}>
                <td
                  style={{
                    paddingTop: '0.5rem',
                    paddingRight: '1rem',
                    color: 'var(--color-fg)',
                    verticalAlign: 'top',
                  }}
                >
                  {surface}
                </td>
                <td
                  style={{
                    paddingTop: '0.5rem',
                    color: 'var(--color-muted)',
                    verticalAlign: 'top',
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
