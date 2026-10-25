/**
 * Kill switch — EXTERNAL to agent decision process.
 *
 * Triggers (any one stops the runner):
 *   1. Env GOAL_LAB_KILL set to a truthy value ("1", "true", "yes", "on")
 *   2. File sentinel at sandbox/goal-lab/KILL exists
 *   3. Process latch: once tripped in this process, stays tripped until process exit
 *   4. SIGTERM / SIGINT → latch
 *
 * IMPORTANT:
 * - This module exports ONLY isKilled / assertAlive / armFromExternal / describeStatus.
 * - There is NO clear() / disarm() export. Agent experiment code must not clear the switch.
 * - Clearing requires a human outside this process: remove KILL file, unset env, then
 *   start a NEW runner process. The in-process latch cannot be reset by agent logic.
 */
import { existsSync, readFileSync } from 'node:fs';
import { KILL_SENTINEL, KILL_ENV } from '../lib/paths.mjs';

/** @type {boolean} Process-local latch — once true, stays true for the life of this process. */
let latched = false;
let latchReason = null;
let signalsArmed = false;

function envTruthy(v) {
  if (v == null || v === '') return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on' || s === 'kill';
}

function sentinelActive() {
  if (!existsSync(KILL_SENTINEL)) return false;
  // Empty or any content counts as active; optional reason on first line.
  try {
    const body = readFileSync(KILL_SENTINEL, 'utf8').trim();
    return { active: true, reason: body || 'KILL sentinel present' };
  } catch {
    return { active: true, reason: 'KILL sentinel present (unreadable)' };
  }
}

/**
 * Arm OS signal handlers so SIGTERM/SIGINT latch the kill switch.
 * Safe to call multiple times.
 */
export function armSignals() {
  if (signalsArmed) return;
  signalsArmed = true;
  const trip = (sig) => {
    latched = true;
    latchReason = `signal ${sig}`;
  };
  process.on('SIGTERM', () => trip('SIGTERM'));
  process.on('SIGINT', () => trip('SIGINT'));
}

/**
 * External arm from operator tooling (sets latch). Does not write the sentinel;
 * use write sentinel / env for durable external stop across restarts.
 */
export function armFromExternal(reason = 'operator arm') {
  latched = true;
  latchReason = reason;
}

/**
 * @returns {{ killed: boolean, reasons: string[] }}
 */
export function isKilled() {
  const reasons = [];
  if (latched) reasons.push(`latched: ${latchReason || 'unknown'}`);
  if (envTruthy(process.env[KILL_ENV])) {
    reasons.push(`env ${KILL_ENV}=${process.env[KILL_ENV]}`);
    // Latch so agent cannot unset env mid-run to continue
    if (!latched) {
      latched = true;
      latchReason = `env ${KILL_ENV}`;
    }
  }
  const sent = sentinelActive();
  if (sent && sent.active) {
    reasons.push(`sentinel: ${sent.reason}`);
    if (!latched) {
      latched = true;
      latchReason = `sentinel: ${sent.reason}`;
    }
  }
  return { killed: reasons.length > 0 || latched, reasons: latched && !reasons.length ? [`latched: ${latchReason}`] : reasons };
}

export class KillSwitchError extends Error {
  constructor(reasons) {
    super(`KILL SWITCH ACTIVE — refusing to continue. Reasons: ${reasons.join('; ')}`);
    this.name = 'KillSwitchError';
    this.reasons = reasons;
    this.code = 'GOAL_LAB_KILLED';
  }
}

/**
 * Call BEFORE every experiment step. Throws KillSwitchError if active.
 * On first trip, latches so subsequent env/file clears by agent code do not resume.
 */
export function assertAlive(context = 'step') {
  const { killed, reasons } = isKilled();
  if (killed) throw new KillSwitchError([...reasons, `at: ${context}`]);
  return true;
}

export function describeStatus() {
  const { killed, reasons } = isKilled();
  return {
    killed,
    reasons,
    latch: latched,
    latchReason,
    sentinelPath: KILL_SENTINEL,
    envVar: KILL_ENV,
    envValue: process.env[KILL_ENV] ?? null,
    note: 'Agent code cannot clear this switch. Human must remove KILL file, unset env, and start a new process.',
  };
}

// Intentionally NO clear / disarm / reset exports.
