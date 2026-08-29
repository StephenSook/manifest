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
JUDGE_MD = REPO_ROOT / "JUDGE.md"
STATUS_ROUTE = REPO_ROOT / "app" / "api" / "status" / "route.ts"
DECAY_TABLE = REPO_ROOT / "data" / "decay-table.json"

COUNT_CLAIM_SURFACES = [
    "README.md", "JUDGE.md",
    # The video script was NOT scanned, and it carried "128 tests" against a
    # measured 162. A published video is immutable, so a stale number reaching
    # narration is the one drift that can never be corrected afterwards.
    "docs/video/script.md",
    "docs/submission.md",
]


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
# Claim extractors, shared by the guards below.
#
# These exist as named functions rather than inline regexes because Codex
# round 2 found the inline version had been narrowed until it matched NOTHING
# in the README, and a pattern that matches nothing passes vacuously. Tests in
# Test 7 assert these extractors fire on the EXACT sentences the docs use.
# ---------------------------------------------------------------------------

def _prose(text: str) -> str:
    """Strip link targets, code fences and inline code.

    A shields.io badge URL contains `tests-154%20passing`, where the encoded
    space makes `154%` read as a percentage. Prose is what is being audited.
    """
    t = re.sub(r'\]\([^)]*\)', '](link)', text)
    t = re.sub(r'```.*?```', '', t, flags=re.S)
    t = re.sub(r'`[^`]*`', '', t)
    return t


# A count claim: a number, then up to a few intervening words naming the
# suite, then the word test or tests. The intervening span deliberately
# excludes sentence punctuation so a count cannot bind across sentences.
_COUNT_RE = re.compile(
    r'(?<![\w.])(\d{1,4})\s+(?:\*\*\s*)?((?:[A-Za-z/-]+\s+){0,4}?)tests?\b',
    re.IGNORECASE,
)


def find_test_count_claims(text: str):
    """Return [(value, suite)] for every "<n> ... tests" claim in the text.

    suite is 'engine', 'ask', 'total', None when unstated, or 'AMBIGUOUS'.

    Binding is LOCAL. An earlier version searched a 150 character window and
    gave 'ask' precedence, so a table naming three suites on one line bound
    every count to 'ask' and a false total passed. The window is now the
    enclosing Markdown cell or sentence, and a fragment naming more than one
    suite returns AMBIGUOUS, which callers must treat as a failure rather
    than guess at.
    """
    out = []
    prose = _prose(text)
    for m in _COUNT_RE.finditer(prose):
        value = int(m.group(1))
        # Local fragment: the enclosing Markdown cell, else the sentence.
        left = max(
            prose.rfind('|', 0, m.start()),
            prose.rfind('\n', 0, m.start()),
            prose.rfind('. ', 0, m.start()),
        )
        right_candidates = [i for i in (
            prose.find('|', m.end()), prose.find('\n', m.end()),
            prose.find('. ', m.end()),
        ) if i != -1]
        right = min(right_candidates) if right_candidates else len(prose)
        frag = prose[left + 1: right].lower()

        def _names(fragment: str) -> set:
            found = set()
            if 'ask' in fragment:
                found.add('ask')
            if 'engine' in fragment or 'mobile' in fragment:
                found.add('engine')
            if 'total' in fragment or 'both suites' in fragment:
                found.add('total')
            return found

        names = _names(frag)
        if not names:
            # The count often sits in its own table cell while the suite is
            # named in the neighbouring one, so widen to the enclosing LINE.
            ls = prose.rfind('\n', 0, m.start()) + 1
            le = prose.find('\n', m.end())
            line = prose[ls: le if le != -1 else len(prose)].lower()
            names = _names(line)
        if not names:
            # Still unbound: the suite is often named by an enclosing HEADING
            # or a parent bullet, with the count on a later line. JUDGE.md has
            # exactly that shape, and leaving it unbound let a false engine
            # count pass because the value was a valid total.
            head = prose[:m.start()].split('\n')
            for prior in reversed(head[-12:]):
                stripped = prior.strip()
                if not stripped:
                    continue
                if stripped.startswith('#') or re.match(r'^[-*+]\s|^\*\*', stripped):
                    found = _names(stripped.lower())
                    if found:
                        names = found
                        break

        if len(names) > 1:
            # A fragment naming several suites cannot be bound by guessing.
            # An earlier version guessed, with 'ask' winning, and a false
            # total of 81 passed in a three-suite table.
            suite = 'AMBIGUOUS'
        elif names:
            suite = names.pop()
        else:
            suite = None
        out.append((value, suite))
    return out


