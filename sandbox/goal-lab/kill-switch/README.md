# Kill switch (external hard stop)

The kill switch is **infrastructure**, not agent logic. The sandbox runner calls
`assertAlive()` **before every experiment step** and refuses to continue when active.

## How to STOP (operator / human)

Any one of:

```bash
# 1) File sentinel (preferred durable stop)
echo "operator stop $(date -Iseconds)" > /workspace/aoe2/sandbox/goal-lab/KILL

# 2) Environment flag
GOAL_LAB_KILL=1 node cli.mjs run ...

# 3) Process signal
kill -TERM <runner-pid>   # or Ctrl-C (SIGINT)
```

## How to CLEAR (human only, new process required)

1. Remove the sentinel: `rm -f sandbox/goal-lab/KILL`
2. Unset env: `unset GOAL_LAB_KILL`
3. **Start a new runner process** — the in-process latch cannot be reset.

## Why the agent cannot override it

- `kill-switch/check.mjs` exports **no** `clear()` / `disarm()`.
- First trip **latches** for the life of the process; deleting `KILL` or unsetting
  the env mid-run does not resume the same process.
- Sentinel lives at `sandbox/goal-lab/KILL`, **outside** `envs/<id>/` workspaces
  that experiments are allowed to write.
- Agent decision / goal-revision code must treat stop as final for that run.

## Status

```bash
node cli.mjs kill-status
```
