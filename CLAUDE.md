# CLAUDE.md - Manifest

Operating guide for AI-assisted work on this repository.

NOTE ON TOOLING: IBM Bob is the primary development tool for this project (competition requirement). The constraints in this file are mirrored in `.bob/rules-*` and `.bob/skills/`, which are the committed source of truth for Bob. This file exists so that any other assistant (Claude CLI, etc.) follows identical constraints during planning or support work. Bob does the building.

## 1. What Manifest is

Manifest is a regulatory critical-path planner for US university CubeSat missions. It models the multi-agency licensing campaign (IARU coordination, ITU filing via the FCC, FCC pathway across Part 5 experimental / Part 97 amateur / Part 25, NASA orbital debris assessment, NOAA remote sensing if imaging) as a dependency graph against an immovable launch date. Every regulatory claim is grounded in a versioned citation to the governing text or the tool explicitly abstains. The tool is dual-regime aware: it knows the FCC adopted Part 100 (FCC 26-47) on July 22, 2026, that the effective date is unannounced, and that Part 25 remains binding until the Space Bureau says otherwise.

What Manifest is NOT: a chatbot about space law, a form filler, a legal advice tool, or a conformance scorer.

## 2. Hard product rules (never violate)

1. **Cite or abstain.** No regulatory statement ships without a section-level citation (example: 47 CFR 97.207(g)(1)) pinned to the ingested snapshot's AMDDATE. If the corpus cannot support an answer, the product says exactly what is missing. Abstention is a feature, not a failure.
2. **The Part 100 line, verbatim policy.** "Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today." Never say Part 100 "replaced" Part 25. The regime-switch trigger is a future FCC Space Bureau public notice, nothing else.
3. **Documented vs estimated lead times.** Every duration in the graph carries a label: DOCUMENTED (with source) or ESTIMATED (with basis). Never present folklore as fact. CubeSat 101's licensing figures are documented but date to 2017; flag that when used.
4. **No synthetic load-bearing data.** Sample missions use real, public mission data (SPOC, GT-1, and similar) with real dates where recoverable and clearly labeled estimates where not. Nothing invented.
5. **Generic UI.** No named personas anywhere in the product, screenshots, or repo. Roles only ("mission lead", "licensing owner").
6. **Copy style.** Plain language, concrete numbers, no marketing tone. No em-dashes anywhere in product copy, docs, or commit messages. Use commas, colons, or parentheses.
7. **IARU materials.** Parse the IARU coordination request instructions locally for the graph logic; cite and link to iaru.org. Never redistribute the form or instruction text in the repo or app.

## 3. Locked architecture

### Frontend (the product's face)
- Next.js 15 App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui (new-york style).
- Dependency graph: `@xyflow/react` 12.x with `@dagrejs/dagre` auto-layout. Client component only; gate on mounted or dynamic import (SSR sizing gotcha). Do not use the unscoped `dagre` package (deprecated) or `elkjs` (EPL/GPL license, avoid unless a multi-parent layout forces it).
- Timeline: `vis-timeline` 8.5.x behind a thin client wrapper.
- Tables: TanStack Table 8.21.x (v8, not the v9 beta). Charts if needed: Recharts 3.x.
- Design intent: dense, serious regulatory instrument. It should look like it belongs next to a NASA standard. No gradients-and-glassmorphism landing page energy.

### PWA and notifications
- Serwist 9.5.x (`@serwist/next`) service worker. Manifest: name, short_name, start_url, display "standalone", theme_color, background_color, 512x512 icon plus apple-touch-icon.
- The PRIMARY alert surface is the in-app deadline banner, computed on load. It must work with zero notification permissions.
- Web push (VAPID via `web-push`) is the secondary channel. Scheduled push requires server-side subscription storage: store PushSubscriptions in Vercel KV/Blob. Scheduler: GitHub Actions scheduled workflow hitting a protected Vercel route, with `workflow_dispatch` so it can be fired manually during the demo. Vercel Hobby cron is once per day with up to 59 minutes of jitter; do not rely on it for timely alerts. Handle 404/410 by deleting dead subscriptions.
- iOS reality: web push only works for home-screen-installed PWAs (iOS 16.4+), install is manual via the share sheet, delivery is best-effort. Never stake a demo on a live iOS web push.

