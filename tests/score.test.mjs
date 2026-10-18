// Inu Empires -> One Inu Score, server-verified by replay. Run: node tests/score.test.mjs
// Proves: the published score, the submit protocol (src/score.js), that SIM_ID is the content hash of the five sim files kibble-pay
// vendors (and the vendored copies are byte-identical), and that a node replay of recorded inputs reproduces the client's win + hash
// while ANY tampering (log, hash, win step, clans, seed) does not.
import fs from 'fs';
import * as SC from '../src/score.js';
import * as S from '../src/sim.js';
import { setupComputers } from '../src/ai.js';
import { CIVS } from '../src/civs.js';
import { SIM_ID } from '../src/sim-id.js';
import { simId, SIM_FILES } from '../scripts/sim-id.mjs';
const log = []; let pass = 0, fail = 0;
const out = s => { console.log(s); log.push(s); }; const assert = (c, m) => { if (c) { pass++; out('PASS: ' + m); } else { fail++; out('FAIL: ' + m); } };
out('score test ' + new Date().toISOString());
// ---- the published match score (the server computes it from the replay; this copy is display only) ----
assert(SC.matchScore({ mode: 'ai', win: true, simSeconds: 15 * 60, realMs: 15 * 60e3 }) === 40000, 'vs computer, 15 min win = 20,000 + 20,000');
assert(SC.matchScore({ mode: 'mp', win: true, simSeconds: 45 * 60, realMs: 45 * 60e3 }) === 30000, 'online 1v1, 45 min win = 30,000 (no speed bonus)');
assert(SC.matchScore({ mode: 'mp', win: true, simSeconds: 15 * 60, realMs: 15 * 60e3 }) === 45000, 'online 15 min = 50,000 before the 50 pts / real second cap -> 45,000');
assert(SC.matchScore({ mode: 'ai', win: true, simSeconds: 600, realMs: 70e3 }) === 3500, 'capped at 50 points per real second');
assert(SC.matchScore({ mode: 'ai', win: false, simSeconds: 600, realMs: 600e3 }) === 0 && SC.matchScore({ mode: 'sp', win: true, simSeconds: 600, realMs: 600e3 }) === 0 && SC.matchScore({ mode: 'ai', win: true, simSeconds: 50, realMs: 50e3 }) === 0 && SC.matchScore({ mode: 'ai', win: true, spectate: true, simSeconds: 600, realMs: 600e3 }) === 0, 'losses, sandbox, spectating, < 60 s score 0');
assert(SC.inuPoints(100000) === 1000 && SC.inuPoints(25000) === 500 && SC.inuPoints(0) === 0, 'public formula: floor(1000 x sqrt(best/cap))');
// ---- sim id = content hash of the replayed files; kibble-pay's copies are the same bytes ----
const src = new URL('../src/', import.meta.url);
assert(simId(src) === SIM_ID, `src/sim-id.js is fresh (${SIM_ID} = sha256 of ${SIM_FILES.join(', ')}); after a rule change run node scripts/sim-id.mjs --write`);
const KP = '/workspace/kibble-pay/public/lib/empires/';
if (fs.existsSync(KP + 'sim.js')) assert(SIM_FILES.every(f => fs.readFileSync(new URL(f, src)).equals(fs.readFileSync(KP + f))), 'kibble-pay public/lib/empires/* byte-identical to src/* (the server replays exactly these rules)');
else out('  (kibble-pay not checked out: vendored-copy check skipped)');
try { const r = await fetch('https://kibble-pay.vercel.app/api/empires', { signal: AbortSignal.timeout(8000) }); const j = r.ok ? await r.json() : null;
  if (j?.simId) assert(j.simId === SIM_ID, `live kibble-pay /api/empires replays sim ${j.simId} (= this client ${SIM_ID})`); else out(`  (live /api/empires not answering yet: HTTP ${r.status}; checked again after deploy)`);
} catch (e) { out('  (live check skipped: ' + (e.message || e) + ')'); }
const simSrc = SIM_FILES.map(f => fs.readFileSync(new URL(f, src), 'utf8')).join('\n');
assert(!/from '\.\/(score|sim-id|main|net|kibble[\w-]*)\.js'|matchRep|commandLog/.test(simSrc), 'the sim files never read score / reporting code (reporting is read-only)');
// ---- the replay (same steps as kibble-pay api/_lib/empires.js replay()) ----
function world(m) { const w = S.createWorld({ mp: true, seed: m.seed });
  if (m.mode === 'ai') { setupComputers(w, { enemy: m.enemy }); w.players.player.civ = m.civ ?? null; w.viewer = 'player'; }
  else { S.OWNERS.forEach((o, i) => { if (CIVS[m.civs[i]]) w.players[o].civ = m.civs[i]; }); w.victory = true; }
  return w; }
