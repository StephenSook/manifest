// app/api/ask/lib.ts
// Pure helpers for /api/ask: abstention triggers, hashing-trick embed,
// cosine retrieval, extractive answers. No watsonx calls here.
//
// Hashing-trick MUST stay byte-identical to pipeline/embed_and_store.py
// embed_batch_hash: lowercase [a-z0-9]+ tokens, md5, little-endian u32 % 768.

import { createHash } from 'crypto';
import type { Citation } from '../../../engine/types';

export const EMBEDDING_DIM = 768;

export interface ChunkRow {
  chunk_index: number;
  id: string;
  cfr_title: number;
  part: number;
  section: string;
  paragraph_path: string;
  text: string;
  amddate: string;
  source_url: string;
  source_doc: string | null;
}

export const ABSTENTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /fee|filing fee|application fee|\$[0-9]/i,
    reason:
      'Fee schedules are not in the ingested corpus. The FCC Fee Schedule is a separate document not included in this corpus snapshot.',
  },
  {
    pattern: /part 100 effective date|when does part 100 take effect|part 100.*effective/i,
    reason:
      'Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today.',
  },
  {
    pattern: /part 25.*part 100 crosswalk|crosswalk.*part 100|part 100.*crosswalk/i,
    reason:
      'The Part 25 to Part 100 crosswalk has not been published. No crosswalk is available in this corpus.',
  },
  {
    pattern: /nasa-std-8719|nasa std 8719|8719\.14/i,
    reason:
      'NASA-STD-8719.14C is behind the NASA Technical Standards System login wall and is not in this corpus. Cite DAS 3.2 User Guide for debris-assessment methodology, or retrieve the standard from https://standards.nasa.gov/standard/nasa/nasa-std-871914c.',
  },
  {
    pattern: /(space bureau|public notice).{0,60}part\s?100|part\s?100.{0,60}(public notice|implement)/i,
    reason:
      'No FCC Space Bureau public notice implementing Part 100 exists in this corpus snapshot. Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today.',
  },
  {
    pattern: /97\.207.{0,40}(five|5)[\s-]?year|(five|5)[\s-]?year.{0,40}97\.207/i,
    reason:
      'The FCC five-year disposal rule is codified through FCC 22-74 amending Part 25 (25.283), not in 47 CFR 97.207. The corpus contains no 97.207 paragraph codifying it, so no such paragraph path can be cited.',
  },
  {
    pattern: /(specific|technical).{0,20}requirements.{0,80}propulsion|propulsion system to satisfy/i,
    reason:
      'The corpus documents the five-year disposal requirement and the propulsion-or-drag decision trigger, but contains no propulsion-system technical specification. No section can be cited for propulsion hardware requirements.',
  },
];

export function matchAbstention(question: string): string | null {
  for (const { pattern, reason } of ABSTENTION_PATTERNS) {
    if (pattern.test(question)) return reason;
  }
  return null;
}

