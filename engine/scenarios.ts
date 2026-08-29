// engine/scenarios.ts
//
// Named scenario stories, computed at request time by the real engine.
//
// WHY THIS EXISTS. The strongest design for this is not a "demo mode"
// toggle, it is a set of NAMED stories a judge clicks, each
// ending somewhere different, so the range of the engine is visible in about
// a minute without typing anything. It also makes an empty state impossible,
// which is the single most common way a judge's first screen wastes itself.
//
// Two rules hold this honest.
//
// Nothing here is a stored answer. Each scenario is a real `MissionInput` run
// through `buildGraph`, `computeCriticalPath` and `computeDeorbitCompliance`
// on every call. A judge who changes the decay table sees these move.
//
// The outcomes must DIFFER. Buttons that all produce the same verdict read as
// one hardcoded result and cost the credibility of the one that matters, so
// `engine/__tests__/scenarios.test.ts` asserts distinctness rather than
// merely asserting that each one runs.

import scenarioData from '../data/scenarios.json';
import { buildGraph } from './graph';
import { computeCriticalPath } from './critical-path';
import { computeDeorbitCompliance } from './interlocks/deorbit-compliance';
import type { MissionInput } from './types';

export interface Scenario {
  id: string;
  name: string;
  /** The one line a judge reads before clicking. */
  demonstrates: string;
  /** Which engine interlock this story exercises. */
  interlock: string;
  mission: MissionInput;
}

export interface ScenarioOutcome {
  id: string;
  name: string;
  demonstrates: string;
  interlock: string;
  /** One sentence stating what actually happened, for a reader in a hurry. */
  headline: string;
  violated_days: number;
  violated_node_count: number;
  critical_path: string[];
  deorbit: {
    verdict: string;
    lifetime_years: number | null;
    fcc_limit_years: number;
  };
  imaging_earth: boolean;
  lv_determined: boolean;
  perigee_km: number;
  compute_ms: number;
}

/** The committed scenario set. */
export function loadScenarios(): Scenario[] {
  return (scenarioData as { scenarios: Scenario[] }).scenarios;
}

/**
 * Run one scenario through the real engine.
 *
 * `today` is injected rather than read from the clock so the outcome is
 * deterministic and a test can pin it. A demo whose numbers drift with the
 * wall clock cannot be asserted, and an unassertable demo is one nobody
 * notices breaking.
 */
export function runScenario(scenario: Scenario, today: string): ScenarioOutcome {
  const t0 = Date.now();
  const mission = scenario.mission;

  const { nodes, edges } = buildGraph(mission);
  const result = computeCriticalPath(
    nodes,
    edges,
    mission.deliveryDate,
    today,
    today,
  );

  const deorbit = computeDeorbitCompliance(
    mission.perigeeKm,
    mission.ballisticCoefficient,
  );

  const violatedNodes = [...result.nodes.values()].filter(
    (n) => n.verdict === 'VIOLATED',
  );

  return {
    id: scenario.id,
    name: scenario.name,
    demonstrates: scenario.demonstrates,
    interlock: scenario.interlock,
    headline: buildHeadline(scenario, violatedNodes.length, result.totalViolatedDays, deorbit.verdict),
    violated_days: result.totalViolatedDays,
    violated_node_count: violatedNodes.length,
    critical_path: result.criticalPath,
    deorbit: {
      verdict: deorbit.verdict,
      lifetime_years: deorbit.lifetimeYears ?? null,
      fcc_limit_years: deorbit.fccLimitYears,
    },
    imaging_earth: mission.imagingEarth,
    lv_determined: mission.lvDeterminationDate !== null,
    perigee_km: mission.perigeeKm,
    compute_ms: Date.now() - t0,
  };
}

export function runAllScenarios(
  scenarios: Scenario[],
  today: string,
): ScenarioOutcome[] {
  return scenarios.map((s) => runScenario(s, today));
}

/**
 * One sentence naming the outcome. Assembled from computed values only, so it
 * cannot drift from the numbers beside it: a summary written by hand is a
 * claim, and this file would then need a guard of its own.
 */
function buildHeadline(
  scenario: Scenario,
  violatedNodes: number,
  violatedDays: number,
  deorbitVerdict: string,
): string {
  const disposal =
    deorbitVerdict === 'OK'
      ? 'reenters inside the FCC five-year limit'
      : deorbitVerdict === 'VIOLATED'
        ? 'exceeds the FCC five-year disposal limit'
        : 'is at risk against the FCC five-year disposal limit';

  const schedule =
    violatedNodes === 0
      ? 'and no regulatory deadline is violated'
      : `and ${violatedNodes} regulatory ${violatedNodes === 1 ? 'deadline is' : 'deadlines are'} violated by ${violatedDays} day${violatedDays === 1 ? '' : 's'} in total`;

  return `At ${scenario.mission.perigeeKm} km this mission ${disposal}, ${schedule}.`;
}