# The aspirational bar is identified SYNTACTICALLY, by the words immediately
# following the number, not by a wide context window. A wide window was wrong:
# in "the eval scores 53.6 percent, not the 90 percent bar", the word measured
# appears near BOTH numbers, so a window-based rule either lets a false 90
# through or flags the legitimate bar.
_BAR_SUFFIX = re.compile(
    r'^\s*(?:percent|%)?\s*(?:submission\s+)?(?:bar|target|threshold)\b',
    re.IGNORECASE,
)


_ONES = {'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
         'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
         'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
         'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
         'nineteen': 19}
_TENS = {'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60,
         'seventy': 70, 'eighty': 80, 'ninety': 90}

_WORD_NUM = re.compile(
    r'\b(?:(?P<hundred>(?:one|a)\s+hundred(?:\s+and\s+(?P<h_rest>[a-z-]+(?:[\s-]+[a-z]+)?))?)'
    r'|(?P<tens>' + '|'.join(_TENS) + r')(?:[\s-]+(?P<tens_ones>' + '|'.join(_ONES) + r'))?'
    r'|(?P<ones>' + '|'.join(sorted(_ONES, key=len, reverse=True)) + r'))'
    r'(?:\s+point\s+(?P<dec>(?:' + '|'.join(sorted(_ONES, key=len, reverse=True)) + r')(?:\s+\w+)*?))?'
    r'(?=\s*(?:percent|%))',
    re.IGNORECASE,
)


def _normalise_number_words(text: str) -> str:
    """Rewrite spelled-out percentages into digits before extraction.

    D15 exists because a spelled-out wrong number slipped past a digits-only
    guard once. The first version of this normaliser handled only standalone
    tens and 100, so "ninety-five percent", "five percent" and
    "fifty-three point six percent" were all still invisible: the same class
    of hole, one layer in.
    """
    def repl(m: 're.Match') -> str:
        if m.group('hundred'):
            whole = 100
            # "one hundred and five percent" previously parsed as 5: the
            # parser matched the tail and dropped the hundred. It failed
            # safe, because 5 mismatches the measured score and the guard
            # still fired, but it named the wrong number in the message.
            rest = m.group('h_rest')
            if rest:
                token = rest.strip().lower().replace('-', ' ')
                parts = token.split()
                if parts and parts[0] in _TENS:
                    whole += _TENS[parts[0]]
                    if len(parts) > 1 and parts[1] in _ONES:
                        whole += _ONES[parts[1]]
                elif parts and parts[0] in _ONES:
                    whole += _ONES[parts[0]]
        elif m.group('tens'):
            whole = _TENS[m.group('tens').lower()]
            if m.group('tens_ones'):
                whole += _ONES[m.group('tens_ones').lower()]
        else:
            whole = _ONES[m.group('ones').lower()]
        dec = m.group('dec')
        if dec:
            first = dec.strip().split()[0].lower()
            if first in _ONES:
                return f'{whole}.{_ONES[first]}'
        return str(whole)

    return _WORD_NUM.sub(repl, text)


def eval_score_claims(text: str):
    """Return percentages asserted as the MEASURED eval score.

    The 90 percent submission bar is legitimately quoted and is not today's
    score. Allowlisting the VALUE was wrong: it let "Current eval score is 90
    percent" pass. 90 is exempt only when the words immediately after it name
    it as a bar, target or threshold.
    """
    offenders = []
    prose = _normalise_number_words(_prose(text))
    for m in re.finditer(r'(\d{1,3}(?:\.\d+)?)\s*(?:percent|%)', prose):
        value = float(m.group(1))
        window = prose[max(0, m.start() - 90): m.end() + 90].lower()
        if not any(w in window for w in ('eval', 'score', 'trap', 'abstention')):
            continue
        if _BAR_SUFFIX.match(prose[m.end(): m.end() + 40]):
            continue
        offenders.append(value)
    return offenders


