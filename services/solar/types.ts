// services/solar/types.ts
// SolarConditions contract, shared between Stephen (producer) and Tylin/Khadim (consumers)
// CONTRACT: changes require announcement before committing. See PLAN.md Shared Contracts.

export interface SolarConditions {
  /** Current observed F10.7 solar flux index (sfu) */
  f107Current: number;
  /**
   * Forward-looking predicted F10.7 values from NOAA SWPC predicted-solar-cycle.json
   * One entry per month, starting from the current month.
   * Index 0 = current month, index 1 = next month, etc.
   */
  f107Predicted: number[];
  /**
   * Low quantile (pessimistic solar activity, longer orbital lifetime, compliance risk)
   * Parallel array to f107Predicted.
   */
  envelopeLow: number[];
  /**
   * High quantile (optimistic solar activity, shorter orbital lifetime, safer compliance)
   * Parallel array to f107Predicted.
   */
  envelopeHigh: number[];
  /** ISO timestamp of the observed F10.7 reading */
  observedAt: string;
  /** Data source URLs */
  source: {
    observed: string;
    predicted: string;
  };
  /** True if data was fetched live; false if loaded from a cached data/ artifact */
  live: boolean;
}

// ---------------------------------------------------------------------------
// NOAA SWPC API response shapes (internal use by fetch.ts)
// ---------------------------------------------------------------------------

/** Response from services.swpc.noaa.gov/products/summary/10cm-flux.json */
export interface NoaaFluxSummary {
  flux: number;
  time_tag: string;
}

/**
 * One entry from services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json
 * The JSON keys use dots (e.g. "predicted_f10.7") so we parse them via index access.
 *
 * THE MONTH KEY IS `time-tag` WITH A HYPHEN on this product, verified against
 * the live payload 2026-08-25. The observed-flux product uses `time_tag` with
 * an underscore, and so does every other key on this same row, which is what
 * makes the wrong spelling look right. This interface previously REQUIRED
 * `time_tag`, which encoded the mistake into the type system and let a wrong
 * fixture typecheck. Neither spelling is required now; read the tag through
 * `monthTag()` in fetch.ts, which accepts both.
 */
export interface NoaaPredictedCycleEntry {
  'time-tag'?: string; // "YYYY-MM", the live spelling
  time_tag?: string; // tolerated in case NOAA normalises later
  [key: string]: number | string | undefined;
  // Accessed as entry["predicted_f10.7"], entry["high_f10.7"], entry["low_f10.7"]
}