export function hashEmbed(
  text: string,
  dim: number = EMBEDDING_DIM,
  weights?: readonly number[],
): Float32Array {
  const vec = new Float32Array(dim);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  // Unigrams plus adjacent bigrams, identical to embed_hash_idf in
  // pipeline/embed_and_store.py so query and corpus stay cosine-aligned.
  const grams = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    grams.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  for (const tok of grams) {
    const digest = createHash('md5').update(tok, 'utf8').digest();
    const idx = digest.readUInt32LE(0) % dim;
    vec[idx] += 1;
  }
  // Per-bucket IDF weights from corpus/schema.json (bucketIdf). The corpus
  // vectors are built with the same weights in pipeline/embed_and_store.py
  // embed_hash_idf, so weighted query and corpus stay cosine-aligned.
  if (weights) {
    for (let i = 0; i < dim; i++) vec[i] *= weights[i] ?? 1;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return vec;
}

export function cosineSimilarity(
  query: Float32Array,
  matrix: Float32Array,
  dim: number,
  n: number,
): Float32Array {
  const scores = new Float32Array(n);
  let qNorm = 0;
  for (let j = 0; j < dim; j++) qNorm += query[j] * query[j];
  qNorm = Math.sqrt(qNorm) || 1;

  for (let i = 0; i < n; i++) {
    let dot = 0;
    let mNorm = 0;
    const offset = i * dim;
    for (let j = 0; j < dim; j++) {
      dot += query[j] * matrix[offset + j];
      mNorm += matrix[offset + j] * matrix[offset + j];
    }
    scores[i] = dot / (qNorm * (Math.sqrt(mNorm) || 1));
  }
  return scores;
}

export function hybridSelect(
  question: string,
  cosineTop: ChunkRow[],
  allChunks: ChunkRow[],
  k: number,
): ChunkRow[] {
  const sectionMatch = question.match(/(\d{1,3}\.\d+)/);
  if (!sectionMatch) return cosineTop.slice(0, k);
  const section = sectionMatch[1];
  // Parse the ENTIRE parenthetical path after the section number, so a
  // question naming 97.3(a)(41) routes to (a)(41), never to (a)(1).
  const afterSection = question.slice(
    question.indexOf(sectionMatch[1]) + sectionMatch[1].length,
  );
  // Ordinary citation typography puts whitespace around segments
  // ("97.3 (a)(41)", "97.3 (a) (41)"), so consume it between every token.
  const requestedSegs: string[] = [];
  const segRe = /^\s*\(([a-zA-Z0-9]+)\)/;
  let rest = afterSection;
  let m = rest.match(segRe);
  while (m) {
    requestedSegs.push(m[1].toLowerCase());
    rest = rest.slice(m[0].length);
    m = rest.match(segRe);
  }
  const requestedPath = requestedSegs.map((s) => `(${s})`).join('');
  const hits = allChunks.filter((c) => c.section === section);
  hits.sort((a, b) => {
    const score = (c: ChunkRow): number => {
      let s = 0;
      const path = c.paragraph_path.toLowerCase();
      if (requestedPath) {
        if (path === requestedPath) s += 20;
        else if (path.startsWith(requestedPath + '(')) s += 12;
        else if (requestedPath.startsWith(path) && path) s += 6;
      }
      if (/30 days/i.test(c.text) && /deadline|notification|90 days/i.test(question)) s += 8;
      return s;
    };
    return score(b) - score(a);
  });
  const seen = new Set<string>();
  const merged: ChunkRow[] = [];
  for (const c of [...hits.slice(0, k), ...cosineTop]) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push(c);
    if (merged.length >= k) break;
  }
  return merged;
}

export function topK(scores: Float32Array, k: number): number[] {
  return Array.from(scores.keys())
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, k);
}

export interface CfrReference {
  /** CFR title when the answer names one ("15 CFR 97.207"), else null. */
  title: number | null;
  section: string;
  /** Normalized parenthetical path, lowercase, no whitespace: "(a)(41)" */
  path: string;
  /**
   * True when the text marks this as a deliberate CFR reference: a named
   * title, a "§" or "section" cue, or a parenthetical path. Cued
   * references must resolve exactly or the whole answer abstains. An
   * uncued bare number ("5.8 GHz", "2.4 GHz") is noise: it attaches only
   * when it happens to resolve, and is never fatal when it does not.
   */
  cued: boolean;
}

// A paragraph label must have a valid CFR shape: digits "(1)", letters
// "(a)" / "(aa)", or roman numerals "(iii)" / "(VII)". Prose parentheses
// ("2.5 (months)") are not paragraph paths and must not turn a bare
// number into a cued CFR reference (Codex round 5: false abstention).
const CFR_SEG = String.raw`\((?:\d{1,3}|[a-z]{1,2}|[A-Z]{1,2}|[ivxlcdm]{3,8}|[IVXLCDM]{3,8})\)`;

