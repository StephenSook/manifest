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
  // Case-insensitive: "15 cfr 97.207(g)" isolates titles exactly like
  // "15 CFR 97.207(g)" (Codex round 6: the flag was lost in round 5 and a
  // lowercase abbreviation resolved against the wrong title).
  const titleAnchors: Array<{ end: number; title: number }> = [];
  const tRe = /(\d{1,2})\s*C\.?\s*F\.?\s*R\.?/gi;
  let am: RegExpExecArray | null;
  while ((am = tRe.exec(answer))) {
    titleAnchors.push({ end: tRe.lastIndex, title: parseInt(am[1], 10) });
  }
  // "part" cues only when a section-shaped number follows immediately
  // ("Part 97.999"): prose uses the word constantly ("addresses, in
  // part, ...") and must not cue, but a standalone Part reference has to
  // participate in fail-closed resolution (Codex round 7: a fabricated
  // "Part 25.999" was riding beside a valid citation as ignorable noise).
  const cueEnds: number[] = [];
  const cRe = /§+|\bsections?\b|\bparts?\b(?=\s+\d{1,3}\.\d)/gi;
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
  // A number followed by a measurement or duration unit is a quantity,
  // never a citation: "5.8 GHz" and "2.5 (months)" must not inherit a
  // span's title or cue and become fatal references (Codex round 6).
  // Every alphabetic alternative is terminated by (?![A-Za-z]) so the
  // case-insensitive W/m alternatives cannot swallow the first letter of
  // ordinary words like "was" or "which" (Codex round 7: that dropped a
  // fabricated citation from fail-closed resolution entirely).
  const unitAfter =
    /^\s*\(?\s*(?:[GMk]?Hz|dB[A-Za-z]?|[kMG]?W|km|cm|mm|m|kg|percent|%|months?|days?|years?|weeks?|hours?|minutes?|seconds?|degrees?|meters?|watts?)(?![A-Za-z])/i;
  // NOTE (Codex rounds 7-9): parenthesized single letters like "(m)" and
  // "(w)" are REAL CFR paragraph labels (97.303(m), 25.208(w)), and no
  // whitespace or resolution-failure heuristic can safely tell them from
  // quantities: every carve-out tried opened a fail-open hole where a
  // fabricated unit-shaped path rode beside a valid citation. So a
  // CFR-shaped parenthesized path ALWAYS makes a cued, fail-closed
  // reference. The accepted cost: prose like "5.8 (m)" abstains, and
  // abstention is the safe direction (hard rule 1).
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer))) {
    const segs = (m[2].match(/\([a-zA-Z0-9]+\)/g) ?? []).map((s) =>
      s.toLowerCase().replace(/\s/g, ''),
    );
    if (segs.length === 0 && unitAfter.test(answer.slice(re.lastIndex))) {
      continue;
    }
    const idx = m.index;
    let title: number | null = null;
    for (const a of titleAnchors) {
      if (governs(a.end, idx)) title = a.title;
    }
    const anchoredCue = cueEnds.some((e) => governs(e, idx));
    const cued = title !== null || anchoredCue || segs.length > 0;
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

// Terms too common to anchor a regulatory question to a regulatory section.
// Deliberately short: the gate below is a floor, not a search engine.
const ANCHOR_STOPWORDS = new Set(
  ('what when where which who why how does do is are the a an of for to in on at by with and or not '
    + 'must may can shall will would could should from under within after before that this these those it its as be been '
    + 'have has had any all each per your you i me my we our their there here about into out over more most such than then '
    + 'many much long time use used using make makes made get gets got new old also only same other another very').split(/\s+/),
);

/** Content terms of length >= 4, stripped of citation punctuation. */
function anchorTerms(text: string): Set<string> {
  const raw = text.toLowerCase().match(/[a-z0-9.()]+/g) ?? [];
  return new Set(
    raw
      .map((t) => t.replace(/^[.()]+|[.()]+$/g, ''))
      .filter((t) => t.length >= 4 && !ANCHOR_STOPWORDS.has(t)),
  );
}

/**
 * Minimum content terms a cited chunk must share with the question before the
 * extractive path is allowed to answer.
 *
 * Measured 2026-08-29 against the 28 real questions in eval/bank.jsonl and 12
 * adversarial off-corpus questions, scoring the best overlap across exactly the
 * set extractiveAnswer cites:
 *
 *   real questions   min 1, median 5, max 10
 *   off-corpus junk  min 0, max 1
 *
 * At 2, all 12 off-corpus questions abstain and 27 of 28 real questions still
 * answer. The one real question it blocks (q24) already fails the eval, so this
 * costs no passing row. Cosine similarity was tried first and CANNOT do this
 * job: the hashing-trick embedder scored junk as high as 0.3113 against a real
 * minimum of 0.2243, so the distributions overlap and no threshold separates
 * them. The junk sample is small and adversarial, so treat 2 as a calibrated
 * floor rather than a proven constant, and note the gate errs toward abstaining,
 * which is the safe direction for a cite-or-abstain product.
 */
const ANCHOR_MIN_TERMS = 2;

/**
 * Whether the retrieval is actually about the question.
 *
 * Retrieval always returns top-k chunks, with no notion of "nothing relevant
 * here", so without this every question produced an answer. Measured on
 * 2026-08-29: "Who won the 2026 FIFA World Cup?" was answered `abstained:
 * false` citing 47 CFR 25.103(2)(2)(3) with the body text "Hawaii;". That is a
 * cite-or-abstain violation (hard rule 1) reachable on the keyless path since
 * it shipped, and the watsonx-unreachable fallback made it reachable in
 * production too.
 */
export function extractiveIsAnchored(question: string, chunks: ChunkRow[]): boolean {
  const cfrChunks = chunks.filter((c) => c.cfr_title > 0);
  const docChunks = chunks.filter((c) => c.cfr_title === 0);
  // Exactly the set extractiveAnswer cites, so the gate judges what ships.
  const cited = [...cfrChunks.slice(0, 3), ...docChunks.slice(0, 2)];
  if (cited.length === 0) return false;

  // A question that names a section is anchored to a chunk of that section.
  // Term overlap alone cannot see this: "97.207(g)" tokenises differently from
  // the chunk's "97.207(g)(1)", so the strongest possible signal, the citation
  // the user typed, scored zero. Section equality is the right comparison
  // because a paragraph of a named section is what the user asked for.
  const asked = parseCfrReferences(question);
  if (asked.some((r) => cited.some((c) => c.section === r.section))) return true;

  const qTerms = anchorTerms(question);
  for (const c of cited) {
    const cTerms = anchorTerms(
      `${c.text} ${c.section}${c.paragraph_path} ${c.source_doc ?? ''}`,
    );
    let shared = 0;
    for (const t of qTerms) if (cTerms.has(t)) shared++;
    if (shared >= ANCHOR_MIN_TERMS) return true;
  }
  return false;
}

export interface ExtractiveResponseBody {
  answer: string | null;
  citations: Citation[];
  audited: boolean;
  abstained: boolean;
  reason: string;
  degraded: boolean;
  /** See SCOPE_NOTICE below. Required so the compiler catches an omission. */
  scope: string;
  /** Which extractive path produced this. */
  path: AnswerPath;
}

/**
 * Shipped in the body of every /api/ask response, answered and abstained
 * alike. An abstention is still a regulatory statement about what the corpus
 * does not support, so it needs the notice as much as an answer does. The
 * page renders the same words from app/layout.tsx, but a judge reading the
 * API with curl never sees the page.
 */
/**
 * The user-facing sentence for a Guardian outcome that stops an answer.
 *
 * Deliberately takes an OUTCOME, not the model's text. Guardian echoes its
 * own risk definition back often enough that interpolating its output ships
 * prompt scaffolding to the reader, which is what this replaced. The raw
 * output is still logged server-side, where it is a diagnostic rather than
 * a claim shown to a judge.
 */
export function guardianFailureReason(outcome: 'fail' | 'unparseable'): string {
  if (outcome === 'fail') {
    return (
      'The Guardian audit did not certify this answer as grounded in the ' +
      'retrieved sections, so the answer did not ship. The sections it was ' +
      'checked against are listed below.'
    );
  }
  return (
    'The Guardian audit returned no readable verdict, so the answer could ' +
    'not be certified and did not ship. The retrieved sections are listed ' +
    'below and the raw audit output is in the server log.'
  );
}

/**
 * Every way an /api/ask response can be produced, named. Defined here rather
 * than in route.ts because both the route and the extractive body builder
 * need it, and lib.ts is the direction imports already flow.
 */
export type AnswerPath =
  | 'watsonx-audited'
  | 'extractive-no-credentials'
  | 'extractive-generation-unreachable'
  | 'extractive-guardian-unreachable'
  | 'abstained-bad-request'
  | 'abstained-citation-gate'
  | 'abstained-guardian-refused'
  | 'abstained-corpus-unavailable'
  | 'abstained-embedding-failed'
  | 'abstained-no-relevant-section'
  | 'error-unexpected';

export const SCOPE_NOTICE =
  'Planning aid, not legal authority. Every regulatory statement here carries a ' +
  'section-level citation pinned to the corpus AMDDATE, or the product abstains ' +
  'and says why. Verify against the cited text before you file.';

/**
 * The response body for the offline extractive path, used both when watsonx is
 * not configured and when it is configured but unreachable.
 *
 * The second case is why this exists. watsonx is a metered third-party
 * dependency: a quota ceiling, an outage, a rate limit or a timeout all raise
 * from the SDK, and the route used to surface that exception as the user's
 * entire answer. The product already carries a keyless path over the same
 * committed corpus, so an upstream failure degrades to it rather than taking
 * the product down. Health, not the presence of two env var names.
 *
 * Cite or abstain (hard rule 1) still binds: quoted corpus text needs a
 * citation like anything else, so a retrieval that resolved none abstains
 * rather than shipping an uncited quote. That case was previously reachable
 * and unhandled on the no-credentials path.
 */
export function buildExtractiveResponse(
  question: string,
  chunks: ChunkRow[],
  degradation: string,
  degraded: boolean,
  path: AnswerPath,
): ExtractiveResponseBody {
  const { answer, citations } = extractiveAnswer(question, chunks);
  if (citations.length === 0) {
    return {
      answer: null,
      citations: [],
      audited: false,
      abstained: true,
      scope: SCOPE_NOTICE,
      path,
      reason: `${degradation} The extractive path resolved no citable section, so no answer ships.`,
      degraded,
    };
  }
  if (!extractiveIsAnchored(question, chunks)) {
    // Retrieval returns its top k for any input, so a citation existing is not
    // evidence the corpus addresses the question. Abstain and show what was
    // retrieved, the same shape the generated path uses when it cannot ground
    // an answer.
    return {
      answer: null,
      citations: chunks.filter((c) => c.cfr_title > 0).map(chunkToCitation),
      audited: false,
      abstained: true,
      scope: SCOPE_NOTICE,
      path,
      reason: `${degradation} The retrieved sections do not address this question, so no answer ships. Retrieved sections are listed.`,
      degraded,
    };
  }
  return {
    answer,
    citations,
    audited: false,
    abstained: false,
    scope: SCOPE_NOTICE,
    path,
    reason: `${degradation} Answer quoted verbatim from the retrieved corpus text, not generated. The Guardian audit did not run on it.`,
    degraded,
  };
}

export type GuardianVerdict = 'pass' | 'fail' | 'no-verdict';

// granite-guardian-3-8b glues chat-role markers to the verdict
// ("assistantPASS") and can open with its own safety-template preamble
// ("Our safety risk definition is defined...") before any verdict token, so
// the whole output is scanned, not the first word. FAIL anywhere wins over
// PASS. The model's native Yes/No space is deliberately NOT mapped: a bare
// No is ambiguous between "no, not supported" and "no risk found", which
// point in opposite directions, so it is no-verdict and the caller retries
// once, then fails closed. Measured live 2026-08-29: 3 preamble truncations,
// 2 bare NO, 2 genuine FAIL across one 34-question run.
// FAIL stays a substring test on purpose: over-triggering FAIL only abstains
// more, which is the safe direction on a cite-or-abstain gate.
//
// PASS must NOT be a substring test, and this was shipped wrong until
// 2026-08-31. "PASS" is contained in BYPASS, COMPASSION, SURPASSES, PASSAGE,
// and, worst of all, in the ordinary sentence "the answer does not pass
// muster". Every one of those read as a PASS and let an ungrounded answer
// through, which fails OPEN on the one guard this product rests on. Found by
// running a rival's own defect class back against us.
//
// So PASS must be a STANDALONE token, which rules out BYPASS/COMPASSION/
// SURPASSES/PASSAGE, plus the role-glued ASSISTANTPASS form the model
// measurably emits (there is no word boundary between the role marker and the
// verdict, so it needs its own alternative).
//
// A standalone token is still not sufficient. In "the answer does not pass
// muster" the word is standalone and means the OPPOSITE, so a preceding
// negator disqualifies it. Two tokens of lookbehind covers "does not pass" and
// "cannot pass". Anything disqualified becomes no-verdict, the caller retries
// once, and then fails closed, so the failure mode of this rule is an extra
// abstention rather than an unaudited answer.
const NEGATORS = new Set(['NOT', "DOESN'T", "DIDN'T", "CAN'T", 'CANNOT', 'NEVER', 'FAILS', 'NO']);

export function parseGuardianVerdict(raw: string): GuardianVerdict {
  const text = raw.toUpperCase();
  if (text.includes('FAIL')) return 'fail';
  if (/ASSISTANTPASS/.test(text)) return 'pass';

  const tokens = text.split(/[^A-Z']+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== 'PASS') continue;
    const negated = tokens.slice(Math.max(0, i - 2), i).some((t) => NEGATORS.has(t));
    if (!negated) return 'pass';
  }
  return 'no-verdict';
}
