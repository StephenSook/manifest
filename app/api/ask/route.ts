// app/api/ask/route.ts
// POST /api/ask
//
// Retrieval-augmented Q&A over the regulatory corpus.
// Pipeline: pre-check abstention triggers -> embed query -> cosine retrieval ->
//           granite-4-h-small generation -> granite-guardian-3-8b audit ->
//           respond or degrade to abstention.
//
// Credentials (WATSONX_API_KEY, WATSONX_PROJECT_ID, WATSONX_REGION) are read
// from process.env only. Never referenced in client bundles.
//
// Response contract (PLAN.md Shared Contracts):
//   { answer: string | null, citations: Citation[], audited: boolean,
//     abstained: boolean, reason?: string }
//   answer is null whenever abstained is true -- no exceptions.
//
// Authority: PLAN.md tasks 1.6 and 2.6, D2 (cite or abstain).

import { NextRequest, NextResponse } from 'next/server';
import type { Citation } from '../../../engine/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AskRequest {
  question: string;
  missionContext?: Record<string, unknown>;
}

interface AskResponse {
  answer: string | null;
  citations: Citation[];
  audited: boolean;
  abstained: boolean;
  reason?: string;
}

interface ChunkRow {
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

// ---------------------------------------------------------------------------
// Corpus cache (module-scope, populated on first request)
// ---------------------------------------------------------------------------

interface CorpusCache {
  chunks: ChunkRow[];
  vectors: Float32Array;
  dim: number;
  count: number;
}

let corpusCache: CorpusCache | null = null;
let corpusLoadPromise: Promise<CorpusCache> | null = null;

// ---------------------------------------------------------------------------
// Known abstention triggers (pre-generation fast path)
// These questions cannot be answered from the corpus regardless of retrieval.
// ---------------------------------------------------------------------------

const ABSTENTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
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
];

// ---------------------------------------------------------------------------
// Corpus loading from Vercel Blob (cold start) or local files (dev)
// ---------------------------------------------------------------------------

async function loadCorpus(): Promise<CorpusCache> {
  if (corpusCache) return corpusCache;
  if (corpusLoadPromise) return corpusLoadPromise;

  corpusLoadPromise = (async () => {
    let sqliteBytes: ArrayBuffer;
    let vectorBytes: ArrayBuffer;
    let schemaJson: { dim: number; count: number };

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (blobToken) {
      // Production: fetch from Vercel Blob
      const { list } = await import('@vercel/blob');
      const { blobs } = await list({ prefix: 'corpus/', token: blobToken });
      const urls: Record<string, string> = {};
      for (const b of blobs) {
        urls[b.pathname] = b.url;
      }
      if (!urls['corpus/manifest.sqlite'] || !urls['corpus/vectors.f32'] || !urls['corpus/schema.json']) {
        throw new Error(
          'Corpus artifacts not found in Vercel Blob. Run the corpus-build workflow first.',
        );
      }
      [sqliteBytes, vectorBytes] = await Promise.all([
        fetch(urls['corpus/manifest.sqlite']).then((r) => r.arrayBuffer()),
        fetch(urls['corpus/vectors.f32']).then((r) => r.arrayBuffer()),
      ]);
      schemaJson = await fetch(urls['corpus/schema.json']).then((r) => r.json());
    } else {
      // Development: read from local filesystem (node fs)
      const { readFile } = await import('fs/promises');
      const path = await import('path');
      const root = process.cwd();
      const [sqliteBuf, vecBuf, schemaBuf] = await Promise.all([
        readFile(path.join(root, 'corpus', 'manifest.sqlite')),
        readFile(path.join(root, 'corpus', 'vectors.f32')),
        readFile(path.join(root, 'corpus', 'schema.json')),
      ]);
      sqliteBytes = sqliteBuf.buffer.slice(sqliteBuf.byteOffset, sqliteBuf.byteOffset + sqliteBuf.byteLength);
      vectorBytes = vecBuf.buffer.slice(vecBuf.byteOffset, vecBuf.byteOffset + vecBuf.byteLength);
      schemaJson = JSON.parse(schemaBuf.toString('utf-8'));
    }

    // Parse vectors
    const { dim, count } = schemaJson;
    const vectors = new Float32Array(vectorBytes);

    // Parse SQLite using sql.js
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(sqliteBytes));
    const result = db.exec('SELECT * FROM chunks ORDER BY chunk_index');
    const cols = result[0]?.columns ?? [];
    const rows: ChunkRow[] = (result[0]?.values ?? []).map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, i) => { obj[col] = row[i]; });
      return obj as unknown as ChunkRow;
    });
    db.close();

    corpusCache = { chunks: rows, vectors, dim, count };
    return corpusCache;
  })();

  return corpusLoadPromise;
}

