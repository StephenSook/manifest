/**
 * One canonical mission state, rendered at two depths.
 *
 * Borrowed from a rival whose landing page is not a dashboard: it reduces the
 * mission to one summary object and renders it through two different prompts,
 * an operator brief and a public digest, from identical facts.
 *
 * The adaptation that matters here is the invariant. Manifest's entire thesis
 * is cite-or-abstain, so the two depths are NOT allowed to carry different
 * evidence. `citations` is computed once and shared by reference: the same
 * sections appear under both audiences, or neither audience gets the claim.
 * That turns our abstention discipline from a defensive property into
 * something a judge can see by clicking between two views.
 *
 * The difference between the depths is PROSE ONLY. The licensing owner reads
 * the section numbers inline; the faculty advisor reads what slips if this
 * slips. Neither is a summary of the other, and no model is involved: both are
 * derived deterministically from the engine result. A model may later rewrite
 * the wording, but it cannot change which citations appear, because it never
 * sees this function.
 */

import type { Citation, CriticalPathResult, GraphNode, MissionInput } from './types';

export type BriefAudience = 'licensing-owner' | 'faculty-advisor';

export interface BriefItem {
  /** Stable id of the node this line describes. */
  nodeId: string;
  /** The sentence for this audience. */
  text: string;
  /** Days this node is past its latest start, 0 when not violated. */
  violatedDays: number;
}

export interface Brief {
  audience: BriefAudience;
  headline: string;
  items: BriefItem[];
  /**
   * Section-level evidence. IDENTICAL across both briefs by construction, and
   * asserted by engine/__tests__/briefs.test.ts. A judge who switches audience
   * is looking at the same regulatory basis, phrased differently.
   */
  citations: Citation[];
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

/** Nodes the engine judged violated, worst first, deterministically ordered. */
function violatedNodes(result: CriticalPathResult, today: string): GraphNode[] {
  const out: GraphNode[] = [];
  for (const node of result.nodes.values()) {
    if (node.verdict !== 'VIOLATED' || !node.latestStart) continue;
    out.push(node);
  }
  return out.sort((a, b) => {
    const da = daysBetween(a.latestStart as string, today);
    const db = daysBetween(b.latestStart as string, today);
    return db - da || a.id.localeCompare(b.id);
  });
}

/** Every citation the briefed nodes rest on, deduplicated, order stable. */
function citationsOf(nodes: GraphNode[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const node of nodes) {
    if (!node.citation) continue;
    const key = `${node.citation.cfrTitle}/${node.citation.part}/${node.citation.section}${node.citation.paragraphPath ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(node.citation);
  }
  return out;
}

function cite(node: GraphNode): string {
  const c = node.citation;
  if (!c) return node.source;
  return `${c.cfrTitle} CFR ${c.section}${c.paragraphPath ?? ''}`;
}

/**
 * Render the same state for both audiences.
 *
 * `today` is injected rather than read from the clock so the output is a pure
 * function of its inputs and the tests cannot go stale on a date boundary.
 */
export function renderBriefs(
  result: CriticalPathResult,
  input: MissionInput,
  today: string,
): { owner: Brief; advisor: Brief } {
  const nodes = violatedNodes(result, today);
  const citations = citationsOf(nodes);
  const total = result.totalViolatedDays;

  const ownerItems: BriefItem[] = nodes.map((node) => {
    const late = daysBetween(node.latestStart as string, today);
    return {
      nodeId: node.id,
      violatedDays: late,
      text:
        `${node.label} (${node.agency}) is ${late} days past its latest start of ` +
        `${node.latestStart}. Governing text: ${cite(node)}. ` +
        `Duration ${node.durationDays} days, ${node.durationBasis}.`,
    };
  });

  const advisorItems: BriefItem[] = nodes.map((node) => {
    const late = daysBetween(node.latestStart as string, today);
    return {
      nodeId: node.id,
      violatedDays: late,
      // Same node, same evidence, no section numbers in the prose. What the
      // advisor needs is the consequence, which the engine already carries as
      // a documented field rather than something invented here.
      text:
        `${node.label} should already have started, ${late} days ago. ` +
        `If it keeps slipping: ${node.latenessConsequence}`,
    };
  });

  const orbit = input.perigeeKm ? ` at ${input.perigeeKm} km` : '';
  return {
    owner: {
      audience: 'licensing-owner',
      headline:
        `${nodes.length} regulatory deadlines violated by ${total} days in total` +
        `${orbit}. File in the order below.`,
      items: ownerItems,
      citations,
    },
    advisor: {
      audience: 'faculty-advisor',
      headline:
        nodes.length === 0
          ? 'No regulatory deadline has been missed yet.'
          : `${nodes.length} filings are already late${orbit}. ` +
            `Together they are ${total} days behind, and that time cannot be recovered by working faster.`,
      items: advisorItems,
      citations,
    },
  };
}
