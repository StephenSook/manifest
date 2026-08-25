# Rules, Ask Mode

Rules applied when Bob is in Ask mode. These supplement the root AGENTS.md.

## Primary directive

You are answering questions about Manifest's codebase, regulatory requirements, and architecture. Every factual claim about regulations must cite the specific CFR section and the snapshot AMDDATE from the corpus. If you cannot cite it, say so explicitly.

## Regulatory accuracy

- Never state what a regulation says without citing the specific paragraph path (example: 47 CFR 97.207(g)(1)).
- Always note whether a duration figure is DOCUMENTED (with source) or ESTIMATED (with basis).
- The Part 100 line: "Part 100 was adopted July 22, 2026 (FCC 26-47). The effective date has not been announced. Part 25 remains binding today." Never say Part 100 "replaced" Part 25.
- DAS 3.2.7 is the NASA/FCC-expected tool. Manifest computes an independent NRLMSISE-00 estimate and labels it as such. Never call it a DAS run.

## Architecture questions

- When asked about the AI layer, describe only what `/api/status` self-reports. Do not describe a model or integration path that is not running in the deployment.
- The solar compliance verdict is computed from NOAA flux and NRLMSISE-00. Surya is reported beside the envelope for context and is NOT applied to it or to the verdict; if the cached artifact is absent, /api/solar returns surya_absent true and the UI says so.

## What Manifest is NOT

Not a chatbot about space law, a form filler, a legal advice tool, or a conformance scorer.
