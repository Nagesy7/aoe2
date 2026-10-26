# Goal Lab — TODO / queued milestones

Base path: `/workspace/aoe2/sandbox/goal-lab/`

## Queued (next) — stubs present, not wired

### 1. Interpretability
- **Path:** `sandbox/goal-lab/interpretability/` (`explain.mjs` stub + README)
- Window into **WHY** the agent proposed a goal change, not just **what**.
- Tie proposal justifications to evidence traces (alignment samples, resource curves, failed experiments in `data/memory/`).
- Surface counterfactuals: “if we kept stated goal, expected outcome was X”.
- **TODO:** implement evidence attach; wire into proposal draft / CLI.

### 2. Red-team module
- **Path:** `sandbox/goal-lab/redteam/` (`suite.mjs` stub + README)
- Adversarial suite that **tries to break the alignment monitor** (spoof action mixes, goal-label games, report poisoning, silent mid-run switches, justification-only theater).
- Success = monitor or gate still catches / refuses; failures become regression evals under `eval/`.
- **TODO:** implement attacks; add `node cli.mjs redteam` when ready.

### 3. Plain-language decision log
- **Path:** `sandbox/goal-lab/decisions/` (`log.mjs` stub + README) → `data/memory/decisions.jsonl`
- Every agent decision (step, proposal, fork, snap) as a **plain-language** line.
- Rule: **if it can’t be explained, it isn’t controlled** — runner should refuse opaque actions once this lands.
- **TODO:** hook runner + proposal gate; CLI `decisions` list; enforce `isExplainable`.

## Done this milestone
- [x] Multi-env sandbox + snapshot/restore/fork/compare
- [x] External kill switch + runner wiring
- [x] Alignment monitor + readable reports
- [x] Proposal pipeline + human gate (no auto-adopt)
- [x] Memory layer
- [x] Eval harnesses + tests
- [x] Research README + runnable foundation
- [x] Minimal stubs for interpretability / decisions / redteam (TODOs only)
