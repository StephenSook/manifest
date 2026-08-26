# Wired-or-cut audit (task 3.6)
# Mid-phase re-run 2026-08-24. First pass same day. Re-run again after
# Stephen 3.7 fixes land, and before freeze (PLAN.md 4.1): every named
# tool, model, and integration must have an import or call in shipped code.
# If absent, cut the claim or reword. Includes .env.example.

## Method

Commands run from repo root. A claim is WIRED if grep finds an import or call
in application source (not only PLAN.md / README). A claim is CUT if the
README or FACTS.json names it but shipped code does not invoke it.

```
git ls-files --cached --others --exclude-standard | grep -v corpus/chunks
```

Re-run 2026-08-24 searched those paths for the claim list below.

## Models

| Claim | Where claimed | Grep | Verdict |
|---|---|---|---|
| ibm/granite-4-h-small | README, FACTS.json, /api/status, /api/ask | app/api/ask/route.ts textGeneration modelId | WIRED. Invoked only when WATSONX_API_KEY is set. Extractive fallback otherwise. |
| ibm/granite-guardian-3-8b | README, FACTS.json, /api/ask | app/api/ask/route.ts Guardian modelId | WIRED. Fail-closed to abstain when the call errors. |
| ibm/granite-embedding-278m-multilingual | README, FACTS.json, pipeline | pipeline/embed_and_store.py, app/api/ask/route.ts embedQueryWatsonx | WIRED as the production embedder. Local freeze currently hashing-trick-768 because Lite cannot embed 3524 chunks (Q2). schema.json.model records which ran. |
| hashing-trick-768 | corpus/schema.json, /api/ask | pipeline/embed_and_store.py, app/api/ask/lib.ts hashEmbed | WIRED as the Lite-cap freeze. Do not claim Granite embed ran on the frozen bundle until schema.json.model says so. |
| nasa-ibm-ai4science/Surya-1.0 | README, FACTS.json, data/surya-outlook.json | pipeline/surya_infer.py | WIRED as a frozen artifact (D7). Not a live inference path in /api/ask. |
| granite4.1:8b Ollama | README local_fallback, /api/status | status route MODEL_INVENTORY only | DISCLOSED as rehearsal. /api/ask does not call Ollama. Do not claim it as the production generator. |

## Integrations

| Claim | Grep | Verdict |
|---|---|---|
| eCFR bulk XML parser | pipeline/ecfr_parse.py | WIRED |
| Docling PDF ingest | pipeline/docling_ingest.py | WIRED. NASA-STD-8719.14C JSON is an empty array (login wall). |
| Vercel Blob corpus fetch | app/api/ask/route.ts @vercel/blob list | WIRED as optional overlay. Production freeze is committed sqlite+vectors (Q6 amended 2026-08-25). Blob requires BLOB_READ_WRITE_TOKEN (Khadim 1.18). |
| NOAA SWPC F10.7 | services/solar/fetch.ts | WIRED (Stephen) |
| pyatmos NRLMSISE-00 | pipeline/decay.py | WIRED (Stephen) |
| ORBITM | no import in shipped tree | CUT FROM CODE. D4 names ORBITM. pipeline/orbitm_vendor/ is gitignored and empty of commits. decay.py uses pyatmos only. Ping Stephen (Q11) to cut ORBITM from README/D4 copy or pin a MIT commit. |
| IBM Context Forge / eval MCP | .bob/mcp.json, eval/mcp_server.py | SPLIT VERDICT, re-checked 2026-08-25. The stdio MCP server IS now in the tree and Bob-wired (`.bob/mcp.json` points at `eval.mcp_server`, tools `run_eval` and `eval_last_report`, verified returning real scores). The Context Forge GATEWAY layer is NOT registered and is not committed. Claim the stdio MCP server; do not claim Context Forge. README repo-layout line corrected 2026-08-25. |
| web-push / VAPID | no app/api/push | CUT. Task 2.11 cut 2026-08-24 (cut list item 1). Deadline banner is the primary alert. |
| elkjs | package.json, package-lock.json | ABSENT (required: no EPL/GPL). CI license-guard fails on a match. |
| orbdetpy | pipeline/pyproject.toml, pipeline/uv.lock | ABSENT (required: no GPL-3.0). CI license-guard fails on a match. |

## .env.example

