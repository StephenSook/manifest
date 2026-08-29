"""
tests/test_model_inventory_is_wired.py

Guard: every model id published in /api/status MODEL_INVENTORY has a call
site in shipped source. Wired or cut, hard rule 4, enforced rather than
remembered.

Why this exists. On 2026-08-29 a wired-or-cut audit against the shipped
code found `local_fallback: 'granite4.1:8b'` in the inventory with nothing
behind it. A grep for `ollama` returned prose and one inventory string: no
client, no call, no code path. That row rendered on the judge page as
"Local fallback: granite4.1:8b", telling a reader the product could fall
back to a local Granite model. It could not. The fallback that actually
ships is the offline extractive path, which uses no model at all.

The existing guard in test_no_fabricated_numbers.py asserts the inventory
matches FACTS.json. That is a consistency check between two documents, and
both documents were wrong together. This one checks the inventory against
CODE, which is the only source that cannot agree with a claim out of
politeness.

Source-text guard. A model counts as wired when its id appears in a shipped
source file that is not the inventory itself, not documentation, and not
the fact ledger, because those are the surfaces that repeat the claim
rather than implement it.

No em-dashes. No fabricated figures.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
STATUS_ROUTE = REPO / "app" / "api" / "status" / "route.ts"

# Surfaces that RESTATE a model claim rather than implement it. A model that
# appears only here is exactly the defect this file exists to catch.
RESTATERS = (
    "app/api/status/route.ts",
    "docs/",
    "README.md",
    "JUDGE.md",
    "PLAN.md",
    "TYLIN_TASKS.md",
    "AGENTS.md",
    "phase0-plan.md",
    "phase1-plan.md",
    "corpus/",
    "tests/",
    ".bob/",
)


def _tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True
    ).stdout
    return [f for f in out.split("\n") if f]


def _inventory_models() -> dict[str, str]:
    text = STATUS_ROUTE.read_text(encoding="utf-8")
    block = re.search(r"const MODEL_INVENTORY = \{(.*?)\n\} as const;", text, re.S)
    assert block, "MODEL_INVENTORY block not found in app/api/status/route.ts"
    body = block.group(1)
    # Strip comments so a cut model mentioned in a note is not read as declared.
    body = re.sub(r"//[^\n]*", "", body)
    pairs = dict(re.findall(r"(\w+):\s*'([^']+)'", body))
    assert pairs, "MODEL_INVENTORY parsed as empty"
    return pairs


def test_inventory_is_not_empty_and_parses() -> None:
    models = _inventory_models()
    assert len(models) >= 3, f"inventory looks truncated: {models}"


def test_every_published_model_has_a_call_site_in_shipped_code() -> None:
    models = _inventory_models()
    files = [
        f
        for f in _tracked_files()
        if not any(f.startswith(p) or f == p for p in RESTATERS)
        and f.endswith((".ts", ".tsx", ".py", ".mjs", ".json", ".yml", ".yaml"))
        and f != "package-lock.json"
    ]
    unwired: dict[str, str] = {}
    for key, model_id in models.items():
        hits = []
        for f in files:
            try:
                if model_id in (REPO / f).read_text(encoding="utf-8", errors="ignore"):
                    hits.append(f)
            except (OSError, UnicodeDecodeError):
                continue
        if not hits:
            unwired[key] = model_id
    assert not unwired, (
        "MODEL_INVENTORY publishes models with no call site in shipped code: "
        f"{unwired}. Wire it or cut it (hard rule 4). A model named on the "
        "judge page is a claim that the product can use it."
    )


def test_the_cut_ollama_fallback_stays_cut() -> None:
    """
    Regression lock on the specific claim that was removed. If a local model
    fallback is ever genuinely implemented, delete this test in the same
    commit that adds the client, so the two can never disagree.
    """
    models = _inventory_models()
    assert "local_fallback" not in models, (
        "local_fallback is back in the inventory. It was cut on 2026-08-29 "
        "because nothing implemented it. Only re-add it alongside a real "
        "Ollama client and a call site."
    )
    ollama_impl = [
        f
        for f in _tracked_files()
        if f.endswith((".ts", ".tsx", ".py"))
        and not any(f.startswith(p) or f == p for p in RESTATERS)
        and "ollama" in (REPO / f).read_text(encoding="utf-8", errors="ignore").lower()
    ]
    assert not ollama_impl, (
        f"an Ollama code path now exists ({ollama_impl}). That is good news: "
        "re-add the inventory row and delete this assertion together."
    )
