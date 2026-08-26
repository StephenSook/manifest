# Lane enforcement: shipped fileRegex, not a pasted chat

Task 2.22 asked for a transcript of a write-scoped Bob mode refusing an
out-of-lane write, citing its own fileRegex, and naming the mode to
switch to. This file is that evidence as a machine-checkable property
of the committed config. It is not a pasted Bob chat.

## What this file is not

- Not a reconstructed dialogue.
- Not a screenshot of a refusal bubble.
- Not a claim that Orchestrator mode exists. Bob 2.0.3 does not have
  one. The switcher is Agent, Plan, Ask, plus the five workspace modes.

PLAN.md task 2.22 records a contemporaneous event: Frontend mode
refused `docs/architecture.svg`, and the author switched to
`evidence-writer`. That note is in the repo. The chat itself was never
exported. This file does not invent the missing lines.

## The distinguishing check

A mode is allowed to write a path only when that path matches the
mode's `groups.edit.fileRegex` in [`.bob/custom_modes.yaml`](../../.bob/custom_modes.yaml).

| Path | `frontend` | `evidence-writer` |
|---|---|---|
| `docs/architecture.svg` | refuse | allow |
| `docs/bob-evidence/lane-enforcement.md` | refuse | allow |
| `app/judge/page.tsx` | allow | refuse |
| `app/api/status/route.ts` | refuse | refuse |

`frontend` fileRegex (quoted from the yaml `groups.edit` entry):

```
^(app/(?!api/)|components/|lib/|public/)|^sw\.ts$|^tests/e2e/
```

`evidence-writer` fileRegex:

```
^docs/|^README\.md$
```

`docs/architecture.svg` does not match `frontend`. It does match
`evidence-writer`. That is the refusal, and a judge can re-run it
without opening Bob:

```
uv run --python 3.12 --with pytest python -m pytest tests/test_bob_lane_enforcement.py -v
```

The same job runs in CI (`eval-gate.yml`, `python -m pytest tests/`).
If someone later widens `frontend` to include `docs/`, the test fails.

## Git event this regex explains

`docs/architecture.svg` is in `docs/`, so only `evidence-writer` among
the five modes may write it.

- `aff9ed0` `docs: architecture diagram, wired paths only`
- `1569a6c` `docs: architecture diagram, node count is conditional on pathway`

Both commits are under `docs/`. They are inside `evidence-writer`
scope and outside `frontend` scope. That is the lane split firing in
the history a judge can `git show`.

## How to reproduce the refusal in Bob

1. Open this repo in IBM Bob 2.0.3.
2. Switch to Frontend mode.
3. Attempt an edit to `docs/architecture.svg`.
4. The write is out of that mode's fileRegex. Switch to Evidence Writer
   (`slug: evidence-writer`) to make the edit.

Step 4 is the live check. This markdown is the durable record of why
that check must fail, not a stand-in for having filmed it.

## Related files

- [`.bob/custom_modes.yaml`](../../.bob/custom_modes.yaml): five modes,
  each with a `groups.edit.fileRegex`
- [`tests/test_bob_lane_enforcement.py`](../../tests/test_bob_lane_enforcement.py):
  the table above, asserted
- [`docs/bob-evidence/plan-mode-critical-path.md`](plan-mode-critical-path.md):
  the matching honesty log for task 1.13 (Plan-mode session never captured)
- [`docs/bob-evidence/bobalytics-03.png`](bobalytics-03.png): week-3
  subscription-usage screenshot, not a lane-enforcement capture
