"""The generated Bob attribution table must be current and must stay honest.

Steal from a rival (COBOL-Explorer, graded 2026-08-30) sharpened by its own
failure. They shipped a script that generates a Bob-usage table from git
trailers, with the best articulation of the evidence principle at this event:
a jury can verify a dated, counted claim and cannot verify "Bob helped a lot".
Then 0 of their 116 commits carried the trailer, so running their own script
prints "No commit carries the trailer" while their README claims Bob authorship.

The generator is only worth anything if it RUNS and if the document it writes
is enforced. Two properties are asserted here, because either alone is weak:

  1. the document is regenerable and current (a stale table is a wrong claim), and
  2. the document still contains its own limitations section.

Property 2 matters because the cheapest way to make this table look better is
to delete the half that says what it does not prove.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SCRIPT = REPO / "scripts" / "bob-attribution.sh"
DOC = REPO / "docs" / "bob-evidence" / "ATTRIBUTION.md"


def test_generator_exists_and_is_executable() -> None:
    """Fail on the fetch before asserting anything about the output."""
    assert SCRIPT.exists(), f"missing {SCRIPT}"
    assert SCRIPT.stat().st_mode & 0o111, "bob-attribution.sh is not executable"
    assert DOC.exists(), f"missing {DOC}; run scripts/bob-attribution.sh"


def test_attribution_document_is_current() -> None:
    """The script's own --check. A stale table is a claim that has drifted."""
    r = subprocess.run(
        [str(SCRIPT), "--check"], cwd=REPO, capture_output=True, text=True
    )
    assert r.returncode == 0, (
        "docs/bob-evidence/ATTRIBUTION.md is stale. "
        "Run scripts/bob-attribution.sh and commit the result.\n"
        f"{r.stdout}\n{r.stderr}"
    )


def test_limitations_section_survives() -> None:
    """The honest half must not be quietly deleted to make the table look better."""
    text = DOC.read_text()
    assert "What this evidence does NOT establish" in text, (
        "the limitations section is gone. This document is only evidence "
        "because it reports what it cannot prove."
    )
    # The specific admission that distinguishes this from the rival's version.
    assert "trailer" in text.lower(), (
        "the missing-authorship-trailer admission was removed"
    )


def test_counts_are_not_hardcoded_in_the_script() -> None:
    """Every number must be computed. A literal count here is a future lie."""
    body = SCRIPT.read_text()
    for computed in ("git ls-files .bob", "git log --grep", "grep -cE"):
        assert computed in body, f"expected {computed!r} to compute a count"


def test_document_does_not_embed_a_self_invalidating_total() -> None:
    """The document must not record the repository's total commit count.

    Regression guard for a real defect this suite caught in CI on 2026-08-30.
    The first version of the generator wrote "0 of 240 commits carry a trailer".
    Committing the document increments that total, so the document invalidated
    itself on its own commit and --check failed on the very PR that added it.

    A generated artifact must not contain a value that the act of committing it
    changes. The trailer count is stable (it only moves when someone adds a
    trailer, which is the thing being measured); the denominator is not.
    """
    body = SCRIPT.read_text()
    assert "rev-list --count" not in body, (
        "the generator records a total commit count again. Committing the "
        "generated document changes that number, so --check will fail on the "
        "next commit forever."
    )
