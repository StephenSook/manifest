# Manifest: BeMyApp submission page copy (task 3.15)

Draft for `aibuilderschallenge-bobhub.bemyapp.com`. Platform fields: **The Issue**, **Our Magic Solution**, plus the links row.

Every number here comes from `docs/FACTS.json`. Placeholders are marked `[FACTS: field]` and are filled at the freeze from a real run, never by hand.

**Structure note (2026-08-25).** The event page lists five judging criteria. The binding Official Rules list **four**, scored 1 to 5 each for 20 points total: Technical Execution, Innovation, Challenge Fit, Implementation and Feasibility. This document is organized against the four in the rules, in their order, using their words. Real-world impact lives inside Challenge Fit because the rules define that criterion as "relevance to the challenge and ability to address real-world problems."

**Prize note.** Two of the four monthly awards are named for the sponsor's tool: **Best Technical Use of IBM Bob** and **Most Innovative Use of IBM Bob**, $750 each, winnable alongside a placing prize. The two short sections at the end argue for each by name.

---

## Tagline (one line, appears under the project name)

The sun decides if your satellite is legal. Manifest is the first launch-licensing planner that knows it.

---

## The Issue

Georgia Tech's GT-1 CubeSat was planned as a nine month project. It took over two years, and the FCC license nearly missed the launch window: the integrator prepared to disable the deployer, which would have meant removal from the rocket. That failure mode, demanifest, is documented in the CubeSat launch literature as the direct consequence of late licensing.

The structural reason is not that anyone is careless. It is that **no single party holds both the regulatory picture and the authority over the schedule.** The FCC owns the license but not the launch date. The launch provider owns the delivery date but not the license. IARU coordinates frequencies but binds nobody. NOAA gates imaging separately, NASA gates debris separately, and the ITU filing goes through the FCC on its own clock. Every agency is doing its job correctly, and the mission still misses, because the deadlines interlock and the delivery date does not move.

Sit with what that costs a university team. They are students. The licensing campaign runs across five agencies while they are also building the satellite, and a single missed clock does not delay the mission, it removes the spacecraft from the rocket. A principal investigator at a US university CubeSat program told us in writing (August 2026, paraphrased, shared anonymously): reconstructing his own mission's licensing chronology would require going back through all the filings, his team slow-walked licensing steps while waiting for launch details to firm up, and the only reason the FCC filing was manageable at all was that a NASA launch award paid for a consultant to run it. Teams without that award run it themselves. The field, sourced: "it is not unusual for 40 university-class missions to fly every year," and "about 40% of all manifested university-class missions fail to achieve any of their primary mission objectives" (Swartwout and Jayne, SmallSat 2016, digitalcommons.usu.edu/smallsat/2016/TS13Education/1; figures date to 2016).

And one input nobody plans for: the sun. The FCC requires disposal within five years of end of mission. Orbital lifetime is driven by atmospheric drag, drag by air density, density by the solar cycle. The same satellite in the same orbit can be legal at solar maximum and in violation at solar minimum. No planning tool tells a university team that.

## Our Magic Solution

**Manifest turns a five-agency licensing campaign into a dependency graph with a critical path, and it treats space weather as a legal input rather than a chart.**

Enter your mission once (dates, frequencies, orbit, whether you image Earth). Manifest computes the multi-agency dependency graph backward from your delivery date, fires every regulatory interlock, and shows exactly which deadlines are already violated and by how many days. Every regulatory statement carries a section-level citation pinned to a dated regulatory snapshot, or the product abstains and says exactly what is missing.

### Technical Execution

*Effective use of IBM Bob and additional technologies, with a functional and well-structured solution.*

One sentence first: **live NOAA solar flux and an IBM and NASA Surya activity outlook feed an NRLMSISE-00 decay estimate that becomes a legal verdict node inside the licensing dependency graph.** Not a widget beside the graph. A node the FCC grant depends on.

IBM Bob is the core of how this was built, and the evidence is committed rather than described. Five write-scoped custom modes in `.bob/custom_modes.yaml`, each with a `fileRegex` that refuses writes outside one lane, so a three-person team working in parallel on one repository could not collide. Four regime skills under `.bob/skills/`, one per regulatory pathway plus the eval bank. The `.bob/` directory is in the repository, not gitignored, so every mode, rule and skill is inspectable.

