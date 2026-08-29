// app/api/ask/route.ts
// POST /api/ask
//
// Retrieval-augmented Q&A over the regulatory corpus.
// Pipeline: pre-check abstention triggers -> embed query -> cosine retrieval ->
//           granite-4-h-small generation (or extractive fallback) ->
//           granite-guardian-3-8b audit -> respond or degrade to abstention.
//
// Credentials (WATSONX_API_KEY, WATSONX_PROJECT_ID, WATSONX_REGION) are read
// from process.env only. Never referenced in client bundles.
//
// Response contract (PLAN.md Shared Contracts):
//   { answer: string | null, citations: Citation[], audited: boolean,
//     abstained: boolean, reason?: string }
//   answer is null whenever abstained is true. No exceptions.
//
// Authority: PLAN.md tasks 1.6 and 2.6, D2 (cite or abstain).

import { NextRequest, NextResponse } from 'next/server';
import type { Citation } from '../../../engine/types';
import { corsPreflight, withCors } from '@/lib/cors';
import {
  type ChunkRow,
  cosineSimilarity,
  extractiveAnswer,
  hashEmbed,
  hybridSelect,
  matchAbstention,
  topK,
  chunkToCitation,
  resolveCfrCitations,
  formatCfrReference,
  parseGuardianVerdict,
} from './lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

interface CorpusCache {
  chunks: ChunkRow[];
  vectors: Float32Array;
  dim: number;
  count: number;
  model: string;
  /** Per-bucket IDF weights for hashing-trick retrieval (schema.bucketIdf) */
  bucketIdf?: number[];
}

let corpusCache: CorpusCache | null = null;
let corpusLoadPromise: Promise<CorpusCache> | null = null;

interface SchemaJson {
  dim: number;
  count: number;
  model?: string;
  bucketIdf?: number[];
}

interface CorpusBytes {
  sqliteBytes: Uint8Array;
  vectorBytes: Uint8Array;
  schemaJson: SchemaJson;
}

function toUint8(data: Buffer | ArrayBuffer): Uint8Array {
  return data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(data);
}

async function readLocalCorpus(): Promise<CorpusBytes | null> {
  const { readFile } = await import('fs/promises');
  const path = await import('path');
  const root = process.cwd();
  try {
    const [sqliteBuf, vecBuf, schemaBuf] = await Promise.all([
      readFile(path.join(root, 'corpus', 'manifest.sqlite')),
      readFile(path.join(root, 'corpus', 'vectors.f32')),
      readFile(path.join(root, 'corpus', 'schema.json')),
    ]);
    return {
      sqliteBytes: toUint8(sqliteBuf),
      vectorBytes: toUint8(vecBuf),
      schemaJson: JSON.parse(schemaBuf.toString('utf-8')) as SchemaJson,
    };
  } catch {
    return null;
  }
}

async function readBlobCorpus(token: string): Promise<CorpusBytes | null> {
  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: 'corpus/', token });
  const urls: Record<string, string> = {};
  for (const b of blobs) {
    urls[b.pathname] = b.url;
  }
  if (!urls['corpus/manifest.sqlite'] || !urls['corpus/vectors.f32'] || !urls['corpus/schema.json']) {
    return null;
  }
  const [sqliteRaw, vectorRaw, schemaJson] = await Promise.all([
    fetch(urls['corpus/manifest.sqlite']).then((r) => r.arrayBuffer()),
    fetch(urls['corpus/vectors.f32']).then((r) => r.arrayBuffer()),
    fetch(urls['corpus/schema.json']).then((r) => r.json() as Promise<SchemaJson>),
  ]);
  return {
    sqliteBytes: toUint8(sqliteRaw),
    vectorBytes: toUint8(vectorRaw),
    schemaJson,
  };
}

