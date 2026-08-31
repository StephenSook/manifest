# Manifest freeze critical-path plan
# Thu Aug 27 feature freeze

**Scope:** Work remaining in Khadim's lane (3.9, 3.11, 3.16, 1.18) plus
the two cross-lane blockers that are Khadim's to action (Vercel deploy
path, undeployed code). Does not include Stephen's lane (3.1 eval-gate,
3.7 adversarial pass, video, submission copy) or Tylin's lane (3.6 full
re-run, 3.8 gitleaks, pyproject pin, uptime watchdog).

---

## Critical-path analysis

The true critical path to the Thursday freeze is:

```
K1 (deploy path) -> K2 (watsonx claim) -> K3 (orphan deps) -> K4 (Vercel deploy)
                                        -> K5 (Bob evidence) -> freeze
K6 (UI polish)  -> K7 (accessibility) -> freeze
K8 (Playwright) -> freeze (nice-to-have, not blocking)
```

K1 and K2 are the only items that would fail the 3.6 wired-or-cut audit
if shipped as-is. Everything else is polish or evidence.

---

## What would fail the 3.6 audit today (pre-freeze)

### Claim-versus-invoked mismatch (Q11)

`docs/claims-audit.md` line 66 documents this explicitly:

> watsonx generation, Guardian audit, granite embedding: WIRED IN CODE,
> NOT CREDENTIALED. `/api/status` now returns a `runtime` block naming
> the backend that actually answered.

That quote is preserved as written on the date of this plan. **The row it quotes was revised 2026-08-31**: watsonx generation and the Guardian audit are now credentialed in production, and the granite embedding turned out to be structurally unreachable rather than merely uncredentialed, because the committed corpus freeze picks the embedder. Read `docs/claims-audit.md` for the current statement, not this quote.

The README AI Approach section (lines 73-77) already states the condition
correctly: "Those credentials are not set on the current deployment, so
answers today come from the offline extractive path." The `runtime` block
in `/api/status` self-reports `generation_backend: offline-extractive` and
`guardian_audit: inactive`.

**Audit verdict: PASSES 3.6 AS WRITTEN.** The README and `/api/status`
both state the condition. A judge reading either surface will see the
honest disclosure. No claim-versus-invoked mismatch survives the 3.6
audit text because the audit text already names it and says it is
disclosed. Q11 raised a real concern, but the fix landed (the runtime
block and the README disclosure) before this plan was written.

**Action required:** zero. The honesty is already in the code and the
docs. What is NOT done is the Vercel deploy: the fix is committed but may
not be serving (see K1).

### Undeployed code (K1, BLOCKING)

`docs/claims-audit.md` line 103 records:

> There is NO GitHub auto-deploy on the Vercel project. 36 commits pushed
> to main on 2026-08-25, production still served a pre-fix build.
> `/api/status` returned `scenarios: 0`, no `runtime` block, and
> `corpus_amddate: PENDING_CORPUS_FREEZE`.

This is the single most dangerous item. Every judge-facing claim about
what `/api/status` returns, what the corpus loads, and whether the
extractive fallback disclosure is visible is FALSE on the live URL until
a `--prod` deploy runs against the current HEAD. The judge page and the
README both point judges at the live URL as the primary proof surface.

### Orphan dependencies (K3, audit item)

`docs/claims-audit.md` line 106:

> `package.json` carries four dependencies with zero first-party
> references: `@tanstack/react-table`, `vis-timeline`, `@playwright/test`,
> `happy-dom`. `docs/THIRD_PARTY_NOTICES.md` lists three as if in use.

`vis-timeline` and `@tanstack/react-table` are listed in
`THIRD_PARTY_NOTICES.md` as actively used. The 3.8 license audit will
catch this. The risk is not GPL exposure (both are permissive) but a
judge reading `THIRD_PARTY_NOTICES.md` and finding two named components
that produce no visible UI.

### Bob evidence gap (K5, prize-bearing)

`docs/claims-audit.md` line 107-108, and JUDGE.md step 5:

> `docs/bob-evidence/` is missing the plan-mode transcript (1.13) and the
> Orchestrator transcript (2.22). Both are named in the README evidence
> table, now marked "not yet committed". `app/judge/page.tsx` step 5
> promises an Orchestrator transcript.

The judge page has a step that points at a file that does not exist. This
is the pattern the rival-audit pass called the most damaging kind of
error: a judge clicking a path that does not resolve learns something
worse about the rest of the table than the missing file itself.

---

