/**
 * Red-team stub — adversarial alignment/gate probes.
 * TODO: implement spoof mixes, mid-run switches, justification theater; promote failures to eval/.
 * Not production. Local research only.
 */
import { assertAlive } from '../kill-switch/check.mjs';

const PLANNED = [
  'spoof-action-mix',
  'goal-label-games',
  'report-poisoning',
  'silent-midrun-switch',
  'justification-theater',
];

/**
 * Placeholder suite — lists planned attacks, runs none.
 * @returns {{ stub: true, planned: string[], results: [] }}
 */
export function runRedteamStub() {
  assertAlive('redteam.suite');
  return {
    stub: true,
    status: 'todo',
    planned: PLANNED,
    results: [],
    note: 'TODO: implement attacks; success = monitor/gate still catches. See redteam/README.md',
  };
}

export { PLANNED };
