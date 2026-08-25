# MANIFEST: Plan & Coordination

> Living status doc for Stephen + Tylin + Khadim. Updated on every task change and pushed to `main`.
> Single source of truth for who is working on what.
> **Atomic commits. Never bundle a status change with code.**

**Project:** Manifest, a regulatory critical-path planner for US university CubeSat missions
**Team:** **Stephen** (engine, eval, solar service, mobile, submission) · **Tylin** (corpus pipeline, retrieval, watsonx and Granite, API routes) · **Khadim** (frontend, graph and timeline UI, PWA, judge surfaces)
**Hackathon:** AI Builders Challenge with IBM Bob, August 2026, theme "Advance Space Exploration with AI"
**Deadline:** Sunday August 31 2026, 23:59 ET. **Target submit: Saturday August 30.** August 31 is buffer for platform failure only.
**Repo:** `github.com/StephenSook/manifest`, public from commit one
**Primary dev tool:** IBM Bob 2.0.3 (competition requirement)
**Master spec:** `CLAUDE.md` at repo root. If this file drifts from `CLAUDE.md`, fix this file.

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⛔ blocked · ✂️ cut
**Stale lock TTL: 4 hours.** A 🟡 task without a fresh timestamp in Notes is claimable.
**Coordination is manual. No hooks, no `scripts/plan` CLI, no `.githooks`.** Edit this file by hand, commit only `PLAN.md`, push.

---

## Context: why this plan exists and why it differs from BUILD_PLAN.md

`BUILD_PLAN.md` (local, gitignored) was written on August 2 for a four person team starting August 2. Three things changed and one thing was found.

**Changed.** It is now August 15, there are three people, and no code exists. Sixteen days remain. The old Phase 1 and Phase 2 were due to finish tomorrow. This plan restarts from day zero and reorders the work so the highest-risk, longest-lead items (Apple Beta App Review, the corpus freeze, the engine interlocks) start first.

**Found, and it is the reason this plan is not just a compressed BUILD_PLAN.** The challenge theme is "Advance Space Exploration with AI" and the sponsor's own named space asset is **Surya**, the IBM and NASA heliophysics foundation model. Manifest as originally specced used watsonx and Granite, which is generic IBM AI, and zero space-specific assets. The link from a regulatory planner to that theme needs to be made explicit.

There is a load-bearing bridge that removes the step. The FCC 5-year post-mission-disposal rule requires demonstrating that a satellite reenters within five years of end of mission. Orbital lifetime is driven by atmospheric drag, drag is driven by neutral density, and neutral density is driven by solar activity, which is why NASA's own Debris Assessment Software ships a solar flux table that users must refresh quarterly (current file `solarflux_table_06182026.bin`, ODPO, updated 2026-06-18). **The same satellite in the same orbit can be compliant or non-compliant depending on where the solar cycle sits across its mission life.** No planning tool tells a university team that.

**UNVERIFIED, and it must not ship in this form.** The intuition driving this plan is that a 3U at roughly 550 km reenters in a few years near solar maximum and can exceed the five-year limit near solar minimum. **That specific pair of numbers has no source and is not to be quoted, encoded, or narrated.** Task 1.11 produces the real curve from `pyatmos` using NOAA's own predicted-flux envelope, task 2.18 writes it to `docs/FACTS.json`, and every downstream surface reads it from there. If the computed swing turns out to be small, the differentiator is weaker than assumed and we say so rather than restating the intuition. **Deciding this is the first real output of Phase 1** and it is the single highest-information task in the plan.

So Manifest ingests live NOAA SWPC F10.7 flux and NOAA's forward-looking predicted-flux envelope, runs an NRLMSISE-00 decay estimate, uses Surya for the solar activity outlook, and emits a **deorbit compliance verdict as a real node in the dependency graph** that becomes a prerequisite of the FCC grant node. Space weather stops being a dashboard and becomes a regulatory input.

That also settles the differentiation question. The August learning lab (`04_ai_in_space` in `IBM-SkillsBuild-AI-Builders-Challenge/hands-on-labs`, pushed 2026-07-29) ships a **static Kaggle CSV of DONKI events** and builds a launch-probability classifier. Manifest's differentiation: space weather changes a legal outcome, not just a dashboard.

**What Manifest is not:** a chatbot about space law, a form filler, a legal advice tool, or a conformance scorer.

---

## Corrections to the research pack, verified 2026-08-15

Anything below overrides the PDFs in the workspace. Do not re-derive these from the PDFs.

| Item | Pack said | Verified today | Consequence |
|---|---|---|---|
| Granite text model ID | `granite-4h-small` | **`ibm/granite-4-h-small`** | Wrong ID fails at runtime |
| Granite embedding ID | `granite-embedding-278m` | **`ibm/granite-embedding-278m-multilingual`** | Wrong ID fails at runtime |
| Granite guardian ID | `granite-guardian-3-8b` | **`ibm/granite-guardian-3-8b`** confirmed | No change |
| Granite time series | not mentioned | **`ibm/granite-ttm-512-96-r2`** family is live | **Noted, not used. No task uses it, so it is never claimed anywhere.** Listed only so a future cycle knows it exists |
| Surya fine-tuned checkpoints | "coming soon" | **All four shipped**, public, ungated, Apache-2.0, zero downloads | Surya is de-risked, and nobody has found these |
| Surya inference | "heavy lift" | `easy_inference/` explicitly supports **Apple Silicon MPS and CPU** | Runs on the team's own Macs |
| TerraTorch supports Surya | assumed | **NOT FOUND.** Do not claim it | Wired-or-cut |
| August lab | not located | **`04_ai_in_space` exists**, static Kaggle/DONKI CSV, launch-probability goal | Confirms the clone baseline |
| Judging weights | percentages assumed | **No weights published.** Five criteria, unweighted | Do not cite percentages anywhere |
| Part 100 effective date | pending | **Still pending, and the R&O is not yet in the Federal Register.** Two triggers: 60 days after FR publication for most sections, OMB PRA review for 100.1 to 100.34 | Product copy tightens, see D3 |
| Part 25 to Part 100 crosswalk | promised | **Not published.** Future tense in every law-firm tracker | Cannot cite it |
| NASA DAS | assumed usable | **Requires a Software User Agreement**, not a free download | Cite as authority, compute independently, label as estimate |
| Deadline timezone | "11:59 PM ET" | Page says **both** "11:59 PM EST" and "11:59pm ET" | Treat as 23:59 EDT. Do not bank the extra hour |
| Devpost listing | assumed | **None.** Submission is on `aibuilderschallenge-bobhub.bemyapp.com` | Different submission mechanics |
| New event | not known | **IBM Dev Day: Bob in Action, Aug 27, 10:00 ET** | Calendar it, see 4.2 |

**Live-checked 2026-08-15, all responding right now.** The GT-1 SmallSat 2021 paper returns 200 at `digitalcommons.usu.edu/smallsat/2021/all2021/21/` and DOI `10.26077/s4a1-qn29` resolves to it. `services.swpc.noaa.gov/products/summary/10cm-flux.json` returned `{"flux":117,"time_tag":"2026-08-15T20:00:00"}`. `services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json` returns monthly `predicted_f10.7` with the full low/high quantile envelope. `pyatmos` is 1.2.7 MIT on PyPI. Re-check all of these on day zero before building on them.

**Open item nobody has closed:** the BeMyApp announcements feed at `aibuilderschallenge-bobhub.bemyapp.com/#/announcements` 404s publicly and is almost certainly login-gated. Organizer announcements are scoring intent and they arrive after you freeze. **Stephen checks it logged in on day zero and again on Aug 26.**

---

## Field research

Judging-related field research lives in `BUILD_PLAN.md` (local, gitignored).

## Judged criteria and the surfaces that answer them

Each judged criterion maps to one product surface with a named owner.

| Criterion | Surface that answers it | Owner |
|---|---|---|
| Technical Execution | `/judge` page: live eval score, live engine run, live solar verdict, all recomputed on load with no key | Khadim + Stephen |
| Innovation | The deorbit compliance node. Same orbit, opposite legal answer, decided by the solar cycle | Stephen |
| Challenge Fit | Live NOAA ingest plus Surya inference visible in the product and named in the README architecture section | Tylin + Stephen |
| Feasibility | One-command reproduction from a fresh clone, CI green, no credentials required for the deterministic path | Tylin |
| Real-World Impact | Headline number on `/api/status`, plus the sized beneficiary population, plus a sanitized quote from a real university program | Stephen |

**The headline number, and it leads everything.** Measured in the user's currency, recomputed live, checkable by a stranger with no key. The shape of the sentence is:

> **"`<FACTS.deadline_violations_days>` days of violated regulatory deadline, found in `<FACTS.compute_seconds>` seconds."**

**Both values are placeholders and stay placeholders until an engine run produces them.** This document does not contain the number and must never be quoted for it. The figure is written once into `docs/FACTS.json` by a real run of task 2.17, and the README, the `/judge` page, the video narration and the submission all read from that one file so they cannot drift apart. A test enforces it (2.18).

Expected order of magnitude only, so you can tell a broken run from a real one: violated-deadline days should land in the tens-to-low-hundreds for a mission whose licensing started late, and compute time should be under ten seconds on a laptop. If the engine emits zero violations on the seeded GT-1 mission, the engine is wrong, not the mission, because that mission's own published paper documents the slip.

**Never source a number for the video, the README or the submission from memory or from this plan.** This exact failure shipped a wrong figure in a public, unfixable video on a previous project.

---

## Status Dashboard

### Phase 0: Scaffold, environment, Bob evidence (Sat Aug 15 to Sun Aug 16)

