// app/api/solar/__tests__/solar.test.ts
// Task 2.8 completion: the solar route.
//
// WHY THESE FIELD NAMES ARE PINNED BY TEST.
// app/judge/page.tsx step 4 prints a verify instruction naming
// `f107_live`, `predicted_envelope` and `surya_outlook` (or `surya_absent`).
// Those names are a promise made to a judge in the product's own UI. A test
// that pins them is the guard that stops the promise drifting away from the
// endpoint again, which is exactly how this route came to be documented
// before it existed.

import { describe, expect, it } from 'vitest';
import {
  parseNoaaPredicted,
  buildSolarPayload,
  readObservedFlux,
  type NoaaPredictedEntry,
  type SuryaOutlook,
} from '../lib';

// FIXTURES ARE THE REAL NOAA SHAPES, captured from the live endpoints on
// 2026-08-25. Two details here are load-bearing and both were discovered by
// running the route against NOAA rather than by reasoning about it:
//
//   1. The predicted endpoint spells the key `time-tag` with a HYPHEN.
//      Every other field uses underscores, which is exactly why the wrong
//      one looks right. `services/solar/fetch.ts` assumed `time_tag` and
//      therefore filtered every row away and returned an empty envelope.
//   2. The observed endpoint returns an ARRAY of one reading, not an object.
//
// Keeping the real spellings in the fixture is the guard: a future edit that
// "tidies" the key back to an underscore fails here instead of silently
// serving an empty envelope to a judge.
const entries: NoaaPredictedEntry[] = [
  { 'time-tag': '2026-07', 'predicted_f10.7': 118, 'low_f10.7': 108, 'high_f10.7': 128 },
  { 'time-tag': '2026-08', 'predicted_f10.7': 120, 'low_f10.7': 110, 'high_f10.7': 130 },
  { 'time-tag': '2026-09', 'predicted_f10.7': 122, 'low_f10.7': 112, 'high_f10.7': 132 },
];

const surya: SuryaOutlook = {
  horizonMonths: 1,
  activityIndex: [0.0231],
  activityIndexSource: 'surya-1.0-aia94-proxy',
  modelId: 'nasa-ibm-ai4science/Surya-1.0',
  checkpoint: 'surya.366m.v1.pt',
  notes: 'ESTIMATED.',
};

describe('parseNoaaPredicted', () => {
  it('drops months before the current month and keeps the month tags', () => {
    const parsed = parseNoaaPredicted(entries, '2026-08');
    expect(parsed.months).toEqual(['2026-08', '2026-09']);
  });

  it('returns predicted, low and high as arrays parallel to months', () => {
    const parsed = parseNoaaPredicted(entries, '2026-08');
    expect(parsed.predicted).toEqual([120, 122]);
    expect(parsed.low).toEqual([110, 112]);
    expect(parsed.high).toEqual([130, 132]);
  });
});

describe('readObservedFlux, against the real NOAA envelope shape', () => {
  it('reads the flux out of the single-element array NOAA actually returns', () => {
    const observed = readObservedFlux([
      { flux: 143, time_tag: '2026-08-24T20:00:00' },
    ]);
    expect(observed).toEqual({ flux: 143, time_tag: '2026-08-24T20:00:00' });
  });

  it('still accepts a bare object, so a NOAA shape change does not break us', () => {
    const observed = readObservedFlux({ flux: 143, time_tag: '2026-08-24T20:00:00' });
    expect(observed?.flux).toBe(143);
  });

  it('returns null rather than a guess when the payload has no numeric flux', () => {
    expect(readObservedFlux([])).toBeNull();
    expect(readObservedFlux({})).toBeNull();
    expect(readObservedFlux([{ flux: 'not a number' }])).toBeNull();
    expect(readObservedFlux(null)).toBeNull();
  });
});