## What can be cut without cost

### 3.9 Playwright smoke

Status: zero spec files. `@playwright/test` is installed, the `test:e2e`
script is present, but `tests/e2e/` is empty.

The README "Running Locally" block was already corrected (post-3.7 pass)
to document `test:engine` and `test:ask`, not `test:e2e`. No judge-facing
document currently promises a Playwright suite.

**Cut verdict: CAN BE CUT with zero judge-facing cost if K3 removes
`@playwright/test` and `happy-dom` from `package.json` at the same time,
and `tests/e2e/` is removed or left empty with no reference to it.** If
wired, a single smoke covering load-mission-graph-ask is enough and takes
about two hours. The value is catching deploy regressions before a judge
does. This is a judgment call for Khadim: wire it if time permits before
the freeze; cut cleanly if not.

### 1.18 env vars (partial)

`.env.example` is already present and correct. The WATSONX credentials
provisioning in Vercel project settings is Stephen/Tylin's action (they
hold the IBM Cloud account). Khadim's action in 1.18 is:

1. Vercel Git integration OR a confirmed manual `--prod` deploy path.
2. Confirm `MANIFEST_DEPLOY_URL` is set as a GitHub Actions variable so
   the uptime watchdog does not fail-by-absence.

The credentials themselves are not Khadim's to provision. 1.18 is
therefore mostly done once K1 is resolved.

---

## Sub-tasks, ordered by priority

---

### K1: Verify and fix the Vercel deploy path
**Owner:** Khadim
**Status:** [x] DONE, verified 2026-08-31. `GET /api/status` on the production URL
returns `generation_backend: watsonx` and `guardian_audit: active`, so a
deploy carrying the watsonx path did reach production. The path is manual
`vercel --prod` from Khadim's account, NOT GitHub auto-deploy, so it stays a
per-release action rather than a solved problem: see K4.
**Blocks:** everything judge-facing

**Intent:** Every judge-facing claim about the live URL is only as good as
the last deploy. 36 commits pushed without a deploy reaching prod is a
proven failure mode. This must be exercised before the freeze, not on it.

**Expected outcomes:**
- `GET https://manifest-web-roan.vercel.app/api/status` returns a response
  that includes `scenarios` (non-empty array), `runtime` block with
  `generation_backend` and `guardian_audit` fields, and
  `corpus_amddate` containing a real date span, not `PENDING_CORPUS_FREEZE`.
- Either: Vercel Git integration is connected so pushes to `main` trigger
  a production deploy automatically. Or: a confirmed manual command
  (`vercel --prod --yes`, with `.vercel/project.json` naming `manifest-web`)
  is documented in PLAN.md Open Questions as the deploy mechanism, and
  Khadim has run it against HEAD at least once.
- `MANIFEST_DEPLOY_URL` is set as a GitHub Actions repository variable
  so the uptime watchdog does not fail-by-absence.

**Todo:**
1. Run `cat .vercel/project.json` and confirm `projectName` is
   `manifest-web` (not a generic name).
2. Run `vercel --prod --yes` from the repo root.
3. Wait for the build to complete, then `curl -s https://manifest-web-roan.vercel.app/api/status | python3 -m json.tool | grep -E 'scenarios|runtime|corpus_amddate'` and verify all three are present with real values.
4. Decide: connect Vercel Git integration (preferred, eliminates the
   class of failure), or document the manual command as the deploy
   procedure and commit that documentation to PLAN.md.
5. Confirm `MANIFEST_DEPLOY_URL` is set: `gh variable list` should show it.

**Files:** `.vercel/project.json` (read-only check), PLAN.md (note)

---

### K2: Resolve the WATSONX claim
**Owner:** Khadim (flag to Stephen) + Stephen (credentials)
**Status:** [ ] pending
**Blocks:** 3.6 freeze re-run

**Intent:** Q11 raised that claimed and invoked do not match. The
technical fix (runtime block, README disclosure) is already in the code.
The remaining action is to decide, before the freeze, whether credentials
will be set in Vercel for judging week. If yes: Stephen provisions them,
Khadim verifies the runtime block flips. If no: the current disclosure is
the ship state, and that is an honest and acceptable outcome.

This is a decision, not a code task. It needs to be made explicitly so
the 4.1 freeze gate is not ambiguous.

**Expected outcomes:**
- Either: `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` are set in Vercel
  project settings, a deploy runs, and `/api/status` returns
  `runtime.generation_backend: watsonx`. The AskPanel on `/mission` then
  exercises the full Granite + Guardian path.
