"""
pipeline/embed_and_store.py

Embed all corpus chunks using ibm/granite-embedding-278m-multilingual via
the watsonx SDK, then write:
  corpus/manifest.sqlite  - SQLite store of all chunks
  corpus/vectors.f32      - raw little-endian Float32Array (dim x N)
  corpus/schema.json      - dimensions, count, model, amddate_range

Q6 decision: artifacts are NOT committed to git. They are uploaded to
Vercel Blob by the corpus-build CI workflow (.github/workflows/corpus-build.yml).
The route handler fetches from Blob on cold start and caches in memory.

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


def write_schema(chunks: list[dict], n: int, mock: bool, output_path: Path) -> None:
    amdates = sorted(set(c.get("amddate", "") for c in chunks if c.get("amddate")))
    schema = {
        "dim": EMBEDDING_DIM,
        "count": n,
        "model": EMBEDDING_MODEL if not mock else "mock",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "amddate_range": {
            "min": amdates[0] if amdates else "",
            "max": amdates[-1] if amdates else "",
        },
        "deployment": "vercel-blob",
        "q6_decision": "build in CI, store in Vercel Blob, route handler fetches on cold start",
    }
    output_path.write_text(json.dumps(schema, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mock-embeddings", action="store_true",
                        help="Use deterministic mock embeddings (no watsonx call)")
    args = parser.parse_args()

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
    if args.mock_embeddings:
        print(f"Generating MOCK embeddings (dim={EMBEDDING_DIM})...")
        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i:i + BATCH_SIZE]
            all_embeddings.extend(embed_batch_mock(batch))
            if i % 256 == 0:
                print(f"  {i}/{len(texts)}")
    else:
        # Real watsonx embeddings
        for var in ("WATSONX_API_KEY", "WATSONX_PROJECT_ID", "WATSONX_REGION"):
            if not os.environ.get(var):
                print(f"ERROR: {var} not set. Use --mock-embeddings for local testing.")
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
    write_schema(chunks, len(all_embeddings), args.mock_embeddings, schema_path)
    print(f"  schema.json written")

    print("\nCorpus bundle complete.")
    print(f"  chunks: {len(chunks)}")
    print(f"  SQLite: {sqlite_path}")
    print(f"  vectors.f32: {vec_path}")
    print(f"  schema.json: {schema_path}")
    print("\nNext: run the corpus-build CI workflow to upload to Vercel Blob.")


if __name__ == "__main__":
    main()
