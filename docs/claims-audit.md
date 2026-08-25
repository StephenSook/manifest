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
| Vercel Blob corpus fetch | app/api/ask/route.ts @vercel/blob list | WIRED. Requires BLOB_READ_WRITE_TOKEN (Khadim 1.18). Local path reads corpus/ files. |
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
| Corpus on the deployment | app/api/ask/route.ts loadCorpus, .github/workflows/corpus-build.yml | NOT PRESENT IN PRODUCTION. `POST /api/ask` returns 503. `corpus-build.yml` is dispatch-only and has never run, and could not succeed without `BLOB_READ_WRITE_TOKEN`. This is Khadim 1.18. Any claim that the corpus ships with the app is false: it loads from Vercel Blob. |
| `corpus_amddate` | app/api/status/route.ts | SENTINEL LIVE. Returns the literal `PENDING_CORPUS_FREEZE` on a judge-facing endpoint while hard rule 1 promises a pinned AMDDATE. Resolves with the corpus. |
