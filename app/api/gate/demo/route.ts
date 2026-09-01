/**
 * A judge-facing demonstration of the citation gate, in one unauthenticated GET.
 *
 * Borrowed from HITS, whose /gate/demo serves the same deterministic check
 * applied twice: once to a real explanation and once to a copy with one digit
 * of a solver figure transposed, so a reader watches the check pass and then
 * fail on a near-identical string. Our guards are proven red in CI, which is
 * the right place for them and the wrong place for a judge, who will not clone
 * the repo. This makes the strongest property we have clickable.
 *
 * Three rules make it a demonstration rather than theatre:
 *
 * 1. The honest text is a REAL committed response, verbatim from
 *    docs/evidence/live-responses.json, not written for this endpoint.
 * 2. The check is the REAL resolver, `resolveCfrCitations`, the same function
 *    /api/ask calls before it will ship an answer. Nothing here reimplements it.
 * 3. The fabrication is LEXICAL, not computed: one paragraph label is replaced
 *    in the answer text. A model that invents a citation does not derive it,
 *    it perturbs one it saw. And the perturbed path is asserted ABSENT from the
 *    corpus first, because a fabrication that happens to be a real provision
 *    would show the gate rejecting something true.
 */

import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { corsPreflight, withCors } from '@/lib/cors';
import { resolveCfrCitations, type ChunkRow } from '../../ask/lib';

export const dynamic = 'force-dynamic';

/** The real citation in the committed response, and the fake we substitute. */
const HONEST_PATH = '(g)(1)';
const FABRICATED_PATH = '(g)(4)';
const SECTION = '97.207';

interface GateSide {
  answer_excerpt: string;
  resolved_chunks: number;
  unresolved: string[];
  grounded: boolean;
  what_the_product_does: string;
}

function corpusChunksFor(section: string): ChunkRow[] {
  const dir = path.join(process.cwd(), 'corpus', 'chunks');
  const out: ChunkRow[] = [];
  // The committed corpus file for Title 47 Part 97. Named explicitly rather
  // than globbed: if this file is ever renamed, the demo must fail its own
  // precondition loudly rather than silently consult nothing and report a
  // fabrication as unresolvable for the wrong reason.
  const rows = JSON.parse(
    readFileSync(path.join(dir, 'title47-part97.json'), 'utf-8'),
  ) as Record<string, unknown>[];
  for (const row of rows) {
    if (String(row.section) !== section) continue;
    // The committed chunks use camelCase; ChunkRow is the snake_case shape the
    // resolver consumes. Map explicitly so a schema change cannot pass through
    // as undefined and quietly stop matching.
    out.push({
      chunk_index: 0,
      id: String(row.id),
      cfr_title: Number(row.cfrTitle),
      part: Number(row.part),
      section: String(row.section),
      paragraph_path: String(row.paragraphPath ?? ''),
      text: String(row.text ?? ''),
      amddate: String(row.amddate ?? ''),
      source_url: String(row.sourceUrl ?? ''),
      source_doc: null,
    });
  }
  return out;
}

export function OPTIONS(): NextResponse {
  return corsPreflight();
}

export function GET(): NextResponse {
  const evidence = JSON.parse(
    readFileSync(
      path.join(process.cwd(), 'docs', 'evidence', 'live-responses.json'),
      'utf-8',
    ),
  ) as { responses: { name: string; response: { answer: string | null } }[] };

  const honestAnswer = evidence.responses[0]?.response?.answer ?? '';
  const chunks = corpusChunksFor(SECTION);

  // The fabrication must not name a real provision. If (g)(4) ever became real,
  // this endpoint must fail loudly rather than quietly demonstrate a lie.
  const fabricationIsReal = chunks.some(
    (c) => String(c.paragraph_path) === FABRICATED_PATH,
  );
  if (fabricationIsReal || chunks.length === 0 || !honestAnswer) {
    return withCors(
      NextResponse.json(
        {
          error: 'DEMO_PRECONDITION_FAILED',
          detail: fabricationIsReal
            ? `${SECTION}${FABRICATED_PATH} now exists in the corpus, so it is no longer a fabrication. Pick another.`
            : 'The committed response or the corpus section is missing.',
        },
        { status: 500 },
      ),
    );
  }

  const fabricatedAnswer = honestAnswer.replaceAll(
    `${SECTION}${HONEST_PATH}`,
    `${SECTION}${FABRICATED_PATH}`,
  );

  const side = (answer: string, note: string): GateSide => {
    const resolved = resolveCfrCitations(answer, chunks);
    return {
      answer_excerpt: answer.slice(0, 220),
      resolved_chunks: resolved.chunks.length,
      unresolved: resolved.unresolved.map(
        (r) => `${r.title ?? '?'} CFR ${r.section}${r.path ?? ''}`,
      ),
      grounded: resolved.unresolved.length === 0,
      what_the_product_does: note,
    };
  };

  return withCors(
    NextResponse.json({
      what_this_shows:
        'The same resolver /api/ask runs before it will ship an answer, applied ' +
        'to a real committed response and to one copy of it with a single ' +
        'paragraph label changed. Nothing here is written for the demo except ' +
        'the substitution itself.',
      section: SECTION,
      honest_path: HONEST_PATH,
      fabricated_path: FABRICATED_PATH,
      fabrication_method:
        'One paragraph label replaced in the answer text. Lexical, not computed: ' +
        'a model that invents a citation perturbs one it saw rather than deriving ' +
        'it. The replacement path is asserted absent from the corpus before use.',
      corpus_chunks_consulted: chunks.length,
      honest: side(
        honestAnswer,
        'Every reference resolves against the retrieved sections, so the answer ships.',
      ),
      fabricated: side(
        fabricatedAnswer,
        'One reference resolves against nothing, so the answer is converted to an ' +
          'abstention naming what is missing. Cite or abstain admits no partial ' +
          'credit: the valid citations do not carry the answer on their own.',
      ),
      source: {
        honest_text: 'docs/evidence/live-responses.json, captured verbatim from production',
        resolver: 'app/api/ask/lib.ts resolveCfrCitations, the shipped function',
      },
    }),
  );
}