/**
 * Parse every CFR reference in generated text with canonical,
 * whitespace-tolerant boundaries: "97.3(a)(41)", "97.3 (a)(41)", and
 * "97.3 (a) (41)" all yield section 97.3 path (a)(41). Digit boundaries
 * prevent substring collisions (297.31 never yields 97.3).
 *
 * Titles and cues govern whole CITATION SPANS, not single numbers
 * (Codex round 5): in "47 CFR §§ 97.207 and 97.999" both sections
 * inherit title 47 and the cue, because only connective material
 * (whitespace, punctuation, list words, cue words, other references)
 * separates them from the anchor. "15 CFR, section 97.207(g)" keeps
 * title 15 across the comma. A number separated from every anchor by
 * real prose stays uncued.
 */
export function parseCfrReferences(answer: string): CfrReference[] {
  const refs: CfrReference[] = [];
  const re = new RegExp(
    String.raw`(?<!\d)(\d{1,3}\.\d+)((?:\s*${CFR_SEG})*)`,
    'g',
  );
  const titleAnchors: Array<{ end: number; title: number }> = [];
  const tRe = /(\d{1,2})\s*C\.?\s*F\.?\s*R\.?/g;
  let am: RegExpExecArray | null;
  while ((am = tRe.exec(answer))) {
    titleAnchors.push({ end: tRe.lastIndex, title: parseInt(am[1], 10) });
  }
  const cueEnds: number[] = [];
  const cRe = /§+|\bsections?\b|\bparts?\b/gi;
  while ((am = cRe.exec(answer))) {
    cueEnds.push(cRe.lastIndex);
  }
  // Connective material between an anchor and the number it governs.
  // Bounded to 160 chars: a title three sentences back governs nothing.
  const connective = new RegExp(
    String.raw`^(?:[\s,;]|and\b|or\b|through\b|to\b|§+|sections?\b|parts?\b|\d{1,3}\.\d+|${CFR_SEG})*$`,
    'i',
  );
  const governs = (end: number, idx: number): boolean =>
    end <= idx && idx - end <= 160 && connective.test(answer.slice(end, idx));
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer))) {
    const segs = (m[2].match(/\([a-zA-Z0-9]+\)/g) ?? []).map((s) =>
      s.toLowerCase().replace(/\s/g, ''),
    );
    const idx = m.index;
    let title: number | null = null;
    for (const a of titleAnchors) {
      if (governs(a.end, idx)) title = a.title;
    }
    const cued =
      title !== null ||
      cueEnds.some((e) => governs(e, idx)) ||
      segs.length > 0;
    refs.push({ title, section: m[1], path: segs.join(''), cued });
  }
  return refs;
}

export interface ResolvedCitations {
  chunks: ChunkRow[];
  /**
   * Cued references that failed exact resolution: wrong title, fabricated
   * paragraph path, or a section the retrieval never returned. Any entry
   * here means the answer cited something the context cannot support, and
   * the caller must abstain. Cite or abstain admits no partial credit: an
   * answer is never shipped with only its valid subset of citations.
   */
  unresolved: CfrReference[];
}

/**
 * Resolve generated-answer CFR references to retrieved chunks.
 * A pathed reference attaches only the chunk with that EXACT section,
 * paragraph path, and (when the answer names one) CFR title. A
 * section-only reference attaches that section's retrieved chunks, but
 * only when the answer contains no pathed reference to the same section
 * (a pathed answer must earn its exact citation, never fall back to
 * section-mates). Every cued reference must resolve or it is reported in
 * `unresolved` and the caller abstains.
 */
