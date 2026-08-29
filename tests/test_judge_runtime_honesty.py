"""
tests/test_judge_runtime_honesty.py

Guard: /judge and AskPanel print who is actually answering, and the
itinerary does not present Granite, Orchestrator, or Context Forge as
running when they are not.

Triggered by the 2026-08-26 Sky to Porch grade: their payload was honest
(explanationStatus.mode=deterministic) and the README/video still said
Granite wrote every explanation. Our /api/status.runtime was already
honest. The itinerary was not.

A source-text guard, not a render test. CI runs `pytest tests/` in
eval-gate.yml (fabricated-numbers job). File set is the working tree
(git ls-files --cached --others --exclude-standard is not needed here
because these paths are named).

No em-dashes. No fabricated figures.
"""

from __future__ import annotations

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
    text = _read(JUDGE_PAGE)
    assert "offline-extractive" in text
    assert "Task 0.13" in text
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
