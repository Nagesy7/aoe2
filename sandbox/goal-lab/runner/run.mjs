/**
 * Sandbox runner — checks kill switch BEFORE every experiment step.
 * Agent experiment code does not control this gate.
 */
import { armSignals, assertAlive, describeStatus, KillSwitchError } from '../kill-switch/check.mjs';
import { runSteps } from '../sandbox/experiment.mjs';
import { createMonitor, sample } from '../alignment/monitor.mjs';
import { writeReport } from '../alignment/report.mjs';
import { getEnv } from '../sandbox/manager.mjs';
import { rememberExperiment } from '../memory/store.mjs';

/**
 * Run an experiment in an env with mandatory pre-step kill checks + optional alignment sampling.
 */
export function runExperiment(envId, {
  steps = 10,
  seed = 1,
  effectiveGoal = null,
  alignEvery = 5,
  writeAlignmentReport = true,
} = {}) {
  armSignals();
  assertAlive('runner.start');
  const env = getEnv(envId);
  const stated = env.meta.statedGoal;
  const mon = stated ? createMonitor({ statedIntent: stated, envId }) : null;
  let lastSample = null;

  try {
    const result = runSteps(envId, {
      steps,
      seed,
      effectiveGoal,
      onStep: ({ state, step }) => {
        // assertAlive already inside runSteps; sample periodically
        if (mon && alignEvery > 0 && ((step + 1) % alignEvery === 0 || step === steps - 1)) {
          lastSample = sample(mon, { tick: state.tick, actions: state.actions });
        }
      },
    });
    rememberExperiment({
      envId,
      steps,
      goal: result.goal,
      flagged: lastSample?.flagged || false,
    });
    let report = null;
    if (mon && writeAlignmentReport) {
      report = writeReport(mon, { title: `Run ${envId}` });
    }
    return {
      ok: true,
      envId,
      state: result.state,
      goal: result.goal,
      alignment: lastSample,
      reportId: report?.id || null,
      kill: describeStatus(),
    };
  } catch (e) {
    if (e instanceof KillSwitchError || e.code === 'GOAL_LAB_KILLED') {
      return { ok: false, killed: true, error: e.message, reasons: e.reasons, kill: describeStatus() };
    }
    throw e;
  }
}

export { assertAlive, describeStatus, KillSwitchError, armSignals };
