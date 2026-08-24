// services/solar/__tests__/fetch.test.ts
// Integration tests for the NOAA solar fetch.
// These hit the real NOAA endpoints, run locally only, not in CI.
// CI uses the committed cache artifact instead.
// Marked with .skipIf(process.env.CI) so they never block a PR.

import { describe, it, expect } from 'vitest';
import { fetchSolarConditions, parsePredictedForTest } from '../fetch';

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
