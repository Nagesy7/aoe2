// Alive layer isolation test (headless). Run: node tests/alive.test.mjs
// Two identical AI-vs-AI worlds; B also runs the full alive layer (update + drawWorld + drawScreen + pose + sway) every
// frame on a stub canvas with effects, weather and low/full caps exercised. stateHash must match every 60 ticks.
import fs from 'fs';
import * as S from '../src/sim.js';
import { setupComputers } from '../src/ai.js';
import { createAlive, LINES } from '../src/alive.js';
const log = []; let pass = 0, fail = 0; const out = s => { console.log(s); log.push(s); };
const assert = (c, m) => { if (c) { pass++; out('PASS: ' + m); } else { fail++; out('FAIL: ' + m); } };
out('alive test ' + new Date().toISOString());
const mk = () => { const w = S.createWorld({ mp: true, seed: 7 }); setupComputers(w, { player: 'shiba', enemy: 'akita' }); w.players.player.civ = 'shiba'; w.viewer = 'player'; w.spectate = true; return w; };
const stub = () => new Proxy({}, { get: (t, k) => k in t ? t[k] : k === 'measureText' ? () => ({ width: 30 }) : /^create/.test(k) ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
const A = mk(), B = mk(), ctx = stub(), canvas = { width: 422, height: 195 };
const sounds = []; const sfx = { ambient: n => { sounds.push(n); return true; }, setMuted() {} };
const alive = createAlive({ params: new URLSearchParams(''), sfx });
const real = 1 / 60; let same = true, firstBad = -1;
for (let t = 0; t < 3600; t++) {
  S.stepTick(A); S.stepTick(B);
  if (t === 900) alive.debug({ rain: 1 }); if (t === 1500) alive.debug({ phase: 0.75, low: true }); if (t === 2400) alive.set({ weather: false }); if (t === 3000) alive.set({ fx: false, weather: true });
  const tc = B.buildings.find(b => b.owner === 'player' && b.type === 'town_center') || B.units[0];
  const cam = { x: tc.x * S.TILE - canvas.width / 2, y: tc.y * S.TILE - canvas.height / 2 };
  alive.update(B, cam, canvas, null, real); alive.drawWorld(ctx); alive.drawScreen(ctx, B, cam);
  for (const u of B.units) alive.pose(u, { action: 'idle', motion: 'idle' }); for (const n of B.resources) alive.sway(n);
  if (t % 60 === 59 && S.stateHash(A) !== S.stateHash(B)) { same = false; if (firstBad < 0) firstBad = t; }
}
const st = alive.stats(); alive.set({ fx: false, weather: false }); alive.update(B, { x: 0, y: 0 }, canvas, null, real); const off = alive.stats();
assert(same, `stateHash identical with the alive layer running every frame for 3600 ticks (first mismatch ${firstBad})`);
assert(st.counts.particlesPeak > 0 && st.counts.emitted > 0, `particles emitted (${st.counts.emitted}, peak ${st.counts.particlesPeak})`);
assert(st.counts.particlesPeak <= 240, `particle cap respected (peak ${st.counts.particlesPeak} <= 240)`);
assert(st.counts.bubbles > 0, `chatter bubbles shown (${st.counts.bubbles})`);
{ // sandbox world with idle Worker Pups: fidget poses appear; alive never changes the frozen world's hash
  const C = S.createWorld(), h0 = S.stateHash(C), a2 = createAlive({ params: new URLSearchParams('') }); let n = 0; const u0 = C.units.find(u => u.type === 'villager');
  const cam = { x: u0.x * S.TILE - canvas.width / 2, y: u0.y * S.TILE - canvas.height / 2 };
  for (let f = 0; f < 900; f++) { a2.update(C, cam, canvas, null, real); a2.drawWorld(ctx); a2.drawScreen(ctx, C, cam); for (const u of C.units) if (a2.pose(u, { action: 'idle', motion: 'idle' })) n++; }
  assert(n > 0 && S.stateHash(C) === h0, `idle Worker Pups fidget (${n} posed unit-frames over 15 s), world hash unchanged`); }
assert(sounds.length > 0 && sounds.length < 3600 / 60 / 3, `ambient sounds requested sparingly (${sounds.length} in 60 s: ${[...new Set(sounds)].join(',')})`);
assert(off.particles === 0 && off.bubbles.length === 0 && off.drops === 0, `effects + weather off clears particles, rain and bubbles (${off.particles}/${off.drops}/${off.bubbles.length})`);
const BAD = /wololo|age of empires|microsoft|ensemble|relic|forgotten empires/i; const all = Object.values(LINES).flat();
assert(all.length > 20 && !all.some(l => BAD.test(l)), `chatter lines are original (${all.length} lines, no trademarked phrases)`);
out(`\n${pass} passed, ${fail} failed`); fs.mkdirSync('proof', { recursive: true }); fs.writeFileSync('proof/alive-test.log', log.join('\n') + '\n'); process.exit(fail ? 1 : 0);
