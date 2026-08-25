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

Expected: **81 tests passing**, 0 failures. These cover:
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
| 5 custom modes with fileRegex write scopes | [`.bob/custom_modes.yaml`](.bob/custom_modes.yaml) |
| Workspace MCP config (eval server, no credentials) | [`.bob/mcp.json`](.bob/mcp.json) |
| Bobalytics screenshots | [`docs/bob-evidence/`](docs/bob-evidence/) |

---

## Step 4: The Live App (30 seconds)

- **Web app:** [manifest-web-roan.vercel.app/mission](https://manifest-web-roan.vercel.app/mission)
- **Judge page:** [manifest-web-roan.vercel.app/judge](https://manifest-web-roan.vercel.app/judge): numbered walkthrough, every claim reachable without login or key
- **Status API:** [manifest-web-roan.vercel.app/api/status](https://manifest-web-roan.vercel.app/api/status): unauthenticated, recomputes violated-deadline days live, self-reports which models are actually running
- **iOS:** build 1.0 (1) uploaded to App Store Connect, submitted for external TestFlight Beta App Review 2026-08-24

If the network is down: `npm install && npm run test:engine` is the one-command deterministic proof.

---

## What this project is NOT claiming

- Surya runs as a real forward pass whose output is a frozen artifact (`data/surya-outlook.json`), served by `GET /api/solar` (decision D7). If the artifact is absent the endpoint returns `surya_absent: true`. The activity index is reported for context and is NOT applied to the envelope or to the verdict: no code adjusts a NOAA number using it. We do not claim live Surya inference in the request path.
- The eval score today is 53.6 percent with all 6 abstention traps abstaining, measured on the credential-free extractive path and enforced in CI as a raise-only floor. The 90 percent bar applies to the full watsonx pipeline and will be published to `docs/FACTS.json`, dated, when that run happens. We do not claim 90 today.
- `/api/ask` reads the corpus committed in this repository, which is traced into the deployed function; Vercel Blob is an optional overlay and is not required. Without watsonx credentials the route answers from the offline extractive path over that same corpus rather than abstaining, and `/api/status` reports which backend answered. It abstains when the corpus genuinely cannot load or the question is not supported by the corpus, always with a stated reason, and it never fabricates.
- Every number in `docs/FACTS.json` comes from a real engine run, and the no-fabricated-numbers test enforces that README figures match it.
