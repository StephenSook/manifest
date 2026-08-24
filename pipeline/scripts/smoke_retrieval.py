"""
pipeline/scripts/smoke_retrieval.py

Brute-force cosine similarity retrieval smoke test.
Verifies that the corpus bundle (vectors.f32 + manifest.sqlite) can answer
a known query with the expected top result.

Usage (mock embeddings, no watsonx needed):
  uv run --python 3.12 --project pipeline python pipeline/scripts/smoke_retrieval.py --mock

Usage (real watsonx embeddings):
  uv run --python 3.12 --project pipeline python pipeline/scripts/smoke_retrieval.py
"""

import argparse
import os
import sqlite3
import sys
from pathlib import Path

import numpy as np


CORPUS_DIR = Path("corpus")
EMBEDDING_DIM = 768
TOP_K = 5


def cosine_similarity(query_vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Brute-force cosine similarity: query (dim,) against matrix (N, dim)."""
    q_norm = query_vec / (np.linalg.norm(query_vec) + 1e-10)
    m_norm = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-10)
    return m_norm @ q_norm


def embed_query_mock(query: str) -> np.ndarray:
    """Return a deterministic mock embedding for the query."""
    rng = np.random.default_rng(seed=hash(query) % (2**31))
    return rng.random(EMBEDDING_DIM).astype(np.float32)


def embed_query_watsonx(query: str) -> np.ndarray:
    """Embed a query using watsonx granite-embedding-278m-multilingual."""
    from ibm_watsonx_ai import APIClient, Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference
    from ibm_watsonx_ai.foundation_models.schema import TextEmbeddingParameters

    region = os.environ["WATSONX_REGION"]
    credentials = Credentials(
        url=f"https://{region}.ml.cloud.ibm.com",
        api_key=os.environ["WATSONX_API_KEY"],
    )
    client = APIClient(credentials=credentials)
    model = ModelInference(
        model_id="ibm/granite-embedding-278m-multilingual",
        api_client=client,
        project_id=os.environ["WATSONX_PROJECT_ID"],
    )
    response = model.embed_text(
        texts=[query],
        params=TextEmbeddingParameters(truncate_input_tokens=512),
    )
    return np.array(response["results"][0]["embedding"], dtype=np.float32)


def load_corpus():
    vec_path = CORPUS_DIR / "vectors.f32"
    db_path = CORPUS_DIR / "manifest.sqlite"
    schema_path = CORPUS_DIR / "schema.json"

    if not vec_path.exists() or not db_path.exists():
        print("ERROR: corpus/vectors.f32 or corpus/manifest.sqlite not found.")
        print("Run: uv run --python 3.12 --project pipeline python pipeline/embed_and_store.py --mock-embeddings")
        sys.exit(1)

    raw = vec_path.read_bytes()
    n = len(raw) // (EMBEDDING_DIM * 4)
    matrix = np.frombuffer(raw, dtype=np.float32).reshape(n, EMBEDDING_DIM)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return matrix, conn


def retrieve(query_vec: np.ndarray, matrix: np.ndarray, conn, top_k: int = TOP_K) -> list[dict]:
    scores = cosine_similarity(query_vec, matrix)
    top_indices = np.argsort(scores)[::-1][:top_k]
    results = []
    for idx in top_indices:
        row = conn.execute(
            "SELECT * FROM chunks WHERE chunk_index = ?", (int(idx),)
        ).fetchone()
        if row:
            results.append({"score": float(scores[idx]), **dict(row)})
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mock", action="store_true", help="Use mock embeddings")
    args = parser.parse_args()

    print("Loading corpus...")
    matrix, conn = load_corpus()
    print(f"  {matrix.shape[0]} vectors, dim={matrix.shape[1]}")

    test_queries = [
        ("pre-space notification 30 days launch vehicle", "97.207", "(g)"),
        ("five year post mission disposal low earth orbit", "25.283", "(e)"),
        ("NOAA remote sensing license application review", "960.10", ""),
    ]

    all_pass = True
    for query, expected_section, expected_para in test_queries:
        print(f"\nQuery: {query!r}")
        if args.mock:
            q_vec = embed_query_mock(query)
        else:
            q_vec = embed_query_watsonx(query)

        results = retrieve(q_vec, matrix, conn)
        print(f"  Top {TOP_K} results:")
        found = False
        for r in results:
            match = "<<< MATCH" if r["section"] == expected_section else ""
            print(f"    [{r['score']:.3f}] {r['cfr_title']} CFR {r['section']}{r['paragraph_path']} {match}")
            if r["section"] == expected_section:
                found = True
        if not found:
            print(f"  FAIL: expected {expected_section} in top {TOP_K}")
            all_pass = False

    conn.close()
    print("\nSmoke retrieval:", "PASS" if all_pass else "FAIL (mock embeddings may not match real)")
    if args.mock:
        print("NOTE: mock embeddings are random - retrieval quality is not tested.")
        print("      Run without --mock after real embeddings are generated.")


if __name__ == "__main__":
    main()
