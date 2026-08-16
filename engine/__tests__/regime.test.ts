// engine/__tests__/regime.test.ts
// Dual-regime layer test — per PLAN.md task 2.15.
// Done means: flipping the flag changes every Part 25 node's badge
// and changes nothing else.

import { describe, it, expect, afterEach } from 'vitest';
import {
  getRegimeBadge,
  applyRegimeFlag,
  PART_25_PENDING_BADGE,
  PART_100_ACTIVE_BADGE,
} from '../regime';
import { REGIME_FLAG } from '../types';
import { buildGraph } from '../graph';
import type { MissionInput } from '../types';

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

// Reset regime flag after each test to avoid cross-test contamination
afterEach(() => {
  REGIME_FLAG.part100Active = false;
});

describe('regime flag — getRegimeBadge', () => {
  it('returns PART_25_PENDING_BADGE for a Part 25 node when flag is false', () => {
    REGIME_FLAG.part100Active = false;
    const { nodes } = buildGraph({ ...BASE_INPUT, pathway: 'part-25' });
    const fccNode = nodes.get('fcc-grant')!;
    expect(fccNode.pendingPart100).toBe(true);
    expect(getRegimeBadge(fccNode)).toBe(PART_25_PENDING_BADGE);
  });

  it('returns PART_100_ACTIVE_BADGE for a Part 25 node when flag is true', () => {
    // Build the graph while Part 25 governs (flag false) so pendingPart100 is true,
    // then flip the flag — getRegimeBadge reads REGIME_FLAG at call time.
    REGIME_FLAG.part100Active = false;
    const { nodes } = buildGraph({ ...BASE_INPUT, pathway: 'part-25' });
    const fccNode = nodes.get('fcc-grant')!;
    expect(fccNode.pendingPart100).toBe(true); // built under Part 25

    REGIME_FLAG.part100Active = true; // now flip
    expect(getRegimeBadge(fccNode)).toBe(PART_100_ACTIVE_BADGE);
  });

  it('returns null for a node that is not pendingPart100', () => {
    const { nodes } = buildGraph(BASE_INPUT);
    const deliveryNode = nodes.get('delivery')!;
    expect(deliveryNode.pendingPart100).toBe(false);
    expect(getRegimeBadge(deliveryNode)).toBeNull();
  });
});

describe('regime flag — applyRegimeFlag', () => {
  it('flipping the flag changes Part 25 node badges and nothing else', () => {
    const { nodes } = buildGraph({ ...BASE_INPUT, pathway: 'part-25' });

    // Collect Part 25 nodes and non-Part-25 nodes
    const part25Ids = Array.from(nodes.values())
      .filter((n) => n.pendingPart100)
      .map((n) => n.id);
    const otherIds = Array.from(nodes.values())
      .filter((n) => !n.pendingPart100)
      .map((n) => n.id);

    expect(part25Ids.length).toBeGreaterThan(0);

    // Before flip: all Part 25 nodes show pending badge
    applyRegimeFlag(nodes, false);
    for (const id of part25Ids) {
      expect(getRegimeBadge(nodes.get(id)!)).toBe(PART_25_PENDING_BADGE);
    }

    // After flip: all Part 25 nodes show active badge
    applyRegimeFlag(nodes, true);
    for (const id of part25Ids) {
      expect(getRegimeBadge(nodes.get(id)!)).toBe(PART_100_ACTIVE_BADGE);
    }

    // Non-Part-25 nodes are unaffected in both states
    for (const id of otherIds) {
      expect(getRegimeBadge(nodes.get(id)!)).toBeNull();
    }
  });

  it('D3 copy string is present on REGIME_FLAG', () => {
    expect(REGIME_FLAG.part100CopyString).toContain('Part 100 was adopted July 22, 2026');
    expect(REGIME_FLAG.part100CopyString).toContain('effective date has not been announced');
    expect(REGIME_FLAG.part100CopyString).toContain('Part 25 remains binding today');
  });
});
