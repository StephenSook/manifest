// Guard: the frozen hashing-trick bundle must be in the tree. A deploy
// without corpus/manifest.sqlite is the /api/ask 503 the uptime workflow
// names. Fail here rather than skip.

import { existsSync, readFileSync, statSync } from 'fs';
import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import {
  extractiveAnswer,
  hashEmbed,
  hybridSelect,
  topK,
  cosineSimilarity,
  type ChunkRow,
} from '../lib';

describe('frozen corpus bundle', () => {
  it('ships sqlite, vectors, and schema in the repo', () => {
    expect(existsSync('corpus/manifest.sqlite')).toBe(true);
    expect(existsSync('corpus/vectors.f32')).toBe(true);
    expect(existsSync('corpus/schema.json')).toBe(true);
    expect(statSync('corpus/manifest.sqlite').size).toBeGreaterThan(1_000_000);
    expect(statSync('corpus/vectors.f32').size).toBeGreaterThan(1_000_000);
  });

  it('schema count matches vectors.f32 byte length', () => {
    const schema = JSON.parse(readFileSync('corpus/schema.json', 'utf8')) as {
      count: number;
      dim: number;
      model: string;
      bucketIdf?: number[];
    };
    const bytes = statSync('corpus/vectors.f32').size;
    expect(bytes).toBe(schema.count * schema.dim * 4);
    expect(schema.model).toMatch(/^hashing-trick/);
    expect(schema.bucketIdf).toHaveLength(schema.dim);
  });

  it('uptime dual-clock question cites 97.207(g)(1)', async () => {
    const schema = JSON.parse(readFileSync('corpus/schema.json', 'utf8')) as {
      count: number;
      dim: number;
      bucketIdf: number[];
    };
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('corpus/manifest.sqlite'));
    const result = db.exec('SELECT * FROM chunks ORDER BY chunk_index');
    const cols = result[0]?.columns ?? [];
    const chunks: ChunkRow[] = (result[0]?.values ?? []).map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, i) => { obj[col] = row[i]; });
      return obj as unknown as ChunkRow;
    });
    db.close();
    expect(chunks.some((c) => c.section === '97.207' && c.paragraph_path === '(g)(1)')).toBe(true);

    const vecBuf = readFileSync('corpus/vectors.f32');
    const vecCopy = new ArrayBuffer(vecBuf.byteLength);
    new Uint8Array(vecCopy).set(vecBuf);
    const vectors = new Float32Array(vecCopy);
    const question = 'What is the 97.207(g) dual-clock deadline?';
    const queryVec = hashEmbed(question, schema.dim, schema.bucketIdf);
    const scores = cosineSimilarity(queryVec, vectors, schema.dim, schema.count);
    const cosineTop = topK(scores, 8).map((i) => chunks[i]).filter(Boolean);
    const selected = hybridSelect(question, cosineTop, chunks, 8);
    const { citations } = extractiveAnswer(question, selected);
    const hit = citations.some((c) => {
      const combined = `${c.section}${c.paragraphPath}`.replace(/ /g, '');
      return combined.includes('97.207') && combined.includes('(g)(1)');
    });
    expect(hit).toBe(true);
  });
});
