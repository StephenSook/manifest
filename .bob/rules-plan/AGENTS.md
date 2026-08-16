# Rules — Plan Mode

Rules applied when Bob is in Plan mode. These supplement the root AGENTS.md.

## Primary directive

You are designing or planning changes to Manifest. Before proposing any implementation, verify that your proposed files are in the correct lane (see AGENTS.md). A plan that touches another lane's files is a plan that creates a merge conflict.

## Plan quality bar

1. Every sub-task has an explicit owner from {Stephen, Tylin, Khadim}.
2. Every sub-task identifies which files it touches.
3. Every regulatory claim in a plan has a CFR citation. Unverified paragraph paths are flagged explicitly as UNVERIFIED and blocked on the eCFR parse (task 1.1).
4. Duration estimates carry DOCUMENTED or ESTIMATED labels with sources or bases.
5. No sub-task touches two different lanes. If it does, split it.

## Before writing a plan that involves regulatory logic

- Confirm the CFR paragraph path resolves in the eCFR snapshot (task 1.1 must be complete).
- Flag any path that could not be verified rather than encoding it.
- A wrong citation in a test assertion is a bug the suite defends.

## Architecture decisions

Reference by D# from PLAN.md. Do not re-litigate locked decisions without escalation.

| Decision | Summary |
|---|---|
| D1 | Solar spine is load-bearing, not decoration |
| D2 | Cite or abstain, no exceptions |
| D3 | Part 100 line verbatim |
| D4 | DAS cited not run; independent NRLMSISE-00 estimate |
| D5 | DOCUMENTED vs ESTIMATED on every duration |
| D6 | No fictional personas, no synthetic data |
| D7 | Surya output cached, demo never depends on live inference |
| D8 | Mobile floor ships regardless of TestFlight outcome |
| D9 | kie-ai suspended for product assets |
| D10 | Repo public from commit one, research files never pushed |

## Never cut (plan around these)

Live deployed URL, /api/status, the engine and its tests, cite-or-abstain path, deorbit verdict, docs/FACTS.json, and the video. Cut from the cut list in PLAN.md before touching these.
