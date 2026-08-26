// engine/__tests__/pathway-graph.test.ts
//
// Every pathway must produce a graph the critical-path solver can actually
// solve. This was NOT true: `iaru-request` and `iaru-letter` were emitted on
// every pathway while the edge joining them was added only for Part 97, so a
// Part 5 or Part 25 mission left `iaru-request` dangling with no successor,
// the graph had two terminal nodes, and computeCriticalPath threw.
//
// The mission form lets a judge choose the pathway, so this was reachable
// from the product, not just from a test. It survived because the GT-1 seed
// mission is Part 97 and every fixture followed it.
//
// The NOAA nodes were already conditional on imagingEarth. The IARU nodes
// simply were not conditional on pathway, which is the inconsistency.

import { describe, expect, it } from 'vitest';
import { buildGraph } from '../graph';
import { computeCriticalPath } from '../critical-path';
import type { MissionInput, Pathway } from '../types';

const base: MissionInput = {
  launchDate: '2027-09-15',
  deliveryDate: '2027-07-15',
  lvDeterminationDate: '2026-10-01',
  integrationDate: '2027-08-01',
  pathway: 'part-97-amateur',
  frequencyMHz: 437.525,
  imagingEarth: false,
  apogeeKm: 500,
  perigeeKm: 500,
  ballisticCoefficient: 150,
};

const PATHWAYS: Pathway[] = ['part-97-amateur', 'part-5-experimental', 'part-25'];

function terminals(mission: MissionInput): string[] {
  const { nodes, edges } = buildGraph(mission);
  const hasOutgoing = new Set(edges.map((e) => e.from));
  return [...nodes.keys()].filter((id) => !hasOutgoing.has(id));
}

describe('every pathway yields a solvable graph', () => {
  it.each(PATHWAYS)('%s has exactly one terminal node', (pathway) => {
    expect(terminals({ ...base, pathway })).toEqual(['delivery']);
  });

  it.each(PATHWAYS)('%s computes a critical path without throwing', (pathway) => {
    const mission = { ...base, pathway };
    const { nodes, edges } = buildGraph(mission);
    expect(() =>
      computeCriticalPath(nodes, edges, mission.deliveryDate, '2026-08-25', '2026-08-25'),
    ).not.toThrow();
  });

  it.each(PATHWAYS)('%s leaves no node stranded without a predecessor or successor', (pathway) => {
    const { nodes, edges } = buildGraph({ ...base, pathway });
    const connected = new Set<string>();
    for (const e of edges) {
      connected.add(e.from);
      connected.add(e.to);
    }
    const stranded = [...nodes.keys()].filter((id) => !connected.has(id));
    expect(stranded).toEqual([]);
  });
});

describe('IARU coordination belongs to the amateur pathway only', () => {
  it('Part 97 includes the IARU chain', () => {
    const { nodes } = buildGraph({ ...base, pathway: 'part-97-amateur' });
    expect(nodes.has('iaru-request')).toBe(true);
    expect(nodes.has('iaru-letter')).toBe(true);
  });

  it.each(['part-5-experimental', 'part-25'] as Pathway[])(
    '%s omits the IARU chain rather than orphaning it',
    (pathway) => {
      const { nodes } = buildGraph({ ...base, pathway });
      expect(nodes.has('iaru-request')).toBe(false);
      expect(nodes.has('iaru-letter')).toBe(false);
    },
  );
});

describe('imaging still pulls NOAA in front of FCC grant, on every pathway', () => {
  it.each(PATHWAYS)('%s with imaging includes the NOAA chain', (pathway) => {
    const { nodes, edges } = buildGraph({ ...base, pathway, imagingEarth: true });
    expect(nodes.has('noaa-crsra-license')).toBe(true);
    expect(edges).toContainEqual({ from: 'noaa-crsra-license', to: 'fcc-grant' });
    expect(terminals({ ...base, pathway, imagingEarth: true })).toEqual(['delivery']);
  });
});
