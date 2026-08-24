# Third-party notices (task 3.8)

License audit of direct dependencies. Permissive-only is a Definition of Done
requirement. Confirmed absent: elkjs (EPL/GPL), orbdetpy (GPL-3.0).

## JavaScript (package.json)

| Package | License (upstream) |
|---|---|
| next | MIT |
| react, react-dom | MIT |
| @xyflow/react | MIT |
| @dagrejs/dagre | MIT |
| vis-timeline | MIT AND Apache-2.0 |
| @tanstack/react-table | MIT |
| @serwist/next | MIT |
| idb | ISC |
| @ibm-cloud/watsonx-ai | Apache-2.0 |
| @vercel/blob | MIT |
| sql.js | MIT |
| typescript | Apache-2.0 |
| vitest | MIT |
| eslint, eslint-config-next | MIT |
| tailwindcss | MIT |
| tsx | MIT |
| happy-dom | MIT |
| @playwright/test | Apache-2.0 |

## Python (pipeline/pyproject.toml)

| Package | License (upstream) |
|---|---|
| ibm-watsonx-ai | Apache-2.0 |
| lxml | BSD-3-Clause |
| requests | Apache-2.0 |
| numpy | BSD-3-Clause |
| docling | MIT |
| pytest | MIT |
| pyatmos (Stephen decay.py) | MIT |

## ORBITM

Not present in the committed tree. sammmlow/ORBITM is MIT on GitHub. D4
names ORBITM alongside pyatmos. The shipped decay path is pyatmos only.
No pinned commit to record until the vendor directory is committed.

## Scan

gitleaks over full history: see `.gitleaksignore`. Every ignore entry is
hand-verified against its flagged commit before it is added. The file is
empty at the 2026-08-24 audit: no fingerprints required ignore.
