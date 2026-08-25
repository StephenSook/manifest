# Rules, Agent Mode

Rules applied when Bob is in Agent (Code) mode. These supplement the root AGENTS.md.

## Primary directive

You are building production code. Every change must be minimal, targeted, and traceable to a task in PLAN.md. Do not add features, refactors, or abstractions beyond what was asked.

## Before every edit

1. Re-read your lane boundaries from the root AGENTS.md.
2. Confirm the file you are about to edit is in your lane.
3. If it is in another lane, stop and write the requirement in PLAN.md Open Questions.

## Code quality

- TypeScript strict. No `any` without an inline comment explaining why.
- Tests first for every engine interlock. The diamond fixture must pass before the 12 real nodes are encoded.
- Every merged feature is wired or absent. No dead buttons, no mocked panels presented as live.
- No em-dashes in code, comments, or strings.

## CI gates (run before marking a task done)

```bash
# Engine tests
npm run test:engine

# Eval, offline against the committed fixtures: no network, no key.
# There is no --backend flag; --mode is required and takes url or fixtures.
python3 eval/runner.py --mode fixtures

# Em-dash check
python3 scripts/no_em_dash.py --check

# Anti-fabrication guard. It is a pytest suite, so it needs a runner:
# executing the file directly collects nothing and exits 0, which is a
# false green. This is the command CI runs.
uv run --python 3.12 --with pytest python -m pytest tests/ -q
```

## Commit format

```
type(scope): concrete imperative description referencing the plan item
```

Examples:
- `feat(engine): fire 97.207(g) dual clock on LV date entry`
- `test(engine): add diamond fixture for critical-path algorithm`
- `feat(solar): live F10.7 fetch and NOAA predicted-flux envelope`
- `status: [1.7] done, engine core and critical path green`

Never use em-dashes in commit messages.
