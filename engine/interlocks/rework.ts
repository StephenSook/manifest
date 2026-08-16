// engine/interlocks/rework.ts
// Rework trigger logic — per PLAN.md task 1.16 and CLAUDE.md section 4 interlock 6.
//
// Three rework triggers:
//   1. Frequency change  -> IARU re-coordination must restart from the beginning
//   2. Orbit > ~600 km   -> propulsion or drag augmentation decision required under
//                           the FCC five-year disposal rule (FCC 22-74)
//   3. Launch slip       -> every clock in the graph recomputes (handled by
//                           calling computeCriticalPath with the updated MissionInput)

/** Node IDs that must be re-done when the mission frequency changes */
export function getFrequencyChangeReworkNodes(): string[] {
  return ['iaru-request', 'iaru-letter'];
}

export interface OrbitReworkResult {
  /**
   * True when apogee exceeds the ~600 km threshold above which passive decay
   * alone may not achieve reentry within 5 years near solar minimum.
   * Per PLAN.md: "orbit above roughly 600 km forces a propulsion or drag
   * augmentation decision under the FCC five-year rule".
   * We are conservative: >= 600 km triggers the review.
   */
  requiresPropulsionReview: boolean;
  apogeeKm: number;
  thresholdKm: number;
}

/**
 * Given an orbital apogee altitude, determine whether the FCC five-year
 * disposal rework trigger fires.
 *
 * @param apogeeKm - Apogee altitude in km
 */
export function getOrbitReworkNodes(apogeeKm: number): OrbitReworkResult {
  const THRESHOLD_KM = 600;
  return {
    requiresPropulsionReview: apogeeKm >= THRESHOLD_KM,
    apogeeKm,
    thresholdKm: THRESHOLD_KM,
  };
}

/**
 * Launch slip rework: returns a descriptive string explaining that all clocks
 * recompute. The actual recomputation happens by calling computeCriticalPath
 * with the updated MissionInput — there is no separate function needed.
 */
export function getLaunchSlipReworkDescription(): string {
  return (
    'A launch slip recomputes every regulatory clock in the graph. ' +
    'Re-run computeCriticalPath with the updated deliveryDate and launchDate.'
  );
}
