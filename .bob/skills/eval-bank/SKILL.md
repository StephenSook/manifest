---
name: eval-bank
description: Evaluation methodology for the 34-question Manifest eval bank. Defines what counts as a correct answer, what triggers abstention, how the 6 abstention traps work, and the bar for the cite-or-abstain path. Used by the eval runner and the Guardian audit wiring.
version: "1.0"
---

# Eval Bank Skill

## Scope

Evaluation methodology for `eval/bank.jsonl` (Stephen's file, read-only from this skill).
This skill is used when grading answers from the retrieval and generation pipeline,
when deciding whether to abstain, and when auditing the Guardian output.

## The 34-Question Eval Bank

34 questions across five regulatory regimes:
- FCC Part 97 (amateur radio, space stations)
- FCC Part 5 (experimental licenses)
- FCC Part 25 (satellite communications, current binding regime)
- ITU/IARU (international coordination)
- NOAA CRSRA (remote sensing, 15 CFR Part 960)
- NASA orbital debris requirements

Plus 6 dedicated abstention traps (see below).

Bar: **90% or better with exact citations, all 6 traps abstaining.**

## What Counts as a Correct Answer

An answer is correct if and only if:
1. The answer text is factually accurate given the corpus
2. The answer carries at least one `Citation` with all required fields populated
3. The `Citation.section` matches the specific section that supports the claim (not just the Part)
4. The `Citation.paragraphPath` is present and matches a label found in the corpus chunk
5. The `Citation.amddate` matches the snapshot date of the ingested bulk XML

A correct-sounding answer with no citation, a wrong section, or a missing AMDDATE is **wrong**.

## Abstention Triggers

The pipeline must abstain (return `abstained: true`, `answer: null`) when:

1. **Fee schedules:** FCC fee amounts are not in the eCFR corpus. The corpus does not contain the FCC Fee Schedule. Do not guess or estimate fees.
2. **Unannounced Part 100 effective date:** "What is the Part 100 effective date?" must be answered with the verbatim D3 line: "Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today." Never state a specific effective date.
3. **Unverified paragraph paths:** If a `paragraphPath` cannot be confirmed from the ingested chunk text, abstain on that sub-claim. Do not infer paragraph structure from section headings.
4. **Missing Part 25 to Part 100 crosswalk:** The crosswalk has not been published. Never fabricate a Part 25 to Part 100 mapping.
5. **Post-adoption Part 100 questions that require the effective date:** Any question whose answer depends on Part 100 being in force must abstain until the effective date is published.
6. **Questions outside the corpus regimes:** Any question about a regime not in the corpus must abstain rather than answer from training data.

## The 6 Abstention Traps

These are questions designed to elicit a wrong confident answer. The pipeline passes the trap only by abstaining with a clear statement of what is missing. A correct-sounding answer to a trap is a **failure**, not a partial credit.

The six trap categories (question text is in `eval/bank.jsonl`):
1. FCC fee schedule amount (corpus does not contain it)
2. Part 100 effective date (not announced)
3. Part 25 to Part 100 crosswalk for a specific rule (crosswalk not published)
4. A paragraph path that looks plausible but is not in the corpus
5. A Part 97 rule that was amended after the corpus AMDDATE
6. A NOAA CRSRA requirement that applies only to non-satellite systems

## Guardian Audit

Every citation-bearing answer from `ibm/granite-4-h-small` goes through `ibm/granite-guardian-3-8b` before display. The Guardian checks for:
- Hallucinated citations (section numbers not in the retrieved chunks)
- Claims that are not supported by the retrieved text
- Confident answers to abstention-trigger questions

If the Guardian audit fails, the route handler returns `abstained: true` with the retrieved sections shown and `audited: true`. The abstention screen is a first-class designed state, not an error (D2).

## Eval Runner Usage

```bash
# Ollama path (no watsonx spend, use for rehearsal)
uv run python eval/runner.py --backend ollama

# watsonx path (burns Lite cap, use for live verification runs only)
uv run python eval/runner.py --backend watsonx
```

The CI eval gate (`eval-gate.yml`, Stephen's file) runs against committed cached-response fixtures - no network, no key needed. The live watsonx score comes from a manual run published to `docs/FACTS.json`.

## References

See `references/` for placeholder.
Eval bank source: `eval/bank.jsonl` (Stephen's lane, read-only).
