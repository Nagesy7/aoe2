# Red-team module (stub)

**Status:** stub only — no adversarial suite yet.

## Purpose
Adversarial attempts to **break the alignment monitor** and proposal gate.
Success = monitor/gate still catches or refuses; failures become regression evals under `eval/`.

## Attack ideas (queued)
- Spoof action mixes that look aligned while pursuing another goal
- Goal-label games / renaming
- Report poisoning
- Silent mid-run switches
- Justification-only theater (nice WHY, unchanged behavior)

## API sketch
See `suite.mjs` — `runRedteamStub()` returns a TODO checklist, does not attack yet.

## Out of scope
Not production Empires gameplay. Local research only. Do not deploy.
