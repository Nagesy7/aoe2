/**
 * Memory layer — persist goal history, failed experiments, alignment reports across sessions.
 * Local-only under data/memory/. Wipeable with the rest of goal-lab.
 */
import { join } from 'node:path';
import { MEMORY_DIR } from '../lib/paths.mjs';
import { ensureDir, appendJsonlSync, readJson, writeJson, existsSync, readFileSync } from '../lib/fs-util.mjs';

const FILES = {
  goals: join(MEMORY_DIR, 'goals.jsonl'),
  proposals: join(MEMORY_DIR, 'proposals.jsonl'),
  experiments: join(MEMORY_DIR, 'experiments.jsonl'),
  alignment: join(MEMORY_DIR, 'alignment.jsonl'),
  failures: join(MEMORY_DIR, 'failures.jsonl'),
  index: join(MEMORY_DIR, 'index.json'),
};

function touchIndex(kind, id) {
  ensureDir(MEMORY_DIR);
  const idx = readJson(FILES.index, { updatedAt: null, counts: {} });
  idx.updatedAt = new Date().toISOString();
  idx.counts[kind] = (idx.counts[kind] || 0) + 1;
  idx.last = { kind, id: id || null, at: idx.updatedAt };
  writeJson(FILES.index, idx);
}

export function rememberGoalChange(entry) {
  appendJsonlSync(FILES.goals, { type: 'goal_change', ...entry });
  touchIndex('goals', entry.proposalId);
}

export function rememberProposal(entry) {
  appendJsonlSync(FILES.proposals, { type: 'proposal', ...entry });
  touchIndex('proposals', entry.id);
}

export function rememberExperiment(entry) {
  appendJsonlSync(FILES.experiments, { type: 'experiment', ...entry });
  touchIndex('experiments', entry.envId);
}

export function rememberAlignmentReport(entry) {
  appendJsonlSync(FILES.alignment, { type: 'alignment_report', ...entry });
  touchIndex('alignment', entry.id);
}

export function rememberFailure(entry) {
  appendJsonlSync(FILES.failures, { type: 'failure', ...entry });
  touchIndex('failures', entry.id || entry.envId);
}

export function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

export function history({ kind = null, limit = 50 } = {}) {
  const all = [];
  const kinds = kind
    ? [kind]
    : ['goals', 'proposals', 'experiments', 'alignment', 'failures'];
  for (const k of kinds) {
    if (!FILES[k] || k === 'index') continue;
    for (const row of readJsonl(FILES[k])) all.push({ kind: k, ...row });
  }
  all.sort((a, b) => String(a._ts || '').localeCompare(String(b._ts || '')));
  return all.slice(-limit);
}

export function memoryIndex() {
  return readJson(FILES.index, { updatedAt: null, counts: {}, last: null });
}

export { FILES, MEMORY_DIR };