File present. Placeholder keys only, empty values: WATSONX_API_KEY, WATSONX_PROJECT_ID, WATSONX_REGION, BLOB_READ_WRITE_TOKEN. No VAPID (2.11 cut). MANIFEST_DEPLOY_URL is documented as a GitHub Actions variable, not an app secret. Vercel and GitHub secret provisioning is still Khadim 1.18.

## Honesty line for README

Production Q&A is granite-4-h-small plus Guardian when watsonx credentials are present. Without credentials the route returns an extractive quote of retrieved corpus text and sets audited=false. The frozen corpus embed is hashing-trick-768 (schema.json.model). The corpus snapshot AMDDATE is 2026-08-13 (Title 47) and 2026-08-18 (Title 15). NASA-STD-8719.14C is not ingested.

## Freeze re-run

Do not treat this mid-phase pass as the 4.1 audit. After Stephen 3.7 fixes land, repeat the same grep against the post-fix tree. An audit from before those fixes has audited nothing.

## Post-3.7 partial re-run, 2026-08-25 (Claude, Stephen's lane)

3.7 closed at ten rounds (fix commits `d75575b` through `eb7f2cb`). This is a partial re-grep of the post-fix tree, covering what that pass touched plus three exposures the PLAN status audit surfaced the same day. It does not replace Tylin's full 4.1 re-run.

| Claim | Grep | Verdict |
|---|---|---|
| `vis-timeline` | installed in package.json, zero imports in app/ components/ lib/ engine/ mobile/ | UNUSED DEPENDENCY. Task 2.3 never landed. No judge-facing document claims a timeline view, so this is not a false claim, but the dependency should be cut at the freeze or the view wired. Left in place here deliberately: package.json is Khadim's lane and a lockfile change inside the freeze window is not worth the risk. |
| shadcn/ui | no components.json, no components/ui/, no radix or cva dependencies | NEVER INITIALISED. Named in the private architecture doc only. No judge-facing document claims it, so nothing to cut publicly. Do not add it to any Built With list. |
| Playwright e2e | `@playwright/test` installed, `test:e2e` script present, zero spec files, no workflow step | CLAIM CUT 2026-08-25. The README "Running Locally" block documented `npm run test:e2e` with nothing behind it; that block now documents `test:engine` and `test:ask`, which do run. Task 3.9 remains open. |
| watsonx generation, Guardian audit, granite embedding | app/api/ask/route.ts | WIRED IN CODE, NOT CREDENTIALED. The route calls `granite-4-h-small` and `granite-guardian-3-8b` when `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` are present. Neither is set anywhere: `gh secret list` is empty. `/api/status` now returns a `runtime` block naming the backend that actually answered, so configured-versus-running is one unauthenticated request to check. Submission copy states the credential condition explicitly. |
| Corpus on the deployment | app/api/ask/route.ts loadCorpus, next.config.ts outputFileTracingIncludes, corpus/manifest.sqlite | SUPERSEDED THE SAME DAY by Tylin's `564dc22`. The frozen hashing-trick bundle is now COMMITTED (3.5 MB sqlite, 10.3 MB vectors), `loadCorpus` reads the local files first and treats Blob as an optional overlay, and `next.config.ts` names the three files in `outputFileTracingIncludes` for `/api/ask` because Next's file tracing cannot follow a `process.cwd()` join. The repo claim "the corpus ships with the app" is therefore TRUE again. **Production is a separate question and currently still fails**: at 2026-08-25 10:50 ET `POST /api/ask` returns 503 with `ENOENT ... /var/task/corpus/manifest.sqlite`, which is the pre-fix build still being served. Verify against the live URL after the next deploy before claiming it anywhere. |
| `corpus_amddate` | app/api/status/route.ts | FIXED 2026-08-25. The endpoint returned the literal `PENDING_CORPUS_FREEZE` on a judge-facing surface while hard rule 1 promises a pinned AMDDATE. It now reads `amddate_range` from the committed freeze at request time and returns the real span (`2017-08-01 to 2026-08-18`). If the corpus is ever absent it returns the NAMED absence `CORPUS_NOT_BUNDLED` rather than a date-shaped placeholder, so a missing corpus cannot read as a verified snapshot. |

## Post-rival-audit pass, 2026-08-25 (Claude, Stephen's lane)