function replay(m, body) { const w = world(m), by = new Map();
  for (const e of body.log) { const c = m.mode === 'ai' ? { tick: e[0], player: 0, type: e[1], args: e[2] } : { tick: e[0], player: e[1], seq: e[2], type: e[3], args: e[4] }; (by.get(c.tick) || by.set(c.tick, []).get(c.tick)).push(c); }
  let winTick = null; for (let t = 0; t < body.endTick; t++) { S.stepTick(w, by.get(t) || []); if (w.winner && winTick == null) winTick = w.tick; }
  return { winner: w.winner || null, winTick, hash: S.stateHash(w) }; }
const verdict = (m, body) => { const r = replay(m, body); return r.hash === body.hash && r.winTick === body.endTick && !!r.winner; };
// ---- online 1v1: the real winning lockstep log (scripts/make-empires-fixture.mjs) ----
const FX = JSON.parse(fs.readFileSync(new URL('fixtures/empires-mp-win.json', import.meta.url), 'utf8'));
assert(FX.simId === SIM_ID, 'fixture was recorded with the current rules');
const mpM = { mode: 'mp', seed: FX.seed, civs: FX.civs }, good = { endTick: FX.endTick, hash: FX.hash, log: FX.log };
let t0 = Date.now(); const r0 = replay(mpM, good);
assert(r0.winner === 'player' && r0.winTick === FX.endTick && r0.hash === FX.hash, `real online log replays to the same win: player 0 conquers on tick ${FX.endTick} (${(FX.endTick / 1200).toFixed(1)} min), hash ${FX.hash} (${Date.now() - t0} ms)`);
const moved = FX.log.map((e, i) => i === Math.floor(FX.log.length / 2) ? [e[0], e[1], e[2], e[3], { ...e[4], ...('x' in e[4] ? { x: e[4].x + 3 } : { id: -1 }) }] : e);
const cases = [
  ['claimed hash changed', { ...good, hash: '12345678' }, mpM],
  ['one command removed', { ...good, log: FX.log.filter((_, i) => i !== 10) }, mpM],
  ['one command changed', { ...good, log: moved }, mpM],
  ['the winner\'s commands re-labelled as seat 1', { ...good, log: FX.log.map(e => [e[0], 1, e[2], e[3], e[4]]) }, mpM],
  ['win step claimed 40 ticks later', { ...good, endTick: FX.endTick + 40 }, mpM],
  ['win step claimed earlier', { ...good, endTick: FX.endTick - 200 }, mpM],
  ['other seed', good, { ...mpM, seed: FX.seed + 1 }],
  ['other clans', good, { ...mpM, civs: [...FX.civs].reverse() }],
];
for (const [name, body, m] of cases) assert(!verdict(m, body), `tampered online result is rejected: ${name}`);
// ---- vs computer: a client-recorded log (commands applied between steps, exactly like main.js issue()) replays to the same hash ----
const aiM = { mode: 'ai', seed: 7, civ: 'shiba', enemy: 'akita' }, w = world(aiM), cmdLog = [];
const issue = (type, args) => { const c = S.makeCommand(type, args, 0, w.tick); cmdLog.push(c); S.applyCommand(w, c); };
for (let i = 0; i < 6000; i++) {
  if (i % 300 === 0) { const tc = w.buildings.find(b => b.owner === 'player' && b.type === 'town_center'); if (tc) issue('train', { id: tc.id, unit: 'villager' }); }
  if (i % 450 === 7) { const v = w.units.filter(u => u.owner === 'player' && u.type === 'villager').map(u => u.id); if (v.length) issue('order', { ids: v.slice(0, 2), x: 20 + (i % 7), y: 18 + (i % 5) }); }
  S.stepTick(w); if (w.winner) break;
}
const rep = { mode: 'ai', win: { tick: w.tick, hash: S.stateHash(w), winner: w.winner || 'none' }, commands: cmdLog };
const aiBody = SC.submitBody(rep, 'T');
assert(aiBody.op === 'submit' && aiBody.ticket === 'T' && aiBody.endTick === w.tick && aiBody.log.length === cmdLog.length && aiBody.log.every(e => e.length === 3), `vs-computer submit body: ${aiBody.log.length} recorded commands as [tick, type, args], endTick ${aiBody.endTick}`);
const ar = replay(aiM, aiBody);
assert(ar.hash === aiBody.hash, `client-recorded vs-computer log (${(w.tick / 1200).toFixed(1)} min) replays to the client's hash ${aiBody.hash}`);
const hDrop = replay(aiM, { ...aiBody, log: aiBody.log.slice(1) }).hash, hSeed = replay({ ...aiM, seed: 8 }, aiBody).hash;
out(`  (dropped first command -> ${hDrop}; seed 8 -> ${hSeed}; client ${aiBody.hash})`);
assert(hDrop !== aiBody.hash, 'vs computer: a dropped command gives a different hash (not scored)');
assert(hSeed !== aiBody.hash, 'vs computer: another map seed gives a different hash (not scored). (Clans are part of the replay, but the state hash only diverges once a clan bonus matters, so a claimed clan is scored only if the inputs still win under it: see the online other-clans case above.)');
// ---- the client protocol ----
assert(SC.shouldSubmit({ mode: 'ai', win: { winner: 'enemy' } }).send === false && SC.shouldSubmit({ mode: 'ai', win: { winner: 'player' } }).send === true, 'vs computer: only a win is sent');
assert(SC.shouldSubmit({ mode: 'mp', win: { winner: 'enemy' } }).send === true, 'online: both players send (the loser\'s copy confirms the winner\'s)');
assert(!SC.shouldSubmit({ mode: 'mp', win: { winner: 'player' }, desync: true }).send && !SC.shouldSubmit({ mode: 'ai', win: { winner: 'player' }, spectate: true }).send && !SC.shouldSubmit({ mode: 'sp', win: { winner: 'player' } }).send && !SC.shouldSubmit({ mode: 'ai', win: null }).send, 'desynced, spectated, sandbox or unfinished matches are not sent');
const mpLog = SC.matchLog('mp', { win: { tick: 100 }, lockstep: [[5, 0, 0, 'stop', {}], [99, 1, 0, 'stop', {}], [100, 0, 1, 'stop', {}]] });
assert(mpLog.length === 2 && mpLog[1][0] === 99, 'online log = lockstep inputs before the winning step only');
const calls = []; const kp = { session: 's', async _req(p, b) { calls.push([p, b]); return b.op === 'start' ? { ticket: 'TK' } : { ok: true, verified: true, scored: true, score: 40000, inuScore: 812 }; } };
const tk = await SC.startTicket(kp, aiM);
assert(tk.ok && calls[0][0] === '/api/empires' && calls[0][1].op === 'start' && calls[0][1].simId === SIM_ID && calls[0][1].seed === 7 && calls[0][1].enemy === 'akita', 'start ticket asked from /api/empires with seed, clans and SIM_ID');
assert(!(await SC.startTicket({ session: null, _req: () => { throw 1; } }, aiM)).ok, 'not signed in: no request, no sign-in popup');
const won = { ...rep, win: { ...rep.win, winner: 'player' }, ticketP: Promise.resolve(tk) };
const sr = await SC.submitMatch(kp, won);
assert(sr.sent && sr.scored && calls[1][1].op === 'submit' && calls[1][1].ticket === 'TK' && !('score' in calls[1][1]) && !('durationMs' in calls[1][1]), 'win submitted as inputs + ticket (no client score or duration in the body)');
assert(/verified by replay: 40000 points · Inu Score 812/.test(SC.resultText(sr)) && /opponent's copy/.test(SC.resultText({ sent: true, pending: true })) && /^Not scored/.test(SC.resultText({ sent: false, reason: 'not scored: x' })), 'result text: verified / waiting for the other copy / not scored');
const n = calls.length; assert(!(await SC.submitMatch(kp, { ...won, ticketP: Promise.resolve({ ok: false, reason: 'not signed in at match start' }) })).sent && calls.length === n, 'no ticket (signed out at start): nothing sent');
const mainSrc = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
assert(!/action=score|reportMatch/.test(mainSrc + fs.readFileSync(new URL('../src/score.js', import.meta.url), 'utf8')), 'the game never posts a score to /api/game?action=score any more');
out(`\n${pass} passed, ${fail} failed`);
fs.mkdirSync(new URL('../proof/', import.meta.url), { recursive: true }); fs.writeFileSync(new URL('../proof/score-test.log', import.meta.url), log.join('\n') + '\n');
process.exit(fail ? 1 : 0);
