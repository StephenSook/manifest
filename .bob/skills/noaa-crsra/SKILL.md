---
name: noaa-crsra
description: NOAA Commercial Remote Sensing Regulatory Affairs licensing under 15 CFR Part 960. Applies only when the mission images the Earth. NOAA license is a hard prerequisite of the FCC grant node in the dependency graph.
version: "1.0"
---

# NOAA CRSRA Licensing Skill

## Scope

15 CFR Part 960, NOAA Commercial Remote Sensing Regulatory Affairs (CRSRA).
This skill applies **only when `imagingEarth: true`** in the mission input.
When `imagingEarth: false`, no Part 960 node appears in the graph.

## Why NOAA Comes Before FCC

The FCC will not grant a satellite license for a remote sensing mission until NOAA has issued its CRSRA license. This is enforced in engine interlock `engine/interlocks/noaa-precedes-fcc.ts` (task 1.9). The NOAA license node is a prerequisite of the FCC grant node when `imagingEarth` is true.

## Key Sections

| Section | Subject | Notes |
|---|---|---|
| 960.3 | Applicability | Who must obtain a license |
| 960.5 | License requirement | The statutory mandate |
| 960.7 | Prohibition on unlicensed operations | Enforcement hook |
| 960.9 | Application process | What to file and where |
| 960.10 | Review period | NOAA has 120 days to act |
| 960.11 | License conditions | Typical conditions imposed |
| 960.13 | Modifications | Amendments to existing license |
| 960.17 | Data policy conditions | Shutter control and foreign access |

## Review Timeline

NOAA has up to 120 days to act on a CRSRA application from the date it is deemed complete.
Source: 15 CFR 960.10. Mark as DOCUMENTED with this section citation.

This is frequently the longest single-agency review in the dependency graph for imaging missions, which is why it is a critical path predecessor of the FCC grant.

## Shutter Control

NOAA imposes shutter control conditions on imaging satellites. These are license conditions under 960.11 and 960.17. The product does not need to render the full shutter control regime, but the citation panel must note that conditions apply and point to 960.11.

## Cite-or-Abstain Requirement

Every answer using this skill must carry a `Citation` with:
- `cfrTitle: 15`
- `part: 960`
- `section`: the exact section number
- `paragraphPath`: parsed from the `<P>` element labels in the eCFR bulk XML
- `amddate`: the `AMDDATE` from the Part 960 corpus snapshot
- `sourceUrl`: the govinfo.gov bulk XML URL

If the corpus chunk for a specific paragraph is not present, **abstain** and state exactly which paragraph is missing. Do not infer NOAA license conditions from Part 25 or Part 97 text.

## References

See `references/` for placeholder. Research PDFs are not committed (D10).
Primary corpus source: `corpus/chunks/` after task 1.1 completes (Title 15 Part 960).