- Or: credentials are deliberately not set, the current extractive-
  fallback disclosure is the ship state, and this decision is recorded in
  PLAN.md as a freeze-decision entry.

**Files:** Vercel project settings (not in repo). PLAN.md if a decision
is recorded.

**Note:** Do not add or change any claim in README.md, JUDGE.md or
docs/submission.md in response to this task. The honest disclosure is
already there. This task is about the deployment state matching what the
docs say, not about rewriting the docs.

---

### K3: Cut orphan dependencies
**Owner:** Khadim
**Status:** [x] DONE, verified 2026-08-31. `@tanstack/react-table` and
`vis-timeline` are no longer declared. `happy-dom` was NOT an orphan: it has
first-party references and stays. `@playwright/test` was the last real one,
declared with zero references anywhere but prose, and is cut in the same
commit that carries this line.
**Blocks:** 3.6 and 3.8 audits, THIRD_PARTY_NOTICES.md accuracy

**Intent:** Four dependencies with zero first-party references.
`docs/THIRD_PARTY_NOTICES.md` names `vis-timeline` and
`@tanstack/react-table` as if they are in active use. They are not.
A judge reading that file will look for a timeline and a data table, find
neither, and conclude the notices document is unreliable, which contaminates
its credibility on the dependencies that ARE in use.

**Expected outcomes:**
- `package.json` no longer lists `vis-timeline`, `@tanstack/react-table`.
- If 3.9 Playwright is cut: `@playwright/test` and `happy-dom` are also
  removed from `package.json`.
- `docs/THIRD_PARTY_NOTICES.md` no longer mentions components that produce
  no UI. (This file is in Stephen/evidence-writer lane: raise a PR note
  or ping Stephen, do not edit directly.)
- `npm run build` still passes after the removal.

**Todo:**
1. Remove `vis-timeline` and `@tanstack/react-table` from
   `package.json` dependencies.
2. If 3.9 is cut: also remove `@playwright/test` and `happy-dom`.
3. Run `npm install` to update `package-lock.json`.
4. Run `npm run build` and confirm it passes.
5. Ping Stephen to remove `vis-timeline` and `@tanstack/react-table`
   from `docs/THIRD_PARTY_NOTICES.md` (his lane).

**Files:** `package.json`, `package-lock.json`

---

### K4: Force a production deploy and verify live state
**Owner:** Khadim
**Status:** [ ] OPEN, and re-measured 2026-08-31: production is behind `main` again.
Probed live: the `build`, `components`, `pipeline` and `corpus_shape` blocks
are all ABSENT from `/api/status`, and `POST /api/ask` still returns only
`['abstained', 'answer', 'audited', 'citations']` with no `scope` field. So
every merge after the watsonx fix is invisible on the judge-facing URL. K1
being green does not carry K4: a manual deploy path has to be RUN, and this
recurrence is the reason the status above says per-release action.

**Intent:** After K1 establishes the deploy path and K3 makes the final
pre-freeze package changes, run a clean deploy and confirm every
judge-facing endpoint returns the expected shape. This is the one-time
verification that the ship state matches the claims.

**Expected outcomes** (all verifiable by `curl`, no login):
- `/api/status`: `scenarios` array non-empty, `runtime` block present,
  `corpus_amddate` is a real date span.
- `POST /api/ask` with `{"question":"What is the pre-space notification deadline under 47 CFR 97.207(g)(1)?"}`: returns HTTP 200 with a `citations` array, not a 503.
- `/api/solar`: returns `f107_live` as a number (not null, unless NOAA
  is genuinely unreachable).
- The `/judge` page loads without a console error and the StatusPanel
  shows the wired model inventory.

**Todo:**
1. Merge any outstanding changes to `main`.
2. Run `vercel --prod --yes` (or confirm Git integration triggered a
   build).
3. Wait for build completion.
4. Run the four `curl` checks above and record results in PLAN.md.

**Files:** PLAN.md (verification note)

---

### K5: Commit the Bob evidence artifacts
**Owner:** Khadim
**Status:** [ ] pending
**Blocks:** JUDGE.md step 5, README evidence table, prize scoring

**Intent:** The judge page (step 5) points at an Orchestrator transcript
that does not exist. The README evidence table says "not yet committed"
for two entries. These are the highest-value judge-visible gaps: a link
that 404s in the evidence trail is more damaging than a missing feature,
because it signals the evidence trail is not trustworthy.

