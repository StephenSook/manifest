// app/api/solar/lib.ts
// Task 2.8 completion: pure payload construction for GET /api/solar.
//
// Kept separate from route.ts so every branch is unit-testable without a
// network or a Next request. The route stays a thin shell: fetch, delegate,
// serialize.
//
// The field names below are a CONTRACT. app/judge/page.tsx step 4 tells a
// judge to read `f107_live`, `predicted_envelope` and `surya_outlook`
// (or `surya_absent`). Renaming any of them silently breaks a promise the
// product makes in its own UI, so they are pinned by test.

export const OBSERVED_URL =
  'https://services.swpc.noaa.gov/products/summary/10cm-flux.json';
export const PREDICTED_URL =
  'https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json';

/** How many months of forward projection to return. Matches services/solar/fetch.ts. */
export const FORWARD_MONTHS = 60;

// ---------------------------------------------------------------------------
// Upstream shapes
// ---------------------------------------------------------------------------

/**
 * One row of services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json
 *
 * NOAA spells the month key `time-tag` with a HYPHEN on this endpoint, while
 * every other key on the same row uses underscores and the observed endpoint
 * uses `time_tag`. Verified against the live payload 2026-08-25. Reading the
 * underscore form here yields `undefined`, every row then fails the
 * month filter, and the endpoint serves an empty envelope while looking
 * perfectly healthy. `monthTag()` accepts both spellings so a NOAA
 * normalisation later does not break us either way.
 */
export interface NoaaPredictedEntry {
  [key: string]: number | string | undefined;
}

/** Read the month tag from a predicted-cycle row, tolerating either spelling. */
export function monthTag(entry: NoaaPredictedEntry): string {
  const raw = entry['time-tag'] ?? entry['time_tag'];
  return typeof raw === 'string' ? raw : '';
}

/** services.swpc.noaa.gov/products/summary/10cm-flux.json */
export interface NoaaObserved {
  flux: number;
  time_tag: string;
}

/** The committed data/surya-outlook.json artifact (D7). */
export interface SuryaOutlook {
  horizonMonths: number;
  activityIndex: number[];
  activityIndexSource: string;
  modelId: string;
  checkpoint: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface PredictedEnvelope {
  months: string[];
  predicted: number[];
  low: number[];
  high: number[];
}

/**
 * `NOAA_SWPC_LIVE` means the numbers came off the wire this request.
 * `NOAA_UNREACHABLE` is a NAMED ABSENCE: no reading, and we say so.
 * There is deliberately no third value that reads as success.
 */
export type SolarSource = 'NOAA_SWPC_LIVE' | 'NOAA_UNREACHABLE';

export interface SolarPayload {
  f107_live: number | null;
  observed_at: string | null;
  predicted_envelope: PredictedEnvelope;
  surya_outlook: SuryaOutlook | null;
  surya_absent: boolean;
  live: boolean;
  solar_source: SolarSource;
  reason: string | null;
  source: { observed: string; predicted: string };
  fetched_at: string;
  disclosure: string;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Filter the NOAA predicted-cycle rows to the current month forward and split
 * them into parallel arrays. The month tags are carried through: an envelope
 * without its months cannot be checked against the source by a reader.
 */
export function parseNoaaPredicted(
  entries: NoaaPredictedEntry[],
  currentYearMonth: string,
): PredictedEnvelope {
  const future = entries
    .filter((e) => {
      const tag = monthTag(e);
      return tag !== '' && tag >= currentYearMonth;
    })
    .slice(0, FORWARD_MONTHS);

  // A row survives only if all three quantiles are REAL readings and the
  // bounds are internally consistent.
  //
  // An isFinite check alone is not enough, and the gap is nastier than NaN.
  // Number(null), Number('') and Number(false) are all 0, and 0 is finite, so
  // a blank or null quantile would publish ZERO as though someone measured it.
  // Zero is a plausible-looking flux value, which makes it worse than NaN:
  // NaN serializes to null and is visibly wrong, while 0 reads as data.
  //
  // Dropping the row keeps the four arrays parallel and keeps every published
  // value a number somebody actually measured. If this empties the envelope
  // the route treats it as an error rather than serving an empty envelope
  // beside a healthy 200.
  const usable = future.filter((e) => {
    const p = strictNumber(e['predicted_f10.7']);
    const lo = strictNumber(e['low_f10.7']);
    const hi = strictNumber(e['high_f10.7']);
    if (p === null || lo === null || hi === null) return false;
    // NOAA publishes low and high as quantiles around the prediction. A row
    // that violates that ordering is not a reading we understand, so it is
    // not one we republish.
    return lo <= hi;
  });

  return {
    months: usable.map(monthTag),
    predicted: usable.map((e) => strictNumber(e['predicted_f10.7'])!),
    low: usable.map((e) => strictNumber(e['low_f10.7'])!),
    high: usable.map((e) => strictNumber(e['high_f10.7'])!),
  };
}

/**
 * Coerce a value to a number ONLY when it genuinely is one.
 *
 * Accepts a finite number, or a non-empty numeric string, because NOAA has
 * published quantiles as strings on some products. Rejects null, undefined,
 * booleans, empty and whitespace-only strings, and anything non-finite, all
 * of which `Number()` would silently turn into 0 or NaN.
 */
export function strictNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Read the observed F10.7 reading out of whatever the summary endpoint
 * returned. NOAA answers with a single-element ARRAY (verified live
 * 2026-08-25: `[{"flux":143,"time_tag":"2026-08-24T20:00:00"}]`), and an
 * earlier reading of this code assumed a bare object. Both are accepted.
 *
 * Returns null rather than a partial or coerced reading: a flux that is
 * absent, non-numeric or NaN is an absence, and the caller must report it as
 * one instead of publishing a number nobody measured.
 */
export function readObservedFlux(raw: unknown): NoaaObserved | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (row === null || typeof row !== 'object') return null;

