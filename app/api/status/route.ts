// app/api/status/route.ts
// Task 2.17 -- unauthenticated status endpoint.
//
// Returns the headline number (total violated-deadline days) recomputed from
// the GT-1 seed mission on every request. Also self-reports the model IDs
// actually invoked in this deployment so claimed-versus-invoked is checkable
// by one curl.
//
// Claimed-versus-running drift is the failure mode this endpoint closes:
// it self-reports what the README says, and CI asserts the two match.
//
// No authentication. No credentials. No external network calls.
// Authority: PLAN.md task 2.17, PLAN.md Shared Contracts /api/status response.

import { NextResponse } from 'next/server';
import { buildGraph } from '../../../engine/graph';
import { computeCriticalPath } from '../../../engine/critical-path';
import { computeDeorbitCompliance } from '../../../engine/interlocks/deorbit-compliance';
import type { MissionInput } from '../../../engine/types';

// ---------------------------------------------------------------------------
// Seed mission: GT-1 (Georgia Tech SSDL)
// Source: SmallSat 2021, SSC21-P2-48, DOI 10.26077/s4a1-qn29
// "Originally slated to be designed, built, and delivered in nine months" --
// actual mission took over two years.
//
// Dates: ESTIMATED from the published schedule narrative where not recoverable
// from public records. Marked ESTIMATED per D5.
//
// This inline seed is the fallback until data/missions/gt-1.json lands
// in task 2.16 (Tylin). When 2.16 ships, this file reads from that JSON.
// ---------------------------------------------------------------------------

// GT-1 mission PROFILE (3U, 550 km circular, amateur 437.5 MHz) re-based onto
// a live delivery date, because the planner's question is "standing at today,
// licensing not yet started, which deadlines are already dead." GT-1's own
// paper documents the shape of this scenario: a nine month plan that became
// two-plus years with the FCC license nearly missing the launch window.
// Every date below is ESTIMATED (D5) with that documented profile as basis.
// Replaced by data/missions/gt-1.json when task 2.16 lands.
const GT1_MISSION: MissionInput = {
  // ESTIMATED: launch 45 days after delivery per typical rideshare cadence
  launchDate: '2027-01-15',
  // ESTIMATED: live-frame delivery wall, ~3.5 months from mid-August 2026
  deliveryDate: '2026-12-01',
  // ESTIMATED: LV determination entered two weeks ago, the demo's entry event
  lvDeterminationDate: '2026-08-01',
  // ESTIMATED: integration start 6 weeks before delivery
  integrationDate: '2026-10-15',
  pathway: 'part-97-amateur',
  frequencyMHz: 437.5,
  imagingEarth: false,
  // 3U CubeSat at 550 km circular -- the headline differentiator orbit
  apogeeKm: 550,
  perigeeKm: 550,
  // ESTIMATED: 3U CubeSat Bc approx 180 kg/m^2 (mass ~4 kg, area ~0.03 m^2, Cd ~2.2)
  ballisticCoefficient: 180,
};

// ---------------------------------------------------------------------------
// Model inventory -- self-report what is actually wired
// "null" means cut (D7 for Surya, fallback for watsonx).
// These values must match what the README's AI Approach section claims.
// CI asserts the two match in tests/test_no_fabricated_numbers.py (task 2.18).
// ---------------------------------------------------------------------------

const MODEL_INVENTORY = {
  generation: 'ibm/granite-4-h-small',        // watsonx.ai, app/api/ask/route.ts (Tylin 2.6)
  audit: 'ibm/granite-guardian-3-8b',          // watsonx.ai, app/api/ask/route.ts (Tylin 2.6)
  embedding: 'ibm/granite-embedding-278m-multilingual', // watsonx.ai (Tylin 1.3)
  surya: 'nasa-ibm-ai4science/Surya-1.0',      // D7 cached artifact at data/surya-outlook.json
  local_fallback: 'granite4.1:8b',              // Ollama -- rehearsal only, not production path
} as const;

