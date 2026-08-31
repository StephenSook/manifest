# JUDGE.md

**90-second walkthrough for the judging session.**
Everything here is reachable without an account, without a key, and without running anything besides `npm install`.

---

## Step 1: The Differentiator (30 seconds)

Open [`data/decay-table.json`](data/decay-table.json). Find the rows where `altitudeKm` is `550.0` and `ballisticCoefficient` is `180.0`.

You will see:
- `lifetimeYearsLow` > 12 years (solar minimum -- **VIOLATED**, exceeds the FCC 5-year post-mission-disposal rule)
- `lifetimeYearsHigh` ~ 2.6 years (solar maximum -- **OK**, compliant)

**Same orbit. Same satellite. Opposite legal verdict. The solar cycle decides.**

This is not an assertion -- it is the output of a real NRLMSISE-00 integration run via `pipeline/decay.py`.
Regenerate it yourself: `pipeline/.venv/bin/python3 pipeline/decay.py` (no keys, ~3 minutes).

---

## Step 2: The Engine (20 seconds)

```bash
npm install && npm run test:engine
```

Expected: **123 tests passing**, 0 failures. These cover:
- Critical-path backward pass (diamond fixture hand-computed)
- 97.207(g) dual clock (30 days after LV det + 90 days before integration, binding = earlier)
- NOAA CRSRA prerequisite injection (imaging missions only)
- FCC 5-year deorbit compliance verdict with solar-cycle sensitivity
- Part 25/100 regime flag
- Re-work triggers (frequency change, orbit above 600 km, launch slip)
- Mobile deadline-alert scheduling (future-only, sorted, capped at the iOS 64-request limit)

The eval regression suite runs offline too: `python3 eval/runner.py --mode fixtures`
(28 questions + 6 abstention traps, exact-citation scoring, no network, no key).

---

## Step 3: IBM Bob Evidence (20 seconds)

Open [`.bob/custom_modes.yaml`](.bob/custom_modes.yaml).

Five write-scoped modes restrict Bob's write access to each team member's lane, and the whole `.bob/` directory is committed and inspectable.

| Evidence | Location |
|---|---|
| **Generated attribution table** (counts computed from the repo, and what the evidence does NOT prove) | [`docs/bob-evidence/ATTRIBUTION.md`](docs/bob-evidence/ATTRIBUTION.md), regenerate with `scripts/bob-attribution.sh` |
| 5 custom modes with fileRegex write scopes | [`.bob/custom_modes.yaml`](.bob/custom_modes.yaml) |
| Workspace MCP config (eval server, no credentials) | [`.bob/mcp.json`](.bob/mcp.json) |
| Lane enforcement (fileRegex, not a pasted chat) | [`docs/bob-evidence/lane-enforcement.md`](docs/bob-evidence/lane-enforcement.md) |
| Plan-mode session (never captured; honesty log) | [`docs/bob-evidence/plan-mode-critical-path.md`](docs/bob-evidence/plan-mode-critical-path.md) |
| Bobalytics screenshots (subscription usage) | [`docs/bob-evidence/`](docs/bob-evidence/) |
| Measured Bob spend across 3 subscriptions: 60.24 Bobcoins (into paid overage), 40.39 (budget exhausted), 19.141 of 40 units | [`bobalytics-02.png`](docs/bob-evidence/bobalytics-02.png), [`bob-usage.png`](docs/bob-evidence/bob-usage.png), [`bobalytics-03.png`](docs/bob-evidence/bobalytics-03.png) |

---

## Step 4: The Live App (30 seconds)

- **Web app:** [manifest-web-roan.vercel.app/mission](https://manifest-web-roan.vercel.app/mission)
- **Judge page:** [manifest-web-roan.vercel.app/judge](https://manifest-web-roan.vercel.app/judge): numbered walkthrough, every claim reachable without login or key
- **Status API:** [manifest-web-roan.vercel.app/api/status](https://manifest-web-roan.vercel.app/api/status): unauthenticated, recomputes violated-deadline days live, self-reports which models are actually running
- **iOS:** build 1.0 (1), approved by Apple in external Beta App Review on 2026-08-25. Public link: https://testflight.apple.com/join/huQrZpek

**Watch it refuse, one tap, no typing.** On [/mission](https://manifest-web-roan.vercel.app/mission), tap the suggested question **"When does Part 100 take effect?"**. It is a deliberate trap: Part 100 was adopted but has no announced effective date, so there is no answer to give. The product declines and returns the regime line verbatim rather than guessing:

> Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today.

Same thing from a terminal, no key:

```
curl -s -X POST https://manifest-web-roan.vercel.app/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"When does Part 100 take effect?"}'
```

That refusal is the product working, not failing. Six such traps are scored in the eval, and cite-or-abstain is the reason the score is 53.6 and not higher: an answer without a resolvable citation does not ship.

If the network is down: `npm install && npm run test:engine` is the one-command deterministic proof.

---

## What this project is NOT claiming

- Surya runs as a real forward pass whose output is a frozen artifact (`data/surya-outlook.json`), served by `GET /api/solar` (decision D7). If the artifact is absent the endpoint returns `surya_absent: true`. The activity index is reported for context and is NOT applied to the envelope or to the verdict: no code adjusts a NOAA number using it. We do not claim live Surya inference in the request path.
- The eval score today is 53.6 percent with all 6 abstention traps abstaining, measured on the credential-free extractive path and enforced in CI as a raise-only floor. The full watsonx pipeline was measured against production on 2026-08-29: 7.1 percent, all 6 traps abstaining, zero fabricated citations. Guardian rejects most generated answers rather than ship an ungrounded citation, so the pipeline fails closed instead of scoring points. Both numbers are in `docs/FACTS.json`. We do not claim 90.
- `/api/ask` reads the corpus committed in this repository, which is traced into the deployed function; Vercel Blob is an optional overlay and is not required. Without watsonx credentials the route answers from the offline extractive path over that same corpus rather than abstaining, and `/api/status` reports which backend answered. It abstains when the corpus genuinely cannot load or the question is not supported by the corpus, always with a stated reason, and it never fabricates.
- Every number in `docs/FACTS.json` comes from a real engine run, and the no-fabricated-numbers test enforces that README figures match it.
