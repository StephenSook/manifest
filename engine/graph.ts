// engine/graph.ts
// The 12 regulatory nodes for a US university CubeSat mission.
// All durations are DOCUMENTED with source or ESTIMATED with basis.
// Per PLAN.md task 1.7 and CLAUDE.md section 4.
//
// NOTE: Every duration labeled DOCUMENTED comes from a primary source.
//       Every duration labeled ESTIMATED carries a stated basis.
//       CubeSat 101 figures are DOCUMENTED but dated 2017, flagged inline.
//
// The deorbit compliance node (id: 'deorbit-compliance') is computed by
// engine/interlocks/deorbit-compliance.ts and injected at runtime.
// Its entry here is a placeholder with ESTIMATED duration.

import type { GraphNode, GraphEdge, MissionInput, Citation } from './types';
import { REGIME_FLAG } from './types';

// ---------------------------------------------------------------------------
// Citation helpers
// ---------------------------------------------------------------------------

function cfr(
  cfrTitle: number,
  part: number,
  section: string,
  paragraphPath: string,
  amddate: string,
  sourceUrl: string,
): Citation {
  return { cfrTitle, part, section, paragraphPath, amddate, sourceUrl };
}

// Placeholder AMDDATE, replaced by Tylin's eCFR snapshot AMDDATE in task 1.1
const SNAPSHOT = 'VERIFY_FROM_SNAPSHOT';
const ECFR_BASE = 'https://www.ecfr.gov/current/title-';

// ---------------------------------------------------------------------------
// Build the 12-node graph for a given MissionInput
// Returns nodes map and edges array ready for computeCriticalPath
// ---------------------------------------------------------------------------