def judge_md_text() -> str:
    with open(JUDGE_MD) as f:
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


# ---------------------------------------------------------------------------
# Test 6: judge-facing test counts and eval score match FACTS.json
#
# WHY THIS EXISTS. README.md and JUDGE.md both stated "79 engine and mobile
# tests" while the suite actually ran 81 and docs/FACTS.json correctly said 81.
# Three judge-readable surfaces, two of them wrong, and nothing caught it,
# because this file has never executed in CI: no workflow ran pytest at all.
#
# A count is a claim. The moment a claim is stated to a judge it needs a guard,
# and the guard has to compare the judge-facing surface against the measured
# source of truth, not merely check that the source of truth is internally
# consistent. Comparing FACTS to the code, which is what the rest of this file
# does, could never have caught a wrong number in the README.
# ---------------------------------------------------------------------------

class TestJudgeFacingCountsMatchFacts:
    """Every test count quoted to a judge must equal the measured count."""

    def test_facts_carries_measured_counts(self):
        engine = load_facts()["engine"]
        assert isinstance(engine.get("test_count"), int), (
            "FACTS.json engine.test_count is not a measured integer. "
            "Run: python3 scripts/facts.py"
        )
        assert isinstance(engine.get("test_count_total"), int), (
            "FACTS.json engine.test_count_total is not a measured integer. "
            "Run: python3 scripts/facts.py"
        )

    @pytest.mark.parametrize("surface", COUNT_CLAIM_SURFACES)
    def test_quoted_test_counts_match_the_measured_suite(self, surface):
        """Every "<n> ... tests" claim must equal the count for ITS suite.

        Binding to the suite matters. 73 and 81 are both real measured
        numbers, so accepting any measured value regardless of context would
        let "73 engine and mobile tests" pass while being false.
        """
        engine = load_facts()["engine"]
        by_suite = {
            "engine": engine["test_count"],
            "ask": engine["ask_route_test_count"],
            "total": engine["test_count_total"],
        }
        allowed = set(by_suite.values())
        path = REPO_ROOT / surface
        if not path.exists():
            pytest.skip(f"{surface} is not present")
        text = path.read_text(encoding="utf-8")

        claims = find_test_count_claims(text)
        for value, suite in claims:
            assert suite != "AMBIGUOUS", (
                f"{surface} states '{value} tests' in a fragment that names "
                "more than one suite, so the claim cannot be bound to a "
                "measured value without guessing. Rewrite it so one count "
                "names one suite. Guessing is how a false total passed."
            )
            if suite in by_suite:
                assert value == by_suite[suite], (
                    f"{surface} claims {value} tests for the {suite} suite, "
                    f"but FACTS.json measured {by_suite[suite]}. Run: "
                    f"python3 scripts/facts.py, then update {surface}."
                )
            else:
                # An unbound claim can only legitimately be the overall total.
                # Accepting ANY measured value here was the hole: 162 is a
                # valid total, so an unbound "162 engine tests" passed.
                assert value == by_suite["total"], (
                    f"{surface} claims {value} tests without naming a suite. "
                    f"An unbound count must be the overall total "
                    f"({by_suite['total']}). Name the suite, or use the total."
                )

    def test_readme_badge_total_matches_facts(self):
        """The README tests badge must equal the measured total."""
        total = load_facts()["engine"]["test_count_total"]
        text = readme_text()
        for m in re.finditer(r'tests-(\d+)[%-]', text):
            assert int(m.group(1)) == total, (
                f"README tests badge says {m.group(1)} but FACTS.json measured "
                f"{total} in total. Run: python3 scripts/facts.py."
            )


