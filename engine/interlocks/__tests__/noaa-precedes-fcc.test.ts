// engine/interlocks/__tests__/noaa-precedes-fcc.test.ts
// Interlock 2: if the mission images Earth, the NOAA CRSRA license node
// becomes a hard prerequisite of FCC grant.
// Test first — per PLAN.md task 1.9 and CLAUDE.md section 4 interlock 2.

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

describe('interlock 2 — FCC waits for NOAA (imaging missions)', () => {
  it('NOAA nodes are ABSENT when imagingEarth is false', () => {
    const { nodes, edges } = buildGraph({ ...BASE_INPUT, imagingEarth: false });

    expect(nodes.has('noaa-crsra-application')).toBe(false);
    expect(nodes.has('noaa-crsra-license')).toBe(false);
  });

  it('NOAA nodes are PRESENT when imagingEarth is true', () => {
    const { nodes } = buildGraph({ ...BASE_INPUT, imagingEarth: true });

    expect(nodes.has('noaa-crsra-application')).toBe(true);
    expect(nodes.has('noaa-crsra-license')).toBe(true);
  });

  it('noaa-crsra-license is a predecessor of fcc-grant when imagingEarth is true', () => {
    const { edges } = buildGraph({ ...BASE_INPUT, imagingEarth: true });

    const noaaToFcc = edges.find(
      (e) => e.from === 'noaa-crsra-license' && e.to === 'fcc-grant',
    );
    expect(noaaToFcc).toBeDefined();
  });

  it('no edge from noaa-crsra-license to fcc-grant when imagingEarth is false', () => {
    const { edges } = buildGraph({ ...BASE_INPUT, imagingEarth: false });

    const noaaToFcc = edges.find(
      (e) => e.from === 'noaa-crsra-license' && e.to === 'fcc-grant',
    );
    expect(noaaToFcc).toBeUndefined();
  });

  it('NOAA CRSRA license node has 60-day duration (15 CFR 960.8 statutory clock)', () => {
    const { nodes } = buildGraph({ ...BASE_INPUT, imagingEarth: true });
    const noaaLicense = nodes.get('noaa-crsra-license');

    expect(noaaLicense?.durationDays).toBe(60);
    expect(noaaLicense?.durationBasis).toBe('DOCUMENTED');
  });

  it('NOAA CRSRA application node has zero duration (point-in-time submission)', () => {
    const { nodes } = buildGraph({ ...BASE_INPUT, imagingEarth: true });
    const noaaApp = nodes.get('noaa-crsra-application');

    expect(noaaApp?.durationDays).toBe(0);
  });

  it('fcc-grant is on critical path and comes after noaa-crsra-license for imaging missions', () => {
    const { nodes, edges } = buildGraph({ ...BASE_INPUT, imagingEarth: true });

    // noaa-crsra-application -> noaa-crsra-license -> fcc-grant chain must exist
    const appToLicense = edges.find(
      (e) => e.from === 'noaa-crsra-application' && e.to === 'noaa-crsra-license',
    );
    const licenseToFcc = edges.find(
      (e) => e.from === 'noaa-crsra-license' && e.to === 'fcc-grant',
    );

    expect(appToLicense).toBeDefined();
    expect(licenseToFcc).toBeDefined();
  });

  it('graph has one terminal node (delivery) regardless of imagingEarth', () => {
    const withImaging = buildGraph({ ...BASE_INPUT, imagingEarth: true });
    const withoutImaging = buildGraph({ ...BASE_INPUT, imagingEarth: false });

    const hasOutgoingWith = new Set(withImaging.edges.map((e) => e.from));
    const terminalsWith = Array.from(withImaging.nodes.keys()).filter(
      (id) => !hasOutgoingWith.has(id),
    );

    const hasOutgoingWithout = new Set(withoutImaging.edges.map((e) => e.from));
    const terminalsWithout = Array.from(withoutImaging.nodes.keys()).filter(
      (id) => !hasOutgoingWithout.has(id),
    );

    expect(terminalsWith).toHaveLength(1);
    expect(terminalsWith[0]).toBe('delivery');
    expect(terminalsWithout).toHaveLength(1);
    expect(terminalsWithout[0]).toBe('delivery');
  });
});
