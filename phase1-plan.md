# Phase 1 Implementation Plan: Tylin's Tasks

Source of truth for task numbering: PLAN.md.
This plan covers tasks 1.1, 1.2, 1.3, and 1.6 in dependency order.

## Overview

Phase 1 builds the entire corpus pipeline from raw regulatory sources to a
live retrieval-and-generation API route. Tasks 1.1 and 1.2 are independent
and can run in parallel. They feed into 1.3, which builds the frozen corpus
bundle. Task 1.6 wires the bundle into the API and adds the Guardian audit.

Q6 decision (recorded here per Shared Contracts): `corpus/manifest.sqlite`
and `corpus/vectors.f32` are **built in CI and stored in Vercel Blob**.
The route handler fetches from Blob on cold start and caches in memory.
This avoids GitHub's 100 MB per-file hard limit and Vercel bundle size limits.
Record this decision in PLAN.md Shared Contracts before 1.3 ships.

Dependency order:

```
1.1 (eCFR parse)   ----+
                       +--> 1.3 (corpus bundle) --> 1.6 (/api/ask route)
1.2 (Docling PDF)  ----+
```

---

## Task 1: 1.1 - eCFR XML parse

**Status:** [ ] pending

### Intent

Parse the govinfo.gov eCFR bulk XML snapshots for Title 47 Parts 5, 25, 97
and Title 15 Part 960 into a flat list of JSON chunks that downstream tasks
can embed and store. Each chunk must carry the snapshot AMDDATE so every
Citation the product emits is pinned to a specific regulatory version.

Critical parsing rule from PLAN.md: citation paragraph paths come from
parsing the hardcoded paragraph labels inside the `<P>` elements, NOT from
element nesting and NOT from the `NODE` attribute. Getting this wrong means
the eval bank's `paragraphPath` fields will not match corpus chunks and the
90% citation bar will be unreachable.

### Expected Outcomes

- `pipeline/ecfr_parse.py` parses eCFR bulk XML for Title 47 Parts 5, 25, 97
  and Title 15 Part 960
- Output written to `corpus/chunks/*.json` (one file per Part, or one flat
  file per part - decide during implementation, record in commit message)
- Every chunk has these fields:
  `{ id, cfrTitle, part, section, paragraphPath, text, amddate, sourceUrl }`
- The `paragraphPath` field is extracted from the label text inside `<P>`
  elements (e.g. `(g)`, `(g)(1)`, `(g)(1)(i)`) not inferred from nesting
- The `amddate` field is the `AMDDATE` attribute from the XML snapshot header
- Spot-check: 47 CFR 97.207(g) chunk exists with paragraphPath `(g)` and
  amddate matching the downloaded snapshot
- `lxml` added to `pipeline/pyproject.toml` and `uv.lock` updated

### Todo List

1. Add `lxml` and `requests` to `pipeline/pyproject.toml` dependencies;
   run `uv sync --python 3.12 --project pipeline` to install
2. Download eCFR bulk XML snapshots from govinfo.gov for:
   - Title 47 Part 5 (experimental): `govinfo.gov/bulkdata/ECFR/title-47/ECFR-title47.xml`
   - Title 47 Part 25 (satellite): same file, Part 25 sections
   - Title 47 Part 97 (amateur): same file, Part 97 sections
   - Title 15 Part 960 (NOAA CRSRA): `govinfo.gov/bulkdata/ECFR/title-15/ECFR-title15.xml`
   - Do NOT commit the raw XML files (they are large; add `pipeline/raw/` to
     .gitignore which already has it)
3. Implement `pipeline/ecfr_parse.py`:
   - Parse the XML with `lxml.etree`
   - Structure: `DIV5` elements are Parts, `DIV8` elements are Sections
   - Extract the AMDDATE from the `<ECFR>` root element's `AMDDATE` attribute
   - For each Section (DIV8): extract the section number from the `N` attribute
   - For each paragraph `<P>` element inside a section: extract the paragraph
     label from the text content prefix (e.g. `(g)`, `(g)(1)`) by matching
     the pattern `^\([a-zA-Z0-9]+\)(\([a-zA-Z0-9]+\))*` at the start of the
     text, then strip the label from the chunk text
   - Output a chunk dict per paragraph (or per section for unparagraphed
     sections): `{ id, cfrTitle, part, section, paragraphPath, text, amddate, sourceUrl }`
   - Write to `corpus/chunks/` as JSON (one file per Part is simplest)
