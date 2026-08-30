"""The recorded live-eval runtime must attribute the embedder to the corpus.

Guards the defect class that shipped on 2026-08-29 and survived four regens:
docs/FACTS.json recorded `eval_live.runtime.embedding_backend = watsonx` with a
note asserting the Granite embedding model ran, while the committed corpus
freeze forces app/api/ask/route.ts down the hashing-trick branch, so that call
is unreachable by construction.

Two properties matter and both are asserted here, because either alone passes
on an empty or malformed block:

  1. the recorded value equals what the corpus actually forces, and
  2. the note does not claim embedding ran on watsonx.

facts.py carries eval_live forward on every regen when no fresh --live-report is
passed, so without this guard a stale attribution can never self-correct.
"""

from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
FACTS = REPO_ROOT / "docs" / "FACTS.json"
SCHEMA = REPO_ROOT / "corpus" / "schema.json"


def corpus_forced_backend() -> str:
    """Mirrors readEmbeddingBackend() in app/api/status/route.ts."""
    model = json.loads(SCHEMA.read_text())["model"]
    assert model, "corpus/schema.json has no model"
    if model.startswith("hashing-trick") or model == "mock":
        return model
    return "watsonx"


def test_corpus_schema_is_readable() -> None:
    """Fail on the FETCH, before asserting anything about its contents.

    An unreadable schema and a schema that happens to agree both produce a
    passing comparison otherwise.
    """
    assert SCHEMA.exists(), f"corpus/schema.json missing at {SCHEMA}"
    assert corpus_forced_backend(), "could not derive a backend from the corpus"


def test_eval_live_embedding_matches_the_corpus() -> None:
    facts = json.loads(FACTS.read_text())
    live = facts.get("eval_live")
    if not live:
        return  # eval_live is optional; nothing to attribute
    runtime = live.get("runtime")
    assert isinstance(runtime, dict), "eval_live.runtime must be an object"
    expected = corpus_forced_backend()
    actual = runtime.get("embedding_backend")
    assert actual == expected, (
        f"eval_live.runtime.embedding_backend is {actual!r} but the committed "
        f"corpus forces {expected!r}. A judge reading FACTS.json would be told a "
        f"sponsor model ran that the code cannot reach. Re-run scripts/facts.py."
    )


def test_eval_live_note_does_not_claim_watsonx_embedding() -> None:
    """The positive assertion. Checking only that the bad string is gone passes
    on an absent note, so require the honest statement to be present."""
    facts = json.loads(FACTS.read_text())
    live = facts.get("eval_live")
    if not live:
        return
    runtime = live.get("runtime") or {}
    if corpus_forced_backend() == "watsonx":
        return  # a real watsonx corpus may legitimately say so
    note = (runtime.get("note") or "").lower()
    assert note, "eval_live.runtime.note is empty; it must state what ran"
    assert "embedding does not" in note or "unreachable" in note, (
        "eval_live.runtime.note must say the embedding path did NOT run on "
        f"watsonx. Got: {note!r}"
    )