class TestEvalScoreIsPublishedAndConsistent:
    """The eval block the judge page points at must exist and be measured."""

    def test_facts_has_an_eval_block(self):
        facts = load_facts()
        assert "eval" in facts, (
            "docs/FACTS.json has no eval block, but app/judge/page.tsx step 3 "
            "tells a judge the eval score and trap results are in this file. "
            "Run: python3 scripts/facts.py"
        )

    def test_eval_score_was_actually_measured(self):
        block = load_facts()["eval"]
        assert block.get("score_pct") is not None, (
            "FACTS.json eval.score_pct is a named absence, so the runner did "
            "not complete. Do not quote a score until it is regenerated."
        )

    def test_every_bank_row_was_scored(self):
        """A partial run published as a score is a false green."""
        block = load_facts()["eval"]
        bank = REPO_ROOT / "eval" / "bank.jsonl"
        expected = sum(1 for line in bank.read_text().splitlines() if line.strip())
        assert block["rows_scored"] == expected, (
            f"FACTS.json reports {block['rows_scored']} rows scored but the "
            f"bank holds {expected}. A partial run must never be published as "
            "a full score."
        )

    def test_all_abstention_traps_abstained(self):
        block = load_facts()["eval"]
        assert block["traps_abstained"] == block["traps_total"], (
            f"only {block['traps_abstained']} of {block['traps_total']} "
            "abstention traps abstained. Cite-or-abstain is a hard product "
            "rule, not a target."
        )

    @pytest.mark.parametrize("surface", COUNT_CLAIM_SURFACES)
    def test_quoted_eval_score_matches_facts(self, surface):
        """Any percentage asserted as the measured eval score must match.

        Scanned across every judge-facing surface, not just the two markdown
        files in the root: the submission copy and the video script quote
        numbers too, and the video's are the ones that become permanent.
        """
        facts = load_facts()
        allowed = [facts["eval"]["score_pct"]]
        live = facts.get("eval_live") or {}
        # eval_live is the OTHER named, FACTS-sourced score: the same suite
        # measured against the deployed URL (2026-08-29: the watsonx path).
        # A surface may quote either measured number; anything else is still
        # a fabrication.
        if isinstance(live.get("score_pct"), (int, float)):
            allowed.append(float(live["score_pct"]))
        path = REPO_ROOT / surface
        if not path.exists():
            pytest.skip(f"{surface} is not present")
        text = path.read_text(encoding="utf-8")
        for value in eval_score_claims(text):
            assert any(abs(value - m) < 0.05 for m in allowed), (
                f"{surface} states {value} percent as the measured eval score "
                f"where FACTS.json measured {allowed}. If this is a different "
                f"quantity it needs its own name and its own source."
            )


class TestHeadlineClaimsMatchFacts:
    """Time-varying headline claims must match the latest engine run."""

    patterns = (
        re.compile(r"\b(\d+)\s+days?\s+of\s+already-violated\b", re.IGNORECASE),
        re.compile(r"\bheadline\s+(\d+)\b", re.IGNORECASE),
    )

    @classmethod
    def claims(cls, text: str) -> list[int]:
        return [
            int(match.group(1))
            for pattern in cls.patterns
            for match in pattern.finditer(text)
        ]

    def test_real_submission_phrasings_are_detected(self):
        assert self.claims("162 days of already-violated regulatory deadline") == [162]
        assert self.claims("headline 162, 116+81 tests") == [162]

    def test_judge_facing_headline_claims_match_facts(self):
        measured = load_facts()["headline"]["deadline_violations_days"]
        found: list[tuple[str, int]] = []
        for surface in COUNT_CLAIM_SURFACES:
            text = (REPO_ROOT / surface).read_text(encoding="utf-8")
            found.extend((surface, value) for value in self.claims(text))

        assert found, (
            "No time-varying headline claim was detected on any judge-facing "
            "surface. Update the guard when the published phrasing changes."
        )
        for surface, value in found:
            assert value == measured, (
                f"{surface} states a {value}-day headline where FACTS.json "
                f"measured {measured}. Run scripts/facts.py, then update every "
                "published headline claim before recording or submission."
            )



