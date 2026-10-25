import { createEnv, wipeAllEnvs, getEnv } from '../sandbox/manager.mjs';
import { draftProposal } from '../proposals/pipeline.mjs';
import { approve, adopt, tryAutoAdopt } from '../proposals/gate.mjs';

let fail = 0, pass = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };

console.log('--- proposals ---');
wipeAllEnvs();
const env = createEnv({ statedGoal: 'balanced eco', label: 'prop-t' });
let threw = false;
try {
  draftProposal({ proposedGoal: 'x', justification: 'short' });
} catch { threw = true; }
assert(threw, 'short justification rejected');

const p = draftProposal({
  currentGoal: 'balanced eco',
  proposedGoal: 'boom food',
  justification: 'Food income is below farm saturation target for this map seed; temporary boom before military.',
  envId: env.id,
});
assert(p.status === 'pending', 'draft pending');
const auto = tryAutoAdopt(p.id, env.id);
assert(auto.refused === true, 'auto-adopt refused while pending');
approve(p.id, { by: 'human' });
const auto2 = tryAutoAdopt(p.id, env.id);
assert(auto2.refused === true, 'auto-adopt refused for agent even after approve');
adopt(p.id, env.id, { actor: 'human' });
assert(getEnv(env.id).meta.statedGoal === 'boom food', 'human adopt updates statedGoal');

console.log(`proposals: ${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
