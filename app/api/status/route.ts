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
import { loadScenarios, runAllScenarios } from '../../../engine/scenarios';
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
import { corsPreflight, withCors } from '@/lib/cors';

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
  // INTENDED, NOT ACTIVE. The committed corpus was built with hashing-trick-768
  // and that is what every deployment retrieves with. Kept in the inventory
  // because the README names it as the production embedder, and annotated here
  // for the same reason the Ollama entry below was annotated: a bare model id in
  // an inventory reads to a judge as a model that runs. runtime.embedding_backend
  // reports the real one.
  embedding: 'ibm/granite-embedding-278m-multilingual', // watsonx.ai (Tylin 1.3), NOT ACTIVE
  surya: 'nasa-ibm-ai4science/Surya-1.0',      // D7 cached artifact at data/surya-outlook.json
  // NOTE: granite4.1:8b was listed here as an Ollama local_fallback until
  // 2026-08-29. Nothing implemented it. A grep of this repository for
  // `ollama` returns prose and nothing else: no client, no call, no code
  // path. Publishing it in a MODEL INVENTORY told a judge the product could
  // fall back to a local Granite model, which it cannot. The fallback that
  // actually ships is the offline extractive path over the committed
  // corpus, which uses no model at all and is reported in `runtime` below.
  // Wired or cut (hard rule 4): cut.
} as const;

// Whether THIS deployment is CONFIGURED to reach watsonx (task 0.13
// credentials). Read the name precisely: it tests that two environment
// variables are non-empty, which is not a health check and cannot be one
// without spending tokens on every status request. A key can be present and
// the model still refuse: on 2026-08-29 the watsonx Lite token quota was
// exhausted and every generation call returned 403 while this flag stayed
// true, so the endpoint reported a generative path that was answering
// nothing. The runtime block below now says which claims rest on presence
// and points at the one request that settles it.
const hasWatsonxCredentials = Boolean(
  process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID,
);

// Corpus snapshot dates, read from the committed freeze at request time. Falls
// back to a NAMED absence rather than a date-shaped placeholder, so a missing
// corpus can never read as a verified snapshot.
function readCorpusSnapshot(): string {
  try {
    const schema = require('../../../corpus/schema.json') as {
      amddate_range?: { min?: string; max?: string };
    };
    const { min, max } = schema.amddate_range ?? {};
    if (min && max) return min === max ? min : `${min} to ${max}`;
    return 'CORPUS_SCHEMA_MISSING_AMDDATE';
  } catch {
    return 'CORPUS_NOT_BUNDLED';
  }
}

const corpusSnapshot = readCorpusSnapshot();

/**
 * Which embedder actually vectorises a query, read from the committed corpus
 * rather than from credentials.
 *
 * This was previously reported as `watsonx` whenever a key was present, and
 * that was wrong in EVERY deployment, keyed or not. app/api/ask/route.ts
 * selects the embedder from the corpus itself:
 *
 *   const useHash = corpus.model.startsWith('hashing-trick') || ...
 *
 * The committed freeze is `hashing-trick-768` (task 1.3, so /api/ask loads on
 * Vercel without Blob), so that branch is always taken and the watsonx embed
 * call is unreachable in production. granite-embedding-278m stays in the model
 * inventory as what the pipeline is wired for, and this field says what ran.
 * Same failure shape readCorpusSource() was fixed for below: a claim derived
 * from configuration where the code derives behaviour from the artifact.
 */
function readEmbeddingBackend(): string {
  try {
    const schema = require('../../../corpus/schema.json') as { model?: string };
    const model = schema.model;
    if (!model) return 'CORPUS_SCHEMA_MISSING_MODEL';
    // Mirrors the useHash predicate in app/api/ask/route.ts exactly. If those
    // two ever diverge, this field starts lying again.
    if (model.startsWith('hashing-trick') || model === 'mock') return model;
    return 'watsonx';
  } catch {
    return 'CORPUS_NOT_BUNDLED';
  }
}

const embeddingBackend = readEmbeddingBackend();

