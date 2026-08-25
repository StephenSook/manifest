// services/solar/__tests__/fetch.test.ts
// Integration tests for the NOAA solar fetch.
// These hit the real NOAA endpoints, run locally only, not in CI.
// CI uses the committed cache artifact instead.
// Marked with .skipIf(process.env.CI) so they never block a PR.

import { describe, it, expect } from 'vitest';
import {
  fetchSolarConditions,
  parsePredictedForTest,
  readObservedSummary,
  loadCachedConditions,
} from '../fetch';

// Re-export the internal parser for unit testing without network
// (we'll add a unit test below that uses a fixture)

// Live test only runs when LIVE_TESTS=1 is explicitly set.
// Never runs in CI or in the normal `npm test` / `npm run test:engine` suite.
describe('solar/fetch, live NOAA integration (LIVE_TESTS=1 only)', () => {
  it.skipIf(!process.env.LIVE_TESTS)('fetches real F10.7 and returns a valid SolarConditions', async () => {
    const conditions = await fetchSolarConditions();

    // F10.7 is typically between 65 and 300 sfu, outside this means something is wrong
    expect(conditions.f107Current).toBeGreaterThan(60);
    expect(conditions.f107Current).toBeLessThan(400);

    // Should have forward projection data
    expect(conditions.f107Predicted.length).toBeGreaterThan(0);
    expect(conditions.envelopeLow.length).toBe(conditions.f107Predicted.length);
    expect(conditions.envelopeHigh.length).toBe(conditions.f107Predicted.length);

    // Low <= predicted <= high at every point
    for (let i = 0; i < conditions.f107Predicted.length; i++) {
      expect(conditions.envelopeLow[i]).toBeLessThanOrEqual(conditions.f107Predicted[i]);
      expect(conditions.f107Predicted[i]).toBeLessThanOrEqual(conditions.envelopeHigh[i]);
    }

    expect(conditions.live).toBe(true);
    expect(conditions.observedAt).toBeTruthy();
    expect(conditions.source.observed).toContain('swpc.noaa.gov');
    expect(conditions.source.predicted).toContain('swpc.noaa.gov');
  }, 10_000); // 10s timeout for network
});

describe('solar/fetch, predicted envelope parsing (unit, no network)', () => {
  // Fixture modelled on the real NOAA predicted-solar-cycle.json shape
  const FIXTURE = [
    // Past months, should be filtered out
    { time_tag: '2025-01', 'predicted_f10.7': 130, 'low_f10.7': 110, 'high_f10.7': 150 },
    { time_tag: '2025-06', 'predicted_f10.7': 140, 'low_f10.7': 115, 'high_f10.7': 165 },
    // Current and future months, should be included
    { time_tag: '2026-08', 'predicted_f10.7': 155, 'low_f10.7': 125, 'high_f10.7': 185 },
    { time_tag: '2026-09', 'predicted_f10.7': 158, 'low_f10.7': 128, 'high_f10.7': 188 },
    { time_tag: '2026-10', 'predicted_f10.7': 152, 'low_f10.7': 122, 'high_f10.7': 182 },
  ];

  it('filters past months and returns only current + future', () => {
    // parsePredictedForTest is the exported-for-test version of parsePredicted
    // with a pinned "current" date so the test is deterministic
    const result = parsePredictedForTest(FIXTURE, '2026-08');

    expect(result.predicted).toHaveLength(3); // 2026-08, 09, 10
    expect(result.predicted[0]).toBe(155);
    expect(result.low[0]).toBe(125);
    expect(result.high[0]).toBe(185);
  });

  it('low is always <= predicted and predicted <= high in the fixture', () => {
    const result = parsePredictedForTest(FIXTURE, '2026-08');
    for (let i = 0; i < result.predicted.length; i++) {
      expect(result.low[i]).toBeLessThanOrEqual(result.predicted[i]);
      expect(result.predicted[i]).toBeLessThanOrEqual(result.high[i]);
    }
  });

  it('returns empty arrays when all entries are in the past', () => {
    const result = parsePredictedForTest(FIXTURE, '2030-01');
    expect(result.predicted).toHaveLength(0);
    expect(result.low).toHaveLength(0);
    expect(result.high).toHaveLength(0);
  });
});

describe('solar/fetch, against the shape NOAA actually returns', () => {
  // THE FIXTURE ABOVE IS WRONG, and it made this module's green suite
  // meaningless. It spells the month key `time_tag`, matching what this
  // parser assumed, so the test certified the assumption rather than the
  // integration. The live endpoint spells it `time-tag` with a HYPHEN on
  // this product only. Captured from
  // services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json
  // on 2026-08-25; every other key on the same row uses an underscore,
  // which is exactly why the wrong spelling reads as correct.
  //
  // Consequence before this fix: the filter compared `undefined >= "2026-08"`,
  // which is false for every row, so the parser returned EMPTY arrays for
  // live NOAA data while passing its own tests. The module was dead code and
  // broken code at once, and wiring it up unexamined would have shipped an
  // empty predicted envelope to a judge.
  const LIVE_SHAPE = [
    {
      'time-tag': '2026-02',
      'predicted_ssn': 102.6,
      'predicted_f10.7': 140.7,
      'high_f10.7': 149.0,
      'low_f10.7': 134.5,
    },
    {
      'time-tag': '2026-09',
      'predicted_ssn': 100.1,
      'predicted_f10.7': 133.7,
      'high_f10.7': 141.1,
      'low_f10.7': 124.9,
    },
  ];

  it('reads the hyphenated month key the live endpoint actually sends', () => {
    const result = parsePredictedForTest(LIVE_SHAPE, '2026-08');
    expect(result.predicted).toEqual([133.7]);
    expect(result.low).toEqual([124.9]);
    expect(result.high).toEqual([141.1]);
  });

  it('does not silently return an empty envelope for a healthy live payload', () => {
    const result = parsePredictedForTest(LIVE_SHAPE, '2026-01');
    expect(result.predicted.length).toBe(2);
  });
});

describe('solar/fetch, the module contract is honest about what works', () => {
  // This module has no callers: GET /api/solar is the supported live path and
  // carries the tested parsers. What was left here was worse than unused, it
  // was a trap. fetchObserved cast NOAA's single-element ARRAY straight to an
  // object, so `observed.flux` was undefined and fetchSolarConditions would
  // have returned a SolarConditions with an undefined flux and `live: true`.
  // loadCachedConditions fetched a RELATIVE url, which Node rejects outright,
  // pointing at a data/solar-conditions.json that does not exist and has no
  // generator. So getSolarConditions promised in its own docstring that it
  // "never throws" while both of its branches were broken.
  //
  // Rather than quietly leave that for whoever wires this next, the module now
  // fails loudly and says where the working path is.

  it('readObservedSummary pulls the flux out of the array NOAA sends', () => {
    expect(readObservedSummary([{ flux: 143, time_tag: '2026-08-24T20:00:00' }]))
      .toEqual({ flux: 143, time_tag: '2026-08-24T20:00:00' });
  });

  it('readObservedSummary refuses a reading it cannot fully trust', () => {
    expect(readObservedSummary([])).toBeNull();
    expect(readObservedSummary([{ flux: null, time_tag: 'x' }])).toBeNull();
    expect(readObservedSummary([{ flux: 143 }])).toBeNull();
  });

  it('loadCachedConditions rejects with a pointer to the working path', async () => {
    await expect(loadCachedConditions()).rejects.toThrow(/api\/solar/);
  });
});