describe('buildSolarPayload with a live NOAA reading', () => {
  const payload = buildSolarPayload({
    observed: { flux: 148.2, time_tag: '2026-08-25T20:00:00Z' },
    envelope: parseNoaaPredicted(entries, '2026-08'),
    surya,
  });

  it('exposes the observed flux as f107_live', () => {
    expect(payload.f107_live).toBe(148.2);
  });

  it('exposes the envelope as predicted_envelope with parallel arrays', () => {
    expect(payload.predicted_envelope.months).toEqual(['2026-08', '2026-09']);
    expect(payload.predicted_envelope.low).toEqual([110, 112]);
    expect(payload.predicted_envelope.high).toEqual([130, 132]);
  });

  it('reports the Surya outlook and does not set surya_absent', () => {
    expect(payload.surya_absent).toBe(false);
    expect(payload.surya_outlook?.modelId).toBe('nasa-ibm-ai4science/Surya-1.0');
  });

  it('names the NOAA source urls so the judge cross-check is runnable', () => {
    expect(payload.source.observed).toContain('services.swpc.noaa.gov');
    expect(payload.source.predicted).toContain('services.swpc.noaa.gov');
  });

  it('declares the reading live', () => {
    expect(payload.live).toBe(true);
    expect(payload.solar_source).toBe('NOAA_SWPC_LIVE');
  });
});

describe('buildSolarPayload when Surya is absent', () => {
  it('sets surya_absent and nulls the outlook rather than inventing one', () => {
    const payload = buildSolarPayload({
      observed: { flux: 148.2, time_tag: '2026-08-25T20:00:00Z' },
      envelope: parseNoaaPredicted(entries, '2026-08'),
      surya: null,
    });
    expect(payload.surya_absent).toBe(true);
    expect(payload.surya_outlook).toBeNull();
  });
});

describe('buildSolarPayload when NOAA is unreachable', () => {
  // This is the defect the whole rival field kept making: a surface that
  // manufactures a plausible number when its upstream is down. A named
  // absence is the only honest answer, and cite-or-abstain applies to a
  // measurement exactly as it applies to a regulatory citation.
  const payload = buildSolarPayload({
    observed: null,
    envelope: null,
    surya,
    unreachableReason: 'observed endpoint returned 503 Service Unavailable',
  });

  it('returns a null reading rather than a fabricated flux', () => {
    expect(payload.f107_live).toBeNull();
  });

  it('names the absence instead of a date-shaped or success-shaped placeholder', () => {
    expect(payload.solar_source).toBe('NOAA_UNREACHABLE');
    expect(payload.live).toBe(false);
  });

  it('carries the upstream failure text so the failure is diagnosable', () => {
    expect(payload.reason).toContain('503');
  });

  it('returns an empty envelope rather than a half-populated one', () => {
    expect(payload.predicted_envelope.months).toEqual([]);
    expect(payload.predicted_envelope.predicted).toEqual([]);
  });

  it('still reports Surya, because the Surya artifact does not depend on NOAA', () => {
    expect(payload.surya_absent).toBe(false);
  });
});

describe('parseNoaaPredicted rejects rows it cannot fully read', () => {
  // Number(undefined) is NaN, and JSON.stringify turns NaN into null. A NOAA
  // row missing one quantile therefore published `null` INSIDE the envelope
  // arrays: the parallel-array contract silently broke, and a consumer
  // indexing low[i] got null beside a real predicted[i]. That is a fabricated
  // measurement wearing a different hat, which this endpoint exists to refuse.
  const partial: NoaaPredictedEntry[] = [
    { 'time-tag': '2026-09', 'predicted_f10.7': 133.7, 'high_f10.7': 141.1 }, // low missing
    { 'time-tag': '2026-10', 'predicted_f10.7': 130.0, 'low_f10.7': 121.0, 'high_f10.7': 138.0 },
    { 'time-tag': '2026-11', 'predicted_f10.7': 'n/a', 'low_f10.7': 119.0, 'high_f10.7': 136.0 },
  ];

  it('drops a row missing a quantile rather than emitting NaN', () => {
    const parsed = parseNoaaPredicted(partial, '2026-08');
    expect(parsed.months).toEqual(['2026-10']);
    expect(parsed.low).toEqual([121.0]);
  });

  it('drops a row whose value is present but not numeric', () => {
    const parsed = parseNoaaPredicted(partial, '2026-08');
    expect(parsed.predicted.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('never emits a null once serialized', () => {
    const parsed = parseNoaaPredicted(partial, '2026-08');
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain('null');
  });

  it('keeps all four arrays the same length', () => {
    const parsed = parseNoaaPredicted(partial, '2026-08');
    const n = parsed.months.length;
    expect(parsed.predicted).toHaveLength(n);
    expect(parsed.low).toHaveLength(n);
    expect(parsed.high).toHaveLength(n);
  });
});
