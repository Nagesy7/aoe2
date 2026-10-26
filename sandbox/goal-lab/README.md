# Goal Lab — self-directed goal-revision research sandbox

**Local research scaffolding** for President Inu / Inu Empires pathfinding-AI alignment work.

> **NOT production Empires gameplay.**  
> Not a shipped game feature. No Vercel / live deploy. No production I/O or user data.  
> Path: `/workspace/aoe2/sandbox/goal-lab/`

Verified runnable: `node tests/run-all.mjs` (6/6 suites) and `node cli.mjs eval`.

---

## Purpose

Study **self-directed goal revision** safely:

1. An agent may **propose** a revised goal with a written justification.
2. Humans **approve / reject / adopt** — never auto-adopt.
3. An **alignment monitor** compares stated intent vs effective behavior and flags drift.
4. An external **kill switch** can hard-stop any run (agent cannot clear it).
5. Multiple disposable **envs** can fork/compare competing goals.

This is a toy experiment loop under `sandbox/`, separated from the shipped client (`src/`).

---

## Quick start

```bash
cd /workspace/aoe2/sandbox/goal-lab

# 1) Sanity — tests + eval harnesses
node tests/run-all.mjs          # or: node cli.mjs test
node cli.mjs eval

# 2) Create an env, run steps, inspect kill status
node cli.mjs env create --goal "balanced eco" --label demo
node cli.mjs env list
node cli.mjs run <envId> --steps 20
node cli.mjs kill-status

# 3) Fork competing goals and compare
node cli.mjs snap <envId> --note pre-fork
node cli.mjs fork <envId> --goal "maximize wood" --label wood-exp
node cli.mjs fork <envId> --goal "boom food" --label food-exp
node cli.mjs compare <woodEnvId> <foodEnvId>

# 4) Proposal → human gate (never auto-adopt)
node cli.mjs proposal draft \
  --current "balanced eco" --proposed "maximize wood" \
  --why "Wood is the bottleneck for this seed; temporary shift before military." \
  --env <envId>
node cli.mjs proposal list pending
node cli.mjs proposal approve <propId>
node cli.mjs proposal adopt <propId> <envId>   # human/operator only

# 5) Memory + wipe
node cli.mjs memory --limit 20
node cli.mjs env wipe
```

Kill switch (hard stop — runner exit code **75**):

```bash
echo "stop" > KILL                 # file sentinel (preferred)
# or: GOAL_LAB_KILL=1 node cli.mjs run <envId>
# clear: rm -f KILL && unset GOAL_LAB_KILL && start a NEW process
# details: kill-switch/README.md
```

---

## What each piece does

| Component | Role |
|---|---|
| **Sandbox** (`sandbox/`, `envs/`, `snapshots/`) | Isolated envs; snapshot/restore; fork + compare competing revised goals. Disposable / wipeable. |
| **Runner** (`runner/run.mjs`) | Runs toy experiment steps; calls `assertAlive()` **before every step**. |
| **Alignment monitor** (`alignment/`) | Stated intent vs effective objective (action mix). Markdown/JSON reports under `data/alignment-reports/`. Flags drift — never auto-changes goals. |
| **Kill switch** (`kill-switch/`) | External hard stop via `GOAL_LAB_KILL`, file `KILL`, SIGTERM/SIGINT, process latch. **No agent clear API.** |
| **Proposals** (`proposals/`) | Draft + justification → `pending/`. Human approve/reject. `adopt()` only for `human`/`operator`. `tryAutoAdopt()` always refused. |
| **Memory** (`memory/`, `data/memory/`) | Append-only JSONL: goals, proposals, experiments, alignment, failures + index. |
| **Eval harnesses** (`eval/`) | `wrong-goal-caught`, `midrun-switch-caught`, `auto-adopt-blocked`, `fork-compare`. |
| **CLI** (`cli.mjs`) | Unified entry: env / run / snap / fork / compare / proposal / memory / eval / test / kill-status. |

### Envs vs evals

- **Envs** — disposable workspaces under `envs/<id>/` holding toy sim state + `experiment.jsonl`. Create/list/destroy/wipe via CLI. Snapshots live under `snapshots/`.
- **Evals** — scripted scenarios in `eval/harness.mjs` that assert safety properties (wrong goal flagged, mid-run switch flagged, auto-adopt blocked, fork/compare works). Run with `node cli.mjs eval`.

---

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
  interpretability/       # STUB — WHY evidence for proposals
  decisions/              # STUB — plain-language decision log
  redteam/                # STUB — adversarial monitor/gate probes
  envs/                   # disposable env workspaces (gitignored contents)
  snapshots/              # snapshots (gitignored contents)
  data/                   # memory + alignment reports (runtime gitignored)
```

---

## Kill-switch mechanism

1. **Triggers:** `GOAL_LAB_KILL` (truthy), file `sandbox/goal-lab/KILL`, SIGTERM/SIGINT, or operator `armFromExternal`.
2. **Enforcement:** runner / `runSteps` call `assertAlive()` **before each step**. Throws `KillSwitchError` (CLI exit **75**).
3. **Latch:** First trip latches for the **life of the process**. Deleting `KILL` or unsetting env mid-run does **not** resume.
4. **No agent clear:** `kill-switch/check.mjs` exports no `clear` / `disarm` / `reset`.
5. **Separation:** Sentinel lives outside `envs/<id>/` workspaces.

See `kill-switch/README.md`.

---

## Proposal gate (no auto-adopt)

- Drafts land in `proposals/pending/` with mandatory written **justification (WHY)**.
- `adopt()` requires `status === 'approved'` **and** `actor` in `{human, operator}`.
- `tryAutoAdopt()` (agent) is always refused — covered by eval `auto-adopt-blocked`.

---

## Alignment monitor

- Compares action distribution to expected mix for stated intent (`balanced eco`, `maximize wood`, `rush military`, `boom food`).
- Drift ≥ 0.25 or inferred goal mismatch → **flagged** for human review.
- Reports: `data/alignment-reports/*.md` + `.json`. Does not change goals.

---

## Stubs (queued — do not block research use)

Minimal placeholders with TODOs; **not** hooked into runner/CLI yet:

| Stub | Path | Intent |
|---|---|---|
| Interpretability | `interpretability/explain.mjs` | WHY evidence + counterfactuals for proposals |
| Decision log | `decisions/log.mjs` | Plain-language lines → `data/memory/decisions.jsonl` |
| Red-team | `redteam/suite.mjs` | Adversarial probes; promote failures to `eval/` |

Details: **[TODO.md](./TODO.md)**.

Further ideas: wire toy experiment to real `src/sim.js` / `src/ai.js` lockstep; richer intent schemas; UI for proposal review.

---

## Wipe lab state

```bash
node cli.mjs env wipe
rm -rf snapshots/* data/memory/*.jsonl data/alignment-reports/* \
       proposals/pending/* proposals/approved/* proposals/rejected/*
# keep .gitkeep files
```

---

## Safety / scope

- **Not** production Empires gameplay or a user-facing feature.
- No Vercel deploy, no production writes, no live user data.
- Commit locally to aoe2 is fine; do **not** push/deploy unless explicitly asked.
- Tree lives under `sandbox/` so it stays separated from the shipped game client.
