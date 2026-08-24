import { describe, expect, it } from 'vitest';
import {
  extractiveAnswer,
  hashEmbed,
  hybridSelect,
  matchAbstention,
  type ChunkRow,
} from '../lib';

const g1: ChunkRow = {
  chunk_index: 0,
  id: '47-97-97.207-g_1_',
  cfr_title: 47,
  part: 97,
  section: '97.207',
  paragraph_path: '(g)(1)',
  text: 'A pre-space notification within 30 days after the date of launch vehicle determination, but no later than 90 days before integration of the space station into the launch vehicle.',
  amddate: '2026-08-13',
  source_url: 'https://www.govinfo.gov/bulkdata/ECFR/title-47/ECFR-title47.xml',
  source_doc: null,
};

describe('matchAbstention', () => {
  it('traps fee schedule questions', () => {
    const reason = matchAbstention('What is the FCC application fee for a CubeSat?');
    expect(reason).toBeTruthy();
    expect(reason).toMatch(/Fee schedules/);
  });

  it('traps Part 100 effective date with the D3 sentence', () => {
    const reason = matchAbstention('When does Part 100 take effect?');
    expect(reason).toContain('Part 100 was adopted July 22, 2026 (FCC 26-47)');
    expect(reason).toContain('Part 25 remains binding today');
  });

  it('traps the unpublished Part 25 to Part 100 crosswalk', () => {
    const reason = matchAbstention('Where is the Part 25 to Part 100 crosswalk?');
    expect(reason).toMatch(/crosswalk has not been published/i);
  });

  it('traps NASA-STD-8719.14C because it is not ingested', () => {
    const reason = matchAbstention('What does NASA-STD-8719.14C require for debris assessment?');
    expect(reason).toMatch(/login wall/i);
  });

  it('does not trap a grounded 97.207 question', () => {
    expect(matchAbstention('What is the 97.207(g) deadline?')).toBeNull();
  });
});

describe('hashEmbed', () => {
  it('is deterministic and unit-length', () => {
    const a = hashEmbed('pre-space notification 30 days');
    const b = hashEmbed('pre-space notification 30 days');
    expect(Array.from(a)).toEqual(Array.from(b));
    let norm = 0;
    for (let i = 0; i < a.length; i++) norm += a[i] * a[i];
    expect(Math.sqrt(norm)).toBeCloseTo(1, 5);
  });

  it('differs for unrelated text', () => {
    const a = hashEmbed('pre-space notification');
    const b = hashEmbed('zzzz unrelated tokens xyzabc');
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    expect(dot).toBeLessThan(0.5);
  });
});

describe('hybridSelect', () => {
  it('boosts 97.207(g)(1) when the question cites that section', () => {
    const noise: ChunkRow = { ...g1, id: 'noise', section: '25.283', paragraph_path: '(e)' };
    const selected = hybridSelect('What is the 97.207(g) deadline?', [noise], [noise, g1], 3);
    expect(selected[0].section).toBe('97.207');
    expect(selected[0].paragraph_path).toBe('(g)(1)');
  });
});

describe('extractiveAnswer', () => {
  it('quotes the retrieved chunk and cites 97.207(g)(1)', () => {
    const { answer, citations } = extractiveAnswer(
      'What is the 97.207(g) deadline?',
      [g1],
    );
    expect(answer).toContain('30 days');
    expect(answer).toContain('97.207(g)(1)');
    expect(answer).toContain('2026-08-13');
    expect(citations[0].section).toBe('97.207');
    expect(citations[0].paragraphPath).toBe('(g)(1)');
    expect(citations[0].amddate).toBe('2026-08-13');
  });
});
