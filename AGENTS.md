# AGENTS.md, Manifest

Operating rules for any AI agent (Bob, Claude CLI, Codex, or other) working in this repository.

> The primary dev tool is IBM Bob 2.0.3. The constraints here are mirrored in `.bob/rules-*/AGENTS.md` and `.bob/skills/`. This file is the fallback for agents that do not load Bob config directly.

---

## Hard rules (no exceptions)

1. **Cite or abstain.** No regulatory statement ships without a section-level citation (example: 47 CFR 97.207(g)(1)) pinned to the ingested snapshot AMDDATE. If the corpus cannot support an answer, say exactly what is missing. Abstention is a feature.
2. **No em-dashes.** Not in code, comments, commit messages, doc strings, product copy, or docs. Use a colon for elaboration, a comma or parentheses for an aside, a period for a clause break, a hyphen for a range.
3. **Documented vs estimated.** Every duration in the graph carries DOCUMENTED (with source) or ESTIMATED (with basis). Never present folklore as fact.
4. **No synthetic load-bearing data.** Sample missions use real public mission data with real dates where recoverable and clearly labelled estimates where not. Nothing invented.
5. **The Part 100 line, verbatim.** "Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today." Never say Part 100 "replaced" Part 25.
6. **Numbers from FACTS.json only.** Every figure in README.md, docs/, and the video script comes from `docs/FACTS.json`, written by `scripts/facts.py` from a real engine run. Run the script before writing any number. The anti-fabrication test checks digits AND spelled-out numerals.
7. **Stage named paths only.** Never `git add -A`. Verify `git ls-files | grep -i '\.pdf$'` returns zero before any push.
8. **No PII.** No names, emails, or institutions in the repo without explicit per-surface consent.

---

## Lane ownership (zero-collision)

| Owner | Files |
|---|---|
| **Stephen** | `engine/**`, `eval/**`, `services/**`, `pipeline/decay.py`, `pipeline/surya_infer.py`, `pipeline/tests/test_decay.py`, `mobile/**`, `android/**`, `ios/**`, `capacitor.config.ts`, `next.config.mobile.ts`, `data/**`, `app/api/status/**`, `app/api/solar/**`, `scripts/**`, `tests/**` (not `tests/e2e/`), `docs/**` (not `docs/architecture.svg`, not `docs/bob-evidence/**`), `PLAN.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `.bob/**` (not `.bob/skills/`), `LICENSE`, `.github/workflows/eval-gate.yml` |
| **Tylin** | `pipeline/**` (except Stephen's 3 files), `corpus/**`, `app/api/ask/**`, `app/api/push/**`, `.github/workflows/**` (except `eval-gate.yml`), `.bob/skills/**`, `.gitleaksignore`, `.gitignore` |
| **Khadim** | `app/**` (except `api/`), `components/**`, `lib/**`, `public/**`, `sw.ts`, `tests/e2e/**`, `docs/architecture.svg`, `docs/bob-evidence/**`, `.env.example`, `.vercel/**` |

If a file you need is in another person's lane, write the requirement in PLAN.md Open Questions and ping. Do not edit.

---

## Commit discipline

- Format: `type(scope): description` (no em-dash anywhere)
- Status-only PLAN.md changes: `status: [task #] [emoji] [description]`
- Contract changes: `WARNING CONTRACT: [field], [reason]`
- Atomic commits. Never bundle a status change with code.
- One logical change per commit.

---

## CI rules (non-negotiable)

1. Every gate runs BARE. No pipe on the exit path.
2. A conditionally skipped test is a false green. Guards must FAIL under CI, never skip.
3. Guards resolve their file set with `git ls-files --cached --others --exclude-standard`.
4. Never trust a `--watch` exit code. Read `gh api` check-runs and require `success`.
5. Watch the post-merge run on `main`, on the merged SHA.
6. Verify what a commit CONTAINS, not that it succeeded.
7. Content-check, never status-code-check. A warm instance that lost its corpus still returns 200.

---

## What Manifest is NOT

Not a chatbot about space law, a form filler, a legal advice tool, or a conformance scorer.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes, APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