4. Write a smoke test: assert that 47 CFR 97.207(g) and 97.207(b) chunks
   exist with correct paragraphPath values; assert 15 CFR 960.10 chunk exists
5. Run the parser: `uv run --python 3.12 --project pipeline python pipeline/ecfr_parse.py`
6. Commit: `feat(corpus): eCFR XML parser - Title 47 Parts 5 25 97, Title 15 Part 960`

### Relevant Context

- PLAN.md 1.1: "Citation paths come from parsing the hardcoded paragraph
  labels inside the `P` elements, not from element nesting. Ignore the `NODE`
  attribute. Pin each snapshot's `AMDDATE` and store it on every chunk."
- `corpus/chunks/` does not exist; this task creates it
- `pipeline/raw/` is already in `.gitignore` - put downloaded XML there
- `engine/types.ts` `Citation` interface (the shape chunks must satisfy):
  `{ cfrTitle, part, section, paragraphPath, amddate, sourceUrl }`
- Eval bank `amddate` fields say `"VERIFY_FROM_SNAPSHOT"` - task 1.1 replaces
  these with real AMDDATEs from the parsed snapshot; note this in the commit
  and coordinate with Stephen to update `eval/bank.jsonl`

---

## Task 2: 1.2 - Docling PDF ingest

**Status:** [ ] pending

### Intent

Ingest the five regulatory PDFs through Docling to extract text and tables
into chunks that join the corpus alongside the eCFR XML chunks. Table
extraction is the critical risk: the FCC 26-47 appendix and NASA-STD-8719.14C
contain requirement tables that must survive the round-trip accurately.
Q3 (PLAN.md Open Questions) is owned by this task.

The five PDFs (local only, never committed - D10):
- FCC-26-47A1.pdf (Part 100 R&O)
- FCC-22-74A1.pdf (the 5-year disposal rule)
- NASA-STD-8719.14C (debris standard)
- NASA CubeSat 101 (2017 - flag the age on every chunk from this doc)
- DAS 3.2 User's Guide (cited as authority, D4)

### Expected Outcomes

- `pipeline/docling_ingest.py` processes all five PDFs and emits chunks
  in the same schema as 1.1: `{ id, cfrTitle, part, section, paragraphPath, text, amddate, sourceUrl }`
- For PDF chunks: `amddate` = the document's publication date (hardcoded per
  doc, labeled as such), `sourceUrl` = the canonical URL for that document
- Q3 answered in PLAN.md: three specific tables named, each confirmed to
  round-trip correctly, or marked as manually extracted with source cited
- `docling` added to `pipeline/pyproject.toml` and uv.lock updated
- CubeSat 101 chunks carry a `docAge` flag or a note in their text marking
  the 2017 date so the route handler can include it in citations

### Todo List

1. Add `docling` to `pipeline/pyproject.toml`; run `uv sync`.
   Note: Docling requires Python >=3.12 which we have. It is a heavy install
   (~500 MB models); run once and let uv cache it.
2. Implement `pipeline/docling_ingest.py`:
   - Accept a list of PDF paths (either hardcoded for the five known PDFs or
     via a config file - hardcoded is simpler and sufficient)
   - Use Docling's `DocumentConverter` to convert each PDF
   - Extract text chunks per page or per logical section (Docling's
     `DoclingDocument.export_to_markdown()` gives a clean starting point)
   - For table elements: use `DoclingDocument.tables` to extract table data
     and serialize as markdown or JSON rows - do NOT drop tables
   - Assign chunk metadata: `{ id, sourceDoc, page, text, amddate, sourceUrl }`
     mapping to the shared schema where possible (PDFs do not have CFR paths;
     `section` and `paragraphPath` are empty strings for PDF chunks)
   - CubeSat 101 chunks: add `"[Source: NASA CubeSat 101, 2017. Note: figures
     date to 2017.]"` prefix to the text field
3. Q3 spot-check (required before task can be marked done):
   - Identify the three tables that matter most:
     (a) FCC 26-47 Appendix table of Part 100 sections and effective date triggers
     (b) NASA-STD-8719.14C Table 4-1 or equivalent debris assessment requirement table
     (c) FCC 22-74 the 5-year disposal rule table or requirement list
   - For each: compare Docling output values against the printed source page
   - If a table fails extraction: extract it manually as a JSON array of rows,
     write to `corpus/chunks/manual/`, cite the source page and document it
     in a `MANUAL_EXTRACTIONS.md` in that directory
