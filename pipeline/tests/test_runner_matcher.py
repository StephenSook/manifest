"""Codex round-4 regression tests for eval/runner.py citation_matches.

A document expectation (cfrTitle 0) must reject structurally impossible
citation metadata: a CFR-titled citation whose section string happens to
match a document name must never satisfy a document target.

Runs under pytest with the pipeline suite AND standalone via
`python3 pipeline/tests/test_runner_matcher.py` (stdlib only), which is how
eval-gate.yml executes it in CI: the runner is stdlib-only, so is this.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "eval"))

from runner import citation_matches  # noqa: E402


DOC_EXPECTED = {
    "cfrTitle": 0,
    "part": 0,
    "section": "NASA CubeSat 101 (2017)",
    "paragraphPath": "",
}


class DocumentTargetMetadata(unittest.TestCase):
    def test_rejects_cfr_titled_citation_with_matching_section_string(self):
        got = {
            "cfrTitle": 47,
            "part": 97,
            "section": "NASA CubeSat 101 (2017)",
            "paragraphPath": "",
            "amddate": "2017-10-01",
        }
        self.assertFalse(citation_matches(DOC_EXPECTED, got))

    def test_rejects_nonzero_part_alone(self):
        got = {
            "cfrTitle": 0,
            "part": 97,
            "section": "NASA CubeSat 101 (2017)",
            "paragraphPath": "",
            "amddate": "2017-10-01",
        }
        self.assertFalse(citation_matches(DOC_EXPECTED, got))

    def test_accepts_true_document_citation(self):
        got = {
            "cfrTitle": 0,
            "part": 0,
            "section": "NASA CubeSat 101 (2017)",
            "paragraphPath": "",
            "amddate": "2017-10-01",
        }
        self.assertTrue(citation_matches(DOC_EXPECTED, got))

    def test_section_any_of_target_also_rejects_cfr_metadata(self):
        expected = {
            "section_any_of": ["NASA CubeSat 101 (2017)", "DAS 3.2 User Guide"],
            "paragraphPath": "",
        }
        got = {
            "cfrTitle": 47,
            "part": 25,
            "section": "DAS 3.2 User Guide",
            "paragraphPath": "",
            "amddate": "2020-01-01",
        }
        self.assertFalse(citation_matches(expected, got))


if __name__ == "__main__":
    unittest.main()
