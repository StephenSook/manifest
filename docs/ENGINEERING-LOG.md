# Engineering log

Defects this project actually shipped, and the mechanism that caught each one.

Every entry names a commit you can open. Where a guard caught the defect, the guard
is named so you can run it. Where a human or a review pass caught it, that is said
plainly rather than credited to tooling.

This log exists because a build log is easy to write and proves nothing. What a team
found wrong in its own work, and what it changed so the same class cannot return, is
the part that is hard to fake.

---

## What the tooling got wrong

Three defects were introduced by AI-assisted work on this repository and caught
afterwards. They are listed first because they are the least flattering.

**1. A fix gated on the wrong signal, and the guard written with it had the same hole.**
The 2026-08-29 fallback fix (`e083cc5` lineage, shipped in PR #6) made `/api/ask`
degrade to the extractive path when watsonx is unreachable. The CI step written in the
same change asserted only `degraded != true`. The keyless extractive path also reports
`degraded: false`, by design, because nothing degraded. A deployment that simply lost
its credentials would therefore have printed "watsonx answered" and stayed green. Caught
by an adversarial review pass over the diff, not by the tests written alongside it.
Fixed in `bc9aeb2`, which additionally requires `audited: true`.

**2. The relevance gate gave zero credit for the citation a user actually typed.**
The first version of `extractiveIsAnchored` scored only content-term overlap. A question
naming `97.207(g)` tokenises differently from a chunk's `97.207(g)(1)`, so the single
strongest signal available, the section the user asked about, scored nothing. Two
existing tests failed and exposed it. The shipped gate anchors on section equality via
`parseCfrReferences` first, then falls back to term overlap.

**3. A verification script produced a green result that was structurally meaningless.**
A CI watcher counted pending and failed checks by filtering the GitHub check-runs array.
Immediately after a push that array is empty, so both counts were zero and the script
reported ALL GREEN while fourteen checks had not started. It was caught by
cross-checking the live API instead of trusting the watcher's own output. The rule that
came out of it: any gate that counts must assert a minimum count before reading zero
failures as success. Zero of zero is not green, it is not yet.

A fourth, smaller: a `strings | grep` scan was cited as evidence that an image
redaction had worked. Running the same scan against the *unredacted* original returned
the same zero, because PNG pixel data is compressed and text never appears as literal
bytes either way. The check was worthless in both directions. The real evidence is a
visual re-read plus a hash match. Run the positive control before citing any scan.

---

## What IBM Bob caught

**Lane enforcement refused a real write, 2026-08-26.**
`frontend` mode attempted `docs/architecture.svg`, which does not match that mode's
`fileRegex`. The write was refused at the editor. The author switched to
`evidence-writer`, whose scope includes `docs/`, and the diagram landed there
(`e6788e5`, then `377a146`). The chat was not exported, so the durable record is the
property rather than a transcript: `.bob/custom_modes.yaml` defines the scopes and
`tests/test_bob_lane_enforcement.py` asserts the allow/refuse table on every CI run.
Widening `frontend` to include `docs/` fails the build.

This is the only Bob-caught defect we can evidence. The Plan-mode session for the
build's critical path was never exported, and
`docs/bob-evidence/plan-mode-critical-path.md` is the dated refusal to reconstruct it
rather than an invented transcript.

---

## Defects found in our own shipped surfaces

**4. The product served an upstream exception as the user's answer.**
`POST /api/ask` returned `Generation failed: Access is denied due to invalid
credentials.` for every question. The fallback was gated on the *presence* of two
environment variables, so a configured-but-unreachable watsonx had no path to the
keyless extractive path that was sitting there working. Fixed in PR #6: generation and
audit failures now degrade, set `degraded: true`, and report the upstream text as
upstream text.

**5. The error message was not what it said.** The IBM Node SDK renders a
`403 token_quota_reached` as "Access is denied due to invalid credentials". Diagnosed by
a distinguishing test rather than by reading the string: the same key exchanged fine
against IBM IAM (200), the raw watsonx REST call returned `403 token_quota_reached`, and
the shipped SDK path reproduced the credentials wording. Without that test the next hours
would have gone into re-pasting a key that was never wrong.

**6. Retrieval had no relevance gate, so the extractive path answered anything.**
Asked "Who won the 2026 FIFA World Cup?", the product returned `abstained: false`,
citing 47 CFR 25.103(2)(2)(3), with the body text "Hawaii;". Retrieval returns its top
k for any input, so a citation existing was never evidence the corpus addressed the
question. This violated hard rule 1 and had been reachable on the keyless path since it
shipped. Surfaced by an adversarial review pass and confirmed against the running
server.

*Negative result worth recording:* cosine similarity cannot separate these cases. Junk
questions scored up to 0.3113 against a real-question minimum of 0.2243, so the
distributions overlap and no threshold exists. The shipped gate is a named-section match
or two shared content terms with the chunks the answer cites. Measured: 27 of 28 bank
questions still answer, the one blocked already fails, and 14 of 14 off-corpus questions
abstain.

**7. `/api/status` reported an embedder that never ran.** `embedding_backend` was
derived from credential presence and read `watsonx` in every deployment, keyed or not.
The route selects its embedder from the committed corpus, which is `hashing-trick-768`,
so the watsonx embed call is unreachable in production. It was wrong even when watsonx
was perfectly healthy. Fixed in `e083cc5`; the field is now read from the corpus with
the same predicate the ask route uses, and a guard asserts the two cannot drift.

**8. Two runtime claims were configuration presented as measurement.**
`generation_backend` and `guardian_audit` are derived from credential presence, which is
not a health check, and were rendered under a judge-facing column headed "Running now".
During the quota outage that table read `watsonx` and `active` while generation answered
nothing. Fixed in `8eb86d4`: the runtime block carries a `basis` map, the column is now
"Reported" plus "Basis", and each answer states what produced it.

**9. A model was published in the inventory with nothing behind it.**
`/api/status` listed `local_fallback: granite4.1:8b`, `FACTS.json` carried it, and the
judge page rendered "Local fallback: granite4.1:8b". A grep for `ollama` returns prose
and that one inventory string: no client, no call, no code path. The existing guard
asserted the inventory matched `FACTS.json`; both documents agreed and both were wrong,
because a consistency check between two restatements cannot see that nothing implements
the claim. Cut in `1e17f40`, and `tests/test_model_inventory_is_wired.py` now checks the
inventory against code. Verified by negative control: adding an unwired model id fails
the guard.

**10. A degraded run could have been published as a watsonx score.** The eval scorer
read only `abstained` and `citations`, and `facts.py` stamped `eval_live.runtime` from a
separate `/api/status` call, which is credential-derived. A run whose answers all came
from the extractive path would have been attributed to watsonx. Fixed in `c42f5df`: the
runner records `degraded` and `audited` per row and labels the run's pipeline from its
own results, and `facts.py` refuses to emit `eval_live` at all if any row degraded.

**11. The command the README hands a reader printed FAILED.** In a clean clone,
`python3 eval/runner.py --mode fixtures` reported the same 53.6 percent the README
publishes as its measured score, then declared FAILED and exited 1, because the runner
defaulted to the 90 percent aspiration while CI enforces the raise-only ratchet. Two
different bars, nothing checking them, and the judge-facing one was the failing one.
Found by running the judge path in a fresh clone of `main` rather than in the working
tree. Fixed in `908a3db`; the gap to the aspiration is now printed on every short run
instead of being expressed as a failure, and a guard asserts the two bars match.

**12. Competitor analysis was published in this repository.** A sweep found our own
notes on other entrants in tracked files, including a line stating that a forensic pass
over the gallery had been run. Removed in `fbbf87b`. Recorded here because the first
pass fixed only the sites a targeted search named, and re-running it as a pattern grep
found five more. An audit's examples are a sample, not an inventory.

**13. Account identifiers were published in committed screenshots.** Two team members'
full email addresses, and an IBM Cloud subscription id, were legible in evidence images.
Redacted in `0054fb8`, identifiers only, with every usage figure, plan tier and date
left intact because those are the evidence. The originals remain in git history; that is
disclosed rather than quietly fixed.

**14. `next dev` rewrites a committed file and reintroduces banned characters.**
Running the dev server rewrites `AGENTS.md` and puts em-dashes back into it, and
repoints `next-env.d.ts` at dev-only type paths that would break the production
typecheck. Anyone who runs the dev server before committing ships both. Reverted each
time; noted here because it recurs and the CI em-dash check is what makes it visible.

---

## Standing gaps, disclosed

- **No Plan-mode transcript** for the build's critical path. Never exported, not
  reconstructed. See `docs/bob-evidence/plan-mode-critical-path.md`.
- **The uptime workflow is red while watsonx is over its token quota**, by design. It
  asserts the answer was Guardian-audited, so a dead generative path cannot show green.
  Green there means watsonx genuinely answered.
- **`granite-embedding-278m` is wired in code but unreachable in production**, because
  the committed corpus freeze selects the hashing-trick embedder. Stated in the README
  and now reported by `/api/status` rather than implied.
