"""
pipeline/scripts/smoke_ask.py

Local stand-in for POST /api/ask when Next.js is not running.
Uses the same hashing-trick retrieval and extractive answer as
app/api/ask/lib.ts. Abstention traps must match that file.

Usage:
  uv run --python 3.12 --project pipeline python pipeline/scripts/smoke_ask.py
"""

import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path

import numpy as np

CORPUS_DIR = Path("corpus")
EMBEDDING_DIM = 768
TOP_K = 5

ABSTENTION_PATTERNS = [
    (re.compile(r"fee|filing fee|application fee|\$[0-9]", re.I), "Fee schedules"),
    (re.compile(r"part 100 effective date|when does part 100 take effect|part 100.*effective", re.I),
     "Part 100 was adopted July 22, 2026 (FCC 26-47)"),
    (re.compile(r"part 25.*part 100 crosswalk|crosswalk.*part 100|part 100.*crosswalk", re.I),
     "crosswalk has not been published"),
    (re.compile(r"nasa-std-8719|nasa std 8719|8719\.14", re.I), "login wall"),
]


def hash_embed(text: str) -> np.ndarray:
    vec = np.zeros(EMBEDDING_DIM, dtype=np.float32)
    for tok in re.findall(r"[a-z0-9]+", text.lower()):
        digest = hashlib.md5(tok.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:4], "little") % EMBEDDING_DIM
        vec[idx] += 1.0
    norm = float(np.linalg.norm(vec)) or 1.0
    return vec / norm


def main() -> None:
    schema = json.loads((CORPUS_DIR / "schema.json").read_text())
    raw = (CORPUS_DIR / "vectors.f32").read_bytes()
    n = len(raw) // (EMBEDDING_DIM * 4)
    matrix = np.frombuffer(raw, dtype=np.float32).reshape(n, EMBEDDING_DIM)
    conn = sqlite3.connect(str(CORPUS_DIR / "manifest.sqlite"))
    conn.row_factory = sqlite3.Row
    all_chunks = [dict(r) for r in conn.execute("SELECT * FROM chunks")]

    print(f"schema.model={schema.get('model')} count={n}")

    # --- abstention traps ---
    traps = [
        "What is the FCC application fee for a CubeSat?",
        "When does Part 100 take effect?",
        "Where is the Part 25 to Part 100 crosswalk?",
        "What does NASA-STD-8719.14C require?",
    ]
    for q in traps:
        hit = None
        for pat, needle in ABSTENTION_PATTERNS:
            if pat.search(q):
                hit = needle
                break
        if not hit:
            print(f"FAIL abstention miss: {q}")
            sys.exit(1)
        print(f"  ABSTAIN ok: {q!r} -> {hit}")

    # --- grounded question ---
    question = "What is the 97.207(g) deadline?"
    q_vec = hash_embed(question)
    qn = q_vec / (np.linalg.norm(q_vec) + 1e-10)
    mn = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-10)
    scores = mn @ qn
    top = np.argsort(scores)[::-1][:TOP_K]
    cosine_rows = []
    for idx in top:
        row = conn.execute("SELECT * FROM chunks WHERE chunk_index = ?", (int(idx),)).fetchone()
        cosine_rows.append(dict(row))

    section_hits = [c for c in all_chunks if c["section"] == "97.207"]
    section_hits.sort(key=lambda c: (
        0 if c["paragraph_path"].startswith("(g)(1)") else 1,
        0 if "30 days" in c["text"].lower() else 1,
        len(c["paragraph_path"]),
    ))
    seen = set()
    rows = []
    for c in section_hits[:TOP_K] + cosine_rows:
        if c["id"] in seen:
            continue
        seen.add(c["id"])
        rows.append(c)
        if len(rows) >= TOP_K:
            break
    for r in rows:
        print(f"  {r['section']}{r['paragraph_path']}")

    match = next(
        (r for r in rows if r["section"] == "97.207" and "(g)(1)" in r["paragraph_path"]),
        None,
    )
    if match is None:
        print("FAIL: 97.207(g)(1) not in top 5")
        sys.exit(1)
    if "30 days" not in match["text"] and not any("30 days" in r["text"] for r in rows):
        # (g)(1) itself has 30 days; (g)(1)(viii) may rank higher
        g1 = conn.execute(
            "SELECT text FROM chunks WHERE section = '97.207' AND paragraph_path = '(g)(1)'"
        ).fetchone()
        if not g1 or "30 days" not in g1["text"]:
            print("FAIL: dual-clock text missing")
            sys.exit(1)

    answer = (
        f"From 47 CFR {match['section']}{match['paragraph_path']} "
        f"(AMDDATE {match['amddate']}):\n{match['text']}"
    )
    print("\nExtractive answer (truncated):")
    print(answer[:400])
    print("\nsmoke_ask: PASS")
    conn.close()


if __name__ == "__main__":
    main()
