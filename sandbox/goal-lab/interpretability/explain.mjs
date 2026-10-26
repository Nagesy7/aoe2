/**
 * Interpretability stub — WHY a goal change was proposed.
 * TODO: wire evidence from alignment samples, memory failures, resource curves.
 * Not production. Local research only.
 */
import { assertAlive } from '../kill-switch/check.mjs';

/**
 * @param {{ proposalId?: string, envId?: string, justification?: string }} opts
 * @returns {{ stub: true, status: 'todo', why: string, evidence: [], counterfactual: null }}
 */
export function explainProposal(opts = {}) {
  assertAlive('interpretability.explainProposal');
  return {
    stub: true,
    status: 'todo',
    why: opts.justification || '(no justification yet — stub)',
    evidence: [],
    counterfactual: null,
    note: 'TODO: attach alignment/memory traces; see interpretability/README.md',
  };
}

/** @throws always until implemented */
export function requireExplainable(_decision) {
  throw new Error('TODO interpretability.requireExplainable — refuse opaque decisions once decision-log lands');
}
