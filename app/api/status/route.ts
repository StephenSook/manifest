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
// Task 2.16: the seed now reads from data/missions/gt-1.json (Tylin's
// seeded mission record, every field labelled ESTIMATED with basis per D5).
// One source of truth: the JSON carries the provenance and fieldBasis notes.
// ---------------------------------------------------------------------------

import gt1Seed from '../../../data/missions/gt-1.json';

const GT1_MISSION: MissionInput = {
  launchDate: gt1Seed.launchDate,
  deliveryDate: gt1Seed.deliveryDate,
  lvDeterminationDate: gt1Seed.lvDeterminationDate,
  integrationDate: gt1Seed.integrationDate,
  pathway: gt1Seed.pathway as MissionInput['pathway'],
  frequencyMHz: gt1Seed.frequencyMHz,
  imagingEarth: gt1Seed.imagingEarth,
  apogeeKm: gt1Seed.apogeeKm,
  perigeeKm: gt1Seed.perigeeKm,
  ballisticCoefficient: gt1Seed.ballisticCoefficient,
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

// Whether THIS deployment can actually reach watsonx. The model inventory above
// says what is configured; this says what can run (task 0.13 credentials).
const hasWatsonxCredentials = Boolean(
  process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID,
);

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
      id: gt1Seed.id,
      name: `${gt1Seed.name} (${gt1Seed.program})`,
      source: gt1Seed.source,
      perigeeKm: GT1_MISSION.perigeeKm,
      pathway: GT1_MISSION.pathway,
    },

    // Model inventory: the models this deployment is CONFIGURED to call.
    // CI asserts this matches the README (test_no_fabricated_numbers.py, task 2.18)
    models: MODEL_INVENTORY,

    // Runtime self-report: which path actually answers right now, as opposed to
    // which models are configured above. A judge can diff the two in one
    // request, so a claim that is not running cannot hide behind an inventory.
    runtime: {
      generation_backend: hasWatsonxCredentials
        ? 'watsonx'
        : 'offline-extractive',
      embedding_backend: hasWatsonxCredentials ? 'watsonx' : 'hashing-trick-768',
      guardian_audit: hasWatsonxCredentials ? 'active' : 'inactive',
      corpus_source: process.env.BLOB_READ_WRITE_TOKEN
        ? 'vercel-blob'
        : 'not-configured',
      note: hasWatsonxCredentials
        ? 'watsonx credentials present: generation, embedding and Guardian audit run on the models named above.'
        : 'watsonx credentials absent: answers come from the offline extractive path over the same corpus, cite-or-abstain still enforced, Guardian audit does not run.',
    },

    // Corpus snapshot AMDDATE -- populated when Tylin's 1.1 corpus lands
    corpus_amddate: 'PENDING_CORPUS_FREEZE',

    // Timestamps
    computed_at: new Date().toISOString(),
    today,
  });
}
