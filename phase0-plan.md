# Phase 0 Implementation Plan: Tylin's Tasks

Source of truth for task numbering and requirements: PLAN.md.
This plan covers tasks 0.5, 0.9, 0.10, and 0.13 in dependency order.

## Overview

Four scaffold tasks that must be complete before any Phase 1 work begins.
No task here depends on Khadim's Next.js scaffold (0.8) or Stephen's engine work.
All four are self-contained in Tylin's lane.

Dependency order within this plan:

```
0.9 (Python venv) --> 0.13 (watsonx smoke)
0.9 (Python venv) --> 0.10 (CI skeleton, needs python for em-dash gate)
0.5 (Bob skills)  --> (standalone, no code deps)
```

---

## Task 1: 0.9 - Python 3.12 venv

**Status:** [ ] pending

### Intent

The system Python is 3.14.6. Docling (used in Phase 1 task 1.2) does not support 3.14.
Pin a 3.12 venv with `uv` so every pipeline command uses the right interpreter.
This is the foundation every other Python task in the project builds on.

### Expected Outcomes

- `pipeline/pyproject.toml` exists and declares Python `>=3.12,<3.13` as the required version
- `.python-version` at repo root contains `3.12`
- `uv sync` inside `pipeline/` (or from root with the right config) creates a `.venv` at 3.12
- `uv run --python 3.12 python --version` prints `Python 3.12.x`
- `.venv/` is covered by the existing `.gitignore` entry (already present)

### Todo List

1. Create `pipeline/pyproject.toml` with:
   - `[project]` table: `name = "manifest-pipeline"`, `requires-python = ">=3.12,<3.13"`, `version = "0.1.0"`
   - `[project.dependencies]` section: leave empty for now, Phase 1 tasks add their own deps
   - `[build-system]` table pointing to `hatchling` (uv default)
   - `[tool.uv]` section if needed to set the python pin
2. Create `.python-version` at repo root containing the single line `3.12`
3. Run `uv sync --python 3.12` from `pipeline/` to verify the environment resolves
4. Verify `uv run --python 3.12 python --version` outputs `Python 3.12.x`
5. Confirm `.venv/` is ignored by `.gitignore` (already present, just verify)
6. Stage `pipeline/pyproject.toml` and `.python-version`, commit: `chore(pipeline): pin Python 3.12 with uv`

### Relevant Context

