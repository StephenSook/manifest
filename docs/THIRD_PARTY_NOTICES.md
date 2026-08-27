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
| @serwist/next | MIT |
| idb | ISC |
| @ibm-cloud/watsonx-ai | Apache-2.0 |
| @vercel/blob | Apache-2.0 |
| sql.js | MIT |
| typescript | Apache-2.0 |
| vitest | MIT |
| eslint, eslint-config-next | MIT |
| tailwindcss | MIT |
| tsx | MIT |
| happy-dom | MIT |
| @playwright/test | Apache-2.0 |
| @tailwindcss/postcss | MIT |
| @types/node | MIT |
| @types/react | MIT |
| @types/react-dom | MIT |
| @types/sql.js | MIT |
| @vitejs/plugin-react | MIT |

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
not empty. It carries one fingerprint,
`1a9c4198f7f1b070bbf537178b85cde6ed6884c9:phase0-plan.md:generic-api-key:96`,
a verified false positive on the placeholder assignment
`WATSONX_API_KEY=...` in phase0-plan.md (three dots, not a secret).

Proven scan (not a local-only claim): GitHub Actions job `Gitleaks secret scan`
on commit `33a1800b09fe4e3c17a9b182c2d890f2f8291309` concluded `success`
(check-run https://github.com/StephenSook/manifest/actions/runs/32752624880/job/97512867441,
read via REST check-runs on 2026-08-24). CI also runs a living lockfile
guard that fails if `elkjs` or `orbdetpy` appear in `package.json`,
`package-lock.json`, `pipeline/pyproject.toml`, or `pipeline/uv.lock`.
