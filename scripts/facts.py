#!/usr/bin/env python3
# scripts/facts.py
# Task 2.18 -- generate docs/FACTS.json from a real engine run.
#
# Every figure in README.md, docs/, the video script, and the submission
# must come from this file. Hand-editing FACTS.json fails CI (D15).
#
# How it works:
#   1. Reads data/decay-table.json directly (no network, no watsonx).
#   2. Reads data/surya-outlook.json for the Surya activity index.
#   3. Re-implements the deorbit compliance logic in Python to produce the
#      same numbers the TypeScript engine produces, for cross-validation.
#   4. Runs `node scripts/run_status.mjs` to invoke the real /api/status
#      logic via Node so the numbers come from the actual engine code.
#   5. Writes docs/FACTS.json with every number sourced.
#
# Usage:
#   python scripts/facts.py           # generate docs/FACTS.json
#   python scripts/facts.py --check   # verify FACTS.json is not stale (exits 1 if stale)
#
# Authority: PLAN.md task 2.18, D15.

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DECAY_TABLE = REPO_ROOT / "data" / "decay-table.json"
SURYA_OUTLOOK = REPO_ROOT / "data" / "surya-outlook.json"
FACTS_OUT = REPO_ROOT / "docs" / "FACTS.json"

FCC_LIMIT_YEARS = 5.0

# ---------------------------------------------------------------------------
# Decay table helpers (mirrors engine/interlocks/deorbit-compliance.ts)
# ---------------------------------------------------------------------------

def load_decay_table() -> list[dict]:
    with open(DECAY_TABLE) as f:
        return json.load(f)


def find_closest_entry(table: list[dict], altitude_km: float, bc: float) -> dict | None:
    if not table:
        return None
    all_bcs = sorted({e["ballisticCoefficient"] for e in table})
    nearest_bc = min(all_bcs, key=lambda b: abs(b - bc))
    bc_rows = [e for e in table if e["ballisticCoefficient"] == nearest_bc]
    return min(bc_rows, key=lambda e: abs(e["altitudeKm"] - altitude_km))


def deorbit_verdict(lifetime_years: float) -> str:
    if lifetime_years <= FCC_LIMIT_YEARS:
        return "OK"
    if lifetime_years <= FCC_LIMIT_YEARS * 1.2:
        return "AT_RISK"
    return "VIOLATED"


# ---------------------------------------------------------------------------
# GT-1 seed mission parameters (must match app/api/status/route.ts)
# ---------------------------------------------------------------------------

GT1_PERIGEE_KM = 550
GT1_BC = 180.0


# ---------------------------------------------------------------------------
# Compute the key numbers
# ---------------------------------------------------------------------------