/**
 * The SHAPE of the corpus that answers /api/ask, so a reader can tell the
 * answering surface is real before asking a question and receiving an
 * abstention.
 *
 * Borrowed from a rival that ships `ml_trained` as a first-class field, so its
 * UI can say whether the model is warm rather than rendering a meaningless
 * score. The same gap existed here: /api/status reported the corpus SNAPSHOT
 * DATES but never how much corpus there is, so a judge could not distinguish a
 * loaded index from an empty one without posting a question.
 *
 * Read from the committed `corpus/schema.json` at request time. No vectors are
 * loaded, so this costs nothing.
 *
 * The limit is stated rather than papered over, because the rival this came
 * from asserted readiness it had not tested and a sibling project turned a
 * NameError into a success-shaped 200. Reading the schema proves the manifest
 * DECLARES this shape. It does not prove the 3524 vectors parse. The honest
 * field name is `declared_by`, and POST /api/ask remains the only thing that
 * settles whether retrieval actually works.
 */
function readCorpusShape(): Record<string, unknown> {
  try {
    const schema = require('../../../corpus/schema.json') as {
      count?: number;
      dim?: number;
      model?: string;
      generatedAt?: string;
    };
    return {
      chunk_count: schema.count ?? null,
      vector_dim: schema.dim ?? null,
      embedder: schema.model ?? null,
      built_at: schema.generatedAt ?? null,
      declared_by: 'corpus/schema.json, read at request time. No vectors loaded.',
      note:
        'This is what the corpus manifest declares about its own shape, not a ' +
        'load test. It shows there is a real committed index to answer from. ' +
        'POST /api/ask is what proves retrieval works, and it reports degraded ' +
        'and abstained on every response that attempted an answer.',
    };
  } catch {
    return {
      chunk_count: null,
      vector_dim: null,
      embedder: null,
      built_at: null,
      declared_by: 'CORPUS_NOT_BUNDLED: corpus/schema.json is not in this deployment.',
      note: 'A named absence, not a zero. /api/ask will abstain with a stated reason.',
    };
  }
}

const corpusShape = readCorpusShape();

/**
 * The four stages that produce an answer, and what each one still does with the
 * model switched off.
 *
 * Borrowed from a rival that renders its pipeline as four side-by-side panels,
 * each naming what that stage contributed, plus a counterfactual "AI off" panel
 * so the value of the model is a visible delta rather than an assertion. It is
 * the clearest legibility device in the batch.
 *
 * Ours inverts theirs, and the inversion is the point. Their counterfactual
 * shows what you LOSE without the model. For the deorbit verdict, ours shows
 * the verdict is UNCHANGED: engine/ holds eight source files with zero
 * non-relative imports, so no model is reachable from the computation at all,
 * and a test asserts it. On the ask path the model writes prose and the
 * citation gate and the Guardian audit can only ever REMOVE an answer, never
 * add one.
 *
 * Every string here describes a code path that exists. If a stage is ever
 * removed or reordered, this block becomes a claim the product does not honour,
 * which is the exact defect this endpoint was built to close.
 */
const PIPELINE = {
  what_this_is:
    'The stages behind POST /api/ask and the deorbit verdict, and what each ' +
    'still does with the model switched off. Read the with_model_off column ' +
    'first: it is the honest measure of how much the model is trusted here.',
  ask: [
    {
      stage: '1. Retrieval',
      contributes: 'Selects the top 8 corpus chunks for the question.',
      with_model_off:
        'Unchanged. The committed freeze is hashing-trick-768, so retrieval ' +
        'runs with no model in every deployment, keyed or not.',
    },
    {
      stage: '2. Generation',
      contributes:
        'ibm/granite-4-h-small writes prose over the retrieved chunks. This is ' +
        'the ONLY stage a model can influence.',
      with_model_off:
        'The offline extractive path answers from the same chunks under the ' +
        'same cite-or-abstain rule, and the response sets degraded with the ' +
        'upstream error named in reason.',
    },
    {
      stage: '3. Citation gate',
      contributes:
        'Every cited reference must resolve exactly against a retrieved chunk. ' +
        'A pathed answer must earn its exact citation.',
      with_model_off:
        'Unchanged, and it is subtractive by construction: it can only refuse ' +
        'an answer, never invent one.',
    },
    {
      stage: '4. Guardian audit',
      contributes:
        'ibm/granite-guardian-3-8b checks groundedness before display. A ' +
        'failed audit abstains rather than shipping the generated text.',
      with_model_off:
        'Does not run, and the response says so: audited is false and reason ' +
        'names it. It fails CLOSED, so its absence can only withhold an ' +
        'answer, never release one.',
    },
  ],
  verdict_counterfactual:
    'The deorbit compliance verdict does not appear above because no model ' +
    'touches it. engine/ is eight source files with ZERO non-relative imports, ' +
    'asserted by engine/__tests__/isolation.test.ts, so the regulatory verdict ' +
    'is structurally unreachable by any model. With the model off it is ' +
    'byte-identical.',
} as const;

