// engine/interlocks/__tests__/lv-determination.test.ts
// Interlock 1: 47 CFR 97.207(g) dual clock.
// Pre-space notification due:
//   (A) within 30 days AFTER launch-vehicle determination date, AND
//   (B) no later than 90 days BEFORE integration date.
// Whichever is EARLIER (tighter) is the binding deadline.
// Test first — per PLAN.md task 1.8 and CLAUDE.md section 4 interlock 1.

import { describe, it, expect } from 'vitest';
import {
  computeLvDeterminationDeadlines,
  type LvDeterminationDeadlines,
} from '../lv-determination';

describe('interlock 1 — 97.207(g) dual clock', () => {
  // Fixture:
  //   LV determination date: 2026-01-01
  //   Integration date:      2026-06-01
  //
  // Clock A: 30 days after LV determination = 2026-01-31
  // Clock B: 90 days before integration     = 2026-03-03 (2026-06-01 minus 90 days)
  //
  // Clock A (2026-01-31) is earlier — it is the binding deadline.

  const result: LvDeterminationDeadlines = computeLvDeterminationDeadlines(
    '2026-01-01', // lvDeterminationDate
    '2026-06-01', // integrationDate
  );

  it('clock A: notification deadline is 30 days after LV determination', () => {
    expect(result.clockA_30DaysAfterLvDetermination).toBe('2026-01-31');
  });

  it('clock B: notification deadline is 90 days before integration', () => {
    expect(result.clockB_90DaysBeforeIntegration).toBe('2026-03-03');
  });

  it('binding deadline is the earlier of the two clocks (clock A in this fixture)', () => {
    expect(result.bindingDeadline).toBe('2026-01-31');
  });

  it('isViolated is false when today is before binding deadline', () => {
    const r = computeLvDeterminationDeadlines('2026-01-01', '2026-06-01', '2026-01-15');
    expect(r.isViolated).toBe(false);
  });

  it('isViolated is true when today is after binding deadline', () => {
    const r = computeLvDeterminationDeadlines('2026-01-01', '2026-06-01', '2026-02-15');
    expect(r.isViolated).toBe(true);
  });

  it('window is null when lvDeterminationDate is null — clock not yet open', () => {
    const r = computeLvDeterminationDeadlines(null, '2026-06-01');
    expect(r.clockA_30DaysAfterLvDetermination).toBeNull();
    expect(r.clockB_90DaysBeforeIntegration).toBe('2026-03-03');
    expect(r.bindingDeadline).toBeNull();
    expect(r.isViolated).toBe(false);
  });

  it('window is null when integrationDate is null', () => {
    const r = computeLvDeterminationDeadlines('2026-01-01', null);
    expect(r.clockA_30DaysAfterLvDetermination).toBe('2026-01-31');
    expect(r.clockB_90DaysBeforeIntegration).toBeNull();
    expect(r.bindingDeadline).toBeNull();
  });

  // Edge case: clock B is tighter than clock A
  // LV det: 2026-01-01, integration: 2026-02-01
  // Clock A: 2026-01-31
  // Clock B: 90 days before 2026-02-01 = 2026-11-03 of PREVIOUS year = 2025-11-03
  // Clock B (2025-11-03) is earlier — it is already violated if LV det is 2026-01-01
  it('binding deadline is clock B when clock B is tighter', () => {
    const r = computeLvDeterminationDeadlines('2026-01-01', '2026-02-01');
    expect(r.clockB_90DaysBeforeIntegration).toBe('2025-11-03');
    expect(r.bindingDeadline).toBe('2025-11-03');
  });

  it('isViolated is true when binding deadline is already past (clock B before LV det)', () => {
    // Integration is so soon that 90-days-before was already in the past
    // when LV determination was made
    const r = computeLvDeterminationDeadlines(
      '2026-01-01',
      '2026-02-01',
      '2026-01-15', // today — after 2025-11-03 binding deadline
    );
    expect(r.isViolated).toBe(true);
  });
});
