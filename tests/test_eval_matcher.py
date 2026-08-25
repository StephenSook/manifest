"""
tests/test_eval_matcher.py

Codex round-2 and round-3 regressions for the eval citation matcher:
malformed paths and impossible dates must never pass, under pathed AND
section-level expectations, and document citations must carry no paragraph
path.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "eval"))

from runner import citation_matches  # noqa: E402

SNAP = "2026-08-13"


def cfr(path="(g)", amddate=SNAP, section="97.207"):
    return {"cfrTitle": 47, "part": 97, "section": section,
            "paragraphPath": path, "amddate": amddate}


def expected_cfr(path="(g)"):
    return {"cfrTitle": 47, "part": 97, "section": "97.207",
            "paragraphPath": path, "amddate": "VERIFY_FROM_SNAPSHOT"}


class TestPathCanonicality:
    def test_exact_and_deeper_pass(self):
        assert citation_matches(expected_cfr("(g)"), cfr("(g)"))
        assert citation_matches(expected_cfr("(g)"), cfr("(g)(1)"))

    def test_junk_wrapped_path_fails_pathed_expectation(self):
        assert not citation_matches(expected_cfr("(g)"), cfr("junk(g)tail"))

    def test_junk_wrapped_path_fails_section_level_expectation(self):
        exp = {"cfrTitle": 47, "part": 5, "section": "5.51",
               "paragraphPath": "", "amddate": "VERIFY_FROM_SNAPSHOT"}
        got = {"cfrTitle": 47, "part": 5, "section": "5.51",
               "paragraphPath": "junk(g)tail", "amddate": SNAP}
        assert not citation_matches(exp, got)

    def test_string_prefix_sibling_fails(self):
        assert not citation_matches(expected_cfr("(g)"), cfr("(g4)"))


class TestAmddate:
    def test_impossible_calendar_date_fails(self):
        assert not citation_matches(expected_cfr("(g)"), cfr("(g)", "2026-99-99"))

    def test_non_date_fails(self):
        assert not citation_matches(expected_cfr("(g)"), cfr("(g)", "garbage"))

    def test_snapshot_date_passes(self):
        assert citation_matches(expected_cfr("(g)"), cfr("(g)", SNAP))


class TestDocumentCitations:
    DOC = "NASA CubeSat 101 (2017)"

    def test_document_citation_must_have_empty_path(self):
        exp = {"cfrTitle": 0, "part": 0, "section": self.DOC,
               "paragraphPath": "", "amddate": "VERIFY_FROM_SNAPSHOT"}
        good = {"cfrTitle": 0, "part": 0, "section": self.DOC,
                "paragraphPath": "", "amddate": "2017-10-01"}
        bad = dict(good, paragraphPath="(a)")
        assert citation_matches(exp, good)
        assert not citation_matches(exp, bad)

    def test_unconstrained_row_accepts_cfr_citation_with_path(self):
        exp = {"cfrTitle": 0, "part": 0, "section": "",
               "paragraphPath": "", "amddate": "VERIFY_FROM_SNAPSHOT"}
        assert citation_matches(exp, cfr("(g)(1)"))
