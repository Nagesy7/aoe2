#!/usr/bin/env node
/**
 * goal-lab CLI — local-only research scaffolding. No production / Vercel.
 *
 * Usage:
 *   node cli.mjs kill-status
 *   node cli.mjs env create --goal "balanced eco" [--label x]
 *   node cli.mjs env list | destroy <id> | wipe
 *   node cli.mjs run <envId> [--steps N] [--goal G] [--seed N]
 *   node cli.mjs snap <envId> [--note t]
 *   node cli.mjs restore <envId> <snapId>
 *   node cli.mjs fork <envId> --goal G [--label x]
 *   node cli.mjs compare <a> <b>
 *   node cli.mjs proposal draft --current C --proposed P --why "..." [--env id]
 *   node cli.mjs proposal list [pending|approved|rejected]
 *   node cli.mjs proposal approve <id> | reject <id> [--note t]
 *   node cli.mjs proposal adopt <id> <envId>
 *   node cli.mjs memory [--kind goals|proposals|...] [--limit N]
 *   node cli.mjs eval
 *   node cli.mjs test
 */
import { armSignals, describeStatus, assertAlive, KillSwitchError } from './kill-switch/check.mjs';
import {
  createEnv, listEnvs, destroyEnv, wipeAllEnvs, snapshot, restore, forkEnv, compare, listSnapshots, getEnv,
} from './sandbox/manager.mjs';
import { runExperiment } from './runner/run.mjs';
import { draftProposal, listProposals, getProposal } from './proposals/pipeline.mjs';
import { approve, reject, adopt } from './proposals/gate.mjs';
import { history, memoryIndex } from './memory/store.mjs';
import { runAllEvals } from './eval/harness.mjs';

armSignals();

function args() {
  const a = process.argv.slice(2);
  const out = { _: [], flags: {} };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2);
      const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
      out.flags[k] = v;
    } else out._.push(a[i]);
  }
  return out;
}

function print(x) {
  if (typeof x === 'string') console.log(x);
  else console.log(JSON.stringify(x, null, 2));
}

async function main() {
  const { _, flags } = args();
  const [cmd, sub, ...rest] = _;

  try {
    switch (cmd) {
      case 'kill-status':
        print(describeStatus());
        break;

      case 'env': {
        if (sub === 'create') {
          const env = createEnv({ statedGoal: flags.goal || flags.g || null, label: flags.label || '' });
          print(env);
        } else if (sub === 'list') print(listEnvs());
        else if (sub === 'destroy') print(destroyEnv(rest[0] || flags.id));
        else if (sub === 'wipe') print(wipeAllEnvs());
        else if (sub === 'show') print(getEnv(rest[0]));
        else {
          console.error('env create|list|show|destroy|wipe');
          process.exit(2);
        }
        break;
      }

      case 'run': {
        const envId = sub;
        if (!envId) { console.error('run <envId>'); process.exit(2); }
        const result = runExperiment(envId, {
          steps: Number(flags.steps || 10),
          seed: Number(flags.seed || 1),
          effectiveGoal: flags.goal || null,
        });
        print(result);
        if (result.killed) process.exit(75);
        break;
      }

      case 'snap':
      case 'snapshot':
        print(snapshot(sub, { note: flags.note || '' }));
        break;

      case 'restore':
        print(restore(sub, rest[0]));
        break;

      case 'fork':
        print(forkEnv(sub, { statedGoal: flags.goal, label: flags.label }));
        break;

      case 'compare':
        print(compare(sub, rest[0]));
        break;

      case 'snaps':
        print(listSnapshots(sub));
        break;

      case 'proposal': {
        if (sub === 'draft') {
          print(draftProposal({
            currentGoal: flags.current,
            proposedGoal: flags.proposed,
            justification: flags.why || flags.justification,
            envId: flags.env || null,
          }));
        } else if (sub === 'list') print(listProposals(rest[0] || 'pending'));
        else if (sub === 'show') print(getProposal(rest[0]));
        else if (sub === 'approve') print(approve(rest[0], { note: flags.note || '' }));
        else if (sub === 'reject') print(reject(rest[0], { note: flags.note || '' }));
        else if (sub === 'adopt') print(adopt(rest[0], rest[1], { actor: 'human' }));
        else {
          console.error('proposal draft|list|show|approve|reject|adopt');
          process.exit(2);
        }
        break;
      }

      case 'memory':
        print({ index: memoryIndex(), history: history({ kind: flags.kind || null, limit: Number(flags.limit || 30) }) });
        break;

      case 'eval':
        print(runAllEvals());
        break;

      case 'test': {
        const { spawnSync } = await import('node:child_process');
        const r = spawnSync(process.execPath, [new URL('./tests/run-all.mjs', import.meta.url).pathname], {
          stdio: 'inherit',
          env: process.env,
        });
        process.exit(r.status ?? 1);
        break;
      }

      case 'assert-alive':
        assertAlive('cli');
        print({ alive: true });
        break;

      default:
        console.log(`goal-lab CLI — see README.md
Commands: kill-status | env | run | snap | restore | fork | compare | snaps | proposal | memory | eval | test`);
        process.exit(cmd ? 2 : 0);
    }
  } catch (e) {
    if (e instanceof KillSwitchError || e.code === 'GOAL_LAB_KILLED') {
      console.error(e.message);
      process.exit(75);
    }
    console.error(e.message || e);
    process.exit(1);
  }
}

main();
