"""
pipeline/decay.py
Orbital decay lifetime estimator using NRLMSISE-00 atmospheric model.

Inputs:
  altitude_km (float)          -- circular orbit altitude in km
  ballistic_coeff (float)      -- m/(Cd*A) in kg/m^2
  launch_year_month (str)      -- ISO "YYYY-MM", used for date labelling only

Outputs:
  DecayEstimate dict (see contract below)

Contract with engine/interlocks/deorbit-compliance.ts:
  The script writes data/decay-table.json as a JSON array of DecayEstimate objects.
  The TypeScript engine reads this array; it never calls Python at runtime.

  DecayEstimate shape (mirrors TypeScript interface):
    altitudeKm:          float  -- input
    ballisticCoefficient: float  -- kg/m^2 input
    launchYearMonth:     str    -- "YYYY-MM"
    lifetimeYears:       float  -- nominal F10.7 (from NOAA predicted mean)
    lifetimeYearsLow:    float  -- pessimistic (solar min F10.7=70)
    lifetimeYearsHigh:   float  -- optimistic (solar max F10.7=200)
    f107Assumed:         float  -- the nominal F10.7 value used
    method:              str    -- "NRLMSISE-00 ballistic drag integration"
    generatedAt:         str    -- ISO timestamp

Method:
  Uses the NRLMSISE-00 model (pyatmos 1.2.7) via direct gtd7d call with
  fixed F10.7/Ap values -- no network download of historical SW data required.
  Integrates the simplified ballistic drag equation for circular orbits
  (King-Hele / Low 2018 formulation):
    da/dt = -pi * (1/Bc) * rho(a, F10.7) * v(a)
  where Bc = m/(Cd*A), rho is NRLMSISE-00 density, v = sqrt(mu/a).
  Step size: 7 days. Terminates at 80 km reentry or 15-year cap.

Sources:
  Low, S.Y.W. & Chia, Y.X. (2018). "Assessment of Orbit Maintenance Strategies
    for Small Satellites", 32nd Annual AIAA/USU Conference on Small Satellites.
    https://digitalcommons.usu.edu/smallsat/2018/all2018/364/
  Emmert, J.T. (2015). Altitude-dependent trends in the thermosphere.
    NRLMSISE-00 model. pyatmos 1.2.7 (MIT).
  NOAA SWPC predicted-solar-cycle.json: F10.7 low/nominal/high quantiles.

Authority for 5-year rule:
  FCC 22-74 (2022); 47 CFR 25.283(e).
  Applies at or below 2000 km orbit altitude.
"""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import TypedDict

import numpy as np

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MU = 3.986004418e14    # Earth gravitational parameter m^3/s^2
R_EARTH = 6_371_000.0  # Earth mean radius m
KARMAN_M = 80_000.0    # Reentry altitude threshold m (conservative)
DT_SECONDS = 86_400.0 * 7.0    # Integration step: 7 days
MAX_LIFETIME_YEARS = 15.0       # Cap -- FCC rule is 5yr, 15yr is enough headroom
SECONDS_PER_YEAR = 365.25 * 86_400.0

# Fixed Ap index: quiet geomagnetic conditions (Ap=4 = Kp~1)
AP_QUIET = 4
DOY_SOLSTICE = 180     # ~June/July -- representative mid-year
HOUR_NOON = 12.0


# ---------------------------------------------------------------------------
# NRLMSISE-00 density at altitude and F10.7
# ---------------------------------------------------------------------------

def _nrl_density(alt_km: float, f107: float) -> float:
    """
    Returns total mass density in kg/m^3 using NRLMSISE-00 via direct gtd7d call.
    No network access required -- uses fixed F10.7 and Ap inputs.

    Uses gtd7d (includes anomalous oxygen, appropriate above 500 km).
    """
    # Import here to give a clean ImportError if pyatmos is missing
    from pyatmos.msise.nrlmsise00_subfunc import gtd7, gtd7d  # noqa: PLC0415

    inputp = {
        "doy": DOY_SOLSTICE,
        "year": 2026,
        "sec": HOUR_NOON * 3600.0,
        "alt": float(alt_km),
        "g_lat": 0.0,
        "g_lon": 0.0,
        "lst": HOUR_NOON,
        "f107A": float(f107),  # 81-day average
        "f107": float(f107),   # previous day
        "ap": AP_QUIET,
        "ap_a": np.full(7, float(AP_QUIET)),
    }
    switches = np.ones(23)
    switches[8] = -1.0  # use 3-hour geomagnetic index

    # gtd7d is recommended above 500 km (includes anomalous oxygen)
    fn = gtd7d if alt_km >= 500.0 else gtd7
    output = fn(inputp, switches)
    return float(output["d"]["RHO"])


# ---------------------------------------------------------------------------
# Decay lifetime integrator
# ---------------------------------------------------------------------------