### Mobile native variant (stretch, gated)
- Capacitor 8 wrapping a Next.js static export (`output: 'export'`) in a dedicated build variant. Never ship `server.url` in a store build.
- In the Capacitor variant there is no server at runtime: no route handlers, no middleware, no request-time server components; move dynamic calls to client fetches against the hosted API; `images.unoptimized: true`.
- `@capacitor/local-notifications` fires deadline alerts with NO push server on both platforms. iOS keeps only the soonest 64 pending requests (system limit): schedule the nearest 64 and reschedule on every app open. Android: add SCHEDULE_EXACT_ALARM to the manifest, check `checkExactNotificationSetting()` on launch, request the Android 13+ notification permission at a sensible moment.
- 4.2 (minimum functionality) mitigations that must exist before any TestFlight external submission: local notifications, at least one native navigation surface, a working offline mode, and an App Review note naming each native feature and how to reach it.
- Toolchain: Xcode 26 required (mandatory for all App Store Connect uploads since April 28, 2026; runs on macOS Sequoia). Android Studio Otter or newer. Signed APK/AAB output for Firebase App Distribution.

### Backend and data
- Production backend: Vercel serverless route handlers only. watsonx credentials (IAM API key, project_id) live in Vercel env vars and never reach the client.
- No live database. The corpus ships as a bundled read-only SQLite file plus precomputed embedding vectors. The user's mission plan lives client-side in IndexedDB. Nothing is transmitted or stored server-side except push subscriptions (KV/Blob).
- Batch pipeline (local, Python): Docling 2.117.x for the PDF corpus; direct lxml parsing for eCFR bulk XML (Docling does not accept arbitrary regulatory XML). Outputs frozen artifacts committed or bundled: chunked sections with citation paths, embeddings, the SQLite corpus.

### Corpus (ingest exactly this)
- eCFR bulk XML: Title 47 (Parts 5, 25, 97) and Title 15 (Part 960) from govinfo.gov/bulkdata/ECFR. Pin each snapshot's AMDDATE and store it with every chunk. Citation paths are reconstructed by parsing the hardcoded paragraph labels ("(g)", "(1)") inside the P elements of each DIV8 section; element nesting does not encode paragraph depth. DIV5 = Part, DIV8 = Section. Ignore the NODE attribute (internal, unstable).
- Part 100 text: Appendix A of FCC-26-47A1.pdf (docs.fcc.gov). It is not in eCFR until effective. Ingest separately, tagged PENDING regime.
- PDFs via Docling: FCC-26-47A1.pdf, NASA-STD-8719.14C, NASA CubeSat 101 (2017, flag age), FCC Part 5 FAQ pages as HTML.
- Spot-check Docling table extraction on the FCC order appendix and the NASA standard requirement tables before trusting them.

### AI layer
- Generation: `granite-4h-small` on watsonx.ai (Lite plan: 300K tokens/month, 2 requests/second, region us-south).
- Audit: `granite-guardian-3-8b` reviews every citation-bearing answer for groundedness before display. An answer that fails audit degrades to abstention with the retrieved sections shown.
- Retrieval: `granite-embedding-278m` over the precomputed index (brute-force cosine in the route is fine at this corpus size).
- Local fallback, disclosed in the README: Ollama `granite4.1:8b` plus `granite-embedding:278m`. Rehearse on Ollama; spend watsonx tokens only on the live demo and video capture. If Lite limits bite during judging week, flip that runtime instance to Essentials (pay-as-you-go) rather than staying capped.

## 4. Dependency engine spec (the core)

Nodes carry: agency, required inputs, outputs, documented-or-estimated duration with source, fees, re-work triggers, and consequence of lateness. Edges are hard prerequisites. The engine computes the critical path backward from the immovable integration/delivery date and surfaces every violated or at-risk constraint.

