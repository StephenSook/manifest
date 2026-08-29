// app/api/solar/route.ts
// Task 2.8 completion -- unauthenticated live solar endpoint.
//
// WHY THIS EXISTS, stated plainly because the gap was real.
// The project's differentiator is that solar activity changes an FCC legal
// outcome. `services/solar/fetch.ts` fetched NOAA SWPC and was unit-tested,
// and `data/surya-outlook.json` held real Surya output, but NO shipped code
// read either one, while app/judge/page.tsx told judges to `GET /api/solar`
// and read `f107_live`. The route was documented before it was written.
// This closes that: the reading is live, and the judge instruction now runs.
//
// SCOPE, stated equally plainly. This endpoint reports the live solar inputs
// and their provenance. It does NOT recompute the deorbit verdict from the
// live reading: `/api/status` computes that from the frozen NRLMSISE-00
// decay table (`data/decay-table.json`), which is a real physics run with
// per-row provenance, and changing a judge-facing number days before a
// freeze is not a trade worth making. The relationship between the two is
// stated in the response body rather than left for a reader to assume.
//
// No authentication. No credentials. No secrets. One outbound call to a
// public NOAA endpoint that needs no key.
// Authority: PLAN.md task 2.8, and app/judge/page.tsx step 4.

import { NextResponse } from 'next/server';
import {
  OBSERVED_URL,
  PREDICTED_URL,
  buildSolarPayload,
  parseNoaaPredicted,
  readObservedFlux,
  currentYearMonthUtc,
  type NoaaPredictedEntry,
  type SuryaOutlook,
} from './lib';

// The committed Surya artifact (D7). Frozen, not a live inference path, and
// the response says so rather than implying a model ran this request.
import suryaOutlook from '../../../data/surya-outlook.json';
import { corsPreflight, withCors } from '@/lib/cors';

// Always run this on the server at request time. The whole point is that the
// reading is live, so a cached response would be a quieter version of the
// defect this route was written to fix.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Upstream timeout. A judge should get a named absence, not a hung request. */
const UPSTREAM_TIMEOUT_MS = 8000;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`${url} returned ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function OPTIONS(): NextResponse {
  return corsPreflight();
}

export async function GET() {
  return withCors(await handleSolar());
}

async function handleSolar() {
  const surya = suryaOutlook as SuryaOutlook;

  try {
    const [observedRaw, predictedRaw] = await Promise.all([
      fetchJson(OBSERVED_URL),
      fetchJson(PREDICTED_URL),
    ]);

    const observed = readObservedFlux(observedRaw);
    const envelope = parseNoaaPredicted(
      predictedRaw as NoaaPredictedEntry[],
      currentYearMonthUtc(),
    );

    // Fail closed rather than serve a shape the contract does not promise.
    if (observed === null) {
      throw new Error('observed endpoint returned no numeric flux field');
    }
    if (envelope.months.length === 0) {
      // An empty envelope beside a healthy-looking 200 is precisely the
      // silent failure this route exists to avoid, so it is an error here.
      throw new Error(
        'predicted endpoint returned no months at or after the current month',
      );
    }

    return NextResponse.json(buildSolarPayload({ observed, envelope, surya }), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown upstream error';

    // 200 with a named absence, not 5xx: the endpoint answered correctly and
    // the honest answer is "NOAA did not". `solar_source` carries the verdict
    // so a caller never has to infer liveness from a status code.
    return NextResponse.json(
      buildSolarPayload({
        observed: null,
        envelope: null,
        surya,
        unreachableReason: reason,
      }),
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