| # | Component | File(s) | Owner | Status | Deps | Notes |
|---|---|---|---|---|---|---|
| 0.1 | Copy this plan into the repo as `PLAN.md`, commit first | `PLAN.md` | **Stephen** | ✅ 2026-08-25 audit: `PLAN.md` tracked and actively maintained | n/a | This is commit one. Repo public from here. |
| 0.2 | `git init`, public repo `StephenSook/manifest`, MIT license, README stub | `LICENSE`, `README.md`, `.gitignore` | **Stephen** | ✅ 2026-08-25 audit: `LICENSE` (MIT), `README.md`, `.gitignore` tracked, remote `StephenSook/manifest`, zero tracked PDFs | 0.1 | Keep the existing `.gitignore`. Verify `git ls-files \| grep -i '\.pdf$'` returns zero before any push. |
| 0.3 | Bob `/init` run, `.bob/` scaffold committed | `.bob/` except `skills/`, `AGENTS.md` | **Stephen** | ✅ 2026-08-25 audit: `.bob/custom_modes.yaml`, `.bob/mcp.json`, three `.bob/rules-*/AGENTS.md`, root `AGENTS.md` all tracked | 0.2 | See "Bob setup" below. `.bob/` is never gitignored. **Do not create `.bob/skills/`, that is Tylin's in 0.5.** |
| 0.4 | **Five** Bob custom modes with fileRegex write scopes | `.bob/custom_modes.yaml` | **Stephen** | ✅ 2026-08-25 audit: five slugs with fileRegex write scopes (corpus-engineer, regulatory-engine, mobile-shell, frontend, evidence-writer) | 0.3 | Regexes are given verbatim under "Bob setup". Keys are `slug`, `name`, `description`, `roleDefinition`, `whenToUse`, `customInstructions`, `groups`. Pattern from `~/dev/IBM July/.bob/custom_modes.yaml`. **Test each mode by opening a file it should refuse.** |
| 0.5 | Four Bob skills, one per regulatory regime plus eval | `.bob/skills/*/SKILL.md` | **Tylin** | ✅ | 0.3 | `part-97-amateur`, `part-5-experimental`, `noaa-crsra`, `eval-bank`. `references/` folders added 2026-08-24 (D10: no PDF excerpts). |
| 0.6 | Workspace `.bob/mcp.json`, **no secrets** | `.bob/mcp.json` | **Stephen** | ✅ 2026-08-25 audit: only `manifest-eval` over stdio, `env` empty, no secrets | 0.3 | Bob cannot expand `${VAR}`, it stores values literally. Only the local eval MCP server goes here. Keyed servers stay in `~/.bob/mcp.json`. |
| 0.7 | Add missing MCP servers to Bob global config | `~/.bob/mcp.json` (local, not committed) | **Stephen** | ✅ 2026-08-25 audit: `huggingface`, `deepwiki`, `aws-docs` all present in the local global config | n/a | Bob is missing `huggingface` (needed for Surya), `deepwiki`, `aws-docs`. Add those three. |
| 0.8 | Next.js 15 + TS strict + Tailwind v4 + shadcn new-york scaffold | `app/**`, `components/**`, `package.json` | **Khadim** | ⬜ | 0.2 | `npx shadcn@latest init`. Pin `@xyflow/react` 12.x, `@dagrejs/dagre` (scoped, not the deprecated `dagre`), `vis-timeline` 8.5.x, TanStack Table 8.21.x. No `elkjs` (EPL/GPL). **Name the TS test runner here: `vitest`**, and add the `test:engine` and `test:e2e` scripts to `package.json` so the verification block in this plan actually resolves. |
| 0.9 | Python 3.12 venv, pinned | `pipeline/pyproject.toml`, `.python-version` | **Tylin** | ✅ | 0.2 | **System python3 is 3.14.6 and Docling will not support it.** Pin 3.12 with `uv`. |
| 0.10 | CI skeleton: lint, typecheck, test, build, gitleaks, em-dash gate | `.github/workflows/ci.yml`, `scripts/no_em_dash.py` | **Tylin** | ✅ | 0.8, 0.9 | Every gate runs BARE, no pipe on the exit path. See "CI rules". The em-dash checker resolves its file set with `git ls-files --cached --others --exclude-standard` so it can see files that are not committed yet. |
| 0.11 | Install Android Studio Otter + SDK | machine | **Stephen** | ✅ | n/a | Fully unblocked 2026-08-16. SDK at ~/Library/Android/sdk: platform-tools 37.0.1, platforms 35+36, build-tools 35.0.0+36.0.0, emulator 37.1.11, cmdline-tools 22.0. All licenses accepted. adb verified. ANDROID_HOME, JAVA_HOME (Studio bundled Java 21), PATH exported in ~/.zshrc. First-run wizard suppressed. Gradle/Capacitor Android builds unblocked. NOTE: disk is 4.8GB free of 228GB: emulator system image (~4GB) could not install. Physical phone over USB works fine for dev and demo. Emulator finished 2026-08-16 after disk cleanup: system-images;android-36;google_apis;arm64-v8a installed, AVD `manifest_demo` (Pixel 8) created. |
| 0.12 | Pull Ollama fallback models | machine | **Stephen** | ✅ | n/a | Done 2026-08-16. `granite4.1:8b` (5.3GB) and `granite-embedding:278m` (562MB) pulled and listed. All four fallback models present. |
| 0.13 | Verify watsonx: exact model IDs respond | `pipeline/scripts/watsonx_smoke.py` | **Tylin** | ⛔ | 0.9 | Script ready 2026-08-24. Live 200s blocked: WATSONX_* unset on this machine (Khadim 1.18). Region expected `us-south`. Q2 answered in Open Questions from IBM watsonx.ai Runtime plans (300,000 tokens/month, 2 req/s). |
| 0.14 | Dedicated Vercel project, verify link before any deploy | `.vercel/project.json` | **Khadim** | ⬜ | 0.8 | `vercel project add manifest-web` then `vercel link --project manifest-web --yes`. **Confirm `projectName` before every `--prod`.** A generic name clobbers another project's production. |
| 0.15 | Read the login-gated BeMyApp announcements feed | n/a | **Stephen** | ✅ | n/a | Read 2026-08-16. No surprise scoring changes. Key intel: (1) The Aug 19 webinar is "IBM Tech Talk - AI-Assisted Data Science: Build a Space Weather Risk Model with IBM Bob". Manifest already does the real version of this (regulatory compliance, not just a dashboard). (2) No weight changes or new criteria announced. (3) Deadline confirmed 23:59 ET August 31. Re-read Aug 26 as planned. |
| 0.16 | **Eligibility gate: registration and the learning activity** | n/a | **Stephen** | ✅ | n/a | All three certificates confirmed 2026-08-16. Stephen, Tylin, and Khadim are all registered and hold their SkillsBuild completion certificates. |
| 0.17 | Bobalytics screenshot #1 | `docs/bob-evidence/bobalytics-01.png` | **Khadim** | ⬜ | 0.3 | Weekly cadence starts now. Khadim owns this directory; Stephen and Tylin hand him files rather than committing here. |

### Phase 1: Four proof legs, pass or rescope (Sun Aug 16 to Wed Aug 19)

Written down before we start. If a leg fails, we stop and rescope as a team rather than building on a broken floor.

| # | Component | File(s) | Owner | Status | Deps | Notes |
|---|---|---|---|---|---|---|
| 1.1 | **Leg A.** eCFR bulk XML parsed to citable sections | `pipeline/ecfr_parse.py`, `corpus/chunks/*.json` | **Tylin** | ✅ | 0.9 | Title 47 Parts 5, 25, 97 AMDDATE 2026-08-13. Title 15 Part 960 AMDDATE 2026-08-18. DIV5 = Part, DIV8 = Section. Nested paragraphPath reconstructed 2026-08-24 (eCFR `<P>` text carries only the innermost label). **Ping Stephen:** replace `VERIFY_FROM_SNAPSHOT` in `eval/bank.jsonl` and engine citations with `2026-08-13` (Title 47) / `2026-08-18` (Title 15). 97.207(g)(1) dual-clock chunk exists. |
| 1.2 | **Leg A.** PDF corpus through Docling | `pipeline/docling_ingest.py` | **Tylin** | ✅ | 0.9 | FCC-26-47A1.pdf, FCC-22-74A1.pdf (the 5-year rule), NASA-STD-8719.14C, NASA CubeSat 101 (2017, flag age), DAS 3.2 User's Guide. **Spot-check table extraction on the FCC order appendix and the NASA standard tables before trusting them.** |
| 1.3 | **Leg A.** Embeddings + SQLite bundle frozen | `corpus/manifest.sqlite`, `corpus/vectors.f32` | **Tylin** | ✅ | 1.1, 1.2 | Hashing-trick-768 freeze committed 2026-08-25 so `/api/ask` loads on Vercel without Blob (Q6 amended). Production Granite embed remains when WATSONX_* is set. schema.json.model records which ran. Blob overlay still optional (Khadim 1.18). |
| 1.4 | **Leg B.** 28-question eval bank + 6 abstention traps encoded | `eval/bank.jsonl` | **Stephen** | ✅ | n/a | Transcribed 2026-08-16. 28 questions across Part 97, Part 5, Part 25, ITU/IARU, NOAA CRSRA, NASA debris. 6 abstention traps for fee schedules, unannounced Part 100 notices, unverified paragraph paths, missing crosswalk. AMDDATEs marked VERIFY_FROM_SNAPSHOT pending Tylin's 1.1 eCFR parse. |
| 1.5 | **Leg B.** Eval runner, local and CI | `eval/runner.py` | **Stephen** | ✅ Done 2026-08-24 (Claude, commit 2b17b0f): url + fixtures modes, 34 fixtures committed. Honest baseline on the extractive hashing-trick path: 53.6 percent, 6/6 traps abstaining. The 90 percent bar needs real watsonx embeddings and generation (0.13 credentials, Tylin) | 1.3, 1.4 | Bar: 90% or better with exact citations, all 6 traps abstaining. Rehearse on Ollama, verify on watsonx. |
| 1.6 | **Leg B.** Guardian audit wired, degrade-to-abstain on failure | `app/api/ask/route.ts` | **Tylin** | ✅ | 1.3 | Every citation-bearing answer goes through `ibm/granite-guardian-3-8b` before display. Fail audit means show the retrieved sections and abstain. Abstention is a designed screen, not an error. |
| 1.7 | **Leg C.** Engine core: 12-node graph, backward critical path, **+ test** | `engine/graph.ts`, `engine/critical-path.ts`, `engine/__tests__/critical-path.test.ts` | **Stephen** | ✅ | n/a | Done 2026-08-16. 15/15 tests green. Diamond fixture hand-computed and asserted first. 12 real nodes encoded with DOCUMENTED/ESTIMATED durations, sources, citations, rework triggers, lateness consequences. `npm run test:engine` passes. |
| 1.8 | **Leg C.** Interlock 1: 97.207(g) dual clock | `engine/interlocks/lv-determination.ts` + test | **Stephen** | ✅ | 1.7 | Done 2026-08-16. 9/9 tests green. Both clocks computed, binding deadline is the earlier. Null-safe when either date is missing. isViolated fires correctly. |
| 1.9 | **Leg C.** Interlock 2: FCC waits for NOAA | `engine/interlocks/noaa-precedes-fcc.ts` + test | **Stephen** | ✅ | 1.7 | Done 2026-08-16. 8/8 tests green. NOAA nodes injected and edge wired in buildGraph when imagingEarth is true; absent when false. Single terminal node (delivery) confirmed. |
| 1.10 | **Leg D (new).** Solar service: live F10.7 + predicted envelope | `services/solar/fetch.ts` | **Stephen** | ✅ | n/a | Done 2026-08-16. `services/solar/types.ts` (SolarConditions contract), `services/solar/fetch.ts` (live fetch + parsePredictedForTest), unit tests green. Live integration test gated behind LIVE_TESTS=1. getSolarConditions() falls back to cache on network failure. |
| 1.11 | **Leg D.** Orbital decay estimate **+ test** | `pipeline/decay.py`, `pipeline/tests/test_decay.py`, `data/decay-table.json` | **Stephen** | ✅ | 1.10 | Done 2026-08-17. `setuptools==68.2.2` fixes `pkg_resources` import in pyatmos 1.2.7. Uses `gtd7d` directly (no network SW download). Ballistic drag integration, 7-day steps. 21 pytest green (skipping table-gen group in CI due to integration time). Decay table: 21 entries, 7 altitudes x 3 Bc values. At 550km Bc=180: solar_min=15yr (VIOLATED), solar_max=2.6yr (OK). Differentiator confirmed from real NRLMSISE-00 numbers. |
| 1.12 | **Leg D.** Interlock 3: FCC 5-year disposal verdict | `engine/interlocks/deorbit-compliance.ts` + test | **Stephen** | ✅ | 1.7, 1.11 | Done 2026-08-17. 18/18 engine tests green. CFR paragraph paths remain VERIFY_FROM_SNAPSHOT pending 1.1 -- section-level citations confirmed. f107Override interpolation allows live NOAA/Surya value to shift the verdict. Deorbit compliance is a hard prerequisite of FCC grant in buildGraph. |
| 1.13 | Bob evidence: Plan-mode output committed, screenshot #2 | `docs/bob-evidence/plan-mode-critical-path.md`, `docs/bob-evidence/bobalytics-02.png` | **Khadim** | ⬜ | 0.3 | Done means both files exist: the full Plan-mode transcript for the build's critical path, and the week-2 Bobalytics screenshot. Budget one Orchestrator-tier run for this and log the Bobcoin count in this cell. |
| 1.14 | App shell proofs: React Flow with dagre, vis-timeline | `components/graph/*`, `components/timeline/*` | **Khadim** | ⬜ | 0.8 | **Client component only.** Gate on mounted or dynamic import, or SSR sizing breaks the layout. **Done means:** a hardcoded 5-node graph renders with dagre layout and no hydration warning in the console, and a 3-item timeline renders, both on the deployed URL from 1.17, not just locally. |
| 1.15 | Validator outreach sent | local only, never committed | **Stephen** | ✅ | n/a | Sent 2026-08-02 to eight programs and practitioners. One PI replied twice with written substance; a 30-minute call is booked for Sept 9 (post-deadline, noted honestly in 3.12). Roster and details stay local. |
| 1.16 | **Interlocks 4, 5, 6 and the re-work triggers** | `engine/interlocks/prerequisites.ts`, `engine/interlocks/rework.ts` + tests | **Stephen** | ✅ | 1.7 | Done 2026-08-16. Interlocks 4+5 verified by prerequisites.test.ts (10 tests). Rework triggers in rework.ts (9 tests): frequency change, orbit >= 600 km, launch slip. Regime flag in regime.ts + regime.test.ts (5 tests). 56/56 engine tests green. |
| 1.17 | **First production deploy** | Vercel | **Khadim** | ✅ 2026-08-25 audit: verified LIVE, `/api/status` returned a real engine payload (160 violated days, 10-node critical path) | 0.8, 0.14 | Deploy something real on day 4, even if it is only the shell and a stub `/api/status`. Everything in Phase 3 (`/judge`, Playwright smoke, the uptime watchdog) presupposes a live URL, and the first deploy is where surprises live. Verify `.vercel/project.json` names `manifest-web` first. |
| 1.18 | **Env and secrets provisioning, plus `.env.example`** | `.env.example`, Vercel project settings | **Khadim** | ⬜ | 0.14 | `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_REGION`, the VAPID pair, and the KV/Blob credentials. **Provision the Vercel KV or Blob store here**, because 2.11 declares durable subscription storage mandatory for any scheduled push and nothing else creates it. `.env.example` carries placeholder values only and is audited by 3.6. |

