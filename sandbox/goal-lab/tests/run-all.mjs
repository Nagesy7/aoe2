/**
 * Run goal-lab tests in child processes so kill-switch latch does not contaminate later suites.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import { KILL_SENTINEL } from '../lib/paths.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const suites = [
  'sandbox.test.mjs',
  'alignment.test.mjs',
  'proposals.test.mjs',
  'memory.test.mjs',
  'eval.test.mjs',
  'kill-switch.test.mjs', // last: latches process
];

// Ensure no leftover sentinel
if (existsSync(KILL_SENTINEL)) unlinkSync(KILL_SENTINEL);
delete process.env.GOAL_LAB_KILL;

let failed = 0;
for (const s of suites) {
  console.log(`\n======== ${s} ========`);
  const env = { ...process.env };
  delete env.GOAL_LAB_KILL;
  const r = spawnSync(process.execPath, [join(dir, s)], { stdio: 'inherit', env });
  if ((r.status ?? 1) !== 0) failed++;
  // clean sentinel between suites
  if (existsSync(KILL_SENTINEL)) unlinkSync(KILL_SENTINEL);
}
console.log(`\n======== goal-lab total: ${suites.length - failed}/${suites.length} suites passed ========`);
process.exit(failed ? 1 : 0);
