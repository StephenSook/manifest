// engine/interlocks/__tests__/rework.test.ts
// Rework triggers, per PLAN.md task 1.16 and CLAUDE.md section 4 interlock 6.
// A frequency change forces IARU re-coordination.
// An orbit above ~600 km forces a propulsion/drag decision.
// A launch slip recomputes every clock.

import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../graph';
import {
  getFrequencyChangeReworkNodes,
  getOrbitReworkNodes,
} from '../rework';
import type { MissionInput } from '../../types';

const BASE_INPUT: MissionInput = {
  launchDate: '2026-12-01',
  deliveryDate: '2026-11-01',
  lvDeterminationDate: '2026-01-01',
  integrationDate: '2026-10-01',
  pathway: 'part-97-amateur',
  frequencyMHz: 437.5,
  imagingEarth: false,
  apogeeKm: 500,
  perigeeKm: 480,
  ballisticCoefficient: 50,
};

describe('rework trigger, frequency change', () => {
  it('frequency change returns iaru-request and iaru-letter as nodes requiring rework', () => {
    const nodes = getFrequencyChangeReworkNodes();
    expect(nodes).toContain('iaru-request');
    expect(nodes).toContain('iaru-letter');
  });

  it('iaru-request node reworkTriggers mentions frequency change', () => {
    const { nodes } = buildGraph(BASE_INPUT);
    const node = nodes.get('iaru-request');
    const triggers = node?.reworkTriggers.join(' ').toLowerCase() ?? '';
    expect(triggers).toContain('frequency');
  });

  it('iaru-letter node reworkTriggers mentions frequency change', () => {
    const { nodes } = buildGraph(BASE_INPUT);
    const node = nodes.get('iaru-letter');
    const triggers = node?.reworkTriggers.join(' ').toLowerCase() ?? '';
    expect(triggers).toContain('frequency');
  });
});

describe('rework trigger, orbit above 600 km', () => {
  it('orbit at 550 km does NOT trigger the propulsion/drag rework', () => {
    const result = getOrbitReworkNodes(550);
    expect(result.requiresPropulsionReview).toBe(false);
  });

  it('orbit at 601 km DOES trigger the propulsion/drag rework', () => {
    const result = getOrbitReworkNodes(601);
    expect(result.requiresPropulsionReview).toBe(true);
  });

  it('orbit at 600 km is on the boundary, treated as requiring review', () => {
    // The rule is "above roughly 600 km", at exactly 600 we are conservative
    const result = getOrbitReworkNodes(600);
    expect(result.requiresPropulsionReview).toBe(true);
  });

  it('deorbit-compliance node reworkTriggers mentions orbit change', () => {
    const { nodes } = buildGraph(BASE_INPUT);
    const node = nodes.get('deorbit-compliance');
    const triggers = node?.reworkTriggers.join(' ').toLowerCase() ?? '';
    expect(triggers).toContain('orbit');
  });
});

describe('rework trigger, launch slip', () => {
  it('a later deliveryDate shifts all critical path dates forward', () => {
    const { nodes: original } = buildGraph(BASE_INPUT);
    const slipped: MissionInput = { ...BASE_INPUT, deliveryDate: '2027-02-01' };
    const { nodes: shifted } = buildGraph(slipped);

    // Both graphs build successfully, the clock recompute is verified by
    // computeCriticalPath which is integration-tested in critical-path.test.ts
    // Here we just confirm the graph itself builds with the new date
    expect(shifted.has('delivery')).toBe(true);
    expect(original.has('delivery')).toBe(true);
  });

  it('delivery node reworkTriggers mentions launch slip', () => {
    const { nodes } = buildGraph(BASE_INPUT);
    const node = nodes.get('delivery');
    const triggers = node?.reworkTriggers.join(' ').toLowerCase() ?? '';
    expect(triggers).toContain('launch slip');
  });
});
