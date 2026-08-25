"""
pipeline/embed_and_store.py

Embed all corpus chunks using ibm/granite-embedding-278m-multilingual via
the watsonx SDK, then write:
  corpus/manifest.sqlite  - SQLite store of all chunks
  corpus/vectors.f32      - raw little-endian Float32Array (dim x N)
  corpus/schema.json      - dimensions, count, model, amddate_range

The hashing-trick freeze (manifest.sqlite + vectors.f32 + schema.json) is
committed so Vercel packs it into /api/ask. corpus-build.yml can still
upload a later Granite re-embed to Vercel Blob; the route tries local
files first and falls back to Blob.

Usage (requires WATSONX_API_KEY, WATSONX_PROJECT_ID, WATSONX_REGION):
  uv run --python 3.12 --project pipeline python pipeline/embed_and_store.py

For local smoke testing without watsonx credentials, pass --mock-embeddings:
  uv run --python 3.12 --project pipeline python pipeline/embed_and_store.py --mock-embeddings
"""

import argparse
import json
import os
import sqlite3
import struct
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

CHUNKS_DIR = Path("corpus/chunks")
OUTPUT_DIR = Path("corpus")
EMBEDDING_MODEL = "ibm/granite-embedding-278m-multilingual"
EMBEDDING_DIM = 768
BATCH_SIZE = 16   # conservative - stays within 2 req/sec Lite rate limit


def load_all_chunks() -> list[dict]:
    chunks = []
    for json_file in sorted(CHUNKS_DIR.glob("**/*.json")):
        # Skip the manual extractions markdown
        if not json_file.name.endswith(".json"):
            continue
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
            if isinstance(data, list):
                chunks.extend(data)
        except Exception as exc:
            print(f"  WARN: could not load {json_file}: {exc}", file=sys.stderr)
    return chunks


def embed_batch_watsonx(texts: list[str], client) -> list[list[float]]:
    """Call watsonx embedding model for a batch of texts."""
    from ibm_watsonx_ai.foundation_models import ModelInference
    from ibm_watsonx_ai.foundation_models.schema import TextEmbeddingParameters

    project_id = os.environ["WATSONX_PROJECT_ID"]
    model = ModelInference(
        model_id=EMBEDDING_MODEL,
        api_client=client,
        project_id=project_id,
    )
    response = model.embed_text(
        texts=texts,
        params=TextEmbeddingParameters(truncate_input_tokens=512),
    )
    return [r["embedding"] for r in response["results"]]


def embed_batch_mock(texts: list[str]) -> list[list[float]]:
    """Return deterministic mock embeddings (no watsonx call). For local testing."""
    rng = np.random.default_rng(seed=42)
    return [rng.random(EMBEDDING_DIM).tolist() for _ in texts]


def embed_batch_hash(texts: list[str]) -> list[list[float]]:
    """
    Content-addressed hashing-trick embeddings.

    Used when watsonx Lite cannot afford a 3524-chunk embed (see PLAN Q2).
    Query embedding in app/api/ask/lib.ts MUST use the same token regex and
    md5 little-endian bucket so cosine retrieval stays aligned.
    """
    import hashlib
    import re

    token_re = re.compile(r"[a-z0-9]+")
    out: list[list[float]] = []
    for text in texts:
        vec = np.zeros(EMBEDDING_DIM, dtype=np.float32)
        for tok in token_re.findall(text.lower()):
            digest = hashlib.md5(tok.encode("utf-8")).digest()
            idx = int.from_bytes(digest[:4], "little") % EMBEDDING_DIM
            vec[idx] += 1.0
        norm = float(np.linalg.norm(vec)) or 1.0
        out.append((vec / norm).tolist())
    return out


