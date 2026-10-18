// Inu Empires -> One Inu Score (contract: docs/INU_SCORE.md = /workspace/inu-shared/inu-score.md).
// Empires posts one score per won match to kibble-pay POST /api/game?action=score (game "inu-empires", Bearer SIWS session).
// The server enforces max 100,000, perSec 50 and minMs 60 s, keeps the lifetime best, and folds it into the shared Inu Score
// with the public formula floor(1000 x sqrt(min(best, 100000) / 100000)). Skill only: tiers, cosmetics and $KIBBLE never count.
// Match score (published here and in docs/INU_SCORE.md):
//   win vs computer: 20,000 + speed bonus;  win online 1v1: 30,000 + speed bonus;  speed bonus = 30,000 x max(0, 1 - minutes/45)
//   losses, sandbox, spectating and matches under 60 s real time score 0 (nothing is sent);
//   capped by the server rules: <= 100,000 and <= 50 points per real second.
export const GAME = 'inu-empires', CAP = 100_000, PER_SEC = 50, MIN_MS = 60_000;
export const BASE = { ai: 20_000, mp: 30_000 }, SPEED = 30_000, SPEED_MIN = 45;
export function matchScore({ mode, win, simSeconds, realMs, spectate = false }) {
  if (!win || spectate || !BASE[mode] || !(realMs >= MIN_MS)) return 0;
  const speed = Math.round(SPEED * Math.max(0, 1 - (simSeconds / 60) / SPEED_MIN));
  return Math.max(0, Math.min(CAP, BASE[mode] + speed, Math.floor((PER_SEC * realMs) / 1000)));
}
export const inuPoints = (best, cap = CAP) => Math.floor(1000 * Math.sqrt(Math.min(Math.max(0, best), cap) / cap)); // display only; the server computes the real one
// Report once per match. Only with an existing session (never pops a sign-in mid-results).
export async function reportMatch(kp, m) {
  const score = matchScore(m); if (!score) return { sent: false, reason: 'not a scoring match', score };
  if (!kp?.session) return { sent: false, reason: 'not signed in', score };
  try { const r = await kp._req('/api/game?action=score', { game: GAME, score, durationMs: Math.round(m.realMs) }); return { sent: true, score, response: r, inuScore: r?.inuScore ?? null }; }
  catch (e) { return { sent: false, reason: e.message, score }; }
}