async function loadCorpus(): Promise<CorpusCache> {
  if (corpusCache) return corpusCache;
  if (corpusLoadPromise) return corpusLoadPromise;

  corpusLoadPromise = (async () => {
    // Committed freeze first so /api/ask works on Vercel without Blob.
    // Blob is optional overlay when corpus-build has uploaded artifacts.
    let loaded = await readLocalCorpus();
    if (!loaded) {
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      if (blobToken) loaded = await readBlobCorpus(blobToken);
    }
    if (!loaded) {
      throw new Error(
        'Corpus artifacts not found. Expected corpus/manifest.sqlite and corpus/vectors.f32 in the deploy, or Vercel Blob after corpus-build.',
      );
    }
    const { sqliteBytes, vectorBytes, schemaJson } = loaded;

    const { dim, count } = schemaJson;
    const vecCopy = new ArrayBuffer(vectorBytes.byteLength);
    new Uint8Array(vecCopy).set(vectorBytes);
    const vectors = new Float32Array(vecCopy);
    if (vectors.length !== dim * count) {
      throw new Error(
        `vectors.f32 length ${vectors.length} does not match schema dim*count ${dim * count}`,
      );
    }

    const path = await import('path');
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs({
      locateFile: (file: string) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    });
    const db = new SQL.Database(sqliteBytes);
    const result = db.exec('SELECT * FROM chunks ORDER BY chunk_index');
    const cols = result[0]?.columns ?? [];
    const rows: ChunkRow[] = (result[0]?.values ?? []).map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, i) => { obj[col] = row[i]; });
      return obj as unknown as ChunkRow;
    });
    db.close();

    corpusCache = {
      chunks: rows,
      vectors,
      dim,
      count,
      model: schemaJson.model ?? 'unknown',
      bucketIdf: schemaJson.bucketIdf,
    };
    return corpusCache;
  })().catch((err) => {
    corpusLoadPromise = null;
    throw err;
  });

  return corpusLoadPromise;
}

function getWatsonxConfig() {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const region = process.env.WATSONX_REGION ?? 'us-south';
  if (!apiKey || !projectId) {
    throw new Error('WATSONX_API_KEY and WATSONX_PROJECT_ID must be set');
  }
  return { apiKey, projectId, url: `https://${region}.ml.cloud.ibm.com` };
}

// The SDK's authenticate() contract requires a real Authenticator instance;
// a plain { apikey } object fails at request time with
// "this.authenticator.authenticate is not a function".
async function watsonxClient() {
  const { WatsonXAI } = await import('@ibm-cloud/watsonx-ai');
  const { IamAuthenticator } = await import('ibm-cloud-sdk-core');
  const cfg = getWatsonxConfig();
  return {
    cfg,
    client: WatsonXAI.newInstance({
      serviceUrl: cfg.url,
      version: '2024-03-14',
      authenticator: new IamAuthenticator({ apikey: cfg.apiKey }),
    }),
  };
}

async function embedQueryWatsonx(question: string): Promise<Float32Array> {
  const { cfg, client } = await watsonxClient();
  const resp = await client.embedText({
    projectId: cfg.projectId,
    modelId: 'ibm/granite-embedding-278m-multilingual',
    inputs: [question],
    parameters: { truncate_input_tokens: 512 },
  });
  const vec = resp.result.results[0].embedding as number[];
  return new Float32Array(vec);
}

