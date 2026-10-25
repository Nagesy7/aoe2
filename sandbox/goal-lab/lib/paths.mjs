/**
 * Central paths for goal-lab. Everything under ROOT is local-only / wipeable.
 * Agent experiment workspaces live ONLY under ENVS_DIR; kill sentinel lives OUTSIDE envs.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const ENVS_DIR = join(ROOT, 'envs');
export const SNAPSHOTS_DIR = join(ROOT, 'snapshots');
export const DATA_DIR = join(ROOT, 'data');
export const MEMORY_DIR = join(DATA_DIR, 'memory');
export const ALIGNMENT_REPORTS_DIR = join(DATA_DIR, 'alignment-reports');
export const PROPOSALS_DIR = join(ROOT, 'proposals');
export const PENDING_DIR = join(PROPOSALS_DIR, 'pending');
export const APPROVED_DIR = join(PROPOSALS_DIR, 'approved');
export const REJECTED_DIR = join(PROPOSALS_DIR, 'rejected');
export const FIXTURES_DIR = join(ROOT, 'fixtures');
export const KILL_SWITCH_DIR = join(ROOT, 'kill-switch');

/** External sentinel file — OUTSIDE envs/. Human/operator creates this; agent must not clear it. */
export const KILL_SENTINEL = join(ROOT, 'KILL');

/** Env var name — external to agent decision logic. */
export const KILL_ENV = 'GOAL_LAB_KILL';
