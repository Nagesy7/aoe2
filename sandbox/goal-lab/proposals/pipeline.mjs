/**
 * Goal-proposal pipeline: agent drafts revised goal + written justification.
 * NEVER auto-adopts — human review gate required (see gate.mjs).
 */
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { PENDING_DIR } from '../lib/paths.mjs';
import { ensureDir, writeJson, readJson, listFiles, existsSync } from '../lib/fs-util.mjs';
import { assertAlive } from '../kill-switch/check.mjs';
import { rememberProposal } from '../memory/store.mjs';

function newProposalId() {
  return `prop-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;
}

/**
 * Draft a proposal. Lands in proposals/pending/ only.
 */
export function draftProposal({
  currentGoal,
  proposedGoal,
  justification,
  envId = null,
  evidence = null,
  author = 'agent',
} = {}) {
  assertAlive('proposals.draft');
  if (!proposedGoal) throw new Error('proposedGoal required');
  if (!justification || String(justification).trim().length < 20) {
    throw new Error('justification required (min ~20 chars) — explain WHY, not only WHAT');
  }
  const id = newProposalId();
  const proposal = {
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
    author,
    envId,
    currentGoal: currentGoal ?? null,
    proposedGoal,
    justification: String(justification).trim(),
    evidence: evidence || null,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
  };
  ensureDir(PENDING_DIR);
  const jsonPath = join(PENDING_DIR, `${id}.json`);
  const mdPath = join(PENDING_DIR, `${id}.md`);
  writeJson(jsonPath, proposal);
  writeFileSync(mdPath, renderProposalMd(proposal), 'utf8');
  rememberProposal({ id, status: 'pending', proposedGoal, path: jsonPath });
  return { ...proposal, jsonPath, mdPath };
}

export function renderProposalMd(p) {
  return [
    `# Goal proposal \`${p.id}\``,
    ``,
    `- **Status:** ${p.status}`,
    `- **Created:** ${p.createdAt}`,
    `- **Author:** ${p.author}`,
    `- **Env:** ${p.envId || 'n/a'}`,
    ``,
    `## Current goal`,
    ``,
    p.currentGoal || '_none_',
    ``,
    `## Proposed goal`,
    ``,
    `**${p.proposedGoal}**`,
    ``,
    `## Justification (WHY)`,
    ``,
    p.justification,
    ``,
    p.evidence ? `## Evidence\n\n\`\`\`json\n${JSON.stringify(p.evidence, null, 2)}\n\`\`\`\n` : '',
    `---`,
    ``,
    `Human review required. This proposal is **not** active.`,
    `Approve: \`node cli.mjs proposal approve ${p.id}\``,
    `Reject:  \`node cli.mjs proposal reject ${p.id} --note "..."\``,
    ``,
  ].filter(Boolean).join('\n');
}

export function listProposals(status = 'pending') {
  const dir = status === 'approved'
    ? join(PENDING_DIR, '..', 'approved')
    : status === 'rejected'
      ? join(PENDING_DIR, '..', 'rejected')
      : PENDING_DIR;
  return listFiles(dir, '.json').map(f => readJson(join(dir, f))).filter(Boolean);
}

export function getProposal(id) {
  for (const status of ['pending', 'approved', 'rejected']) {
    const dir = join(PENDING_DIR, '..', status);
    const p = join(dir, `${id}.json`);
    if (existsSync(p)) return { ...readJson(p), _path: p, _dir: dir };
  }
  return null;
}