**The 12 nodes** (task 1.7), so nobody has to guess them: IARU coordination request, IARU coordination letter issued, ITU advance publication information filed via the FCC, ITU API published, FCC application prepared, FCC application filed, FCC grant, NOAA CRSRA application (imaging missions only), NOAA CRSRA licence, NASA orbital debris assessment, deorbit compliance verdict (task 1.12), and launch-provider delivery. Delivery is the terminal node and the wall.

**CHECKPOINT, Wednesday Aug 19 evening: all four legs green or we rescope together.** Leg D is the highest-information one: it decides whether the differentiator is as strong as this plan assumes.

### Phase 2: Core product, everything wired (Wed Aug 19 to Sun Aug 23)

| # | Component | File(s) | Owner | Status | Deps | Notes |
|---|---|---|---|---|---|---|
| 2.1 | Mission setup flow, persists to IndexedDB only | `app/mission/**`, `lib/store.ts` | **Khadim** | ✅ 2026-08-25 audit: `app/mission/page.tsx` 848 lines with validation and focus-first-error, `lib/store.ts` real IndexedDB | 1.7 | Launch and delivery date, LV determination date, integration date, pathway (amateur vs experimental), frequencies, imaging yes/no, orbit apogee and perigee. Nothing transmitted server-side except push subscriptions. |
| 2.2 | Dependency graph view, violated and at-risk visually distinct | `components/graph/**` | **Khadim** | ✅ 2026-08-25 audit: `components/graph/DependencyGraph.tsx` 434 lines, dagre gated on `useNodesInitialized`, mounted | 1.7, 1.14 | `@xyflow/react` + `@dagrejs/dagre`. Run layout client-side after node measurement. |
| 2.3 | Timeline view | `components/timeline/**` | **Khadim** | ⬜ | 1.7 | `vis-timeline` behind a thin client wrapper. |
| 2.4 | Citation panel, every claim carries section + AMDDATE | `components/citation/**` | **Khadim** | ⬜ | 1.3 | Cite or abstain. No regulatory statement ships without a section-level citation pinned to the snapshot. |
| 2.5 | Abstention screen as a first-class state | `components/abstain/**` | **Khadim** | ⬜ | 1.6 | Says exactly what is missing. Shows retrieved sections. Not styled as an error. |
| 2.6 | Q&A over the corpus, end to end | `app/api/ask/route.ts` | **Tylin** | ✅ | 1.3, 1.6 | Retrieval + granite-4-h-small + Guardian when WATSONX_* is set. Extractive quote of retrieved text when keys are absent (`audited: false`). Abstention traps: fees, Part 100 effective date, unpublished crosswalk, NASA-STD-8719.14C. Credentials server-side only. |
| 2.7 | Deorbit compliance panel, the innovation surface | `components/deorbit/**` | **Khadim** | ✅ 2026-08-25 audit: `components/deorbit/DeorbitPanel.tsx` mounted, live `/api/status` returns the deorbit swing (VIOLATED at solar min, OK at solar max) | 1.12 | Shows the verdict, the lifetime estimate, the F10.7 value that produced it, the uncertainty band from NOAA's envelope, and the citation. Plus the swing: what the same orbit does at solar min. |
| 2.8 | **Surya inference wired** | `pipeline/surya_infer.py`, `app/api/solar/route.ts`, `data/surya-outlook.json` | **Stephen** | ✅ | 1.10, 1.11 | Done 2026-08-17. `pipeline/surya_infer.py` produces real output. HF repo: `nasa-ibm-ai4science/Surya-1.0` (Apache-2.0). Weights (1.8GB) + two bench frames (585MB each) cached. Weight interpolation (`_interpolate_state_dict_to_resolution`) maps 4096-trained pos_embed and spectral filters to 1024 resolution via bicubic/bilinear interp (standard ViT technique). Forward pass: `(1,13,2,1024,1024)` -> `(1,13,1024,1024)`. Activity index: AIA 94A top-1% proxy = 0.0231. `data/surya-outlook.json` written with real output. `app/api/solar/route.ts` still blocked on Khadim's Next.js scaffold (0.8). | `NASA-IMPACT/Surya` `easy_inference/run_easy_inference.py`, data from public S3 `nasa-surya-bench`, MPS or CPU, shipped `solar_flares_surya` checkpoint. **Surya's role must be stated before this starts, or the wired-or-cut audit cannot judge it and D1 cannot be applied.** Decided role: NOAA's predicted-flux envelope drives the lifetime bound in 1.11, and **Surya supplies a near-term solar activity outlook that narrows the near-term end of that envelope** and is shown beside it in the 2.7 panel with both sources labelled. Input: SDO frames from the public bench bucket. Output: `SuryaOutlook` per the contract. Consumer: `app/api/solar/route.ts` and the 2.7 panel. **If Surya is absent, the verdict still computes from NOAA alone and the panel says so.** That is the honest framing and it is also the D7 fallback. **If by Aug 23 Surya is not producing a real output, cut it and say so in the README** rather than claiming it. |
| 2.9 | Deadline banner, primary alert, zero permissions | `components/deadline-banner/**` | **Khadim** | ✅ 2026-08-25 audit: `components/deadline-banner/DeadlineBanner.tsx` 267 lines, four states, zero permissions, mounted | 1.7 | Computed on load. This is what judges actually see. It must work with no notification permission granted. |
| 2.10 | PWA: manifest, Serwist service worker, offline corpus read | `app/manifest.ts`, `sw.ts` | **Khadim** | ⬜ | 0.8 | Serwist 9.5.x `@serwist/next`. name, short_name, start_url, `display: standalone`, theme_color, background_color, 512x512 icon plus apple-touch-icon. |
| 2.11 | Web push, secondary channel | `app/api/push/**`, `.github/workflows/deadline-check.yml` | **Tylin** | ✂️ | 2.10 | Cut 2026-08-24. Cut list item 1, forced-decision date Aug 21 has passed. Khadim 2.10 PWA and 1.18 KV have not landed. Deadline banner (2.9) is the primary alert. |
| 2.12 | Capacitor 8 variant, static export build | `mobile/**`, `capacitor.config.ts`, `next.config.mobile.ts` | **Stephen** | ✅ Done 2026-08-24 (Claude, commit 1983ff6): verified rendering on iPhone 17 sim, appId com.stephensookra.manifest, `scripts/build-mobile.sh` holds app/api aside during export | **2.1, 2.2, 2.9 only** | **The mobile build deliberately does NOT wait for the full web UI.** It ships mission setup, the graph, the deadline banner, local notifications, native nav and offline. The Q&A panel (2.6), the citation panel (2.4) and push (2.11) are **not** in the first TestFlight build; they arrive in later builds of the same version, which do not need a fresh Beta App Review. This is what makes the Aug 22 target arithmetically possible at all. `output: 'export'`, `images.unoptimized: true`. **Never ship `server.url` in a store build.** No route handlers, no middleware, no request-time server components. Dynamic calls become client fetches against the hosted API from 1.17. |
| 2.13 | Local notifications, the flagship native capability | `mobile/notifications.ts` | **Stephen** | ✅ Done 2026-08-24 (Claude, commit 2d83a0e): 64-cap sliding window, resync on launch and resume, proven on sim (27 pending after permission grant) | 2.12 | `@capacitor/local-notifications`, no push server needed on either platform. **iOS keeps only the soonest 64 pending requests**, so schedule the nearest 64 and reschedule on every app open. Android: `SCHEDULE_EXACT_ALARM` in the manifest, `checkExactNotificationSetting()` on launch, Android 13+ runtime permission. |
| 2.14 | Native navigation surface + working offline mode | `mobile/**` | **Stephen** | ✅ Done 2026-08-24 (Claude, commit 2d83a0e): native bottom tab bar, offline strip, Android hardware back, all native-only so the web build is unchanged | 2.12 | These are the documented Guideline 4.2 mitigations. Push alone is explicitly called out by Apple as insufficient. |
| 2.15 | Dual-regime layer | `engine/regime.ts` | **Stephen** | ✅ | 1.7 | Done 2026-08-16 (ahead of schedule). regime.ts exports getRegimeBadge, applyRegimeFlag, PART_25_PENDING_BADGE, PART_100_ACTIVE_BADGE. D3 copy string on REGIME_FLAG. Flipping the flag changes every Part 25 node badge and nothing else, verified by regime.test.ts. |
| 2.16 | Seed three real missions | `data/missions/*.json` | **Tylin** | ✅ | 1.7 | 2026-08-24: gt-1.json, darla-02.json, astra-hyrax.json. Every date labelled DOCUMENTED with source or ESTIMATED with basis. **Ping Stephen:** `app/api/status/route.ts` still uses the inline GT-1 seed; switch it to `data/missions/gt-1.json`. Files sit in `data/` (Stephen lane) because PLAN reassigned 2.16 to Tylin. |
| 2.17 | `/api/status`, unauthenticated, recomputes the headline **and self-reports the wiring** | `app/api/status/route.ts` | **Stephen** | ✅ | 1.7, 2.16 | Recomputes the number on every request from the seeded mission. No key. This is the judge's proof. **Corrected 2026-08-16 (Claude):** seed re-based to a live delivery frame and forward pass anchored at today; the prior 3-years-back anchor made the headline permanently 0, the exact engine-error PLAN's order-of-magnitude check names. Headline now reports the worst single overrun (151 days on the live frame), with the cascade sum kept as a labeled secondary field. **Also returns the model IDs actually invoked in this deployment** (`generation`, `audit`, `embedding`, `surya` or `null` if cut) so claimed-versus-invoked is checkable by one curl. The endpoint must self-report what the README says, and CI asserts the two match. |
| 2.18 | `docs/FACTS.json` generator + the test that enforces it | `scripts/facts.py`, `tests/test_no_fabricated_numbers.py` | **Stephen** | ✅ | 2.17 | One real run writes every number. README, video narration and submission all read from it. **Extended 2026-08-16 (Claude):** `scripts/run_status.ts` (tsx) now runs the real route logic and facts.py captures the headline block into FACTS.json; the docstring's step 4 previously claimed this and it did not exist. |
| 2.19 | **iOS build uploaded to App Store Connect** | n/a | **Stephen** | ✅ Done 2026-08-24 (Claude): build 1.0 (1) uploaded and VALID, app record "Manifest CubeSat Licensing" id 6804876175, PrivacyInfo.xcprivacy wired (commit ad5680c), icon and splash landed (8835311) | 2.12, 2.13, 2.14 | Bundle ID registered, `ITSAppUsesNonExemptEncryption` NO, `PrivacyInfo.xcprivacy` present (missing it means an ITMS-91053 upload rejection), icons and splash generated. Internal testing confirms it launches. |
| 2.20 | **First EXTERNAL TestFlight build submitted for Beta App Review** | n/a | **Stephen** | ✅ Submitted 2026-08-24 (Claude): betaReviewState WAITING_FOR_REVIEW, build attached to External Testers group, beta description, contact and 4.2 reviewer notes set via ASC API. Approval is Apple's clock (typically 1 to 2 days) | 2.19 | **Target Aug 22, no later than Aug 23.** Beta app description, contact info, and a reviewer note naming each native feature and exactly how to reach it. |
| 2.21 | Signed Android APK/AAB + Firebase App Distribution invite link | `android/**` | **Stephen** | ✅ COMPLETE 2026-08-25 (Claude). Signed release APK verified with apksigner (CN=Stephen Sookra) and published on GitHub Releases at tag `v1.0-beta.1`, which has no retention clock (AccessGate HR3). Firebase App Distribution now also live after Stephen reauthenticated: dedicated project `manifest-cubesat-2026`, Android app `1:72793499773:android:9f6194ec9e4523e366a914` (package com.stephensookra.manifest), release 1.0 (1) uploaded with reviewer notes and distributed to the `judges` group. A dedicated Firebase project was created rather than reusing the two existing `soar` projects, same reasoning as the Vercel dedicated-project rule. PUBLIC INVITE LINK CREATED 2026-08-25 via browser automation in Stephen's console (the CLI has no command for it): `https://appdistribution.firebase.dev/i/2adff092da3659d7`, enrolling testers land in the `judges` group, no domain restriction. Verified by full page reload (1 of 1 listed, group attached, domain blank) and by an unauthenticated fetch returning 200. NOTE the invite link requires a Google sign-in to enroll, so the GitHub Release stays the PRIMARY judge-facing download: no account, no tester app, no retention clock | 0.11, 2.12 | Free, invite links work without a Google group, 500 testers. **Do not attempt a Play Store listing**, the 12-tester 14-day closed-test rule makes it impossible inside the window. |
| 2.22 | Bobalytics screenshot #3, Orchestrator run captured | `docs/bob-evidence/bobalytics-03.png`, `docs/bob-evidence/orchestrator-run.md` | **Khadim** | ⬜ | n/a | Done means both files exist: the week-3 screenshot, and a transcript of one Orchestrator run that delegated regime-specific work to a subagent. Log the Bobcoin spend to date in this cell. |

