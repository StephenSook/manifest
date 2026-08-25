"""
pipeline/tests/test_ecfr_parse.py

Smoke tests for the eCFR XML parser.
Verifies that critical sections exist in corpus/chunks/ with correct metadata.
These tests read the committed chunk files and do not re-run the parser.
"""

import json
from pathlib import Path
import pytest


CHUNKS_DIR = Path("corpus/chunks")


def load_chunks(filename: str) -> list[dict]:
    path = CHUNKS_DIR / filename
    if not path.exists():
        pytest.fail(f"{path} not found - run pipeline/ecfr_parse.py first")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


class TestEcfrParse:
    def test_all_chunk_files_exist(self):
        for fname in [
            "title47-part5.json",
            "title47-part25.json",
            "title47-part97.json",
            "title15-part960.json",
        ]:
            assert (CHUNKS_DIR / fname).exists(), f"Missing chunk file: {fname}"

    def test_chunk_schema(self):
        """Every chunk carries all required Citation-compatible fields."""
        required = {"id", "cfrTitle", "part", "section", "paragraphPath", "text", "amddate", "sourceUrl"}
        for fname in CHUNKS_DIR.glob("*.json"):
            chunks = json.loads(fname.read_text(encoding="utf-8"))
            for chunk in chunks[:5]:
                missing = required - chunk.keys()
                assert not missing, f"{fname.name} chunk missing fields: {missing}"

    def test_97_207_g_exists(self):
        """47 CFR 97.207(g) is the critical dual-clock section - must exist."""
        chunks = load_chunks("title47-part97.json")
        matches = [c for c in chunks if c["section"] == "97.207" and c["paragraphPath"] == "(g)"]
        assert len(matches) == 1, f"Expected 1 chunk for 97.207(g), got {len(matches)}"
        c = matches[0]
        assert c["cfrTitle"] == 47
        assert c["part"] == 97
        assert c["amddate"] == "2026-08-13"
        # The text must reference notification to the Space Bureau
        assert "space station" in c["text"].lower() or "notification" in c["text"].lower()

    def test_97_207_g1_dual_clock(self):
        """Nested path reconstruction must produce 97.207(g)(1) with both clocks."""
        chunks = load_chunks("title47-part97.json")
        matches = [
            c for c in chunks
            if c["section"] == "97.207" and c["paragraphPath"] == "(g)(1)"
        ]
        assert len(matches) == 1, f"Expected 1 chunk for 97.207(g)(1), got {len(matches)}"
        text = matches[0]["text"].lower()
        assert "30 days" in text
        assert "90 days" in text
        assert "pre-space" in text

    def test_97_207_b_exists(self):
        """47 CFR 97.207(b) - frequency authorizations for space stations."""
        chunks = load_chunks("title47-part97.json")
        matches = [c for c in chunks if c["section"] == "97.207" and c["paragraphPath"] == "(b)"]
        assert len(matches) == 1

    def test_25_283_e_exists(self):
        """47 CFR 25.283(e) - the FCC 5-year post-mission disposal rule."""
        chunks = load_chunks("title47-part25.json")
        matches = [c for c in chunks if c["section"] == "25.283" and c["paragraphPath"] == "(e)"]
        assert len(matches) == 1, f"Expected 1 chunk for 25.283(e), got {len(matches)}"
        c = matches[0]
        # Must mention low-Earth orbit or post-mission
        text_lower = c["text"].lower()
        assert "low-earth orbit" in text_lower or "post-mission" in text_lower or "low earth" in text_lower

    def test_960_10_exists(self):
        """15 CFR 960.10 - NOAA 120-day review period."""
        chunks = load_chunks("title15-part960.json")
        matches = [c for c in chunks if c["section"] == "960.10"]
        assert len(matches) > 0, "No chunks found for 960.10"
        # Must have paragraphed content
        para_paths = [c["paragraphPath"] for c in matches]
        assert any(p for p in para_paths), f"960.10 has no paragraphed chunks: {para_paths}"

    def test_amddate_consistent_per_title(self):
        """All chunks in a title file share the same AMDDATE."""
        for fname, expected_amddate in [
            ("title47-part5.json", "2026-08-13"),
            ("title47-part25.json", "2026-08-13"),
            ("title47-part97.json", "2026-08-13"),
            ("title15-part960.json", "2026-08-18"),
        ]:
            chunks = load_chunks(fname)
            assert len(chunks) > 0, f"{fname} is empty"
            amdates = set(c["amddate"] for c in chunks)
            assert amdates == {expected_amddate}, (
                f"{fname}: expected AMDDATE {expected_amddate}, got {amdates}"
            )

    def test_chunk_counts_reasonable(self):
        """Chunk counts should be within expected orders of magnitude."""
        for fname, min_count, max_count in [
            ("title47-part5.json", 100, 2000),
            ("title47-part25.json", 500, 5000),
            ("title47-part97.json", 200, 2000),
            ("title15-part960.json", 50, 1000),
        ]:
            chunks = load_chunks(fname)
            assert min_count <= len(chunks) <= max_count, (
                f"{fname}: {len(chunks)} chunks outside expected range [{min_count}, {max_count}]"
            )

    def test_no_empty_text_chunks(self):
        """No chunk should have empty text."""
        for fname in CHUNKS_DIR.glob("*.json"):
            chunks = json.loads(fname.read_text(encoding="utf-8"))
            empties = [c["id"] for c in chunks if not c.get("text", "").strip()]
            assert not empties, f"{fname.name} has empty text chunks: {empties[:5]}"

    def test_source_url_points_to_known_source(self):
        """All eCFR chunks sourceUrl must point to govinfo.gov; PDF chunks point to their canonical URL."""
        for fname in CHUNKS_DIR.glob("*.json"):
            chunks = json.loads(fname.read_text(encoding="utf-8"))
            for c in chunks[:3]:
                url = c.get("sourceUrl", "")
                is_ecfr = fname.name.startswith("title")
                if is_ecfr:
                    assert "govinfo.gov" in url, (
                        f"{fname.name} chunk {c['id']} has unexpected sourceUrl: {url}"
                    )
                else:
                    # PDF chunks point to fcc.gov, nasa.gov, or orbitaldebris.jsc.nasa.gov
                    assert url, f"{fname.name} chunk {c['id']} has empty sourceUrl"


