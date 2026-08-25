// app/api/ask/__tests__/hybrid.test.ts
// Codex round-2 regression: full-path routing must tolerate ordinary
// citation whitespace ("97.3 (a)(41)", "97.3 (a) (41)") and must route to
// the exact requested paragraph, never to a sibling or to (a)(1).

import { describe, it, expect } from 'vitest';
import { hybridSelect, type ChunkRow } from '../lib';

function chunk(section: string, path: string): ChunkRow {
  return {
    chunk_index: 0,
    id: `47-97-${section}-${path}`,
    cfr_title: 47,
    part: 97,
    section,
    paragraph_path: path,
    text: `text of ${section}${path}`,
    amddate: '2026-08-13',
    source_url: 'https://www.govinfo.gov/bulkdata/ECFR/title-47/ECFR-title47.xml',
    source_doc: null,
  };
}

const ALL = [
  chunk('97.3', '(a)(1)'),
  chunk('97.3', '(a)(4)'),
  chunk('97.3', '(a)(40)'),
  chunk('97.3', '(a)(41)'),
  chunk('97.3', '(b)'),
];

const COSINE_TOP = [chunk('97.207', '(g)')];

describe('hybridSelect exact-path routing', () => {
  const cases = [
    'What does 97.3(a)(41) define?',
    'What does 97.3 (a)(41) define?',
    'What does 97.3 (a) (41) define?',
  ];
  for (const q of cases) {
    it(`routes "${q}" to (a)(41) first`, () => {
      const out = hybridSelect(q, COSINE_TOP, ALL, 3);
      expect(out[0].paragraph_path).toBe('(a)(41)');
    });
  }

  it('never prefers (a)(1) over the requested deeper path', () => {
    const out = hybridSelect('Explain 97.3(a)(40).', COSINE_TOP, ALL, 3);
    expect(out[0].paragraph_path).toBe('(a)(40)');
  });
});