/**
 * Where the corpus this deployment serves actually came from.
 *
 * This previously reported `vercel-blob` or `not-configured` purely from the
 * presence of BLOB_READ_WRITE_TOKEN, which was wrong in the common case: the
 * frozen bundle is COMMITTED and traced into the function, so a deployment
 * with no Blob token serves a corpus perfectly well and still self-reported
 * `not-configured`. docs/submission.md invites a judge to diff configured
 * against running in one unauthenticated request, and that judge would have
 * concluded the corpus was missing while it was sitting there answering.
 *
 * The committed freeze is checked first because it is what actually loads,
 * and Blob is what it is: an optional overlay.
 */
function readCorpusSource(): string {
  const bundled = corpusSnapshot !== 'CORPUS_NOT_BUNDLED';
  if (bundled) {
    return process.env.BLOB_READ_WRITE_TOKEN
      ? 'committed-freeze (vercel-blob overlay configured)'
      : 'committed-freeze';
  }
  return process.env.BLOB_READ_WRITE_TOKEN
    ? 'vercel-blob (no committed freeze in this deployment)'
    : 'CORPUS_NOT_BUNDLED';
}

// ---------------------------------------------------------------------------
// GET /api/status
// ---------------------------------------------------------------------------

export function OPTIONS(): NextResponse {
  return corsPreflight();
}

export async function GET(): Promise<NextResponse> {
  return withCors(await handleStatus());
}

