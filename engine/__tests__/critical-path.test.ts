// engine/__tests__/critical-path.test.ts
// Diamond fixture test, hand-computed values asserted BEFORE the 12 real nodes.
// The algorithm produces the headline number, so this is the one thing that
// cannot be untested. Per PLAN.md task 1.7.

import { describe, it, expect } from 'vitest';
import { computeCriticalPath } from '../critical-path';
import type { GraphNode, GraphEdge } from '../types';

// ---------------------------------------------------------------------------
// Helper: build a minimal GraphNode for the test fixture
// ---------------------------------------------------------------------------

function makeNode(id: string, durationDays: number): GraphNode {
  return {
    id,
    label: id,
    agency: 'FCC',
    durationDays,
    durationBasis: 'ESTIMATED',
    source: 'test fixture',
    citation: null,
    feeUsd: null,
    reworkTriggers: [],
    latenessConsequence: '',
    verdict: 'OK',
    earliestStart: null,
    latestStart: null,
    float: null,
    pendingPart100: false,
  };
}

// ---------------------------------------------------------------------------
// Diamond fixture
//
//   A (10 days)
//   /         \
//  B (20 days)  C (5 days)
//   \         /
//    D (10 days)  <-- terminal
//
// Hand-computed (projectStart = 2026-01-01, deliveryDate = 2026-03-01 = day 59):
//
// Forward pass (earliest start):
//   A: day 0  (2026-01-01)
//   B: day 10 (2026-01-11) , after A finishes
//   C: day 10 (2026-01-11) , after A finishes
//   D: day 30 (2026-01-31) , after B finishes (B takes 20 days, so B done at day 30)
//              NOTE: C finishes at day 15, B finishes at day 30, D waits for B
//
// Backward pass (latest start, working back from deliveryDate day 59):
//   D: day 49 (2026-02-19) , 59 - 10 = day 49
//   B: day 29 (2026-01-30) , 49 - 20 = day 29
//   C: day 44 (2026-02-14) , 49 - 5  = day 44
//   A: day  9 (2026-01-10) , min(29, 44) - 10 = 19; wait, backward: LS_A = min(LS_B, LS_C) - duration_A
//              LS_B = day 29, LS_C = day 44, min is day 29, so LS_A = day 29 - 10 = day 19
//              Hmm, let me recount from calendar dates:
//
// Re-doing with exact calendar dates (UTC):
//   projectStart  = 2026-01-01
//   deliveryDate  = 2026-03-01  (59 days later)
//
//   ES_A = 2026-01-01 (day 0)
//   ES_B = 2026-01-11 (day 10, A finishes)
//   ES_C = 2026-01-11 (day 10, A finishes)
//   B finishes: 2026-01-31 (day 30)
//   C finishes: 2026-01-16 (day 15)
//   ES_D = 2026-01-31 (max of B finish, C finish = day 30)
//
//   LS_D = 2026-02-19 (deliveryDate - 10 = day 49)
//   LS_B = 2026-01-30 (LS_D - 20 = day 29)
//   LS_C = 2026-02-14 (LS_D -  5 = day 44)
//   LS_A = min(LS_B, LS_C) - 10 = 2026-01-30 - 10 = 2026-01-20 (day 19)
//
// Float:
//   A: LS_A - ES_A = day 19 - day 0  = 19 days
//   B: LS_B - ES_B = day 29 - day 10 = 19 days
//   C: LS_C - ES_C = day 44 - day 10 = 34 days   <-- OFF the critical path
//   D: LS_D - ES_D = day 49 - day 30 = 19 days
//
// Critical path: A -> B -> D  (all have float 19, but that means none have float 0!)
// The terminal node's float = LS_D - ES_D = 49 - 30 = 19.
//
// KEY INSIGHT: float is measured relative to a delivery date that has slack built in.
// The VIOLATED / AT_RISK verdicts fire when float < 0 (missed) or float == 0 (on the edge).
// For the critical path identification we want: float == min float across all nodes.
// The standard CPM definition: CP = nodes where float == 0 when the project is exactly
// as long as its delivery date allows.
//
// Let's tighten deliveryDate so D's float is exactly 0:
//   D finishes at ES_D + duration_D = day 30 + 10 = day 40 = 2026-02-10
//   Set deliveryDate = 2026-02-10
//
// Re-compute with deliveryDate = 2026-02-10:
//   ES_A = 2026-01-01
//   ES_B = 2026-01-11
//   ES_C = 2026-01-11
//   ES_D = 2026-01-31
//
//   LS_D = 2026-01-31 (deliveryDate - 10 = 2026-02-10 - 10 = 2026-01-31) -> float = 0
//   LS_B = 2026-01-11 (LS_D - 20 = 2026-01-31 - 20 = 2026-01-11) -> float = 0
//   LS_C = 2026-02-05 (LS_D -  5 = 2026-01-31 -  5 = 2026-01-26) -> float = 15
//   LS_A = min(LS_B, LS_C) - 10 = min(2026-01-11, 2026-01-26) - 10
//        = 2026-01-11 - 10 = 2026-01-01 -> float = 0
//
// Now:
//   A: float = 0   (critical)
//   B: float = 0   (critical)
//   C: float = 15  (NOT critical, 15 days of slack)
//   D: float = 0   (critical, terminal)
//
// Critical path: A -> B -> D
// C is off the critical path with 15 days of float.
// This is the hand-computed fixture.
// ---------------------------------------------------------------------------

