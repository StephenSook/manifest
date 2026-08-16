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

Expected: **74 tests passing**, 0 failures. These cover:
- Critical-path backward pass (diamond fixture hand-computed)
- 97.207(g) dual clock (30 days after LV det + 90 days before integration, binding = earlier)
- NOAA CRSRA prerequisite injection (imaging missions only)
- FCC 5-year deorbit compliance verdict with solar-cycle sensitivity
- Part 25/100 regime flag
- Re-work triggers (frequency change, orbit above 600 km, launch slip)

---

## Step 3: IBM Bob Evidence (20 seconds)

Open [`.bob/custom_modes.yaml`](.bob/custom_modes.yaml).

Five write-scoped modes restrict Bob's write access to each team member's lane. This is the only project in this field with a committed, inspectable `.bob/` directory.

| Evidence | Location |
|---|---|
| 5 custom modes with fileRegex write scopes | [`.bob/custom_modes.yaml`](.bob/custom_modes.yaml) |
| Workspace MCP config (eval server, no credentials) | [`.bob/mcp.json`](.bob/mcp.json) |
| Bobalytics screenshots | [`docs/bob-evidence/`](docs/bob-evidence/) |

---

## Step 4: The Live App (30 seconds)

- **Web app:** *(Vercel URL -- populated after first deploy)*
- `/judge` page: numbered 3-minute walkthrough, every claim reachable without login or key
- `/api/status`: unauthenticated, recomputes violated-deadline days live, self-reports which models are actually running

If Vercel is not yet deployed: `npm install && npm run test:engine` is the one-command deterministic proof.

---

## What this project is NOT claiming

- Surya is wired as a live-inference path; if it does not produce a real output by Aug 23, the README will say so plainly. The deorbit verdict computes from NOAA alone in that case.
- The CFR sub-paragraph paths in the interlocks are marked `VERIFY_FROM_SNAPSHOT` pending Tylin's eCFR parse (task 1.1). The section-level citations are confirmed.
- Every number in `docs/FACTS.json` comes from a real engine run. Until that file exists, numbers are placeholders and this file says so.
