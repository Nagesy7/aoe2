/**
 * Human review gate — ONLY path to activate a revised goal.
 * NEVER auto-adopts. Agent attempts without human actor + approved status are refused.
 */
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPROVED_DIR, REJECTED_DIR } from '../lib/paths.mjs';
import { ensureDir, writeJson } from '../lib/fs-util.mjs';
import { getProposal, renderProposalMd } from './pipeline.mjs';
import { getEnv, saveEnv } from '../sandbox/manager.mjs';
import { assertAlive } from '../kill-switch/check.mjs';
import { rememberProposal, rememberGoalChange } from '../memory/store.mjs';

function relocate(id, toDir, patch) {
  const found = getProposal(id);
  if (!found) throw new Error(`proposal not found: ${id}`);
  ensureDir(toDir);
  const updated = { ...found, ...patch };
  delete updated._path;
  delete updated._dir;
  writeJson(join(toDir, `${id}.json`), updated);
  writeFileSync(join(toDir, `${id}.md`), renderProposalMd(updated), 'utf8');
  rmSync(found._path, { force: true });
  rmSync(found._path.replace(/\.json$/, '.md'), { force: true });
  rememberProposal({ id, status: updated.status, proposedGoal: updated.proposedGoal });
  return updated;
}

/** Human approves a pending proposal. */
export function approve(id, { by = 'human', note = '' } = {}) {
  assertAlive('proposals.approve');
  const found = getProposal(id);
  if (!found) throw new Error(`proposal not found: ${id}`);
  if (found.status !== 'pending') throw new Error(`cannot approve from status=${found.status}`);
  return relocate(id, APPROVED_DIR, {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
    reviewedBy: by,
    reviewNote: note || null,
  });
}

export function reject(id, { by = 'human', note = '' } = {}) {
  assertAlive('proposals.reject');
  const found = getProposal(id);
  if (!found) throw new Error(`proposal not found: ${id}`);
  if (found.status !== 'pending') throw new Error(`cannot reject from status=${found.status}`);
  return relocate(id, REJECTED_DIR, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy: by,
    reviewNote: note || 'rejected',
  });
}

/**
 * Adopt an APPROVED proposal onto an env.
 * Throws if not approved or actor is not human/operator.
 */
export function adopt(proposalId, envId, { actor = 'human' } = {}) {
  assertAlive('proposals.adopt');
  const found = getProposal(proposalId);
  if (!found) throw new Error(`proposal not found: ${proposalId}`);
  if (found.status !== 'approved') {
    const err = new Error(
      `REFUSED: cannot adopt proposal ${proposalId} with status="${found.status}". Human approval required.`,
    );
    err.code = 'PROPOSAL_NOT_APPROVED';
    throw err;
  }
  if (actor !== 'human' && actor !== 'operator') {
    const err = new Error(`REFUSED: adopt actor must be human/operator, got "${actor}"`);
    err.code = 'ADOPT_ACTOR_NOT_HUMAN';
    throw err;
  }
  const env = getEnv(envId);
  const prev = env.meta.statedGoal;
  const meta = {
    ...env.meta,
    statedGoal: found.proposedGoal,
    activeGoalId: proposalId,
    previousGoal: prev,
    goalAdoptedAt: new Date().toISOString(),
  };
  const state = {
    ...env.state,
    effectiveGoal: found.proposedGoal,
    notes: [...(env.state.notes || []), `adopted ${proposalId}: ${prev} -> ${found.proposedGoal}`],
  };
  saveEnv(envId, { meta, state });
  rememberGoalChange({
    envId,
    from: prev,
    to: found.proposedGoal,
    proposalId,
    actor,
  });
  return { envId, proposalId, from: prev, to: found.proposedGoal };
}

/** Agent-facing attempt — expected to be refused (for eval harness). */
export function tryAutoAdopt(proposalId, envId) {
  try {
    return adopt(proposalId, envId, { actor: 'agent' });
  } catch (e) {
    return { refused: true, code: e.code || 'REFUSED', message: e.message };
  }
}