# ---------------------------------------------------------------------------
# Test 7: the guard must catch the phrasings actually used, not phrasings
# that happen to suit the regex.
#
# Codex round 2 found that the "widened" pattern in Test 6 matched NOTHING in
# README.md, because it required the number to sit immediately before the word
# tests while every real claim reads "81 engine and mobile tests". The guard
# had been passing vacuously: a pattern that matches nothing always passes.
# That is the same false-green class this file exists to catch, introduced
# while hardening this file.
#
# These fixtures are the EXACT sentences from the shipped docs. If a future
# edit narrows the pattern again, these fail.
# ---------------------------------------------------------------------------

REAL_CLAIM_PHRASINGS = [
    ("| **{n} engine and mobile tests passing** | `npm install`", "engine"),
    ("| **Technical Execution** | {n} engine and mobile tests passing (`npm run test:engine`).", "engine"),
    ("The engine and mobile suite passes {n} tests", "engine"),
    ("Expected: **{n} tests passing**, 0 failures.", "engine"),
    ("the ask-route suite runs {n} tests", "ask"),
    ("{n} tests in total across both suites", "total"),
]


class TestGuardActuallyMatchesRealPhrasings:
    """A guard that matches nothing passes everything. Prove it matches."""

    def test_the_pattern_finds_the_readme_real_claims(self):
        """The shipped README must produce at least one count match."""
        found = find_test_count_claims(readme_text())
        assert found, (
            "The test-count pattern found NO claims in README.md, but the "
            "README does state test counts. A pattern that matches nothing "
            "passes vacuously, which is exactly the failure this file guards "
            "against."
        )

    def test_the_pattern_finds_the_judge_md_real_claims(self):
        found = find_test_count_claims(judge_md_text())
        assert found, "The test-count pattern found NO claims in JUDGE.md."

    @pytest.mark.parametrize("template,suite", REAL_CLAIM_PHRASINGS)
    def test_a_wrong_number_in_each_real_phrasing_is_caught(self, template, suite):
        """Every phrasing actually used in the docs must be detectable."""
        sentence = template.format(n=999)
        found = find_test_count_claims(sentence)
        assert 999 in [v for v, _ in found], (
            f"A wrong count in this real phrasing slips past the guard: "
            f"{sentence!r}"
        )

    def test_a_count_bound_to_the_wrong_suite_is_caught(self):
        """A real measured value attached to the WRONG suite must still fail.

        Accepting any measured value regardless of context would let a claim
        like "162 engine and mobile tests" pass, because 162 is a genuine
        measured number: it is the total across both suites, not the engine
        count.

        The value is chosen dynamically because a hardcoded one went vacuous
        the moment two suites happened to measure the same number. A fixture
        that no longer exercises its case is a test that passes for free.
        """
        engine = load_facts()["engine"]
        candidates = [
            engine["test_count_total"],
            engine["ask_route_test_count"],
        ]
        wrong = next((c for c in candidates if c != engine["test_count"]), None)
        assert wrong is not None, (
            "no measured value differs from the engine count, so this case "
            "cannot be exercised right now. Do not delete this test: it will "
            "become meaningful again as soon as the suites diverge."
        )

        found = find_test_count_claims(f"{wrong} engine and mobile tests passing")
        assert found, "the claim was not detected at all"
        value, suite = found[0]
        assert suite == "engine", "context should resolve to the engine suite"
        assert value != engine["test_count"], (
            "fixture is not exercising the mismatch it was written for"
        )


class TestSubmissionBarCannotLaunderAFalseScore:
    """90 is allowlisted as the aspirational bar, not as a measured result."""

    def test_ninety_stated_as_a_measured_score_is_caught(self):
        text = "Current eval score is 90 percent on the fixtures."
        offenders = eval_score_claims(text)
        assert 90.0 in offenders, (
            "'Current eval score is 90 percent' passed the guard. The 90 "
            "allowlist is for the aspirational submission bar, and it must "
            "not launder a false claim about the measured score."
        )

    def test_ninety_stated_as_the_bar_is_allowed(self):
        text = "The 90 percent submission bar applies to the full watsonx pipeline."
        offenders = eval_score_claims(text)
        assert 90.0 not in offenders, (
            "The legitimate aspirational bar was flagged as a false score."
        )

    def test_the_shipped_docs_are_clean_under_this_rule(self):
        facts = load_facts()
        allowed = [facts["eval"]["score_pct"]]
        live = facts.get("eval_live") or {}
        if isinstance(live.get("score_pct"), (int, float)):
            allowed.append(float(live["score_pct"]))
        for surface, text in (("README.md", readme_text()), ("JUDGE.md", judge_md_text())):
            for v in eval_score_claims(text):
                assert any(abs(v - m) < 0.05 for m in allowed), (
                    f"{surface} states {v} percent as a measured eval score; "
                    f"FACTS.json measured {allowed}."
                )


