"""
watsonx_smoke.py

Verifies that the three model IDs used by Manifest respond with HTTP 200
from the configured watsonx.ai region.

Models checked:
  - ibm/granite-4-h-small         (generation)
  - ibm/granite-guardian-3-8b     (Guardian audit)
  - ibm/granite-embedding-278m-multilingual  (embeddings)

Required environment variables:
  WATSONX_API_KEY      -- IBM Cloud API key
  WATSONX_PROJECT_ID   -- watsonx.ai project ID
  WATSONX_REGION       -- e.g. us-south, eu-de, jp-tok

Usage:
  uv run --python 3.12 --project pipeline python pipeline/scripts/watsonx_smoke.py
"""

import os
import sys

try:
    from ibm_watsonx_ai import APIClient, Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference
    from ibm_watsonx_ai.foundation_models.schema import TextEmbeddingParameters
except ImportError:
    print("ERROR: ibm-watsonx-ai is not installed.")
    print("Run: uv add --project pipeline ibm-watsonx-ai")
    sys.exit(1)


GENERATION_MODEL = "ibm/granite-4-h-small"
GUARDIAN_MODEL = "ibm/granite-guardian-3-8b"
EMBEDDING_MODEL = "ibm/granite-embedding-278m-multilingual"


def require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        print(f"ERROR: environment variable {name} is not set.")
        sys.exit(1)
    return val


def check_generation(client: APIClient, project_id: str, model_id: str) -> bool:
    try:
        model = ModelInference(
            model_id=model_id,
            api_client=client,
            project_id=project_id,
        )
        response = model.generate(prompt="ping", params={"max_new_tokens": 1})
        if response and response.get("results"):
            return True
        print(f"  FAIL {model_id}: unexpected response shape: {response}")
        return False
    except Exception as exc:
        print(f"  FAIL {model_id}: {exc}")
        return False


def check_embedding(client: APIClient, project_id: str, model_id: str) -> bool:
    try:
        model = ModelInference(
            model_id=model_id,
            api_client=client,
            project_id=project_id,
        )
        response = model.embed_text(
            texts=["ping"],
            params=TextEmbeddingParameters(truncate_input_tokens=1),
        )
        if response and response.get("results"):
            return True
        print(f"  FAIL {model_id}: unexpected response shape: {response}")
        return False
    except Exception as exc:
        print(f"  FAIL {model_id}: {exc}")
        return False


def main() -> None:
    api_key = require_env("WATSONX_API_KEY")
    project_id = require_env("WATSONX_PROJECT_ID")
    region = require_env("WATSONX_REGION")

    url = f"https://{region}.ml.cloud.ibm.com"
    print(f"Region: {region}")
    print(f"URL:    {url}")
    print()

    credentials = Credentials(url=url, api_key=api_key)
    client = APIClient(credentials=credentials)

    results: dict[str, bool] = {}

    print(f"Checking generation model: {GENERATION_MODEL}")
    results[GENERATION_MODEL] = check_generation(client, project_id, GENERATION_MODEL)
    status = "OK" if results[GENERATION_MODEL] else "FAIL"
    print(f"  {status}")

    print(f"Checking Guardian model:   {GUARDIAN_MODEL}")
    results[GUARDIAN_MODEL] = check_generation(client, project_id, GUARDIAN_MODEL)
    status = "OK" if results[GUARDIAN_MODEL] else "FAIL"
    print(f"  {status}")

    print(f"Checking embedding model:  {EMBEDDING_MODEL}")
    results[EMBEDDING_MODEL] = check_embedding(client, project_id, EMBEDDING_MODEL)
    status = "OK" if results[EMBEDDING_MODEL] else "FAIL"
    print(f"  {status}")

    print()
    all_passed = all(results.values())
    if all_passed:
        print("All three model IDs responded. Region confirmed:", region)
        sys.exit(0)
    else:
        failed = [m for m, ok in results.items() if not ok]
        print("FAILED model IDs:")
        for m in failed:
            print(f"  {m}")
        sys.exit(1)


if __name__ == "__main__":
    main()
