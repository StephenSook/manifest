// services/solar/fetch.ts
// Live NOAA SWPC solar flux fetch + predicted-flux envelope.
// CORS is permissive (Access-Control-Allow-Origin: *), verified 2026-08-16.
// Runs browser-side in the web app and in the Capacitor static export.
// No API key, no auth.
//
// Endpoints:
//   Observed:  https://services.swpc.noaa.gov/products/summary/10cm-flux.json
//   Predicted: https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json
//
// Per PLAN.md task 1.10 and Q7 resolution.

import type { SolarConditions, NoaaFluxSummary, NoaaPredictedCycleEntry } from './types';

const OBSERVED_URL =
  'https://services.swpc.noaa.gov/products/summary/10cm-flux.json';
const PREDICTED_URL =
  'https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json';

// How many months of forward projection to return
const FORWARD_MONTHS = 60;

/**
 * Read the month tag from a predicted-solar-cycle row.
 *
 * NOAA spells this key `time-tag` with a HYPHEN on the predicted-cycle
 * product, while the observed-flux product uses `time_tag` and every other
 * key on the same predicted row uses underscores. Verified against the live
 * payload on 2026-08-25.
 *
 * This parser previously read the underscore form, which is `undefined` for
 * every live row, so the month filter rejected all of them and the function
 * returned empty arrays for a perfectly healthy NOAA response. Its unit test
 * did not catch that because the test fixture was written from the same
 * assumption as the code. Both spellings are accepted here so a future NOAA
 * normalisation cannot reintroduce the failure from the other direction.
 */
function monthTag(entry: NoaaPredictedCycleEntry): string {
  const raw = entry['time-tag'] ?? entry['time_tag'];
  return typeof raw === 'string' ? raw : '';
}

// ---------------------------------------------------------------------------
// Internal fetchers
// ---------------------------------------------------------------------------

async function fetchObserved(): Promise<NoaaFluxSummary> {
  const res = await fetch(OBSERVED_URL);
  if (!res.ok) {
    throw new Error(
      `solar/fetch: observed endpoint returned ${res.status} ${res.statusText}`,
    );
  }
  return res.json() as Promise<NoaaFluxSummary>;
}

async function fetchPredicted(): Promise<NoaaPredictedCycleEntry[]> {
  const res = await fetch(PREDICTED_URL);
  if (!res.ok) {
    throw new Error(
      `solar/fetch: predicted endpoint returned ${res.status} ${res.statusText}`,
    );
  }
  return res.json() as Promise<NoaaPredictedCycleEntry[]>;
}

// ---------------------------------------------------------------------------
// Parse the predicted-solar-cycle entries into parallel arrays
// Filters to entries from current month forward, capped at FORWARD_MONTHS
// ---------------------------------------------------------------------------

function parsePredicted(entries: NoaaPredictedCycleEntry[]): {
  predicted: number[];
  low: number[];
  high: number[];
} {
  const now = new Date();
  const currentYearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return parsePredictedForTest(entries, currentYearMonth);
}

/**
 * Exported for unit testing with a pinned current month.
 * Production code uses parsePredicted() which infers the current month.
 */
export function parsePredictedForTest(
  entries: NoaaPredictedCycleEntry[],
  currentYearMonth: string,
): { predicted: number[]; low: number[]; high: number[] } {
  const future = entries
    .filter((e) => {
      const tag = monthTag(e);
      return tag !== '' && tag >= currentYearMonth;
    })
    .slice(0, FORWARD_MONTHS);

  return {
    predicted: future.map((e) => Number(e['predicted_f10.7'])),
    low: future.map((e) => Number(e['low_f10.7'])),
    high: future.map((e) => Number(e['high_f10.7'])),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch live solar conditions from NOAA SWPC.
 * Returns a SolarConditions object with the current F10.7 and the predicted
 * envelope for the next FORWARD_MONTHS months.
 *
 * On network failure, throws, callers should fall back to loadCachedConditions().
 */
export async function fetchSolarConditions(): Promise<SolarConditions> {
  const [observed, predictedRaw] = await Promise.all([
    fetchObserved(),
    fetchPredicted(),
  ]);

  const { predicted, low, high } = parsePredicted(predictedRaw);

  return {
    f107Current: observed.flux,
    f107Predicted: predicted,
    envelopeLow: low,
    envelopeHigh: high,
    observedAt: observed.time_tag,
    source: {
      observed: OBSERVED_URL,
      predicted: PREDICTED_URL,
    },
    live: true,
  };
}

/**
 * Load solar conditions from a committed cache file (data/solar-conditions.json).
 * Used by the Capacitor static export and as a fallback when the network is unavailable.
 * The cache is written by scripts/cache-solar.ts on each deploy.
 */
export async function loadCachedConditions(): Promise<SolarConditions> {
  // In the browser this resolves to /data/solar-conditions.json (public dir)
  // In Node (eval/tests) this resolves relative to cwd
  const res = await fetch('/data/solar-conditions.json');
  if (!res.ok) {
    throw new Error(
      `solar/fetch: cache file not found, run scripts/cache-solar.ts first`,
    );
  }
  const data = (await res.json()) as SolarConditions;
  return { ...data, live: false };
}

/**
 * Fetch live solar conditions, falling back to the committed cache on failure.
 * This is the function the rest of the app should call.
 * Always returns valid SolarConditions, never throws.
 */
export async function getSolarConditions(): Promise<SolarConditions> {
  try {
    return await fetchSolarConditions();
  } catch {
    return loadCachedConditions();
  }
}
