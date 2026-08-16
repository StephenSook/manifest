# Stephen's Implementation Plan — Manifest

> This plan covers ONLY Stephen's tasks from PLAN.md. Tylan and Kadeem own their lanes; do not touch those files.
> Source of truth: PLAN.md + CLAUDE.md. Any conflict between this file and PLAN.md, PLAN.md wins.
> Update status to `[x] done` after each sub-task is verified.

---

## Overview

Build Manifest: a regulatory critical-path planner for US university CubeSat missions.
This plan covers Stephen's Phase 0 scaffold tasks, Phase 1 engine and solar proof legs, Phase 2 wiring and mobile, and Phase 3-4 hardening and submission.

**Stephen owns:**
- `engine/**`, `eval/**`, `services/**`
- `pipeline/decay.py`, `pipeline/surya_infer.py`, `pipeline/tests/test_decay.py`
- `mobile/**`, `android/**`, `ios/**`, `capacitor.config.ts`, `next.config.mobile.ts`
- `data/**`, `app/api/status/**`, `app/api/solar/**`
- `scripts/**`, `tests/**` (except `tests/e2e/**`)
- `docs/**` (except `architecture.svg` and `bob-evidence/**`)
- `PLAN.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`
- `.bob/**` (except `skills/**` — that is Tylan's)
- `LICENSE`, `.github/workflows/eval-gate.yml`

**Do NOT touch:** `app/api/ask/**`, `app/api/push/**`, `corpus/**`, `pipeline/**` (except the 3 files above), `components/**`, `lib/**`, `public/**`, `sw.ts`, `tests/e2e/**`, `docs/architecture.svg`, `docs/bob-evidence/**`, `.env.example`, `.vercel/**`, `ci.yml`, `.bob/skills/**`, `.gitleaksignore`

---

## Sub-Task 1: Git init, public repo, first commit

**Intent:** Create the public repo at `github.com/StephenSook/manifest`, commit PLAN.md as commit one. The repo is public from the first push per D10.

**Expected Outcomes:**
- Public GitHub repo `StephenSook/manifest` exists with MIT license
- `PLAN.md`, `CLAUDE.md`, `.gitignore`, `LICENSE`, `README.md` (stub) committed
- `git ls-files | grep -i '\.pdf$'` returns zero before any push

**Todo List:**
1. `git init` in the workspace root
2. `git remote add origin https://github.com/StephenSook/manifest.git` (create via `gh repo create`)
3. Verify `git ls-files | grep -i '\.pdf$'` returns zero
4. Stage named files only: `PLAN.md`, `CLAUDE.md`, `.gitignore`
5. Create `LICENSE` (MIT, Stephen Sookra, 2026)
6. Create `README.md` stub with the five required sections as empty headings
7. Commit as: `chore: initial commit — PLAN.md and project scaffold`
8. Push to main

**Relevant Context:**
- PLAN.md task 0.1 and 0.2
- CLAUDE.md section 8: "Stage named paths only, never `git add -A`"
- D10: repo is public from commit one; research PDFs never pushed

**Status:** [ ] pending

---

## Sub-Task 2: Bob scaffold (.bob/ directory, custom modes, workspace MCP)

**Intent:** Commit the `.bob/` directory with five write-scoped custom modes and a workspace `mcp.json` that contains no secrets. This is the Bob evidence layer and a primary deliverable for the Best Use of Technology award.

**Expected Outcomes:**
- `.bob/custom_modes.yaml` with five modes matching the exact fileRegex from PLAN.md
- `.bob/mcp.json` with only the local eval MCP server (no credentials)
- `AGENTS.md` at repo root with Bob operating rules
- `.bob/rules-agent/AGENTS.md`, `.bob/rules-ask/AGENTS.md`, `.bob/rules-plan/AGENTS.md`
- Each mode tested: open a file the mode should refuse, confirm it refuses
- `git show HEAD:.bob/mcp.json` contains no API keys

**Todo List:**
1. Create `.bob/` directory structure (do NOT create `.bob/skills/` — that is Tylan's in task 0.5)
2. Write `.bob/custom_modes.yaml` with exactly five modes from PLAN.md:
   - `corpus-engineer` (Tylan lane)
   - `regulatory-engine` (Stephen lane)
   - `mobile-shell` (Stephen lane)
   - `frontend` (Kadeem lane)
   - `evidence-writer` (any)
3. Write `.bob/mcp.json` with local eval MCP server only (port 4444)
4. Write `AGENTS.md` at repo root
5. Write `.bob/rules-agent/AGENTS.md`, `.bob/rules-ask/AGENTS.md`, `.bob/rules-plan/AGENTS.md`
6. Verify: open a file outside `regulatory-engine`'s scope in that mode and confirm refusal
7. Commit: `chore: bob scaffold — five write-scoped modes, workspace mcp.json`

**Relevant Context:**
- PLAN.md task 0.3, 0.4, 0.6
- PLAN.md "Bob setup" section: exact fileRegex for each mode, config format table
- CLAUDE.md section 6: Bob usage rules
- Security constraint: Bob cannot expand `${VAR}`, workspace .bob/mcp.json never has secrets

**Status:** [ ] pending

---

## Sub-Task 3: Global MCP server additions (local machine, not committed)

**Intent:** Add the three missing MCP servers to `~/.bob/mcp.json` (global, never committed) so Bob can reach Surya, ORBITM and the NOAA S3 bucket.

**Expected Outcomes:**
- `huggingface` MCP added to global config (reaches Surya checkpoints)
- `deepwiki` MCP added (questions over NASA-IMPACT/Surya, ORBITM without cloning)
- `aws-docs` MCP added (public S3 for nasa-surya-bench)
- All three respond without error in Bob

**Todo List:**
1. Edit `~/.bob/settings/mcp.json` (global config, outside the repo)
2. Add `huggingface`: `https://huggingface.co/mcp?login`
3. Add `deepwiki`: `https://mcp.deepwiki.com/mcp`
4. Add `aws-docs`: standard aws-docs MCP server
5. Test each by running a query in Bob

**Relevant Context:**
- PLAN.md task 0.7
- PLAN.md "Bob setup": config format table, distinction between global (~/.bob/) and workspace (.bob/)
- These are never committed

**Status:** [ ] pending

---

## Sub-Task 4: Ollama model pulls

**Intent:** Pull the two missing Granite models locally so eval can rehearse on Ollama and spend zero watsonx tokens during development.

**Expected Outcomes:**
- `granite4.1:8b` pulled and responds in Ollama
- `granite-embedding:278m` pulled and responds in Ollama
- Already have: `granite3.3:2b`, `gemma3:4b`

**Todo List:**
1. `ollama pull granite4.1:8b`
2. `ollama pull granite-embedding:278m`
3. Verify both by running a quick inference locally

**Relevant Context:**
- PLAN.md task 0.12
- CLAUDE.md section 3 AI layer: "Rehearse on Ollama; spend watsonx tokens only on the live demo and video capture"

**Status:** [ ] pending

---

## Sub-Task 5: Verify day-zero open questions (Q1, Q5, Q7, Q8)

**Intent:** Answer four open questions that unblock architecture decisions before any code is written.

**Expected Outcomes:**
- Q1: BeMyApp announcements feed read while logged in; content recorded in PLAN.md
- Q5: Confirm Next.js 15 static export + @xyflow/react + vis-timeline builds (30-min spike); fallback decided if it fails
- Q7: NOAA SWPC CORS headers checked; solar fetch architecture decided (browser-side vs route handler)
- Q8: Dual-challenge listing (space + wildcard) confirmed or ruled out; recorded in PLAN.md

**Todo List:**
1. Log into `aibuilderschallenge-bobhub.bemyapp.com`, read announcements, update Q1 in PLAN.md
2. Run the static export spike: `npx create-next-app@latest tmp-spike --typescript --no-app`, install `@xyflow/react` and `vis-timeline`, add `output: 'export'` to next.config, run `next build`
3. `curl -I "https://services.swpc.noaa.gov/products/summary/10cm-flux.json"` and check `Access-Control-Allow-Origin`
4. Check August rules logged in for dual-challenge listing; record answer in Q8
5. Update PLAN.md Q1, Q5, Q7, Q8 with answers and mark them resolved

**Relevant Context:**
- PLAN.md Open Questions Q1, Q5, Q7, Q8
- Q5 note: "Moved from Aug 20 to day zero and from Kadeem to Stephen"
- Q7 note: "This decides an architecture, so answer it before writing the fetch"

**Status:** [ ] pending

---

## Sub-Task 6: Eval bank (28 questions + 6 abstention traps)

**Intent:** Transcribe the eval bank from the "US University CubeSat Regulatory Critical Path" research PDF into `eval/bank.jsonl`. This is Leg B of the Phase 1 proof legs.

**Expected Outcomes:**
- `eval/bank.jsonl` with exactly 28 questions and 6 abstention traps
- Each entry has: `id`, `question`, `expected_citations` (CFR path + AMDDATE), `abstain: bool`
- Questions sourced from the research PDF, not invented
- 6 abstention traps are questions the corpus cannot answer; they must trigger abstention

**Todo List:**
1. Open the research PDF and transcribe all 28 questions verbatim into `eval/bank.jsonl`
2. For each question, record the expected citation(s): CFR title, part, section, paragraph path
3. Mark the 6 abstention traps with `"abstain": true`
4. Validate JSON structure (no trailing commas, valid JSONL)
5. Commit: `eval: add 28-question bank and 6 abstention traps (transcribed from research PDF)`

**Relevant Context:**
- PLAN.md task 1.4: "The bank is already written in the PDF. Transcribe it, do not invent questions."
- PLAN.md task 1.5 sets the bar: 90% or better, exact citations, all 6 traps abstaining
- CLAUDE.md section 5: eval is non-negotiable

**Status:** [ ] pending

---

## Sub-Task 7: Engine core — 12-node dependency graph + critical path

**Intent:** Build the pure TypeScript dependency engine: 12 regulatory nodes, backward critical-path computation from the terminal delivery date, typed contracts. This is Leg C of Phase 1 and the crown jewel for technical prizes.

**Expected Outcomes:**
- `engine/types.ts` with `MissionInput`, `GraphNode`, `GraphEdge`, `Verdict` contracts exactly as specified in Shared Contracts
- `engine/graph.ts` encodes the 12 nodes (IARU request, IARU letter, ITU API filed, ITU API published, FCC application prepared, FCC application filed, FCC grant, NOAA CRSRA application, NOAA CRSRA licence, NASA orbital debris assessment, deorbit compliance verdict, launch-provider delivery)
- `engine/critical-path.ts` computes backward critical path from delivery date
- `engine/__tests__/critical-path.test.ts` with a 4-node diamond fixture: hand-computed known critical path and known float on the off-path branch asserted BEFORE the 12 real nodes
- All tests pass (`vitest run`)
- Pure TypeScript, no network calls, no infrastructure — runs in the browser

**Todo List:**
1. Create `engine/types.ts` with the Shared Contracts types from PLAN.md
2. Write the 4-node diamond test fixture and assert the known critical path and float
3. Implement `engine/critical-path.ts` to satisfy the test
4. Encode the 12 nodes in `engine/graph.ts` with documented-or-estimated durations, sources, fees, rework triggers, lateness consequences
5. Every node duration labeled `DOCUMENTED` (with source) or `ESTIMATED` (with basis)
6. Run `vitest run` and confirm green
7. Commit: `feat(engine): 12-node graph and backward critical-path with diamond fixture test`

**Relevant Context:**
- PLAN.md task 1.7 and the 12-node list below it
- CLAUDE.md section 4: full engine spec and interlock acceptance tests
- Shared Contracts in PLAN.md: `MissionInput`, `GraphNode`, `GraphEdge`, `Verdict` type shapes
- D5: every duration must be labeled DOCUMENTED or ESTIMATED

**Status:** [ ] pending

---

## Sub-Task 8: Interlock 1 — 97.207(g) dual clock

**Intent:** Implement and test the two-deadline interlock for the pre-space notification: due within 30 days after LV determination AND no later than 90 days before integration.

**Expected Outcomes:**
- `engine/interlocks/lv-determination.ts` fires both deadlines when LV determination date is entered
- `engine/interlocks/__tests__/lv-determination.test.ts` asserts both clocks with specific dates
- Entering an LV determination date opens the window and sets both deadlines in the graph

**Todo List:**
1. Write the test first (TDD): pick concrete dates and assert both deadline dates
2. Implement `engine/interlocks/lv-determination.ts`
3. Wire the interlock into `engine/graph.ts` so entering an LV date triggers it
4. Run tests: `vitest run`
5. Commit: `feat(engine): fire 97.207(g) dual clock on LV date entry`

**Relevant Context:**
- PLAN.md task 1.8
- CLAUDE.md section 4 interlock 1
- 47 CFR 97.207(g): 30 days after LV determination, 90 days before integration

**Status:** [ ] pending

---

## Sub-Task 9: Interlock 2 — FCC waits for NOAA

**Intent:** Implement the imaging-mission prerequisite: if the mission images Earth, the NOAA CRSRA license node becomes a hard predecessor of FCC grant.

**Expected Outcomes:**
- `engine/interlocks/noaa-precedes-fcc.ts` adds the edge when imaging flag is true
- Test asserts that with `imaging: true`, the NOAA node is in the critical path before FCC grant
- Test asserts that with `imaging: false`, the NOAA node is absent from the graph

**Todo List:**
1. Write the test first: two scenarios (imaging true/false)
2. Implement `engine/interlocks/noaa-precedes-fcc.ts`
3. Wire into `engine/graph.ts`
4. Run tests
5. Commit: `feat(engine): NOAA CRSRA becomes FCC predecessor when imaging flag is set`

**Relevant Context:**
- PLAN.md task 1.9
- CLAUDE.md section 4 interlock 2
- 15 CFR 960, 60-day statutory clock after completeness
- CubeSat 101 Ch. 2.8 as source

**Status:** [ ] pending

---

## Sub-Task 10: Interlocks 4, 5, 6 and re-work triggers

**Intent:** Implement the three remaining plain-graph-edge interlocks and the re-work trigger logic.

**Expected Outcomes:**
- `engine/interlocks/prerequisites.ts`: IARU letter precedes Part 97 pathway, ITU API filing precedes FCC grant
- `engine/interlocks/rework.ts`: frequency change forces IARU re-coordination; orbit above ~600 km forces propulsion/drag decision; launch slip recomputes every clock
- Tests cover each trigger
- `engine/regime.ts`: dual-regime layer, Part 100 flag wired

**Todo List:**
1. Write tests for interlocks 4 (IARU before Part 97) and 5 (ITU API before FCC grant)
2. Implement `engine/interlocks/prerequisites.ts`
3. Write tests for the three re-work triggers
4. Implement `engine/interlocks/rework.ts`
5. Implement `engine/regime.ts`: the regime-switch flag plus the verbatim D3 copy string; flipping the flag changes every Part 25 node's badge and nothing else
6. Run tests
7. Commit: `feat(engine): interlocks 4-6, rework triggers, Part 100 regime flag`

**Relevant Context:**
- PLAN.md tasks 1.16 and 2.15
- CLAUDE.md section 4 interlocks 3-6
- D3: the Part 100 line verbatim (never say it "replaced" Part 25)
- The regime flag exposes the D3 copy string; Kadeem renders it

**Status:** [ ] pending

---

## Sub-Task 11: Solar service — live F10.7 + predicted envelope

**Intent:** Implement the NOAA solar data fetch. This is Leg D and the bridge that makes space weather a legal input.

**Expected Outcomes:**
- `services/solar/fetch.ts` fetches live F10.7 from NOAA SWPC (no auth required)
- `services/solar/types.ts` has the `SolarConditions` contract from Shared Contracts
- Forward projection uses the predicted-solar-cycle endpoint returning monthly `predicted_f10.7` with low/high quantile envelope
- Q7 must be answered before this runs (CORS decision)

**Todo List:**
1. Confirm Q7 is resolved (CORS headers checked) — architecture depends on it
2. Write `services/solar/types.ts` with `SolarConditions` contract (exact shape from PLAN.md Shared Contracts)
3. Implement `services/solar/fetch.ts` for both endpoints
4. Cache the result to `data/` for the Capacitor static export path
5. Commit: `feat(solar): live F10.7 fetch and NOAA predicted-flux envelope`

**Relevant Context:**
- PLAN.md task 1.10
- PLAN.md Shared Contracts: `SolarConditions` shape
- NOAA endpoints: `services.swpc.noaa.gov/products/summary/10cm-flux.json` and `/json/solar-cycle/predicted-solar-cycle.json`
- Q7 decision: if CORS disallows browser fetch, the mobile build reads cached data artifacts

**Status:** [ ] pending

---

## Sub-Task 12: Orbital decay estimate + test

**Intent:** Compute the NRLMSISE-00 orbital lifetime curve using pyatmos and ORBITM. Produce `data/decay-table.json` — the language-boundary contract between Python and the TypeScript engine.

**Expected Outcomes:**
- `pipeline/decay.py` produces `data/decay-table.json` with the `DecayEstimate[]` contract shape
- `pipeline/tests/test_decay.py` tests the computation against known physics (order of magnitude, not exact)
- The engine reads `data/decay-table.json` and interpolates it — Python never called at browser runtime
- If the compliance swing (solar min vs solar max) at 550 km turns out to be small, say so plainly rather than overstating

**Todo List:**
1. Install pyatmos 1.2.7 and ORBITM (vendor from GitHub, pin commit) in the Python venv
2. Write `pipeline/tests/test_decay.py` first: assert a 500 km, 3U at solar max produces a lifetime under 5 years, and at solar min produces a longer estimate
3. Implement `pipeline/decay.py` using NRLMSISE-00 density from pyatmos + NOAA F10.7 envelope
4. Write `data/decay-table.json` from a real run with the `DecayEstimate[]` shape from Shared Contracts
5. Record method, uncertainty band, and `generatedAt` in the output
6. Label the result an estimate; never present as a DAS run (D4)
7. Commit: `feat(pipeline): NRLMSISE-00 decay estimate, decay-table.json contract`

**Relevant Context:**
- PLAN.md task 1.11 and Shared Contracts `DecayEstimate`
- D4: DAS is cited not run; this is an independent estimate with method and uncertainty on the face of the UI
- pyatmos 1.2.7 MIT on PyPI; ORBITM MIT from GitHub (sammmlow/ORBITM), pin commit
- Do NOT use poliastro (archived) or orbdetpy (GPL-3.0)

**Status:** [ ] pending

---

## Sub-Task 13: Interlock 3 — FCC 5-year disposal verdict

**Intent:** Implement the deorbit compliance interlock. This is the innovation core: the same orbit can be compliant or non-compliant depending on the solar cycle.

**Expected Outcomes:**
- `engine/interlocks/deorbit-compliance.ts` reads `data/decay-table.json`, interpolates lifetime, and emits a `Verdict` for FCC 5-year compliance
- The verdict becomes a hard prerequisite of FCC grant
- Test asserts compliance at solar maximum (high flux) and potential violation at solar minimum for a 550 km orbit
- All four CFR paragraph paths (47 CFR 5.64, 25.114, 25.283, 97.207) resolved against the 1.1 eCFR snapshot before any assertion is written

**Todo List:**
1. BLOCKED: wait for task 1.1 (Tylan's eCFR parse) to verify the four CFR paragraph paths
2. Resolve each path against the snapshot — if a path does not resolve, abstain on it (never encode an unverified citation)
3. Write tests: solar max scenario (compliant), solar min scenario (at-risk or violated), orbit below 2000 km only
4. Implement `engine/interlocks/deorbit-compliance.ts` reading `data/decay-table.json`
5. Wire verdict as a prerequisite of FCC grant node in `engine/graph.ts`
6. Run tests
7. Commit: `feat(engine): deorbit compliance interlock, FCC 5-year verdict as graph prerequisite`

**Relevant Context:**
- PLAN.md task 1.12: paragraph paths are UNVERIFIED, blocked on 1.1
- PLAN.md notes: "A wrong citation in a test assertion is a bug the suite defends"
- Shared Contracts: `DecayEstimate` (from Python) and `Verdict` (produced by this interlock)
- FCC 22-74 is the authority; applies at or below 2000 km

**Status:** [ ] pending

---

## Sub-Task 14: Surya inference pipeline

**Intent:** Wire Surya (NASA-IMPACT/Surya) inference using `easy_inference/`. Produce `data/surya-outlook.json` as a frozen cached artifact. The demo reads the cache; live inference is a bonus path.

**Expected Outcomes:**
- `pipeline/surya_infer.py` produces `data/surya-outlook.json` with `SuryaOutlook` shape from Shared Contracts
- `app/api/solar/route.ts` reads the cached artifact and serves it
- If Surya cannot produce real output by Aug 23, it is cut (item 3 on the cut list) and the README says so plainly
- Surya's role: narrows the near-term end of the NOAA predicted-flux envelope; shown beside NOAA data in the deorbit panel with both sources labeled

**Todo List:**
1. Clone or use deepwiki to study `NASA-IMPACT/Surya` `easy_inference/` interface
2. Download SDO frames from public S3 bucket `nasa-surya-bench`
3. Implement `pipeline/surya_infer.py` using the `solar_flares_surya` checkpoint (MPS or CPU)
4. Write `data/surya-outlook.json` with `SuryaOutlook` contract shape from PLAN.md
5. Implement `app/api/solar/route.ts` to serve the cached artifact (D7: never depends on live inference)
6. If inference fails by Aug 23: cut, update README, remove any mention from the video script
7. Commit: `feat(solar): Surya inference pipeline, frozen outlook artifact`

**Relevant Context:**
- PLAN.md task 2.8
- PLAN.md Shared Contracts: `SuryaOutlook` shape
- D7: output is cached, demo never depends on live inference
- Surya's four fine-tuned checkpoints are Apache-2.0, public, ungated (verified 2026-08-15)
- `easy_inference/` explicitly supports Apple Silicon MPS and CPU

**Status:** [ ] pending

---

## Sub-Task 15: /api/status route + FACTS.json generator

**Intent:** Build the unauthenticated status endpoint that recomputes the headline number on every request and self-reports which models are actually running. Then write `docs/FACTS.json` from a real run.

**Expected Outcomes:**
- `app/api/status/route.ts` responds with no key, recomputes from the seeded missions, returns actual model IDs in use
- `scripts/facts.py` runs once and writes `docs/FACTS.json` with every number used in the README, video, and submission
- `tests/test_no_fabricated_numbers.py` fails if README or submission text contains a number not in `docs/FACTS.json` (checks digits AND spelled-out numerals)
- CI asserts that what `/api/status` self-reports matches what the README claims

**Todo List:**
1. Implement `app/api/status/route.ts`: unauthenticated, recomputes from seeded missions, returns `{ deadlineViolationsDays, computeSeconds, models: { generation, audit, embedding, surya | null } }`
2. Implement `scripts/facts.py`: runs a real engine pass on GT-1 mission, writes `docs/FACTS.json`
3. Implement `tests/test_no_fabricated_numbers.py`: reads `docs/FACTS.json`, scans README and submission text for numbers not in the file
4. Add CI assertion that `/api/status` model IDs match README architecture section
5. Run a real engine pass and record the headline number
6. Commit: `feat: /api/status self-reports wiring, facts.py generates FACTS.json`

**Relevant Context:**
- PLAN.md tasks 2.17 and 2.18
- PLAN.md headline number shape: "`<deadline_violations_days>` days of violated regulatory deadline found in `<compute_seconds>` seconds"
- D15: numbers computed once, never per page load; anti-fabrication test checks spelled-out forms too
- Expected order of magnitude: tens-to-low-hundreds days, under 10 seconds compute time

**Status:** [ ] pending

---

## Sub-Task 16: Eval runner (local + CI fixtures)

**Intent:** Build the eval runner and wire it into CI against committed cached-response fixtures. Real watsonx score comes from a manual run.

**Expected Outcomes:**
- `eval/runner.py` runs the 28+6 bank against a provided backend
- CI runs against `eval/fixtures/**` (no network, no key) — tests retrieval, citation extraction, abstention logic
- Real watsonx score published to `docs/FACTS.json` and dated
- `.github/workflows/eval-gate.yml` hard-fails on any skipped test
- Guard must FAIL under CI, never skip

**Todo List:**
1. Implement `eval/runner.py` accepting a backend parameter (ollama / watsonx / fixtures)
2. Generate `eval/fixtures/**` by running the eval against watsonx once and committing the responses
3. Write `.github/workflows/eval-gate.yml` (separate from Tylan's ci.yml)
4. CI gate: assert no tests skipped, hard-fail with `echo "::error::guard skipped"`
5. Rehearse on Ollama to validate the runner before burning watsonx tokens
6. Run against watsonx, record the score, write to `docs/FACTS.json`
7. Commit: `feat(eval): runner with CI fixture gate, eval-gate.yml`

**Relevant Context:**
- PLAN.md tasks 1.5 and 3.1
- PLAN.md CI rules: "every gate runs BARE, no pipe on exit path"; "a conditionally skipped test is a false green"
- CLAUDE.md section 5: 90% bar, exact citations, all abstentions must abstain
- eval-gate.yml is Stephen's; ci.yml is Tylan's — never merge them

**Status:** [ ] pending

---

## Sub-Task 17: Eval MCP server via IBM Context Forge

**Intent:** Expose the eval runner as an MCP tool through IBM Context Forge so Bob can invoke it during development.

**Expected Outcomes:**
- `eval/mcp_server.py` wraps the runner with MCP tool interface
- `.bob/mcp.json` updated with the local eval server (port 4444, JWT auth)
- Bob can call the eval tool from within a session
- No Docker (no arm64 image); Context Forge runs via pip on Apple Silicon

**Todo List:**
1. `pip install mcp-contextforge-gateway`
2. Implement `eval/mcp_server.py` using `mcpgateway.wrapper` bridge
3. Configure port 4444, JWT auth with MCP_AUTH bearer token
4. Update `.bob/mcp.json` with the eval server entry (no credentials in the value)
5. Test: invoke the eval tool from Bob
6. Commit: `feat(eval): MCP server via Context Forge, wired to .bob/mcp.json`

**Relevant Context:**
- PLAN.md tasks 3.2
- CLAUDE.md section 5: "The eval runner is exposed as an MCP tool through IBM Context Forge"
- No Docker on Apple Silicon

**Status:** [ ] pending

---

## Sub-Task 18: README (five required sections) + JUDGE.md

**Intent:** Write the README to the required submission structure and create JUDGE.md as a 90-second numbered judge walkthrough.

**Expected Outcomes:**
- README has exactly: Problem statement, Solution description, AI approach and architecture, Selected challenge theme, How IBM Bob was used
- Architecture section describes ONLY what `/api/status` self-reports
- Bob section uses the AccessGate pattern (build-trace table, human/AI boundary statement, evidence-to-location table)
- Every number in the README comes from `docs/FACTS.json` (enforced by the anti-fabrication test)
- `JUDGE.md` is a 90-second numbered walkthrough at repo root linking to the `/judge` page
- No em-dashes anywhere

**Todo List:**
1. Run `scripts/facts.py` to populate `docs/FACTS.json` first (numbers must come from a real run)
2. Write README: problem statement using the beneficiary population figures (verified to primary source)
3. Write solution description with the deorbit-compliance one-liner as the lead sentence
4. Write AI approach and architecture from `/api/status` self-report only
5. Write Bob section: `git log` build-trace table, human/AI boundary statement, evidence-to-location table
6. Write JUDGE.md: numbered 90-second walkthrough linking to `/judge`
7. Run `scripts/no_em_dash.py --check` and fix any violations
8. Run `tests/test_no_fabricated_numbers.py` and confirm green
9. Commit: `docs: README five sections, JUDGE.md walkthrough`

**Relevant Context:**
- PLAN.md tasks 3.4 and 3.4 notes (the AccessGate pattern)
- PLAN.md: "The Bob section uses the AccessGate pattern that already won here"
- D15: numbers from FACTS.json only; anti-fabrication test catches spelled-out forms
- D13: Best Use of Technology submission-page copy structure (five criteria as headers)

**Status:** [ ] pending

---

## Sub-Task 19: Capacitor mobile variant (Phase 2)

**Intent:** Build the Capacitor 8 static export variant with local notifications and native navigation. This is the mobile floor and it ships regardless (D8).

**Expected Outcomes:**
- `mobile/**`, `capacitor.config.ts`, `next.config.mobile.ts` configured for static export
- `@capacitor/local-notifications` fires deadline alerts with no push server
- iOS: nearest 64 notifications scheduled, reschedule on every app open
- Android: SCHEDULE_EXACT_ALARM, `checkExactNotificationSetting()` on launch, runtime permission
- Build produces a runnable Capacitor project (web assets copied via `cap sync`)
- `output: 'export'`, `images.unoptimized: true` in the mobile config
- No `server.url` in the build config (never in a store build)

**Todo List:**
1. Confirm Q5 is answered (static export build test must pass)
2. Create `next.config.mobile.ts` with `output: 'export'` and `images.unoptimized: true`
3. Configure `capacitor.config.ts` (bundle ID, appName, no server.url)
4. Implement `mobile/notifications.ts` with `@capacitor/local-notifications`
5. iOS: schedule nearest 64, reschedule on app open, `ITSAppUsesNonExemptEncryption: NO`
6. Android: SCHEDULE_EXACT_ALARM in manifest, permission check on launch
7. Run `npx cap sync` and confirm web assets copy
8. Commit: `feat(mobile): Capacitor static export, local notifications floor`

**Relevant Context:**
- PLAN.md tasks 2.12, 2.13, 2.14
- CLAUDE.md section 3 mobile native variant
- The mobile build ONLY needs tasks 2.1, 2.2, 2.9 to be done — it does NOT wait for the full web UI
- D8: mobile floor ships regardless; external TestFlight is the stretch

**Status:** [ ] pending

---

## Sub-Task 20: Submission copy, video script, and Phase 4 artifacts

**Intent:** Draft the BeMyApp submission copy and video script. These are primary judged artifacts (D12) and get their own budget.

**Expected Outcomes:**
- `docs/submission.md` structured against BeMyApp's "The Issue" / "Our Magic Solution" fields, with five criteria as literal bold headers
- BUoT copy leads with one singular IBM sentence: "IBM and NASA's own space model decides whether your satellite's orbit is legal"
- `docs/video/script.md` with the five-beat structure from the PLAN.md beat sheet
- All numbers in both documents read from `docs/FACTS.json`
- No em-dashes, no fabricated numbers, no mentions of the confidential rival analysis

**Todo List:**
1. Populate `docs/FACTS.json` from a real run first
2. Write `docs/submission.md`: "The Issue" section with beneficiary population, "Our Magic Solution" with five criteria headers
3. Write `docs/video/script.md` matching the five beats from PLAN.md's video beat sheet
4. Verify all numbers come from `docs/FACTS.json`
5. Run em-dash check on both files
6. Run the anti-fabrication test
7. Commit: `docs: submission copy and video script`

**Relevant Context:**
- PLAN.md tasks 3.15 and 3.14
- PLAN.md "Video beat sheet" section
- D12: video is a deliverable, not a chore; beats captured as features land
- D15: every spoken number reads from `docs/FACTS.json`
- D16: rival analysis is confidential and never enters the repo

**Status:** [ ] pending

---

## Sub-Task 21: Pre-submission checks — freeze, security, AI-tone, verify

**Intent:** Execute the Phase 4 pre-submission checklist: freeze, wired-or-cut audit confirmation, AI-tone sweep, PII sweep, fresh-clone dry run (Kadeem), commit-content verification.

**Expected Outcomes:**
- Feature freeze called (no new stateful code after Aug 27 morning)
- `docs/FACTS.json` regenerated after all Phase 3 fixes land
- All numbers in the README, video script, and submission are from `docs/FACTS.json`
- `scripts/no_em_dash.py --check` reports zero violations on all judge-facing surfaces
- PII sweep: no validator names, emails, or institutions in the repo
- `git show HEAD:<path>` verified for every file that matters
- Submission confirmed received on the BeMyApp platform

**Todo List:**
1. Wait for 3.7 (adversarial review) and 3.6 (wired-or-cut audit) to land before calling freeze
2. Re-run `scripts/facts.py` to regenerate `docs/FACTS.json` after fixes
3. Re-run the eval after fixes; record score
4. Run `scripts/no_em_dash.py --check` on product copy, README, commit messages, video script, submission text
5. Run PII sweep: `git ls-files` and eyeball for names, emails, institutions
6. Verify each key commit: `git show HEAD:<path> | grep -c '<unique string>'`
7. Coordinate with Kadeem on fresh-clone dry run (task 4.8 is his)
8. Watch post-merge CI on the final merged SHA to completion: verify every check-run is `success`
9. Submit on `aibuilderschallenge-bobhub.bemyapp.com`, verify the returned submission state
10. Commit: `chore: submission confirmed, freeze artifacts final`

**Relevant Context:**
- PLAN.md tasks 4.1 through 4.12 (Stephen's subset)
- PLAN.md CI rules: "never trust a --watch exit code"; "verify what a commit CONTAINS, not that it succeeded"
- D15: numbers computed once; the anti-fabrication test catches spelled-out forms
- D16: confidential materials never reach the repo

**Status:** [ ] pending

---

## Dependency Map

```
Sub-Task 1 (git init, repo)
    └── Sub-Task 2 (Bob scaffold)
    └── Sub-Task 5 (day-zero questions — Q1, Q5, Q7, Q8)

Sub-Task 5 (Q5 resolved)
    └── Sub-Task 19 (Capacitor mobile)

Sub-Task 5 (Q7 resolved)
    └── Sub-Task 11 (solar service)

Sub-Task 6 (eval bank) ─────────────────────┐
Sub-Task 7 (engine core + types) ───────────┤
    └── Sub-Task 8 (interlock 1)            ├── Sub-Task 16 (eval runner)
    └── Sub-Task 9 (interlock 2)            │       └── Sub-Task 17 (eval MCP)
    └── Sub-Task 10 (interlocks 4-6)        │
    └── Sub-Task 13 (blocked on Tylan 1.1)  │

Sub-Task 11 (solar service)
    └── Sub-Task 12 (decay estimate)
        └── Sub-Task 13 (deorbit interlock) ─┘

Sub-Task 7 + Sub-Task 12 + Tylan's 2.16 (seeded missions)
    └── Sub-Task 15 (/api/status + FACTS.json)
        └── Sub-Task 18 (README + JUDGE.md)
        └── Sub-Task 20 (submission + video script)

Sub-Task 14 (Surya — can run in parallel with 7-13)

All prior sub-tasks complete
    └── Sub-Task 21 (freeze + pre-submission)
```

---

## Phase Checkpoints

**Phase 1 checkpoint (Wed Aug 19):** Sub-tasks 6-13 green or rescope. Leg D (solar/decay) is the highest-information checkpoint: it decides if the deorbit differentiator is as strong as assumed.

**Phase 3 gate (Wed Aug 26):** iOS external TestFlight GO only if Beta App Review passed and public link is live. Otherwise NO-GO on TestFlight; floor ships regardless (D8).

**Phase 4 freeze (Thu Aug 27 morning):** Sub-tasks 15-17 complete, 3.7 adversarial review done, 3.6 wired-or-cut audit re-run against those fixes, FACTS.json regenerated.

**Target submit: Sat Aug 30.** Aug 31 is buffer for platform failure only.
