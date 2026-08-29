"""
tests/test_bob_lane_enforcement.py

Guard: the five Bob custom modes' groups.edit.fileRegex values actually
isolate lanes. Frontend cannot write docs/architecture.svg.
Evidence-writer can. That is task 2.22 as a CI assertion, not as a
composed chat log.

Triggered by a 2026-08-26 review: a Bob log that names what Bob
did not do. Inventing the missing Plan-mode or lane-enforcement chats
would be the anti-pattern. The yaml is the source of truth.

CI runs `pytest tests/` in eval-gate.yml. No PyYAML: the quoted
fileRegex strings are parsed from the committed yaml text.

No em-dashes. No fabricated figures.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
YAML = REPO / ".bob" / "custom_modes.yaml"
LANE_DOC = REPO / "docs" / "bob-evidence" / "lane-enforcement.md"
PLAN_DOC = REPO / "docs" / "bob-evidence" / "plan-mode-critical-path.md"

REQUIRED_SLUGS = (
    "corpus-engineer",
    "regulatory-engine",
    "mobile-shell",
    "frontend",
    "evidence-writer",
)

# (mode, path, allowed)
LANE_CASES: tuple[tuple[str, str, bool], ...] = (
    ("frontend", "docs/architecture.svg", False),
    ("frontend", "docs/bob-evidence/lane-enforcement.md", False),
    ("frontend", "app/judge/page.tsx", True),
    ("frontend", "app/api/status/route.ts", False),
    ("frontend", "components/graph/x.tsx", True),
    ("frontend", "lib/store.ts", True),
    ("frontend", "public/icon.png", True),
    ("frontend", "sw.ts", True),
    ("frontend", "tests/e2e/foo.spec.ts", True),
    ("frontend", "README.md", False),
    ("frontend", "engine/graph.ts", False),
    ("evidence-writer", "docs/architecture.svg", True),
    ("evidence-writer", "docs/bob-evidence/lane-enforcement.md", True),
    ("evidence-writer", "docs/bob-evidence/plan-mode-critical-path.md", True),
    ("evidence-writer", "README.md", True),
    ("evidence-writer", "app/judge/page.tsx", False),
    ("evidence-writer", "engine/graph.ts", False),
    ("evidence-writer", "sw.ts", False),
    ("regulatory-engine", "engine/graph.ts", True),
    ("regulatory-engine", "docs/architecture.svg", False),
    ("regulatory-engine", "app/api/status/route.ts", True),
    ("regulatory-engine", "tests/test_bob_lane_enforcement.py", True),
    ("regulatory-engine", "tests/e2e/foo.spec.ts", False),
    ("corpus-engineer", "app/api/ask/route.ts", True),
    ("corpus-engineer", "corpus/schema.json", True),
    ("corpus-engineer", "docs/architecture.svg", False),
    ("mobile-shell", "mobile/notifications.ts", True),
    ("mobile-shell", "capacitor.config.ts", True),
    ("mobile-shell", "docs/architecture.svg", False),
)


def _mode_file_regexes(text: str) -> dict[str, str]:
    """Last quoted fileRegex per slug wins. That is the groups.edit value."""
    modes: dict[str, str] = {}
    current: str | None = None
    for line in text.splitlines():
        slug = re.match(r"^\s+- slug: (\S+)$", line)
        if slug:
            current = slug.group(1)
            continue
        quoted = re.search(r'fileRegex: "([^"]+)"', line)
        if current is not None and quoted:
            modes[current] = quoted.group(1).encode("utf-8").decode("unicode_escape")
    return modes


def _allowed(pattern: str, path: str) -> bool:
    return re.search(pattern, path) is not None


def test_custom_modes_yaml_has_five_quoted_file_regexes() -> None:
    modes = _mode_file_regexes(YAML.read_text(encoding="utf-8"))
    assert tuple(modes) == REQUIRED_SLUGS
    for slug in REQUIRED_SLUGS:
        assert modes[slug].startswith("^"), slug


def test_frontend_refuses_architecture_svg() -> None:
    modes = _mode_file_regexes(YAML.read_text(encoding="utf-8"))
    assert _allowed(modes["frontend"], "docs/architecture.svg") is False
    assert _allowed(modes["evidence-writer"], "docs/architecture.svg") is True


def test_lane_table() -> None:
    modes = _mode_file_regexes(YAML.read_text(encoding="utf-8"))
    failures: list[str] = []
    for slug, path, expect in LANE_CASES:
        got = _allowed(modes[slug], path)
        if got is not expect:
            failures.append(f"{slug} {path}: got {got} expect {expect}")
    assert failures == []


def test_lane_enforcement_doc_is_honesty_log_not_chat() -> None:
    text = LANE_DOC.read_text(encoding="utf-8")
    lower = text.lower()
    assert LANE_DOC.is_file()
    assert "not a pasted bob chat" in lower or "not a pasted Bob chat" in text
    assert "docs/architecture.svg" in text
    assert "evidence-writer" in text
    assert "test_bob_lane_enforcement.py" in text
    assert "fileRegex" in text
    # Refuse a later swap for invented dialogue.
    assert "Bob said:" not in text
    assert "I cannot write" not in text


def test_plan_mode_doc_refuses_to_invent_a_session() -> None:
    text = PLAN_DOC.read_text(encoding="utf-8")
    assert PLAN_DOC.is_file()
    assert "not a Plan-mode transcript" in text
    assert "Never captured" in text or "never captured" in text
    assert "engine/critical-path.ts" in text
    assert ".bob/rules-plan/AGENTS.md" in text
    assert "Bob said:" not in text
