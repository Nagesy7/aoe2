// Inu Boss Raids for Inu Empires (contract: docs/BOSS_RAIDS.md = /workspace/inu-shared/boss-raids.md, mirrored unchanged).
// The fight itself is the shared deterministic sim src/vendor/boss-raid.js (byte-identical to kibble-pay /lib/boss-raid.js;
// tests/raid.test.mjs checks). This file: recorder, replay player, kibble-pay API client, entry status, guest local bests.
// Free entry, skill only: the client sends only the recorded inputs; the server re-plays them and decides the score.
// Nothing here touches the RTS sim: civs, Kennel tiers and cosmetics give no raid boosts.
import * as BR from './vendor/boss-raid.js';
export { BR };
export const API = 'https://kibble-pay.vercel.app';
export const LOCAL_KEY = 'inu-empires-raid';                      // guest results stay on this device
export const ACTIONS = { left: 'L', right: 'R', bite: 'B' };
// Live fight with input recording. press() queues an action for the next tick (max 3 per tick, as the sim allows).
export function createFight(bossId) {
  const raid = BR.createRaid(bossId), inputs = [], queue = [];
  return { raid, inputs, get s() { return raid.s; },
    press(a) { if (!['L', 'R', 'B'].includes(a) || raid.s.over || queue.length >= BR.MAX_PER_TICK) return false; queue.push(a); return true; },
    tick() { if (raid.s.over) return raid.s; const t = raid.s.tick, now = queue.splice(0); for (const a of now) inputs.push([t, a]); return raid.step(now); },
    result() { return { boss: bossId, score: BR.scoreOf(raid.s), damage: raid.s.dmg, cleared: raid.s.cleared, seconds: raid.s.tick / BR.TICK_HZ, hpLeft: Math.max(0, raid.s.hp), inputs: inputs.slice() }; } };
}
// Replay viewer: feeds stored inputs through createRaid().step, one tick per call.
export function createReplay(bossId, inputs) {
  const bad = BR.checkInputs(inputs); if (bad) throw new Error(bad);
  const raid = BR.createRaid(bossId); let i = 0;
  return { raid, get s() { return raid.s; }, tick() { if (raid.s.over) return raid.s; const now = []; while (i < inputs.length && inputs[i][0] === raid.s.tick) now.push(inputs[i++][1]); return raid.step(now); },
    finish() { while (!raid.s.over) this.tick(); return BR.scoreOf(raid.s); } };
}
// What the pre-fight card says. Server answer wins when signed in (POST join); this is the local hint before that.
export function entryLabel({ signedIn, entry, kennelTier, hasCosmetic }) {
  const e = entry || (kennelTier ? 'auto:kennel' : hasCosmetic ? 'auto:cosmetic' : 'free');
  if (e === 'auto:kennel') return { entry: e, auto: true, text: 'Auto-entered (Kibble Kennel)' };
  if (e === 'auto:cosmetic') return { entry: e, auto: true, text: 'Auto-entered (Inu cosmetic)' };
  return { entry: 'free', auto: false, text: signedIn ? 'Enter free' : 'Enter free (guest: results stay on this device)' };
}
export const fmtLeft = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const short = w => (w && w.length > 10 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w || '?');
// ---- kibble-pay /api/raid ----
export async function getRaid({ f = globalThis.fetch, api = API, event } = {}) {
  try { const r = await f(`${api}/api/raid${event ? '?event=' + encodeURIComponent(event) : ''}`, { cache: 'no-store' }); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); }
  catch (e) { const now = Date.now(), ev = BR.eventAt(now); return { now, offline: true, reason: e.message, version: BR.RAID_VERSION, event: { ...ev, live: true, board: [], roster: { total: 0, auto: 0 } }, schedule: BR.schedule(now, 6) }; } }
export async function getReplay(eventId, wallet, { f = globalThis.fetch, api = API } = {}) {
  const r = await f(`${api}/api/raid?replay=${encodeURIComponent(eventId)}&wallet=${encodeURIComponent(wallet)}`, { cache: 'no-store' }); if (!r.ok) throw new Error('no replay'); return r.json(); }
export const join = kp => kp._req('/api/raid', { op: 'join' });
export const start = kp => kp._req('/api/raid', { op: 'start' });
export const submit = (kp, ticket, inputs) => kp._req('/api/raid', { op: 'submit', ticket, inputs }); // inputs only, never a score
// ---- guest / local bests (per event, with replay) ----
export function localBest(store, eventId) { try { return (JSON.parse(store.getItem(LOCAL_KEY) || '{}'))[eventId] || null; } catch { return null; } }
export function saveLocal(store, eventId, res) { let all = {}; try { all = JSON.parse(store.getItem(LOCAL_KEY) || '{}'); } catch { }
  const prev = all[eventId]; if (prev && prev.score >= res.score) return false;
  all[eventId] = { boss: res.boss, score: res.score, cleared: res.cleared, seconds: res.seconds, inputs: res.inputs, at: Date.now() };
  const keys = Object.keys(all).sort(); while (keys.length > 48) delete all[keys.shift()]; store.setItem(LOCAL_KEY, JSON.stringify(all)); return true; }
