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
  const requestedSegs: string[] = [];
  const segRe = /^\(([a-zA-Z0-9]+)\)/;
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
