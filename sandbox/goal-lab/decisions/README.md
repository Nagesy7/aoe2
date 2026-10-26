# Plain-language decision log (stub)

**Status:** stub only — not enforced by runner yet.

## Purpose
Every agent decision (step, proposal, fork, snap) as a **plain-language** line a human can read.

Rule of thumb: **if it can’t be explained, it isn’t controlled** — once this lands, runner should refuse opaque actions.

## Planned
- Append to `data/memory/decisions.jsonl` (gitignored with other memory JSONL).
- Hook from `runner/run.mjs`, proposal draft/adopt, sandbox fork/snap.
- CLI: `node cli.mjs decisions [--limit N]` (not yet).

## Out of scope
Not production Empires gameplay. Local research only.
