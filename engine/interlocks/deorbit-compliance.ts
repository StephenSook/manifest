// engine/interlocks/deorbit-compliance.ts
// Interlock 3: FCC 5-year post-mission disposal (deorbit compliance) verdict.
//
// Authority: FCC 22-74 (2022), 47 CFR 25.283(e).
// Applies to LEO satellites at or below 2000 km.
//
// CFR paragraph paths below are marked VERIFY_FROM_SNAPSHOT pending Tylin's
// task 1.1 eCFR parse. The section-level citations (25.283, 25.114, 97.207,
// 5.64) are confirmed against the eCFR structure API; only the sub-paragraph
// paths are unverified. Any path that does not resolve in the snapshot must
// be abstained rather than encoded.
//
// How this interlock fits the differentiator:
//   The decay-table.json produced by pipeline/decay.py carries three lifetime
//   scenarios per orbit/Bc combination: low (F10.7=70, solar min), nominal
//   (F10.7=120, current cycle), high (F10.7=200, solar max).
//
//   Same orbit, same satellite -- opposite verdict depending on solar cycle.
//   That is the Manifest differentiator: space weather changes a legal outcome.
//
// The engine reads data/decay-table.json at build time (bundled as a static
// import). It does NOT call Python at runtime.

import type { Verdict, Citation } from '../types';
import decayTable from '../../data/decay-table.json';

// ---------------------------------------------------------------------------
// Decay table entry shape (must match pipeline/decay.py DecayEstimate)
// ---------------------------------------------------------------------------