def _lifetime_years(alt_km: float, bc_kg_m2: float, f107: float) -> float:
    """
    Estimate orbital decay lifetime in years for a circular orbit.

    Parameters
    ----------
    alt_km : float
        Initial circular orbit altitude in km.
    bc_kg_m2 : float
        Ballistic coefficient m/(Cd*A) in kg/m^2.
    f107 : float
        F10.7 solar flux index (sfu) -- held constant throughout integration.
        This is a conservative simplification; real orbits span varying F10.7.

    Returns
    -------
    float
        Lifetime in years, capped at MAX_LIFETIME_YEARS.

    Method
    ------
    Ballistic drag integration for a circular orbit (King-Hele / Low 2018):
        da/dt = -pi * (1/Bc) * rho(a, F10.7) * v(a)
    where v(a) = sqrt(mu/a), a = R_earth + alt.
    One step = DT_SECONDS. Terminates when alt < KARMAN_M or t > cap.
    """
    if bc_kg_m2 <= 0.0:
        raise ValueError(f"ballisticCoefficient must be positive, got {bc_kg_m2}")
    if not (80.0 <= alt_km <= 2000.0):
        raise ValueError(f"altitudeKm must be between 80 and 2000, got {alt_km}")

    alt_m = alt_km * 1000.0
    inv_bc = 1.0 / bc_kg_m2
    t = 0.0
    max_seconds = MAX_LIFETIME_YEARS * SECONDS_PER_YEAR

    while t < max_seconds:
        a = R_EARTH + alt_m
        v = math.sqrt(MU / a)
        rho = _nrl_density(alt_m / 1000.0, f107)
        # da/dt = -pi * (1/Bc) * rho * v * a  [m/s]
        # (derived from dE/dt = F_drag * v, where F_drag per unit mass = rho*v^2/(2*Bc))
        da_dt = -math.pi * inv_bc * rho * v * a
        alt_m += da_dt * DT_SECONDS
        t += DT_SECONDS

        if alt_m < KARMAN_M:
            return t / SECONDS_PER_YEAR

    return MAX_LIFETIME_YEARS


# ---------------------------------------------------------------------------
# DecayEstimate TypedDict (matches TypeScript interface)
# ---------------------------------------------------------------------------

class DecayEstimate(TypedDict):
    altitudeKm: float
    ballisticCoefficient: float
    launchYearMonth: str
    lifetimeYears: float
    lifetimeYearsLow: float
    lifetimeYearsHigh: float
    f107Assumed: float
    method: str
    generatedAt: str


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

# F10.7 index values for the three scenario columns
F107_SOLAR_MIN = 70.0    # ESTIMATED: typical solar minimum (Cycle 24 trough ~2019: ~65-72)
F107_SOLAR_MAX = 200.0   # ESTIMATED: typical solar maximum (Cycle 25 peak ~2025: ~190-220)


def estimate_decay(
    altitude_km: float,
    ballistic_coeff: float,
    launch_year_month: str,
    f107_nominal: float = 120.0,
) -> DecayEstimate:
    """
    Compute orbital decay lifetime estimate for the given orbit parameters.

    Parameters
    ----------
    altitude_km : float
        Circular orbit altitude in km. Between 80 and 2000.
    ballistic_coeff : float
        m/(Cd*A) in kg/m^2. A 3U CubeSat is approximately 180 kg/m^2.
    launch_year_month : str
        ISO "YYYY-MM" label for provenance. Not used in the calculation.
    f107_nominal : float
        Nominal F10.7 value (sfu). Default 120 = typical current cycle.
        Source: NOAA SWPC predicted-solar-cycle.json mean.

    Returns
    -------
    DecayEstimate
    """
    lt_low = _lifetime_years(altitude_km, ballistic_coeff, F107_SOLAR_MIN)
    lt_nominal = _lifetime_years(altitude_km, ballistic_coeff, f107_nominal)
    lt_high = _lifetime_years(altitude_km, ballistic_coeff, F107_SOLAR_MAX)

    return DecayEstimate(
        altitudeKm=round(altitude_km, 1),
        ballisticCoefficient=round(ballistic_coeff, 2),
        launchYearMonth=launch_year_month,
        lifetimeYears=round(lt_nominal, 3),
        lifetimeYearsLow=round(lt_low, 3),
        lifetimeYearsHigh=round(lt_high, 3),
        f107Assumed=round(f107_nominal, 1),
        method="NRLMSISE-00 ballistic drag integration (pyatmos 1.2.7, King-Hele/Low 2018)",
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )


def generate_decay_table(output_path: str | Path | None = None) -> list[DecayEstimate]:
    """
    Generate the standard decay table for the Manifest decay-table.json artifact.

    Covers the mission-relevant altitude range (400-700 km) at three ballistic
    coefficients representing small CubeSat configurations.

    Writes to data/decay-table.json relative to the repo root.
    """
    # Ballistic coefficients:
    #   ~180 kg/m^2 = 3U (10x10x30cm, Cd=2.2, A=0.01m^2, m=4kg)
    #   ~120 kg/m^2 = 6U (typical)
    #   ~250 kg/m^2 = 12U / larger frame
    bcs = [120.0, 180.0, 250.0]
    altitudes = [400.0, 450.0, 500.0, 550.0, 600.0, 650.0, 700.0]
    launch_year_month = "2026-08"   # Representative hackathon reference date

    table: list[DecayEstimate] = []
    for alt in altitudes:
        for bc in bcs:
            entry = estimate_decay(alt, bc, launch_year_month)
            table.append(entry)

    if output_path is None:
        # Default: data/decay-table.json relative to repo root
        repo_root = Path(__file__).parent.parent
        output_path = repo_root / "data" / "decay-table.json"

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(table, fh, indent=2)
        fh.write("\n")

    return table


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Generating decay table...", file=sys.stderr)
    table = generate_decay_table()
    print(f"Written {len(table)} entries to data/decay-table.json", file=sys.stderr)
    # Print a summary of the key compliance-sensitive rows
    print(f"\n{'Alt':>6}  {'Bc':>6}  {'Low(yr)':>8}  {'Nom(yr)':>8}  {'High(yr)':>8}  {'Compliant@nom':>14}")
    print("-" * 65)
    for row in table:
        compliant = "YES" if row["lifetimeYears"] <= 5.0 else "NO"
        print(
            f"{row['altitudeKm']:>6.0f}"
            f"  {row['ballisticCoefficient']:>6.0f}"
            f"  {row['lifetimeYearsLow']:>8.2f}"
            f"  {row['lifetimeYears']:>8.2f}"
            f"  {row['lifetimeYearsHigh']:>8.2f}"
            f"  {compliant:>14}"
        )
