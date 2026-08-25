# Manifest: Demo Video Script
## "The Sun Decides If Your Satellite Is Legal"
### IBM AI Builders Challenge August 2026

**YouTube title:** Manifest: The Sun Decides If Your Satellite Is Legal (IBM Granite + IBM/NASA Surya) | IBM AI Builders Challenge

**Target duration:** 2:55 to 3:00  
**Format:** Three-voice narration over live screen capture. No slides. No company-name cold open. No fictional personas.  
**Numbers rule:** Every spoken number comes from `docs/FACTS.json`. Record the narration AFTER running `python scripts/facts.py` and verifying the output matches the README.  
**Demo rule:** The product runs live on the deployed Vercel URL and the GT-1 seeded mission during recording. Not a frozen state. Not a mockup.  
**"Shouldn't be possible" moment:** Beat 3 (1:25 to 2:05). The orbit that changes legal status based on the solar cycle. Pause here. Let it breathe. Do not speed past it.  
**Mobile:** Beat 3 includes the phone buzz. Beat 5 shows the TestFlight/App Distribution links. The phone is on the desk throughout and should be visible in frame.

---

## Recording and publishing rules, taken from what the field is losing points on

A forensic pass over all 45 gallery submissions on 2026-08-25 found the demo video to be one of the cheapest places to lose. Three rivals are being marked down or disqualified on it: one shipped 3:13 against a hard 3:00 cap, two published videos that are private so a judge clicking the only link sees "Video unavailable", and one submitted a Rickroll. Meanwhile the strongest submission in the field never says the sponsor's name out loud even once.

1. **Say the IBM Bob sentence inside the first 40 seconds, and name the modes.** Criterion 1 is worded "Effective use of IBM Bob", and two of the four monthly awards are Bob-named at $750 each. A judge who has to wait 2:30 to hear it may already have scored that criterion. Name the five write-scoped modes and the eval MCP tool specifically, not "we used IBM Bob".
2. **Every sentence with a number in it must have that number visible on screen at that moment.** A spoken figure with nothing on screen is a claim; the same figure beside the running product is evidence. If a number cannot be shown, cut the sentence.
3. **Every spoken number comes from `docs/FACTS.json`, never from memory or from this file.** Re-run `python3 scripts/facts.py` immediately before recording narration, and re-read the beats against it. A published video is immutable: a wrong number in it can never be corrected, and it then becomes the reference every other artifact has to match.
4. **Record in an Incognito window.** The URL bar in frame then proves no login, no local server, and no seeded session, which is exactly what a judge cannot otherwise verify from a screen recording.
5. **Hard cap 3:00, and leave margin.** Target 2:50. YouTube rounds durations up in page metadata, so a file at exactly 3:00.000 can display as "3M1S" to anyone reading the page. Measure the shipped file with ffmpeg, not the editor's timeline.
6. **Measure the shipped file before it is final**: ffmpeg ebur128 integrated loudness in the -14 to -16 LUFS band, plus duration, resolution and frame rate against target. A frame-verified video is not a verified video.
7. **Publish to a second public host and paste both links.** The rules require a publicly viewable video, and it is the single point of failure on the whole submission. Verify public availability from a logged-out browser, not from the account that uploaded it: `curl -s "https://www.youtube.com/oembed?url=<watch-url>&format=json"` returning HTTP 200 with a title is the check.
8. **Do not narrate a claim the product refutes.** One rival's video promises a what-if simulation that its own API returns identical results for. Before recording any beat, run the exact interaction being described and watch it behave as narrated.

---

## Voice Assignment

| Voice | Person | Owns |
|---|---|---|
| **STEPHEN** | Stephen Sookra | Cold open hook, differentiator reveal, IBM Bob montage, close |
| **TYLIN** | Tylin | The cite-or-abstain section (corpus, Granite, Guardian) |
| **KHADIM** | Khadim | Live product walkthrough (the product demo section) |

Demo driver: **Khadim** operates the keyboard/mouse during the product demo section.  
Presenter narration: **Stephen** leads and closes. Tylin and Khadim narrate their own sections.

---

## Beat 1: Cold Open (0:00 to 0:25) -- STEPHEN

*Screen: Black. Then a single terminal line appearing, then the GT-1 paper title card.*

**[STEPHEN -- narrate over black screen, then over the GT-1 SmallSat 2021 title card]**

> "Georgia Tech's GT-1 satellite was supposed to take nine months. It took over two years. The FCC license nearly did not arrive before the launch window. A deployer integrator prepared to disable the payload. That outcome -- demanifest -- is documented in the CubeSat launch literature as the direct consequence of late licensing.
>
> Forty percent of university CubeSat missions fail to meet their primary objectives. The number one planning tool available to those teams does not know what the sun is doing.
>
> Manifest does."