A whole-repo claims pass plus a forensic grading of the live gallery produced a
checklist of failure modes drawn from other submissions, then ran each one back
against Manifest. Diff-scoped adversarial review had run fourteen clean rounds
and was structurally blind to all of this, because every file involved was
individually correct when it was written. What drifted was the relationship
between them.

### Refuted and now fixed

| Claim | Was | Verdict | Fix |
|---|---|---|---|
| `GET /api/solar` returns `f107_live`, `predicted_envelope`, `surya_outlook` | Printed on `app/judge/page.tsx` step 4 as a judge verify command | **REFUTED.** `git log --all -- 'app/api/solar*'` was EMPTY: the route had never existed in any commit on any branch, and returned 404 | Route BUILT (312060a) with exactly those field names, pinned by test. The claim is now true rather than the sentence edited |
| Surya artifact "that the demo reads" | `README.md:78` | **REFUTED.** `data/surya-outlook.json` was read by no shipped code; its only TypeScript reference was a comment | Now genuinely read and served by `/api/solar` |
| Verdict "computed from live NOAA solar flux" | `README.md` in three places | **REFUTED.** `services/solar/fetch.ts` had ZERO importers; the verdict imports a frozen table | README rewritten to describe both accurately: frozen NRLMSISE-00 integration across NOAA's published bounds, live reading served separately at `/api/solar` |
| `services/solar/fetch.ts` parses NOAA correctly | Unit-tested, green | **REFUTED, and worse than dead.** The predicted product spells the month key `time-tag` with a HYPHEN. The parser read `time_tag`, so `undefined >= "2026-08"` was false for every row and it returned an EMPTY envelope for healthy live data. Its test passed because the fixture was written from the same assumption as the code | Fixed (4960688) with a fixture captured from the live endpoint. The observed product also returns a single-element ARRAY, not an object |
| "CI asserts the self-report matches the README" | `docs/submission.md:51` and `app/api/status/route.ts` in three places | **REFUTED.** No workflow ran pytest at all. `tests/test_no_fabricated_numbers.py` had NEVER executed in CI | `fabricated-numbers` job added to `eval-gate.yml`, every step bare, presence asserted before a pass is trusted |
| "79 engine and mobile tests" | `README.md` twice, `JUDGE.md` once | **REFUTED.** Measured 81. The README badge said 128 against a measured 144 | Corrected, and the guard now compares judge-facing surfaces to FACTS rather than only FACTS to the code. Proven by injecting 77 and watching it fail |
| Eval score "is there" in `docs/FACTS.json` | `app/judge/page.tsx` step 3 | **REFUTED.** The file had no `eval`, `score`, `trap` or `abstention` key | `scripts/facts.py` now runs the bank and writes a real eval block. Claim made true rather than edited |
| `runtime.corpus_source` | `/api/status` | **REFUTED.** Derived from `BLOB_READ_WRITE_TOKEN` alone, so it answered `not-configured` while the committed freeze was serving | Reports what actually loaded |
| `.bob/` names the stack | `custom_modes.yaml` | **REFUTED.** Named shadcn/ui (never initialised) and vis-timeline (zero imports), and advertised a cut `/api/push` route in five places | Cut. `.bob/` is judge-read Bob evidence, so a wrong claim here costs more than one in the README |
| `python eval/runner.py --backend ollama` | `.bob/rules-agent/AGENTS.md` | **REFUTED.** No such flag. The same file documented `python tests/test_no_fabricated_numbers.py`, which has no `__main__` block, so it collects nothing and exits 0. Bob was told to verify our anti-fabrication guard with a command that always passes | Replaced with the commands CI runs |
| Corpus "stored in Vercel Blob" | `README.md:76` vs `docs/submission.md:83` | **REFUTED.** Two judge-facing files contradicted each other; `corpus/schema.json` sides with submission.md | README corrected |
| `pip install -r pipeline/requirements.txt` | `README.md` | **REFUTED.** No such file | Replaced with the `uv sync` command |
| Decay table reproducible in under 3 minutes | `README.md` Judge Quick Access | **REFUTED.** Fails with `ModuleNotFoundError: No module named 'pkg_resources'`; setuptools 81 removed it and `pyatmos` imports it | Documented command now carries the verified `setuptools<81` pin. Permanent fix is a pyproject declaration, which is Tylin's lane, in the handoff |

### Still open, out of Stephen's lane

