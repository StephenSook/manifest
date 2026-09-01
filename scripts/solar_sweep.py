#!/usr/bin/env python3
"""Measure how often solar activity alone decides the FCC disposal verdict.

Manifest's headline is "the sun decides if your satellite is legal". That is a
claim, and a claim about our own product is worth exactly as much as the
artifact that could refute it. This computes the number from the committed
decay table and prints the half that cuts against the headline as prominently
as the half that supports it.

Borrowed discipline: a rival in this field shipped per-feature importances
beside its headline metric, and that artifact refuted its own product (the
space-weather inputs it was named for scored 0.0000 importance). Publishing the
refutable number is the point.

Reproduce with no key, no network, no model:

    python3 scripts/solar_sweep.py

Reads data/decay-table.json only. Every lifetime there came from an
NRLMSISE-00 ballistic drag integration at three solar levels: F10.7=70 (solar
minimum, thinnest atmosphere, LONGEST lifetime, worst case for compliance),
F10.7=120 (nominal), and F10.7=200 (solar maximum, shortest lifetime).
"""

from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TABLE = REPO / "data" / "decay-table.json"

# 47 CFR 25.283(e): disposal no later than five years after end of mission.
FCC_LIMIT_YEARS = 5.0

# The integrator's ceiling. A row at exactly this value did not finish
# decaying, so it is a LOWER BOUND on the lifetime, not a measurement.
INTEGRATION_CEILING_YEARS = 15.0


def verdict(lifetime_years: float) -> str:
    return "VIOLATED" if lifetime_years > FCC_LIMIT_YEARS else "OK"


def sweep() -> dict:
    rows = json.loads(TABLE.read_text(encoding="utf-8"))
    if not rows:
        raise SystemExit(f"{TABLE} is empty, nothing to measure")

    flips, always_ok, never_ok = [], [], []
    for row in rows:
        # Solar MIN gives the longest lifetime and so the worst compliance
        # case; solar MAX gives the shortest and the best case.
        worst = verdict(row["lifetimeYearsLow"])
        best = verdict(row["lifetimeYearsHigh"])
        if worst != best:
            flips.append(row)
        elif best == "OK":
            always_ok.append(row)
        else:
            never_ok.append(row)

    capped = sum(
        1 for r in flips if r["lifetimeYearsLow"] >= INTEGRATION_CEILING_YEARS
    )
    band = sorted({r["altitudeKm"] for r in flips})
    return {
        "configurations": len(rows),
        "altitudes_km": sorted({r["altitudeKm"] for r in rows}),
        "ballistic_coefficients": sorted({r["ballisticCoefficient"] for r in rows}),
        "verdict_flips_on_solar_alone": len(flips),
        "compliant_at_every_solar_level": len(always_ok),
        "non_compliant_at_every_solar_level": len(never_ok),
        "flip_band_km": [min(band), max(band)] if band else [],
        "flips_whose_worst_case_hit_the_integration_ceiling": capped,
        "fcc_limit_years": FCC_LIMIT_YEARS,
        "flips": [
            {
                "altitude_km": r["altitudeKm"],
                "ballistic_coefficient": r["ballisticCoefficient"],
                "solar_min_years": r["lifetimeYearsLow"],
                "solar_max_years": r["lifetimeYearsHigh"],
            }
            for r in sorted(
                flips, key=lambda r: (r["altitudeKm"], r["ballisticCoefficient"])
            )
        ],
    }


def main() -> int:
    s = sweep()
    n = s["configurations"]
    pct = 100.0 * s["verdict_flips_on_solar_alone"] / n
    print(f"decay table: {n} configurations "
          f"({len(s['altitudes_km'])} altitudes x {len(s['ballistic_coefficients'])} Bc)")
    print(f"verdict flips on solar activity alone: "
          f"{s['verdict_flips_on_solar_alone']} of {n} ({pct:.1f}%)")
    print(f"  compliant at every solar level:     {s['compliant_at_every_solar_level']} of {n}")
    print(f"  non-compliant at every solar level: {s['non_compliant_at_every_solar_level']} of {n}")
    if s["flip_band_km"]:
        print(f"the sun decides between {s['flip_band_km'][0]:.0f} and "
              f"{s['flip_band_km'][1]:.0f} km")
    print(f"NOTE: {s['flips_whose_worst_case_hit_the_integration_ceiling']} flips have a "
          f"solar-minimum lifetime at the {INTEGRATION_CEILING_YEARS:.0f}-year integration "
          "ceiling, so those are lower bounds, not exact lifetimes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
