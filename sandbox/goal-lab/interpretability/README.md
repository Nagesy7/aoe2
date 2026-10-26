# Interpretability (stub)

**Status:** stub only — not wired into runner/CLI yet.

## Purpose
Window into **WHY** a goal change was proposed (evidence traces), not only **what**.

## Planned
- Tie proposal justifications to alignment samples, resource curves, failed experiments in `data/memory/`.
- Counterfactuals: “if we kept stated goal, expected outcome was X”.
- Surfaceable summary for human review alongside `proposals/pending/`.

## API sketch (unimplemented)
See `explain.mjs` — exports throw `NotImplemented` / return placeholder objects.

## Out of scope
Not production Empires gameplay. Local research only.
