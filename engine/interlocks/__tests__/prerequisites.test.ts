// engine/interlocks/__tests__/prerequisites.test.ts
// Interlocks 4 and 5 — plain graph edge prerequisites.
// Interlock 4: IARU coordination letter precedes Part 97 pathway
// Interlock 5: ITU API filing precedes FCC grant
// Per PLAN.md task 1.16 and CLAUDE.md section 4 interlocks 3-5.

import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../graph';
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

describe('interlock 4 — IARU letter precedes Part 97 pathway', () => {
  it('iaru-letter -> fcc-application-prepared edge exists for Part 97', () => {
    const { edges } = buildGraph({ ...BASE_INPUT, pathway: 'part-97-amateur' });
    const edge = edges.find(
      (e) => e.from === 'iaru-letter' && e.to === 'fcc-application-prepared',
    );
    expect(edge).toBeDefined();
  });

  it('iaru-request -> iaru-letter edge exists for Part 97', () => {
    const { edges } = buildGraph({ ...BASE_INPUT, pathway: 'part-97-amateur' });
    const edge = edges.find(
      (e) => e.from === 'iaru-request' && e.to === 'iaru-letter',
    );
    expect(edge).toBeDefined();
  });

  it('iaru-request node present for Part 97 pathway', () => {
    const { nodes } = buildGraph({ ...BASE_INPUT, pathway: 'part-97-amateur' });
    expect(nodes.has('iaru-request')).toBe(true);
  });
});

describe('interlock 5 — ITU API filing precedes FCC grant', () => {
  it('itu-api-published -> fcc-application-prepared edge exists', () => {
    const { edges } = buildGraph(BASE_INPUT);
    const edge = edges.find(
      (e) =>
        e.from === 'itu-api-published' && e.to === 'fcc-application-prepared',
    );
    expect(edge).toBeDefined();
  });

  it('itu-api-filed -> itu-api-published edge exists', () => {
    const { edges } = buildGraph(BASE_INPUT);
    const edge = edges.find(
      (e) => e.from === 'itu-api-filed' && e.to === 'itu-api-published',
    );
    expect(edge).toBeDefined();
  });

  it('itu-api-published has a documented 2-3 month duration', () => {
    const { nodes } = buildGraph(BASE_INPUT);
    const node = nodes.get('itu-api-published');
    // 60-90 days is the acceptable range for 2-3 months
    expect(node?.durationDays).toBeGreaterThanOrEqual(60);
    expect(node?.durationDays).toBeLessThanOrEqual(90);
  });
});

describe('interlock 6 — delivery is the terminal wall', () => {
  it('fcc-grant -> delivery edge exists', () => {
    const { edges } = buildGraph(BASE_INPUT);
    const edge = edges.find(
      (e) => e.from === 'fcc-grant' && e.to === 'delivery',
    );
    expect(edge).toBeDefined();
  });

  it('delivery node has no outgoing edges', () => {
    const { edges, nodes } = buildGraph(BASE_INPUT);
    const outgoing = edges.filter((e) => e.from === 'delivery');
    expect(outgoing).toHaveLength(0);
    expect(nodes.has('delivery')).toBe(true);
  });

  it('delivery is the only terminal node (no outgoing edges)', () => {
    const { edges, nodes } = buildGraph(BASE_INPUT);
    const hasOutgoing = new Set(edges.map((e) => e.from));
    const terminals = Array.from(nodes.keys()).filter(
      (id) => !hasOutgoing.has(id),
    );
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe('delivery');
  });

  it('delivery latenessConsequence mentions demanifest', () => {
    const { nodes } = buildGraph(BASE_INPUT);
    const node = nodes.get('delivery');
    expect(node?.latenessConsequence.toLowerCase()).toContain('demanifest');
  });
});