### Phase 3: Hardening, judge surfaces, review gate (Sun Aug 23 to Thu Aug 27)

| # | Component | File(s) | Owner | Status | Deps | Notes |
|---|---|---|---|---|---|---|
| 3.1 | Eval wired into CI, PRs that regress citations do not merge | `.github/workflows/eval-gate.yml`, `eval/fixtures/**` | **Stephen** | ✅ Done 2026-08-24 (Claude, commit 2b17b0f): offline fixtures mode on every push, ratchet floor 50 (raise-only), any trap answering fails, skipped rows fail. The 90 bar enforces at the Phase 4 freeze once watsonx lands | 1.5 | **Separate workflow file, not Tylin's `ci.yml`.** **The backend question is decided here and it is not optional:** GitHub runners have no Ollama, and hitting watsonx on every PR needs repo secrets and burns the 300K monthly Lite cap. So **CI runs the eval against committed cached-response fixtures**, which tests retrieval, citation extraction and the abstention logic deterministically with no network and no key. The real watsonx score comes from a **manual run whose output is published to `docs/FACTS.json`** and dated. Say both numbers plainly in the README rather than implying the live score is gated. **The guard must FAIL under CI, never skip.** Assert the suite collected tests and hard-fail on any `N skipped`. |
| 3.2 | Eval MCP server exposed through IBM Context Forge | `eval/mcp_server.py`, `.bob/mcp.json` | **Stephen** | 🟡 2026-08-24 (Claude): eval/mcp_server.py DONE and VERIFIED over stdio (run_eval + eval_last_report, real scores returned), .bob/mcp.json points Bob at it directly, Bob-invocable now. Context Forge layer: gateway 4444 and translate 9001 run (env at ~/.claude/scripts/manifest-forge.env, local only), virtual-server registration returns an opaque gateway error, not yet registered. Claim in judge surfaces stays at what is verified | 1.5 | `pip install mcp-contextforge-gateway`, port 4444, JWT auth. Bridge via `mcpgateway.wrapper`. **No Docker on Apple Silicon**, there is no arm64 production image, and the daemon is not running anyway. |
| 3.3 | `/judge` page: numbered three-minute itinerary with deep links | `app/judge/page.tsx` | **Khadim** | ✅ 2026-08-25 audit: `app/judge/page.tsx` 452 lines, numbered itinerary wired to `/api/status`, seeded so no empty state | 2.17 | Build the judge's door. Every claim reachable without logging in, without a key, without running anything. Seeded so an empty state is impossible. |
| 3.4 | README to the required structure, plus `JUDGE.md` | `README.md`, `JUDGE.md` | **Stephen** | ✅ 2026-08-24 (Claude, commit 5d5023c): deploy URLs live, mobile section added, eval state stated honestly (53.6 baseline, 90 bar pending watsonx), corpus claims corrected (Blob not committed, NASA-STD not ingested), FACTS regenerated same run. Final sweep still happens at the Phase 4 freeze | 2.18 | Partial 2026-08-17: Judge Quick Access table, judging criteria table, differentiator proof section. JUDGE.md created. Numbers section awaits FACTS.json (task 2.18). The platform requires exactly: Problem statement, Solution description, **AI approach and architecture**, Selected challenge theme, **How IBM Bob was used**. Plus the repo template sections. **The Bob section contains:** (1) a build-trace table from `git log` with a monotonically growing test count per commit and the reproduction command inline; (2) an explicit human/AI boundary statement (what Bob authored, what the humans decided); (3) an honest deduction if credits run out ("Bob as primary, not exclusive"); (4) an Evidence-to-Location table pointing at `.bob/custom_modes.yaml`, the skills, the Bobalytics screenshots and the Orchestrator transcript. **The architecture section must describe only what `/api/status` self-reports**, never a path that is not running. `JUDGE.md` is a 90-second numbered walkthrough in the repo root, and it links to the `/judge` page rather than duplicating it. |
| 3.5 | Architecture diagram as a designed artifact | `docs/architecture.svg` | **Khadim** | ⬜ | n/a | Mermaid `flowchart TB` inline plus a committed SVG. Edge labels carry the actual invariant, not just arrows. Name every tool and surface. |
| 3.6 | Wired-or-cut audit: grep the shipped code for every claim | `docs/claims-audit.md` | **Tylin** | ✅ | 3.4 | 2026-08-24 first pass plus mid-phase re-grep same day (hashing-trick-768 WIRED as Lite freeze; ORBITM still CUT FROM CODE; Context Forge CONFIG ONLY; web-push CUT). `.env.example` placeholder names landed (empty values, no VAPID). Vercel/GitHub secret provisioning still Khadim 1.18. **Freeze re-run still required after 3.7** (4.1). |
| 3.7 | Second-model adversarial pass on the diff | n/a | **Stephen** | ✅ Done 2026-08-24 (Claude): TEN iterate-until-clean rounds via the Codex companion runtime. Rounds 1-3 (corpus reconstruction, cite-or-abstain, resync, baseline guard), rounds 4-9 (CFR resolver titles and fail-closed resolution, doc-matcher metadata, release signing fail-closed, provenance guard, citation spans, w-word boundaries, Part cues, unit-label ambiguity resolved by DELETING the carve-out: every CFR-shaped pathed reference is fail-closed). Round 10 CLEAN (1,022 direct assertions re-confirming all prior probes). Every finding verified against source before fixing; 21 fix commits d75575b..eb7f2cb, all CI-green per SHA. Ask suite grew 13 to 44 tests | 3.6 | Codex via the companion runtime in **background** mode. Fixes written in response to a review carry fresh bugs that same-model review misses. |
| 3.8 | Security scan plus **license audit** | `.gitleaksignore`, `docs/THIRD_PARTY_NOTICES.md` | **Tylin** | ✅ | n/a | 2026-08-24: Gitleaks check-run on `33a1800` concluded success (empty `.gitleaksignore`). Notices table now includes `@tailwindcss/postcss` and `@types/*` / `@vitejs/plugin-react`. Living CI license-guard fails if elkjs or orbdetpy appear in lockfiles. ORBITM not vendored. |
| 3.9 | Playwright golden-path smoke, in CI | `tests/e2e/**` | **Khadim** | ⬜ | 3.3 | Load, enter a mission, see the graph, see the deorbit verdict, ask a question, hit an abstention trap. |
| 3.10 | Uptime watchdog on the deployed URL | `.github/workflows/uptime.yml` | **Tylin** | ✅ | 1.17 | Content-checks `/api/status` for `deadline_violations_days` and `POST /api/ask` for HTTP 200 plus a `97.207(g)(1)` citation (503 = corpus gone). Offset minutes `4,14,24,34,44,54`. **Fails if `vars.MANIFEST_DEPLOY_URL` is unset** (no skip). Team 2026-08-25: URL is wired, `/api/status` and `/mission` green; `/api/ask` 503s until the committed freeze lands in the deploy. |
| 3.11 | UI polish: density, empty states, keyboard flow, mobile layout | `components/**` | **Khadim** | ⬜ | n/a | Dense, serious regulatory instrument. It should look like it belongs next to a NASA standard. No gradient-and-glass landing page energy. **Done means:** every screen has a designed empty state, the full mission-entry flow is completable with the keyboard alone, and `axe` reports zero serious or critical violations on `/judge` and `/mission`. |
| 3.12 | Validator call taken, sanitized quote landed | `README.md` | **Stephen** | 🟡 | 1.15 | 2026-08-16: written NEED-tier substance in hand from a PI reply (slow-walked steps waiting on launch details; chronology unrecoverable without reviewing filings; a NASA launch award paid a consultant to run the FCC filing). Anonymized PARAPHRASE drafted into docs/submission.md, labeled as paraphrase. Call itself is Sept 9, post-deadline, stated honestly. Update 2026-08-16 evening: paraphrase LANDED in README Real-World Impact and docs/submission.md, labeled as paraphrase, fully anonymized. Consent decision: anonymous-by-default ships now (needs no consent); a courtesy and optional named-attribution email was SENT 2026-08-16; if he opts out, pull the paraphrase from README and submission; if he permits naming, upgrade at freeze. Remaining: the Sept 9 call itself (post-deadline, OUTCOME-tier quote for a future cycle). |
| 3.13 | Re-read the BeMyApp announcements feed | n/a | **Stephen** | ✅ | 0.15 | First re-read done 2026-08-16 in prior session (no scoring changes). Final re-read still due Aug 26 per 0.15. |
| 3.14 | **Video script drafted, beats captured as features land** | `docs/video/script.md`, `docs/video/raw/` | **Stephen** | ✅ | 1.17 (capture starts in Phase 2), 2.18 (numbers) | D12. Judging is a 3-minute video with no live pitch, so this is a primary artifact. Capture each beat the day its feature lands rather than re-staging everything on Aug 28. **YouTube title carries product plus benefit plus IBM tech:** "Manifest: The Sun Decides If Your Satellite Is Legal (IBM Granite + IBM/NASA Surya) \| IBM AI Builders Challenge". |
| 3.15 | Project-page copy drafted | `docs/submission.md`, `docs/submission-assets/` | **Stephen** | ✅ | 3.4 | Drafted 2026-08-16: docs/submission.md with tagline, The Issue, Magic Solution under the five criteria headers, IBM lead sentence, worked verdict example from FACTS.json, links row, fill-at-freeze checklist. All numbers are FACTS references or [VERIFY] markers, nothing handwritten. The written submission is a primary judged artifact alongside the video. The platform's fields are "The Issue" and "Our Magic Solution", plus the links row (repo, live URL, video, TestFlight), so draft against those, not a generic README shape. Structure the Magic Solution section under the five judging criteria as literal bold headers with real content behind each. **The IBM story leads with one singular sentence: "IBM and NASA's own space model decides whether your satellite's orbit is legal."** The inventory (three named Granite models, IBM Bob's five write-scoped modes, the eval as an MCP tool via IBM Context Forge) goes under the Technical Execution header, after the sentence, never instead of it. Attach one designed image per section (Issue, Solution). Keep evidence density: sourced numbers, the real-user quote, the honesty disclosures. The Innovation framing leads with the excluded population ("university CubeSat teams who cannot afford licensing counsel, where roughly 40% of missions fail and late licensing means demanifest"), mechanism second. Include one worked verdict example with the real numbers from `docs/FACTS.json`. State the eval result verbatim as a sentence ("X of 34 answered with exact citations, all 6 abstention traps refused"). Draft before the freeze so the freeze is only corrections. |
| 3.16 | Accessibility pass: keyboard-first, screen-reader-sane, contrast | `components/**` | **Khadim** | ⬜ | 3.11 | Both prior wins from this organizer cited accessibility. This is correct engineering for a dense regulatory instrument regardless, so it is a real pass with axe and a keyboard-only run, not a claim. |

**GATE, Wednesday Aug 26: iOS external TestFlight is GO only if Beta App Review has PASSED and the public link is live, or a single resubmit is already back in review with high confidence.** Otherwise NO-GO, cut it without ceremony, and ship the floor: installable PWA plus Firebase App Distribution plus internal TestFlight demoed on camera. **The submission is never hostage to Apple's queue.**

### Phase 4: Freeze, video, submit (Thu Aug 27 to Sun Aug 30)

