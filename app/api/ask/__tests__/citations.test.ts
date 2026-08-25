// Codex round-4 adversarial reproductions for CFR reference resolution.
// A wrong-title reference must never resolve to a same-numbered section in
// a different title, and any cued reference that fails exact resolution
// forces abstention: an answer never ships with only its valid subset.

import { describe, expect, it } from 'vitest';
import {
  parseCfrReferences,
  resolveCfrCitations,
  formatCfrReference,
  type ChunkRow,
} from '../lib';

const chunk = (over: Partial<ChunkRow> = {}): ChunkRow => ({
  chunk_index: 0,
  id: '47-97-97.207-g',
  cfr_title: 47,
  part: 97,
  section: '97.207',
  paragraph_path: '(g)',
  text: 'Space stations paragraph text.',
  amddate: '2026-08-13',
  source_url: 'https://www.ecfr.gov/current/title-47/part-97',
  source_doc: null,
  ...over,
});

describe('parseCfrReferences title and cue capture', () => {
  it('captures a named title with section symbol', () => {
    const refs = parseCfrReferences('See 47 CFR § 25.114(c) for details.');
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      title: 47,
      section: '25.114',
      path: '(c)',
      cued: true,
    });
  });

  it('treats a bare number without any cue as uncued noise', () => {
    const refs = parseCfrReferences('The downlink operates at 5.8 GHz.');
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ title: null, section: '5.8', cued: false });
  });

  it('marks section-symbol references as cued', () => {
    const refs = parseCfrReferences('Under § 97.999 this is required.');
    expect(refs[0]).toMatchObject({ section: '97.999', cued: true });
  });
});

describe('resolveCfrCitations fail-closed resolution', () => {
  it('rejects a wrong-title reference instead of matching section number', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'Per 15 CFR 97.207(g), notification is due.',
      [chunk()],
    );
    expect(chunks).toHaveLength(0);
    expect(unresolved).toHaveLength(1);
    expect(formatCfrReference(unresolved[0])).toBe('15 CFR 97.207(g)');
  });

  it('resolves the same reference when the title matches', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'Per 47 CFR 97.207(g), notification is due.',
      [chunk()],
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });

  it('reports a fabricated path as unresolved even beside a valid citation', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'See 97.207(g) and also 97.207(z)(99).',
      [chunk()],
    );
    // The valid chunk still resolves, but the fabricated reference is
    // reported and the caller must abstain on the whole answer.
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].path).toBe('(z)(99)');
  });

  it('ignores uncued bare-number noise without abstaining', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'The 5.8 GHz downlink is governed by 97.207(g).',
      [chunk()],
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });

  it('reports a cued reference to an unretrieved section as unresolved', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'Under § 97.999 this is required.',
      [chunk()],
    );
    expect(chunks).toHaveLength(0);
    expect(unresolved).toHaveLength(1);
  });
});

describe('round-5 probes: citation spans, prose parens, mixed titles', () => {
  it('a list after §§ cues every member: fabricated 97.999 abstains', () => {
    const { unresolved } = resolveCfrCitations(
      'See 47 CFR §§ 97.207 and 97.999 for details.',
      [chunk()],
    );
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].section).toBe('97.999');
    expect(unresolved[0].title).toBe(47);
  });

  it('a comma does not break title inheritance: 15 CFR, section 97.207(g) abstains', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'Under 15 CFR, section 97.207(g), notification is due.',
      [chunk()],
    );
    expect(chunks).toHaveLength(0);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].title).toBe(15);
  });

  it('prose parentheses are not paragraph paths: 2.5 (months) never abstains', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'Delivery takes 2.5 (months) after the 97.207(g) filing.',
      [chunk()],
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });

  it('a titled bare mention is not suppressed by a differently-titled pathed reference', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'Both 15 CFR 97.207 and 47 CFR 97.207(g) apply.',
      [chunk()],
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(1);
    expect(formatCfrReference(unresolved[0])).toBe('15 CFR 97.207');
  });
});