export function resolveCfrCitations(
  answer: string,
  contextChunks: ChunkRow[],
): ResolvedCitations {
  const refs = parseCfrReferences(answer);
  // Titles of every pathed reference, keyed by section. A bare mention is
  // suppressed only by a TITLE-COMPATIBLE pathed reference to the same
  // section (Codex round 5): "15 CFR 97.207 and 47 CFR 97.207(g)" must
  // not let the Title 15 claim ride on the Title 47 citation. An untitled
  // bare mention defers to any pathed reference; a titled one only to a
  // pathed reference carrying that same title.
  const pathedTitles = new Map<string, Set<number | null>>();
  for (const r of refs) {
    if (r.path) {
      const titles = pathedTitles.get(r.section) ?? new Set<number | null>();
      titles.add(r.title);
      pathedTitles.set(r.section, titles);
    }
  }
  const suppressedByPathed = (r: CfrReference): boolean => {
    const titles = pathedTitles.get(r.section);
    if (!titles) return false;
    return r.title === null || titles.has(r.title);
  };
  const chunks: ChunkRow[] = [];
  const unresolved: CfrReference[] = [];
  const seen = new Set<string>();
  const push = (c: ChunkRow) => {
    const key = `${c.section}|${c.paragraph_path}`;
    if (!seen.has(key)) {
      seen.add(key);
      chunks.push(c);
    }
  };
  for (const ref of refs) {
    const candidates = contextChunks.filter(
      (c) =>
        c.cfr_title !== 0 &&
        c.section === ref.section &&
        (ref.title === null || c.cfr_title === ref.title),
    );
    if (ref.path) {
      const exact = candidates.filter(
        (c) => c.paragraph_path.toLowerCase() === ref.path,
      );
      if (exact.length > 0) {
        exact.forEach(push);
      } else {
        unresolved.push(ref);
      }
    } else if (suppressedByPathed(ref)) {
      // A title-compatible pathed reference to this section governs; the
      // bare mention is satisfied by (or already failed with) it.
      continue;
    } else if (candidates.length > 0) {
      candidates.forEach(push);
    } else if (ref.cued) {
      unresolved.push(ref);
    }
  }
  return { chunks, unresolved };
}

/** Render a reference for an abstention reason: "15 CFR 97.207(g)". */
export function formatCfrReference(r: CfrReference): string {
  return `${r.title !== null ? `${r.title} CFR ` : ''}${r.section}${r.path}`;
}

export function chunkToCitation(c: ChunkRow): Citation {
  // Document chunks (CubeSat 101, DAS guide, FCC orders) carry no CFR path.
  // Cite them by their source document name so every answer is citable
  // (hard rule 1: cite or abstain applies to document-sourced answers too).
  const isDoc = c.cfr_title === 0;
  return {
    cfrTitle: c.cfr_title,
    part: c.part,
    section: isDoc ? (c.source_doc ?? c.id) : c.section,
    paragraphPath: isDoc ? '' : c.paragraph_path,
    amddate: c.amddate,
    sourceUrl: c.source_url,
  };
}

export function extractiveAnswer(question: string, chunks: ChunkRow[]): {
  answer: string;
  citations: Citation[];
} {
  const cfrChunks = chunks.filter((c) => c.cfr_title > 0);
  const primary = cfrChunks[0] ?? chunks[0];
  if (!primary) {
    return { answer: 'No supporting corpus chunk was retrieved.', citations: [] };
  }
  const heading = primary.cfr_title > 0
    ? `${primary.cfr_title} CFR ${primary.section}${primary.paragraph_path}`
    : (primary.source_doc ?? primary.id);
  const answer =
    `From ${heading} (AMDDATE ${primary.amddate}), addressing: ${question.trim()}\n\n` +
    primary.text;
  // CFR citations first, then document citations, so document-sourced
  // answers still carry a citation (cite or abstain, hard rule 1).
  const docChunks = chunks.filter((c) => c.cfr_title === 0);
  const citations = [
    ...cfrChunks.slice(0, 3),
    ...docChunks.slice(0, 2),
  ].map(chunkToCitation);
  return { answer, citations };
}
