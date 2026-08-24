// mobile/__tests__/schedule.test.ts
// Task 2.13: deadline-alert scheduling, pure logic.

import { describe, it, expect } from 'vitest';
import type { MissionInput } from '../../engine/types';
import {
  buildDeadlineAlerts,
  capToPendingLimit,
  IOS_PENDING_LIMIT,
  type DeadlineAlert,
} from '../schedule';

const TODAY = '2026-08-24';

const BASE_INPUT: MissionInput = {
  launchDate: '2027-06-01',
  deliveryDate: '2027-05-01',
  lvDeterminationDate: '2026-09-01',
  integrationDate: '2027-04-01',
  pathway: 'part-97-amateur',
  frequencyMHz: 437.5,
  imagingEarth: false,
  apogeeKm: 500,
  perigeeKm: 480,
  ballisticCoefficient: 50,
};

describe('buildDeadlineAlerts', () => {
  it('produces only future alerts, sorted ascending, with unique integer ids', () => {
    const alerts = buildDeadlineAlerts(BASE_INPUT, TODAY);
    expect(alerts.length).toBeGreaterThan(0);
    for (const a of alerts) {
      expect(a.at > TODAY).toBe(true);
      expect(Number.isInteger(a.id)).toBe(true);
    }
    const sorted = [...alerts].sort((a, b) => (a.at < b.at ? -1 : 1));
    expect(alerts.map((a) => a.at)).toEqual(sorted.map((a) => a.at));
    expect(new Set(alerts.map((a) => a.id)).size).toBe(alerts.length);
  });

  it('fires 7 days before, 1 day before, and on the delivery deadline', () => {
    const alerts = buildDeadlineAlerts(BASE_INPUT, TODAY);
    const delivery = alerts.filter((a) => a.title === 'Delivery deadline');
    const days = delivery.map((a) => a.at.split('T')[0]).sort();
    expect(days).toEqual(['2027-04-24', '2027-04-30', '2027-05-01']);
  });

  it('drops alert instants that are already past', () => {
    // Delivery 3 days out: the 7-days-before alert is in the past and must
    // not appear. Day-before and day-of remain.
    const near: MissionInput = {
      ...BASE_INPUT,
      deliveryDate: '2026-08-27',
      integrationDate: '2026-08-26',
    };
    const alerts = buildDeadlineAlerts(near, TODAY);
    for (const a of alerts) {
      expect(a.at > TODAY).toBe(true);
    }
    const delivery = alerts.filter((a) => a.title === 'Delivery deadline');
    expect(delivery.map((a) => a.at.split('T')[0]).sort()).toEqual([
      '2026-08-26',
      '2026-08-27',
    ]);
  });

  it('alerts fire at 09:00 local', () => {
    const alerts = buildDeadlineAlerts(BASE_INPUT, TODAY);
    for (const a of alerts) {
      expect(a.at.endsWith('T09:00:00')).toBe(true);
    }
  });
});

describe('capToPendingLimit', () => {
  it('keeps only the soonest 64 alerts (iOS pending-request limit)', () => {
    const many: DeadlineAlert[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      title: 't',
      body: 'b',
      at: `2027-01-${String((i % 28) + 1).padStart(2, '0')}T09:00:00`,
    })).sort((a, b) => (a.at < b.at ? -1 : 1));
    const capped = capToPendingLimit(many);
    expect(capped.length).toBe(IOS_PENDING_LIMIT);
    expect(capped[0].at <= capped[capped.length - 1].at).toBe(true);
    expect(capped.map((a) => a.at)).toEqual(
      many.slice(0, IOS_PENDING_LIMIT).map((a) => a.at),
    );
  });
});