// ---------------------------------------------------------------------------
// GET /api/status
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  const t0 = Date.now();

  // 1. Build the graph for the GT-1 seed mission
  const { nodes, edges } = buildGraph(GT1_MISSION);

  // 2. Apply deorbit compliance verdict (the innovation node)
  //    Uses the decay table at data/decay-table.json (static import in deorbit-compliance.ts).
  //    No F10.7 override here -- nominal table value. Live solar is a bonus path (2.8).
  const deorbitResult = computeDeorbitCompliance(
    GT1_MISSION.perigeeKm,
    GT1_MISSION.ballisticCoefficient,
  );

  // Inject the computed verdict into the deorbit-compliance node
  const deorbitNode = nodes.get('deorbit-compliance');
  if (deorbitNode) {
    nodes.set('deorbit-compliance', {
      ...deorbitNode,
      verdict: deorbitResult.verdict,
    });
  }

  // 3. Compute critical path
  const today = new Date().toISOString().split('T')[0];
  // Project start is TODAY: no licensing work has been filed yet, and work
  // cannot start in the past. Anchoring the forward pass three years back
  // made every schedule feasible and the violated-days headline permanently
  // zero, which PLAN.md's own order-of-magnitude check calls an engine error.
  const result = computeCriticalPath(
    nodes,
    edges,
    GT1_MISSION.deliveryDate,
    today,
    today,
  );

  // 4. Count violated nodes and find the binding overrun.
  //    The headline is the WORST single overrun (how many days past feasible
  //    the binding chain already is). Summing every node's float counts one
  //    slip once per downstream node and inflates a 151-day overrun into
  //    four figures, which fails PLAN.md's order-of-magnitude check.
  const violatedNodes: string[] = [];
  const atRiskNodes: string[] = [];
  let worstViolationDays = 0;
  for (const [id, node] of result.nodes) {
    if (node.verdict === 'VIOLATED') {
      violatedNodes.push(id);
      worstViolationDays = Math.max(worstViolationDays, Math.abs(node.float ?? 0));
    }
    if (node.verdict === 'AT_RISK') atRiskNodes.push(id);
  }

  // 5. Deorbit swing -- the differentiator numbers
  //    Same orbit: solar min vs solar max, from the decay table.
  const deorbitSwing = {
    perigeeKm: GT1_MISSION.perigeeKm,
    ballisticCoefficient: GT1_MISSION.ballisticCoefficient,
    lifetimeYears_nominal: deorbitResult.lifetimeYears,
    lifetimeYears_solar_min: deorbitResult.lifetimeYearsLow,
    lifetimeYears_solar_max: deorbitResult.lifetimeYearsHigh,
    fcc_limit_years: deorbitResult.fccLimitYears,
    verdict_nominal: deorbitResult.verdict,
    verdict_solar_min: deorbitResult.lifetimeYearsLow > deorbitResult.fccLimitYears
      ? 'VIOLATED'
      : 'OK',
    verdict_solar_max: deorbitResult.lifetimeYearsHigh <= deorbitResult.fccLimitYears
      ? 'OK'
      : 'AT_RISK',
    note: 'Same orbit, opposite verdict -- solar cycle decides. Authority: 47 CFR 25.283(e), FCC 22-74.',
  };

  const responseMs = Date.now() - t0;

  return NextResponse.json({
    // Headline number: days by which the binding deadline chain is already
    // past feasible (worst single overrun among VIOLATED nodes).
    deadline_violations_days: worstViolationDays,
    // Cascade sum across all violated nodes, kept for transparency. One slip
    // propagates to every downstream node, so this is NOT days-of-lateness.
    violated_day_sum_all_nodes: result.totalViolatedDays,

    // Critical path summary
    critical_path: result.criticalPath,
    violated_nodes: violatedNodes,
    at_risk_nodes: atRiskNodes,
    node_count: result.nodes.size,
    compute_ms: result.computeMs,
    response_ms: responseMs,

    // Deorbit compliance -- the differentiator
    deorbit_compliance: {
      verdict: deorbitResult.verdict,
      lifetime_years: deorbitResult.lifetimeYears,
      fcc_limit_years: deorbitResult.fccLimitYears,
      method: deorbitResult.method,
      citation: '47 CFR 25.283(e), FCC 22-74 (2022)',
    },
    deorbit_swing: deorbitSwing,

    // Seed mission used for this computation
    seed_mission: {
      id: 'gt-1',
      name: 'GT-1 (Georgia Tech SSDL)',
      source: 'SmallSat 2021 SSC21-P2-48, DOI 10.26077/s4a1-qn29',
      perigeeKm: GT1_MISSION.perigeeKm,
      pathway: GT1_MISSION.pathway,
    },

    // Model inventory: self-report what is actually wired
    // CI asserts this matches the README (test_no_fabricated_numbers.py, task 2.18)
    models: MODEL_INVENTORY,

    // Corpus snapshot AMDDATE -- populated when Tylin's 1.1 corpus lands
    corpus_amddate: 'PENDING_CORPUS_FREEZE',

    // Timestamps
    computed_at: new Date().toISOString(),
    today,
  });
}
