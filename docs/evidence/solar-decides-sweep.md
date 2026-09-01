# Does the sun actually decide? The number, including the half that says no

Manifest's headline is "the sun decides if your satellite is legal." This is the artifact that
could refute it. Reproduce with no key, no network and no model:

```
python3 scripts/solar_sweep.py
```

It reads one committed file, `data/decay-table.json`, which holds 21 configurations
(7 altitudes x 3 ballistic coefficients).
Every lifetime in it came from an NRLMSISE-00 ballistic drag integration at three solar levels:
F10.7=70 (solar minimum, thinnest atmosphere, longest lifetime, worst case for compliance),
F10.7=120 (nominal), and F10.7=200 (solar maximum).

A configuration "flips" when the same satellite is compliant with 47 CFR 25.283(e)'s
5-year disposal limit at one end of the solar cycle and non-compliant at the
other, with nothing changed but the sun.

## The measurement

| Outcome | Count | Share |
|---|---|---|
| **Verdict flips on solar activity alone** | **10 of 21** | **47.6%** |
| Compliant at every solar level | 4 of 21 | 19.0% |
| Non-compliant at every solar level | 7 of 21 | 33.3% |

**The sun decides between 450 km and 600 km.**
That band is where university CubeSats actually fly.

## The half that cuts against the headline

For **11 of 21 configurations, the sun decides nothing.** Below roughly
450 km the satellite reenters well inside five years whatever the sun is
doing, and at 600 km and above it does not, whatever the sun is doing.
Solar activity is decisive in a band, not everywhere, and a planner that implied otherwise would
be overselling.

The honest form of the headline is therefore narrower and stronger: **for a mission in the
450 to 600 km band, the launch window can decide
the legal outcome rather than the design.**

## Every flipping configuration

| Altitude | Ballistic coeff. | Solar min (F10.7=70) | Solar max (F10.7=200) |
|---|---|---|---|
| 450 km | 180 | 5.69 y, VIOLATED | 0.67 y, OK |
| 450 km | 250 | 7.88 y, VIOLATED | 0.90 y, OK |
| 500 km | 120 | 10.83 y, VIOLATED | 0.90 y, OK |
| 500 km | 180 | 15.00 y, VIOLATED | 1.32 y, OK |
| 500 km | 250 | 15.00 y, VIOLATED | 1.82 y, OK |
| 550 km | 120 | 15.00 y, VIOLATED | 1.74 y, OK |
| 550 km | 180 | 15.00 y, VIOLATED | 2.57 y, OK |
| 550 km | 250 | 15.00 y, VIOLATED | 3.55 y, OK |
| 600 km | 120 | 15.00 y, VIOLATED | 3.30 y, OK |
| 600 km | 180 | 15.00 y, VIOLATED | 4.92 y, OK |

## What this measurement is not

- **The grid is coarse.** 21 configurations, 7 altitudes at 50 km steps.
  It is enough to establish that the band exists and roughly where it sits; it is not a fine
  characterisation of its edges.
- **7 of the 10 flips have a
  solar-minimum lifetime sitting exactly at the 15-year integration
  ceiling.** Those rows did not finish decaying inside the integration, so
  15.00 is a LOWER BOUND, not a measured lifetime. It does not
  change any verdict, since anything at or above the ceiling is far past the five-year limit,
  but the figure itself should not be read as exact.
- **It is a table lookup, not a live propagation.** The committed table is a precomputed
  NRLMSISE-00 run. `/api/status` reports which row a verdict used, in
  `deorbit_compliance.closest_altitude_km_used`.
- It says nothing about whether our licensing critical path is correct. That is what the eval
  bank measures, separately, in `docs/evidence/model-vs-rules.md`.
