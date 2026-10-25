import { rememberExperiment, rememberFailure, history, memoryIndex } from '../memory/store.mjs';

let fail = 0, pass = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };

console.log('--- memory ---');
rememberExperiment({ envId: 'mem-test', scenario: 'unit', flagged: false });
rememberFailure({ id: 'mem-fail', detail: 'synthetic' });
const h = history({ limit: 10 });
assert(h.length >= 1, 'history non-empty');
const idx = memoryIndex();
assert(idx.counts && typeof idx.counts === 'object', 'index counts');

console.log(`memory: ${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
