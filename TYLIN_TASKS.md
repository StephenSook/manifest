# Tylin Tasks

Personal task tracker. Source of truth is PLAN.md. This file is a convenience view only.

Legend: [ ] not started · [-] in progress · [x] done · [!] blocked

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

- [ ] **0.5** Four Bob skills: `part-97-amateur`, `part-5-experimental`, `noaa-crsra`, `eval-bank`. Each with a `references/` folder. Location: `.bob/skills/*/SKILL.md`
- [ ] **0.9** Python 3.12 venv pinned with `uv`. Files: `pipeline/pyproject.toml`, `.python-version`. System python is 3.14.6 and Docling will not run on it.
- [ ] **0.10** CI skeleton: lint, typecheck, test, build, gitleaks, em-dash gate. Files: `.github/workflows/ci.yml`, `scripts/no_em_dash.py`. Every gate runs BARE (no pipe on exit path). Em-dash checker uses `git ls-files --cached --others --exclude-standard`.
- [ ] **0.13** Verify watsonx: confirm `ibm/granite-4-h-small`, `ibm/granite-guardian-3-8b`, and `ibm/granite-embedding-278m-multilingual` all return 200. Record the region. File: `pipeline/scripts/watsonx_smoke.py`

---

## Phase 1: Four Proof Legs (Sun Aug 16 to Wed Aug 19)

- [ ] **1.1** Leg A. Parse eCFR bulk XML to citable sections. Title 47 Parts 5, 25, 97 and Title 15 Part 960 from `govinfo.gov/bulkdata/ECFR`. Citation paths come from hardcoded paragraph labels inside `<P>` elements, not `NODE` attributes. Pin each snapshot `AMDDATE` on every chunk. Files: `pipeline/ecfr_parse.py`, `corpus/chunks/*.json`
- [ ] **1.2** Leg A. PDF corpus through Docling. Ingest: FCC-26-47A1.pdf, FCC-22-74A1.pdf (5-year rule), NASA-STD-8719.14C, NASA CubeSat 101 (2017, flag the age), DAS 3.2 User's Guide. Spot-check table extraction on the FCC order appendix and the NASA standard tables before trusting them. File: `pipeline/docling_ingest.py`
- [ ] **1.3** Leg A. Embeddings + SQLite bundle frozen. Read-only bundle shipped with the app. Brute-force cosine is fine at this size. Resolve Q6 before this ships. Files: `corpus/manifest.sqlite`, `corpus/vectors.f32`
- [ ] **1.6** Leg B. Guardian audit wired, degrade-to-abstain on failure. Every citation-bearing answer goes through `ibm/granite-guardian-3-8b` before display. Fail audit means show retrieved sections and abstain. Abstention is a designed screen, not an error. File: `app/api/ask/route.ts`

---

## Phase 2: Core Product (Wed Aug 19 to Sun Aug 23)

- [ ] **2.6** Q&A over the corpus, end to end. Retrieval + `ibm/granite-4-h-small` generation + Guardian audit + degrade-to-abstain. Credentials server-side only, never in the client bundle. Deps: 1.3, 1.6. File: `app/api/ask/route.ts`
- [ ] **2.11** Web push, secondary channel. VAPID via `web-push`. Subscriptions must be stored server-side (Vercel KV/Blob) or scheduled push is impossible. GitHub Actions schedule with offset minutes (`4,14,24,34,44,54`), never `*/N` or `:00`. Add `workflow_dispatch` so it can be fired live in the demo. Delete subscriptions on 404/410. Dep: 2.10 (Khadim). Files: `app/api/push/**`, `.github/workflows/deadline-check.yml`
- [ ] **2.16** Seed three real missions. GT-1 (headline, `digitalcommons.usu.edu/smallsat/2021/all2021/21/`, DOI `10.26077/s4a1-qn29`), DARLA-02, ASTRA-HyRAX. Every date is DOCUMENTED with source or ESTIMATED with basis. Nothing invented. Moved off Stephen to rebalance Phase 2. Dep: 1.7. Files: `data/missions/*.json`

---

## Phase 3: Hardening (Sun Aug 23 to Thu Aug 27)

- [ ] **3.6** Wired-or-cut audit. For every named tool, model, and integration, grep the source for its import or call. If absent, cut or reword. Includes `.env.example`. Dep: 3.4. File: `docs/claims-audit.md`
- [ ] **3.8** Security scan + license audit. `gitleaks` over full history, not just the working tree. Every fingerprint hand-verified against its flagged commit before it goes in `.gitleaksignore`. Dependency license audit: confirm no `elkjs` (EPL/GPL) and no `orbdetpy` (GPL-3.0) reached the tree. Record ORBITM pinned commit and its MIT license. Files: `.gitleaksignore`, `docs/THIRD_PARTY_NOTICES.md`
- [ ] **3.10** Uptime watchdog on the deployed URL. Content-check, not status-code-check: a warm instance that lost its corpus still returns 200. Offset minutes. Dep: 1.17 (Khadim). File: `.github/workflows/uptime.yml`

---

## Phase 4: Freeze and Submit (Thu Aug 27 to Sun Aug 30)

- [ ] **4.3** Deploy the frozen build, run the eval once more, publish the score. Verify `.vercel/project.json` names `manifest-web` before `--prod`.
- [ ] **4.10** Post-merge main CI watched to completion on the merged SHA. Read `gh api repos/StephenSook/manifest/commits/<SHA>/check-runs` and require every conclusion to be `success`. Never trust a `--watch` exit code.

---

## Open Questions (Assigned to You)

- [ ] **Q2** (by Aug 17): Verify actual watsonx Lite token limits for your region. Compute how many tokens one eval run costs (34 items x retrieval + `granite-4-h-small` generation + `granite-guardian-3-8b` audit). State how many watsonx runs the monthly cap allows. Record answer in PLAN.md.
- [ ] **Q3** (by Aug 18): Does Docling's table extraction survive the FCC 26-47 appendix and the NASA-STD-8719.14C requirement tables? Name the three specific tables, confirm each round-trips to its source values. If one fails, extract by hand and mark it in the corpus.
- [ ] **Q6** (before 1.3 ships): Are `corpus/manifest.sqlite` and `corpus/vectors.f32` committed to git or built in CI? Measure the artifacts first, decide, then record the decision in Shared Contracts in PLAN.md.

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
