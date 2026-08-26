# Plan mode: what was captured, and what was not

Task 1.13 asked for a Plan-mode transcript of the build's critical path,
plus the week-2 Bobalytics screenshot. This file is the honesty log for
that row. It is not a Plan-mode transcript.

## What this file is not

- Not a pasted Bob Plan session.
- Not a reconstruction of what Plan "would have said."
- Not a substitute critical path. The product already computes one.

Inventing a session that was never exported is the failure mode this
file exists to refuse.

## What is actually in the tree

| Artifact | Status |
|---|---|
| Plan as a Bob 2.0.3 built-in | Real. Rules live at [`.bob/rules-plan/AGENTS.md`](../../.bob/rules-plan/AGENTS.md). The switcher is Agent, Plan, Ask, plus the five workspace modes. There is no Orchestrator mode. |
| `docs/bob-evidence/bobalytics-02.png` | Committed. It is a subscription-usage screenshot, not a Plan session. |
| A Plan-mode session for the build's critical path | Never captured. A search of the local Bob logs for this workspace found no exportable Plan transcript to commit. |

## Where the critical path actually lives

The build's critical path is not a planning document. It is a function
the product runs.

- Code: [`engine/critical-path.ts`](../../engine/critical-path.ts)
- Live check, no key: `GET /api/status` and read `critical_path`
- The twelve licensing nodes that function walks are listed under
  PLAN.md task 1.7

A judge who wants the critical path should hit `/api/status`, not this
file. Plan mode's own rules (lane split, DOCUMENTED vs ESTIMATED
durations, cite-or-abstain) are already encoded in
`.bob/rules-plan/AGENTS.md` and in the engine tests. Those are
inspectable. A composed Plan chat would not add a fact they do not
already contain.

## Why the session is absent

The row was written as if a Plan-mode run would be exported into this
folder. That export never happened. Closing the row by fabricating the
missing chat would teach a judge the wrong lesson about every other
evidence path. The screenshot that landed for week 2 is usage telemetry,
and it stays labelled as that.

If a real Plan-mode export appears later, replace this file with that
export. Until then, the honest artifact is this statement of absence.