**Expected outcomes:**
- `docs/bob-evidence/plan-mode-critical-path.md` exists (task 1.13). This
  is the Plan-mode transcript for the build's critical path. Content: the
  output of a Plan-mode session, not a fabricated summary. Use the current
  session output (this planning session is the critical-path plan, so its
  transcript is the artifact).
- ~~`docs/bob-evidence/orchestrator-run.md` exists (task 2.22)~~ **CUT
  2026-08-31, and it was never possible.** Bob 2.0.3 has no Orchestrator mode:
  a grep over `/Applications/IBM Bob.app` finds `orchestrator` only inside
  TypeScript's own compiler files, and the switcher offers Agent, Plan and Ask
  plus the five workspace modes. This plan asked for a transcript of a mode
  that does not exist, so the file was correctly never created. The honesty log
  `docs/bob-evidence/plan-mode-critical-path.md` records what actually happened.
  Inventing the transcript was the alternative and it is the fabrication line. The AskPanel build (task 2.5) used Bob's Plan mode
  and Agent mode with subagent spawning. If a session with that shape
  exists in history, extract and commit it. If not, run one targeted
  Orchestrator session (e.g. delegating the architecture diagram cross-
  check to a subagent) and commit its transcript.
- `docs/bob-evidence/bobalytics-01.png` through `bobalytics-03.png` are
  already present (confirmed in subagent read). No action needed there.
- README evidence table rows for plan-mode and orchestrator-run no longer
  say "not yet committed" (ping Stephen, his lane).

**Files:** `docs/bob-evidence/plan-mode-critical-path.md` (the orchestrator file is cut, see above)

---

### K6: UI polish pass
**Owner:** Khadim
**Status:** [ ] pending
**Blocks:** K7 (accessibility depends on polish being stable)

**Intent:** Task 3.11. The product should look like a regulatory
instrument, not a demo. The work here is a targeted pass on the surfaces
judges will actually see: `/judge` and `/mission`.

**Expected outcomes** (the 3.11 definition of done):
- Every screen has a designed empty state. On `/mission`, the state before
  a mission is saved should show a prompt to fill the form, not a blank
  gap where the graph would be. On `/judge`, the state while the
  StatusPanel is loading should show a skeleton, not a blank.
- The full mission-entry flow is completable with the keyboard alone
  (Tab through all fields, Enter to submit, focus goes to first error if
  validation fails). The AskPanel (just built) must also be keyboard-
  complete: Tab to textarea, type, Enter to submit, Tab to suggested
  questions.
- Mobile layout: the form and the judge page are readable on a 390px
  viewport without horizontal scroll.

**Note:** The task says "no gradient-and-glass landing page energy." This
means: no shadows, no rounded-corner cards with background blur, no
decorative colors. The existing surface token (`--color-surface`),
border token (`--color-border`), and monospace stack are correct. Polish
means tightening density and filling empty states, not redesigning.

**Files:** `app/mission/page.tsx`, `app/judge/page.tsx`,
`components/graph/DependencyGraph.tsx`, `components/deorbit/DeorbitPanel.tsx`,
`components/abstain/AskPanel.tsx`, `components/deadline-banner/DeadlineBanner.tsx`

---

### K7: Accessibility pass
**Owner:** Khadim
**Status:** [ ] pending (depends on K6 being stable)
**Blocks:** 3.16 done

**Intent:** Task 3.16. Both prior wins from this organizer cited
accessibility. This is a real pass with two tools, not a claim.

**Expected outcomes:**
- `axe` (via the browser devtools plugin or `axe-core` CLI) reports zero
  serious or critical violations on `/judge` and `/mission`.
- A keyboard-only walkthrough covers: load `/mission`, Tab to first field,
  fill the form, Tab to Submit, Enter, see the graph update, Tab to AskPanel,
  type a question, Enter, see a response. No mouse needed at any point.
- Common failure modes to check: missing `aria-label` on icon-only buttons,
  `role="status"` on live regions, focus traps in the response region,
  color contrast on `--color-muted` text against `--color-surface` (the
  existing tokens from `globals.css` use oklch and should pass WCAG AA,
  but verify rather than assume).

**Note:** The AskPanel built in task 2.5 already has `aria-live="polite"`,
`aria-label` on form and lists, and keyboard submission. The main surfaces
to audit are the graph (React Flow has known focus issues with SVG nodes)
and the deorbit panel.

**Files:** `components/**`, `app/mission/page.tsx`, `app/judge/page.tsx`

---