4. Run the ingestor on all five PDFs
5. Commit: `feat(corpus): Docling PDF ingest - five regulatory documents`
6. Answer Q3 in PLAN.md with the three table names and pass/fail results

### Relevant Context

- PLAN.md 1.2: "Spot-check table extraction on the FCC order appendix and
  the NASA standard tables before trusting them."
- Q3 due Aug 18. This task owns the answer.
- D10: PDFs never committed. They live locally in `pipeline/raw/` (gitignored).
- D4: DAS is cited as authority, not run. The DAS 3.2 User's Guide is ingested
  for citation purposes only; the actual orbital lifetime computation uses
  pyatmos (Stephen's task 1.11).
- CubeSat 101 is from 2017. Every duration figure from it must be labeled
  ESTIMATED with a note that the source dates to 2017.

---

## Task 3: 1.3 - Corpus bundle

**Status:** [ ] pending

### Intent

Combine all chunks from 1.1 and 1.2 into a frozen corpus: a SQLite store
for metadata and text, a `vectors.f32` file of embeddings, and a `schema.json`
recording dimensions and chunk count. Also resolve Q6: per the decision above,
artifacts are built in CI and stored in Vercel Blob. The route handler fetches
from Blob on cold start.

Embedding model: use `ibm/granite-embedding-278m-multilingual` via the watsonx
SDK already installed. This keeps the embedding in the IBM stack (judge-visible)
and avoids adding sentence-transformers as a dependency.

### Expected Outcomes

- `pipeline/embed_and_store.py` reads all chunks from `corpus/chunks/`,
  calls the watsonx embedding model, and writes:
  - `corpus/manifest.sqlite`: SQLite with one row per chunk
    (`id, cfrTitle, part, section, paragraphPath, text, amddate, sourceUrl, chunk_index`)
  - `corpus/vectors.f32`: raw little-endian `Float32Array`, dim 768 x N
  - `corpus/schema.json`: `{ dim, count, model, generatedAt, amddate_range }`
- A CI workflow (`.github/workflows/corpus-build.yml`) runs the ingest
  pipeline and uploads both artifacts to Vercel Blob
- Q6 decision recorded in PLAN.md Shared Contracts
- Local verify: brute-force cosine search finds the 97.207(g) chunk as
  top-1 result for the query "pre-space notification 30 days launch vehicle"

### Todo List

1. Create `pipeline/embed_and_store.py`:
   - Load all chunk JSON files from `corpus/chunks/` and any manual extractions
   - Batch-call `ibm/granite-embedding-278m-multilingual` via the watsonx SDK
     (ModelInference with embed_text); batch size 32 to stay within rate limits
   - Write `corpus/manifest.sqlite` using Python's built-in `sqlite3`
   - Write `corpus/vectors.f32` as raw bytes:
     `numpy.array(embeddings, dtype=numpy.float32).tobytes()`
   - Write `corpus/schema.json`
2. Add `numpy` to `pipeline/pyproject.toml` (it is a transitive dep but
   declare it explicitly since embed_and_store.py uses it directly)
3. Verify locally with a brute-force cosine search script:
   `pipeline/scripts/smoke_retrieval.py` - query "pre-space notification",
   confirm 97.207(g) chunk is in the top-3 results
4. Record Q6 decision in PLAN.md Shared Contracts: "Built in CI, stored in
   Vercel Blob. Route handler fetches on cold start, caches in memory."
5. Create `.github/workflows/corpus-build.yml`:
   - Trigger: `workflow_dispatch` only (manual) - corpus rebuilds are
     intentional, not automatic on every push
   - Steps: checkout, uv setup, install deps, run ecfr_parse.py,
     run docling_ingest.py (requires PDFs - this step is skipped in CI;
     use committed `corpus/chunks/` from a prior local run), run
     embed_and_store.py, upload both artifacts to Vercel Blob via the
     Vercel CLI or the `@vercel/blob` upload API
   - Store Blob URL in a committed `corpus/blob-manifest.json`
     so the route handler knows where to fetch from
6. Add `BLOB_READ_WRITE_TOKEN` to Vercel project secrets (Khadim's task 1.18
   provisions secrets - coordinate; if 1.18 is not done, use a placeholder
   and note it as blocked)
7. Commit scripts: `feat(corpus): embedding pipeline and corpus bundle builder`
8. Commit workflow: `feat(ci): corpus-build workflow uploads artifacts to Vercel Blob`

### Relevant Context

- Q6 decision (above): build in CI, Vercel Blob, cold-start fetch
- Vector format contract (PLAN.md Shared Contracts): `corpus/vectors.f32`,
  raw little-endian Float32Array, NOT `.npy`. Dimensions in `corpus/schema.json`.
- Embedding model: `ibm/granite-embedding-278m-multilingual` (verified in 0.13)
- Expected embedding dimension: 768 (multilingual Granite embedding model)
- `numpy` is already a transitive dep in uv.lock (version 2.5.2)
- The Docling ingest step in CI is the tricky part: PDFs are local-only (D10).
  Solution: commit the `corpus/chunks/` output from a local run AFTER the
  spot-check in task 1.2 passes. The CI corpus-build workflow then only needs
  to run `embed_and_store.py` on the committed chunks.
- `corpus/chunks/` output JSON files are small (text only, no PDFs) and safe
  to commit. Confirm no PII before committing.

---

## Task 4: 1.6 - /api/ask route with Guardian audit

**Status:** [ ] pending

### Intent

Wire the corpus retrieval, granite-4-h-small generation, and Guardian audit
into a single Next.js API route handler. The Guardian audit is not optional:
every citation-bearing answer must go through `ibm/granite-guardian-3-8b`
before it reaches the user. A failed audit degrades to abstention with the
retrieved sections shown. Abstention is a designed product state, not an error.

This task produces the first end-to-end path: user question -> retrieval ->
generation -> Guardian -> response or abstention.

### Expected Outcomes

- `app/api/ask/route.ts` exists as a Next.js App Router route handler (POST)
- Request shape: `{ question: string; missionContext?: Partial<MissionInput> }`
- Response shape matches the contract in PLAN.md Shared Contracts:
  `{ answer: string | null, citations: Citation[], audited: boolean, abstained: boolean, reason?: string }`
- `answer` is `null` whenever `abstained` is `true` - no exceptions
- The route fetches the corpus from Vercel Blob on cold start and caches it
  in module scope (not per-request)
- Credentials (`WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_REGION`)
  are read from `process.env` only - never in the client bundle
- A failed Guardian audit returns `{ answer: null, citations: <retrieved>, audited: true, abstained: true, reason: "Guardian audit failed" }`
- The route is reachable at `POST /api/ask` with no auth required

### Todo List

1. Create `app/api/ask/route.ts` as a Next.js route handler:

   **Step A: corpus loading**
   - On module load (not per-request), fetch `corpus/manifest.sqlite` and
     `corpus/vectors.f32` from the Vercel Blob URL in `corpus/blob-manifest.json`
   - Cache both in module scope: `let db: Database | null = null` and
     `let vectors: Float32Array | null = null`
   - Use `sql.js` (or `better-sqlite3` if the Vercel runtime supports it)
     to read the SQLite in-memory; or use the raw chunk JSON from Blob if
     SQLite adds complexity - decide during implementation
   - Alternative simpler path: Vercel Blob stores a `corpus/chunks.json`
     (the full flat array of chunks), and the route loads that directly.
     Avoids SQLite dependency entirely for Phase 1. Record the choice.

   **Step B: retrieval**
   - Embed the user's question with `ibm/granite-embedding-278m-multilingual`
   - Brute-force cosine similarity against `vectors` Float32Array
   - Return top-5 chunks by score

   **Step C: generation**
   - Build a prompt: system prompt (cite-or-abstain instruction) + retrieved
     chunks as context + user question
   - Call `ibm/granite-4-h-small` via the watsonx SDK
   - Parse citations from the model response (look for CFR references in the
     output and match to retrieved chunk metadata)

   **Step D: Guardian audit**
   - Send the generated answer + retrieved chunks to `ibm/granite-guardian-3-8b`
   - If the Guardian flags the answer: return abstention with retrieved sections
   - If the Guardian passes: return the answer with citations

   **Step E: abstention triggers**
   - Before generation, check the question for known abstention triggers
     (fee schedules, Part 100 effective date, unannounced crosswalk):
     return abstention immediately with a specific reason string
   - This is a pre-generation fast path, not a replacement for the Guardian

2. Add `@vercel/blob` to `package.json` dependencies (for fetching corpus)
   - This is in Khadim's lane for package.json changes; coordinate or add it
     yourself since it is a direct dep of your route. If it causes a conflict,
     raise in PLAN.md Open Questions.

3. Test locally: `curl -X POST http://localhost:3000/api/ask -H 'Content-Type: application/json' -d '{"question":"What is the 97.207(g) deadline?"}'`
   - Expect: answer with a Citation carrying `section: "97.207"` and
     `paragraphPath: "(g)"` and a real AMDDATE
   - Then send an abstention trap question (fee schedule) and confirm
     `{ abstained: true, answer: null }`

4. Commit: `feat(api): /api/ask route - retrieval generation Guardian audit`

### Relevant Context

- Response contract (PLAN.md line 383):
  `{ answer | null, citations: Citation[], audited: boolean, abstained: boolean, reason?: string }`
- `Citation` type is in `engine/types.ts` (read-only from this lane)
- `MissionInput` type is in `engine/types.ts` (used for optional context only)
- Credentials server-side only: PLAN.md 2.6 "Credentials server-side only,
  never in the client bundle."
- Abstention is a feature not an error (D2). The route must never return
  a 500 for a Guardian failure - it returns 200 with abstained: true.
- Watsonx SDK already installed in the pipeline venv; for the Next.js route
  use the `ibm-watsonx-ai` npm package (not the Python SDK).
  Add to package.json.
- PLAN.md 1.6: "Fail audit means show the retrieved sections and abstain.
  Abstention is a designed screen, not an error."

---

## Open Questions to Resolve During This Phase

| Q# | Question | Due | Action |
|---|---|---|---|
| **Q2** | Watsonx Lite token budget | Before 1.5 (Stephen's) | Run smoke test with credentials, compute cost per eval run, record in PLAN.md |
| **Q3** | Docling table extraction | By Aug 18 | Answered in task 1.2 spot-check |
| **Q6** | Corpus artifact deployment | Before 1.3 ships | **DECIDED:** build in CI, Vercel Blob. Record in PLAN.md Shared Contracts. |

---

## New Dependencies to Add

| Package | Where | Task | Reason |
|---|---|---|---|
| `lxml` | `pipeline/pyproject.toml` | 1.1 | eCFR XML parsing |
| `requests` | `pipeline/pyproject.toml` | 1.1 | Download eCFR bulk XML (if not using curl) |
| `docling` | `pipeline/pyproject.toml` | 1.2 | PDF ingest |
| `numpy` | `pipeline/pyproject.toml` (explicit) | 1.3 | Float32Array serialization |
| `ibm-watsonx-ai` (npm) | `package.json` | 1.6 | Watsonx calls from the route handler |
| `@vercel/blob` | `package.json` | 1.6 | Fetch corpus on cold start |

---

## Commit Order Summary

1. `feat(corpus): eCFR XML parser - Title 47 Parts 5 25 97 Title 15 Part 960` (1.1)
2. `status: [1.1] ✅ eCFR parser complete, AMDDATE confirmed` (PLAN.md only)
3. `feat(corpus): Docling PDF ingest - five regulatory documents` (1.2)
4. `status: [1.2] ✅ Docling ingest complete, Q3 answered` (PLAN.md only)
5. `docs(plan): Q6 resolved - build in CI Vercel Blob` (PLAN.md Shared Contracts update)
6. `feat(corpus): embedding pipeline and corpus bundle builder` (1.3 scripts)
7. `feat(ci): corpus-build workflow uploads artifacts to Vercel Blob` (1.3 workflow)
8. `status: [1.3] ✅ corpus bundle built and uploaded` (PLAN.md only)
9. `feat(api): /api/ask route - retrieval generation Guardian audit` (1.6)
10. `status: [1.6] ✅ ask route live with Guardian audit` (PLAN.md only)

Each commit is atomic. Never bundle status changes with code.

---

## Cross-Lane Dependencies

| Dependency | Needed for | Who provides | Action |
|---|---|---|---|
| `package.json` changes (`ibm-watsonx-ai` npm, `@vercel/blob`) | 1.6 route handler | Khadim owns `package.json` indirectly; but these are your route's deps | Add them yourself; if it conflicts with Khadim's scaffold work, raise in PLAN.md Open Questions |
| `BLOB_READ_WRITE_TOKEN` secret | 1.3 corpus upload, 1.6 fetch | Khadim (task 1.18 provisions Vercel secrets) | Coordinate; workflow can stub the upload step until 1.18 lands |
| `eval/bank.jsonl` AMDDATE fields | 1.1 completion | Stephen (owns eval/) | After 1.1, report the real AMDDATEs to Stephen so he can update VERIFY_FROM_SNAPSHOT values |
| `engine/types.ts` `Citation` type | 1.6 route handler | Stephen (owns engine/) | Read-only import; no action needed |
