import { wipeAllEnvs } from '../sandbox/manager.mjs';
import { runAllEvals } from '../eval/harness.mjs';

let fail = 0, pass = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };

console.log('--- eval harness ---');
wipeAllEnvs();
const out = runAllEvals();
for (const r of out.results) {
  assert(r.ok, `${r.name}: ${r.detail}`);
}
assert(out.failed === 0, `all evals passed (${out.passed})`);

console.log(`eval: ${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