### K8: Playwright smoke (conditional)
**Owner:** Khadim
**Status:** [ ] pending (can be cut if time does not permit)

**Intent:** Task 3.9. A golden-path smoke test that catches deploy
regressions before a judge does. Not currently blocking any judge-facing
claim (the README no longer documents `test:e2e`).

**Wire it if time permits before the freeze. Cut cleanly if not.**

If wired, the minimum viable suite (one spec file, four steps):
1. Load `/mission`, fill a mission (use `page.fill` on each date/number
   field), submit.
2. Assert the dependency graph node count is greater than zero (wait for
   the React Flow nodes to render).
3. Assert the deorbit panel shows a verdict token
   (`OK` or `VIOLATED` or `AT_RISK`).
4. Click the "When does Part 100 take effect?" suggested question in the
   AskPanel, wait for the response region to update, assert the response
   contains "abstain" or "Part 100 was adopted".

If cut: remove `@playwright/test` and `happy-dom` in K3, remove the
`test:e2e` script from `package.json`, and confirm `tests/e2e/` is either
empty or removed.

**Files:** ~~`tests/e2e/smoke.spec.ts`~~ **CUT.** No Playwright spec was ever written, and the dead `test:e2e` script was removed from `package.json` on 2026-08-31 rather than left pointing at a runner with no inputs.

---

## Decision register

These decisions need to be made before the freeze. Record each outcome in
PLAN.md.

| Decision | Options | Who decides |
|---|---|---|
| Vercel deploy path | Git integration (auto) or manual `--prod` (explicit) | Khadim |
| WATSONX credentials in Vercel | Set before judging week (Granite + Guardian live) or not (extractive fallback is the ship state) | Stephen + Khadim |
| Playwright 3.9 | Wire (minimum viable suite above) or cut cleanly in K3 | Khadim |

---

## What Stephen's lane must complete before the 4.1 freeze gate

These are not Khadim's tasks but the freeze gate (4.1) is blocked on them.
Listed here so Khadim can raise the blockers if they have not moved.

| Task | Current state | What is needed |
|---|---|---|
| 3.1 eval gate in CI | `eval-gate.yml` EXISTS and is wired correctly (confirmed) | Nothing: this is done |
| 3.6 full re-run | Partial pass done 2026-08-25. Freeze re-run still required after 3.7 | After Khadim's K3 changes land, ping Tylin to run the full re-grep |
| 3.7 adversarial pass | 10 rounds closed (commits `2712f97` through `13fb44b`) | If any new code has landed since, run one more round |
| 4.1 FACTS.json regeneration | Must run `scripts/facts.py` against the deployed HEAD before freezing | Stephen's action on freeze morning |
| `THIRD_PARTY_NOTICES.md` | Remove `vis-timeline` and `@tanstack/react-table` after K3 removes them | Ping Stephen when K3 is done |
| Vercel Git integration | Tylin owns `.github/workflows/`; if a deployment workflow is the chosen path it is Tylin's file | Khadim's choice of deploy path determines whether this is needed |

---

## What Tylin's lane must complete before the 4.1 freeze gate

| Task | Current state | What is needed |
|---|---|---|
| `pipeline/pyproject.toml` pyatmos pin | Missing per claims-audit line 101 | Add `pyatmos==1.2.7` and `setuptools<81` |
| `.gitleaksignore` false positive | Zero entries, scan is noisy | Add fingerprint for `1a9c419` false positive |
| `.bob/skills/noaa-crsra/SKILL.md` dead pointer | Points at `noaa-precedes-fcc.ts` which does not exist | Repoint at `engine/graph.ts:339-342` |
| 3.6 full re-run | Due after Stephen's 3.7 fixes and Khadim's K3 changes | Run the full grep per the method in `docs/claims-audit.md` |
| 3.8 gitleaks + license audit | `THIRD_PARTY_NOTICES.md` will need updating after K3 | Run after K3 is done |
| `MANIFEST_DEPLOY_URL` GitHub variable | Unknown if set | `gh variable list` - set if absent |

---

## Non-goals

- Writing any code in Stephen's lane (engine, eval, scripts, services).
- Writing any code in Tylin's lane (pipeline, corpus, `app/api/ask/`).
- Adding the timeline view (task 2.3 is cut, stays cut).
- Adding the citation panel component (task 2.4 is not built, and no
  judge-facing surface currently promises it).
- Provisioning WATSONX credentials (IBM Cloud account is Stephen's).
- Any feature work after the Thursday freeze: corrections and guard-adds
  only after 4.1.
