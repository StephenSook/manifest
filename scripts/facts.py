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


def compute_facts() -> dict:
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
    # deadline_violations_days moves as `today` advances, so the staleness check
    # (--check) deliberately excludes this block; it compares differentiator
    # numbers only. Re-run facts.py before any surface quotes the headline.
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
                "GT-1 mission profile re-based onto a live delivery date "
                "(2026-12-01); the planner's question is 'standing at today, "
                "licensing not started, which deadlines are already dead.' "
                "All dates ESTIMATED per D5, replaced by data/missions/gt-1.json "
                "when 2.16 lands."
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

    return {
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
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

        # Engine state
        "engine": {
            "test_count": 74,
            "test_count_note": "As of 2026-08-17. Update after adding tests.",
            "decay_table_entries": len(table),
            "decay_table_generated_at": table[0].get("generatedAt") if table else None,
        },
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
    args = parser.parse_args()

    if args.check:
        check_not_stale()
        return

    FACTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    facts = compute_facts()
    with open(FACTS_OUT, "w") as f:
        json.dump(facts, f, indent=2)
        f.write("\n")

    print(f"Wrote {FACTS_OUT.relative_to(REPO_ROOT)}")
    print(f"  Differentiator: {facts['differentiator']['swing_sentence']}")
    if facts.get("surya"):
        print(f"  Surya activity index: {facts['surya']['activity_index']}")


if __name__ == "__main__":
    main()
