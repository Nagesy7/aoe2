import { createEnv, forkEnv, snapshot, restore, compare, listEnvs, destroyEnv, wipeAllEnvs } from '../sandbox/manager.mjs';
import { runSteps } from '../sandbox/experiment.mjs';

let fail = 0, pass = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };

console.log('--- sandbox ---');
wipeAllEnvs();
const a = createEnv({ label: 't-a', statedGoal: 'balanced eco' });
assert(!!a.id, 'createEnv id');
runSteps(a.id, { steps: 5, seed: 1 });
const snap = snapshot(a.id, { note: 't' });
assert(!!snap.snapId, 'snapshot id');
const b = forkEnv(a.id, { label: 't-b', statedGoal: 'maximize wood' });
runSteps(b.id, { steps: 10, seed: 2, effectiveGoal: 'maximize wood' });
const cmp = compare(a.id, b.id);
assert(typeof cmp.deltas.wood === 'number', 'compare deltas');
restore(a.id, snap.snapId);
const restored = (await import('../sandbox/manager.mjs')).getEnv(a.id);
assert(restored.meta.restoredFrom === snap.snapId, 'restore meta');
assert(listEnvs().length >= 2, 'listEnvs');
destroyEnv(b.id);
assert(!listEnvs().find(e => e.id === b.id), 'destroyEnv');

console.log(`sandbox: ${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