// ---------------------------------------------------------------------------
// Cosine similarity retrieval
// ---------------------------------------------------------------------------

function cosineSimilarity(query: Float32Array, matrix: Float32Array, dim: number, n: number): Float32Array {
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

function topK(scores: Float32Array, k: number): number[] {
  return Array.from(scores.keys())
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, k);
}

// ---------------------------------------------------------------------------
// watsonx helpers
// ---------------------------------------------------------------------------

function getWatsonxConfig() {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const region = process.env.WATSONX_REGION ?? 'us-south';
  if (!apiKey || !projectId) {
    throw new Error('WATSONX_API_KEY and WATSONX_PROJECT_ID must be set');
  }
  return { apiKey, projectId, url: `https://${region}.ml.cloud.ibm.com` };
}

async function embedQuery(question: string): Promise<Float32Array> {
  const { WatsonXAI } = await import('@ibm-cloud/watsonx-ai');
  const cfg = getWatsonxConfig();
  const client = WatsonXAI.newInstance({ serviceUrl: cfg.url, authenticator: { apikey: cfg.apiKey } as never });
  const resp = await client.textEmbeddings({
    projectId: cfg.projectId,
    modelId: 'ibm/granite-embedding-278m-multilingual',
    inputs: [{ text: question }],
    parameters: { truncate_input_tokens: 512 },
  });
  const vec = resp.result.results[0].embedding as number[];
  return new Float32Array(vec);
}

async function generateAnswer(
  question: string,
  contextChunks: ChunkRow[],
): Promise<{ rawAnswer: string; citations: Citation[] }> {
  const { WatsonXAI } = await import('@ibm-cloud/watsonx-ai');
  const cfg = getWatsonxConfig();
  const client = WatsonXAI.newInstance({ serviceUrl: cfg.url, authenticator: { apikey: cfg.apiKey } as never });

  const context = contextChunks
    .map((c, i) => {
      const ref = c.cfr_title > 0
        ? `[${i + 1}] ${c.cfr_title} CFR ${c.section}${c.paragraph_path} (AMDDATE: ${c.amddate})`
        : `[${i + 1}] ${c.source_doc ?? c.id} (AMDDATE: ${c.amddate})`;
      return `${ref}\n${c.text}`;
    })
    .join('\n\n');

  const prompt = `You are a regulatory assistant for US CubeSat licensing. Answer only from the provided context.
Every claim must cite the exact CFR section and paragraph (e.g., 47 CFR 97.207(g)). If the context does not support an answer, say "I cannot answer from the provided regulatory text."

Context:
${context}

Question: ${question}

Answer (cite every claim with its CFR section and AMDDATE):`;

  const resp = await client.textGeneration({
    projectId: cfg.projectId,
    modelId: 'ibm/granite-4-h-small',
    input: prompt,
    parameters: { max_new_tokens: 512, temperature: 0 },
  });
  const rawAnswer = resp.result.results[0].generated_text.trim();

  // Extract citations from retrieved chunks that the model likely used
  // (simple heuristic: check if the section appears in the answer)
  const citations: Citation[] = [];
  for (const c of contextChunks) {
    if (c.cfr_title === 0) continue;
    const sectionRef = `${c.section}${c.paragraph_path}`;
    if (rawAnswer.includes(c.section) || rawAnswer.includes(sectionRef)) {
      citations.push({
        cfrTitle: c.cfr_title,
        part: c.part,
        section: c.section,
        paragraphPath: c.paragraph_path,
        amddate: c.amddate,
        sourceUrl: c.source_url,
      });
    }
  }

  return { rawAnswer, citations };
}

