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
VIDEO_SCRIPT = REPO / "docs" / "video" / "script.md"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_status_route_emits_runtime_generation_backend() -> None:
    text = _read(STATUS_ROUTE)
    assert "generation_backend" in text
    assert "offline-extractive" in text
    assert "runtime:" in text


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
    assert "lane-enforcement.md" in text
    assert "Task 1.3 (corpus freeze)" not in text
    assert "Task 2.3 (vis-timeline)" not in text


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
