---
name: part-97-amateur
description: FCC Part 97 amateur radio rules for small satellite missions. Covers space station licensing, frequency allocation, IARU coordination, and the 97.207(g) dual clock that governs launch-vehicle determination deadlines.
version: "1.0"
---

# Part 97 Amateur Radio - Small Satellite Skill

## Scope

FCC 47 CFR Part 97, Subpart A (General) and Subpart B (Station Operation Standards).
This skill applies when `pathway = "amateur"` in the mission input.

## Key Sections

| Section | Subject | Notes |
|---|---|---|
| 97.3(a)(40) | Space station definition | An amateur station located more than 50 km above Earth's surface |
| 97.207 | Space station rules | The primary section for satellite licensing |
| 97.207(g) | Dual clock for launch vehicles | See critical rule below |
| 97.209 | Earth stations | Ground segment requirements |
| 97.211 | Space telecommand station | Command and control |
| 97.213 | Telecommand of space stations | Operational requirements |
| 97.301 | Authorized frequency bands | Allocations by license class |
| 97.303 | Frequency sharing requirements | Interference obligations |

## Critical Rule: 97.207(g) Dual Clock

47 CFR 97.207(g) requires that before a space station is placed in operation, the licensee must:

1. Notify the IARU coordinator of the intended frequencies and orbital parameters, AND
2. Receive confirmation of coordination from the IARU

The **dual clock** means two deadlines apply simultaneously and the binding one is whichever falls earlier:
- The IARU coordination confirmation must be received
- The FCC must be notified no later than 30 days before the scheduled launch date

**Engine implementation:** `engine/interlocks/lv-determination.ts`. Both clocks are computed and the earlier deadline is binding. `isViolated` fires if the current date has passed the binding deadline without the coordination being complete.

## IARU Coordination

IARU coordination is a hard prerequisite of the FCC grant node in the dependency graph.
The coordination process typically takes 60 to 90 days from submission.
Source: NASA CubeSat 101 (2017), Section 2.8. Note: this document dates to 2017; treat durations as ESTIMATED unless confirmed against a current IARU filing.

Cite and link to `iaru.org`. The coordination request form and instruction text never enter the repo or the app (D11).

## Cite-or-Abstain Requirement

Every answer using this skill must carry a `Citation` with:
- `cfrTitle: 47`
- `part: 97`
- `section`: the exact section number
- `paragraphPath`: parsed from the `<P>` element labels in the eCFR bulk XML (not inferred from nesting)
- `amddate`: the `AMDDATE` from the corpus snapshot that contained this text
- `sourceUrl`: the govinfo.gov bulk XML URL for this snapshot

If the corpus chunk for a specific paragraph is not present, **abstain** and state exactly which paragraph is missing. Do not paraphrase or infer from adjacent text.

## Part 100 Notice

Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today. Never say Part 100 "replaced" Part 25. This skill covers Part 97 only; Part 25 and Part 100 are not in scope here.

## References

See `references/` for placeholder. Research PDFs are not committed (D10).
Primary corpus source: `corpus/chunks/` after task 1.1 completes.
