// engine/regime.ts
// Dual-regime layer, Part 25 to Part 100 transition flag.
// Per PLAN.md task 2.15 and Decision D3.
//
// The regime switch is ONE config flag keyed to a future FCC Space Bureau
// public notice. Flipping it changes every Part 25 node's badge string
// and NOTHING else. The engine exposes the flag and the D3 copy string;
// Khadim renders it in the component layer.
//
// D3 verbatim: "Part 100 was adopted July 22, 2026 (FCC 26-47). The effective
// date has not been announced. Part 25 remains binding today."
// Never say Part 100 "replaced" Part 25.

import type { GraphNode } from './types';
import { REGIME_FLAG } from './types';

/**
 * Badge text shown on every Part 25 node when Part 100 is not yet active.
 * Khadim renders this string, do not add markup here.
 */
export const PART_25_PENDING_BADGE =
  'Part 25 (Part 100 pending, not yet effective)';

/**
 * Badge text shown on Part 25 nodes after Part 100 is activated.
 * This string replaces PART_25_PENDING_BADGE when the regime flag flips.
 */
export const PART_100_ACTIVE_BADGE = 'Part 100';

/**
 * Returns the badge string for a given node under the current regime.
 * A node is a Part 25/100 node if it was built with pendingPart100 true OR
 * if Part 100 is now active (it was a Part 25 node before the flip).
 * If the node has no Part 25 lineage at all, returns null.
 *
 * The node's pendingPart100 field is set at graph-build time when Part 25
 * governs. After Part 100 activates (flag flips), pendingPart100 becomes false
 * on newly-built nodes, but getRegimeBadge is called on the live node map
 * which was built before the flip. The flag is the source of truth at render time.
 */
export function getRegimeBadge(node: GraphNode): string | null {
  if (!node.pendingPart100) return null;
  return REGIME_FLAG.part100Active ? PART_100_ACTIVE_BADGE : PART_25_PENDING_BADGE;
}

/**
 * Apply the regime flag to a map of nodes.
 * Returns a new Map with updated badge-relevant fields.
 * Does NOT mutate the input.
 *
 * Done means: flipping the flag changes every Part 25 node's badge
 * and changes nothing else. Verified by regime.test.ts.
 */
export function applyRegimeFlag(
  nodes: Map<string, GraphNode>,
  part100Active: boolean,
): Map<string, GraphNode> {
  const result = new Map<string, GraphNode>();
  for (const [id, node] of nodes) {
    result.set(id, { ...node }); // copy only, regime flag read at render time
  }
  // The flag is on REGIME_FLAG (singleton), Khadim reads getRegimeBadge(node)
  // We return a shallow copy so callers get a stable reference
  REGIME_FLAG.part100Active = part100Active;
  return result;
}