*Screen: The Manifest app loads at the /judge page. The headline number appears.*

**[PAUSE 1 second on the loaded screen before Khadim speaks.]**

---
**Director's note (Beat 1):**
- Open on black. No logo. No "Hi we're Manifest." The first word is a name and a timeline.
- The hook structure: Named institution (GT-1/Georgia Tech) + concrete near-miss (deployer disable) + sourced stat (40% failure rate) + provocative claim (the planning tool doesn't know what the sun is doing).
- This is the Sookra PAS Problem beat. The Agitate starts in Beat 2. Do not solve anything yet.
- Source for the 40% figure: verify to Swartwout/AIAA-USU primary source before recording. If unverified by record date, cut the number and say "a documented fraction."
---

## Beat 2: The Product, Live (0:25 to 1:25) -- KHADIM narrates, Stephen may assist on split-screen context

*Screen: Manifest web app. Khadim is at the keyboard. The GT-1 mission is pre-loaded.*

**[KHADIM]**

> "This is Manifest. A regulatory critical-path planner for university CubeSat programs. The GT-1 mission is already loaded. I'll enter the launch-vehicle determination date now."

*[Khadim types the LV determination date. The 97.207(g) dual clock fires immediately. Two deadline lines appear on the dependency graph.]*

**[KHADIM]**

> "47 CFR 97.207(g) requires pre-space notification within 30 days of this moment -- and no later than 90 days before integration. Both clocks just appeared. The critical path recomputed. That is a live engine run on a real mission."

*[Screen shows the critical path with the headline violated-deadline days number prominently visible.]*

**[KHADIM]**

> "Every node on this graph is a real regulatory deadline -- IARU coordination, ITU advance publication, NASA debris assessment, FCC grant. Each one carries the exact CFR section it comes from and the AMDDATE of the snapshot it was verified against. Now watch what happens when I change this orbit."

*[Khadim changes the perigee altitude to 550 km. The deorbit-compliance node flips from OK to AT RISK or VIOLATED. The F10.7 value and NOAA uncertainty band become visible on the compliance panel.]*

**[KHADIM]**

> "The deorbit compliance node just changed. This is not a warning label. It is a hard prerequisite of FCC grant. The FCC will not issue a license to a satellite it cannot verify will reenter within five years. The verdict just changed because the orbit changed."

*[The graph now shows the dependency chain: deorbit-compliance locked to fcc-grant locked to delivery.]*

---
**Director's note (Beat 2):**
- Khadim is the demo driver. Every action should be deliberate, not rushed.
- The "shouldn't be possible" moment is NOT this beat -- do not rush to it. This beat establishes that the product is real, wired, and running on real mission data.
- The headline number (violated-deadline days) should be clearly visible on screen when Khadim says "live engine run."
- If the Vercel deploy is not yet live when recording this beat, record against a local `npm run dev` with the note in the script to re-record after deploy.
---

## Beat 3: The Thing Nobody Else Has (1:25 to 2:05) -- STEPHEN, phone on desk

*Screen: The deorbit compliance panel is open. F10.7 value, NOAA envelope, and Surya outlook all visible.*

**[STEPHEN]**

> "Same satellite. Same orbit. 550 kilometers. Here is what nobody else's planning tool shows you."

*[Stephen or Khadim inputs a launch date near solar minimum. The compliance panel updates. The lifetime value reads 15.0 years.]*

**[STEPHEN -- slower, deliberate]**

> "Solar minimum. F10.7 at 70. Lifetime estimate: 15.0 years. The FCC's limit is five years. This orbit is non-compliant. The FCC will not grant a license to fly it."

*[PAUSE two full seconds. Let the number sit.]*

**[STEPHEN]**

> "Now the same satellite, same orbit -- at solar maximum."

*[Input changes to solar maximum conditions. F10.7 shifts. Lifetime reads 2.57 years.]*

**[STEPHEN]**

> "2.57 years. Under the limit. Fully compliant. This orbit is legal."

*[PAUSE two full seconds.]*

**[STEPHEN]**

> "Same orbit. Opposite legal answer. The solar cycle decides. That number comes from NOAA's live F10.7 flux feed, NOAA's predicted-cycle envelope, and IBM and NASA's own Surya heliophysics model -- all three sources labeled right here, on the face of the UI, with the citation pinned to the governing text: 47 CFR 25.283(e), FCC 22-74."

*[Phone on the desk buzzes. Pre-armed local notification fires: "Manifest: Your FCC grant deadline is 47 days away."]*

**[STEPHEN]**

> "That notification requires no server. No push subscription. It lives on the device. iOS TestFlight build. Android APK via Firebase App Distribution. Both available right now."

*[Brief split screen or camera pan to show the phone screen with the notification visible.]*

---
**Director's note (Beat 3):**
- THIS IS THE "SHOULDN'T BE POSSIBLE" MOMENT. Budget two pauses of two seconds each -- after "15.0 years" and after "2.57 years." Do not narrate over the silence. Let the number land.
- The Duarte Sparkline oscillation lives here: "what is" (15.0 yr, non-compliant) vs "what could be" (the team that knows this in advance). You are not selling features. You are showing a world that changes depending on the solar cycle.
- The phone buzz should be genuine -- pre-arm the local notification on a real iOS device or Android device before recording. Not a simulation.
- Surya is named only if `data/surya-outlook.json` is live. If Surya is cut (D7 fallback), replace the Surya line with: "...from NOAA's live flux feed and NOAA's predicted-cycle envelope -- both sources labeled on the face of it."
- The mobile call-out is natural here because the notification IS the mobile feature. Do not tack it on awkwardly at the end. It belongs inside this beat.
---

## Beat 4: Cite or Abstain (2:05 to 2:35) -- TYLIN

*Screen: Manifest Q&A panel. A question is typed: "What is the IARU coordination deadline for a Part 97 amateur satellite?"*

**[TYLIN]**

> "Every regulatory answer in Manifest is grounded in the corpus we built: Title 47 Parts 5, 25, and 97, Title 15 Part 960, and the FCC's own Part 100 order -- ingested via Docling, embedded with IBM Granite, and stored in a versioned SQLite bundle. IBM Granite answers the question. IBM Granite Guardian audits the answer before it ever reaches the screen."

*[The answer appears with the citation: 47 CFR 97.207(c), with the AMDDATE of the ingested snapshot.]*

**[TYLIN]**

> "The citation is pinned to the snapshot AMDDATE -- the exact version of the regulation that was verified when we built this. That is not decoration. That is the product's thesis: cite or abstain."

*[Now type an abstention trap: "What are the fees for Part 100 applications?"]*

*[The product refuses. The abstention screen appears: "Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today. Fee schedule for Part 100 is not yet established."]*

**[TYLIN]**

> "The product just refused to answer. Part 100 was adopted but its fee schedule is not yet published. Rather than guess, Manifest says exactly what is missing. That is not a failure state. That is a designed output."

---
**Director's note (Beat 4):**
- Tylin narrates this beat because the corpus, RAG pipeline, and Guardian audit are his lane. His voice signals to judges that this is a real team with real division of labor.
- The abstention trap answer must match the D3 verbatim line: "Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today." Do not paraphrase.
- The AMDDATE on the citation must be real. If Tylin's corpus has not shipped by recording date, cut the Q&A section and replace with: "The corpus is frozen and versioned. Every answer cites its source. Ask something the corpus cannot support and the product says exactly what is missing." (30 seconds flat narration over the abstention screen.)
---

## Beat 5: How IBM Bob Built It (2:35 to 3:00) -- STEPHEN

*Screen: Fast montage. Each screen holds for 2 to 3 seconds. No slow pans.*

*Montage sequence:*
1. `.bob/custom_modes.yaml` open in Bob -- the five write-scoped modes visible
2. One Bob custom mode in action -- the `regulatory-engine` mode refusing a file outside its scope
3. Bobalytics screenshot showing session count
4. Orchestrator delegation transcript in `docs/bob-evidence/orchestrator-run.md`
5. `eval/bank.jsonl` -- the 28-question bank
6. CI green badge on the eval gate workflow
7. Final frame: The Manifest /judge page loaded, the headline number visible, the mobile app TestFlight link and Firebase App Distribution link side by side

**[STEPHEN]**

> "IBM Bob 2.0.3 built this. Five write-scoped custom modes -- one per team member's lane -- enforced by fileRegex at the editor level. 128 tests. An eval bank of 28 regulatory questions and 6 abstention traps, exposed to Bob as an MCP tool. A CI gate that blocks any pull request that regresses a citation.
>
> The repo is public. The `.bob/` directory is committed. Every mode, every skill, every Orchestrator run is inspectable right now at github.com/StephenSook/manifest.
>
> Manifest. The sun decides if your satellite is legal. And now, so do you."

*[Final frame holds 2 seconds on the deployed URL + mobile app links.]*

---
**Director's note (Beat 5):**
- This beat is fast -- 25 seconds. Keep each screen cut snappy. This is the IBM Bob evidence montage, not a tutorial.
- "128 tests" -- this is `FACTS.engine.test_count_total`, measured by running the suites, not hand-maintained. Re-read it from `docs/FACTS.json` immediately before recording; `python scripts/facts.py --check` fails if the file has drifted.
- The Context Forge claim was CUT from this beat 2026-08-25: the eval MCP server is verified over stdio and wired to Bob, but the Context Forge gateway was never registered. Do not put it back unless task 3.2 lands.
- The close "The sun decides if your satellite is legal. And now, so do you." is the Stakes Close pattern from the Sookra guide: it connects to the hook, states the product's core claim, and ends on a handoff to the judge (not "thank you for watching"). No ask for a prize. No call to action URL. This is async-judged -- the close is the line that stays in the room.
- The mobile links (TestFlight + Firebase App Distribution) appear in the final frame. If the TestFlight external link is not approved by recording date (Aug 26 gate), show only the Firebase App Distribution link and the PWA install prompt. Never show a link that does not work during judging week.
---

## Production Notes

### Recording order
Record beats out of order to minimize re-takes:
1. Record Beat 5 montage first -- it is the easiest to re-do without the app running.
2. Record Beat 3 (differentiator) second -- it has the hardest timing requirement.
3. Record Beat 2 (live demo) third -- requires the deployed URL to be live.
4. Record Beat 4 (cite or abstain) fourth -- requires Tylin's corpus to be shipped.
5. Record Beat 1 (cold open) last -- needs to be the freshest read.

### Voice recording
- Record each voice in a separate pass. Do not try to hand off live.
- Stephen: deliberate pace on "15.0 years" and "2.57 years." Time the pauses.
- Tylin: technical, confident, not rushed. The abstention screen moment should feel like a reveal, not a disclaimer.
- Khadim: demo driver energy -- conversational, precise, every action announced before it happens so judges can follow.

### Dry-run checklist before final recording
- [ ] Vercel deploy is live and /judge page loads in under 3 seconds
- [ ] GT-1 mission is pre-loaded (not requiring login)
- [ ] Local notification pre-armed on a real iOS or Android device
- [ ] Decay table is current (`python scripts/facts.py --check` returns OK)
- [ ] FACTS.json numbers match what Stephen will speak aloud
- [ ] All spoken numbers spot-checked against `docs/FACTS.json`
- [ ] TestFlight link or Firebase App Distribution link verified live
- [ ] Backup recording of the full demo run exists on a separate device

### What to capture as features land (D12)
Per PLAN.md D12, do not re-stage everything on Aug 28. Capture each beat the day it ships:
- Beat 2 deorbit flip: capture the day Khadim's deorbit panel (2.7) lands on Vercel
- Beat 3 solar swing: capture same day as above
- Beat 4 Q&A abstention: capture the day Tylin's corpus and /api/ask route ship
- Beat 5 montage stills: capture Bobalytics screenshot, orchestrator run, eval CI run each the day they happen -- they go in `docs/video/raw/`

### Audio
- Target integrated loudness: -14 to -16 LUFS (verified with `ffmpeg -i video.mp4 -filter_complex ebur128 -f null -` after cut)
- No background music under the cold open or the differentiator pause -- silence is the technique
- Music bed (from kie-ai, per D9) enters under Beat 5 montage only, at -20 dB under narration

### YouTube title and description
**Title:** Manifest: The Sun Decides If Your Satellite Is Legal (IBM Granite + IBM/NASA Surya) | IBM AI Builders Challenge

**Description (draft):**
University CubeSat teams face a multi-agency licensing campaign against an immovable launch date. But no planning tool tells them that the same orbit can be FCC-compliant or non-compliant depending on the solar cycle.

Manifest surfaces that constraint as a node in the dependency graph. IBM and NASA's own Surya heliophysics model, NOAA's predicted F10.7 envelope, and an NRLMSISE-00 orbital lifetime estimate compute a deorbit compliance verdict that is a hard prerequisite of FCC grant.

At 550 km, Bc=180 kg/m^2: solar minimum lifetime 15.0 yr (VIOLATED). Solar maximum lifetime 2.57 yr (OK). Same orbit. Opposite verdict. The solar cycle decides.

Built with IBM Bob 2.0.3, IBM Granite, IBM Granite Guardian, and IBM/NASA Surya-1.0.

Repo: https://github.com/StephenSook/manifest
Live demo: [Vercel URL]
iOS: [TestFlight link if GO, else omit]
Android: [Firebase App Distribution link]