def run_status() -> dict | None:
    """Run the real /api/status logic via scripts/run_status.ts (task 2.18 step 4).

    Returns the parsed route response, or None if node/tsx is unavailable so the
    decay-table facts can still be generated (the headline block is then omitted
    and downstream surfaces keep their placeholders).
    """
    try:
        out = subprocess.run(
            ["npx", "tsx", "scripts/run_status.ts"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"WARNING: run_status.ts did not run ({exc}); headline omitted", file=sys.stderr)
        return None
    if out.returncode != 0:
        print(f"WARNING: run_status.ts failed:\n{out.stderr[-500:]}", file=sys.stderr)
        return None
    try:
        return json.loads(out.stdout)
    except json.JSONDecodeError:
        print("WARNING: run_status.ts emitted non-JSON; headline omitted", file=sys.stderr)
        return None


def run_test_counts() -> dict | None:
    """Count tests by RUNNING them, never by hand (task 2.18).

    A hand-maintained count is a figure that drifts silently and then reaches a
    README, a submission, or a video narration that cannot be edited afterward.
    This runs the two vitest projects with the JSON reporter and reads the real
    totals. Returns None if the suites cannot be run, so the caller records a
    NAMED absence rather than carrying a stale literal forward.
    """
    suites = {
        "engine_and_mobile": ["engine", "mobile"],
        "ask_route": ["app/api"],
    }
    counts: dict[str, int] = {}
    for label, paths in suites.items():
        out_path = REPO_ROOT / f".facts-vitest-{label}.json"
        try:
            proc = subprocess.run(
                ["npx", "vitest", "run", *paths,
                 "--reporter=json", f"--outputFile={out_path}"],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=600,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            print(f"WARNING: vitest did not run for {label} ({exc}); "
                  "test counts omitted", file=sys.stderr)
            return None
        finally:
            pass
        if proc.returncode != 0 or not out_path.exists():
            print(f"WARNING: vitest failed for {label}; test counts omitted",
                  file=sys.stderr)
            out_path.unlink(missing_ok=True)
            return None
        try:
            report = json.loads(out_path.read_text())
        except json.JSONDecodeError:
            print(f"WARNING: vitest emitted non-JSON for {label}; "
                  "test counts omitted", file=sys.stderr)
            return None
        finally:
            out_path.unlink(missing_ok=True)
        # A red suite must not be counted as a fact.
        if not report.get("success") or report.get("numFailedTests"):
            print(f"WARNING: {label} suite is not green; test counts omitted",
                  file=sys.stderr)
            return None
        counts[label] = int(report["numTotalTests"])
    counts["total"] = sum(v for k, v in counts.items() if k != "total")
    return counts


def load_eval_live(report_path: Path, url: str) -> dict | None:
    """Load a URL-mode eval report produced by eval/runner.py --mode url.

    Fixtures stay the clone-reproducible score in `eval`. The live score is a
    separate measurement of the deployed extractive path. --check does not
    re-hit the network; it leaves this block alone.
    """
    if not report_path.exists():
        print(f"WARNING: live eval report missing: {report_path}", file=sys.stderr)
        return None
    try:
        report = json.loads(report_path.read_text())
    except json.JSONDecodeError:
        print("WARNING: live eval report is not JSON; eval_live omitted",
              file=sys.stderr)
        return None
    if report.get("mode") != "url":
        print(f"WARNING: live eval report mode is {report.get('mode')!r}, "
              "not 'url'; eval_live omitted", file=sys.stderr)
        return None
    bank_rows = sum(
        1 for line in (REPO_ROOT / "eval" / "bank.jsonl").read_text().splitlines()
        if line.strip()
    )
    results = report.get("results") or []
    if len(results) != bank_rows:
        print(f"WARNING: live eval scored {len(results)} of {bank_rows} "
              "bank rows; eval_live omitted", file=sys.stderr)
        return None
    passing = [r["id"] for r in results if r.get("pass")]
    failing = [r["id"] for r in results if not r.get("pass")]
    runtime = None
    if url:
        try:
            req = urllib.request.Request(url.rstrip("/") + "/api/status")
            with urllib.request.urlopen(req, timeout=20) as resp:
                runtime = json.loads(resp.read().decode("utf-8")).get("runtime")
        except (OSError, urllib.error.URLError, json.JSONDecodeError, TimeoutError) as exc:
            print(f"WARNING: could not read /api/status runtime for eval_live "
                  f"({exc})", file=sys.stderr)
    return {
        "score_pct": report.get("score_pct"),
        "questions_correct": report.get("questions_correct"),
        "questions_total": report.get("questions"),
        "traps_total": report.get("traps"),
        "traps_abstained": report.get("traps_abstained"),
        "rows_scored": len(results),
        "mode": "url",
        "url": url,
        "passing_ids": passing,
        "failing_ids": failing,
        "runtime": runtime,
        "measured_at": report.get("generatedAt"),
    }


def run_eval() -> dict | None:
    """Measure the eval score by RUNNING the bank, never by hand.

    app/judge/page.tsx step 3 tells a judge, in the product's own UI, that
    "the eval score and trap results are there" in docs/FACTS.json. They were
    not: the file had no eval key of any kind, so a judge following the
    itinerary reached a dead end. Rather than edit the sentence, this makes
    the sentence true, which also removes the possibility of the number
    drifting from the runner that produces it.

    Fixtures mode is deliberate: no network, no key, so this is reproducible
    by anyone who clones the repo. Returns None on failure so the caller
    records a NAMED absence instead of carrying a stale figure forward.
    """
    report_path = REPO_ROOT / "eval" / "report.json"
    # MEASUREMENT, NOT GATING. The runner's default bar is the aspirational
    # 90 percent from CLAUDE.md section 5, so a healthy run at today's real
    # 53.6 percent exits 1. Reading that exit code as "the eval did not run"
    # would omit the block on every honest run. Gating is the CI ratchet's
    # job (.github/workflows/eval-gate.yml), so measure with the bar at zero
    # and publish whatever the suite actually scores.
    try:
        proc = subprocess.run(
            [sys.executable, "eval/runner.py", "--mode", "fixtures",
             "--min-score", "0"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=600,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"WARNING: eval runner did not run ({exc}); eval block omitted",
              file=sys.stderr)
        return None

    if proc.returncode != 0:
        print("WARNING: eval runner exited non-zero even with the bar at "
              "zero, so it did not complete; eval block omitted",
              file=sys.stderr)
        return None
    if not report_path.exists():
        print("WARNING: eval runner wrote no report; eval block omitted",
              file=sys.stderr)
        return None

    try:
        report = json.loads(report_path.read_text())
    except json.JSONDecodeError:
        print("WARNING: eval report is not JSON; eval block omitted",
              file=sys.stderr)
        return None

    # Every bank row must have been scored. A partial run reported as a score
    # is the same defect as a conditionally-skipped guard reported as a pass.
    bank_rows = sum(
        1 for line in (REPO_ROOT / "eval" / "bank.jsonl").read_text().splitlines()
        if line.strip()
    )
    scored = len(report.get("results", []))
    if scored != bank_rows:
        print(f"WARNING: eval scored {scored} of {bank_rows} bank rows; "
              "eval block omitted rather than published as a full run",
              file=sys.stderr)
        return None

    # Key names read off a real report, not assumed: the count is
    # `questions_correct`, while `passed` is a BOOLEAN meaning "cleared the
    # aspirational bar". Reading `passed` as a count would have published
    # False where a number belongs.
    return {
        "score_pct": report.get("score_pct"),
        "questions_correct": report.get("questions_correct"),
        "questions_total": report.get("questions"),
        "traps_total": report.get("traps"),
        "traps_abstained": report.get("traps_abstained"),
        "rows_scored": scored,
        "mode": report.get("mode"),
        "measured_at": report.get("generatedAt"),
    }


def compute_facts(live_report: Path | None = None, live_url: str | None = None) -> dict:
    table = load_decay_table()

    # 3U CubeSat at 550 km -- the headline differentiator orbit
    entry = find_closest_entry(table, GT1_PERIGEE_KM, GT1_BC)
    if entry is None:
        print("ERROR: decay table is empty -- run pipeline/decay.py first", file=sys.stderr)
        sys.exit(1)

    lifetime_nominal = entry["lifetimeYears"]
    lifetime_solar_min = entry["lifetimeYearsLow"]
    lifetime_solar_max = entry["lifetimeYearsHigh"]
    f107_assumed = entry["f107Assumed"]

    verdict_nominal = deorbit_verdict(lifetime_nominal)
    verdict_solar_min = deorbit_verdict(lifetime_solar_min)
    verdict_solar_max = deorbit_verdict(lifetime_solar_max)

    # Surya activity index
    surya_data: dict = {}
    if SURYA_OUTLOOK.exists():
        with open(SURYA_OUTLOOK) as f:
            surya_data = json.load(f)

    surya_activity_index = (
        surya_data.get("activityIndex", [None])[0]
        if surya_data.get("activityIndex")
        else None
    )

    # Model inventory (must match app/api/status/route.ts MODEL_INVENTORY)
    models = {
        "generation": "ibm/granite-4-h-small",
        "audit": "ibm/granite-guardian-3-8b",
        "embedding": "ibm/granite-embedding-278m-multilingual",
        "surya": "nasa-ibm-ai4science/Surya-1.0",
        "local_fallback": "granite4.1:8b",
    }

    # Headline from the real engine run (task 2.17 route, via scripts/run_status.ts).
    # deadline_violations_days moves as `today` advances, so --check recomputes
    # this block on every run. Published copy then compares against FACTS.json.
    status = run_status()
    headline = None
    if status is not None:
        headline = {
            "deadline_violations_days": status.get("deadline_violations_days"),
            "violated_node_count": len(status.get("violated_nodes", [])),
            "violated_nodes": status.get("violated_nodes", []),
            "node_count": status.get("node_count"),
            "compute_ms": status.get("compute_ms"),
            "seed_note": (
                "GT-1 mission profile from data/missions/gt-1.json (task 2.16), "
                "re-based onto a live delivery date (2026-12-01). The planner's "
                "question is 'standing at today, licensing not started, which "
                "deadlines are already dead.' All dates ESTIMATED per D5."
            ),
            "measured_at": datetime.now(timezone.utc).isoformat(),
        }

    # Beneficiary sizing -- VERIFIED to primary sources 2026-08-16.
    # Both Swartwout figures date to 2016; state the year wherever they appear (D5).
    # The research pack's "12 months licensing" claim was CUT: the checkable
    # primary (CubeSat 101, 2017, Section 2.8) says 4 to 6 months.
    beneficiary_sizing = {
        "missions_per_year_approx": "40",
        "missions_per_year_quote": "now it is not unusual for 40 university-class missions to fly every year",
        "missions_per_year_source": (
            "Swartwout and Jayne, 'University-Class Spacecraft by the Numbers: Success, "
            "Failure, Debris. (But Mostly Success.)', 30th AIAA/USU Conference on Small "
            "Satellites, 2016, https://digitalcommons.usu.edu/smallsat/2016/TS13Education/1"
        ),
        "university_failure_rate_pct": "40",
        "university_failure_rate_quote": (
            "about 40% of all manifested university-class missions fail to achieve any "
            "of their primary mission objectives"
        ),
        "university_failure_rate_source": (
            "Swartwout and Jayne, SmallSat 2016, "
            "https://digitalcommons.usu.edu/smallsat/2016/TS13Education/1 (figure dates to 2016)"
        ),
        "licensing_runway": "4 to 6 months",
        "licensing_runway_source": (
            "NASA CubeSat 101 (CSLI, 2017), Section 2.8 'Regulatory Licensing (4-6 months)'; "
            "same document: FCC requires a minimum of 90 days from application receipt, and "
            "IARU coordination starts immediately at manifest. Age flagged per D5."
        ),
    }

    test_counts = run_test_counts()
    eval_result = run_eval()
    eval_live = None
    if live_report is not None:
        eval_live = load_eval_live(live_report, live_url or "")
    elif FACTS_OUT.exists():
        try:
            eval_live = json.loads(FACTS_OUT.read_text()).get("eval_live")
        except (OSError, json.JSONDecodeError):
            eval_live = None
    generated_at = datetime.now(timezone.utc).isoformat()

    return {
        "_meta": {
            "generated_at": generated_at,
            "generated_by": "scripts/facts.py",
            "source_files": [
                str(DECAY_TABLE.relative_to(REPO_ROOT)),
                str(SURYA_OUTLOOK.relative_to(REPO_ROOT)) if SURYA_OUTLOOK.exists() else None,
            ],
            "note": (
                "Every number in README.md, docs/, and the video script must come from "
                "this file. Hand-editing this file fails CI. Re-run scripts/facts.py "
                "after any change to data/decay-table.json or data/surya-outlook.json."
            ),
        },

        # The differentiator -- same orbit, opposite verdict
        "differentiator": {
            "orbit_description": f"3U CubeSat at {GT1_PERIGEE_KM} km circular, Bc={GT1_BC} kg/m^2",
            "altitude_km": GT1_PERIGEE_KM,
            "ballistic_coefficient": GT1_BC,
            "fcc_limit_years": FCC_LIMIT_YEARS,
            "f107_assumed_nominal": f107_assumed,

            "lifetime_years_nominal": round(lifetime_nominal, 3),
            "lifetime_years_solar_min": round(lifetime_solar_min, 3),
            "lifetime_years_solar_max": round(lifetime_solar_max, 3),

            "verdict_nominal": verdict_nominal,
            "verdict_solar_min": verdict_solar_min,
            "verdict_solar_max": verdict_solar_max,

            "swing_sentence": (
                f"At {GT1_PERIGEE_KM} km with Bc={GT1_BC:.0f} kg/m^2: "
                f"solar min lifetime {round(lifetime_solar_min, 1)} yr ({verdict_solar_min}), "
                f"solar max lifetime {round(lifetime_solar_max, 2)} yr ({verdict_solar_max}). "
                "Same orbit. Opposite verdict. The solar cycle decides."
            ),
            "citation": "47 CFR 25.283(e), FCC 22-74 (2022)",
            "method": entry["method"],
        },

        # Surya inference output
        "surya": {
            "activity_index": surya_activity_index,
            "model_id": surya_data.get("modelId"),
            "checkpoint": surya_data.get("checkpoint"),
            "inference_date": surya_data.get("inferenceDate"),
            "notes": surya_data.get("notes"),
        } if surya_data else None,

        # Model inventory -- CI asserts this matches /api/status response
        "models": models,

        # Seed mission
        "seed_mission": {
            "id": "gt-1",
            "name": "GT-1 (Georgia Tech SSDL)",
            "source": "SmallSat 2021 SSC21-P2-48, DOI 10.26077/s4a1-qn29",
            "perigee_km": GT1_PERIGEE_KM,
            "bc_kg_m2": GT1_BC,
        },

        # Headline from the real engine run -- None if run_status.ts unavailable
        "headline": headline,

        # Beneficiary sizing -- UNVERIFIED until primary sources confirmed
        "beneficiary_sizing": beneficiary_sizing,

        # Engine state. Test counts come from a real vitest run, never a hand
        # -maintained literal: see run_test_counts().
        "engine": {
            "test_count": test_counts["engine_and_mobile"] if test_counts else None,
            "ask_route_test_count": test_counts["ask_route"] if test_counts else None,
            "test_count_total": test_counts["total"] if test_counts else None,
            "test_count_note": (
                "Counted by running the suites (vitest --reporter=json) at "
                f"{generated_at}. engine_and_mobile = npm run test:engine, "
                "ask_route = npm run test:ask."
                if test_counts else
                "NOT MEASURED: the vitest suites could not be run on this "
                "machine. Do not quote a test count from this file until it is "
                "regenerated where the suites run."
            ),
            "decay_table_entries": len(table),
            "decay_table_generated_at": table[0].get("generatedAt") if table else None,
        },

        # Eval state, measured by running the bank offline against committed
        # fixtures. app/judge/page.tsx step 3 sends a judge here for the score
        # and the trap results, so this block is that promise being kept.
        "eval": eval_result if eval_result else {
            "score_pct": None,
            "note": (
                "NOT MEASURED: the eval runner could not complete on this "
                "machine. Do not quote a score from this file until it is "
                "regenerated where the runner runs."
            ),
        },
        "eval_note": (
            "Measured by running `python3 eval/runner.py --mode fixtures` at "
            f"{generated_at}: offline, no network, no API key, against the "
            "committed fixtures, so anyone who clones the repo reproduces it. "
            "The score is the credential-free extractive path. The "
            "aspirational bar in CLAUDE.md section 5 is 90 percent; CI "
            "enforces a raise-only ratchet at today's measured floor instead, "
            "and eval-gate.yml fails on any regression or on any trap "
            "answering."
            if eval_result else
            "NOT MEASURED on this run."
        ),
        "eval_live": eval_live,
        "eval_live_note": (
            "Production URL run of the same bank, recorded separately so the "
            "clone-reproducible fixtures score cannot be overwritten by a "
            "network measurement. Re-run with --live-report after "
            "`python3 eval/runner.py --mode url --url <deploy> --min-score 0`. "
            "--check does not re-hit the network."
            if eval_live else
            "NOT MEASURED: pass --live-report PATH after a URL-mode runner."
        ),
    }


# ---------------------------------------------------------------------------
# --check mode: verify FACTS.json is not stale
# ---------------------------------------------------------------------------

def check_not_stale() -> None:
    if not FACTS_OUT.exists():
        print("FAIL: docs/FACTS.json does not exist. Run: python scripts/facts.py", file=sys.stderr)
        sys.exit(1)

    with open(FACTS_OUT) as f:
        existing = json.load(f)

    # Re-compute and compare the differentiator numbers only (stable across runs)
    fresh = compute_facts()
    existing_diff = existing.get("differentiator", {})
    fresh_diff = fresh["differentiator"]

    mismatches = []
    for key in ("lifetime_years_nominal", "lifetime_years_solar_min", "lifetime_years_solar_max",
                "verdict_solar_min", "verdict_solar_max", "verdict_nominal"):
        if existing_diff.get(key) != fresh_diff.get(key):
            mismatches.append(
                f"  {key}: FACTS.json={existing_diff.get(key)!r} vs computed={fresh_diff.get(key)!r}"
            )

    # The headline changes with the calendar. Comparing prose to FACTS.json is
    # only useful if this half first proves that FACTS.json matches a fresh
    # engine run. Missing runtime output fails closed instead of preserving a
    # stale day count behind a green guard.
    existing_headline = existing.get("headline") or {}
    fresh_headline = fresh.get("headline")
    if fresh_headline is None:
        mismatches.append(
            "  headline could not be measured from scripts/run_status.ts; "
            "the time-varying claim was not re-verified."
        )
    else:
        for key in ("deadline_violations_days", "violated_node_count",
                    "violated_nodes", "node_count"):
            if existing_headline.get(key) != fresh_headline.get(key):
                mismatches.append(
                    f"  headline.{key}: FACTS.json={existing_headline.get(key)!r} "
                    f"vs measured={fresh_headline.get(key)!r}"
                )

    # Test counts drift the moment anyone adds a test, and a stale count is
    # exactly the kind of figure that reaches a video narration that cannot be
    # edited afterward. Compare them, and if they could not be MEASURED, say so
    # out loud rather than passing quietly (a skipped check is not a pass).
    existing_engine = existing.get("engine", {})
    fresh_engine = fresh["engine"]
    if fresh_engine.get("test_count") is None:
        # A skipped check is not a pass, and UNDER CI it must be a failure.
        #
        # The first run of the fabricated-numbers job proved why: without node
        # on the runner, vitest could not run, this branch printed a warning,
        # and the job then reported "OK: docs/FACTS.json is current" and went
        # green while never comparing a single test count. A guard reporting on
        # a comparison it did not make is worse than no guard, because it buys
        # confidence it has not earned.
        #
        # Locally a warning is still right: a developer without node installed
        # should not be blocked from checking the differentiator numbers.
        if os.environ.get("CI"):
            mismatches.append(
                "  engine.test_count: counts could NOT be measured on this CI "
                "runner, so the test-count half of this check did not run. "
                "Under CI that is a failure, not a skip. Ensure node and the "
                "npm dependencies are installed in this job."
            )
        else:
            print("WARNING: test counts were NOT measured on this machine, so "
                  "the test-count half of this check did not run. The "
                  "differentiator numbers below were still checked. This is a "
                  "warning locally and a FAILURE under CI.", file=sys.stderr)
    else:
        for key in ("test_count", "ask_route_test_count", "test_count_total"):
            if existing_engine.get(key) != fresh_engine.get(key):
                mismatches.append(
                    f"  engine.{key}: FACTS.json={existing_engine.get(key)!r} "
                    f"vs measured={fresh_engine.get(key)!r}"
                )

    # The eval block is judge-facing: app/judge/page.tsx step 3 sends a judge to
    # this file for the score and the trap results. It was possible for that
    # block to be stale, or to be a named absence, while this check passed
    # quietly, because the comparison above never looked at it. A check that
    # ignores a field cannot defend it.
    existing_eval = existing.get("eval", {})
    fresh_eval = fresh.get("eval", {})

    if existing_eval.get("score_pct") is None:
        mismatches.append(
            "  eval.score_pct: FACTS.json carries a NAMED ABSENCE, so no eval "
            "score is published. Re-run scripts/facts.py where the runner works."
        )
    elif fresh_eval.get("score_pct") is None:
        # Fail rather than skip. A guard that cannot run must go red, never
        # green-by-absence: that is the exact defect this file exists to catch.
        mismatches.append(
            "  eval: the runner could not complete on this machine, so the "
            "published score could not be re-verified. This check fails closed."
        )
    else:
        for key in ("score_pct", "questions_correct", "questions_total",
                    "traps_total", "traps_abstained", "rows_scored"):
            if existing_eval.get(key) != fresh_eval.get(key):
                mismatches.append(
                    f"  eval.{key}: FACTS.json={existing_eval.get(key)!r} "
                    f"vs measured={fresh_eval.get(key)!r}"
                )
        if existing_eval.get("traps_abstained") != existing_eval.get("traps_total"):
            mismatches.append(
                "  eval: a published abstention trap did not abstain. "
                "Cite-or-abstain is a hard product rule, not a target."
            )

    if mismatches:
        print("FAIL: docs/FACTS.json is stale. Re-run: python scripts/facts.py", file=sys.stderr)
        for m in mismatches:
            print(m, file=sys.stderr)
        sys.exit(1)

    print("OK: docs/FACTS.json is current.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate or verify docs/FACTS.json")
    parser.add_argument("--check", action="store_true",
                        help="Check that FACTS.json is current; exit 1 if stale")
    parser.add_argument(
        "--live-report",
        type=Path,
        default=None,
        help="Path to eval/runner.py --mode url report.json to record as eval_live",
    )
    parser.add_argument(
        "--live-url",
        default="https://manifest-web-roan.vercel.app",
        help="Deploy URL that produced --live-report (recorded, not fetched)",
    )
    args = parser.parse_args()

    if args.check:
        check_not_stale()
        return

    FACTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    facts = compute_facts(live_report=args.live_report, live_url=args.live_url)
    with open(FACTS_OUT, "w") as f:
        json.dump(facts, f, indent=2)
        f.write("\n")

    print(f"Wrote {FACTS_OUT.relative_to(REPO_ROOT)}")
    print(f"  Differentiator: {facts['differentiator']['swing_sentence']}")
    if facts.get("surya"):
        print(f"  Surya activity index: {facts['surya']['activity_index']}")
    if facts.get("eval"):
        print(f"  Eval fixtures: {facts['eval'].get('score_pct')} percent, "
              f"{facts['eval'].get('traps_abstained')}/"
              f"{facts['eval'].get('traps_total')} traps")
    if facts.get("eval_live"):
        print(f"  Eval live: {facts['eval_live'].get('score_pct')} percent "
              f"at {facts['eval_live'].get('url')}")


if __name__ == "__main__":
    main()
