# Manifest: BeMyApp submission page copy (task 3.15)

Draft for `aibuilderschallenge-bobhub.bemyapp.com`. Platform fields: **The Issue**, **Our Magic Solution**, plus the links row.
Every number here comes from `docs/FACTS.json`. Placeholders are marked `[FACTS: field]` and are filled at the freeze from a real run, never by hand.
Items marked `[VERIFY]` do not ship until resolved to a primary source, per PLAN.md beneficiary sizing.

---

## Tagline (one line, appears under the project name)

The sun decides if your satellite is legal. Manifest is the first launch-licensing planner that knows it.

---

## The Issue

Georgia Tech's GT-1 CubeSat was planned as a nine month project. It took over two years, and the FCC license nearly missed the launch window: the integrator prepared to disable the deployer, which would have meant removal from the rocket. That failure mode, demanifest, is documented in NASA's own CubeSat launch literature as the direct consequence of late licensing.

University CubeSat teams face a multi-agency licensing campaign with no map: IARU frequency coordination, an ITU filing through the FCC, the FCC license itself across three possible regulatory pathways, a NASA orbital debris assessment, and a NOAA license if the satellite images Earth. The deadlines interlock, the agencies wait on each other, and the launch provider's delivery date does not move.

A principal investigator at a US university CubeSat program told us in writing (August 2026, paraphrased, shared anonymously): reconstructing his own mission's licensing chronology would require going back through all the filings, his team slow-walked licensing steps while waiting for launch details to firm up, and the only reason the FCC filing was manageable at all was that a NASA launch award paid for a consultant to run it. Teams without that award run it themselves. The field, sourced: "it is not unusual for 40 university-class missions to fly every year," and "about 40% of all manifested university-class missions fail to achieve any of their primary mission objectives" (Swartwout and Jayne, SmallSat 2016, digitalcommons.usu.edu/smallsat/2016/TS13Education/1; figures date to 2016).

And one input nobody plans for: the sun. The FCC requires disposal within five years of end of mission. Orbital lifetime is driven by atmospheric drag, drag by air density, density by the solar cycle. The same satellite in the same orbit can be legal at solar maximum and in violation at solar minimum. No planning tool tells a university team that.

## Our Magic Solution

**IBM and NASA's own space model helps decide whether your satellite's orbit is legal.**

Manifest is a regulatory critical-path planner for university CubeSat missions. Enter your mission (dates, frequencies, orbit, imaging), and it computes the full multi-agency dependency graph backward from your delivery date, fires every regulatory interlock, and shows exactly which deadlines are violated and by how many days. Every regulatory statement carries a section-level citation pinned to a dated regulatory snapshot, or the product abstains and says exactly what is missing.

### Technical Execution (IBM Tech Integration)

One sentence first: live NOAA solar flux and a Surya activity outlook feed an NRLMSISE-00 decay estimate that becomes a legal verdict node inside the licensing dependency graph.

The inventory behind it: `ibm/granite-4-h-small` generates grounded answers over the regulatory corpus, `ibm/granite-guardian-3-8b` audits every citation-bearing answer before display (fail the audit and the product abstains), `ibm/granite-embedding-278m-multilingual` powers retrieval, and `nasa-ibm-ai4science/Surya-1.0` (the IBM and NASA heliophysics foundation model, run on our own hardware from the public Apache-2.0 checkpoint) supplies the near-term solar activity outlook. IBM Bob built the engine with five write-scoped custom modes, and the eval bank runs as an MCP tool through IBM Context Forge. The committed `.bob/` directory and `docs/bob-evidence/` make every one of those claims inspectable.

Verify without logging in or holding any key: `curl https://[DEPLOY-URL]/api/status` recomputes the headline number on every request and self-reports the model IDs actually invoked in the deployment, so claimed-versus-running is checkable in one command. CI asserts it matches the README.

### Innovation

Start with who is excluded: university CubeSat teams who cannot afford licensing counsel, in a field where about 40% of manifested university-class missions fail to achieve any primary objective (Swartwout and Jayne, SmallSat 2016). Manifest's answer is the deorbit compliance verdict, a real prerequisite node in the graph, not a dashboard widget.

The worked example, computed by NRLMSISE-00 ballistic drag integration from NOAA's own predicted flux envelope: a 3U CubeSat at 550 km with a ballistic coefficient of 180 kg/m^2 has an estimated lifetime of 15.0 years at solar minimum (VIOLATED, the FCC limit is 5) and 2.57 years at solar maximum (OK). Same orbit. Opposite verdict. The solar cycle decides, and Manifest is the only tool in this field that treats space weather as a regulatory input instead of a chart.

### Challenge Fit and Feasibility

Theme: Advance Space Exploration with AI. Manifest ingests live NOAA SWPC F10.7 flux, runs Surya inference locally from the public checkpoint, and turns both into a licensing decision for real missions. The seeded missions are real (GT-1 and two other public university missions), with every date labeled DOCUMENTED with a source or ESTIMATED with a basis. No fictional personas, no synthetic load-bearing data.

Feasibility is one command: fresh clone, `npm ci && npm run test:engine` (74 engine tests, no network, no keys), then the deployed URL with no credentials. The corpus ships frozen with the app. The eval bank ([FACTS: eval sentence, filled after the scored run]) gates CI, so a change that regresses citations does not merge.

### Real-World Impact

The headline, recomputed live on every request: 151 days of already-violated regulatory deadline on the seeded mission profile, found in under one second (FACTS.headline, 2026-08-16 run; re-filled at freeze from a fresh run since the number moves as days pass). NASA's CubeSat 101 (2017) budgets 4 to 6 months for regulatory licensing and the FCC requires a minimum of 90 days from application receipt; Manifest tells a specific team which of their specific deadlines are already dead, today.

Honesty is part of the product: when the corpus cannot support an answer, Manifest abstains and says exactly what is missing. Six abstention traps in the eval bank enforce it. Durations are labeled DOCUMENTED or ESTIMATED everywhere. The full operator interview happens after submission; the written exchange above is what we hold today, and we say so.

---

## Links row

| Surface | Link |
|---|---|
| Live demo | `https://[DEPLOY-URL]` (no login, no key) |
| Judge walkthrough | `https://[DEPLOY-URL]/judge` and `JUDGE.md` in the repo |
| Repo | `https://github.com/StephenSook/manifest` |
| Video | `[YOUTUBE-URL]` |
| iOS | `[TESTFLIGHT-URL, if the Aug 26 gate says GO]` |
| Android | `[FIREBASE-APP-DISTRIBUTION-URL]` |

## Section images (one per section, per task 3.15)

1. The Issue: the dependency graph with a violated deadline chain highlighted in red.
2. Our Magic Solution: the deorbit panel showing the same orbit with both verdicts side by side.

## Fill-at-freeze checklist

- [ ] Replace every `[FACTS: ...]` from a fresh `scripts/facts.py` run. Never by hand.
- [x] Beneficiary figures resolved to primary sources 2026-08-16 (Swartwout and Jayne SmallSat 2016; CubeSat 101 2017). The "full year for licensing" research-pack claim was cut: the primary says 4 to 6 months.
- [ ] Replace `[DEPLOY-URL]`, `[YOUTUBE-URL]`, mobile links with live ones and click each from a logged-out browser.
- [ ] Confirm the eval sentence states the real score verbatim.
- [ ] Ask the validator for per-surface consent or keep the paraphrase fully anonymized as written.
- [ ] Em-dash and AI-tone sweep (4.6) over this file.
