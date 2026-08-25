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

  it('drops a number followed by a measurement unit entirely', () => {
    const refs = parseCfrReferences('The downlink operates at 5.8 GHz.');
    expect(refs).toHaveLength(0);
  });

  it('treats a bare number without cue or unit as uncued noise', () => {
    const refs = parseCfrReferences('The overrun figure is 5.8 in the plan.');
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

describe('round-6 probes: case-insensitive titles, measurements stay noise', () => {
  it('lowercase cfr still isolates the title: 15 cfr 97.207(g) abstains', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'Under 15 cfr 97.207(g), notification is due.',
      [chunk()],
    );
    expect(chunks).toHaveLength(0);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].title).toBe(15);
  });

  it('mixed-case C.f.R. resolves with the right title', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'Per 47 C.f.R. 97.207(g), notification is due.',
      [chunk()],
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });

  it('prose "in part" does not promote a measurement into a citation', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'The filing addresses, in part, 5.8 GHz operation under 97.207(g).',
      [chunk()],
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });

  it('a measurement after a citation span does not inherit its title', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'Per 47 CFR 97.207, 5.8 GHz is used for the downlink.',
      [chunk()],
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });
});

describe('round-7 probes: W-words, Part cues, parenthesized units', () => {
  it('"was" after a citation is not a watt: the fabricated section abstains', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      '47 CFR 97.207 applies; section 25.999 was amended.',
      [chunk()],
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].section).toBe('25.999');
  });

  it('ordinary w-words never swallow a cued reference', () => {
    for (const word of ['was', 'which', 'when', 'with']) {
      const refs = parseCfrReferences(`Under section 25.114 ${word} amended.`);
      expect(refs).toHaveLength(1);
      expect(refs[0]).toMatchObject({ section: '25.114', cued: true });
    }
  });

  it('a standalone fabricated Part reference forces abstention', () => {
    const { unresolved } = resolveCfrCitations(
      'See 97.207(g) and Part 25.999 for details.',
      [chunk()],
    );
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].section).toBe('25.999');
  });

  it('a standalone valid Part reference resolves', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'See Part 97.207 for details.',
      [chunk()],
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });

  it('parenthesized unit-lookalike paths are fail-closed: unresolvable means abstain', () => {
    // Rounds 7-9 settled this: "(m)" and "(w)" are real CFR paragraph
    // labels, and no heuristic separates them from quantities without
    // opening a fail-open hole. Prose like "5.8 (m)" therefore abstains,
    // the safe direction under cite-or-abstain.
    for (const unit of ['m', 'W', 'kg', 'km']) {
      const { chunks, unresolved } = resolveCfrCitations(
        `The tether extends 5.8 (${unit}) beyond the bus, per 97.207(g).`,
        [chunk()],
      );
      expect(chunks).toHaveLength(1);
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].section).toBe('5.8');
    }
  });

  it('a titled reference with a unit-shaped path stays a citation', () => {
    const refs = parseCfrReferences('Per 47 CFR 97.207(m), stations comply.');
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ title: 47, path: '(m)', cued: true });
  });
});

describe('round-8 probes: unit-shaped paths stay fail-closed', () => {
  it('a real (m) paragraph citation resolves', () => {
    const ctx = [chunk({ section: '97.303', paragraph_path: '(m)' })];
    const { chunks, unresolved } = resolveCfrCitations(
      'Stations must comply with 97.303(m) at all times.',
      ctx,
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });

  it('a real (w) paragraph citation resolves', () => {
    const ctx = [chunk({ section: '25.208', paragraph_path: '(w)' })];
    const { chunks, unresolved } = resolveCfrCitations(
      'Power limits appear in 25.208(w).',
      ctx,
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });

  it('a fabricated tight unit-shaped path beside a valid citation abstains', () => {
    const { chunks, unresolved } = resolveCfrCitations(
      'See 97.207(g) and 25.999(m).',
      [chunk()],
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].section).toBe('25.999');
  });

  it('a spaced unit-shaped path that resolves is still a citation', () => {
    const ctx = [chunk({ section: '97.303', paragraph_path: '(m)' })];
    const { chunks, unresolved } = resolveCfrCitations(
      'Stations must comply with 97.303 (m) at all times.',
      ctx,
    );
    expect(chunks).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });
});

describe('round-9 probes: whitespace never exempts a pathed reference', () => {
  it('a spaced UNSUPPORTED real-label citation abstains beside a valid one', () => {
    for (const probe of [
      'See 97.207(g) and 97.303 (m).',
      'See 97.207(g) and 25.208 (w).',
    ]) {
      const { chunks, unresolved } = resolveCfrCitations(probe, [chunk()]);
      expect(chunks).toHaveLength(1);
      expect(unresolved).toHaveLength(1);
    }
  });

  it('a fabricated spaced unit-shaped path abstains', () => {
    const { unresolved } = resolveCfrCitations(
      'See 97.207(g) and 25.999 (m).',
      [chunk()],
    );
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].section).toBe('25.999');
  });

  it('tab and non-breaking-space variants behave identically', () => {
    for (const ws of ['\t', '\u00A0']) {
      const { unresolved } = resolveCfrCitations(
        `See 97.207(g) and 25.999${ws}(m).`,
        [chunk()],
      );
      expect(unresolved).toHaveLength(1);
    }
  });

  it('an unresolvable same-section pathed ref abstains rather than enabling suppression', () => {
    const ctx = [
      chunk(),
      chunk({
        id: '47-25-25.114-c',
        part: 25,
        section: '25.114',
        paragraph_path: '(c)',
      }),
    ];
    const { unresolved } = resolveCfrCitations(
      'Section 97.207 applies, spans 97.207 (m), and cites 25.114(c).',
      ctx,
    );
    expect(unresolved.length).toBeGreaterThan(0);
  });
});