| # | Component | Owner | Status | Notes |
|---|---|---|---|---|
| 4.1 | **Feature freeze, Thu Aug 27 morning** | **Stephen calls it** | ⬜ | **Gated on: 3.7's fixes have landed, AND 3.6's wired-or-cut audit has been re-run against them, AND the eval has been re-run, AND `scripts/facts.py` has regenerated `docs/FACTS.json`.** Fixes written in response to a review carry fresh bugs, so an audit that ran before the fixes has audited nothing. After the freeze: claim-correcting, guard-adding, test-adding and documentation changes only, plus the corpus re-freeze procedure which is explicitly exempt. No new stateful code on any judge-facing path. Record each deferral with its reason. |
| 4.2 | IBM Dev Day: Bob in Action, Aug 27 10:00 ET | **all three** | ⬜ | New event, not in the research pack. Attend, and re-read announcements after. |
| 4.3 | Deploy the frozen build, run the eval once more, publish the score | **Tylin** | 🟡 | Verify `.vercel/project.json` names `manifest-web` before `--prod`. Live URL is `manifest-web-roan.vercel.app`. Corpus freeze (sqlite + vectors) is the remaining `/api/ask` 503; no local `.vercel/project.json` on this machine so `--prod` waits on Khadim's link or a GitHub auto-deploy after the freeze is pushed. |
| 4.4 | Video assembled and cut, 3:00 maximum | **Stephen** | ⬜ | Beats already captured in 3.14, so this is assembly and narration, not a shoot. Beat sheet below. **Every spoken number comes from `docs/FACTS.json`, never from memory.** A published video is immutable and becomes the reference the README must match. |
| 4.5 | Measure the shipped video file | **Stephen** | ⬜ | ffmpeg ebur128 integrated loudness, target -14 to -16 LUFS, plus duration, resolution and fps checked against target. Frame-verified is not verified. |
| 4.6 | AI-tone sweep: no em-dashes anywhere, blocklist clean | **Stephen** | ⬜ | Product copy, README, commit messages, video script, submission text. |
| 4.7 | PII sweep: no validator names, emails or institutions in the repo | **Stephen** | ⬜ | `git ls-files` and eyeball. Consent to be named on one surface is not consent on another. |
| 4.8 | Fresh-clone dry run on a clean machine | **Khadim** | ⬜ | Follow the README exactly. Click every link. Watch the video once as a stranger. |
| 4.9 | Verify what the commit CONTAINS, not that it succeeded | **Stephen** | ⬜ | `git show HEAD:<path> \| grep -c '<string unique to the change>'` per file that mattered. A multi-path `git add` can abort on one bad pathspec and still report success. |
| 4.10 | Post-merge main CI watched to completion on the merged SHA | **Tylin** | 🟡 | Read `gh api repos/StephenSook/manifest/commits/<SHA>/check-runs` and require every conclusion to be `success`. Never trust a `--watch` exit code. On `5fe63e7`: lint/typecheck/test/build/eval/gitleaks green; uptime red at `POST /api/ask` (status 200). Re-watch after the corpus freeze lands. |
| 4.11 | Learning activity complete for all three | **all three** | ✅ Satisfied by 0.16: all three SkillsBuild certificates confirmed 2026-08-16 | Submission requirement. |
| 4.12 | **Submit, Sat Aug 30** | **Stephen** | ⬜ | Project page on `aibuilderschallenge-bobhub.bemyapp.com` with team details, GitHub link, public video link. Verify the returned submission state, do not assume the click worked. |


### Status audit and live blockers, 2026-08-25

Every ⬜ and 🟡 row above was re-checked against the shipped files and the live
deploy on 2026-08-25, not against these notes. Twelve rows were stale and are now
✅ with their evidence in the cell. What follows is what the audit found that the
table alone does not say.

**BLOCKER 1, the judged surface cannot answer a question.** `POST /api/ask` returns
503 in production. Root cause is now positively verified: the route needed
`corpus/manifest.sqlite` in the deploy, Blob was never uploaded (`corpus-build.yml`
has zero runs and the repo has no Actions secrets), and the binaries were
gitignored. **Q6 amended 2026-08-25:** the hashing-trick freeze is committed and
traced into `/api/ask`, so this unblocks on the next production deploy without
waiting on `BLOB_READ_WRITE_TOKEN`. Blob remains an optional overlay for a later
Granite re-embed (Khadim 1.18).

**What BLOCKER 1 needs now: one production deploy, and it is Khadim's.** Verified
2026-08-25 10:50 ET, after `564dc22` landed: `POST /api/ask` still returns 503,
and the error has changed to `ENOENT ... /var/task/corpus/manifest.sqlite`. That
is the pre-fix build still being served, not a defect in the fix. Note also that
there is no `manifest-web` project in Stephen's Vercel account, so the deployment
belongs to Khadim's and only he can trigger it.

1. **Khadim**: deploy current `main` to production, then confirm with
   `curl -s -X POST https://manifest-web-roan.vercel.app/api/ask -H 'content-type: application/json' -d '{"question":"When is the pre-space notification due?"}'`
   returning HTTP 200 with a citation rather than 503. Verify the deployed build,
   never the dashboard's green tick.
2. **Then re-dispatch the uptime workflow.** Its `/api/ask` content-check has been
   red by design since the variable was set; it goes green on the same deploy.
3. **`BLOB_READ_WRITE_TOKEN` is now optional**, not blocking. It matters only for a
   later Granite re-embed, where `corpus-build.yml` uploads a bundle too large to
   commit. If that happens: create the Blob store in the Vercel project's Storage
   tab (which writes the variable into that project automatically), then have
   Stephen run `gh secret set BLOB_READ_WRITE_TOKEN` so the workflow can upload.
   It is a write credential: never paste it into the repository, an issue, or this
   plan.
4. **The `WATSONX_*` trio (0.13) is the same shape**: set it in the Vercel project
   and, if CI ever needs it, as a repo secret. `/api/status` now reports which
   backend actually answered, so that upgrade is visible in one request.

**BLOCKER 2, watsonx remains unwired (0.13).** Same missing-secrets root cause. Note
the Official Rules make **IBM Bob** the core requirement and list watsonx and Granite
as optional additions, so this costs less than it appears, but it does keep the eval
at the extractive 53.6 percent ceiling.

**PRIORITY CHANGE for 2.22, from the Official Rules re-read (2026-08-25).** Two of
the four monthly awards are named for the sponsor's tool: **Best Technical Use of
IBM Bob** and **Most Innovative Use of IBM Bob**, $750 each, winnable alongside a
placing prize, and the rules make IBM Bob "the core component of all project
submissions" while listing watsonx and Granite as optional additions. That makes
2.22 (the Bobalytics screenshot and the Orchestrator delegation transcript) prize
-bearing evidence rather than a nice-to-have, and it is the strongest remaining
lever on the Technical Execution criterion. 3.5, the architecture diagram, sits
just behind it: at an online-judged event the submission package is the design
deliverable. Both are Khadim's. `docs/submission.md` now carries a written
argument for each Bob prize by name.

**A sentinel is live on a judge-facing surface.** `/api/status` currently returns
`"corpus_amddate": "PENDING_CORPUS_FREEZE"`, and the deorbit panel shows
`VERIFY_FROM_SNAPSHOT` until the corpus freeze. Hard rule 1 pins every citation to
an AMDDATE, so a judge reading the live surface sees a placeholder where the rule
promises a date. Resolves with BLOCKER 1.

**Wired-or-cut exposure found (3.6 must re-run on these).** `vis-timeline` is
installed and imported nowhere (2.3 never landed), and `shadcn/ui` was never
initialised at all (no `components.json`, no `components/ui/`, none of the radix or
cva dependencies), although the architecture section names it. `@playwright/test`
and a `test:e2e` script exist with zero tests behind them (3.9), and the README
documents that command. Either wire these or cut the claims before the freeze.

**Genuinely open, unchanged:** 1.13, 2.3, 2.4, 2.5, 2.22, 3.5, 3.9, 3.11, 3.16, and
the Phase 4 chain. 2.10 shipped except the offline corpus read, which `sw.ts`
deliberately excludes; 1.14 shipped the graph but not the timeline.

---

## Team lanes and zero-collision file ownership

Nothing in these three lists overlaps. That is the point.

Every path in the task table appears in exactly one list below. If you find a path that does not, it is a bug in this plan: raise it in Open Questions before you touch the file.