| Item | Owner | What is needed |
|---|---|---|
| `pipeline/pyproject.toml` declares neither `pyatmos` nor a setuptools pin, though `pipeline/decay.py:90` imports pyatmos | **Tylin** | Add `pyatmos==1.2.7` and `setuptools<81`. Verified locally that the pin fixes the import |
| `.github/workflows/ci.yml` runs no `services/` suite and no pytest job | **Tylin** | The new `eval-gate.yml` job covers pytest; `services/solar` still runs in no CI job |
| **There is NO GitHub auto-deploy on the Vercel project, and PLAN 4.3 said there was.** Measured 2026-08-25: 36 commits pushed to `main` that day, and production still served a build older than the 10:35 commit. `/api/status` returned `scenarios: 0`, no `runtime` block, and `corpus_amddate: PENDING_CORPUS_FREEZE`, while `computed_at` updated per request, so the function was live and only the code was stale. | **Khadim** | Either connect Git integration so pushes deploy themselves, or confirm `--prod` runs by hand, and EXERCISE it once before the Thursday freeze rather than on it. A path that has not fired in 36 pushes is an assumption. Verify `.vercel/project.json` names `manifest-web` first: a generic link clobbers another project's production, which has happened before on this machine. |
| **Full-history gitleaks reports 1 finding, and it is a FALSE POSITIVE.** `phase0-plan.md:96` documents a local command as `WATSONX_API_KEY=... uv run ...`. The value is literally three dots. Hand-verified against commit `1a9c419`: 3 characters, no digits, no alphanumerics. The `generic-api-key` rule fires on the assignment shape, not on a secret. | **Tylin** | Add the fingerprint to `.gitleaksignore`, which currently exists but has zero entries, so a full-history scan exits 0. The reason this matters is not the false positive itself: it is that a known-noisy scan is where a real leak goes unnoticed. Do NOT edit `phase0-plan.md` to dodge it; the documentation is correct as written. |
| `.bob/skills/noaa-crsra/SKILL.md` points at `engine/interlocks/noaa-precedes-fcc.ts`, which does not exist | **Tylin** | Repoint at `engine/graph.ts:339-342`, where the behaviour actually lives |
| `package.json` carries four dependencies with zero first-party references: `@tanstack/react-table`, `vis-timeline`, `@playwright/test`, `happy-dom` | **Khadim** | Cut them, or wire them. `docs/THIRD_PARTY_NOTICES.md` lists three as if in use |
| `docs/bob-evidence/` is missing the plan-mode transcript (1.13) and the lane-enforcement transcript (2.22, was "Orchestrator" until Bob 2.0.3 was found to have no such mode) | **Khadim** | Both are named in the README evidence table, now marked "not yet committed". 2.22 is prize-bearing |
| `app/judge/page.tsx` step 5 promises an Orchestrator transcript, and Bob 2.0.3 has no Orchestrator mode | **Khadim** | The sentence must be reworded, not waited on: verified by grep over `/Applications/IBM Bob.app` that the only `orchestrator` matches are inside TypeScript's own compiler files. Resolves when 2.22 lands as a lane-enforcement transcript. Steps 3 and 4 are now TRUE with no edit needed, because the artifacts they name were built rather than the sentences rewritten |

## Freeze re-run, 2026-08-26 (Stephen, backup on 3.6)

Post-3.7 tree, after Khadim's vis-timeline/tanstack removal and after production caught up. Grep set: `git ls-files --cached --others --exclude-standard`. No edits in Tylin's tree (`app/api/ask/**`, `corpus/**`, `pipeline/**` except decay, `.bob/skills/**`, `ci.yml`).

### Closed since the 2026-08-25 handoff

| Item | Was | Now |
|---|---|---|
| pyatmos / setuptools pin | Open, Tylin | CLOSED. `pipeline/pyproject.toml` declares `pyatmos==1.2.7` and `setuptools<81` (commit `60d2147`). |
| gitleaks false positive | Open, Tylin | CLOSED. `.gitleaksignore` carries fingerprint `1a9c419...:phase0-plan.md:generic-api-key:96` (commit `ca261e0`). |
| NOAA skill dead path | Open, Tylin | CLOSED. `.bob/skills/noaa-crsra/SKILL.md` points at `engine/graph.ts` and names the test file honestly (commit `d9b7865`). |
| vis-timeline and `@tanstack/react-table` in package.json | Open, Khadim | CLOSED as dependencies. Both ABSENT from `package.json` (commit `2b46358`). Residual comments remain: `app/mission/page.tsx:9` and `app/judge/page.tsx:418` still name vis-timeline. Those files are Khadim's. |
| Production `/api/ask` 503 / missing corpus / missing runtime | Open, Khadim | CLOSED as a content-check. 2026-08-26 live: `/api/status` 200 with `runtime` and AMDDATE span `2017-08-01 to 2026-08-18`, `/api/solar` 200, `POST /api/ask` 200 citing `97.207(g)(1)`. GitHub auto-deploy is still NOT connected. Manual `--prod` is what landed. |