- `.gitignore` already contains `.venv/` and `venv/` entries
- `pipeline/` currently has only `decay.py`, `surya_infer.py`, and `tests/` (all Stephen's files)
- PLAN.md note: "System python3 is 3.14.6 and Docling will not support it."
- uv is already installed and in PATH (confirmed in local toolchain table)

---

## Task 2: 0.13 - watsonx smoke test

**Status:** [ ] pending

### Intent

Confirm the three exact model IDs that PLAN.md corrected from the research pack actually
respond in our watsonx region before Phase 1 builds on them. A wrong model ID fails at
runtime and blocks 1.6, 2.6, and the eval.

The three IDs to verify:
- `ibm/granite-4-h-small` (generation)
- `ibm/granite-guardian-3-8b` (Guardian audit)
- `ibm/granite-embedding-278m-multilingual` (embeddings)

### Expected Outcomes

- `pipeline/scripts/watsonx_smoke.py` exists and is runnable with `uv run --python 3.12 python pipeline/scripts/watsonx_smoke.py`
- Script exits 0 if all three model IDs return HTTP 200 from the watsonx endpoint
- Script exits non-zero and prints which IDs failed if any do not respond
- The watsonx region is recorded in a comment at the top of the file (not hardcoded as a secret)
- Credentials are read from environment variables only: `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_REGION`
- PLAN.md Q2 cell is updated with the token limit findings and budget calculation

### Todo List

1. Create `pipeline/scripts/__init__.py` (empty, makes it a proper package)
2. Create `pipeline/scripts/watsonx_smoke.py`:
   - Read `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_REGION` from env; fail fast with a clear message if any are missing
   - Add `ibm-watsonx-ai` to `pipeline/pyproject.toml` dependencies
   - Run `uv sync --python 3.12` to install
   - For each of the three model IDs: send a minimal text-generation or embedding request and assert HTTP 200
   - Print pass/fail per model ID and the region that responded
   - Exit 0 only if all three pass
3. Run the script locally with real credentials: `WATSONX_API_KEY=... uv run --python 3.12 python pipeline/scripts/watsonx_smoke.py`
4. Record in PLAN.md Q2: the responding region, the token cost of one eval run (34 items x retrieval + generation + guardian), and the resulting monthly cap budget
5. Commit: `feat(pipeline): watsonx smoke test, three model IDs verified`

### Relevant Context

- Credentials are never committed. They live in shell env or a local `.env` file that is already gitignored.
- PLAN.md Open Questions Q2 is explicitly Tylin's and is due by Aug 17
- Model IDs from PLAN.md corrections table (verified 2026-08-15): `ibm/granite-4-h-small`, `ibm/granite-guardian-3-8b`, `ibm/granite-embedding-278m-multilingual`
- `ibm-watsonx-ai` is the official Python SDK for watsonx.ai

---

## Task 3: 0.10 - CI skeleton

**Status:** [ ] pending

### Intent

Every subsequent PR must be gated by lint, typecheck, build, gitleaks, and the em-dash
hard rule before it merges. The CI skeleton must be in place before Phase 1 code lands.
It must follow CI rules from PLAN.md exactly: every gate runs BARE (no pipe on exit path),
guards resolve files with `git ls-files --cached --others --exclude-standard`, and a
skipped test is a hard failure.

### Expected Outcomes

- `.github/workflows/ci.yml` exists and triggers on `push` and `pull_request` to `main`
- Six named jobs run: `lint`, `typecheck`, `test-engine`, `build`, `gitleaks`, `em-dash`
- Every job exit path is bare (no `| tee`, no `| tail`)
- `scripts/no_em_dash.py` exists, resolves files via `git ls-files --cached --others --exclude-standard`, and exits non-zero on any em-dash found
- The em-dash gate is a required status check (enforced via the workflow, not a branch protection rule that is Tylin's to configure)
- The workflow does NOT include the eval gate (that is Stephen's separate `eval-gate.yml`)

### Todo List

1. Create `.github/workflows/ci.yml` with jobs in this order:
   - **lint**: `npm ci && npm run lint`
   - **typecheck**: `npm ci && npm run typecheck`
   - **test-engine**: `npm ci && npm run test:engine`
   - **build**: `npm ci && npm run build`
   - **gitleaks**: use the `gitleaks/gitleaks-action` action (v2); scan full history; no pipe on exit
   - **em-dash**: `uv run --python 3.12 python scripts/no_em_dash.py --check`; fail hard if any em-dash found; assert N > 0 files scanned
   - Every job runs BARE: no `| tee`, no `| grep`, no `|| true` on any step that is a gate
   - Node version: `22.x` (matches local toolchain, `node v22.22.2`)
   - Python: set up via `astral-sh/setup-uv` action

2. Create `scripts/no_em_dash.py`:
   - Resolve file list with `git ls-files --cached --others --exclude-standard`
   - Filter to text files (`.md`, `.ts`, `.tsx`, `.py`, `.json`, `.yaml`, `.yml`, `.txt`)
   - Scan each file for U+2014 (em-dash) and the double-hyphen `--` pattern only when it appears in prose contexts (skip `--noEmit` and similar CLI flags)
   - Report each violation with filename and line number
   - Print total files scanned (must be > 0 or exit non-zero with a clear message)
   - Exit 0 only if zero violations found

3. Add `.gitleaksignore` as an empty file (required by gitleaks-action even if empty; real entries added in task 3.8)

4. Run `npm run lint`, `npm run typecheck`, `npm run test:engine` locally to confirm they all pass on the current codebase before pushing the workflow

5. Commit `scripts/no_em_dash.py` and `.gitleaksignore` first: `chore(ci): em-dash checker and gitleaks ignore stub`
6. Commit `.github/workflows/ci.yml`: `feat(ci): CI skeleton - lint typecheck test build gitleaks em-dash`

### Relevant Context

- `package.json` scripts already have `lint`, `typecheck`, `test:engine`, `build`, `test:e2e`
- `.gitignore` already exists; `.gitleaksignore` does not
- PLAN.md CI rules: every gate BARE, guards use `git ls-files --cached --others --exclude-standard`, a skipped test is a false green, no pipe on exit path
- The eval gate is Stephen's file (`eval-gate.yml`) and must not appear in `ci.yml`
- The `no_em_dash.py` script lives in `scripts/` which is Stephen's lane, BUT it is called from Tylin's CI workflow. Stephen owns the file itself; Tylin calls it. Coordinate: either ask Stephen to commit the script first, or add it here and note it as a cross-lane handshake (the file touches neither lane's data, it is a utility). Check PLAN.md Open Questions before touching `scripts/`.

> LANE NOTE: `scripts/` is Stephen's lane. `no_em_dash.py` is a pure utility with no lane data. Commit it yourself with the message `chore(ci): em-dash checker [cross-lane touch, coordinating with Stephen]` and ping Stephen immediately after so he is aware and can take ownership if needed.

---

## Task 4: 0.5 - Bob skills

**Status:** [ ] pending

### Intent

Four Bob skills are a judging deliverable, not just tooling. They demonstrate IBM Bob usage
depth (judges score "How IBM Bob was used"). Each skill encodes regulatory regime context
so Bob operates with domain-specific knowledge rather than generic LLM behavior.
The `eval-bank` skill is also used by Stephen's eval runner via the eval MCP server.

The four skills:
- `part-97-amateur`: FCC Part 97 amateur radio rules for small satellites
- `part-5-experimental`: FCC Part 5 experimental license rules
- `noaa-crsra`: NOAA CRSRA licensing for imaging missions
- `eval-bank`: evaluation methodology, abstention criteria, and citation standards

### Expected Outcomes

- `.bob/skills/part-97-amateur/SKILL.md` exists
- `.bob/skills/part-5-experimental/SKILL.md` exists
- `.bob/skills/noaa-crsra/SKILL.md` exists
- `.bob/skills/eval-bank/SKILL.md` exists
- Each skill directory contains a `references/` subdirectory
- Each skill name matches `^[a-z0-9]+(-[a-z0-9]+)*$` (PLAN.md Bob setup requirement)
- Each skill SKILL.md contains the regulatory scope, key CFR citations, cite-or-abstain reminder, and pointers to where in the corpus the supporting chunks will land

### Todo List

1. Create `.bob/skills/part-97-amateur/SKILL.md`:
   - Scope: FCC 47 CFR Part 97, amateur radio, space stations
   - Key sections: 97.207 (space stations), 97.209 (Earth stations), 97.301 (frequency allocations)
   - Critical rule: 97.207(g) dual clock for launch vehicles - coordination deadline vs. 30-day pre-launch deadline, whichever is earlier
   - Cite-or-abstain: never state a frequency, power, or coordination requirement without a section citation pinned to the corpus AMDDATE
   - Note: IARU coordination is a prerequisite enforced in the engine graph
   - `references/` subdirectory created (empty; real PDF excerpts not committed per D10)

2. Create `.bob/skills/part-5-experimental/SKILL.md`:
   - Scope: FCC 47 CFR Part 5, experimental radio licenses
   - Key sections: 5.51 (application), 5.61 (license conditions), 5.63 (modifications)
   - Covers the experimental pathway as an alternative to Part 97 for non-amateur frequencies
   - Cite-or-abstain: same AMDDATE requirement
   - `references/` subdirectory created

3. Create `.bob/skills/noaa-crsra/SKILL.md`:
   - Scope: 15 CFR Part 960, NOAA Commercial Remote Sensing Regulatory Affairs
   - Key sections: 960.5 (license requirement), 960.9 (application), 960.11 (license conditions)
   - Only applies when `imagingEarth: true` in MissionInput
   - NOAA license is a prerequisite of FCC grant (enforced in engine interlock 1.9)
   - Cite-or-abstain: AMDDATE from the Part 960 corpus snapshot
   - `references/` subdirectory created

4. Create `.bob/skills/eval-bank/SKILL.md`:
   - Scope: evaluation methodology for the 34-question eval bank
   - Defines: what counts as a correct citation (section + AMDDATE required), what triggers abstention (unverified paragraph path, unannounced Part 100 effective date, fee schedules not in corpus), how the 6 abstention traps work
   - References the eval bank at `eval/bank.jsonl` (Stephen's file, read-only from this skill)
   - Bar: 90% exact citations, 6/6 traps abstaining
   - `references/` subdirectory created

5. Commit: `feat(skills): four Bob skills - part-97-amateur part-5-experimental noaa-crsra eval-bank`

### Relevant Context

- `.bob/skills/` does not exist yet; this task creates it
- `.bob/` is committed (per PLAN.md Bob setup: "`.bob/` is never gitignored")
- Skill directory names must match `^[a-z0-9]+(-[a-z0-9]+)*$` per PLAN.md
- PLAN.md Bob setup table: `.bob/skills/<name>/SKILL.md` is the workspace skill path
- Global skills live in `~/.bob/skills/` (not this repo); these are project-specific
- D10: research PDFs never committed; `references/` folders are placeholders for excerpts only
- `eval/bank.jsonl` is Stephen's file; skill can reference it by path but never edit it

---

## Commit Order Summary

1. `chore(pipeline): pin Python 3.12 with uv` (task 0.9)
2. `feat(pipeline): watsonx smoke test, three model IDs verified` (task 0.13)
3. `feat(skills): four Bob skills - part-97-amateur part-5-experimental noaa-crsra eval-bank` (task 0.5)
4. `chore(ci): em-dash checker [cross-lane touch, coordinating with Stephen]` (task 0.10, `scripts/no_em_dash.py` + `.gitleaksignore`)
5. `feat(ci): CI skeleton - lint typecheck test build gitleaks em-dash` (task 0.10, `.github/workflows/ci.yml`)

Each commit is atomic. Status changes to PLAN.md are separate commits with the
`status: [task #] emoji description` format. Never bundle.

---

## Cross-Lane Dependencies

| Dependency | What is needed | Who provides it | Action |
|---|---|---|---|
| `scripts/no_em_dash.py` | CI em-dash gate calls this file | Stephen owns `scripts/` | Write the requirement in PLAN.md Open Questions or coordinate before committing. CI workflow can reference the path and fail gracefully if absent. |
| Khadim's Next.js scaffold (0.8) | `npm run lint`, `typecheck`, `build` in CI | Khadim | Block the TS jobs in CI until 0.8 lands, or make those jobs conditional on `package.json` existing |
| `eval/bank.jsonl` | Referenced in eval-bank skill | Stephen (done, task 1.4 is marked done) | File exists, no action needed |
