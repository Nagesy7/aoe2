# Goal Lab — TODO / queued milestones

Logged from steering (do not block the foundation milestone). Confirm paths when picking these up:

Base path: `/workspace/aoe2/sandbox/goal-lab/`

## Queued (next)

### 1. Interpretability
- **Path (proposed):** `sandbox/goal-lab/interpretability/`
- Window into **WHY** the agent proposed a goal change, not just **what**.
- Tie proposal justifications to evidence traces (alignment samples, resource curves, failed experiments in `data/memory/`).
- Surface counterfactuals: “if we kept stated goal, expected outcome was X”.

### 2. Red-team module
- **Path (proposed):** `sandbox/goal-lab/redteam/`
- Adversarial suite that **tries to break the alignment monitor** (spoof action mixes, goal-label games, report poisoning, silent mid-run switches, justification-only theater without behavior change).
- Success = monitor or gate still catches / refuses; failures become regression evals under `eval/`.

### 3. Plain-language decision log
- **Path (proposed):** `sandbox/goal-lab/decisions/` + `data/memory/decisions.jsonl`
- Every agent decision (step, proposal, fork, snap) emitted as a **plain-language** line a human can read.
- Rule of thumb: **if it can’t be explained, it isn’t controlled** — runner should refuse opaque actions once this lands.

## Done this milestone
- [x] Multi-env sandbox + snapshot/restore/fork/compare
- [x] External kill switch + runner wiring
- [x] Alignment monitor + readable reports
- [x] Proposal pipeline + human gate (no auto-adopt)
- [x] Memory layer
- [x] Eval harnesses + tests