The additional technologies, stated as they actually run. `app/api/ask/route.ts` calls `ibm/granite-4-h-small` for generation and `ibm/granite-guardian-3-8b` to audit every citation-bearing answer before display, with `ibm/granite-embedding-278m-multilingual` for retrieval; that path is wired in the shipped route and activates wherever watsonx credentials are present. Where they are absent, the same corpus is served by an offline extractive path with the identical cite-or-abstain rule, and **the deployment tells you which one answered**: `GET /api/status` returns a `runtime` block naming the generation backend, the embedding backend and whether the Guardian audit is active, right beside the model inventory it is configured with. A judge can diff configured against running in one unauthenticated request. Docling ingested the PDF corpus; `lxml` parses the eCFR bulk XML directly, because paragraph structure in Title 47 is carried by hardcoded labels inside the text and not by element nesting.

Verify without logging in and without holding any key:

```
curl https://[DEPLOY-URL]/api/status
```

That request recomputes the headline number on every call, returns the seeded mission, the critical path, the deorbit swing, the configured models and the runtime block. CI asserts the self-report matches the README.

### Innovation

*Creativity, originality, and unique application of AI.*

Everyone in this field builds space weather dashboards. Manifest asks a different question: **what if space weather were not information, but a legal fact?**

The worked example, computed by NRLMSISE-00 ballistic drag integration from NOAA's own predicted flux envelope. A 3U CubeSat at 550 km with a ballistic coefficient of 180 kg/m^2 has an estimated orbital lifetime of **15.0 years at solar minimum**, against an FCC limit of five. Verdict: VIOLATED. The same satellite, the same orbit, at solar maximum: **2.57 years**. Verdict: OK.

Same orbit. Opposite legal answer. The solar cycle decides.

Watching that verdict flip is the thing we would ask a judge to look at, because it is a state change on screen and not a claim in a paragraph, and it is reproducible by a stranger with no account and no key from the `deorbit_swing` block of the public status endpoint. The originality is not the heliophysics model, which is IBM and NASA's published work. It is the decision to let a physical forecast bind a regulatory node, so that the graph reroutes when the sun does.

### Challenge Fit

*Relevance to the challenge and ability to address real-world problems.*

The August theme asks for solutions that move space exploration from data-heavy to insight-driven and that make space more accessible. Manifest takes the rawest regulatory text there is, the eCFR bulk XML for Title 47 Parts 5, 25 and 97 plus Title 15 Part 960, and turns it into one dated answer: which of your deadlines are already dead, and what you file first. Accessibility is the whole point of the user: university teams without licensing counsel, in a field where about 40% of manifested university-class missions fail to achieve any primary objective.

The real-world half of this criterion is the headline the deployment recomputes on every request: **[FACTS: headline.deadline_violations_days] days of already-violated regulatory deadline** on the seeded GT-1 mission profile, across [FACTS: headline.violated_node_count] of [FACTS: headline.node_count] nodes, computed in [FACTS: headline.compute_ms] milliseconds. NASA's CubeSat 101 (2017) budgets 4 to 6 months for licensing and the FCC requires a minimum of 90 days from application receipt. Manifest tells one specific team which of their specific deadlines are gone, today, with the paragraph of regulation that says so.

The incentive is inside the loop and it is concrete: a team that runs this gets a filing order and a dated deadline list they can act on the same afternoon, without hiring the consultant that the interviewed program could only afford because a NASA award paid for it.

Everything load-bearing is real. The seeded missions are real public university missions with every date labeled DOCUMENTED with a source or ESTIMATED with a basis. No fictional personas. No synthetic data on any input that carries the claim.

### Implementation and Feasibility

*Practicality, scalability, and potential for real-world use.*

It is deployed and it is running. A live web deployment with no login and no key, an installable PWA, an iOS build through TestFlight and a signed Android APK published as a GitHub release. The mission plan lives in the browser's own IndexedDB, so a team's unfiled schedule is never transmitted anywhere, and deadline alerts fire as local notifications on device with no push server and no subscription.

The regulatory corpus ships **inside the repository**, not behind a service: the frozen bundle (SQLite plus a Float32 vector file plus a schema recording which embedder produced it) is committed and packed into the deployed function, so a fresh clone can answer questions offline and a judge is never looking at a cache that might have expired. A CI job fails the build if any of the three files goes missing, and a test asserts the vector file's byte length equals count times dimension times four, so a silently truncated bundle cannot ship.

Feasibility is one command from a fresh clone:

```
npm ci && npm run test:engine
```

[FACTS: tests.engine] engine and mobile tests, no network, no keys. The regulatory interlocks are unit-tested individually: the 97.207(g) dual clock, the NOAA-before-FCC ordering, IARU before Part 97, ITU publication lead time, and delivery as the hard wall.

The correctness bar is a committed eval bank of 28 regulatory questions and 6 abstention traps, run in CI on every push against committed fixtures with no network and no key, with a ratchet that fails the build on any regression and a per-question baseline that fails if a previously passing question stops passing. [FACTS: eval sentence, filled after the scored run.] The eval runner is also exposed to IBM Bob as an MCP tool over stdio, so the agent that wrote the engine can score it.

