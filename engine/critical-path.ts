// engine/critical-path.ts
// Backward critical path computation from a fixed terminal delivery date.
// Pure TypeScript, no network, no infrastructure, runs in the browser.

import type { GraphNode, GraphEdge, CriticalPathResult, Verdict } from './types';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function diffDays(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.round((b - a) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm)
// ---------------------------------------------------------------------------

function topologicalSort(
  nodeIds: string[],
  edges: GraphEdge[],
): string[] {
  const inDegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const successors = new Map<string, string[]>(nodeIds.map((id) => [id, []]));

  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    successors.get(edge.from)?.push(edge.to);
  }

  const queue = nodeIds.filter((id) => inDegree.get(id) === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const succ of successors.get(current) ?? []) {
      const deg = (inDegree.get(succ) ?? 1) - 1;
      inDegree.set(succ, deg);
      if (deg === 0) queue.push(succ);
    }
  }

  if (sorted.length !== nodeIds.length) {
    throw new Error('engine/critical-path: cycle detected in dependency graph');
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Forward pass: compute earliest start for every node
// Earliest start of a node = max(earliest start + duration) across all predecessors
// ---------------------------------------------------------------------------

function forwardPass(
  sorted: string[],
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  projectStart: string,
): Map<string, string> {
  const predecessors = new Map<string, string[]>(
    sorted.map((id) => [id, []]),
  );
  for (const edge of edges) {
    predecessors.get(edge.to)?.push(edge.from);
  }

  const earliestStart = new Map<string, string>();

  for (const id of sorted) {
    const preds = predecessors.get(id) ?? [];
    if (preds.length === 0) {
      earliestStart.set(id, projectStart);
    } else {
      let latest = projectStart;
      for (const predId of preds) {
        const predNode = nodes.get(predId)!;
        const predES = earliestStart.get(predId)!;
        const predFinish = addDays(predES, predNode.durationDays);
        if (diffDays(latest, predFinish) > 0) latest = predFinish;
      }
      earliestStart.set(id, latest);
    }
  }

  return earliestStart;
}

// ---------------------------------------------------------------------------
// Backward pass: compute latest start for every node
// Latest start of a node = min(latest start of successors) - this node's duration
// ---------------------------------------------------------------------------

function backwardPass(
  sorted: string[],
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  deliveryDate: string,
  terminalNodeId: string,
): Map<string, string> {
  const successorMap = new Map<string, string[]>(
    sorted.map((id) => [id, []]),
  );
  for (const edge of edges) {
    successorMap.get(edge.from)?.push(edge.to);
  }

  const latestStart = new Map<string, string>();

  // Work backwards through the sorted order
  for (let i = sorted.length - 1; i >= 0; i--) {
    const id = sorted[i];
    const node = nodes.get(id)!;
    const succs = successorMap.get(id) ?? [];

    if (id === terminalNodeId || succs.length === 0) {
      // Terminal node: latest start = delivery date - duration
      latestStart.set(id, addDays(deliveryDate, -node.durationDays));
    } else {
      let earliest = deliveryDate;
      for (const succId of succs) {
        const succLS = latestStart.get(succId)!;
        if (diffDays(succLS, earliest) > 0) earliest = succLS;
      }
      latestStart.set(id, addDays(earliest, -node.durationDays));
    }
  }

  return latestStart;
}

// ---------------------------------------------------------------------------
// Verdict assignment
// ---------------------------------------------------------------------------

function assignVerdict(
  node: GraphNode,
  earliestStart: string,
  latestStart: string,
  today: string,
): Verdict {
  const float = diffDays(earliestStart, latestStart);
  if (float < 0) return 'VIOLATED';
  // If earliest start is in the past and the node hasn't completed yet, it is at risk
  if (diffDays(today, earliestStart) > 0 && float === 0) return 'AT_RISK';
  if (float === 0) return 'AT_RISK';
  return 'OK';
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeCriticalPath(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  deliveryDate: string,
  projectStart: string,
  today: string = new Date().toISOString().split('T')[0],
): CriticalPathResult {
  const t0 = Date.now();

  const nodeIds = Array.from(nodes.keys());
  const sorted = topologicalSort(nodeIds, edges);

  // Identify the terminal node, the one with no outgoing edges
  const hasOutgoing = new Set(edges.map((e) => e.from));
  const terminalCandidates = nodeIds.filter((id) => !hasOutgoing.has(id));
  if (terminalCandidates.length !== 1) {
    throw new Error(
      `engine/critical-path: expected exactly 1 terminal node, found ${terminalCandidates.length}: ${terminalCandidates.join(', ')}`,
    );
  }
  const terminalNodeId = terminalCandidates[0];

  const earliestStarts = forwardPass(sorted, nodes, edges, projectStart);
  const latestStarts = backwardPass(sorted, nodes, edges, deliveryDate, terminalNodeId);

  // Annotate nodes with computed values and verdicts
  const annotated = new Map<string, GraphNode>();
  let totalViolatedDays = 0;

  for (const id of nodeIds) {
    const node = nodes.get(id)!;
    const es = earliestStarts.get(id)!;
    const ls = latestStarts.get(id)!;
    const float = diffDays(es, ls);
    const verdict = assignVerdict(node, es, ls, today);

    if (verdict === 'VIOLATED') {
      totalViolatedDays += Math.abs(float);
    }

    annotated.set(id, {
      ...node,
      earliestStart: es,
      latestStart: ls,
      float,
      verdict,
    });
  }

  // Critical path: all nodes with float === 0, in topological order
  const criticalPath = sorted.filter(
    (id) => (annotated.get(id)?.float ?? Infinity) <= 0,
  );

  return {
    criticalPath,
    nodes: annotated,
    totalViolatedDays,
    computeMs: Date.now() - t0,
  };
}
