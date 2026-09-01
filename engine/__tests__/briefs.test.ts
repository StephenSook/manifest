import { describe, expect, it } from 'vitest';
import { buildGraph } from '../graph';
import { computeCriticalPath } from '../critical-path';
import { renderBriefs } from '../briefs';
import type { MissionInput } from '../types';

const MISSION: MissionInput = {
  launchDate: '2026-12-01',
  deliveryDate: '2026-10-15',
  lvDeterminationDate: '2026-08-01',
  integrationDate: '2026-11-01',
  pathway: 'part-97-amateur',
  frequencyMHz: 437.5,
  imagingEarth: false,
  apogeeKm: 550,
  perigeeKm: 550,
  ballisticCoefficient: 180,
};
const TODAY = '2026-09-01';
const PROJECT_START = '2026-06-01';

function compute(today: string = TODAY) {
  const { nodes, edges } = buildGraph(MISSION);
  return computeCriticalPath(
    nodes,
    edges,
    MISSION.deliveryDate,
    PROJECT_START,
    today,
  );
}

function briefs(today: string = TODAY) {
  return renderBriefs(compute(today), MISSION, today);
}

describe('two audiences, one set of facts', () => {
  it('produces a non-empty brief for both audiences', () => {
    const { owner, advisor } = briefs();
    // Anti-vacuity: two empty briefs would satisfy every parity check below.
    expect(owner.items.length).toBeGreaterThan(0);
    expect(advisor.items.length).toBe(owner.items.length);
    expect(owner.citations.length).toBeGreaterThan(0);
  });

  it('THE INVARIANT: both audiences carry identical citations', () => {
    const { owner, advisor } = briefs();
    // Not "similar", identical. The whole point of rendering twice is that a
    // judge switching depth sees the same regulatory basis. If a claim is not
    // supportable, it is absent from BOTH, which is cite-or-abstain applied
    // to presentation rather than only to generation.
    expect(advisor.citations).toEqual(owner.citations);
  });

  it('both audiences describe the same nodes, in the same order', () => {
    const { owner, advisor } = briefs();
    expect(advisor.items.map((i) => i.nodeId)).toEqual(
      owner.items.map((i) => i.nodeId),
    );
    expect(advisor.items.map((i) => i.violatedDays)).toEqual(
      owner.items.map((i) => i.violatedDays),
    );
  });

  it('only the PROSE differs, and the advisor prose carries no section numbers', () => {
    const { owner, advisor } = briefs();
    const cfr = /\d{1,3}\s*CFR\s*\d/i;
    const result = compute();
    let withCitation = 0;
    for (const item of owner.items) {
      const node = result.nodes.get(item.nodeId)!;
      if (node.citation) {
        // A regulatory node shows its section inline for this reader.
        expect(item.text).toMatch(cfr);
        withCitation += 1;
      } else {
        // Not every node is regulatory. The delivery wall is a launch
        // provider deadline, so it names its documented source instead of a
        // CFR section. It must still name SOMETHING: a line with neither is
        // an unsourced claim.
        expect(item.text).toContain(node.source);
        expect(node.source.length).toBeGreaterThan(0);
      }
    }
    expect(withCitation).toBeGreaterThan(0);
    for (const item of advisor.items) {
      // The advisor still HAS the citations, on the brief. They are just not
      // in the sentence, because a section number is not what that reader
      // needs to act.
      expect(item.text).not.toMatch(cfr);
    }
    expect(advisor.citations.length).toBeGreaterThan(0);
  });

  it('the advisor line states a documented consequence, not an invented one', () => {
    const result = compute();
    const { advisor } = renderBriefs(result, MISSION, TODAY);
    for (const item of advisor.items) {
      const node = result.nodes.get(item.nodeId);
      expect(node).toBeDefined();
      expect(item.text).toContain(node!.latenessConsequence);
    }
  });

  it('is a pure function of its inputs, including the date', () => {
    expect(briefs()).toEqual(briefs());
    const result = compute();
    const later = renderBriefs(result, MISSION, '2026-10-01');
    // A month later, the same nodes are further past their latest start.
    expect(later.owner.items[0].violatedDays).toBeGreaterThan(
      renderBriefs(result, MISSION, TODAY).owner.items[0].violatedDays,
    );
  });

  it('the headline total matches the engine, not a recount', () => {
    const result = compute();
    const { owner, advisor } = renderBriefs(result, MISSION, TODAY);
    expect(owner.headline).toContain(`${result.totalViolatedDays} days`);
    expect(advisor.headline).toContain(`${result.totalViolatedDays} days`);
  });
});
