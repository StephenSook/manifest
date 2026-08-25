# Tylin Tasks

Personal task tracker. Source of truth is PLAN.md. This file is a convenience view only.

Legend: [ ] not started · [-] in progress · [x] done · [!] blocked

---

## External credentials to gather (blocked work)

Nothing below is in this repo and nothing below should ever be committed. Put values in a local `.env` (gitignored) and, for production, in Vercel project settings (Khadim task 1.18) plus GitHub Actions secrets for `corpus-build.yml`. Placeholder names only. Region: `us-south`.

| Name | Where you get it | What it unblocks |
|---|---|---|
| `WATSONX_API_KEY` | IBM Cloud: Manage, Access (IAM), API keys. Needs a watsonx.ai project on Lite or Essentials. | Task 0.13 live model 200s. Production `/api/ask` Granite generate + Guardian. Optional Granite corpus embed. |
| `WATSONX_PROJECT_ID` | watsonx.ai project details page (UUID). | Same as the API key. Both are required together. |
| `WATSONX_REGION` | The region of that project. Use `us-south` unless the project was created elsewhere. | Same. Endpoint is `https://<region>.ml.cloud.ibm.com`. |
| `BLOB_READ_WRITE_TOKEN` | Vercel dashboard: Storage, Blob, or `vercel blob` token. Khadim provisions this in 1.18. | corpus-build.yml upload. Production `/api/ask` cold-start fetch of sqlite + vectors.f32. |
| `MANIFEST_DEPLOY_URL` | GitHub repo **variable** (Settings, Secrets and variables, Actions, Variables), not a secret. Set after Khadim 1.17. Example: `https://manifest-web.vercel.app` with no trailing slash. | Uptime workflow (3.10). It **fails** until this is set. Do not skip. |
| GitHub Actions secrets | Same four watsonx/blob names, on `StephenSook/manifest`. | Manual `workflow_dispatch` of `.github/workflows/corpus-build.yml`. |

**Do not gather (cut or not yours):** VAPID keys and Vercel KV were for web push (2.11), which is cut. `.env.example` lists placeholder names only. Khadim 1.18 still provisions the real values on Vercel and as GitHub Actions secrets. Vercel project name `manifest-web` is verified before any `--prod` (4.3).

**Lite cap (Q2):** 300,000 tokens/month and 2 requests/second. One 34-item eval is about 153,000 tokens (at most one live eval run per month). A full 3524-chunk Granite embed is about 700,000 tokens and will blow the cap. Keep the hashing-trick freeze until Essentials, or embed a subset. Rehearse eval on Ollama. Local smoke without keys: `uv run --python 3.12 --project pipeline python pipeline/scripts/watsonx_smoke.py` will fail-fast until the three `WATSONX_*` vars are exported.

**After keys exist, in this order:** (1) export the three watsonx vars and run `watsonx_smoke.py`, (2) flip 0.13 to done in PLAN.md, (3) ask Khadim to put the same vars plus the blob token on Vercel and GitHub, (4) run corpus-build with `hash_embeddings=true` until Lite can afford Granite embed, (5) set `MANIFEST_DEPLOY_URL` after the first deploy.

---

## Lane Ownership

Files you own exclusively:

- `pipeline/**` (except `pipeline/decay.py`, `pipeline/surya_infer.py`, `pipeline/tests/test_decay.py`)
- `corpus/**`
- `app/api/ask/**`
- `app/api/push/**`
- `.github/workflows/**` (except `eval-gate.yml`)
- `.bob/skills/**`
- `.gitleaksignore`
- `.gitignore`

---

## Phase 0: Scaffold (Sat Aug 15 to Sun Aug 16)

- [x] **0.5** Four Bob skills: `part-97-amateur`, `part-5-experimental`, `noaa-crsra`, `eval-bank`. Each with a `references/` folder. Location: `.bob/skills/*/SKILL.md`
- [x] **0.9** Python 3.12 venv pinned with `uv`. Files: `pipeline/pyproject.toml`, `.python-version`. System python is 3.14.6 and Docling will not run on it.
- [x] **0.10** CI skeleton: lint, typecheck, test, build, gitleaks, em-dash gate. Files: `.github/workflows/ci.yml`, `scripts/no_em_dash.py`. Every gate runs BARE (no pipe on exit path). Em-dash checker uses `git ls-files --cached --others --exclude-standard`.
- [!] **0.13** Verify watsonx: script ready. Live 200s blocked until `WATSONX_*` are gathered (see credentials table above). File: `pipeline/scripts/watsonx_smoke.py`