### Still true

| Claim | Grep | Verdict |
|---|---|---|
| granite-4-h-small / guardian / granite-embedding | `app/api/ask/route.ts` | WIRED IN CODE, NOT CREDENTIALED. `gh secret list` is empty. Live `runtime`: `generation_backend=offline-extractive`, `embedding_backend=hashing-trick-768`, `guardian_audit=inactive`. |
| hashing-trick-768 freeze | `corpus/schema.json`, `app/api/ask/lib.ts` | WIRED. What production actually embeds with. |
| Surya-1.0 | `pipeline/surya_infer.py`, `/api/solar` | WIRED as a frozen artifact served by `/api/solar`. Not applied to the deorbit verdict. |
| NOAA SWPC | `services/solar/fetch.ts` | WIRED |
| pyatmos NRLMSISE-00 | `pipeline/decay.py` | WIRED |
| eval MCP stdio | `.bob/mcp.json`, `eval/mcp_server.py` | WIRED |
| Context Forge gateway | no registration, PLAN 3.2 parked | CUT FROM CLAIM. Judge page step 5 still says "via IBM Context Forge (task 3.2)". Khadim. |
| web-push / `app/api/push` | no route, no `web-push` dep, no `deadline-check.yml` | CUT. PLAN 2.11 row was still ⬜; cut list item 1 already named it. |
| ORBITM | `pipeline/orbitm_vendor/` gitignored, not imported by `decay.py` | CUT FROM CODE |
| elkjs / orbdetpy | lockfiles | ABSENT |
| shadcn/ui | no `components.json`, no `components/ui/` | NEVER INITIALISED. Not claimed on judge-facing docs. |
| Playwright e2e | `@playwright/test` in package.json, `test:e2e` script, zero spec files | STILL UNWIRED. 3.9 open. happy-dom is also present and unused (`vitest.config.ts` environment is `node`). |
| Orchestrator transcript | `app/judge/page.tsx:356` | STALE CLAIM. Bob 2.0.3 has no Orchestrator. Khadim. |
| plan-mode + lane-enforcement transcripts | `docs/bob-evidence/` is three PNGs | MISSING. 1.13 and 2.22. Khadim. |

### Live eval (4.3 half, Stephen)

`python3 eval/runner.py --mode url --url https://manifest-web-roan.vercel.app --min-score 0` on 2026-08-26: **15/28 (53.6 percent), 6/6 traps abstaining**. Same passing ids as the committed fixtures. Recorded in `docs/FACTS.json` as `eval_live` (separate from the clone-reproducible `eval` fixtures block). Production runtime at measurement: offline-extractive, hashing-trick-768, guardian inactive. The 90 percent bar still belongs to a credentialed watsonx path (0.13).

Re-measured the same day at 21:17 UTC (report `/tmp/manifest-eval-live.json`, then `scripts/facts.py --live-report`). Score, trap count, passing ids, and runtime block were unchanged. `gh secret list` on `StephenSook/manifest` is still empty. Content-check (not status-code-check) of production: `/api/status` 200 with `deadline_violations_days=161` and AMDDATE `2017-08-01 to 2026-08-18`; `/api/solar` 200 with `f107_live` and `surya_outlook`; `POST /api/ask` 200 citing `97.207(g)(1)` with `audited=false`.

### Still open, out of Stephen's lane

