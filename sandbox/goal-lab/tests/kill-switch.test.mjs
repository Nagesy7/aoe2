import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { KILL_SENTINEL } from '../lib/paths.mjs';
import {
  assertAlive, isKilled, describeStatus, KillSwitchError, armFromExternal,
} from '../kill-switch/check.mjs';
import * as killMod from '../kill-switch/check.mjs';

let fail = 0, pass = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };

console.log('--- kill switch ---');

if (existsSync(KILL_SENTINEL)) unlinkSync(KILL_SENTINEL);
delete process.env.GOAL_LAB_KILL;

assert(typeof assertAlive === 'function', 'assertAlive exported');
assert(
  typeof killMod.clear !== 'function' &&
  typeof killMod.disarm !== 'function' &&
  typeof killMod.reset !== 'function',
  'no clear/disarm/reset exports (agent cannot clear)',
);

writeFileSync(KILL_SENTINEL, 'test stop\n');
assert(isKilled().killed === true, 'sentinel trips kill');
let threw = false;
try { assertAlive('test'); } catch (e) {
  threw = e instanceof KillSwitchError || e.code === 'GOAL_LAB_KILLED';
}
assert(threw, 'assertAlive throws KillSwitchError when sentinel set');

unlinkSync(KILL_SENTINEL);
assert(isKilled().killed === true, 'latch holds after agent deletes sentinel');

armFromExternal('extra');
assert(describeStatus().killed === true, 'describeStatus shows killed');

console.log(`kill-switch: ${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
