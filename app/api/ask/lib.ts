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
];

export function matchAbstention(question: string): string | null {
  for (const { pattern, reason } of ABSTENTION_PATTERNS) {
    if (pattern.test(question)) return reason;
  }
  return null;
}

export function hashEmbed(text: string, dim: number = EMBEDDING_DIM): Float32Array {
  const vec = new Float32Array(dim);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const tok of tokens) {
    const digest = createHash('md5').update(tok, 'utf8').digest();
    const idx = digest.readUInt32LE(0) % dim;
    vec[idx] += 1;
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
  const paraMatch = question.match(/\(([a-z0-9]+)(?:\(([a-z0-9]+)\))?\)/i);
  const hits = allChunks.filter((c) => c.section === section);
  hits.sort((a, b) => {
    const score = (c: ChunkRow): number => {
      let s = 0;
      if (paraMatch && c.paragraph_path.startsWith(`(${paraMatch[1]}`)) s += 10;
      if (paraMatch && c.paragraph_path === `(${paraMatch[1]})(1)`) s += 6;
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
  return {
    cfrTitle: c.cfr_title,
    part: c.part,
    section: c.section,
    paragraphPath: c.paragraph_path,
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
  const citations = cfrChunks.slice(0, 3).map(chunkToCitation);
  return { answer, citations };
}