interface DecayEntry {
  altitudeKm: number;
  ballisticCoefficient: number;
  launchYearMonth: string;
  lifetimeYears: number;       // nominal F10.7
  lifetimeYearsLow: number;    // solar min (F10.7=70) -- longest lifetime
  lifetimeYearsHigh: number;   // solar max (F10.7=200) -- shortest lifetime
  f107Assumed: number;
  method: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface DeorbitComplianceResult {
  /** Compliance verdict under the NOMINAL solar activity scenario */
  verdict: Verdict;
  /** Lifetime in years under nominal F10.7 */
  lifetimeYears: number;
  /** Lifetime in years under solar minimum (low F10.7) -- worst case for compliance */
  lifetimeYearsLow: number;
  /** Lifetime in years under solar maximum (high F10.7) -- best case for compliance */
  lifetimeYearsHigh: number;
  /** F10.7 value used for the nominal lifetime calculation */
  f107Assumed: number;
  /** Estimation method description */
  method: string;
  /** The FCC 5-year disposal limit (years) -- statutory */
  fccLimitYears: number;
  /**
   * True if the orbit is above the 2000 km threshold where the 5-year rule
   * does not apply under the current framework.
   */
  aboveRuleThreshold: boolean;
  /** True if no matching decay table entry was found for the given orbit */
  tableEntryNotFound: boolean;
  /**
   * The closest table entry altitude used when an exact match is not found.
   * Null if an exact match was found.
   */
  closestAltitudeKmUsed: number | null;
  /** Governing citation -- paragraph path VERIFY_FROM_SNAPSHOT (task 1.1) */
  citation: Citation;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** FCC 5-year disposal rule threshold in km (2000 km per FCC 22-74). */
const FCC_RULE_THRESHOLD_KM = 2000;

/** FCC-mandated maximum post-mission disposal time in years. */
const FCC_LIMIT_YEARS = 5;

/**
 * Paragraph paths UNVERIFIED pending task 1.1 eCFR parse.
 * Source: eCFR structure API confirms sections 25.283, 25.114, 97.207, 5.64
 * exist. Sub-paragraph paths (e)(1) etc. need snapshot verification.
 */
const SNAPSHOT = 'VERIFY_FROM_SNAPSHOT';
const ECFR_BASE = 'https://www.ecfr.gov/current/title-';

const PART_25_DEORBIT_CITATION: Citation = {
  cfrTitle: 47,
  part: 25,
  section: '25.283',
  paragraphPath: '(e)',   // VERIFY_FROM_SNAPSHOT
  amddate: SNAPSHOT,
  sourceUrl: `${ECFR_BASE}47/part-25/section-25.283`,
};

// ---------------------------------------------------------------------------
// Table lookup helpers
// ---------------------------------------------------------------------------

/**
 * Find the closest altitude entry in the decay table for the given orbit.
 * Matches on ballisticCoefficient first (nearest), then altitude (nearest).
 *
 * Returns null if the table is empty.
 */
function findClosestEntry(
  altitudeKm: number,
  ballisticCoefficient: number,
): { entry: DecayEntry; exact: boolean; closestAlt: number | null } | null {
  const table = decayTable as DecayEntry[];
  if (table.length === 0) return null;

  // 1. Find all distinct BCs and pick nearest
  const allBcs = [...new Set(table.map((e) => e.ballisticCoefficient))];
  const nearestBc = allBcs.reduce((prev, curr) =>
    Math.abs(curr - ballisticCoefficient) < Math.abs(prev - ballisticCoefficient) ? curr : prev,
  );

  // 2. Within that BC tier, find nearest altitude
  const bcRows = table.filter((e) => e.ballisticCoefficient === nearestBc);
  const nearestAlt = bcRows.reduce((prev, curr) =>
    Math.abs(curr.altitudeKm - altitudeKm) < Math.abs(prev.altitudeKm - altitudeKm) ? curr : prev,
  );

  const exact = nearestAlt.altitudeKm === altitudeKm && nearestBc === ballisticCoefficient;
  return {
    entry: nearestAlt,
    exact,
    closestAlt: exact ? null : nearestAlt.altitudeKm,
  };
}

// ---------------------------------------------------------------------------
// Main compliance function
// ---------------------------------------------------------------------------

/**
 * Compute the FCC 5-year deorbit compliance verdict for a mission.
 *
 * @param perigeeKm - Orbit perigee altitude in km (compliance applies to LEO <= 2000 km)
 * @param ballisticCoefficient - m/(Cd*A) in kg/m^2 (from MissionInput)
 * @param f107Override - Optional: override the nominal F10.7 from the table
 *                       (e.g., from live NOAA fetch or Surya inference).
 *                       When provided, lifetimeYears is re-evaluated using
 *                       the ratio of the override to the table's f107Assumed.
 *                       This is an approximation; the table is the primary source.
 */
export function computeDeorbitCompliance(
  perigeeKm: number,
  ballisticCoefficient: number,
  f107Override?: number,
): DeorbitComplianceResult {
  // Orbits above 2000 km are not subject to the 5-year rule under current framework
  if (perigeeKm > FCC_RULE_THRESHOLD_KM) {
    return {
      verdict: 'ABSTAIN',
      lifetimeYears: 0,
      lifetimeYearsLow: 0,
      lifetimeYearsHigh: 0,
      f107Assumed: 0,
      method: 'Not applicable above 2000 km under current FCC framework',
      fccLimitYears: FCC_LIMIT_YEARS,
      aboveRuleThreshold: true,
      tableEntryNotFound: false,
      closestAltitudeKmUsed: null,
      citation: PART_25_DEORBIT_CITATION,
    };
  }

  const lookup = findClosestEntry(perigeeKm, ballisticCoefficient);

  if (lookup === null) {
    return {
      verdict: 'ABSTAIN',
      lifetimeYears: 0,
      lifetimeYearsLow: 0,
      lifetimeYearsHigh: 0,
      f107Assumed: 0,
      method: 'Decay table not loaded -- run pipeline/decay.py first',
      fccLimitYears: FCC_LIMIT_YEARS,
      aboveRuleThreshold: false,
      tableEntryNotFound: true,
      closestAltitudeKmUsed: null,
      citation: PART_25_DEORBIT_CITATION,
    };
  }

  const { entry, closestAlt } = lookup;

  // Nominal lifetime -- apply f107Override correction if provided
  // Correction: linear interpolation between low/high scenarios by F10.7 fraction.
  // This is an estimate; the table is the primary authority.
  let nominalLifetime = entry.lifetimeYears;
  let f107Used = entry.f107Assumed;

  if (f107Override !== undefined && f107Override !== entry.f107Assumed) {
    // Clamp to [low, high] range defined by solar min/max F10.7 (70, 200)
    const F107_LOW = 70;
    const F107_HIGH = 200;
    const frac = Math.max(0, Math.min(1,
      (f107Override - F107_LOW) / (F107_HIGH - F107_LOW),
    ));
    // Higher F10.7 -> shorter lifetime -> interpolate from lifetimeYearsLow to lifetimeYearsHigh
    nominalLifetime = entry.lifetimeYearsLow + frac * (entry.lifetimeYearsHigh - entry.lifetimeYearsLow);
    f107Used = f107Override;
  }

  // Verdict under nominal scenario
  let verdict: Verdict;
  if (nominalLifetime <= FCC_LIMIT_YEARS) {
    verdict = 'OK';
  } else if (nominalLifetime <= FCC_LIMIT_YEARS * 1.2) {
    // Within 20% of the limit -- AT_RISK (uncertainty band from NRLMSISE-00 estimate)
    verdict = 'AT_RISK';
  } else {
    verdict = 'VIOLATED';
  }

  return {
    verdict,
    lifetimeYears: Math.round(nominalLifetime * 1000) / 1000,
    lifetimeYearsLow: entry.lifetimeYearsLow,
    lifetimeYearsHigh: entry.lifetimeYearsHigh,
    f107Assumed: f107Used,
    method: entry.method,
    fccLimitYears: FCC_LIMIT_YEARS,
    aboveRuleThreshold: false,
    tableEntryNotFound: false,
    closestAltitudeKmUsed: closestAlt,
    citation: PART_25_DEORBIT_CITATION,
  };
}