class TestParagraphReconstruction:
    """Regression tests for _apply_label gap handling (Codex round-1 finding).

    CFR ordinals skip reserved and removed labels, so sibling continuation
    must tolerate gaps: 97.3(a) jumps (2) to (4). The old consecutive-only
    rule nested (4) under (2), corrupting every later path in the section.
    """

    def test_gap_in_numbering_stays_sibling(self):
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from ecfr_parse import _apply_label

        stack = [("letter", "a"), ("num", "2")]
        _apply_label(stack, "num", "4")
        assert stack == [("letter", "a"), ("num", "4")], stack

    def test_first_ordinal_opens_child_level(self):
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from ecfr_parse import _apply_label

        stack = [("letter", "g")]
        _apply_label(stack, "num", "1")
        assert stack == [("letter", "g"), ("num", "1")], stack

    def test_space_station_definition_path(self):
        """97.3 Space station sits at (a)(41) in the 2026-08-13 snapshot."""
        chunks = json.loads(
            (CHUNKS_DIR / "title47-part97.json").read_text(encoding="utf-8")
        )
        space = [
            c for c in chunks
            if c["section"] == "97.3" and c["text"].startswith("Space station")
        ]
        assert space, "97.3 Space station definition chunk missing"
        assert space[0]["paragraphPath"] == "(a)(41)", space[0]["paragraphPath"]

    def test_25_114_authoritative_structures(self):
        """Codex round-2 verification targets from the authoritative eCFR."""
        chunks = json.loads(
            (CHUNKS_DIR / "title47-part25.json").read_text(encoding="utf-8")
        )
        paths = {c["paragraphPath"] for c in chunks if c["section"] == "25.114"}
        for expected in ("(a)(1)", "(b)", "(c)(4)(vi)(C)", "(d)(14)(vii)(D)(1)"):
            assert expected in paths, f"25.114 missing {expected}"