const PROJECT_START = '2026-01-01';
const DELIVERY_DATE = '2026-02-10'; // Exactly tight: D finishes on this date

describe('critical-path, diamond fixture (hand-computed)', () => {
  const nodes = new Map<string, GraphNode>([
    ['A', makeNode('A', 10)],
    ['B', makeNode('B', 20)],
    ['C', makeNode('C', 5)],
    ['D', makeNode('D', 10)],
  ]);

  const edges: GraphEdge[] = [
    { from: 'A', to: 'B' },
    { from: 'A', to: 'C' },
    { from: 'B', to: 'D' },
    { from: 'C', to: 'D' },
  ];

  // Use a fixed "today" in the past so verdicts are deterministic
  const TODAY = '2025-01-01';

  const result = computeCriticalPath(nodes, edges, DELIVERY_DATE, PROJECT_START, TODAY);

  it('identifies A, B, D as the critical path (not C)', () => {
    expect(result.criticalPath).toContain('A');
    expect(result.criticalPath).toContain('B');
    expect(result.criticalPath).toContain('D');
    expect(result.criticalPath).not.toContain('C');
  });

  it('A has float 0', () => {
    expect(result.nodes.get('A')?.float).toBe(0);
  });

  it('B has float 0', () => {
    expect(result.nodes.get('B')?.float).toBe(0);
  });

  it('C has float 15 (off-path branch)', () => {
    expect(result.nodes.get('C')?.float).toBe(15);
  });

  it('D has float 0 (terminal)', () => {
    expect(result.nodes.get('D')?.float).toBe(0);
  });

  it('earliest start of A is the project start', () => {
    expect(result.nodes.get('A')?.earliestStart).toBe(PROJECT_START);
  });

  it('earliest start of B is 10 days after project start', () => {
    expect(result.nodes.get('B')?.earliestStart).toBe('2026-01-11');
  });

  it('earliest start of D is 30 days after project start (after B finishes)', () => {
    expect(result.nodes.get('D')?.earliestStart).toBe('2026-01-31');
  });

  it('C earliest start is same as B (both after A)', () => {
    expect(result.nodes.get('C')?.earliestStart).toBe('2026-01-11');
  });

  it('returns zero totalViolatedDays when the schedule fits the delivery date', () => {
    expect(result.totalViolatedDays).toBe(0);
  });

  it('computeMs is a non-negative number', () => {
    expect(result.computeMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Violated schedule fixture
// Same diamond but deliveryDate is 10 days BEFORE D can finish.
// D's ES is day 30, duration 10, so it needs until day 40.
// Set deliveryDate = day 35 (2026-02-05), 5 days short.
// ---------------------------------------------------------------------------

describe('critical-path, violated schedule fixture', () => {
  const nodes = new Map<string, GraphNode>([
    ['A', makeNode('A', 10)],
    ['B', makeNode('B', 20)],
    ['C', makeNode('C', 5)],
    ['D', makeNode('D', 10)],
  ]);

  const edges: GraphEdge[] = [
    { from: 'A', to: 'B' },
    { from: 'A', to: 'C' },
    { from: 'B', to: 'D' },
    { from: 'C', to: 'D' },
  ];

  const TODAY = '2025-01-01';
  const VIOLATED_DELIVERY = '2026-02-05'; // 5 days before D can finish

  const result = computeCriticalPath(nodes, edges, VIOLATED_DELIVERY, PROJECT_START, TODAY);

  it('D has negative float when schedule is impossible', () => {
    expect((result.nodes.get('D')?.float ?? 0)).toBeLessThan(0);
  });

  it('totalViolatedDays is positive', () => {
    expect(result.totalViolatedDays).toBeGreaterThan(0);
  });

  it('D verdict is VIOLATED', () => {
    expect(result.nodes.get('D')?.verdict).toBe('VIOLATED');
  });
});

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

describe('critical-path, cycle detection', () => {
  it('throws on a cyclic graph', () => {
    const nodes = new Map<string, GraphNode>([
      ['X', makeNode('X', 5)],
      ['Y', makeNode('Y', 5)],
    ]);
    const edges: GraphEdge[] = [
      { from: 'X', to: 'Y' },
      { from: 'Y', to: 'X' },
    ];
    expect(() =>
      computeCriticalPath(nodes, edges, '2026-12-31', '2026-01-01'),
    ).toThrow('cycle detected');
  });
});