def embed_hash_idf(texts: list[str]) -> tuple[list[list[float]], list[float]]:
    """
    Hashing-trick embeddings with per-bucket IDF weighting.

    Two passes: raw token counts per bucket, then idf[b] = ln((N+1)/(df[b]+1))+1
    where df[b] is the number of chunks with a nonzero bucket b. Each chunk
    vector is count * idf, L2-normalized. Rare regulatory vocabulary (for
    example "pre-space") then dominates retrieval instead of common tokens.

    The QUERY side must apply the SAME weights: schema.json ships bucketIdf
    and app/api/ask/lib.ts hashEmbed(question, dim, bucketIdf) applies them.
    Token regex and md5 little-endian bucketing stay byte-identical.
    """
    import hashlib
    import re

    token_re = re.compile(r"[a-z0-9]+")
    n = len(texts)
    counts = np.zeros((n, EMBEDDING_DIM), dtype=np.float32)
    for row, text in enumerate(texts):
        toks = token_re.findall(text.lower())
        # Unigrams plus adjacent bigrams: multiword regulatory terms
        # ("pre-space notification", "remote sensing") retrieve as units.
        # lib.ts hashEmbed builds the identical token stream.
        grams = toks + [f"{toks[i]}_{toks[i + 1]}" for i in range(len(toks) - 1)]
        for tok in grams:
            digest = hashlib.md5(tok.encode("utf-8")).digest()
            idx = int.from_bytes(digest[:4], "little") % EMBEDDING_DIM
            counts[row, idx] += 1.0
    df = (counts > 0).sum(axis=0).astype(np.float64)
    idf = np.log((n + 1.0) / (df + 1.0)) + 1.0
    weighted = counts * idf.astype(np.float32)
    norms = np.linalg.norm(weighted, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    weighted = weighted / norms
    return weighted.tolist(), [round(float(x), 6) for x in idf]


def write_sqlite(chunks: list[dict], output_path: Path) -> None:
    conn = sqlite3.connect(str(output_path))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chunks (
            chunk_index INTEGER PRIMARY KEY,
            id TEXT NOT NULL,
            cfr_title INTEGER NOT NULL,
            part INTEGER NOT NULL,
            section TEXT NOT NULL,
            paragraph_path TEXT NOT NULL,
            text TEXT NOT NULL,
            amddate TEXT NOT NULL,
            source_url TEXT NOT NULL,
            source_doc TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_section ON chunks(cfr_title, part, section)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_amddate ON chunks(amddate)")

    rows = []
    for i, c in enumerate(chunks):
        rows.append((
            i,
            c.get("id", ""),
            c.get("cfrTitle", 0),
            c.get("part", 0),
            c.get("section", ""),
            c.get("paragraphPath", ""),
            c.get("text", ""),
            c.get("amddate", ""),
            c.get("sourceUrl", ""),
            c.get("sourceDoc", None),
        ))

    conn.executemany("""
        INSERT OR REPLACE INTO chunks
        (chunk_index, id, cfr_title, part, section, paragraph_path, text, amddate, source_url, source_doc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    conn.close()


def write_vectors_f32(embeddings: list[list[float]], output_path: Path) -> None:
    """Write raw little-endian Float32Array. Shape: (N, dim)."""
    arr = np.array(embeddings, dtype=np.float32)
    output_path.write_bytes(arr.tobytes())


def write_schema(chunks: list[dict], n: int, model_name: str, output_path: Path,
                 bucket_idf: list[float] | None = None) -> None:
    amdates = sorted(set(c.get("amddate", "") for c in chunks if c.get("amddate")))
    schema = {
        "dim": EMBEDDING_DIM,
        "count": n,
        "model": model_name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "amddate_range": {
            "min": amdates[0] if amdates else "",
            "max": amdates[-1] if amdates else "",
        },
        "deployment": "committed-freeze",
        "q6_decision": "hashing-trick freeze committed; /api/ask reads local files, Blob is optional overlay",
    }
    if bucket_idf is not None:
        # Query-side hashEmbed must apply these same per-bucket weights.
        schema["bucketIdf"] = bucket_idf
    output_path.write_text(json.dumps(schema, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mock-embeddings", action="store_true",
                        help="Use deterministic mock embeddings (no watsonx call)")
    parser.add_argument("--hash-embeddings", action="store_true",
                        help="Use hashing-trick embeddings (no watsonx call, keyword-aligned)")
    args = parser.parse_args()

    bucket_idf = None
    print("Loading chunks...")
    chunks = load_all_chunks()
    # Filter out empty-text chunks
    chunks = [c for c in chunks if c.get("text", "").strip()]
    print(f"  {len(chunks)} chunks with non-empty text")

    if not chunks:
        print("ERROR: no chunks found. Run ecfr_parse.py and docling_ingest.py first.")
        sys.exit(1)

    texts = [c["text"] for c in chunks]

    # --- Embed ---
    model_name = EMBEDDING_MODEL
    if args.mock_embeddings:
        print(f"Generating MOCK embeddings (dim={EMBEDDING_DIM})...")
        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i:i + BATCH_SIZE]
            all_embeddings.extend(embed_batch_mock(batch))
            if i % 256 == 0:
                print(f"  {i}/{len(texts)}")
        model_name = "mock"
    elif args.hash_embeddings or not os.environ.get("WATSONX_API_KEY"):
        print(f"Generating IDF-weighted hashing-trick embeddings (dim={EMBEDDING_DIM})...")
        all_embeddings, bucket_idf = embed_hash_idf(texts)
        model_name = "hashing-trick-768"
        if not args.hash_embeddings:
            print("  NOTE: WATSONX_API_KEY unset; hashing-trick used (Q2 Lite cap).")
    else:
        # Real watsonx embeddings
        for var in ("WATSONX_API_KEY", "WATSONX_PROJECT_ID", "WATSONX_REGION"):
            if not os.environ.get(var):
                print(f"ERROR: {var} not set. Use --hash-embeddings for local testing.")
                sys.exit(1)

        from ibm_watsonx_ai import APIClient, Credentials
        region = os.environ["WATSONX_REGION"]
        url = f"https://{region}.ml.cloud.ibm.com"
        credentials = Credentials(url=url, api_key=os.environ["WATSONX_API_KEY"])
        client = APIClient(credentials=credentials)

        print(f"Embedding {len(texts)} chunks via watsonx ({EMBEDDING_MODEL})...")
        all_embeddings = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i:i + BATCH_SIZE]
            try:
                vecs = embed_batch_watsonx(batch, client)
                all_embeddings.extend(vecs)
            except Exception as exc:
                print(f"  ERROR at batch {i}: {exc}", file=sys.stderr)
                sys.exit(1)
            if i % 128 == 0:
                print(f"  {i}/{len(texts)}")
            # Stay within 2 req/sec rate limit
            time.sleep(0.6)

    print(f"Embedded {len(all_embeddings)} chunks")

    # --- Write SQLite ---
    sqlite_path = OUTPUT_DIR / "manifest.sqlite"
    print(f"Writing {sqlite_path}...")
    write_sqlite(chunks, sqlite_path)
    print(f"  SQLite: {sqlite_path.stat().st_size // 1024}K")

    # --- Write vectors.f32 ---
    vec_path = OUTPUT_DIR / "vectors.f32"
    print(f"Writing {vec_path}...")
    write_vectors_f32(all_embeddings, vec_path)
    print(f"  vectors.f32: {vec_path.stat().st_size // 1024}K ({len(all_embeddings)} x {EMBEDDING_DIM})")

    # --- Write schema.json ---
    schema_path = OUTPUT_DIR / "schema.json"
    write_schema(chunks, len(all_embeddings), model_name, schema_path, bucket_idf=bucket_idf)
    print(f"  schema.json written")

    print("\nCorpus bundle complete.")
    print(f"  chunks: {len(chunks)}")
    print(f"  SQLite: {sqlite_path}")
    print(f"  vectors.f32: {vec_path}")
    print(f"  schema.json: {schema_path}")
    print("\nCommit corpus/manifest.sqlite, corpus/vectors.f32, and corpus/schema.json.")
    print("Optional: run corpus-build.yml to upload a Blob overlay.")


if __name__ == "__main__":
    main()