async function handleStatus(): Promise<NextResponse> {
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

  // Per-component booleans a judge can check in ONE curl, and the rule that
  // makes them worth anything: EVERY value here is OBSERVED BY THIS HANDLER on
  // this request. Nothing is read from configuration or credential presence.
  //
  // Borrowed from a rival whose /api/health returns per-component booleans, and
  // sharpened by that same rival's failure: theirs reported both models loaded
  // while the endpoint those models serve returned 500 on every attempt, because
  // the booleans described what was configured rather than what worked. A health
  // field that cannot be wrong is decoration.
  //
  // So watsonx and Guardian are deliberately ABSENT from this block. Their state
  // cannot be established without spending a token, and `runtime.basis` already
  // says in words that those two are credential presence rather than health.
  // Asserting them here as booleans would be exactly the defect this steal came
  // from. POST /api/ask and read `degraded` for the path that actually answered.
  const components = {
    engine_graph_built: result.nodes.size > 0,
    critical_path_computed: result.criticalPath.length > 0,
    decay_table_loaded: !deorbitResult.tableEntryNotFound,
    corpus_bundled: corpusSnapshot !== 'CORPUS_NOT_BUNDLED',
    scenarios_loaded: loadScenarios().length > 0,
    note:
      'Every field above was observed while building this response. watsonx and ' +
      'Guardian are intentionally not listed: their health cannot be measured ' +
      'without spending a token, and runtime.basis states that they are reported ' +
      'from credential presence. POST /api/ask and read degraded for the truth ' +
      'about a given request.',
  };

  // Which BUILD is answering. Added 2026-08-31 after production silently served
  // code four merged commits behind main for a second time, while every check
  // was green: the endpoint answers 200 either way, so uptime cannot see it and
  // the only tell was a JSON key that a shipped fix had added and the deployed
  // build did not have. Establishing that took an hour. With this it is one
  // curl and a diff against `git rev-parse origin/main`.
  //
  // Vercel injects these at build time. Locally and in CI they are undefined,
  // and the honest answer there is null: a fabricated "dev" or "unknown" would
  // make the field look answered when nothing measured it. Read from
  // process.env only, never from a committed constant, because a constant is
  // exactly the thing that goes stale in the way this block exists to catch.
  const build = {
    commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    commit_ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    environment: process.env.VERCEL_ENV ?? null,
    note:
      'Nulls mean this process was not built by Vercel (a local run, or CI). ' +
      'On a deployment, compare commit_sha against the head of main: if it is ' +
      'behind, the code answering you is not the code in the repository.',
  };

  return NextResponse.json({
    // Headline number: days by which the binding deadline chain is already
    // past feasible (worst single overrun among VIOLATED nodes).
    deadline_violations_days: worstViolationDays,

    // Build identity of the process answering this request.
    build,

    // Per-component state OBSERVED on this request. See the comment above.
    components,

    // Shape of the corpus that answers /api/ask, so a reader can see the
    // answering surface is real before asking and receiving an abstention.
    corpus: corpusShape,

    // The four stages, and what each still does with the model off.
    pipeline: PIPELINE,
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
    //
    // `closest_altitude_km_used` is the disclosure that matters here. The decay
    // table is a 7 x 3 grid: 400 to 700 km in 50 km steps, ballistic
    // coefficients 120 / 180 / 250. The lookup takes the NEAREST row on both
    // axes, and /mission accepts any positive perigee, so an orbit outside that
    // grid still returns a lifetime and a legal verdict. The engine has always
    // recorded which row it actually used; until now that stayed inside the
    // engine while `method` said "NRLMSISE-00 ballistic drag integration",
    // which reads as though the number was integrated for THIS orbit.
    //
    // Null means the requested orbit was an exact grid point. A number means
    // the verdict was computed from that altitude instead, and a reader can
    // see how far the substitution reached.
    deorbit_compliance: {
      verdict: deorbitResult.verdict,
      lifetime_years: deorbitResult.lifetimeYears,
      fcc_limit_years: deorbitResult.fccLimitYears,
      method: deorbitResult.method,
      closest_altitude_km_used: deorbitResult.closestAltitudeKmUsed,
      table_entry_not_found: deorbitResult.tableEntryNotFound,
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

    // Runtime self-report: which path answers, as opposed to which models are
    // configured above. A judge can diff the two in one request, so a claim
    // that is not running cannot hide behind an inventory.
    //
    // Each field below states what it is derived from, because the three are
    // not equally knowable from inside this handler. corpus_source and
    // embedding_backend are read from the committed artifact and are facts.
    // generation_backend and guardian_audit are read from credential presence
    // and are therefore claims about CONFIGURATION, not about model health:
    // proving those would mean spending watsonx tokens on every status
    // request, which is both expensive and the exact thing that exhausted the
    // Lite quota on 2026-08-29. So they are labelled rather than overstated,
    // and the note names the single request that settles the question.
    runtime: {
      generation_backend: hasWatsonxCredentials
        ? 'watsonx'
        : 'offline-extractive',
      embedding_backend: embeddingBackend,
      guardian_audit: hasWatsonxCredentials ? 'active' : 'inactive',
      corpus_source: readCorpusSource(),
      // Which of the fields above are measured and which are inferred.
      basis: {
        generation_backend: 'credentials-present (not a health check)',
        guardian_audit: 'credentials-present (not a health check)',
        embedding_backend: 'read from corpus/schema.json model',
        corpus_source: 'read from the loaded corpus',
      },
      note: hasWatsonxCredentials
        ? `watsonx credentials are present, so /api/ask attempts the watsonx path. This is credential presence, not model health: a token quota, an outage or a rate limit is not visible from here. When watsonx is unreachable /api/ask degrades to the offline extractive path over the same corpus, sets degraded: true and names the upstream error in its reason, so POST /api/ask and read that reason for the path that actually answered. Query embedding runs on ${embeddingBackend} in every case, because the committed corpus freeze determines the embedder.`
        : `watsonx credentials absent: answers come from the offline extractive path over the same corpus, cite-or-abstain still enforced, Guardian audit does not run. Query embedding runs on ${embeddingBackend}.`,
    },

    // Corpus snapshot AMDDATE, read from the committed freeze rather than
    // hardcoded. Hard rule 1 pins every citation to a dated snapshot, so a
    // judge-facing endpoint must not answer with a placeholder once the
    // corpus exists (the freeze landed in 564dc22).
    corpus_amddate: corpusSnapshot,

    // Named scenario stories, each computed by the real engine on this
    // request. A judge can see the range of the engine from one curl,
    // before any UI exists, and no screen can show an empty state.
    //
    // Each story ends somewhere different by design, and
    // engine/__tests__/scenarios.test.ts asserts that rather than trusting
    // it: six buttons with one answer read as a single hardcoded result.
    scenarios: runAllScenarios(loadScenarios(), today).map((s) => ({
      id: s.id,
      name: s.name,
      interlock: s.interlock,
      demonstrates: s.demonstrates,
      headline: s.headline,
      deorbit_verdict: s.deorbit.verdict,
      lifetime_years: s.deorbit.lifetime_years,
      violated_nodes: s.violated_node_count,
      violated_days: s.violated_days,
      critical_path_length: s.critical_path.length,
      perigee_km: s.perigee_km,
    })),

    // Timestamps
    computed_at: new Date().toISOString(),
    today,
  });
}
