// engine/types.ts
// Shared contracts — consumers: Khadim (graph UI), Tylin (corpus/API)
// Changes to this file are CONTRACT changes: announce before committing.

// ---------------------------------------------------------------------------
// Core verdict type
// ---------------------------------------------------------------------------

/** Abstain is a first-class value, not an error. */
export type Verdict = 'OK' | 'AT_RISK' | 'VIOLATED' | 'ABSTAIN';

// ---------------------------------------------------------------------------
// Duration basis
// ---------------------------------------------------------------------------

export type DurationBasis = 'DOCUMENTED' | 'ESTIMATED';

// ---------------------------------------------------------------------------
// Citation — every regulatory claim carries one or the product abstains
// ---------------------------------------------------------------------------

export interface Citation {
  cfrTitle: number;
  part: number;
  section: string;
  paragraphPath: string;
  /** AMDDATE from the ingested eCFR snapshot, e.g. "2024-11-15" */
  amddate: string;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Regulatory pathway
// ---------------------------------------------------------------------------

export type Pathway = 'part-97-amateur' | 'part-5-experimental' | 'part-25';

// ---------------------------------------------------------------------------
// Mission input — everything the engine needs from the user
// ---------------------------------------------------------------------------

export interface MissionInput {
  /** ISO date string — immovable wall */
  launchDate: string;
  /** ISO date string — hard terminal deadline */
  deliveryDate: string;
  /** ISO date string or null if not yet determined */
  lvDeterminationDate: string | null;
  /** ISO date string — integration start */
  integrationDate: string | null;
  pathway: Pathway;
  /** Primary downlink frequency in MHz */
  frequencyMHz: number;
  /** True if the mission images the Earth — triggers NOAA CRSRA prerequisite */
  imagingEarth: boolean;
  /** Apogee altitude in km */
  apogeeKm: number;
  /** Perigee altitude in km */
  perigeeKm: number;
  /** Ballistic coefficient in kg/m^2 — used for decay estimate */
  ballisticCoefficient: number;
}

// ---------------------------------------------------------------------------
// Graph node
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  label: string;
  /** Regulatory agency responsible */
  agency: 'FCC' | 'NOAA' | 'NASA' | 'ITU' | 'IARU' | 'LAUNCH_PROVIDER' | 'TEAM';
  /** Duration in calendar days */
  durationDays: number;
  durationBasis: DurationBasis;
  /** Source for the duration — required when basis is DOCUMENTED */
  source: string;
  /** Governing citation */
  citation: Citation | null;
  /** Fee in USD or null if none / not documented */
  feeUsd: number | null;
  /** What triggers a re-work of this node */
  reworkTriggers: string[];
  /** Documented consequence of this node being late */
  latenessConsequence: string;
  /** Computed verdict — set by the engine */
  verdict: Verdict;
  /** Computed earliest start date (ISO) */
  earliestStart: string | null;
  /** Computed latest start date without slipping the terminal node (ISO) */
  latestStart: string | null;
  /** Float in days — 0 means on the critical path */
  float: number | null;
  /** True if Part 25 and pending Part 100 transition */
  pendingPart100: boolean;
}

// ---------------------------------------------------------------------------
// Graph edge — hard prerequisite
// ---------------------------------------------------------------------------

export interface GraphEdge {
  from: string;
  to: string;
}

// ---------------------------------------------------------------------------
// Critical path result
// ---------------------------------------------------------------------------

export interface CriticalPathResult {
  /** Node IDs on the critical path in order */
  criticalPath: string[];
  /** All nodes with computed earliest/latest start and float */
  nodes: Map<string, GraphNode>;
  /** Total violated deadline days across all VIOLATED nodes */
  totalViolatedDays: number;
  /** Compute duration in milliseconds */
  computeMs: number;
}

// ---------------------------------------------------------------------------
// Regime flag — D3: Part 100 transition
// ---------------------------------------------------------------------------

export interface RegimeFlag {
  part100Active: boolean;
  /** Verbatim D3 copy string — Khadim renders this, engine supplies it */
  part100CopyString: string;
}

export const REGIME_FLAG: RegimeFlag = {
  part100Active: false,
  part100CopyString:
    'Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today.',
};
