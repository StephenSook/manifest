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

/**
 * Read the observed summary NOAA actually sends.
 *
 * The 10cm-flux product returns a single-element ARRAY, verified live
 * 2026-08-25: `[{"flux":143,"time_tag":"2026-08-24T20:00:00"}]`. This module
 * used to cast that array straight to an object, so `observed.flux` was
 * `undefined` and `fetchSolarConditions` would have returned a SolarConditions
 * carrying an undefined flux with `live: true`. Returns null rather than a
 * partial reading, so a caller cannot mistake an absence for a measurement.
 */
export function readObservedSummary(raw: unknown): NoaaFluxSummary | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (row === null || typeof row !== 'object') return null;
  const flux = (row as Record<string, unknown>).flux;
  if (typeof flux !== 'number' || !Number.isFinite(flux)) return null;
  const timeTag = (row as Record<string, unknown>).time_tag;
  if (typeof timeTag !== 'string' || timeTag.trim() === '') return null;
  return { flux, time_tag: timeTag };
}

async function fetchObserved(): Promise<NoaaFluxSummary> {
  const res = await fetch(OBSERVED_URL);
  if (!res.ok) {
    throw new Error(
      `solar/fetch: observed endpoint returned ${res.status} ${res.statusText}`,
    );
  }
  const parsed = readObservedSummary(await res.json());
  if (parsed === null) {
    throw new Error(
      'solar/fetch: observed endpoint returned no usable flux reading',
    );
  }
  return parsed;
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
 * NOT IMPLEMENTED, and it never was.
 *
 * This fetched the RELATIVE url `/data/solar-conditions.json`, which Node
 * rejects outright server-side, pointing at a file that does not exist and
 * has no generator (`scripts/cache-solar.ts` was never written). Leaving it
 * shaped like a working fallback made `getSolarConditions` claim in its own
 * docstring that it "never throws" while both of its branches were broken.
 *
 * It now rejects immediately and names the path that does work, so a future
 * caller finds out at the first call rather than in production.
 */
export async function loadCachedConditions(): Promise<SolarConditions> {
  throw new Error(
    'solar/fetch: loadCachedConditions is not implemented. There is no ' +
      'committed solar cache artifact and no generator for one. Use the ' +
      'GET /api/solar route, which reads NOAA live, validates every value ' +
      'and returns a named absence when NOAA cannot be reached.',
  );
}

/**
 * Fetch live solar conditions.
 *
 * The cache fallback is not implemented, so this THROWS when NOAA is
 * unreachable. The previous docstring promised it "never throws", which was
 * untrue in both branches. The supported live path for the app is the
 * GET /api/solar route.
 */
export async function getSolarConditions(): Promise<SolarConditions> {
  try {
    return await fetchSolarConditions();
  } catch {
    return loadCachedConditions();
  }
}
