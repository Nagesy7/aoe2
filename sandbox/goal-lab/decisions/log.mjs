/**
 * Plain-language decision log stub.
 * TODO: persist to data/memory/decisions.jsonl; enforce from runner.
 * Not production. Local research only.
 */
import { join } from 'node:path';
import { MEMORY_DIR } from '../lib/paths.mjs';
import { ensureDir, appendJsonlSync } from '../lib/fs-util.mjs';
import { assertAlive } from '../kill-switch/check.mjs';

export const DECISIONS_FILE = join(MEMORY_DIR, 'decisions.jsonl');

/**
 * Record a human-readable decision line. Stub: writes if possible, always returns entry.
 * @param {{ kind: string, plain: string, envId?: string, meta?: object }} entry
 */
export function logDecision(entry) {
  assertAlive('decisions.log');
  const row = {
    type: 'decision',
    stub: true,
    at: new Date().toISOString(),
    kind: entry.kind || 'unknown',
    plain: entry.plain || '(empty — stub)',
    envId: entry.envId || null,
    meta: entry.meta || {},
  };
  // Soft-write so research can call this early without breaking suites
  try {
    ensureDir(MEMORY_DIR);
    appendJsonlSync(DECISIONS_FILE, row);
  } catch {
    /* ignore — stub must not break callers */
  }
  return row;
}

/** Placeholder: once enforced, return false for unexplained actions. */
export function isExplainable(_entry) {
  return true; // TODO: flip default / require plain language
}