# ---------------------------------------------------------------------------
# Test 8: the Surya application claim must not come back.
#
# The claim that Surya "narrows" the NOAA envelope was cut once and survived
# in four other places, including data/surya-outlook.json, whose `notes` field
# app/api/solar serializes verbatim into every response. The live API was
# returning the false claim inside surya_outlook.notes while its own
# `disclosure` field denied it, in the same payload.
#
# No code applies the activity index to the envelope or to the verdict. Until
# some code does, no surface may say otherwise. A negation is allowed, because
# stating plainly that it is NOT applied is the honest form.
# ---------------------------------------------------------------------------

SURYA_CLAIM_SURFACES = [
    "README.md", "JUDGE.md",
    "docs/FACTS.json", "docs/submission.md", "docs/claims-audit.md",
    "data/surya-outlook.json",
    ".bob/rules-ask/AGENTS.md", ".bob/rules-agent/AGENTS.md",
    ".bob/rules-plan/AGENTS.md", ".bob/custom_modes.yaml",
    "app/api/solar/lib.ts", "app/api/solar/route.ts",
    "pipeline/surya_infer.py",
    # Round 3: the video script was missing from this list and carried a
    # claim that Surya helps compute the verdict.
    "docs/video/script.md",
]

_APPLY_VERBS = ("narrow", "adjusts the envelope", "applied to the envelope",
                "tightens the envelope", "modifies the envelope",
                # Round 3 probes: these survived the first version.
                # Precise phrases only. A bare "feed" matched "F10.7 flux
                # feed", which is the NAME of a NOAA data source, not a claim.
                "feed an", "feed the", "feeds an", "feeds the", "feed into",
                "feeds into", "compute the verdict", "computes the verdict",
                "compute a deorbit compliance verdict",
                "compute a verdict", "computes a verdict",
                "decides whether", "drives the verdict", "is a regulatory input")
_NEGATION_CUES = ("not applied", "no code applies", "does not", "is not",
                  "never", "not adjust", "rather than", "reported for context",
                  "reported alongside", "reported beside")


class TestSuryaIsNotClaimedToBeApplied:
    """Grep every judge-readable surface for a reinstated application claim."""

    @pytest.mark.parametrize("relpath", SURYA_CLAIM_SURFACES)
    def test_no_unnegated_surya_application_claim(self, relpath):
        path = REPO_ROOT / relpath
        if not path.exists():
            pytest.skip(f"{relpath} is not present in this tree")
        text = path.read_text(encoding="utf-8", errors="ignore")
        # Normalise whitespace first: a claim split across a line break
        # escaped the earlier sentence splitter.
        flat = re.sub(r'\s+', ' ', text)
        for sentence in re.split(r'(?<=[.!?])\s+', flat):
            low = sentence.lower()
            # Only sentences that NAME the model can be making a claim about
            # it. Without this the guard fired on "the solar cycle decides",
            # which is true and is not a Surya claim at all.
            if not any(k in low for k in ('surya', 'heliophysics')):
                continue
            # Word-boundary matching. Plain substring matching fired on
            # "flux feed and NOAA's", because "feed an" is a substring of
            # "feed and". A guard with a false positive gets weakened by
            # whoever hits it next, so precision here protects the guard.
            if not any(re.search(rf'\b{re.escape(v)}\b', low) for v in _APPLY_VERBS):
                continue
            assert any(c in low for c in _NEGATION_CUES), (
                f"{relpath} states that Surya is applied to the NOAA envelope:\n"
                f"  {sentence.strip()[:200]}\n"
                "No shipped code does this. Either wire it and prove it with a "
                "test, or state plainly that it is reported for context."
            )