export function buildGraph(input: MissionInput): {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
} {
  const isPart97 = input.pathway === 'part-97-amateur';
  const isPart25 = input.pathway === 'part-25';
  const part100Pending = REGIME_FLAG.part100Active === false; // Part 25 still governs

  // ---------------------------------------------------------------------------
  // Node definitions
  // ---------------------------------------------------------------------------

  const allNodes: GraphNode[] = [
    // 1. IARU coordination request submitted
    {
      id: 'iaru-request',
      label: 'IARU Coordination Request',
      agency: 'IARU',
      durationDays: 0, // Point-in-time action by the team
      durationBasis: 'DOCUMENTED',
      source: 'IARU Amateur Satellite Frequency Coordination procedure, iaru.org',
      citation: cfr(47, 97, '97.207', '(c)', SNAPSHOT, `${ECFR_BASE}47/part-97/section-97.207`),
      feeUsd: null,
      reworkTriggers: ['Frequency change forces re-coordination'],
      latenessConsequence: 'IARU letter delayed, which delays ITU API filing and FCC grant',
      verdict: 'OK',
      earliestStart: null,
      latestStart: null,
      float: null,
      pendingPart100: false,
    },

    // 2. IARU coordination letter received
    {
      id: 'iaru-letter',
      label: 'IARU Coordination Letter Issued',
      agency: 'IARU',
      // ESTIMATED: IARU states "as soon as possible" with no published SLA;
      // 4-8 weeks observed in practice per CubeSat 101 (2017, flag age)
      durationDays: 42,
      durationBasis: 'ESTIMATED',
      source: 'CubeSat 101 Ch 2.6 (2017, age flagged), 4 to 8 weeks typical',
      citation: cfr(47, 97, '97.207', '(c)', SNAPSHOT, `${ECFR_BASE}47/part-97/section-97.207`),
      feeUsd: null,
      reworkTriggers: ['Frequency change forces re-coordination from scratch'],
      latenessConsequence: 'Blocks ITU API filing; no API number means IARU request incomplete',
      verdict: 'OK',
      earliestStart: null,
      latestStart: null,
      float: null,
      pendingPart100: false,
    },

    // 3. ITU Advance Publication Information filed via FCC
    {
      id: 'itu-api-filed',
      label: 'ITU API Filing (via FCC)',
      agency: 'FCC',
      durationDays: 0, // Point-in-time submission
      durationBasis: 'DOCUMENTED',
      source: '47 CFR 25.114(d), ITU filing coordinated through FCC International Bureau',
      citation: cfr(47, 25, '25.114', '(d)', SNAPSHOT, `${ECFR_BASE}47/part-25/section-25.114`),
      feeUsd: null,
      reworkTriggers: ['Frequency change requires re-filing'],
      latenessConsequence: 'No ITU publication means FCC cannot grant; blocks FCC grant node',
      verdict: 'OK',
      earliestStart: null,
      latestStart: null,
      float: null,
      pendingPart100: part100Pending,
    },

    // 4. ITU API published
    {
      id: 'itu-api-published',
      label: 'ITU API Published',
      agency: 'ITU',
      // DOCUMENTED: 2-3 months per 47 CFR 25.114(d) and post-WRC-23 practice
      durationDays: 75, // 2.5 months midpoint; ESTIMATED basis
      durationBasis: 'ESTIMATED',
      source: 'CubeSat 101 Ch 2.6 (2017, age flagged), 2-3 months; shortening post-WRC-23',
      citation: cfr(47, 25, '25.114', '(d)', SNAPSHOT, `${ECFR_BASE}47/part-25/section-25.114`),
      feeUsd: null,
      reworkTriggers: [],
      latenessConsequence: 'FCC will not grant without published ITU API; critical predecessor',
      verdict: 'OK',
      earliestStart: null,
      latestStart: null,
      float: null,
      pendingPart100: part100Pending,
    },

    // 5. FCC application prepared
    {
      id: 'fcc-application-prepared',
      label: 'FCC Application Prepared',
      agency: 'TEAM',
      // ESTIMATED: no regulatory clock; 2-4 weeks for a well-resourced team
      durationDays: 21,
      durationBasis: 'ESTIMATED',
      source: 'CubeSat 101 Ch 2.6 (2017, age flagged), preparation is team-driven',
      citation: isPart97
        ? cfr(47, 97, '97.207', '(g)', SNAPSHOT, `${ECFR_BASE}47/part-97/section-97.207`)
        : cfr(47, 25, '25.114', '', SNAPSHOT, `${ECFR_BASE}47/part-25/section-25.114`),
      feeUsd: null,
      reworkTriggers: ['Frequency change', 'Orbit change above 600 km triggers disposal analysis'],
      latenessConsequence: 'Delays FCC filing date, compresses review window before delivery',
      verdict: 'OK',
      earliestStart: null,
      latestStart: null,
      float: null,
      pendingPart100: part100Pending && isPart25,
    },

    // 6. FCC application filed
    {
      id: 'fcc-application-filed',
      label: 'FCC Application Filed',
      agency: 'FCC',
      durationDays: 0,
      durationBasis: 'DOCUMENTED',
      source: '47 CFR 97.207(g) (Part 97) or 47 CFR 25.114 (Part 25)',
      citation: isPart97
        ? cfr(47, 97, '97.207', '(g)', SNAPSHOT, `${ECFR_BASE}47/part-97/section-97.207`)
        : cfr(47, 25, '25.114', '', SNAPSHOT, `${ECFR_BASE}47/part-25/section-25.114`),
      feeUsd: null,
      reworkTriggers: [],
      latenessConsequence: 'Compresses FCC review window; late filing risks no grant before delivery',
      verdict: 'OK',
      earliestStart: null,
      latestStart: null,
      float: null,
      pendingPart100: part100Pending && isPart25,
    },

    // 7. NASA orbital debris assessment complete
    {
      id: 'nasa-debris-assessment',
      label: 'NASA Orbital Debris Assessment',
      agency: 'NASA',
      // DOCUMENTED: NASA-STD-8719.14C; DAS 3.2.7 requires Software User Agreement
      // Manifest computes an independent NRLMSISE-00 estimate (D4)
      durationDays: 14,
      durationBasis: 'ESTIMATED',
      source: 'NASA-STD-8719.14C; DAS 3.2.7 requires SUA, Manifest uses independent NRLMSISE-00 estimate',
      citation: null, // NASA standard, not CFR
      feeUsd: null,
      reworkTriggers: ['Orbit change requires re-assessment'],
      latenessConsequence: 'FCC requires debris assessment before grant; delays grant node',
      verdict: 'OK',
      earliestStart: null,
      latestStart: null,
      float: null,
      pendingPart100: false,
    },

    // 8. Deorbit compliance verdict (the innovation node, D1)
    // This node is COMPUTED by engine/interlocks/deorbit-compliance.ts
    // and is a hard prerequisite of FCC grant.
    // Its verdict changes based on the solar cycle and mission orbit.
    {
      id: 'deorbit-compliance',
      label: 'Deorbit Compliance Verdict (FCC 5-year rule)',
      agency: 'FCC',
      // DOCUMENTED: FCC 22-74; the compliance check itself takes seconds
      durationDays: 1,
      durationBasis: 'DOCUMENTED',
      source: 'FCC 22-74 (2022); 47 CFR 25.283(e), 5-year post-mission disposal rule',
      citation: cfr(47, 25, '25.283', '(e)', SNAPSHOT, `${ECFR_BASE}47/part-25/section-25.283`),
      feeUsd: null,
      reworkTriggers: ['Orbit change above 600 km re-triggers compliance check', 'Launch date change re-triggers (solar cycle position changes)'],
      latenessConsequence: 'FCC will not grant if disposal compliance cannot be demonstrated',
      verdict: 'OK', // Overwritten at runtime by deorbit-compliance.ts
      earliestStart: null,
      latestStart: null,
      float: null,
      pendingPart100: part100Pending && isPart25,
    },

    // 9. NOAA CRSRA application (imaging missions only, injected conditionally)
    ...(input.imagingEarth
      ? [
          {
            id: 'noaa-crsra-application',
            label: 'NOAA CRSRA Application',
            agency: 'NOAA' as const,
            durationDays: 0,
            durationBasis: 'DOCUMENTED' as const,
            source: '15 CFR Part 960, NOAA Commercial Remote Sensing Regulatory Affairs',
            citation: cfr(15, 960, '960.4', '', SNAPSHOT, `${ECFR_BASE}15/part-960/section-960.4`),
            feeUsd: null,
            reworkTriggers: ['Change to imaging payload requires re-application'],
            latenessConsequence: 'NOAA CRSRA license is a hard predecessor of FCC grant for imaging missions',
            verdict: 'OK' as const,
            earliestStart: null,
            latestStart: null,
            float: null,
            pendingPart100: false,
          },
          {
            id: 'noaa-crsra-license',
            label: 'NOAA CRSRA License Issued',
            agency: 'NOAA' as const,
            // DOCUMENTED: 15 CFR 960.8, 60-day statutory clock after completeness determination
            durationDays: 60,
            durationBasis: 'DOCUMENTED' as const,
            source: '15 CFR 960.8, 60-day statutory review clock after completeness',
            citation: cfr(15, 960, '960.8', '', SNAPSHOT, `${ECFR_BASE}15/part-960/section-960.8`),
            feeUsd: null,
            reworkTriggers: [],
            latenessConsequence: 'FCC will not grant without NOAA CRSRA license for imaging missions; CubeSat 101 Ch 2.8',
            verdict: 'OK' as const,
            earliestStart: null,
            latestStart: null,
            float: null,
            pendingPart100: false,
          },
        ]
      : []),

    // 10. FCC grant
    {
      id: 'fcc-grant',
      label: 'FCC License Grant',
      agency: 'FCC',
      // ESTIMATED: no statutory clock for Part 97 or Part 25 grant review
      // CubeSat 101 (2017, age flagged): 3-6 months after complete application
      durationDays: 120,
      durationBasis: 'ESTIMATED',
      source: 'CubeSat 101 Ch 2.6 (2017, age flagged), 3 to 6 months after complete filing',
      citation: isPart97
        ? cfr(47, 97, '97.207', '(g)', SNAPSHOT, `${ECFR_BASE}47/part-97/section-97.207`)
        : cfr(47, 25, '25.114', '', SNAPSHOT, `${ECFR_BASE}47/part-25/section-25.114`),
      feeUsd: null,
      reworkTriggers: [],
      latenessConsequence: 'No FCC grant means no legal operation; demanifest risk if grant arrives after delivery',
      verdict: 'OK',
      earliestStart: null,
      latestStart: null,
      float: null,
      pendingPart100: part100Pending && isPart25,
    },

    // 11. Launch-provider delivery (terminal node, the wall)
    {
      id: 'delivery',
      label: 'Launch Provider Delivery',
      agency: 'LAUNCH_PROVIDER',
      durationDays: 0,
      durationBasis: 'DOCUMENTED',
      source: 'Launch provider manifest contract; CubeSat 101, "consequence of missing delivery is demanifest"',
      citation: null,
      feeUsd: null,
      reworkTriggers: ['Launch slip recomputes every clock in the graph'],
      latenessConsequence: 'Demanifest, documented in CubeSat 101 including a deployer-disable near-miss',
      verdict: 'OK',
      earliestStart: null,
      latestStart: null,
      float: null,
      pendingPart100: false,
    },
  ];

  // ---------------------------------------------------------------------------
  // Edge definitions (hard prerequisites)
  // ---------------------------------------------------------------------------

  const baseEdges: GraphEdge[] = [
    // IARU chain (Part 97 pathway)
    ...(isPart97
      ? [
          { from: 'iaru-request', to: 'iaru-letter' },
          { from: 'iaru-letter', to: 'fcc-application-prepared' },
        ]
      : []),

    // ITU chain
    { from: 'iaru-letter', to: 'itu-api-filed' },
    { from: 'itu-api-filed', to: 'itu-api-published' },
    { from: 'itu-api-published', to: 'fcc-application-prepared' },

    // FCC application chain
    { from: 'fcc-application-prepared', to: 'fcc-application-filed' },
    { from: 'fcc-application-filed', to: 'fcc-grant' },

    // Debris assessment and deorbit compliance both precede FCC grant
    { from: 'nasa-debris-assessment', to: 'fcc-grant' },
    { from: 'deorbit-compliance', to: 'fcc-grant' },

    // FCC grant precedes delivery
    { from: 'fcc-grant', to: 'delivery' },
  ];

  // NOAA CRSRA chain (imaging missions only)
  const noaaEdges: GraphEdge[] = input.imagingEarth
    ? [
        { from: 'noaa-crsra-application', to: 'noaa-crsra-license' },
        { from: 'noaa-crsra-license', to: 'fcc-grant' },
      ]
    : [];

  const edges = [...baseEdges, ...noaaEdges];

  const nodes = new Map<string, GraphNode>(allNodes.map((n) => [n.id, n]));

  return { nodes, edges };
}