async function runGuardianAudit(
  question: string,
  answer: string,
  context: string,
): Promise<{ passed: boolean; reason?: string }> {
  const { WatsonXAI } = await import('@ibm-cloud/watsonx-ai');
  const cfg = getWatsonxConfig();
  const client = WatsonXAI.newInstance({ serviceUrl: cfg.url, authenticator: { apikey: cfg.apiKey } as never });

  // Granite Guardian prompt: check for hallucination and unsupported claims
  const guardianPrompt = `You are a regulatory compliance auditor. Check whether the Answer is fully supported by the Context. Respond with exactly one word: PASS or FAIL.

Context: ${context.slice(0, 2000)}

Question: ${question}

Answer: ${answer}

Audit result (PASS or FAIL):`;

  const resp = await client.textGeneration({
    projectId: cfg.projectId,
    modelId: 'ibm/granite-guardian-3-8b',
    input: guardianPrompt,
    parameters: { max_new_tokens: 8, temperature: 0 },
  });
  const result = resp.result.results[0].generated_text.trim().toUpperCase();
  const passed = result.startsWith('PASS');
  return { passed, reason: passed ? undefined : `Guardian audit: ${result}` };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse<AskResponse>> {
  let body: AskRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { answer: null, citations: [], audited: false, abstained: true, reason: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { question } = body;
  if (!question?.trim()) {
    return NextResponse.json(
      { answer: null, citations: [], audited: false, abstained: true, reason: 'Question is required' },
      { status: 400 },
    );
  }

  // --- Step A: pre-check abstention triggers ---
  for (const { pattern, reason } of ABSTENTION_PATTERNS) {
    if (pattern.test(question)) {
      return NextResponse.json({
        answer: null,
        citations: [],
        audited: false,
        abstained: true,
        reason,
      });
    }
  }

  // --- Step B: load corpus ---
  let corpus: CorpusCache;
  try {
    corpus = await loadCorpus();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { answer: null, citations: [], audited: false, abstained: true, reason: `Corpus unavailable: ${msg}` },
      { status: 503 },
    );
  }

  // --- Step C: check watsonx config ---
  const hasWatsonx = !!(process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID);
  if (!hasWatsonx) {
    // Return the top retrieved chunks as abstention (no generation without creds)
    const mockVec = new Float32Array(corpus.dim).fill(0.1);
    const scores = cosineSimilarity(mockVec, corpus.vectors, corpus.dim, corpus.count);
    const indices = topK(scores, 3);
    const topChunks = indices.map((i) => corpus.chunks[i]);
    const citations = topChunks
      .filter((c) => c.cfr_title > 0)
      .map((c) => ({
        cfrTitle: c.cfr_title,
        part: c.part,
        section: c.section,
        paragraphPath: c.paragraph_path,
        amddate: c.amddate,
        sourceUrl: c.source_url,
      }));
    return NextResponse.json({
      answer: null,
      citations,
      audited: false,
      abstained: true,
      reason: 'WATSONX_API_KEY not configured. Retrieval-only mode.',
    });
  }

  // --- Step D: embed question + retrieve top 5 ---
  let queryVec: Float32Array;
  try {
    queryVec = await embedQuery(question);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { answer: null, citations: [], audited: false, abstained: true, reason: `Embedding failed: ${msg}` },
    );
  }

  const scores = cosineSimilarity(queryVec, corpus.vectors, corpus.dim, corpus.count);
  const topIndices = topK(scores, 5);
  const topChunks = topIndices.map((i) => corpus.chunks[i]);
  const contextText = topChunks.map((c) => c.text).join('\n\n');

  // --- Step E: generate answer ---
  let rawAnswer: string;
  let citations: Citation[];
  try {
    ({ rawAnswer, citations } = await generateAnswer(question, topChunks));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { answer: null, citations: [], audited: false, abstained: true, reason: `Generation failed: ${msg}` },
    );
  }

  // If model said it cannot answer, return abstention
  if (rawAnswer.toLowerCase().includes('cannot answer from')) {
    return NextResponse.json({
      answer: null,
      citations: topChunks
        .filter((c) => c.cfr_title > 0)
        .map((c) => ({
          cfrTitle: c.cfr_title, part: c.part, section: c.section,
          paragraphPath: c.paragraph_path, amddate: c.amddate, sourceUrl: c.source_url,
        })),
      audited: false,
      abstained: true,
      reason: 'Model could not answer from the provided regulatory text.',
    });
  }

  // --- Step F: Guardian audit ---
  let auditPassed: boolean;
  let auditReason: string | undefined;
  try {
    const audit = await runGuardianAudit(question, rawAnswer, contextText);
    auditPassed = audit.passed;
    auditReason = audit.reason;
  } catch (err) {
    // Guardian failure degrades to abstention (D2)
    const msg = err instanceof Error ? err.message : String(err);
    auditPassed = false;
    auditReason = `Guardian unavailable: ${msg}`;
  }

  if (!auditPassed) {
    return NextResponse.json({
      answer: null,
      citations: topChunks
        .filter((c) => c.cfr_title > 0)
        .map((c) => ({
          cfrTitle: c.cfr_title, part: c.part, section: c.section,
          paragraphPath: c.paragraph_path, amddate: c.amddate, sourceUrl: c.source_url,
        })),
      audited: true,
      abstained: true,
      reason: auditReason ?? 'Guardian audit failed.',
    });
  }

  // --- Pass: return answer with citations ---
  return NextResponse.json({
    answer: rawAnswer,
    citations,
    audited: true,
    abstained: false,
  });
}