# ---------------------------------------------------------------------------
# Test 9: regression fixtures for every bypass a review reproduced.
#
# Each case below was a working evasion at some point today. They live here so
# that narrowing a pattern in future fails loudly instead of silently, which
# is how the count guard once ended up matching nothing at all.
# ---------------------------------------------------------------------------

class TestReproducedBypassesStayClosed:

    def test_multi_suite_table_is_ambiguous_not_guessed(self):
        row = "| Ask-route suite | 81 tests | Engine and mobile suite | 81 tests | Total | 81 tests |"
        for _, suite in find_test_count_claims(row):
            assert suite == "AMBIGUOUS", (
                "a fragment naming three suites was bound by guessing; that is "
                "how a false total of 81 passed against a measured 162"
            )

    def test_count_under_a_heading_binds_to_that_heading(self):
        doc = "## Engine and mobile suite\n\nExpected: 999 tests passing.\n"
        claims = find_test_count_claims(doc)
        assert claims == [(999, "engine")], claims

    def test_count_under_a_parent_bullet_binds_to_it(self):
        doc = "- **Engine and mobile suite**\n  - runs 999 tests offline\n"
        claims = find_test_count_claims(doc)
        assert ("engine" in [s for _, s in claims]), claims

    @pytest.mark.parametrize("phrase,expected", [
        ("score of ninety-five percent", 95.0),
        ("ninety five percent eval score", 95.0),
        ("eval score of five percent", 5.0),
        ("eval score is fifty-three point six percent", 53.6),
        ("Current eval score is ninety percent.", 90.0),
    ])
    def test_spelled_out_scores_are_visible(self, phrase, expected):
        assert expected in eval_score_claims(phrase), (
            f"{phrase!r} evaded the eval-score guard. D15 exists because a "
            "spelled-out wrong number slipped past a digits-only guard once."
        )

    def test_the_legitimate_bar_is_still_exempt(self):
        assert eval_score_claims(
            "The 90 percent submission bar applies to the full watsonx pipeline."
        ) == []

    @pytest.mark.parametrize("sentence", [
        "Surya, NOAA and NRLMSISE-00 compute a deorbit compliance verdict.",
        "Surya is applied to the\nenvelope.",
        "Surya feeds the NRLMSISE-00 estimate.",
        "The Surya heliophysics model decides whether the orbit is legal.",
    ])
    def test_surya_application_claims_are_caught(self, sentence):
        flat = re.sub(r'\s+', ' ', sentence)
        low = flat.lower()
        named = any(k in low for k in ('surya', 'heliophysics'))
        verbed = any(re.search(rf'\b{re.escape(v)}\b', low) for v in _APPLY_VERBS)
        negated = any(c in low for c in _NEGATION_CUES)
        assert named and verbed and not negated, (
            f"this application claim would not be caught: {sentence!r}"
        )

    def test_an_honest_negation_is_not_flagged(self):
        sentence = "The Surya activity index is reported for context and is not applied to the envelope."
        low = sentence.lower()
        assert any(c in low for c in _NEGATION_CUES), (
            "the honest phrasing must remain sayable, or the guard will be "
            "weakened by whoever hits it next"
        )

    @pytest.mark.parametrize("phrase,expected", [
        ("eval score of one hundred and five percent", 105.0),
        ("eval score of one hundred percent", 100.0),
        ("eval score is nineteen percent", 19.0),
        ("eval score of seventy-seven percent", 77.0),
        ("eval score of thirteen percent", 13.0),
    ])
    def test_number_word_parser_returns_the_right_value(self, phrase, expected):
        """A parser that returns the WRONG number is worse than one that misses.

        "one hundred and five percent" previously parsed as 5, because the
        pattern matched the tail and dropped the hundred. It failed safe, since
        5 mismatches the measured score and the guard still fired, but it named
        the wrong figure in its own error message, which is how a person is
        sent looking in the wrong place.
        """
        assert expected in eval_score_claims(phrase), (
            f"{phrase!r} did not yield {expected}: got {eval_score_claims(phrase)}"
        )
