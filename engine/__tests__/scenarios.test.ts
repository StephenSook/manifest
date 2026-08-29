// engine/__tests__/scenarios.test.ts
//
// Named scenario stories: a set of NAMED stories a judge clicks, each ending somewhere
// different, so the engine's range is visible without typing anything.
//
// The property that makes it work is DISTINCTNESS. Eight buttons that all
// produce the same verdict teach a judge nothing and cost the credibility of
// the one that matters. So the suite asserts the outcomes actually differ,
// not merely that each one runs.

import { describe, expect, it } from 'vitest';
import { runScenario, runAllScenarios, loadScenarios } from '../scenarios';

const TODAY = '2026-08-25';

describe('loadScenarios', () => {
  it('ships a set of named scenarios', () => {
    const scenarios = loadScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(6);
  });

  it('gives every scenario a stable id, a name and a one-line claim', () => {
    for (const s of loadScenarios()) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.name.length).toBeGreaterThan(3);
      expect(s.demonstrates.length).toBeGreaterThan(20);
      expect(s.interlock.length).toBeGreaterThan(3);
    }
  });

  it('has no duplicate ids', () => {
    const ids = loadScenarios().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('runScenario', () => {
  it('returns a computed outcome, not a stored one', () => {
    const scenario = loadScenarios()[0];
    const outcome = runScenario(scenario, TODAY);
    expect(outcome.id).toBe(scenario.id);
    expect(typeof outcome.violated_days).toBe('number');
    expect(outcome.critical_path.length).toBeGreaterThan(0);
    expect(outcome.compute_ms).toBeGreaterThanOrEqual(0);
  });

  it('carries a deorbit verdict drawn from the engine', () => {
    const outcome = runScenario(loadScenarios()[0], TODAY);
    expect(['OK', 'AT_RISK', 'VIOLATED']).toContain(outcome.deorbit.verdict);
    expect(outcome.deorbit.fcc_limit_years).toBe(5);
  });

  it('states its result in one sentence a judge can read', () => {
    const outcome = runScenario(loadScenarios()[0], TODAY);
    expect(outcome.headline.length).toBeGreaterThan(25);
  });
});

describe('the scenario set covers the engine, which is the point', () => {
  const outcomes = runAllScenarios(loadScenarios(), TODAY);

  it('does not end every story in the same place', () => {
    // The failure mode this guards against: a demo where every button
    // produces the same answer, which reads as a single hardcoded result.
    const signatures = outcomes.map(
      (o) => `${o.deorbit.verdict}|${o.violated_node_count}|${o.violated_days}`,
    );
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(4);
  });

  it('produces at least one compliant and one violated deorbit verdict', () => {
    const verdicts = outcomes.map((o) => o.deorbit.verdict);
    expect(verdicts).toContain('OK');
    expect(verdicts).toContain('VIOLATED');
  });

  it('exercises more than one interlock across the set', () => {
    const interlocks = new Set(outcomes.map((o) => o.interlock));
    expect(interlocks.size).toBeGreaterThanOrEqual(4);
  });

  it('includes a scenario where imaging pulls NOAA in front of FCC grant', () => {
    const imaging = outcomes.find((o) => o.imaging_earth);
    expect(imaging).toBeDefined();
    expect(imaging!.critical_path).toContain('noaa-crsra-license');
  });

  it('includes a scenario with no launch-vehicle determination yet', () => {
    expect(outcomes.some((o) => o.lv_determined === false)).toBe(true);
  });

  it('is deterministic: the same input yields the same outcome', () => {
    const a = runAllScenarios(loadScenarios(), TODAY);
    const b = runAllScenarios(loadScenarios(), TODAY);
    expect(a.map((o) => o.headline)).toEqual(b.map((o) => o.headline));
  });
});

describe('a scenario may not lie about its own result', () => {
  // This guard exists because the first version of the set shipped a story
  // called "everything on time" whose demonstrates line said "nothing is
  // violated", while the engine computed 8 violated nodes and 160 violated
  // days. The prose was written before the numbers were measured, which is
  // the same drift this repo has been correcting all week, reproduced inside
  // the fix for it.
  const outcomes = runAllScenarios(loadScenarios(), TODAY);

  it('a claim of no violations must be true of the computed outcome', () => {
    for (const o of outcomes) {
      const claimsClean = /nothing is violated|no deadline is violated|clears every clock/i.test(
        o.demonstrates,
      );
      if (claimsClean) {
        expect(o.violated_node_count).toBe(0);
      }
    }
  });

  it('a claim about exceeding the five-year limit must match the verdict', () => {
    for (const o of outcomes) {
      if (/will not bring the satellite down inside five years|exceeds the/i.test(o.demonstrates)) {
        expect(o.deorbit.verdict).toBe('VIOLATED');
      }
    }
  });

  it('a scenario naming NOAA must actually put NOAA on the critical path', () => {
    for (const o of outcomes) {
      if (/NOAA/i.test(o.demonstrates)) {
        expect(o.critical_path).toContain('noaa-crsra-license');
      }
    }
  });
});