Interlocks that MUST fire correctly (these are the acceptance tests):
1. **97.207(g) dual clock**: pre-space notification due within 30 days after launch-vehicle determination AND no later than 90 days before integration. Entering an LV determination date must open the window and set both deadlines.
2. **FCC waits for NOAA**: if the mission images Earth, the FCC license cannot complete before the NOAA CRSRA license exists (CubeSat 101 Ch. 2.8). The NOAA node (60-day statutory clock after completeness) becomes a predecessor of FCC grant.
3. **IARU before Part 97**: amateur pathway requires the IARU coordination letter as a practical prerequisite, and the request itself wants the ITU API number.
4. **ITU API via FCC**: 2 to 3 months to publication (shortening post-WRC-23); the FCC will not grant without the ITU filing made.
5. **Delivery is the wall**: the launch provider's delivery date is a hard deadline; consequence of missing licensing by delivery is demanifest (documented in CubeSat 101, including a deployer-disable near-miss).
6. Re-work triggers: frequency change forces IARU re-coordination; orbit above roughly 600 km forces a propulsion/drag decision under the FCC 5-year rule; launch slip recomputes every clock.

## 5. Evaluation (non-negotiable)

- The regression suite is the 28-question eval bank plus 6 abstention traps (in `/eval`). Passing bar: 90% or better, with exact citations, and all abstention traps abstaining.
- The suite runs locally and in CI. A PR that lowers the score does not merge.
- The eval runner is exposed as an MCP tool through IBM Context Forge so Bob can invoke it during development. Context Forge installs via PyPI on Apple Silicon (`pip install mcp-contextforge-gateway`, port 4444, JWT auth); bridge to Bob via `mcpgateway.wrapper` with MCP_AUTH bearer token and MCP_SERVER_URL http://localhost:4444/servers/UUID. Do not use the Docker image on the Macs (no arm64 production image).

## 6. IBM Bob usage (competition evidence layer)

- Bob is the primary development tool. `/init` output and the `.bob/` directory are committed and never gitignored.
- Custom modes live in `.bob/custom_modes.yaml` with fileRegex-restricted write scopes (example: a corpus mode that can only write under `/corpus`, an evidence mode that can only write under `/docs`).
- Skills live in `.bob/skills/<name>/SKILL.md` with YAML frontmatter (name, description) and a `references/` folder. One skill per regulatory regime plus one for the eval bank. Skills load in Advanced mode.
- Orchestrator mode delegates regime-specific work to subagents (one per regime). Plan-mode output for the build's critical path is committed under `/docs/bob-evidence/`.
- Bobalytics screenshots land in `/docs/bob-evidence/` weekly.
- Budget: the university trial grants roughly 40 Bobcoins per person; plan the team's month against 120 total. Prefer Code mode for routine edits; reserve Orchestrator and Advanced runs for work that shows in the evidence trail.
- The README section "How IBM Bob Was Used" is a living document, updated as features land, with links to the evidence folder.

## 7. Conventions

- TypeScript strict; no `any` without a comment.
- Client-only wrappers for React Flow, vis-timeline, and Recharts containers.
- Env vars: WATSONX_API_KEY, WATSONX_PROJECT_ID, WATSONX_REGION, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, KV credentials. Never in client bundles, never in the repo.
- Commits: imperative, concrete, reference the plan item ("engine: fire 97.207(g) dual clock on LV date entry").
- Every merged feature is wired or absent. No dead buttons, no mocked panels presented as live.
- Tests: engine interlocks have unit tests; the eval suite is the integration bar.

## 8. Repo layout

Workspace root is `~/dev/IBM August/` (moved off Desktop 2026-08-15). That single
folder is BOTH the private research workspace and the code repo. Build the app in
place at this root, beside the research PDFs and BUILD_PLAN.md. Do not create a
separate code directory, a nested project folder, or a second repo elsewhere.

Privacy: the research PDFs, BUILD_PLAN.md, and any strategy material stay local and
never reach GitHub. `.gitignore` already blocks them from the first commit. Stage
named paths only, never `git add -A`, and run `git ls-files | grep -i '\.pdf$'`
(expect zero) before any push. Ask before pushing, adding a remote, or making a repo
public.

```
/app            Next.js app (App Router)
/components     UI components
/engine         dependency graph + critical path (pure TS, unit-tested)
/corpus         frozen corpus artifacts (SQLite, embeddings, chunk JSON)
/pipeline       Python batch: Docling ingest, eCFR lxml parse, embedding build
/eval           eval bank (28 + 6), runner, MCP server for Context Forge
/mobile         Capacitor variant config and native projects
/docs/bob-evidence   Bobalytics screenshots, Plan-mode outputs, mode/skill docs
.bob/           Bob modes, skills, rules, mcp.json (committed)
.github/workflows    CI (eval on PR), scheduled deadline check (workflow_dispatch)
```
