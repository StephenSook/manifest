import { describe, expect, it } from 'vitest';
import {
  buildExtractiveResponse,
  extractiveAnswer,
  hashEmbed,
  hybridSelect,
  matchAbstention,
  type ChunkRow,
  SCOPE_NOTICE,
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

// Regression guard for 2026-08-29. The watsonx Lite token quota was exhausted,
// every generation call returned 403, and /api/ask answered every question
// with the raw SDK exception string as its reason while the keyless extractive
// path over the same committed corpus sat there working. The route gated the
// fallback on credential PRESENCE, so a configured-but-unreachable watsonx had
// no path to it. These assert the degraded path, not the absent-key path.
describe('buildExtractiveResponse', () => {
  const upstream =
    'Extractive path: watsonx generation was unreachable, so the generated answer did not ship (upstream error: Access is denied due to invalid credentials.).';

  it('answers from the corpus when watsonx is unreachable, and says so', () => {
    const body = buildExtractiveResponse('What is the 97.207(g) deadline?', [g1], upstream, true);
    expect(body.abstained).toBe(false);
    expect(body.answer).toContain('30 days');
    expect(body.citations[0].section).toBe('97.207');
    expect(body.degraded).toBe(true);
    expect(body.audited).toBe(false);
    expect(body.reason).toContain('quoted verbatim');
    expect(body.reason).toContain('Guardian audit did not run');
  });

  it('reports the upstream error as upstream text, without restating its cause', () => {
    const body = buildExtractiveResponse('What is the 97.207(g) deadline?', [g1], upstream, true);
    expect(body.reason).toContain('upstream error:');
    // The IBM SDK renders a 403 token_quota_reached as an invalid-credentials
    // message, so the route must not adopt that wording as its own diagnosis.
    expect(body.reason).not.toMatch(/^Generation failed/);
  });

  it('abstains rather than shipping an uncited quote (hard rule 1)', () => {
    const body = buildExtractiveResponse('What is the 97.207(g) deadline?', [], upstream, true);
    expect(body.abstained).toBe(true);
    expect(body.answer).toBeNull();
    expect(body.citations).toHaveLength(0);
    expect(body.reason).toContain('no citable section');
  });

  it('marks the absent-key path as not degraded, so the two are distinguishable', () => {
    const body = buildExtractiveResponse(
      'What is the 97.207(g) deadline?',
      [g1],
      'Extractive path: WATSONX_API_KEY is not configured on this deployment.',
      false,
    );
    expect(body.abstained).toBe(false);
    expect(body.degraded).toBe(false);
  });

  // Measured 2026-08-29 on the running server: "Who won the 2026 FIFA World
  // Cup?" came back abstained:false citing 47 CFR 25.103(2)(2)(3) with the body
  // text "Hawaii;". Retrieval returns its top k for any input, so a citation
  // existing was never evidence the corpus addressed the question.
  it('abstains on an off-corpus question instead of citing an unrelated section', () => {
    const body = buildExtractiveResponse('Who won the 2026 FIFA World Cup?', [g1], upstream, true);
    expect(body.abstained).toBe(true);
    expect(body.answer).toBeNull();
    expect(body.reason).toContain('do not address this question');
  });

  it('still lists the retrieved sections when it abstains for lack of anchor', () => {
    const body = buildExtractiveResponse('How do I bake sourdough bread?', [g1], upstream, true);
    expect(body.abstained).toBe(true);
    expect(body.citations.length).toBeGreaterThan(0);
    expect(body.citations[0].section).toBe('97.207');
  });

  it('keeps degraded machine-readable so a degraded run is never published as a watsonx score', () => {
    const degradedRun = buildExtractiveResponse('q', [g1], upstream, true);
    const keylessRun = buildExtractiveResponse('q', [g1], 'Extractive path: no key.', false);
    // The eval runner can separate a watsonx measurement from an extractive
    // one on this field alone, without parsing prose.
    expect(degradedRun.degraded).not.toBe(keylessRun.degraded);
  });
});

describe('the scope notice ships in the payload, not only on the page', () => {
  it('is present on an abstention', () => {
    const body = buildExtractiveResponse('anything', [], 'Degraded.', true);
    expect(body.scope).toContain('Planning aid, not legal authority');
    expect(body.scope).toContain('Verify against the cited text before you file');
  });

  it('states the pin, because the pin is what the whole rule rests on', () => {
    // A notice that says "planning aid" but not WHY the citations are
    // trustworthy is half a disclosure. The AMDDATE is the pin.
    expect(SCOPE_NOTICE).toContain('AMDDATE');
    expect(SCOPE_NOTICE).toContain('abstains');
  });
});
