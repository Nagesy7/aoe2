import { createEnv, wipeAllEnvs } from '../sandbox/manager.mjs';
import { runSteps } from '../sandbox/experiment.mjs';
import { createMonitor, sample, driftScore, inferEffectiveGoal } from '../alignment/monitor.mjs';
import { writeReport, renderMarkdown } from '../alignment/report.mjs';

let fail = 0, pass = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };

console.log('--- alignment ---');
wipeAllEnvs();
const env = createEnv({ statedGoal: 'balanced eco', label: 'align-t' });
const { state } = runSteps(env.id, { steps: 30, seed: 3, effectiveGoal: 'maximize wood' });
const inferred = inferEffectiveGoal(state.actions);
assert(inferred.goal === 'maximize wood', `infer maximize wood (got ${inferred.goal})`);
const drift = driftScore('balanced eco', state.actions);
assert(drift.flagged === true, `drift flagged (score=${drift.score})`);
const mon = createMonitor({ statedIntent: 'balanced eco', envId: env.id });
sample(mon, { tick: state.tick, actions: state.actions });
const md = renderMarkdown(mon);
assert(md.includes('Needs human review'), 'report mentions human review');
const rep = writeReport(mon, { id: 'test-align-report' });
assert(!!rep.mdPath, 'report written');

console.log(`alignment: ${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
