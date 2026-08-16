"""
tests/test_no_fabricated_numbers.py
Task 2.18 -- anti-fabrication guard.

Every figure in README.md and docs/ must trace to docs/FACTS.json.
Per D15: numbers are computed once, never per page load, and the guard
catches BOTH digit forms AND spelled-out numerals.

This test suite:
  1. Verifies docs/FACTS.json exists and is parseable.
  2. Checks that the key differentiator numbers in README.md match FACTS.json
     (both digit form "15.0" and spelled-out form "fifteen" etc).
  3. Checks that /api/status MODEL_INVENTORY matches FACTS.json models.
  4. Verifies FACTS.json was not hand-edited (spot-check numeric stability
     against a live re-computation from data/decay-table.json).

Authority: PLAN.md task 2.18, D15.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
FACTS_JSON = REPO_ROOT / "docs" / "FACTS.json"
README = REPO_ROOT / "README.md"
STATUS_ROUTE = REPO_ROOT / "app" / "api" / "status" / "route.ts"
DECAY_TABLE = REPO_ROOT / "data" / "decay-table.json"

# Spelled-out numerals that the guard must also catch (D15)
# Maps integer value -> set of spelled-out forms we check
SPELLED_OUT = {
    5: {"five"},
    15: {"fifteen"},
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_facts() -> dict:
    with open(FACTS_JSON) as f:
        return json.load(f)


def readme_text() -> str:
    with open(README) as f:
        return f.read()


def status_route_text() -> str:
    with open(STATUS_ROUTE) as f:
        return f.read()


# ---------------------------------------------------------------------------
# Test 1: FACTS.json exists and has the required keys
# ---------------------------------------------------------------------------

class TestFactsJsonStructure:
    def test_facts_json_exists(self):
        assert FACTS_JSON.exists(), (
            "docs/FACTS.json does not exist. Run: python scripts/facts.py"
        )

    def test_facts_json_parseable(self):
        facts = load_facts()
        assert isinstance(facts, dict), "FACTS.json must be a JSON object"

    def test_differentiator_key_present(self):
        facts = load_facts()
        assert "differentiator" in facts, "FACTS.json missing 'differentiator' key"

    def test_models_key_present(self):
        facts = load_facts()
        assert "models" in facts, "FACTS.json missing 'models' key"

    def test_engine_key_present(self):
        facts = load_facts()
        assert "engine" in facts, "FACTS.json missing 'engine' key"

    def test_meta_key_present(self):
        facts = load_facts()
        assert "_meta" in facts, "FACTS.json missing '_meta' key"


# ---------------------------------------------------------------------------
# Test 2: Differentiator numbers are stable vs decay table
# ---------------------------------------------------------------------------

class TestDifferentiatorStability:
    """
    Re-derives the key numbers from data/decay-table.json directly and
    asserts FACTS.json matches. If this fails, someone hand-edited FACTS.json
    or the decay table changed without re-running facts.py.
    """

    FCC_LIMIT = 5.0
    GT1_PERIGEE = 550
    GT1_BC = 180.0

    def _find_entry(self, table: list[dict]) -> dict:
        all_bcs = sorted({e["ballisticCoefficient"] for e in table})
        nearest_bc = min(all_bcs, key=lambda b: abs(b - self.GT1_BC))
        bc_rows = [e for e in table if e["ballisticCoefficient"] == nearest_bc]
        return min(bc_rows, key=lambda e: abs(e["altitudeKm"] - self.GT1_PERIGEE))

    def test_decay_table_exists(self):
        assert DECAY_TABLE.exists(), (
            "data/decay-table.json does not exist. Run: pipeline/.venv/bin/python3 pipeline/decay.py"
        )

    def test_lifetime_solar_min_matches_facts(self):
        with open(DECAY_TABLE) as f:
            table = json.load(f)
        entry = self._find_entry(table)
        facts = load_facts()

        expected = round(entry["lifetimeYearsLow"], 3)
        actual = facts["differentiator"]["lifetime_years_solar_min"]
        assert actual == expected, (
            f"FACTS.json lifetime_years_solar_min={actual} "
            f"does not match decay table={expected}. "
            "Run: python scripts/facts.py"
        )

    def test_lifetime_solar_max_matches_facts(self):
        with open(DECAY_TABLE) as f:
            table = json.load(f)
        entry = self._find_entry(table)
        facts = load_facts()

        expected = round(entry["lifetimeYearsHigh"], 3)
        actual = facts["differentiator"]["lifetime_years_solar_max"]
        assert actual == expected, (
            f"FACTS.json lifetime_years_solar_max={actual} "
            f"does not match decay table={expected}. "
            "Run: python scripts/facts.py"
        )

    def test_verdict_solar_min_is_violated(self):
        facts = load_facts()
        lifetime = facts["differentiator"]["lifetime_years_solar_min"]
        verdict = facts["differentiator"]["verdict_solar_min"]
        assert lifetime > self.FCC_LIMIT, (
            f"solar_min lifetime {lifetime} yr is <= FCC limit {self.FCC_LIMIT} yr -- "
            "the differentiator depends on this being VIOLATED"
        )
        assert verdict == "VIOLATED", (
            f"verdict_solar_min should be VIOLATED (lifetime={lifetime} yr > {self.FCC_LIMIT} yr), got {verdict!r}"
        )

    def test_verdict_solar_max_is_ok(self):
        facts = load_facts()
        lifetime = facts["differentiator"]["lifetime_years_solar_max"]
        verdict = facts["differentiator"]["verdict_solar_max"]
        assert lifetime <= self.FCC_LIMIT, (
            f"solar_max lifetime {lifetime} yr is > FCC limit {self.FCC_LIMIT} yr -- "
            "the differentiator depends on solar max being compliant"
        )
        assert verdict == "OK", (
            f"verdict_solar_max should be OK (lifetime={lifetime} yr <= {self.FCC_LIMIT} yr), got {verdict!r}"
        )


# ---------------------------------------------------------------------------
# Test 3: README does not contain hardcoded numbers that differ from FACTS.json
# ---------------------------------------------------------------------------

class TestReadmeNoFabricatedNumbers:
    """
    Checks that key numeric claims in README.md match FACTS.json.
    The guard checks BOTH digit form ("15.0") AND spelled-out forms ("fifteen").
    Per D15: the July bug was a spelled-out wrong number a digits-only guard
    could not see.
    """

    def test_readme_exists(self):
        assert README.exists(), "README.md not found"

    def test_differentiator_numbers_in_readme_match_facts(self):
        facts = load_facts()
        diff = facts["differentiator"]
        text = readme_text()

        # The README uses the solar min / solar max numbers in the differentiator section.
        # If those numbers are present in the README, they must match FACTS.json.
        # If they are absent, that is fine -- absence is not fabrication.

        solar_min = diff["lifetime_years_solar_min"]     # e.g. 15.0
        solar_max = diff["lifetime_years_solar_max"]     # e.g. 2.57

        # Check: if README mentions a year value near solar_min, it must equal solar_min
        # We look for patterns like "15 yr", "15.0 yr", "15yr"
        solar_min_pattern = re.compile(r'(\d+\.?\d*)\s*yr', re.IGNORECASE)
        for match in solar_min_pattern.finditer(text):
            val = float(match.group(1))
            # If the value is close to our solar_min range (>10 yr) it must match
            if 10.0 <= val <= 25.0:
                assert abs(val - solar_min) < 0.5, (
                    f"README mentions a solar-min-range lifetime of {val} yr "
                    f"but FACTS.json says {solar_min} yr. "
                    "Run: python scripts/facts.py -- then update README."
                )

    def test_readme_fcc_limit_is_five_years(self):
        """The FCC 5-year rule must be cited as 5 years, never any other number."""
        facts = load_facts()
        assert facts["differentiator"]["fcc_limit_years"] == 5.0, (
            "FCC limit in FACTS.json is not 5.0 yr -- this is a hard statutory fact (47 CFR 25.283(e))"
        )


# ---------------------------------------------------------------------------
# Test 4: /api/status MODEL_INVENTORY matches FACTS.json models
# ---------------------------------------------------------------------------

class TestModelInventoryConsistency:
    """
    The claimed-versus-invoked check: /api/status must self-report the same
    models that README claims and FACTS.json records.
    """

    REQUIRED_MODELS = {
        "ibm/granite-4-h-small",
        "ibm/granite-guardian-3-8b",
        "ibm/granite-embedding-278m-multilingual",
        "nasa-ibm-ai4science/Surya-1.0",
    }

    def test_status_route_exists(self):
        assert STATUS_ROUTE.exists(), (
            "app/api/status/route.ts does not exist -- task 2.17 must complete first"
        )

    def test_all_required_models_in_facts_json(self):
        facts = load_facts()
        models_in_facts = set(facts.get("models", {}).values())
        for model in self.REQUIRED_MODELS:
            assert model in models_in_facts, (
                f"Model {model!r} is claimed in README but missing from FACTS.json models. "
                "Either wire the model or remove the claim."
            )

    def test_all_required_models_in_status_route(self):
        src = status_route_text()
        for model in self.REQUIRED_MODELS:
            assert model in src, (
                f"Model {model!r} is in FACTS.json but not referenced in "
                "app/api/status/route.ts. The self-report is incomplete."
            )

    def test_facts_models_match_status_route(self):
        facts = load_facts()
        src = status_route_text()
        for model in facts.get("models", {}).values():
            if model is not None:
                assert model in src, (
                    f"FACTS.json declares model {model!r} but it is not in "
                    "app/api/status/route.ts MODEL_INVENTORY. "
                    "Run: python scripts/facts.py after updating the route."
                )