| Item | Owner | What is needed |
|---|---|---|
| watsonx 0.13: models return 200, credentials in Vercel | **Tylin** | `WATSONX_*` are not in GitHub secrets and live runtime is extractive. Do not claim Granite generation is running. |
| `services/solar` vitest suite is not in `ci.yml` (eval-gate covers `tests/` pytest and facts.py) | **Tylin** | Add the services project to a CI job, or confirm `npm run test` already covers it and wire that job. |
| `docs/THIRD_PARTY_NOTICES.md` still lists vis-timeline and `@tanstack/react-table` | **Tylin** (task 3.8) | Drop the rows. package.json no longer carries them. |
| Playwright e2e / happy-dom leftover | **Khadim** | Wire 3.9 or cut the dep and the `test:e2e` script. |
| vis-timeline leftover copy on `/mission` comment and `/judge` pending table | **Khadim** | 2.3 is cut. |
| Orchestrator + Context Forge sentences on `/judge` step 5 | **Khadim** | Reword to lane-enforcement transcript + stdio eval MCP. |
| 1.13 plan-mode transcript, 2.22 `lane-enforcement.md` | **Khadim** | Prize-bearing. |
| GitHub auto-deploy still absent | **Khadim** | Manual `--prod` is the path. Do not write "auto-deploy" in judge-facing copy. |

### Added from the 2026-08-26 whole-repo grep (explore pass, then re-verified)

| Item | Owner | Status |
|---|---|---|
| `/judge` "What is not wired yet" table still lists eval, solar, corpus, abstention as pending, plus the cut timeline | **Khadim** | STALE. The itinerary above that table tells the judge those surfaces exist. |
| `.bob/custom_modes.yaml` said vis-timeline "is installed with zero imports" | **Stephen** | FIXED this session: the dep was removed in `2b46358`. |
| `eval/mcp_server.py` module docstring described Context Forge as the running architecture | **Stephen** | FIXED this session: docstring now matches stdio-only. |
| Video Beat 5 staged `docs/bob-evidence/lane-enforcement.md` and narrated it as inspectable | **Stephen** | FIXED this session: still skipped unless the file exists. |
| `JUDGE.md` said TestFlight was "submitted 2026-08-24" while README said approved 2026-08-25 | **Stephen** | FIXED this session: JUDGE now matches the approved public link. |
| PLAN 1.18 notes still name "the VAPID pair" and KV because 2.11 "declares durable subscription storage mandatory" | **Stephen PLAN / Khadim 1.18** | STALE vs the 2.11 cut. `.env.example` already has no VAPID. PLAN notes should drop VAPID/KV; remaining 1.18 work is WATSONX_* in Khadim's Vercel project (Tylin supplies the values) plus optional Blob. |

### Freeze re-verify, 2026-08-26 later (Stephen, backup on 3.6/4.3)

Parent grep, not a Tylin-tree edit. File set: `git ls-files --cached --others --exclude-standard`. PDF count: 0.

| Claim | Evidence this pass | Verdict |
|---|---|---|
| vis-timeline / @tanstack/react-table in package.json | absent from dependencies and devDependencies | still CLOSED as deps |
| vis-timeline leftover copy | `app/mission/page.tsx:9`, `app/judge/page.tsx:418` | still Khadim |
| notices table | `docs/THIRD_PARTY_NOTICES.md` lines 14-15 still list both | still Tylin 3.8 |
| web-push / VAPID / `app/api/push` / `deadline-check.yml` | none of those paths exist; `.env.example` has no VAPID | still CUT |
| Playwright e2e | `@playwright/test` and `test:e2e` present; `tests/e2e` directory does not exist; `happy-dom` present, vitest env is `node` | still UNWIRED, Khadim |
| shadcn | no `components.json`, no `components/ui/` | still NEVER INITIALISED |
| Context Forge vs stdio MCP | `.bob/mcp.json` points at `eval.mcp_server` stdio; judge page step 5 still says Context Forge | still SPLIT, Khadim copy |
| Orchestrator | `app/judge/page.tsx:356` | still STALE, Khadim |
| inverted pending table | `app/judge/page.tsx:413-418` still lists eval, solar, citation, abstention, timeline as waiting | still STALE, Khadim |
| watsonx credentials | `gh secret list` empty; live runtime extractive | still Tylin 0.13 |
| pyatmos pin / NOAA skill path / gitleaks fingerprint | unchanged from the earlier freeze section | still CLOSED |
| Git auto-deploy | Stephen's Vercel team has no `manifest-web` project (Khadim owns the production alias); production is live via manual `--prod` | still Khadim |
| elkjs / orbdetpy / ORBITM import | absent / gitignored vendor / `decay.py` uses pyatmos | still ABSENT / CUT FROM CODE |