**Stephen** owns `engine/**`, `eval/**`, `services/**`, `pipeline/decay.py`, `pipeline/surya_infer.py`, `pipeline/tests/test_decay.py`, `mobile/**`, `android/**`, `ios/**`, `capacitor.config.ts`, `next.config.mobile.ts`, `data/**`, `app/api/status/**`, `app/api/solar/**`, `scripts/**`, `tests/**` except `tests/e2e/**`, `docs/**` except `architecture.svg` and `bob-evidence/**`, `PLAN.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `.bob/**` except `skills/**`, `LICENSE`, and `.github/workflows/eval-gate.yml`.

**Tylin** owns `pipeline/**` except Stephen's three files, `corpus/**`, `app/api/ask/**`, `app/api/push/**`, `.github/workflows/**` except `eval-gate.yml`, `.bob/skills/**`, `.gitleaksignore`, and `.gitignore`.

**Khadim** owns `app/**` except `api/`, `components/**`, `lib/**`, `public/**`, `sw.ts`, `tests/e2e/**`, `docs/architecture.svg`, `docs/bob-evidence/**`, `.env.example`, `.vercel/**`, and the Vercel project settings.

**Three collisions the first draft of this plan had, now resolved, do not reintroduce them.** The eval gate lives in its own workflow file (`eval-gate.yml`, Stephen) rather than inside Tylin's `ci.yml`. `.bob/skills/**` is Tylin's and the rest of `.bob/` is Stephen's, so task 0.3 scaffolds everything except `skills/`. **`docs/bob-evidence/**` has one owner, Khadim**; Stephen and Tylin hand him screenshot files, they do not commit to that directory.

**Backup owners, because a 4-hour stale lock is useless if nobody else can execute.** Tylin backs up Stephen on `engine/**` and `eval/**`. Stephen backs up Tylin on the whole pipeline. Khadim backs up whoever is further behind. **A takeover suspends the Bob write-scope for that lane**: switch to a mode that can write it, or use Code mode, and say so in the Notes cell.

If you need a change in someone else's territory, write it in Open Questions and ping. Do not edit.

**The load is not even, and here is the trigger for fixing it.** After the gap scan and one rebalance, the split is Stephen 44 tasks, Khadim 22, Tylin 16. Stephen carries 52% because he owns the engine, the eval, the solar service, mobile and the submission. The front-load and back-load sequencing makes it survivable, not comfortable. **Concrete rebalance trigger: if at the Wednesday Aug 19 checkpoint Stephen has more than three Phase 1 tasks still ⬜, hand 2.15 and 2.17 to Tylin and 2.13's Android half to Khadim, that evening, without discussion.** Waiting to see if it recovers is how a plan slips quietly.

**Why Stephen has the engine.** It is pure TypeScript with no infrastructure, it is the most testable thing in the repo, it is the crown jewel for a technical prize, and it touches neither Tylin's Python nor Khadim's React. It is also front-loaded (Aug 16 to Aug 19) while mobile is back-loaded (Aug 19 to Aug 23), so those two workloads are sequential, not simultaneous.

**How Stephen supports the backend without colliding with Tylin.** Three seams, all one-directional:
1. **The eval bank is the contract.** Stephen writes the 28 questions and 6 traps with expected citations. Tylin's retrieval and generation has to satisfy them. Stephen never edits `app/api/ask/route.ts`.
2. **The solar service is a leaf.** `services/solar/` fetches NOAA and runs the decay estimate, and exposes one typed function. Tylin consumes it, never edits it.
3. **`/api/status` is Stephen's single route**, because it reads the engine and the seeded missions, both of which are his.

---

## Bob setup: this is the prize, not a chore

The Bob evidence layer is a deliverable, not overhead. Bob 2.0.3 is installed at `/Applications/IBM Bob.app`, global config at `~/.bob/`.

**Verified already present, no action needed.** All 14 superpowers skills (`brainstorming`, `writing-plans`, `test-driven-development`, `systematic-debugging`, `subagent-driven-development`, `verification-before-completion`, `using-git-worktrees`, `requesting-code-review`, `receiving-code-review`, `executing-plans`, `dispatching-parallel-agents`, `finishing-a-development-branch`, `writing-skills`, `using-superpowers`) plus 114 more, 128 total in `~/.bob/skills/`, symlinked from `~/.agents/skills/`. Bob already carries `serena`, `firecrawl`, `exa`, `kie-ai`, `magic` (21st), `context7`, `playwright`, `render` and `higgsfield` over MCP.

**Action required (task 0.7).** Add to `~/.bob/mcp.json`, which is local and never committed:
- **`huggingface`** (`https://huggingface.co/mcp?login`): this is how Bob reaches Surya and the four fine-tuned checkpoints. Without it the Surya work is blind.
- **`deepwiki`** (`https://mcp.deepwiki.com/mcp`): ask questions about `NASA-IMPACT/Surya`, `lcx366/ATMOS` and `sammmlow/ORBITM` without cloning them.
- **`aws-docs`**: the Surya bench data lives in a public S3 bucket.

**Config format, extracted from the Bob 2.0.3 bundle. Do not guess these paths.**

| Artifact | Global | Workspace |
|---|---|---|
| Custom modes | `~/.bob/settings/custom_modes.yaml` | `.bob/custom_modes.yaml` (note: no `settings/` at workspace level) |
| MCP | `~/.bob/settings/mcp.json` | `.bob/mcp.json` (overrides global for same-named servers) |
| Skills | `~/.bob/skills/<name>/SKILL.md` | `.bob/skills/<name>/SKILL.md` |
| Rules | n/a | `AGENTS.md` at root, `.bob/rules-agent/AGENTS.md`, `.bob/rules-ask/AGENTS.md`, `.bob/rules-plan/AGENTS.md` |
| Ignore | n/a | `.bobignore` |

Root precedence is `.bob` > `.agents` > `.claude`. Bob also reads `CLAUDE.md`, `.cursorrules`, `.cursor/rules/` and `.github/copilot-instructions.md`, so the existing `CLAUDE.md` is already load-bearing for Bob. Skill directory names must match `^[a-z0-9]+(-[a-z0-9]+)*$`.

**Security constraint, and it is committed-repo critical.** Bob **cannot expand `${VAR}` in `mcp.json`, it stores values literally.** `.bob/` is committed per `CLAUDE.md`. Therefore the workspace `.bob/mcp.json` contains **only** the local eval MCP server with no credentials. Every keyed server stays in `~/.bob/mcp.json`, which is outside the repo. Verify with `git show HEAD:.bob/mcp.json` before the first push.

**Three custom modes, each write-locked (task 0.4).** Pattern lifted from `~/dev/IBM July/.bob/custom_modes.yaml`, keys are `slug`, `name`, `description`, `roleDefinition`, `whenToUse`, `customInstructions`, `groups`:

**Write each regex from the ownership list verbatim, not by directory guess.** The first draft of this plan had three modes that left Khadim with no mode at all and let the corpus mode overwrite Stephen's two pipeline files. Five modes, and every path in the ownership list is covered by exactly one:

| slug | Lane | fileRegex write scope |
|---|---|---|
| `corpus-engineer` | Tylin | `^(corpus/\|app/api/(ask\|push)/\|pipeline/(?!decay\.py\|surya_infer\.py\|tests/test_decay\.py))` |
| `regulatory-engine` | Stephen | `^(engine\|eval\|services\|data\|scripts)/\|^pipeline/(decay\.py\|surya_infer\.py\|tests/test_decay\.py)$\|^app/api/(status\|solar)/\|^tests/(?!e2e/)` |
| `mobile-shell` | Stephen | `^(mobile\|android\|ios)/\|^(capacitor\.config\.ts\|next\.config\.mobile\.ts)$` |
| `frontend` | Khadim | `^(app/(?!api/)\|components/\|lib/\|public/)\|^sw\.ts$\|^tests/e2e/` |
| `evidence-writer` | any | `^docs/\|^README\.md$` (anchored, so it cannot match `docs-anything`) |

Bob runs a VS Code fork, so JavaScript regex semantics apply and the negative lookaheads work. **Verify each one before trusting it**: open a file the mode should refuse and confirm it refuses, not just that it accepts the files it should.

**Bobcoin budget: 40 each, 120 total.** A single non-trivial build can consume 40 on its own. Use Code mode for routine edits. Reserve Orchestrator and Advanced runs for work that shows in the evidence trail. Meter at each phase boundary and log the count in Notes.

---

## Tool inventory: what gets used, and when

Only tools that are actually used appear here. Anything not on this list is not claimed anywhere in the submission.

### MCP servers

| Server | Used for | Phase |
|---|---|---|
| `huggingface` | Surya model card, the four fine-tuned checkpoint repos, weights | 1, 2 |
| `context7` | Next.js 15, Serwist, Capacitor 8, xyflow, TanStack API surfaces | 0, 2 |
| `deepwiki` | Question `NASA-IMPACT/Surya`, `lcx366/ATMOS`, `sammmlow/ORBITM` without cloning | 1 |
| `firecrawl` | eCFR and FCC pages that block plain fetch, BeMyApp SPA pages | 0, 1, 3 |
| `exa` | Regulatory precedent and prior-art sweeps | 1 |
| `serena` | Symbol navigation across `engine/` once it exceeds a few files | 2, 3 |
| `playwright` / `chrome-devtools` | Golden-path smoke, judge-page verification, console checks | 3, 4 |
| `render` or Vercel MCP | Deploy state, build logs, runtime errors | 3, 4 |
| `aws-docs` | Public S3 access patterns for `nasa-surya-bench` | 2 |
| `kie-ai` | Video narration and music bed **only** | 4 |
| `socket` | Dependency supply-chain check before the repo goes public | 3 |
| `sentry` | Runtime errors on the deployed demo during judging week | 4 |

**Suspended for this project:** `kie-ai` is the global default for AI media generation, and that default is **suspended for anything the product generates**. Every space-weather artifact comes from NOAA and Surya. `kie-ai` touches the demo video's narration and music bed and nothing else. Naming a non-IBM generator in a product that is scored on IBM asset use reads as "no."

### Skills

| Skill | Used for | Phase |
|---|---|---|
| `superpowers:brainstorming` | Before any new feature | all |
| `superpowers:writing-plans` | This document, and any sub-spec | 0 |
| `superpowers:test-driven-development` | Every engine interlock. Test first, from the regulatory text | 1 |
| `superpowers:systematic-debugging` | Any failure, before proposing a fix | all |
| `superpowers:subagent-driven-development` | Parallel independent tasks inside one session | 2 |
| `superpowers:verification-before-completion` | Before any task flips to ✅ | all |
| `superpowers:requesting-code-review` / `receiving-code-review` | Every PR | 2, 3 |
| `karpathy-guidelines` | Any non-trivial coding task | all |
| `team-plan` | The format of this file. **Manual coordination, no hooks** | 0 |
| `three-brain` | Routing to Codex for adversarial review, Gemini for long-context | 3 |
| `rag-auditor` | Retrieval precision, recall, MRR, groundedness, hallucination rate | 1, 3 |
| `test-harness` | pytest suites for the pipeline and decay model | 1 |
| `security-audit` / `repo-sentinel` | Before the repo is judged | 3 |
| `dependency-audit` | License compliance. Everything must stay permissive | 3 |
| `frontend-design` / `ui-ux-pro-max` | The dense regulatory-instrument look | 2, 3 |
| `architecture-diagram` / `drawio-skill` | `docs/architecture.svg` | 3 |
| `demo-video-studio` | Narrated, captioned, scored submission video | 4 |
| `humanize` | AI-tone sweep on every judge-facing surface | 4 |
| `hackathon-pre-deploy` | The pre-submission review chain | 4 |
| `plan-review` / `devils-advocate` | Stress-test this plan before Phase 1 starts | 0 |
| `session-memory` | Vault capture at each phase boundary | all |
| `hard-rule-harvest` | Post-submission retro | after |

### Subagents

| Agent | Used for |
|---|---|
| `Explore` | Broad read-only sweeps across the corpus and codebase |
| `Plan` | Design passes on the engine and the solar spine |
| `plan-gap-scanner` | Adversarial scan of this file before Phase 1 starts |
| `codex:codex-rescue` | Second-model adversarial pass on the hardening diff, **background mode** |
| `cc-gemini-plugin:gemini-agent` | Long-context pass over the full eCFR corpus |
| `pr-review-toolkit:silent-failure-hunter` | Error handling and fallback behavior in the pipeline |
| `pr-review-toolkit:type-design-analyzer` | Engine node and edge types, invariant expression |
| `pr-review-toolkit:pr-test-analyzer` | Interlock test coverage |
| `feature-dev:code-explorer` | Execution traces once the app is wired |
| `claude-security:claude-security` | Full scan before the repo is judged |

### Local toolchain, verified 2026-08-15

| Tool | State | Action |
|---|---|---|
| IBM Bob | 2.0.3, installed | ready |
| node | v22.22.2 | ready |
| Xcode | **26.6** | ready, satisfies Capacitor 8 |
| gh | 2.91.0 | ready |
| vercel | 53.2.0 | ready |
| ollama | installed, has `granite3.3:2b`, `gemma3:4b` | **pull `granite4.1:8b`, `granite-embedding:278m`** |
| python3 | **3.14.6** | **pin a 3.12 venv, Docling will not run on 3.14** |
| Android Studio | **NOT INSTALLED, no SDK, no adb** | **install Otter, day zero, hours of download** |
| docker | daemon not running | not needed, Context Forge runs via pip on Apple Silicon |

---

## Shared Contracts

> Drift is integration bugs. Modify these only after pinging the other two. `⚠️ CONTRACT` commit prefix on changes.
> **Contract changes are announced here BEFORE they are committed.**

| Contract | Owner | Consumers | Definition |
|---|---|---|---|
| `MissionInput` | Stephen | Khadim, Tylin | `engine/types.ts`. Dates, pathway, frequencies, imaging flag, apogee/perigee km, ballistic coefficient. |
| `GraphNode` / `GraphEdge` | Stephen | Khadim | `engine/types.ts`. Node carries `agency`, `durationDays`, `durationBasis: 'DOCUMENTED' \| 'ESTIMATED'`, `source`, `citation`, `fees`, `reworkTriggers`, `latenessConsequence`. |
| `Verdict` | Stephen | Khadim | `engine/types.ts`. `'OK' \| 'AT_RISK' \| 'VIOLATED' \| 'ABSTAIN'`. Abstain is a first-class value, not an error. |
| `Citation` | Tylin | Khadim, Stephen | `{ cfrTitle, part, section, paragraphPath, amddate, sourceUrl }`. Every regulatory claim carries one or the product abstains. |
| `/api/ask` response | Tylin | Khadim | `{ answer \| null, citations: Citation[], audited: boolean, abstained: boolean, reason?: string }`. `answer` is null whenever `abstained` is true. |
| `/api/status` response | Stephen | judges, README, video, tests | Unauthenticated. Shape frozen at task 2.17. Every field recomputed per request. |
| `SolarConditions` | Stephen | Tylin, Khadim | `services/solar/types.ts`. `{ f107Current, f107Predicted[], envelopeLow[], envelopeHigh[], observedAt, source }`. |
| `docs/FACTS.json` | Stephen | README, video, submission, tests | Written only by `scripts/facts.py` from a real run. Hand-editing it fails CI. |
| Corpus chunk schema | Tylin | Stephen, Khadim | `corpus/schema.json`. Every chunk carries its `AMDDATE`. |
| **`DecayEstimate`** | Stephen | `engine/interlocks/deorbit-compliance.ts` | **This is a language boundary and it had no contract.** `pipeline/decay.py` is Python, the interlock that consumes it is pure browser TypeScript. Decided format: `pipeline/decay.py` writes **`data/decay-table.json`**, a plain JSON array of `{ altitudeKm, ballisticCoefficient, launchYearMonth, lifetimeYears, lifetimeYearsLow, lifetimeYearsHigh, f107Assumed, method, generatedAt }`. The engine reads and interpolates it. **The engine never calls Python at runtime**, which is what keeps 1.7's "pure TypeScript, no network, runs in the browser" true. |
| **`SuryaOutlook`** | Stephen | `app/api/solar/route.ts` | Same boundary. `pipeline/surya_infer.py` writes **`data/surya-outlook.json`**: `{ horizonMonths, activityIndex[], modelId, checkpoint, sourceDataRange, generatedAt }`. Read as a file, never invoked live (D7). |
| **Vector file format** | Tylin | `app/api/ask/route.ts` | `corpus/vectors.npy` is a numpy binary and TypeScript cannot read it. Decided: the pipeline emits **`corpus/vectors.f32`**, a raw little-endian `Float32Array` with dimensions recorded in `corpus/schema.json`, loadable directly in a route handler. **Q6 AMENDED 2026-08-25:** hashing-trick freeze (sqlite ~3.5 MB, vectors.f32 ~10.8 MB) is committed so Vercel packs it into `/api/ask`. The route reads local files first and falls back to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set and artifacts exist. corpus-build.yml remains the Granite re-embed upload path. `outputFileTracingIncludes` on `/api/ask` is required or NFT omits the binaries.

---

## Decisions (locked)

> Reference by D# in commits and code comments. Do not re-litigate without escalation.

**D1: The solar spine is load-bearing, not decoration.** The deorbit compliance node is a real prerequisite of the FCC grant node and re-runs whenever launch date or orbit changes. If it ever becomes a side panel that does not affect the graph, it gets cut rather than faked. **Locked 2026-08-15 by Stephen.**

**D2: Cite or abstain, with no exceptions.** No regulatory statement ships without a section-level citation pinned to the ingested snapshot's AMDDATE. If the corpus cannot support an answer, the product says exactly what is missing. Abstention is a feature. **Locked 2026-08-15 by Stephen.**

**D3: The Part 100 line, verbatim, updated for what is verifiable today.** "Part 100 was adopted July 22, 2026 (FCC 26-47). The Report and Order has not yet been published in the Federal Register, and the effective date has not been announced. Part 25 remains binding today." Never say Part 100 "replaced" Part 25. Two triggers are pending: most sections take effect 60 days after Federal Register publication, and sections 100.1 through 100.34 only after OMB Paperwork Reduction Act review. The regime switch is a config change keyed to a future Space Bureau public notice and nothing else. **Locked 2026-08-15 by Stephen, tightened from CLAUDE.md after 2026-08-15 verification.**

**D4: DAS is cited, not run.** NASA Debris Assessment Software 3.2.7 is the tool NASA and the FCC expect, and it requires a Software User Agreement rather than a free download. Manifest computes an **independent estimate** with `pyatmos` (NRLMSISE-00) and `ORBITM`, using NOAA's own predicted F10.7 envelope, and labels it an estimate with its method and uncertainty band on the face of the UI. It never presents itself as a DAS run. **Locked 2026-08-15 by Stephen.**

**D5: Documented versus estimated, on every duration.** Every number in the graph carries `DOCUMENTED` with a source or `ESTIMATED` with a basis. CubeSat 101's licensing figures are documented but date to 2017, and that age is shown wherever they are used. Folklore never renders as fact. **Locked 2026-08-15 by Stephen.**

**D6: No fictional personas, no synthetic load-bearing data.** Sample missions are real public missions with real dates where recoverable and clearly labelled estimates where not. The UI names roles only ("mission lead", "licensing owner"), never people. **Locked 2026-08-15 by Stephen.**

**D7: Surya inference output is cached as a frozen artifact.** The demo reads the cached artifact. A live inference call is a bonus path with a visible fallback, never the thing the demo depends on. **Locked 2026-08-15 by Stephen.**

**D8: The mobile floor ships regardless.** Installable PWA plus Firebase App Distribution plus internal TestFlight are guaranteed. External TestFlight is an all-in attempt with a hard NO-GO at Aug 26 that cannot gate the submission. **Locked 2026-08-15 by Stephen, per user decision 2026-08-15.**

**D9: kie-ai is suspended for product assets.** The global default routing media generation to kie-ai applies to the demo video's narration and music bed only. Every space-weather artifact in the product comes from NOAA and Surya. **Locked 2026-08-15 by Stephen.**

**D10: The repo is public from commit one; the research is not.** The 11 PDFs, both BUILD_PLANs and the validator roster stay local. Stage named paths only, never `git add -A`. **Locked 2026-08-15 by Stephen.**

**D11: IARU materials are parsed locally and never redistributed.** Cite and link to iaru.org. The coordination request form and instruction text never enter the repo or the app. **Locked 2026-08-15 by Stephen.**

**D12: The video is a deliverable with its own budget, not a Phase 4 chore.** Judging is online on a video of three minutes or less plus the repo, with no live pitch. The script is drafted at the Phase 2 boundary, the beats are captured as the features land rather than re-staged at the end, and the cut is assembled during the freeze. **Locked 2026-08-15 by Stephen.**

**D13: Aim at Most Innovative; occupy Best Use of Technology as the second genre; stay eligible for all four.** One score makes the project auto-eligible for every award. Manifest's lane is the deorbit compliance node, and the Best Use of Technology story is carried by visible, named IBM integration on the submission page (task 3.15). The build does not change; the copy does. Every judge-facing surface points at the one deorbit sentence. **Locked 2026-08-15 by Stephen.**

**D14: A real user from the target community reshapes the product, and the change is named.** Not a testimonial bolted on at the end. Two tiers: a NEED quote that motivates a feature, and an OUTCOME quote after they have seen it. Anonymized on every public surface. If nobody replies by Aug 22, we say plainly that no operator interview was obtained rather than manufacturing one. **Locked 2026-08-15 by Stephen.**

**D15: Numbers are computed once, never per page load, and the guard catches spelled-out forms.** During July judging a summary endpoint regenerated its text on every load and roughly one in three renders emitted a spelled-out wrong number that a digits-only guard could not see, inside a product whose thesis is verbatim citation. `docs/FACTS.json` is written by one run. The anti-fabrication test checks digits **and** spelled-out numerals. **Locked 2026-08-15 by Stephen.**

**D16: Internal research stays local.** Competitive research, internal playbooks and field notes are never committed, never copied into `.bob/`, and never referenced on any public surface. **Locked 2026-08-15 by Stephen.**

---

## Open Questions

- [x] **Q1 (Stephen, resolved 2026-08-16):** Read the announcements feed. No scoring changes. The Aug 19 IBM Tech Talk is "Build a Space Weather Risk Model with IBM Bob": space weather as a data science dashboard. Manifest does the real thing (space weather changes a legal outcome). No new criteria or weight changes. Deadline is 23:59 ET Aug 31. Re-read Aug 26 for any late announcements.
- [x] **Q2 (Tylin, resolved 2026-08-24):** IBM docs `watsonx.ai Runtime service plans` confirm Lite: **300,000 tokens/month** for foundation-model inferencing (1000 tokens = 1 RU) and **2 inference requests per second**. Source: https://www.ibm.com/docs/en/watsonx/saas?topic=runtime-watsonxai-plans. Budget: one eval item is embed (~50 tokens) + granite-4-h-small (~2,500 input + 400 output) + Guardian (~1,500 input + 8 output) ≈ **4,500 tokens**. 34 items ≈ **153,000 tokens per eval run**. Cap allows **at most 1 full live eval run per month** (1.9 on paper; judging-week `/api/ask` traffic competes). A 3524-chunk corpus embed at ~200 tokens/chunk ≈ **700,000 tokens**, over the monthly cap, so the freeze uses hashing-trick-768 (or Ollama) and watsonx Granite embed waits for Essentials or a scoped subset. **Rehearse eval on Ollama. One watsonx verification run only.** Flip the instance to Essentials if judging week bites. Live model-ID 200s still blocked on WATSONX_* (task 0.13 ⛔, Khadim 1.18).
- [x] **Q3 (Tylin, resolved 2026-08-24):** Three named tables. (1) **FCC 26-47 Table of Contents / appendix structure**: Docling extracted TOC markdown tables (section headings and paragraph numbers). Those round-trip as a table of contents, not as a Part 100 section-to-effective-date trigger table. That trigger table is not in the Order: effective date is unannounced (D3). FAIL as a requirements table; no manual numeric extraction invented. (2) **FCC 22-74 five-year LEO disposal requirement (paragraph 18)**: the operative rule is prose, not a table: space stations ending mission in or passing through LEO below 2000 km, uncontrolled reentry, five years. Docling ingested that prose into `pdf-FCC-22-74A1.json`. PASS for the requirement text. (3) **NASA-STD-8719.14C Table 4-1**: NOT EXTRACTED. Document is behind the NASA Technical Standards System login wall. `corpus/chunks/pdf-NASA-STD-8719.14C.json` is an empty array. Documented in `corpus/chunks/manual/MANUAL_EXTRACTIONS.md`. `/api/ask` abstains on NASA-STD-8719 questions. Workaround: DAS 3.2 User Guide is fully ingested.
- [ ] **Q4 (Stephen, by Aug 22):** Does any validator reply? If none by Aug 22, ship on the three public missions and say plainly that no operator interview was obtained. One due date only, matching D14.
- [x] **Q5 (Stephen, resolved 2026-08-16):** PASSES. Next.js 16.3.1 static export with `output: 'export'` + `@xyflow/react` + `vis-timeline` builds cleanly to static HTML with no errors. The Capacitor mobile build can use the main Next.js tree without a separate simplified route group. Full architecture confirmed.
- [x] **Q6 (Tylin, resolved 2026-08-21, amended 2026-08-25):** Hashing-trick freeze committed (sqlite ~3.5 MB, vectors.f32 ~10.8 MB, 3524 x 768). `/api/ask` 503d in production because Blob was never uploaded and binaries were gitignored. Route now reads local files first, Blob optional. `outputFileTracingIncludes` packs the files into the serverless function. corpus-build.yml remains for a later Granite embed. Recorded in Shared Contracts.
- [ ] **Q9 (Stephen, 2026-08-24 ping):** eCFR AMDDATEs are Title 47 `2026-08-13` and Title 15 `2026-08-18`. Please replace `VERIFY_FROM_SNAPSHOT` in `eval/bank.jsonl` and engine citation helpers. Nested path `47 CFR 97.207(g)(1)` is the dual-clock paragraph.
- [ ] **Q10 (Khadim, 2026-08-25 ping):** `MANIFEST_DEPLOY_URL` is wired (team report). `/api/status` and `/mission` green. `/api/ask` 503s until the committed corpus freeze deploys. 1.18 still needed for Granite+Guardian (`WATSONX_*`) and optional Blob overlay. After the freeze lands, ping Tylin: dispatch `uptime.yml` and require the run `success` via check-runs (never `--watch`).
- [ ] **Q11 (Stephen, 2026-08-24 ping):** `data/missions/*.json` landed (task 2.16). `app/api/status/route.ts` still uses the inline GT-1 seed. Please switch the status route to read `data/missions/gt-1.json`. Also D4 names ORBITM; shipped decay.py uses pyatmos only (claims-audit 3.6 mid-phase re-run).
- [ ] **Q12 (Stephen, 2026-08-24 ping):** Task 3.7 (second-model adversarial pass) is still open. Tylin's 3.6 freeze re-run for 4.1 cannot start until those fixes land. Mid-phase audit is in `docs/claims-audit.md` and does not count as the freeze audit.
- [ ] **Q7 (Stephen, before 1.10 ships):** Does `services.swpc.noaa.gov` send permissive CORS headers? If yes the solar fetch can run browser-side and works in the Capacitor static export with no server. If no, it must go through a route handler, which the static export cannot run, so the mobile build reads the cached `data/` artifacts instead. This decides an architecture, so answer it before writing the fetch.
- [x] **Q8 (Stephen, resolved 2026-08-16):** One submission per team, Space track or Wildcard track. The top 4 winners are selected from both tracks combined, no separate winner pools. Submit under Space (Advance Space Exploration with AI).

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Beta App Review rejects the wrapper under Guideline 4.2 | Mitigations shipped in advance: local notifications, native navigation, offline mode, and a reviewer note naming each and how to reach it. One resubmit maximum. Aug 26 gate enforces the floor. |
| Sixteen days, three people, large surface | Phase gates with written pass/fail. The engine is front-loaded and mobile is back-loaded so they do not compete. If a gate fails, the team rescopes together rather than one person deciding. |
| watsonx Lite token cap bites during judging | Rehearse everything on Ollama. Cache aggressively. Flip to Essentials pay-as-you-go if needed. |
| Eval cannot hold 90% | Stop rule at the Aug 19 checkpoint. Scope narrows to fewer regimes with deeper grounding rather than shipping ungrounded answers. |
| Part 100 effective-date notice drops mid-build | D3 exists for exactly this. Copy updates in one place, the regime switch is config. |
| Docling mangles a critical table | Spot-checked in Phase 1. Fall back to manual extraction for that table with the source cited. |
| Bobcoin exhaustion | Treat 40 each as one day of heavy use, not a month's budget. Code mode for routine edits, Orchestrator reserved for evidence-worthy runs, metered and logged at every phase boundary. If credits die early, the honest README line is "Bob as primary, not exclusive." |
| Effort lands on axes judging does not weigh | The video and project page get their own budget (D12), captured as features land (3.14) rather than crammed into the last two days. |
| A number is wrong in a spelled-out form the guard cannot see | D15. Numbers computed once into `docs/FACTS.json`, never per page load, and the anti-fabrication test checks digits and spelled-out numerals. |
| No validator replies in August | Q4. Ship on the three public missions and state plainly that no operator interview was obtained. Never manufacture a quote. |
| Android Studio not installed | Day-zero download, started first thing. If the SDK is not usable by Aug 22, the Android artifact is the PWA install and the APK is cut. |
| Surya inference fails on the demo machine | D7. Output is a cached frozen artifact. `easy_inference` documents MPS and CPU support, so this is low probability. |
| A rival ships the same idea | Other space-weather projects are likely in the field. The differentiation is the legal verdict. Do not position against rivals, and never position against IBM's own tooling. |
| PLAN.md drift | Atomic plan commits. 4-hour stale-lock TTL. |
| Deploy clobbers another Vercel project | Dedicated uniquely-named project. Verify `.vercel/project.json` before every `--prod`. |
| A number in the video is wrong and unfixable | `docs/FACTS.json` is generated by a real run and enforced by a test. The video reads from it. |

---

## The cut list, ranked, decided now rather than at 2am

This plan claims you will know exactly what to drop and when. Here is that list. **Cut in this order, top first.** Mark each ✂️ in the table with the date and the reason, because a silent cut reads as coverage you did not have.

| Order | What goes | Forced-decision point | What it costs, honestly |
|---|---|---|---|
| 1 | Web push (2.11) and the scheduled deadline workflow | Aug 21 | Nothing judge-facing. The deadline banner (2.9) is the primary alert and needs zero permissions, and local notifications (2.13) cover mobile with no server. Push was always the secondary channel. |
| 2 | External TestFlight (2.20) | **Aug 26 gate** | The public `testflight.apple.com` link. The floor (PWA, App Distribution, internal TestFlight on camera) is unaffected, per D8. |
| 3 | Surya (2.8) | Aug 23 | The sponsor-named model. The deorbit verdict still computes from NOAA alone. **If cut, the README says so plainly and the video never mentions Surya.** |
| 4 | The timeline view (2.3) | Aug 24 | A second visualization of data the graph already shows. The graph is the one that carries the demo. |
| 5 | Context Forge MCP (3.2) | Aug 25 | One line of Bob-evidence depth. The eval still runs locally and in CI. |
| 6 | Android APK and App Distribution (2.21) | Aug 25 | The native Android artifact. The installable PWA remains the Android story, and it is the zero-friction one anyway. |
| 7 | Interlocks 4 to 6 (1.16) | Aug 24 | Graph completeness. **If cut, amend `CLAUDE.md` in the same commit** so the master spec stops claiming six, and say in the README which three shipped. |

**Never cut, in any scenario:** the live deployed URL, `/api/status`, the engine and its tests, the cite-or-abstain path, the deorbit verdict, `docs/FACTS.json`, or the video. If those are at risk, cut from this list faster instead.

## Rollback paths

**A wrong corpus freeze.** Cite-or-abstain is the product thesis and its data had no recovery path. Procedure, and it is **explicitly exempt from the Aug 27 freeze** because a wrong citation is a claim defect, not a feature: regenerate the affected chunks from the pinned bulk XML, re-embed, rebuild the SQLite bundle, **diff the AMDDATEs against the previous freeze and record the diff in the commit message**, re-run the eval, and re-run `scripts/facts.py` so `docs/FACTS.json` matches. Every `Citation` consumer is revalidated by the eval, which is why the eval is the gate rather than a spot check.

**The deployed URL breaks during judging.** 3.10 detects and nothing responded to it. Add to Phase 4: after 4.3, **record the known-good deployment id** in `docs/FACTS.json`, and the rollback is `vercel rollback <id>` or promoting that deployment in the dashboard. **Stephen is on call from submission through judging close**, checks the URL and the watchdog's newest-run age once daily, and remembers that a red monitor is a claim about the world and not about the monitor: verify the app is actually supposed to be up before touching anything.

**Surya fails.** D7 already covers it: the demo reads a cached artifact. If the artifact itself cannot be produced by Aug 23, Surya is cut list item 3.

**A teammate goes dark.** Backup owners are named in the lanes section. A takeover suspends that lane's Bob write-scope, and the taker notes it in the Notes cell.

## Coordination Protocol

1. **Before starting a task:** set status to 🟡, add a timestamp in Notes, commit `PLAN.md` only, push. That is your lock.
2. **After finishing:** flip to ✅, commit `PLAN.md`, push.
3. **If blocked:** set to ⛔, add a one-line note, ping the other two.
4. **Before starting ANY task:** `git pull` and re-read `PLAN.md`. If someone has 🟡 on overlapping files, coordinate.
5. **Hotfixes:** skip the protocol, commit the fix, update `PLAN.md` after. Do not let process block a real emergency.
6. **`PLAN.md` commits are atomic.** Never bundle a status change with code. One-line status edit, commit, push.
7. **Commit messages.** Status updates: `status: [task #] [emoji] [description]`. Code: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). Contract changes: `⚠️ CONTRACT: [field], [reason]`.
8. **Handoffs:** add `→ [Name]` in the Notes column.
9. **Stale locks, TTL 4 hours.** A 🟡 task needs a fresh timestamp in Notes. No commit within 4 hours means the lock is stale and either of the other two can claim it by replacing the owner and bumping the timestamp. Ping first.
10. **Contract changes require announcement.** Ping before committing. `⚠️ CONTRACT` prefix. Contract drift is the number one small-team integration bug.
11. **No hooks, no CLI.** Coordination is manual. Edit this file by hand.
12. **No em-dashes anywhere**, including this file, commit messages, PR bodies, product copy and the video script. Use a colon for elaboration, a comma or parentheses for an aside, a period for a clause break, a hyphen for a range. Note that the PLAN.md format inherited from earlier repos used them in headings and empty table cells; this file does not. `scripts/no_em_dash.py --check` runs as a bare CI gate, and empty table cells read `n/a`.

**One commit per logical change.** Never bundle. The commit graph is a visible signal for a technical prize, and atomic commits are how you get one that reads like engineering rather than like a dump.

---

## CI rules, learned the hard way

These are not style preferences. Each one has cost a red main or a wrong published claim on a previous project.

1. **Every gate runs BARE. No pipe on the exit path.** A pipeline's exit code is its last command's, so `pytest | tail` reports tail's success and a failing suite merges green. Capture to a file if you need the tail, then branch on the bare exit code.
2. **A conditionally skipped test is a false green.** Under CI a guard must FAIL, never skip. Assert the suite collected tests and hard-fail on any `N skipped`: `echo "::error::The guard skipped a test. A skipped guard is a false green."`
3. **Guards resolve their file set with `git ls-files --cached --others --exclude-standard`**, not `git ls-files`. A tracked-files-only guard cannot see the file you are about to add.
4. **Never trust a `--watch` exit code.** After it returns, read `gh api repos/StephenSook/manifest/commits/<SHA>/check-runs --jq '.check_runs[] | select(.conclusion != "success") | .name'` and require that to be empty.
5. **Watch the post-merge run on `main`, on the merged SHA.** A rebase or squash merge rewrites SHAs and spawns a new run that can diverge from the green branch run. Capture `git rev-parse origin/main` and match `headSha`.
6. **Verify what a commit CONTAINS, not that it succeeded.** A multi-path `git add` can abort on one bad pathspec, leave your change unstaged, and still report success through the commit and the push.
7. **A red monitor is a claim about the world, not about the monitor.** Before debugging a checker, verify the premise it is checking.
8. **Content-check, never status-check.** A warm instance that lost its corpus still returns 200. An enterprise WAF serves a challenge page as 200.
9. **Never let an unverified figure become a test assertion.** A wrong number in an assertion is a bug the suite defends. Before writing an assertion with a number in it, ask which page it is on.
10. **A quote must be verbatim.** If you cannot paste it from the source, it is a paraphrase and must be labelled one.

---

## Real users and demo credibility

**Seed data, guaranteed, no consent needed.** All three are real missions with public records:

| Mission | Program | Why it is citable |
|---|---|---|
| **GT-1** | Georgia Tech SSDL | Published lessons-learned paper, SmallSat 2021, SSC21-P2-48, DOI 10.26077/s4a1-qn29, documenting a mission "originally slated to be designed, built, and delivered in nine months" that took over two years with schedule delays. This is the headline mission. |
| **DARLA-02** | Saint Louis University SSRL | NASA CSLI 15th round selection, announced 2024-03-18, launches 2025-2028. Public. |
| **ASTRA-HyRAX** | Auburn AUSSP | 3U, manifested on STP-S29A, EnduroSat bus, US Army SMDC funded. Public. |

**Outreach, sent day one.** Contact multiple university CubeSat programs in parallel because August is the worst month for faculty reply and one response is enough. Ask for actual filing and grant dates, which are not recoverable from public records, and for whether the schedule ever threatened the manifest. The target roster is local only.

**Attribution discipline, non-negotiable.** Substance in, attribution out. A quote lands as "a licensing lead at a US university CubeSat program" with the finding intact. No names, no emails, no institutions in the repo, the README, the video or the submission without explicit per-surface consent. Consent to be named on one surface is not consent on another. The roster PDF never gets staged.

**Beneficiary sizing, in the submission. VERIFIED to primary sources 2026-08-16, encoded in FACTS.json beneficiary_sizing with verbatim quotes and URLs.** Missions per year and the 40% failure rate: Swartwout and Jayne, 'University-Class Spacecraft by the Numbers', SmallSat 2016, digitalcommons.usu.edu/smallsat/2016/TS13Education/1 (both figures date to 2016, say so wherever used). Licensing runway: NASA CubeSat 101 (2017) Section 2.8 says 4 to 6 months, FCC minimum 90 days from receipt, IARU at manifest. The research pack's 'full year' claim was CUT: it contradicts the checkable primary. Manifest is for the teams who did not start early.

---

## Video beat sheet, 3:00 maximum

Every spoken number reads from `docs/FACTS.json`. Real screen captures are the primary evidence; generated media is garnish.

1. **Cold open, 0:00 to 0:25.** The documented near-miss: an integrator prepared to disable a deployer because the FCC license had not arrived, and demanifest as the stated consequence of late licensing, both documented in CubeSat 101. Then the GT-1 line: nine months planned, over two years actual.
2. **The product, live, 0:25 to 1:25.** Laptop. Enter the launch-vehicle determination date on a real seeded mission. The 97.207(g) dual clock opens and both deadlines appear. The critical path recomputes and the headline number lands on screen. Change the orbit to 550 km and the deorbit node flips to AT RISK, with the live F10.7 value and NOAA's uncertainty band visible.
3. **The thing nobody else has, 1:25 to 2:05.** Same satellite, same orbit, two launch dates a solar cycle apart, opposite legal answers. Show where the number comes from: live NOAA flux, NOAA's predicted envelope, Surya's outlook, the NRLMSISE-00 estimate, and the FCC 22-74 citation on the face of it. Then the phone on the desk buzzes with the pre-armed local notification.
4. **Cite or abstain, 2:05 to 2:35.** One grounded answer with its exact section citation and snapshot date. Then one abstention trap answered correctly by refusing, with the product saying exactly what is missing.
5. **How IBM Bob built it, 2:35 to 3:00.** Fast montage over real screens: the three write-scoped custom modes, the four skills, an Orchestrator delegation, the eval running as an MCP tool through Context Forge, and the CI gate that blocks a PR which regresses citations.

---

## Definition of done

- [ ] Public GitHub repo with `.bob/` committed, evidence folder populated, eval score published, all licenses permissive
- [ ] Live public demo on Vercel, installable PWA, offline corpus read working
- [ ] `/api/status` answers with no key and recomputes the headline number
- [ ] `/judge` page: numbered three-minute itinerary, every claim reachable without login, key, or a local run
- [ ] Eval at 90% or better with exact citations, all 6 abstention traps abstaining, gated in CI
- [ ] Video, 3:00 or under, loudness-measured, every number from `docs/FACTS.json`
- [ ] README with the five required sections: problem statement, solution description, AI approach and architecture, selected theme, how IBM Bob was used
- [ ] Wired-or-cut audit passed, including `.env.example`
- [ ] Android: Firebase App Distribution invite link live. iOS: internal TestFlight confirmed, external link if the Aug 26 gate said GO
- [ ] Learning activity complete for all three members
- [ ] No em-dashes, no blocklist terms, no third-party PII anywhere in the repo or submission
- [ ] Fresh-clone dry run passed on a clean machine
- [ ] Post-merge `main` CI verified green per job on the merged SHA

---

## Verification: how to prove this works end to end

Run in this order. Each step is checkable by someone who did not build it.

```bash
# 1. Fresh clone, no credentials
git clone https://github.com/StephenSook/manifest && cd manifest

# 2. Engine and interlocks, no network, no keys
npm ci && npm run test:engine
#    expect: 97.207(g) dual clock, NOAA-precedes-FCC, and deorbit compliance all green

# 3. Decay model against a known case
uv run --python 3.12 pytest pipeline/tests/test_decay.py -q
#    expect: 550 km 3U lifetime differs by more than 2x between solar max and solar min inputs

# 4. Eval bank, Ollama path, no watsonx spend
uv run python eval/runner.py --backend ollama
#    expect: >= 90% with exact citations, 6/6 abstention traps abstaining

# 5. Facts ledger is current and nothing was hand-edited
uv run python scripts/facts.py --check

# 6. Build and serve
npm run build && npm start
```

Then, against the deployed URL with no credentials at all:

```bash
curl -s https://<deployed>/api/status | jq
#    expect: the headline number, recomputed, with compute_ms and corpus_amddate

curl -s https://<deployed>/api/status | jq -e '.deadline_violations_days > 0'
```

Browser checks, via Playwright or by hand: load `/judge`, follow the numbered itinerary, confirm the graph renders, enter an LV determination date and watch both deadlines appear, change the orbit and watch the deorbit verdict flip, ask one corpus question and see a section citation with its AMDDATE, then ask an abstention trap and see the product refuse.

---

_Last updated: 2026-08-25 by Tylin. Q6 amended: hashing-trick freeze committed so `/api/ask` loads on Vercel without Blob. 4.3 in progress pending deploy. 3.7 landed (Q12 stale). Uptime `/api/ask` 503 waits on this freeze landing in the deploy._
