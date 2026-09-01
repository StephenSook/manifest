# What the model adds over the rules, measured

Captured 2026-09-01 against live watsonx
(`generation_backend: watsonx`, `guardian_audit: active`, zero degraded responses), scoring the
same 28-question bank and 6 abstention traps twice.

Reproduce either column with no API key:

```
python3 eval/runner.py --mode fixtures   # the rules path, what CI enforces
python3 eval/runner.py --mode cached     # the real watsonx responses, committed
```

`eval/cache/watsonx/` holds the verbatim body of all 34 responses `ibm/granite-4-h-small`
and `ibm/granite-guardian-3-8b` actually produced. Nothing is regenerated at read time.

## The measurement

| | Rules path (offline extractive) | Model path (Granite + Guardian) |
|---|---|---|
| Questions correct | **13 of 28** | **3 of 28** |
| Abstention traps held | 6 of 6 | 6 of 6 |
| Questions it answered at all | 28 attempted | 6 |
| Guardian-audited answers | 0, it never calls a model | 12 |
| **Questions ONLY this path got right** | **10** | **0** |

## The finding, stated plainly

**The model got zero questions right that the rules did not already get right.** It also cost
10 that the rules answer correctly (q01, q04, q05, q10, q12, q13, q16, q18, q19, q26).

This is the opposite of a flattering result and it is the reason it is published. Our whole
architecture claims the engine decides and the model only explains. Here is the number that
either supports that claim or refutes it, computed from committed artifacts a stranger can
re-run.

## Why the model path scores lower, per abstention

- **8** Citation gate: a reference did not resolve to a retrieved section
- **8** Citation gate: the answer cited no retrieved section
- **4** Guardian did not certify the answer
- **2** Guardian returned no readable verdict

Every one of those is a safety gate firing, not a model failure to produce text. The model
generated an answer; the citation resolver or Guardian refused to ship it. The gates convert a
would-be answer into an abstention that names what is missing.

## Zero fabrications

Of the 6 answers that cleared both gates, **every citation resolved to real
retrieved material**. The 3 that still failed the bank did so by citing
a real neighbouring provision rather than the expected one, not by inventing anything:

- `q04` cited `97.207(c)`, bank expected `97.207(b)`
- `q10` cited `FCC 22-74 (5-Year Orbital Disposal Rule)`, bank expected `25.283(e)`
- `q16` cited `960.2(c)`, bank expected `960.4`

A wrong-but-real citation is a retrieval miss. A fabricated one would be a product failure. The
bank scores the first as harshly as the second, which is correct for a compliance tool.

## What this does not say

It does not say the model is useless. It says that on THIS bank, measured THIS way, the model
did not improve the verdict, and that the deterministic path is what earns the score CI
enforces. The model's contribution is the prose and the Guardian certification attached to the
answers it does ship. That is the role the architecture assigns it.