---

## Phase 1: Four Proof Legs (Sun Aug 16 to Wed Aug 19)

- [x] **1.1** Leg A. Parse eCFR bulk XML to citable sections. Nested `paragraphPath` repaired 2026-08-24 (`97.207(g)(1)` dual clock). AMDDATE Title 47 `2026-08-13`, Title 15 `2026-08-18`.
- [x] **1.2** Leg A. PDF corpus through Docling. NASA-STD-8719.14C not ingested (login wall). Q3 answered in PLAN.md.
- [x] **1.3** Leg A. Embeddings + SQLite bundle frozen. Hashing-trick-768 freeze committed 2026-08-25 so Vercel packs sqlite + vectors into `/api/ask`. Blob overlay still optional (`BLOB_READ_WRITE_TOKEN`).
- [x] **1.6** Leg B. Guardian audit wired, degrade-to-abstain on failure. File: `app/api/ask/route.ts`

---

## Phase 2: Core Product (Wed Aug 19 to Sun Aug 23)

- [x] **2.6** Q&A over the corpus, end to end. Granite+Guardian when keys exist. Extractive fallback without keys. File: `app/api/ask/route.ts`
- [x] **2.11** Web push. CUT 2026-08-24. Do not gather VAPID keys.
- [x] **2.16** Seed three real missions. Files: `data/missions/*.json`. Stephen still needs to point `/api/status` at `gt-1.json`.

---

## Phase 3: Hardening (Sun Aug 23 to Thu Aug 27)

- [x] **3.6** Wired-or-cut audit. File: `docs/claims-audit.md`. Re-run before freeze.
- [x] **3.8** Security scan + license audit. Files: `.gitleaksignore`, `docs/THIRD_PARTY_NOTICES.md`.
- [x] **3.10** Uptime watchdog. File: `.github/workflows/uptime.yml`. Blocked on `MANIFEST_DEPLOY_URL` after 1.17.

---

## Phase 4: Freeze and Submit (Thu Aug 27 to Sun Aug 30)

- [-] **4.3** Deploy the frozen build, run the eval once more, publish the score. Verify `.vercel/project.json` names `manifest-web` before `--prod`. Live URL is `manifest-web-roan.vercel.app`. `/api/ask` 503 is the missing sqlite; freeze is rebuilt and ready to push. No local `.vercel/project.json`, so `--prod` waits on Khadim's link or GitHub auto-deploy.
- [ ] **4.10** Post-merge main CI watched to completion on the merged SHA. Read `gh api repos/StephenSook/manifest/commits/<SHA>/check-runs` and require every conclusion to be `success`. Never trust a `--watch` exit code.

---

## Open Questions (Assigned to You)

- [x] **Q2** resolved 2026-08-24. See PLAN.md and the credentials table above.
- [x] **Q3** resolved 2026-08-24. See PLAN.md.
- [x] **Q6** resolved. Hashing-trick freeze committed 2026-08-25. Blob remains optional overlay.

---

## Contracts You Own

**`Citation` type** (consumed by Khadim and Stephen):

```ts
{ cfrTitle, part, section, paragraphPath, amddate, sourceUrl }
```

**`/api/ask` response shape** (consumed by Khadim):

```ts
{ answer: string | null, citations: Citation[], audited: boolean, abstained: boolean, reason?: string }
// answer is null whenever abstained is true
```

**Vector file format** (consumed by `app/api/ask/route.ts`): emit `corpus/vectors.f32` (raw little-endian `Float32Array`). TypeScript cannot read `.npy`. Dimensions go in `corpus/schema.json`. Record the commit/CI decision in Shared Contracts before 1.3 ships.

---

## Hard Rules

1. No em-dashes anywhere: code, comments, commits, docs, strings.
2. Every regulatory claim carries a section-level citation pinned to the snapshot `AMDDATE`, or the product abstains.
3. Stage named paths only. Never `git add -A`.
4. Every corpus chunk carries its `AMDDATE`.
5. CI gates run bare. No pipe on the exit path. A skipped test is a false green.
6. Commit format: `type(scope): description`. Status updates: `status: [task #] emoji description`. Never bundle a status change with code.
