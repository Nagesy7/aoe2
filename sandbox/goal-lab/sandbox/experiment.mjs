/**
 * Toy experiment step runner — simulates agent actions under a goal inside one env.
 * No production I/O. Kill switch checked every step via runner.
 */
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { getEnv, saveEnv } from './manager.mjs';
import { appendJsonlSync, ensureDir } from '../lib/fs-util.mjs';
import { assertAlive } from '../kill-switch/check.mjs';

const ACTION_WEIGHTS = {
  'balanced eco': { food: 0.35, wood: 0.35, gold: 0.2, stone: 0.1 },
  'maximize wood': { food: 0.1, wood: 0.7, gold: 0.1, stone: 0.1 },
  'rush military': { food: 0.3, wood: 0.2, gold: 0.4, stone: 0.1 },
  'boom food': { food: 0.7, wood: 0.2, gold: 0.05, stone: 0.05 },
};

function weightsFor(goal) {
  if (!goal) return ACTION_WEIGHTS['balanced eco'];
  const key = String(goal).toLowerCase();
  for (const [k, w] of Object.entries(ACTION_WEIGHTS)) {
    if (key.includes(k) || k.includes(key)) return w;
  }
  // unknown goal → skew toward first word heuristic
  if (key.includes('wood')) return ACTION_WEIGHTS['maximize wood'];
  if (key.includes('food') || key.includes('boom')) return ACTION_WEIGHTS['boom food'];
  if (key.includes('military') || key.includes('rush')) return ACTION_WEIGHTS['rush military'];
  return ACTION_WEIGHTS['balanced eco'];
}

function pickAction(weights, rng) {
  const entries = Object.entries(weights);
  let r = rng();
  for (const [res, w] of entries) {
    r -= w;
    if (r <= 0) return { type: 'gather', resource: res, amount: 5 + Math.floor(rng() * 6) };
  }
  return { type: 'gather', resource: entries[0][0], amount: 5 };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run n steps in an env pursuing effectiveGoal (defaults to statedGoal).
 * callback optional for alignment hooks.
 */
export function runSteps(envId, {
  steps = 10,
  seed = 1,
  effectiveGoal = null,
  onStep = null,
} = {}) {
  const env = getEnv(envId);
  const goal = effectiveGoal ?? env.state.effectiveGoal ?? env.meta.statedGoal;
  const rng = mulberry32(seed + (env.state.tick || 0));
  const weights = weightsFor(goal);
  const state = { ...env.state, resources: { ...env.state.resources }, actions: [...(env.state.actions || [])] };
  state.effectiveGoal = goal;

  for (let i = 0; i < steps; i++) {
    assertAlive(`experiment.step env=${envId} i=${i}`);
    const action = pickAction(weights, rng);
    state.tick = (state.tick || 0) + 1;
    state.resources[action.resource] = (state.resources[action.resource] || 0) + action.amount;
    const record = { tick: state.tick, action, goal };
    state.actions.push(record);
    appendJsonlSync(env.paths.log, record);
    ensureDir(env.paths.workspace);
    writeFileSync(
      join(env.paths.workspace, 'last-action.json'),
      JSON.stringify(record, null, 2) + '\n',
    );
    if (onStep) onStep({ envId, state, record, step: i });
  }

  const meta = { ...env.meta, status: 'ran', lastRanAt: new Date().toISOString() };
  saveEnv(envId, { meta, state });
  return { envId, state, goal, steps };
}
