# Goal Lab — self-directed goal-revision foundation

**Research scaffolding** for President Inu / Inu Empires pathfinding-AI work.  
**Not a game feature.** Local-only. **Do not deploy to Vercel or any live user-facing system.**

Path: `/workspace/aoe2/sandbox/goal-lab/`

## What was built (this milestone)

| # | Component | Role |
|---|---|---|
| 1 | **Sandbox** | Multiple isolated envs under `envs/`, snapshot/restore under `snapshots/`, fork + compare for competing revised goals. Disposable, wipeable, no production I/O. |
| 2 | **Alignment monitor** | Tracks human **stated intent** vs **effective objective** (inferred from action mix). Writes readable markdown/JSON reports under `data/alignment-reports/`. Flags drift for human review — never auto-changes goals. |
| 3 | **Kill switch** | External hard stop. Env `GOAL_LAB_KILL`, file sentinel `KILL`, process latch, SIGTERM/SIGINT. Runner checks **before every step**. Agent code has **no clear API**. |
| 4 | **Goal-proposal pipeline** | Agent drafts revised goal + written justification → `proposals/pending/`. Human approve/reject. **NEVER auto-adopt.** |
| 5 | **Memory layer** | Append-only JSONL under `data/memory/` (goals, proposals, experiments, alignment, failures) + index. |
| 6 | **Eval harnesses** | Wrong-goal catch, mid-run switch catch, auto-adopt blocked, fork/compare. |

## Layout

```
sandbox/goal-lab/
  cli.mjs                 # unified CLI
  README.md               # this file
  TODO.md                 # queued next work
  KILL                    # (optional) sentinel — gitignored when present
  kill-switch/            # external stop (check.mjs — no clear/disarm)
  lib/                    # paths + fs helpers
  runner/                 # run.mjs — assertAlive before steps
  sandbox/                # multi-env manager, experiment toy sim
  alignment/              # monitor + report
  proposals/              # draft pipeline + human gate
  memory/                 # cross-session persistence
  eval/                   # benchmark harnesses
  fixtures/               # sample human intent
  tests/                  # unit + eval suites
  envs/                   # disposable env workspaces (gitignored contents)
  snapshots/              # snapshots (gitignored contents)
  data/                   # memory + alignment reports (runtime gitignored)
```

## How to run

All commands from `sandbox/goal-lab/`:

```bash
cd /workspace/aoe2/sandbox/goal-lab

# Tests (recommended first)
node tests/run-all.mjs
# or: node cli.mjs test

# Eval harnesses only
node cli.mjs eval

# Create isolated envs and run side-by-side goals
node cli.mjs env create --goal "balanced eco" --label base
node cli.mjs run <envId> --steps 20
node cli.mjs snap <envId> --note pre-fork
node cli.mjs fork <envId> --goal "maximize wood" --label wood-exp
node cli.mjs fork <envId> --goal "boom food" --label food-exp
node cli.mjs compare <woodEnvId> <foodEnvId>

# Proposal → human gate (never auto-adopt)
node cli.mjs proposal draft --current "balanced eco" --proposed "maximize wood" \
  --why "Wood is the bottleneck for this seed; temporary shift before military." --env <envId>
node cli.mjs proposal approve <propId>
node cli.mjs proposal adopt <propId> <envId>   # human only

# Kill switch
node cli.mjs kill-status
echo "stop" > KILL          # hard stop — runner refuses steps
# clear: rm KILL && unset GOAL_LAB_KILL && start a NEW process
GOAL_LAB_KILL=1 node cli.mjs run <envId>   # exits 75

# Memory
node cli.mjs memory --limit 20
```

### Wipe lab state

```bash
node cli.mjs env wipe
rm -rf snapshots/* data/memory/*.jsonl data/alignment-reports/* \
       proposals/pending/* proposals/approved/* proposals/rejected/*
# keep .gitkeep files
```

## Kill-switch mechanism

1. **Triggers:** `GOAL_LAB_KILL` env (truthy), file `sandbox/goal-lab/KILL`, SIGTERM/SIGINT, or operator `armFromExternal`.
2. **Enforcement:** `runner` / `runSteps` call `assertAlive()` **before each step**. Throws `KillSwitchError` (CLI exit 75).
3. **Latch:** First trip latches for the **life of the process**. Deleting `KILL` or unsetting env mid-run does **not** resume.
4. **No agent clear:** `kill-switch/check.mjs` exports no `clear` / `disarm` / `reset`. See `kill-switch/README.md`.
5. **Separation:** Sentinel lives outside `envs/<id>/` workspaces.

## Proposal gate (no auto-adopt)

- Drafts land in `proposals/pending/` with mandatory written **justification (WHY)**.
- `adopt()` requires `status === 'approved'` **and** `actor` in `{human, operator}`.
- `tryAutoAdopt()` (agent) is always refused — covered by eval `auto-adopt-blocked`.

## Alignment monitor

- Compares action distribution to expected mix for stated intent (`balanced eco`, `maximize wood`, `rush military`, `boom food`).
- Drift ≥ 0.25 or inferred goal mismatch → **flagged** for human review.
- Reports: `data/alignment-reports/*.md` + `.json`. Does not change goals.

## What's left / queued next

See **[TODO.md](./TODO.md)** for the queued milestone items:

1. **Interpretability** — window into WHY a goal change was proposed (not only what).
2. **Red-team module** — adversarial attempts to break the alignment monitor.
3. **Plain-language decision log** — every agent decision explained; if it can't be explained, it isn't controlled.

Further ideas: wire toy experiment to real `src/sim.js` / `src/ai.js` lockstep; richer intent schemas; UI for proposal review.

## Safety / scope

- No Vercel deploy, no production writes, no live user data.
- Commit locally to aoe2 is fine; do **not** push/deploy unless explicitly asked.
- This tree is under `sandbox/` so it stays separated from the shipped game client.
