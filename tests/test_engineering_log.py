"""
tests/test_engineering_log.py

Guard: docs/ENGINEERING-LOG.md exists, is linked from the README, and every
commit SHA it cites still resolves in this repository.

Why the SHA check matters. The log's whole value is that a reader can open
each defect and see it. A citation that 404s is worse than no citation,
because it invites the reader to check and then fails them. This repository
has already had 24 commit citations orphaned once by a history rewrite
(see the commit that repaired them), so dead references are a demonstrated
failure mode here, not a hypothetical one.

The log is also required to keep its self-critical section. A log that
records only what other people got wrong is a build log wearing a different
hat, and the reason this file was written was that the reverse is what
carries credibility.

No em-dashes. No fabricated figures.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LOG = REPO / "docs" / "ENGINEERING-LOG.md"
README = REPO / "README.md"


def _log_text() -> str:
    assert LOG.exists(), "docs/ENGINEERING-LOG.md is missing"
    return LOG.read_text(encoding="utf-8")


def test_log_exists_and_is_linked_from_the_readme() -> None:
    text = README.read_text(encoding="utf-8")
    assert "docs/ENGINEERING-LOG.md" in text, (
        "the engineering log must be reachable from the README, or a reader "
        "never finds it and it scores nothing"
    )
    assert LOG.exists()


def test_history_is_deep_enough_to_check_citations() -> None:
    """
    Fail loudly when the checkout cannot answer the question, rather than
    letting the citation test report every real SHA as dead.

    This fired for real on 2026-08-29. The job that runs pytest used a bare
    actions/checkout, which is shallow (one commit), so `git cat-file` could
    not see any cited commit and the guard reported all ten as unresolvable.
    A true failure for a false reason is its own kind of lie, and skipping
    instead would have been worse: a guard that cannot run must fail, not
    pass quietly.
    """
    shallow = (REPO / ".git" / "shallow").exists()
    assert not shallow, (
        "this clone is shallow, so commit citations cannot be verified. "
        "The CI job needs `fetch-depth: 0` on actions/checkout "
        "(.github/workflows/eval-gate.yml, the fabricated-numbers job). "
        "This guard fails rather than skips, because a check that cannot "
        "run is not a check that passed."
    )


def test_every_cited_commit_sha_still_resolves() -> None:
    """A citation a reader cannot open is worse than no citation."""
    text = _log_text()
    # Backticked 7-to-40 hex strings are the citation form used in the log.
    shas = {
        s
        for s in re.findall(r"`([0-9a-f]{7,40})`", text)
        # Exclude hex-looking things that are plainly not SHAs.
        if not s.isdigit()
    }
    assert shas, "the log cites no commits, which defeats its purpose"
    dead = []
    for sha in sorted(shas):
        proc = subprocess.run(
            ["git", "cat-file", "-e", f"{sha}^{{commit}}"],
            cwd=REPO,
            capture_output=True,
        )
        if proc.returncode != 0:
            dead.append(sha)
    assert not dead, (
        f"engineering log cites commits that do not resolve: {dead}. "
        "If history was rewritten, re-point the citations at the new SHAs."
    )


def test_log_keeps_its_self_critical_section() -> None:
    text = _log_text()
    assert "What the tooling got wrong" in text, (
        "the section recording defects the AI-assisted work introduced must "
        "stay; it is the part that carries credibility"
    )
    # And it must come before the section crediting the tooling, so a reader
    # meets the failures first rather than after a page of wins.
    got_wrong = text.index("What the tooling got wrong")
    caught = text.index("What IBM Bob caught")
    assert got_wrong < caught, "lead with the failures, not with the wins"


def test_log_does_not_credit_bob_for_work_bob_did_not_do() -> None:
    """
    The only Bob-caught defect this repo can evidence is the lane refusal.
    If a future edit starts attributing the 2026-08-29 defects to Bob, that
    is the exact fabrication this project grades other submissions down for.
    """
    text = _log_text()
    assert "This is the only Bob-caught defect we can evidence" in text
    assert "not by IBM Bob" in text or "rather than credited to tooling" in text