Honesty is part of the engineering, not a disclaimer at the end. Durations are labeled DOCUMENTED with a source or ESTIMATED with a basis, never presented as fact when they are folklore. When the corpus cannot support an answer, the product abstains and names exactly what is missing, and six traps in the eval bank fail the build if it ever answers one of them instead. A regulatory tool that guesses confidently is worse than no tool, so this one is built to refuse.

---

## Best Technical Use of IBM Bob

Three people, one repository, sixteen days, zero merge collisions on the engine.

That is a Bob-shaped outcome, not a git-shaped one. `.bob/custom_modes.yaml` defines five modes whose `fileRegex` write scopes partition the tree: a corpus mode that can only write under `/corpus` and `/pipeline`, a regulatory-engine mode confined to `/engine`, a mobile-shell mode, a frontend mode, and an evidence mode that can only write under `/docs`. The refusal happens at the editor, before a bad write exists, which is a different guarantee from catching it in review. Four skills under `.bob/skills/`, one per regulatory regime plus the eval bank, carry the rules each lane must not violate, including the cite-or-abstain rule and the verbatim Part 100 line. Every one of those files is committed and readable in the repository.

## Most Innovative Use of IBM Bob

We pointed Bob at a domain where being wrong is the whole risk, and then made it grade itself.

The eval bank, 28 regulatory questions with exact expected citations plus 6 abstention traps, is exposed to Bob as an MCP tool over stdio. Bob can invoke the scorer on the corpus it helped build and read back the score, the per-question citations, and which traps held. That closes a loop most agent workflows leave open: the agent that writes the retrieval and citation logic is the agent that watches its own citation accuracy move, and a CI ratchet makes the number one-directional so no session can quietly trade accuracy for coverage.

---

## Links row

| Surface | Link |
|---|---|
| Live demo | `https://[DEPLOY-URL]` (no login, no key) |
| Judge walkthrough | `https://[DEPLOY-URL]/judge` and `JUDGE.md` in the repo |
| Verify in one command | `curl https://[DEPLOY-URL]/api/status` |
| Repo | `https://github.com/StephenSook/manifest` |
| Video | `[YOUTUBE-URL]` |
| iOS | `[TESTFLIGHT-URL, if the beta review is approved in time]` |
| Android (direct APK, no sign-in) | `https://github.com/StephenSook/manifest/releases/tag/v1.0-beta.1` |
| Android (Firebase App Distribution, Google sign-in required) | `https://appdistribution.firebase.dev/i/2adff092da3659d7` |

## Section images (one per section, per task 3.15)

1. The Issue: the dependency graph with a violated deadline chain highlighted in red.
2. Our Magic Solution: the deorbit panel showing the same orbit with both verdicts side by side.

## Fill-at-freeze checklist

- [ ] Replace every `[FACTS: ...]` from a fresh `scripts/facts.py` run. Never by hand.
- [x] Beneficiary figures resolved to primary sources 2026-08-16 (Swartwout and Jayne SmallSat 2016; CubeSat 101 2017). The "full year for licensing" research-pack claim was cut: the primary says 4 to 6 months.
- [x] Restructured against the four binding criteria 2026-08-25, and the two IBM Bob prize sections added.
- [x] Claim audit against shipped code 2026-08-25: the Granite generation, Guardian audit and embedding claims now state the credential condition and point at the runtime self-report; the Context Forge claim is reduced to the stdio MCP server that is actually verified; the engine test count and headline number are `[FACTS: ...]` placeholders rather than stale literals.
- [x] Corpus claim re-checked the same afternoon after Tylin committed the frozen bundle (`564dc22`): the corpus now genuinely ships in the repository and is traced into the deployed function, so that claim is restored and strengthened.
- [ ] **Verify `POST /api/ask` returns 200 with a citation on the LIVE url before submitting.** As of 2026-08-25 10:50 ET production still served the pre-fix build and returned 503. The repo is correct; the deploy had not caught up.
- [ ] Re-run the claim audit after the corpus lands, and upgrade the watsonx sentences if credentials are in place by the freeze.
- [ ] Replace `[DEPLOY-URL]`, `[YOUTUBE-URL]`, and the TestFlight link with live ones and click each from a logged-out browser.
- [ ] Confirm the eval sentence states the real score verbatim.
- [ ] Confirm every field on the platform page is 255 characters or under where the form silently truncates, and verify each save by a full page reload.
- [ ] Ask the validator for per-surface consent or keep the paraphrase fully anonymized as written.
- [ ] Em-dash and AI-tone sweep (4.6) over this file.
