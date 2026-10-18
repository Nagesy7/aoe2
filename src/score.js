// Inu Empires -> One Inu Score, SERVER-VERIFIED (contract: docs/INU_SCORE.md; server: kibble-pay api/_lib/empires.js).
// The game never sends a score. At match start (signed in only) it asks kibble-pay POST /api/empires {op:"start"} for a signed
// start ticket (seed, clans, sim id, server start time). When the match is won it sends the recorded inputs:
//   vs computer : the player's commands [[tick, type, args], ...] (single player already records every command it applies)
//   online 1v1  : the lockstep input log [[tick, player, seq, type, args], ...] both peers executed; BOTH players submit
// plus the tick and state hash right after the winning step. kibble-pay replays the inputs with byte-identical copies of the sim
// (same SIM_ID) and scores only a win the replay reproduces, no faster than real time. Online matches score only when both
// signed-in players' copies agree. Anything that can't be verified is not scored. Skill only: tiers, cosmetics and $KIBBLE never count.
// Published match score (the server computes it from the replay, this copy is for display):
//   win vs computer 20,000 / online 30,000 + speed bonus 30,000 x max(0, 1 - minutes/45); <= 100,000 and <= 50 points per real second.
import { SIM_ID } from './sim-id.js';
export const GAME = 'inu-empires', CAP = 100_000, PER_SEC = 50, MIN_MS = 60_000, PATH = '/api/empires';
export const BASE = { ai: 20_000, mp: 30_000 }, SPEED = 30_000, SPEED_MIN = 45;
export function matchScore({ mode, win, simSeconds, realMs, spectate = false }) {
  if (!win || spectate || !BASE[mode] || !(realMs >= MIN_MS)) return 0;
  const speed = Math.round(SPEED * Math.max(0, 1 - (simSeconds / 60) / SPEED_MIN));
  return Math.max(0, Math.min(CAP, BASE[mode] + speed, Math.floor((PER_SEC * realMs) / 1000)));
}
export const inuPoints = (best, cap = CAP) => Math.floor(1000 * Math.sqrt(Math.min(Math.max(0, best), cap) / cap)); // display only
// Ask for a start ticket (signed-in players only; never pops a sign-in). Returns a promise of { ok, ticket } or { ok:false, reason }.
export function startTicket(kp, m) {
  if (!kp?.session) return Promise.resolve({ ok: false, reason: 'not signed in at match start' });
  const body = m.mode === 'ai' ? { op: 'start', mode: 'ai', seed: m.seed, civ: m.civ ?? null, enemy: m.enemy, simId: SIM_ID }
    : { op: 'start', mode: 'mp', seed: m.seed, civs: m.civs, me: m.me, simId: SIM_ID };
  return kp._req(PATH, body).then(r => r?.ticket ? { ok: true, ticket: r.ticket } : { ok: false, reason: r?.reason || 'no ticket' }, e => ({ ok: false, reason: e?.message || String(e) }));
}
// The exact inputs that produced the winning step (ticks 0 .. win.tick-1).
export function matchLog(mode, rep) {
  const end = rep.win.tick;
  if (mode === 'ai') return (rep.commands || []).filter(c => c.player === 0 && c.tick < end).map(c => [c.tick, c.type, c.args]);
  return (rep.lockstep || []).filter(e => e[0] < end);
}
export function submitBody(rep, ticket) { return { op: 'submit', ticket, endTick: rep.win.tick, hash: rep.win.hash, log: matchLog(rep.mode, rep) }; }
// What we send and when: vs computer only when the player won; online both players send (the loser's copy confirms the winner's).
export function shouldSubmit(rep) {
  if (!rep?.win || rep.spectate || !(rep.mode === 'ai' || rep.mode === 'mp')) return { send: false, reason: 'not a scoring match' };
  if (rep.desync) return { send: false, reason: 'the online match desynced, so it cannot be verified' };
  if (rep.mode === 'ai' && rep.win.winner !== 'player') return { send: false, reason: 'not a win' };
  return { send: true };
}
export async function submitMatch(kp, rep) {
  const s = shouldSubmit(rep); if (!s.send) return { sent: false, reason: s.reason };
  const t = await (rep.ticketP || Promise.resolve({ ok: false, reason: 'not signed in at match start' }));
  if (!t.ok) return { sent: false, reason: `not scored: ${t.reason}` };
  try { const r = await kp._req(PATH, submitBody(rep, t.ticket)); return { sent: true, verified: !!r?.verified, scored: !!r?.scored, pending: !!r?.pending, score: r?.score ?? 0, inuScore: r?.inuScore ?? null, reason: r?.reason || null, response: r }; }
  catch (e) { return { sent: false, reason: e?.message || String(e) }; }
}
export function resultText(r) {
  if (!r) return '';
  if (r.scored) return `Match verified by replay: ${r.score} points${r.inuScore != null ? ` · Inu Score ${r.inuScore}` : ''}`;
  if (r.pending) return 'Match sent: it is scored once your opponent\'s copy confirms it';
  if (r.sent && r.verified && !r.scored && r.reason) return `Match replayed: ${r.reason}`;
  return r.reason ? `Not scored: ${String(r.reason).replace(/^not scored: /, '')}` : '';
}
