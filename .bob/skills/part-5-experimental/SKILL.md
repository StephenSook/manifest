---
name: part-5-experimental
description: FCC Part 5 experimental radio license rules. Covers the experimental pathway as an alternative to Part 97 for non-amateur frequencies or missions that need frequencies outside the amateur allocations.
version: "1.0"
---

# Part 5 Experimental Radio License Skill

## Scope

FCC 47 CFR Part 5, Subpart A (General) through Subpart E (Special Conditions).
This skill applies when `pathway = "experimental"` in the mission input, or when the mission uses frequencies that fall outside Part 97 amateur allocations.

## When Part 5 Applies Instead of Part 97

- The satellite uses frequencies not allocated to the amateur service
- The mission needs more flexible power or modulation than Part 97 allows
- The operator is not a licensed amateur radio operator
- The mission requires coordination with a non-amateur ground network

Part 5 and Part 97 are mutually exclusive pathways. The engine's `regime.ts` flag controls which set of nodes is active in the dependency graph.

## Key Sections

| Section | Subject | Notes |
|---|---|---|
| 5.51 | Application requirements | What must be filed |
| 5.53 | License term | Typically 2 years, renewable |
| 5.57 | Operating conditions | Restrictions on experimental licenses |
| 5.61 | License conditions | What the FCC can impose |
| 5.63 | Modifications | How to amend an existing license |
| 5.67 | Discontinuance | End of operations reporting |
| 5.85 | Frequency coordination | Required for certain bands |

## Key Difference from Part 97

Part 5 experimental licenses:
- Do not require IARU coordination (no amateur service involvement)
- Have a shorter standard license term (2 years vs. 10 years for Part 97 space stations)
- Require FCC approval for any frequency change (amendments, not waivers)
- Are not transferable

The IARU coordination prerequisite node in the dependency graph is absent when `pathway = "experimental"`. The engine interlock for 97.207(g) does not apply.

## Cite-or-Abstain Requirement

Every answer using this skill must carry a `Citation` with:
- `cfrTitle: 47`
- `part: 5`
- `section`: the exact section number
- `paragraphPath`: parsed from the `<P>` element labels in the eCFR bulk XML
- `amddate`: the `AMDDATE` from the corpus snapshot
- `sourceUrl`: the govinfo.gov bulk XML URL

If the corpus chunk for a specific paragraph is not present, **abstain** and state exactly which paragraph is missing.

## Part 100 Notice

Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today. Part 5 is unaffected by Part 100.

## References

See `references/` for placeholder. Research PDFs are not committed (D10).
Primary corpus source: `corpus/chunks/` after task 1.1 completes.
