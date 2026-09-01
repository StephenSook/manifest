"""
tests/test_judge_runtime_honesty.py

Guard: /judge and AskPanel print who is actually answering, and the
itinerary does not present Granite, Orchestrator, or Context Forge as
running when they are not.

Triggered by a 2026-08-26 review of how this failure mode shows up in
practice: a payload can be honest about its own mode while the README and
video still say a model wrote every explanation. Our /api/status.runtime
was already honest. The itinerary was not.

A source-text guard, not a render test. CI runs `pytest tests/` in
eval-gate.yml (fabricated-numbers job). File set is the working tree
(git ls-files --cached --others --exclude-standard is not needed here
because these paths are named).

No em-dashes. No fabricated figures.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
JUDGE_PAGE = REPO / "app" / "judge" / "page.tsx"
STATUS_PANEL = REPO / "components" / "judge" / "StatusPanel.tsx"
ASK_PANEL = REPO / "components" / "abstain" / "AskPanel.tsx"
STATUS_ROUTE = REPO / "app" / "api" / "status" / "route.ts"
ASK_ROUTE = REPO / "app" / "api" / "ask" / "route.ts"
VIDEO_SCRIPT = REPO / "docs" / "video" / "script.md"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_status_route_emits_runtime_generation_backend() -> None:
    text = _read(STATUS_ROUTE)
    assert "generation_backend" in text
    assert "offline-extractive" in text
    assert "runtime:" in text


# --------------------------------------------------------------------------
# Added 2026-08-29, after two false greens were found live on production.
#
# 1. embedding_backend reported "watsonx" whenever a key was present, in every
#    deployment, while app/api/ask/route.ts selects the embedder from the
#    corpus. The committed freeze is hashing-trick-768, so the watsonx embed
#    branch is unreachable and that field was wrong even when watsonx was
#    perfectly healthy.
# 2. generation_backend and guardian_audit are derived from credential
#    presence. The Lite token quota was exhausted, every generation call
#    returned 403, and the endpoint still reported watsonx and active.
#
# Source-text guards in the style of this file. They cannot prove the runtime
# is honest, they prove the two known ways it lied cannot come back silently.
# --------------------------------------------------------------------------


def test_embedding_backend_is_read_from_the_corpus_not_from_credentials() -> None:
    text = _read(STATUS_ROUTE)
    assert "readEmbeddingBackend" in text
    assert "embedding_backend: embeddingBackend" in text
    # The exact shape of the old defect: the field ternary'd on the credential
    # flag, so it described configuration instead of the loaded artifact.
    assert "embedding_backend: hasWatsonxCredentials" not in text


def test_embedding_predicate_mirrors_the_ask_route() -> None:
    """If these two drift apart, embedding_backend starts lying again."""
    status = _read(STATUS_ROUTE)
    ask = _read(ASK_ROUTE)
    for predicate in ("startsWith('hashing-trick')", "=== 'mock'"):
        assert predicate in ask, predicate
        assert predicate in status, predicate


def test_runtime_block_labels_which_claims_are_measured() -> None:
    text = _read(STATUS_ROUTE)
    assert "basis:" in text
    assert "not a health check" in text
    # The note must send a judge at the request that actually settles it.
    assert "POST /api/ask" in text


def test_ask_route_degrades_instead_of_returning_the_upstream_error() -> None:
    """
    watsonx is a metered dependency. A quota ceiling, an outage or a timeout
    must not take the product down while the keyless extractive path over the
    same corpus is available.
    """
    text = _read(ASK_ROUTE)
    # The old shape: the generation catch returned the SDK message as the
    # user's entire answer and abstained.
    assert "reason: `Generation failed: ${msg}`" not in text
    assert "extractiveResponse(" in text
    assert "buildExtractiveResponse" in text


def test_ask_route_still_fails_closed_on_a_real_guardian_verdict() -> None:
    """
    The fallback covers UNREACHABLE watsonx only. A Guardian FAIL verdict is a
    judgement about a generated answer and must still abstain, or the fix
    would have quietly removed the abstention feature.
    """
    text = _read(ASK_ROUTE)
    assert "if (!auditPassed) {" in text
    assert "abstained: true" in text


def test_ask_panel_attributes_the_answer_to_what_produced_it() -> None:
    """
    The writer line used to read every field from /api/status, which is
    credential-derived, so during the 2026-08-29 quota outage it would have
    printed "Writer: watsonx. Guardian: active." directly above a reason
    saying the answer came from the extractive path.
    """
    text = _read(ASK_PANEL)
    assert "degraded" in text
    assert "data?.degraded" in text
    # The pre-request banner can only speak for configuration.
    assert "Who is answering, as configured" in text
    # Substring chosen to sit on one source line: JSX wraps prose, so a
    # longer phrase would assert against the formatter rather than the copy.
    assert "read from credential presence" in text


def test_status_panel_renders_the_basis_column() -> None:
    text = _read(STATUS_PANEL)
    assert "basis" in text
    # "Running now" asserted measured state for two values that are inferred.
    assert "'Running now'" not in text
    assert "'Reported'" in text
    assert "'Basis'" in text


def test_degraded_flag_is_machine_readable() -> None:
    """
    A score measured across degraded responses measures the extractive path.
    Publishing one as a watsonx measurement is the failure this flag prevents,
    so it must not be prose only.
    """
    text = _read(ASK_ROUTE)
    assert "degraded?: boolean" in text
    status = _read(STATUS_ROUTE)
    assert "degraded: true" in status


def test_status_panel_renders_runtime_writer() -> None:
    text = _read(STATUS_PANEL)
    assert "generation_backend" in text
    assert "Who is answering" in text
    assert "RuntimeCard" in text
    assert "data.runtime" in text


def test_ask_panel_prints_writer_from_status() -> None:
    text = _read(ASK_PANEL)
    assert "generation_backend" in text
    assert "/api/status" in text
    assert "Who is answering" in text
    assert "Writer:" in text


def test_judge_page_does_not_claim_unwired_bob_layers() -> None:
    text = _read(JUDGE_PAGE)
    assert "Orchestrator" not in text
    assert "Context Forge" not in text
    assert "Granite generation pipeline" not in text
    assert "vis-timeline" not in text
    assert "Eval score panel (live)" not in text
    assert "runtime.generation_backend" in text


def test_judge_pending_table_names_real_gaps() -> None:
    """
    The pending table must name a gap that is CURRENTLY real.

    Until 2026-08-31 this asserted the row said watsonx credentials had not
    landed and generation was "offline-extractive". They landed, production
    began reporting generation_backend watsonx and guardian_audit active, and
    the row kept telling judges the opposite of what the same deployment's
    /api/status returned. A guard pinned to the old wording is what kept it
    there: the assertion was green precisely because the claim was stale.

    So this guard retires by asserting the SUCCESSOR state rather than by
    dropping the check. The row must now name model HEALTH as the open gap,
    say that the reported values come from credential presence, and point at
    the request that actually settles it. And it must NOT still say the
    credentials are being waited on.
    """
    text = _read(JUDGE_PAGE)
    assert "watsonx model health" in text
    assert "credential presence" in text
    assert "degraded and reason" in text
    # The stale claim must be gone, not merely outweighed by new text.
    assert "Until they land" not in text
    assert "offline-extractive and Guardian is inactive" not in text
    assert "lane-enforcement.md is not yet committed" not in text
    assert "Plan-mode transcript (task 1.13)" not in text
    assert "Task 1.3 (corpus freeze)" not in text
    assert "Task 2.3 (vis-timeline)" not in text
    # Step 5 now points at the honesty logs, not at missing paths.
    assert "docs/bob-evidence/lane-enforcement.md" in text
    assert "docs/bob-evidence/plan-mode-critical-path.md" in text


def test_video_script_parks_one_tap_and_prior_rules() -> None:
    text = _read(VIDEO_SCRIPT)
    lower = text.lower()
    assert "no typing" in lower
    assert "one seeded mission" in lower
    assert "playabilityStatus" in text
    assert "caption" in lower
    assert "generation_backend" in text
    assert "YouTube ID" in text
    assert "audio stream" in lower
    assert "pre-warm" in lower


def test_persistent_scope_notice_is_on_every_page() -> None:
    """
    Guard: the scope notice lives in the shared layout, so it cannot be
    present on the judge page and missing on the planner.

    Added 2026-08-29 from a competitor review. A rival shipped a persistent
    "DEMO DATA - NOT FOR OPERATIONAL USE" footer on every page, which was the
    single most honest thing in that submission, and we had no in-product
    disclaimer anywhere. A licensing planner that reads as authoritative is
    dangerous in a way most demos are not: a user who treats a computed date
    as the legal deadline can miss a real one.

    The assertion checks the MECHANISM sentence, not just a disclaimer. A bare
    "not legal advice" line tells a reader nothing about whether to trust the
    number in front of them.
    """
    layout = (REPO / "app" / "layout.tsx").read_text(encoding="utf-8")
    assert "Planning aid, not legal authority" in layout
    assert "contentinfo" in layout, "the notice must be a real footer landmark"
    # The two hard rules the notice rests on must both be named.
    assert "abstains" in layout, "cite-or-abstain (hard rule 1) must be stated"
    assert "DOCUMENTED" in layout and "ESTIMATED" in layout, (
        "documented-vs-estimated lead times (hard rule 3) must be stated"
    )


def test_the_one_tap_refusal_demo_points_at_a_question_that_actually_ships() -> None:
    """
    Guard: the exact question the judge surfaces tell a reader to tap must be
    one AskPanel actually offers, and must really be an abstention trap.

    Added 2026-08-30 from a competitor review. The strongest rival ships a
    link that makes a judge WATCH a guard fail (a tampered receipt), which
    converts a claim into a thing seen. We already had the mechanism, a
    one-tap suggested question that returns the verbatim regime line, but no
    judge surface named it, so it was a statistic a reader had to trust
    rather than a refusal they could watch.

    The drift this prevents is specific: someone edits the suggested
    questions, and the judge instruction silently points at a tap that no
    longer exists. That is worse than not having the instruction, because it
    sends a judge to look for something and fails them.
    """
    demo_question = "When does Part 100 take effect?"

    ask_panel = _read(ASK_PANEL)
    assert demo_question in ask_panel, (
        f"{demo_question!r} is no longer a suggested question in AskPanel, so "
        "the judge instructions now point at a tap that does not exist"
    )

    judge_md = (REPO / "JUDGE.md").read_text(encoding="utf-8")
    assert demo_question in judge_md
    assert "Watch it refuse" in judge_md

    judge_page = _read(JUDGE_PAGE)
    assert demo_question in judge_page
    assert "Watch it refuse" in judge_page

    # And it must genuinely be trapped before generation, not merely answered
    # briefly. The pattern lives in the ask route's abstention table.
    lib = (REPO / "app" / "api" / "ask" / "lib.ts").read_text(encoding="utf-8")
    assert "part 100 take effect" in lib.lower(), (
        "the demo question must match an ABSTENTION_PATTERNS entry, or it is "
        "not a trap and the judge surfaces are describing behaviour we do not "
        "have"
    )
    assert "Part 25 remains binding today" in lib, (
        "the verbatim regime line (hard rule 2) must be the reason returned"
    )


def test_uptime_probe_is_a_question_the_eval_already_scores() -> None:
    """
    Guard: the uptime watchdog's probe must be VERBATIM an eval bank question
    that appears in baseline_passing.json.

    Why this exists. On 2026-08-30 the probe was changed, because the previous
    question returned `Guardian audit: ASSISTANTFAIL` on four consecutive runs
    and the watchdog was asserting a failure that was not one. That change is
    legitimate, and it is also exactly the shape of a change that is NOT: swap
    the question until the light goes green.

    This makes the difference structural instead of a matter of intent. The
    probe cannot be quietly replaced with something easier, because it has to
    be a question the eval bank already contains AND already scores as passing.
    If someone wants a different probe, they have to change the bank, which is
    scored in CI and ratcheted.
    """
    import json

    workflow = (REPO / ".github" / "workflows" / "uptime.yml").read_text(encoding="utf-8")

    bank_path = REPO / "eval" / "bank.jsonl"
    rows = [json.loads(line) for line in bank_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    passing = set(json.loads((REPO / "eval" / "baseline_passing.json").read_text(encoding="utf-8"))["passing"])

    # Find which bank question the workflow actually asks.
    asked = [r for r in rows if r.get("question") and r["question"] in workflow]
    assert asked, (
        "the uptime probe question is not verbatim any eval bank question. "
        "A watchdog should ask something the eval already scores, so the probe "
        "cannot be tuned until it passes."
    )
    assert len(asked) == 1, f"probe matched multiple bank rows: {[r['id'] for r in asked]}"

    row = asked[0]
    assert not row.get("abstain"), (
        f"the probe is {row['id']}, an ABSTENTION TRAP. The watchdog requires "
        "abstained=false, so probing a trap can never pass."
    )
    assert row["id"] in passing, (
        f"the probe is {row['id']}, which is not in eval/baseline_passing.json. "
        "The watchdog must ask a question this product is already scored as "
        "able to answer, or a red light means nothing."
    )


def test_uptime_still_demands_a_guardian_audited_answer() -> None:
    """
    The probe changed; the bar must not have. If a future edit relaxes these,
    the watchdog goes green on a dead generative path.
    """
    workflow = (REPO / ".github" / "workflows" / "uptime.yml").read_text(encoding="utf-8")
    assert 'data.get("audited") is not True' in workflow
    assert 'data.get("degraded") is True' in workflow
    assert '"97.207" in combined' in workflow
    assert 'data.get("abstained") is not False' in workflow


DEORBIT_PANEL = REPO / "components" / "deorbit" / "DeorbitPanel.tsx"


def test_components_block_asserts_only_what_it_measured() -> None:
    """
    /api/status may publish per-component booleans ONLY for state this handler
    observed while building the response.

    Borrowed, with its failure attached, from a rival whose /api/health returned
    per-component booleans reporting both models loaded while the endpoint those
    models serve returned 500 on every attempt. The booleans described what was
    CONFIGURED. A health field that cannot be wrong is decoration, and a health
    field that contradicts the product is worse than none.

    watsonx and Guardian therefore must NOT appear as booleans here: their health
    cannot be established without spending a token. runtime.basis already reports
    them in words as credential presence, which is the honest framing.
    """
    text = _read(STATUS_ROUTE)
    start = text.index("const components = {")
    block = text[start : text.index("};", start)]

    for measured in (
        "engine_graph_built",
        "critical_path_computed",
        "decay_table_loaded",
        "corpus_bundled",
        "scenarios_loaded",
    ):
        assert measured in block, f"components lost its measured field {measured}"

    # The whole point. A boolean for either of these would be asserting health
    # that nothing checked, which is the defect this block was copied FROM.
    for unmeasurable in ("watsonx_", "guardian_", "_healthy", "model_loaded"):
        assert unmeasurable not in block, (
            f"components declares '{unmeasurable}', which cannot be measured "
            "without spending a token. Report it in runtime.basis as credential "
            "presence instead, or measure it for real."
        )


def test_deorbit_panel_labels_the_f107_it_used_in_BOTH_states() -> None:
    """
    The F10.7 row must say where its number came from whether or not a live
    reading was supplied.

    Until 2026-08-31 only the `(live)` branch was labelled, and nothing in the
    app passes f107Override, so that branch could never render: every user saw a
    bare number and could reasonably read it as today's flux. It is the value the
    decay-table row assumed.

    Borrowed from a rival that renders "Simulated NDVI grid (demo)" under the
    chart itself rather than only in its README.
    """
    text = _read(DEORBIT_PANEL)
    assert "(live)" in text, "the live label disappeared"
    assert "table nominal" in text, (
        "the DEFAULT state is unlabelled again. The branch that actually renders "
        "is the one without an override, so it is the one that must say so."
    )
    assert "not a live integration for this orbit" in text, (
        "the panel no longer states that the verdict is a lookup into a frozen "
        "NRLMSISE-00 run. README and docs/submission.md both say it; the panel "
        "is what a judge looks at."
    )


def test_every_repo_path_named_in_bob_actually_exists() -> None:
    """
    A path named inside `.bob/` must exist in the tree.

    `.bob/` is this project's strongest judged artifact, and the failure mode it
    is exposed to is drift: a mode, plan or skill that names files which moved or
    were never written. A rival graded this cycle shipped a `.bob/` declaring one
    file the single source of truth while a duplicate of it sat in `src/` and was
    the copy the code imported. Their `.bob/` read as configuration and was
    documentation. This guard is what keeps ours from becoming the same thing.

    Running it the first time found two real drifts: the freeze plan required an
    Orchestrator transcript for a mode Bob 2.0.3 does not have, and a Playwright
    spec that was never written while `package.json` still carried a `test:e2e`
    script pointing at a runner with zero inputs. Both were closed rather than
    documented.

    FRAGMENT GUARD, and it exists because the first version of this check was
    wrong. `custom_modes.yaml` holds fileRegex patterns, so a scan pulls
    `tests/test_decay.py` out of `^pipeline/(decay\\.py|...|tests/test_decay\\.py)$`
    and reports it missing while `pipeline/tests/test_decay.py` sits right there.
    A candidate that is a SUFFIX of a real tracked path is a fragment of a longer
    path, not a missing file. Without this the guard cries wolf on its own
    strongest evidence, which is how a useful check gets deleted.
    """
    import subprocess

    tracked = set(
        subprocess.run(
            ["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True
        ).stdout.split()
    )
    bob_files = [f for f in tracked if f.startswith(".bob/")]
    assert len(bob_files) >= 10, (
        f"only {len(bob_files)} tracked files under .bob/. This guard cannot pass "
        "vacuously: if .bob/ shrank, that is the finding."
    )

    pattern = re.compile(
        r"\b((?:app|engine|lib|corpus|eval|pipeline|components|data|tests|scripts"
        r"|docs|mobile|services)/[A-Za-z0-9_./-]+"
        r"\.(?:ts|tsx|py|json|jsonl|md|sh|yaml|yml))\b"
    )

    # A path inside ~~strikethrough~~ is a RECORD of something cut, not a live
    # claim, and a plan has to be able to name what it removed. Same principle
    # as fencing a published video transcript so a historical figure is not
    # linted as a present-tense count. Anything outside the strikethrough is
    # still a claim and is still checked.
    struck = re.compile(r"~~.*?~~", re.S)

    referenced, missing = 0, []
    for rel in bob_files:
        path = REPO / rel
        if not path.is_file():
            continue
        text = struck.sub("", path.read_text(encoding="utf-8"))
        for candidate in sorted(set(pattern.findall(text))):
            referenced += 1
            if candidate in tracked:
                continue
            # Fragment of a longer real path, see the docstring.
            if any(real.endswith("/" + candidate) for real in tracked):
                continue
            missing.append(f"{rel} names {candidate}, which is not in the tree")

    assert referenced >= 20, (
        f"only {referenced} repo paths found across .bob/. The extraction pattern "
        "probably broke, which would make this guard silently useless."
    )
    assert not missing, "\n".join(missing)


LIVE_RESPONSES = REPO / "docs" / "evidence" / "live-responses.json"


def test_committed_live_responses_are_verbatim_and_self_describing() -> None:
    """
    The committed capture must be a real response, not a composed one.

    Borrowed from a rival that commits its model's actual output as an artifact
    (`reports/spaceguard-report-*.json` carrying `"provider": "IBM watsonx.ai"`
    and the full generated text), which lets a judge verify the AI path ran
    without a key, without a live endpoint, and without running anything. On a
    panel measured across three cycles as not cloning repos and not probing
    runtimes, an artifact a judge can READ is worth more than a path they could
    theoretically exercise.

    That only holds if the artifact is genuinely verbatim, so this asserts the
    shape a real capture has and that a composed one would not:

    - the runtime block that produced it, copied from /api/status
    - reproduction commands, so a reader can obtain it themselves
    - BOTH halves of the claim: an audited cited answer AND a refused trap.
      A capture showing only successes is marketing.
    - the abstention carries the verbatim regime line, which is a hard product
      rule, so a paraphrase here would be a fabricated quote.
    - the deployed build is named, or explicitly recorded as unknown. Guessing a
      SHA would be exactly the drift this file exists to disprove.
    """
    assert LIVE_RESPONSES.exists(), (
        "docs/evidence/live-responses.json is missing. It is a captured artifact, "
        "not a generated one: re-capture it from the deployment, never hand-write it."
    )
    art = json.loads(LIVE_RESPONSES.read_text(encoding="utf-8"))

    for key in (
        "captured_at_utc",
        "captured_from",
        "how_to_reproduce",
        "runtime_that_produced_these",
        "build_that_produced_these",
        "responses",
    ):
        assert key in art, f"live-responses.json lost its {key} field"

    assert len(art["how_to_reproduce"]) >= 2, "reproduction commands are the point"

    responses = art["responses"]
    assert len(responses) >= 2, "one response is not evidence of a refusal path"

    answered = [r for r in responses if r["response"].get("abstained") is False]
    refused = [r for r in responses if r["response"].get("abstained") is True]
    assert answered, "no answered response captured"
    assert refused, (
        "no REFUSED response captured. A capture showing only successes is "
        "marketing, and abstention is the half of this product that is hard."
    )

    a = answered[0]["response"]
    assert a.get("audited") is True, "the captured answer is not marked audited"
    assert a.get("citations"), "the captured answer carries no citation"
    cite = a["citations"][0]
    for field in ("cfrTitle", "part", "section", "paragraphPath", "amddate"):
        assert cite.get(field) not in (None, ""), f"citation is missing {field}"

    # The regime line is fixed product policy. A paraphrase here would be a
    # fabricated quote, which is the worst thing this file could contain.
    reason = refused[0]["response"].get("reason", "")
    assert "Part 100 was adopted July 22, 2026 (FCC 26-47)" in reason, (
        "the captured abstention does not carry the verbatim regime line"
    )
    assert "Part 25 remains binding today." in reason, (
        "the captured abstention does not carry the full verbatim regime line"
    )


def test_corpus_shape_states_what_it_did_not_prove() -> None:
    """
    /api/status may report the corpus SHAPE, and must not claim it loaded it.

    Borrowed from a rival shipping `ml_trained` as a first-class field so its UI
    can say whether the model is warm rather than rendering a meaningless score.
    The same gap existed here: status reported snapshot DATES but never how much
    corpus there is, so a reader could not tell a loaded index from an empty one
    without posting a question and getting an abstention.

    The guard exists because of how that steal arrived. The rival asserted a
    readiness it had not tested, and a sibling project in the same batch turned a
    NameError into a success-shaped 200 that was undetectable from the response.
    Reading `corpus/schema.json` proves the manifest DECLARES a shape. It does
    not prove 3524 vectors parse. So the block must carry `declared_by` and must
    NOT carry a boolean asserting readiness, which is the shape that lies.
    """
    text = _read(STATUS_ROUTE)
    start = text.index("function readCorpusShape()")
    block = text[start : text.index("const corpusShape", start)]

    for field in ("chunk_count", "vector_dim", "embedder", "declared_by"):
        assert field in block, f"corpus shape lost its {field} field"

    for overclaim in (
        "corpus_loaded",
        "corpus_ready",
        "queryable",
        "index_loaded",
        "vectors_parsed",
    ):
        assert overclaim not in block, (
            f"corpus shape declares '{overclaim}', which reading a JSON manifest "
            "cannot establish. Report the declared shape and point at "
            "POST /api/ask, or actually load the vectors and measure it."
        )

    # A missing corpus must be a NAMED absence, never a zero that reads as a
    # real but empty index.
    assert "CORPUS_NOT_BUNDLED" in block, (
        "the failure branch no longer names the absence, so a missing corpus "
        "could render as chunk_count 0 and read like a real empty index"
    )


def test_pipeline_counterfactual_describes_paths_that_exist() -> None:
    """
    The pipeline block must name real stages and must state the counterfactual.

    Borrowed from a rival that renders its pipeline as four side-by-side panels
    plus an "AI off" counterfactual, so the model's value is a visible delta
    rather than an assertion. It is the clearest legibility device in its batch,
    and it is worth having because this panel reads pages and does not probe
    runtimes.

    Ours inverts theirs and the inversion is the whole claim: their
    counterfactual shows what is LOST without the model, ours shows the deorbit
    verdict is UNCHANGED. So the guard requires the block to keep saying that,
    and to keep pointing at the test that proves it, because a counterfactual
    nobody can check is just a nicer assertion.
    """
    text = _read(STATUS_ROUTE)
    start = text.index("const PIPELINE = {")
    block = text[start : text.index("} as const;", start)]

    # Every stage must state what it does with the model off. That column is
    # the entire point of the device; a stage without it is decoration.
    # Count the KEY, not the string: the prose above also names the column, and
    # counting bare occurrences made this assertion fail on its own first run.
    keys = block.count("with_model_off:")
    assert keys == 4, f"expected 4 stages each declaring with_model_off, found {keys}"
    for stage in ("Retrieval", "Generation", "Citation gate", "Guardian audit"):
        assert stage in block, f"pipeline lost the {stage} stage"

    # The two subtractive guarantees. If either stage ever becomes able to ADD
    # an answer rather than only withhold one, these sentences become false and
    # this test is where that surfaces.
    assert "never invent one" in block, "the citation gate no longer states it is subtractive"
    assert "fails CLOSED" in block, "the Guardian audit no longer states it fails closed"

    # The counterfactual must name the test that proves it, not just claim it.
    assert "engine/__tests__/isolation.test.ts" in block, (
        "the verdict counterfactual no longer cites the test that proves the "
        "engine cannot reach a model. An uncheckable counterfactual is just an "
        "assertion with better formatting."
    )
    assert "ZERO non-relative imports" in block

    # And that test must actually exist, or the citation above is a dead pointer.
    assert (REPO / "engine" / "__tests__" / "isolation.test.ts").exists(), (
        "the pipeline block cites engine/__tests__/isolation.test.ts and that "
        "file is gone"
    )


class TestTheUiNeverNamesABackendItDidNotMeasure:
    """A component may render a measured backend. It may not hardcode one.

    The embedder is a property of the committed corpus artifact, so a literal
    in a component is a copy that no rebuild updates. It would keep printing
    the old name after a corpus swap while /api/status reported the new one,
    and the wrong one is the one a judge reads. Same defect class as a figure
    with no source: a name asserted by nothing that measured it.
    """

    BACKEND_LITERALS = (
        "hashing-trick",
        "granite-embedding",
        "granite-4-h-small",
        "granite-guardian",
        "slate-",
    )

    def _components(self):
        root = REPO / "components"
        files = [
            p
            for p in root.rglob("*.tsx")
            if "__tests__" not in p.parts and "node_modules" not in p.parts
        ]
        assert len(files) >= 5, (
            f"Only {len(files)} components found under {root}. The guard walks "
            "an empty or wrong set, so it would pass without checking "
            "anything. A guard that finds no inputs must fail, not pass."
        )
        return files

    def test_no_component_hardcodes_a_model_or_embedder_name(self):
        offenders = []
        for path in self._components():
            for lineno, line in enumerate(
                path.read_text(encoding="utf-8").splitlines(), start=1
            ):
                stripped = line.strip()
                # A comment may name a backend: explaining WHY the literal is
                # absent is the point of this rule, not a violation of it.
                if stripped.startswith("//") or stripped.startswith("*"):
                    continue
                for literal in self.BACKEND_LITERALS:
                    if literal in line:
                        rel = path.relative_to(REPO)
                        offenders.append(f"{rel}:{lineno}: {stripped[:90]}")
        assert offenders == [], (
            "A component names a model or embedder as a literal. Read it from "
            "/api/status, or say the client did not read it. Offenders:\n  "
            + "\n  ".join(offenders)
        )


class TestNoModelOutputIsInterpolatedIntoAUserFacingReason:
    """A `reason` is prose shown to whoever triggered an abstention.

    Interpolating a model's raw text into it ships whatever the model felt
    like emitting. Guardian echoes its own risk definition often enough that
    this actually happened: the live reason field read "Guardian audit
    returned no verdict: OUR SAFETY RISK DEFINITION IS DEFINED BELOW:
    <START_OF_RISK_DEFINITION> * THE 'A", cut mid-word at 80 characters.

    A model variable may be logged. It may not be interpolated into prose.
    """

    MODEL_VARS = ("lastResult", "generated_text", "rawVerdict", "guardianText")

    def test_the_route_exists_and_builds_reasons(self):
        """Anti-vacuity: the guard must be reading the real file."""
        route = REPO / "app" / "api" / "ask" / "route.ts"
        assert route.exists(), f"{route} is missing, so this guard checks nothing"
        text = route.read_text(encoding="utf-8")
        assert "reason:" in text, "route.ts builds no reason field, guard is misaimed"

    def test_no_reason_interpolates_a_model_output_variable(self):
        route = REPO / "app" / "api" / "ask" / "route.ts"
        offenders = []
        for lineno, line in enumerate(
            route.read_text(encoding="utf-8").splitlines(), start=1
        ):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            if "reason:" not in stripped and "reason =" not in stripped:
                continue
            for var in self.MODEL_VARS:
                if "${" + var in stripped or "${" + var + "." in stripped:
                    offenders.append(f"route.ts:{lineno}: {stripped[:100]}")
        assert offenders == [], (
            "A user-facing reason interpolates raw model output. Log it "
            "server-side and return a shaped sentence instead. Offenders:\n  "
            + "\n  ".join(offenders)
        )


class TestTheReadmeQuoteOfThePromptCannotDriftFromTheCode:
    """The README quotes the generation prompt verbatim. Verify it IS verbatim.

    Quoting a prompt in a README is only worth doing if the quote is bound to
    the code. Unbound, it is a design doc: it stays true until someone edits
    the string, and then it is a confident, readable, wrong claim about the
    product's central rule. This is the same failure as a README describing
    an integration the shipped code no longer uses.
    """

    @staticmethod
    def _shipped_prompt() -> str:
        source = (REPO / "app" / "api" / "ask" / "route.ts").read_text(
            encoding="utf-8"
        )
        start = source.index("const prompt = `") + len("const prompt = `")
        end = source.index("`;", start)
        return source[start:end].strip()

    @staticmethod
    def _readme_quote() -> str:
        """The README quotes the prompt as a markdown blockquote.

        Only the first two lines are quoted: the rest of the template is the
        context and question interpolation, which says nothing a reader needs.
        So this compares the quoted PREFIX, not the whole string, and asserts
        the prefix is the real opening of the shipped prompt.
        """
        text = (REPO / "README.md").read_text(encoding="utf-8")
        marker = "**The honesty rule, quoted verbatim from the shipped prompt**"
        assert marker in text, (
            "the README line that introduces the verbatim prompt quote is "
            "gone, so this guard is checking nothing"
        )
        after = text[text.index(marker) :]
        lines = []
        for line in after.splitlines()[1:]:
            if line.startswith("> "):
                lines.append(line[2:])
            elif lines:
                break
        assert lines, "no blockquote follows the marker line"
        return "\n".join(lines).strip()

    def test_both_sides_are_substantial(self):
        """Anti-vacuity: two empty strings are equal and prove nothing."""
        for name, value in (
            ("shipped prompt", self._shipped_prompt()),
            ("README quote", self._readme_quote()),
        ):
            assert len(value) > 200, f"{name} is only {len(value)} chars"
            assert "cite" in value.lower(), f"{name} does not mention citing"

    def test_the_readme_quote_is_byte_identical_to_the_shipped_prompt(self):
        shipped = self._shipped_prompt()
        quoted = self._readme_quote()
        assert shipped.startswith(quoted), (
            "The README quote of the generation prompt has drifted from "
            "app/api/ask/route.ts. The quoted lines must be a verbatim "
            "PREFIX of the shipped template.\n"
            f"--- README ---\n{quoted}\n--- SHIPPED ---\n{shipped}"
        )


class TestEveryStackClaimPointsAtCodeThatExists:
    """The half a rival's transparency endpoint was missing.

    A competitor publishes per-technology `wired_in` and `load_bearing` as
    JSON. It is the right shape and it is unchecked, which is exactly how they
    came to assert Docling as load_bearing with a named file path while Docling
    was absent from their dependencies, had no input directory, and never ran.

    A claim table nobody verifies is a design doc with a JSON content type.
    These tests are what make ours evidence: every wired_in path must exist,
    and must contain the marker string the entry claims proves it.
    """

    @staticmethod
    def _entries() -> list[dict]:
        source = (REPO / "app" / "api" / "status" / "route.ts").read_text(
            encoding="utf-8"
        )
        i = source.index("const STACK = [")
        block = source[i : source.index("] as const;", i)]
        entries = []
        for chunk in block.split("{")[1:]:
            entry = {}
            for key in ("wired_in", "marker", "name", "without_it"):
                m = re.search(rf"{key}:\s*\n?\s*'([^']*)'", chunk)
                if m:
                    entry[key] = m.group(1)
            m = re.search(r"load_bearing:\s*(true|false)", chunk)
            if m:
                entry["load_bearing"] = m.group(1) == "true"
            if "wired_in" in entry:
                entries.append(entry)
        return entries

    def test_the_table_was_actually_parsed(self):
        """Anti-vacuity: an empty list passes every check below."""
        entries = self._entries()
        assert len(entries) >= 6, (
            f"parsed only {len(entries)} stack entries; the parser is broken or "
            "the table was emptied, either of which would pass silently"
        )

    def test_every_wired_in_path_exists(self):
        missing = [
            f"{e['name']} -> {e['wired_in']}"
            for e in self._entries()
            if not (REPO / e["wired_in"]).exists()
        ]
        assert missing == [], (
            "The stack manifest names files that do not exist in this repo: "
            f"{missing}. This is the exact defect the table exists to prevent."
        )

    def test_every_marker_is_present_in_its_named_file(self):
        offenders = []
        for e in self._entries():
            path = REPO / e["wired_in"]
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8", errors="replace").lower()
            if e["marker"].lower() not in text:
                offenders.append(f"{e['name']}: {e['wired_in']} lacks {e['marker']!r}")
        assert offenders == [], (
            "A stack entry claims a technology is wired in a file that does not "
            "mention it:\n  " + "\n  ".join(offenders)
        )

    def test_every_entry_states_what_happens_without_it(self):
        thin = [
            e["name"]
            for e in self._entries()
            if len(e.get("without_it", "")) < 40
        ]
        assert thin == [], (
            f"Entries with no meaningful degradation statement: {thin}. "
            "'load_bearing' means nothing unless the alternative is stated."
        )

    def test_the_inactive_model_is_declared_inactive(self):
        """The honest entry is the one this whole table is judged on."""
        entry = next(
            (e for e in self._entries() if "Embedding" in e["name"]), None
        )
        assert entry is not None, "the embedding entry left the stack manifest"
        assert entry["load_bearing"] is False, (
            "granite-embedding is marked load_bearing, but it does not run. "
            "The corpus was built with hashing-trick-768."
        )


class TestTheScopeNoticeSurvivesAnUnexpectedThrow:
    """The disclosure must hold on the path nobody exercises.

    Every RETURN in the ask route carries the scope notice, enforced by the
    required `scope` field on AskResponse. A THROW carries nothing: it bypasses
    every return, and Next answers with a 500 and a zero-byte body. Measured by
    fault injection, not assumed.

    Borrowed from a rival whose safety envelope is merged into its exception
    handlers precisely so its authority disclaimer cannot diverge between
    paths. A disclosure that holds on thirteen paths and vanishes on the
    fourteenth is one a judge can catch us not making.
    """

    @staticmethod
    def _post_body() -> str:
        route = (REPO / "app" / "api" / "ask" / "route.ts").read_text(encoding="utf-8")
        start = route.index("export async function POST(")
        end = route.index("\nasync function handleAsk(", start)
        return route[start:end]

    def test_the_handler_is_actually_there(self):
        """Anti-vacuity: an empty slice satisfies nothing below."""
        body = self._post_body()
        assert len(body) > 200, f"POST handler parsed to {len(body)} chars"
        assert "handleAsk" in body

    def test_the_post_handler_catches_everything(self):
        body = self._post_body()
        assert "try {" in body and "catch" in body, (
            "app/api/ask/route.ts POST has no top-level try/catch, so an "
            "unexpected throw returns a 500 with a zero-byte body and no scope "
            "notice. Verified by fault injection when this guard was written."
        )

    def test_the_catch_returns_a_shaped_abstention_with_the_notice(self):
        body = self._post_body()
        catch = body[body.index("catch") :]
        for needle, why in (
            ("scope: SCOPE_NOTICE", "the scope notice must ship on the throw path"),
            ("abstained: true", "a failed request is an abstention, not an answer"),
            ("answer: null", "no answer may be implied when nothing was generated"),
            ("citations: []", "no citation may be implied when nothing was retrieved"),
        ):
            assert needle in catch, f"the catch block omits {needle!r}: {why}"

    def test_the_catch_never_interpolates_the_error_into_prose(self):
        """Pasting an exception into `reason` is how Guardian scaffolding once
        reached the reader. The error is logged, never rendered."""
        body = self._post_body()
        catch = body[body.index("catch") :]
        reason_start = catch.index("reason:")
        reason = catch[reason_start : reason_start + 400]
        assert "${err" not in reason and "${error" not in reason, (
            "the catch interpolates the thrown error into the user-facing "
            "reason. Log it instead."
        )
        assert "console.error" in catch, (
            "the thrown error is neither logged nor rendered, so it is lost"
        )