  const flux = strictNumber((row as Record<string, unknown>).flux);
  if (flux === null) return null;

  // A reading with no timestamp is not a reading a judge can cross-check
  // against NOAA, and substituting an empty string would let an undated
  // measurement ship looking complete. Refuse it and take the named-absence
  // path instead.
  const timeTag = (row as Record<string, unknown>).time_tag;
  if (typeof timeTag !== 'string' || timeTag.trim() === '') return null;

  return { flux, time_tag: timeTag };
}

const EMPTY_ENVELOPE: PredictedEnvelope = {
  months: [],
  predicted: [],
  low: [],
  high: [],
};

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

export interface BuildSolarPayloadInput {
  observed: NoaaObserved | null;
  envelope: PredictedEnvelope | null;
  surya: SuryaOutlook | null;
  unreachableReason?: string;
  /** Injected for deterministic tests. Defaults to now. */
  fetchedAt?: string;
}

/**
 * Build the response. When NOAA is unreachable the reading is null and the
 * source is named, never substituted with a nominal value: a fabricated
 * measurement on a judge-facing surface is the same defect class as an
 * uncited regulatory claim, and the product refuses both.
 *
 * Surya is independent of NOAA, so it is reported either way.
 */
export function buildSolarPayload(input: BuildSolarPayloadInput): SolarPayload {
  const reachable = input.observed !== null && input.envelope !== null;

  return {
    f107_live: reachable ? input.observed!.flux : null,
    observed_at: reachable ? input.observed!.time_tag : null,
    predicted_envelope: reachable ? input.envelope! : EMPTY_ENVELOPE,
    surya_outlook: input.surya,
    surya_absent: input.surya === null,
    live: reachable,
    solar_source: reachable ? 'NOAA_SWPC_LIVE' : 'NOAA_UNREACHABLE',
    reason: reachable ? null : (input.unreachableReason ?? 'NOAA SWPC did not answer'),
    source: { observed: OBSERVED_URL, predicted: PREDICTED_URL },
    fetched_at: input.fetchedAt ?? new Date().toISOString(),
    disclosure: reachable
      ? 'F10.7 is read live from NOAA SWPC on every request and is not cached. The predicted envelope is NOAA SWPC\'s own published low and high quantiles, exactly as NOAA published them: this endpoint does not adjust, smooth or narrow them. The Surya activity index is an ESTIMATED scalar proxy reported alongside for context, and no code applies it to the envelope.'
      : 'NOAA SWPC could not be reached on this request, so no flux reading is reported. No nominal value has been substituted. The deorbit verdict on /api/status computes from the frozen NRLMSISE-00 decay table and does not depend on this endpoint.',
  };
}

/** Current month as "YYYY-MM" in UTC. */
export function currentYearMonthUtc(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