async function generateAnswer(
  question: string,
  contextChunks: ChunkRow[],
): Promise<{
  rawAnswer: string;
  citations: Citation[];
  unresolvedRefs?: string[];
}> {
  const { cfg, client } = await watsonxClient();

  const context = contextChunks
    .map((c, i) => {
      const ref = c.cfr_title > 0
        ? `[${i + 1}] ${c.cfr_title} CFR ${c.section}${c.paragraph_path} (AMDDATE: ${c.amddate})`
        : `[${i + 1}] ${c.source_doc ?? c.id} (AMDDATE: ${c.amddate})`;
      return `${ref}\n${c.text}`;
    })
    .join('\n\n');

  const prompt = `You are a regulatory assistant for US CubeSat licensing. Answer only from the provided context.
Every claim must cite the exact CFR section and paragraph (e.g., 47 CFR 97.207(g)(1)). If the context does not support an answer, say "I cannot answer from the provided regulatory text."

Context:
${context}

Question: ${question}

Answer (cite every claim with its CFR section and AMDDATE):`;

  const resp = await client.generateText({
    projectId: cfg.projectId,
    modelId: 'ibm/granite-4-h-small',
    input: prompt,
    parameters: { max_new_tokens: 512, temperature: 0 },
  });
  // Chat-tuned Granite can prefix its role marker ("assistant") to the text.
  const rawAnswer = resp.result.results[0].generated_text
    .trim()
    .replace(/^assistant\s*:?\s*/i, '');

  // Citation resolution (hard rule 1: cite or abstain). CFR references in
  // the answer are parsed canonically and resolved to retrieved chunks by
  // EXACT section-plus-path match (section-only references resolve at
  // section level only when no pathed reference to that section exists:
  // see resolveCfrCitations). Document chunks attach only when the answer
  // names the document, or when the context was document-only. An answer
  // resolving to zero citations is converted to abstention by the caller.
  const citations: Citation[] = [];
  const seen = new Set<string>();
  const push = (c: ChunkRow) => {
    const key = `${c.section}|${c.paragraph_path}|${c.source_doc ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push(chunkToCitation(c));
    }
  };
  const resolved = resolveCfrCitations(rawAnswer, contextChunks);
  if (resolved.unresolved.length > 0) {
    // Cite or abstain (hard rule 1): the answer cited at least one
    // reference that does not resolve exactly against the retrieved
    // context (wrong title, fabricated paragraph path, or a section the
    // retrieval never returned). A partially resolvable answer never
    // ships with only its valid subset of citations.
    return {
      rawAnswer,
      citations: [],
      unresolvedRefs: resolved.unresolved.map(formatCfrReference),
    };
  }
  for (const c of resolved.chunks) {
    push(c);
  }
  const cfrChunks = contextChunks.filter((c) => c.cfr_title > 0);
  const docChunks = contextChunks.filter((x) => x.cfr_title === 0);
  const docMentioned = (c: ChunkRow): boolean => {
    const name = c.source_doc ?? '';
    const fragments = ['CubeSat 101', 'DAS', 'FCC 26-47', 'FCC 22-74', 'Part 100'];
    return fragments.some((f) => name.includes(f) && rawAnswer.includes(f));
  };
  for (const c of docChunks) {
    if (docMentioned(c)) push(c);
  }
  if (citations.length === 0 && cfrChunks.length === 0 && docChunks.length > 0) {
    push(docChunks[0]);
  }

  return { rawAnswer, citations };
}

async function runGuardianAudit(
  question: string,
  answer: string,
  context: string,
): Promise<{ passed: boolean; reason?: string }> {
  const { cfg, client } = await watsonxClient();

  const guardianPrompt = `You are a regulatory compliance auditor. Check whether the Answer is fully supported by the Context. Respond with exactly one word: PASS or FAIL.

Context: ${context.slice(0, 2000)}

Question: ${question}

Answer: ${answer}

Audit result (PASS or FAIL):`;

  // max_new_tokens 40, not 8: the model can open with its own safety-template
  // preamble, and at 8 tokens the verdict was cut off before it arrived
  // (measured live 2026-08-29, three of seven audit abstentions were exactly
  // this truncation). One retry with a reinforced one-word instruction covers
  // the responses that carry no verdict token at all; after that, fail closed.
  const reinforcedPrompt =
    guardianPrompt +
    ' Reply with the single word PASS or the single word FAIL. Do not restate any definition.';
  let lastResult = '';
  for (const input of [guardianPrompt, reinforcedPrompt]) {
    const resp = await client.generateText({
      projectId: cfg.projectId,
      modelId: 'ibm/granite-guardian-3-8b',
      input,
      parameters: { max_new_tokens: 40, temperature: 0 },
    });
    lastResult = resp.result.results[0].generated_text.trim().toUpperCase();
    const verdict = parseGuardianVerdict(lastResult);
    if (verdict === 'pass') return { passed: true };
    if (verdict === 'fail') {
      return { passed: false, reason: `Guardian audit: ${lastResult}` };
    }
  }
  return {
    passed: false,
    reason: `Guardian audit returned no verdict: ${lastResult.slice(0, 80)}`,
  };
}

function retrieveTop(
  corpus: CorpusCache,
  queryVec: Float32Array,
  k: number,
  question: string,
): ChunkRow[] {
  const scores = cosineSimilarity(queryVec, corpus.vectors, corpus.dim, corpus.count);
  const cosineTop = topK(scores, k).map((i) => corpus.chunks[i]).filter(Boolean);
  return hybridSelect(question, cosineTop, corpus.chunks, k);
}

export function OPTIONS(): NextResponse {
  return corsPreflight();
}

export async function POST(req: NextRequest): Promise<NextResponse<AskResponse>> {
  return withCors(await handleAsk(req));
}

async function handleAsk(req: NextRequest): Promise<NextResponse<AskResponse>> {
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

  const abstainReason = matchAbstention(question);
  if (abstainReason) {
    return NextResponse.json({
      answer: null,
      citations: [],
      audited: false,
      abstained: true,
      reason: abstainReason,
    });
  }

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

  const useHash = corpus.model.startsWith('hashing-trick') || corpus.model === 'mock';
  let queryVec: Float32Array;
  try {
    queryVec = useHash
      ? hashEmbed(question, corpus.dim, corpus.bucketIdf)
      : await embedQueryWatsonx(question);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { answer: null, citations: [], audited: false, abstained: true, reason: `Embedding failed: ${msg}` },
    );
  }

  const topChunks = retrieveTop(corpus, queryVec, 8, question);
  const contextText = topChunks.map((c) => c.text).join('\n\n');
  const hasWatsonx = !!(process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID);

  if (!hasWatsonx) {
    const { answer, citations } = extractiveAnswer(question, topChunks);
    return NextResponse.json({
      answer,
      citations,
      audited: false,
      abstained: false,
      reason: 'Extractive fallback: WATSONX_API_KEY not configured. Quoted from retrieved corpus text.',
    });
  }

  let rawAnswer: string;
  let citations: Citation[];
  let unresolvedRefs: string[] | undefined;
  try {
    ({ rawAnswer, citations, unresolvedRefs } = await generateAnswer(question, topChunks));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { answer: null, citations: [], audited: false, abstained: true, reason: `Generation failed: ${msg}` },
    );
  }

  if (rawAnswer.toLowerCase().includes('cannot answer from')) {
    return NextResponse.json({
      answer: null,
      citations: topChunks.filter((c) => c.cfr_title > 0).map(chunkToCitation),
      audited: false,
      abstained: true,
      reason: 'Model could not answer from the provided regulatory text.',
    });
  }

  if (unresolvedRefs && unresolvedRefs.length > 0) {
    // Cite or abstain (hard rule 1): the answer cited unresolvable
    // references (wrong title, fabricated paragraph, or an unretrieved
    // section), so it does not ship even if other citations resolved.
    return NextResponse.json({
      answer: null,
      citations: topChunks.filter((c) => c.cfr_title > 0).map(chunkToCitation),
      audited: false,
      abstained: true,
      reason: `The generated answer cited references that do not resolve against the retrieved context (${unresolvedRefs.join(', ')}), so it does not ship. Retrieved sections are listed.`,
    });
  }

  if (citations.length === 0) {
    // Cite or abstain (hard rule 1): no resolvable citation means no
    // answer. The retrieved sections are shown so the user sees what the
    // corpus offered.
    return NextResponse.json({
      answer: null,
      citations: topChunks.filter((c) => c.cfr_title > 0).map(chunkToCitation),
      audited: false,
      abstained: true,
      reason: 'The generated answer did not cite any retrieved section, so it does not ship. Retrieved sections are listed.',
    });
  }

  let auditPassed: boolean;
  let auditReason: string | undefined;
  try {
    const audit = await runGuardianAudit(question, rawAnswer, contextText);
    auditPassed = audit.passed;
    auditReason = audit.reason;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    auditPassed = false;
    auditReason = `Guardian unavailable: ${msg}`;
  }

  if (!auditPassed) {
    return NextResponse.json({
      answer: null,
      citations: topChunks.filter((c) => c.cfr_title > 0).map(chunkToCitation),
      audited: true,
      abstained: true,
      reason: auditReason ?? 'Guardian audit failed.',
    });
  }

  return NextResponse.json({
    answer: rawAnswer,
    citations,
    audited: true,
    abstained: false,
  });
}
