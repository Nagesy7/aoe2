/**
 * Multiple isolated disposable environments for goal experiments.
 * Each env is under envs/<id>/ — wipeable, local-only, no production side effects.
 */
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { ENVS_DIR, SNAPSHOTS_DIR } from '../lib/paths.mjs';
import {
  ensureDir, writeJson, readJson, wipeDir, copyDir, listDirs, existsSync,
} from '../lib/fs-util.mjs';
import { assertAlive } from '../kill-switch/check.mjs';

function newId(prefix = 'env') {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

function envPaths(id) {
  const root = join(ENVS_DIR, id);
  return {
    root,
    meta: join(root, 'meta.json'),
    state: join(root, 'state.json'),
    workspace: join(root, 'workspace'),
    log: join(root, 'experiment.jsonl'),
  };
}

/**
 * Create an isolated env. Optional statedGoal + seed state.
 * @returns {{ id, paths, meta }}
 */
export function createEnv({ id, statedGoal = null, label = '', seed = null, parentId = null } = {}) {
  assertAlive('sandbox.createEnv');
  const envId = id || newId('env');
  const paths = envPaths(envId);
  if (existsSync(paths.root)) throw new Error(`env already exists: ${envId}`);
  ensureDir(paths.workspace);
  const meta = {
    id: envId,
    label: label || envId,
    createdAt: new Date().toISOString(),
    parentId,
    status: 'ready',
    statedGoal,
    activeGoalId: null, // only set via approved proposal gate
  };
  const state = seed || {
    tick: 0,
    resources: { food: 200, wood: 200, gold: 100, stone: 100 },
    actions: [],
    effectiveGoal: statedGoal,
    notes: [],
  };
  writeJson(paths.meta, meta);
  writeJson(paths.state, state);
  return { id: envId, paths, meta, state };
}

export function getEnv(id) {
  const paths = envPaths(id);
  if (!existsSync(paths.meta)) throw new Error(`env not found: ${id}`);
  return {
    id,
    paths,
    meta: readJson(paths.meta),
    state: readJson(paths.state),
  };
}

export function listEnvs() {
  return listDirs(ENVS_DIR).map(id => {
    try {
      const { meta, state } = getEnv(id);
      return { id, label: meta.label, status: meta.status, statedGoal: meta.statedGoal, tick: state?.tick };
    } catch {
      return { id, error: true };
    }
  });
}

export function saveEnv(id, { meta, state } = {}) {
  assertAlive('sandbox.saveEnv');
  const paths = envPaths(id);
  if (meta) writeJson(paths.meta, meta);
  if (state) writeJson(paths.state, state);
}

export function destroyEnv(id) {
  assertAlive('sandbox.destroyEnv');
  wipeDir(envPaths(id).root);
  return { destroyed: id };
}

export function wipeAllEnvs() {
  assertAlive('sandbox.wipeAllEnvs');
  for (const id of listDirs(ENVS_DIR)) wipeDir(envPaths(id).root);
  return { wiped: true };
}

/**
 * Fork an env (optionally from a snapshot) so competing revised goals can run side by side.
 */
export function forkEnv(sourceId, { label, statedGoal, fromSnapshot } = {}) {
  assertAlive('sandbox.forkEnv');
  const src = fromSnapshot
    ? snapshotPaths(sourceId, fromSnapshot)
    : envPaths(sourceId);
  const srcRoot = fromSnapshot ? src.root : src.root;
  if (!existsSync(fromSnapshot ? src.root : envPaths(sourceId).root)) {
    throw new Error(`fork source missing: ${sourceId}${fromSnapshot ? '@' + fromSnapshot : ''}`);
  }
  const child = createEnv({
    label: label || `fork-of-${sourceId}`,
    statedGoal: statedGoal ?? (fromSnapshot ? null : getEnv(sourceId).meta.statedGoal),
    parentId: sourceId,
  });
  // Replace workspace + state from source
  wipeDir(child.paths.workspace);
  copyDir(join(srcRoot, 'workspace'), child.paths.workspace);
  const srcState = readJson(join(srcRoot, 'state.json'), {});
  writeJson(child.paths.state, { ...srcState, forkedFrom: sourceId, snapshot: fromSnapshot || null });
  const meta = readJson(child.paths.meta);
  meta.forkedFrom = sourceId;
  meta.fromSnapshot = fromSnapshot || null;
  if (statedGoal != null) meta.statedGoal = statedGoal;
  writeJson(child.paths.meta, meta);
  return getEnv(child.id);
}

function snapshotPaths(envId, snapId) {
  return { root: join(SNAPSHOTS_DIR, envId, snapId) };
}

/**
 * Snapshot current env for later restore / compare.
 */
export function snapshot(envId, { snapId, note = '' } = {}) {
  assertAlive('sandbox.snapshot');
  const env = getEnv(envId);
  const id = snapId || `snap-${Date.now().toString(36)}`;
  const dest = join(SNAPSHOTS_DIR, envId, id);
  if (existsSync(dest)) throw new Error(`snapshot exists: ${envId}/${id}`);
  ensureDir(dest);
  copyDir(env.paths.workspace, join(dest, 'workspace'));
  writeJson(join(dest, 'state.json'), env.state);
  writeJson(join(dest, 'meta.json'), {
    ...env.meta,
    snapshotId: id,
    snapshotAt: new Date().toISOString(),
    note,
  });
  return { envId, snapId: id, path: dest };
}

export function listSnapshots(envId) {
  const root = join(SNAPSHOTS_DIR, envId);
  return listDirs(root).map(snapId => {
    const meta = readJson(join(root, snapId, 'meta.json'), {});
    return { snapId, snapshotAt: meta.snapshotAt, note: meta.note, statedGoal: meta.statedGoal };
  });
}

/**
 * Restore env state from a snapshot (in place).
 */
export function restore(envId, snapId) {
  assertAlive('sandbox.restore');
  const snapRoot = join(SNAPSHOTS_DIR, envId, snapId);
  if (!existsSync(snapRoot)) throw new Error(`snapshot not found: ${envId}/${snapId}`);
  const paths = envPaths(envId);
  wipeDir(paths.workspace);
  copyDir(join(snapRoot, 'workspace'), paths.workspace);
  writeJson(paths.state, readJson(join(snapRoot, 'state.json'), {}));
  const meta = readJson(paths.meta);
  meta.status = 'restored';
  meta.restoredFrom = snapId;
  meta.restoredAt = new Date().toISOString();
  writeJson(paths.meta, meta);
  return getEnv(envId);
}

/**
 * Compare two envs (or env@snap) on key metrics for side-by-side goal experiments.
 */
export function compare(a, b) {
  assertAlive('sandbox.compare');
  const load = (ref) => {
    if (ref.includes('@')) {
      const [eid, sid] = ref.split('@');
      const root = join(SNAPSHOTS_DIR, eid, sid);
      return {
        ref,
        meta: readJson(join(root, 'meta.json'), {}),
        state: readJson(join(root, 'state.json'), {}),
      };
    }
    const e = getEnv(ref);
    return { ref, meta: e.meta, state: e.state };
  };
  const A = load(a);
  const B = load(b);
  return {
    a: summarize(A),
    b: summarize(B),
    deltas: {
      tick: (B.state.tick || 0) - (A.state.tick || 0),
      food: (B.state.resources?.food || 0) - (A.state.resources?.food || 0),
      wood: (B.state.resources?.wood || 0) - (A.state.resources?.wood || 0),
      gold: (B.state.resources?.gold || 0) - (A.state.resources?.gold || 0),
      stone: (B.state.resources?.stone || 0) - (A.state.resources?.stone || 0),
    },
  };
}

function summarize({ ref, meta, state }) {
  return {
    ref,
    statedGoal: meta.statedGoal,
    effectiveGoal: state.effectiveGoal,
    tick: state.tick,
    resources: state.resources,
    actionCount: (state.actions || []).length,
  };
}

export { envPaths, ENVS_DIR, SNAPSHOTS_DIR };
