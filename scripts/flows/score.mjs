// Inu Score replay proof: inputs recorded by the REAL client replay in Node (the same steps kibble-pay's /api/empires runs) to the
// exact state hash the browser computed. Real mouse input only; page.evaluate only reads state (and game.tick advances time in
// vs computer, which never issues orders).
//   vs computer : skirmish via the menu, real clicks (gather, house, train), time advanced; the client's recorded command log
//                 (what it submits) replays to the browser's hash at the same tick. A tampered copy does not.
//   online 1v1  : two players (local relay, or --url U: two tabs of one browser on BroadcastChannel) play real clicks; both peers'
//                 recorded lockstep logs are identical and replay to the hash both peers agreed on.
// Usage: node scripts/ctl.mjs run score [--url U]   (log: proof/score-flow.log)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, startServer, browser, closeAll, checker, argOf } from '../ctl.mjs';
import * as S from '../../src/sim.js';
import { setupComputers } from '../../src/ai.js';
import { CIVS } from '../../src/civs.js';
import { SIM_ID } from '../../src/sim-id.js';
import * as SC from '../../src/score.js';
const c = checker(), log = s => { console.log(s); c.lines.push(s); };
const URL0 = argOf('url', process.env.URL), LIVE = !!URL0;
const srv = LIVE ? null : await startServer({ relay: true }); const BASE = LIVE ? (URL0.endsWith('/') ? URL0 : URL0 + '/') : srv.url;
log(`score flow ${new Date().toISOString()} base=${LIVE ? 'live/preview' : 'local relay'} sim ${SIM_ID}`);
function replay(m, log, endTick) { const w = S.createWorld({ mp: true, seed: m.seed });
  if (m.mode === 'ai') { setupComputers(w, { enemy: m.enemy }); w.players.player.civ = m.civ ?? null; w.viewer = 'player'; }
  else { S.OWNERS.forEach((o, i) => { if (CIVS[m.civs[i]]) w.players[o].civ = m.civs[i]; }); w.victory = true; }
  const by = new Map(); for (const e of log) { const x = m.mode === 'ai' ? { tick: e[0], player: 0, type: e[1], args: e[2] } : { tick: e[0], player: e[1], seq: e[2], type: e[3], args: e[4] }; (by.get(x.tick) || by.set(x.tick, []).get(x.tick)).push(x); }
  for (let t = 0; t < endTick; t++) S.stepTick(w, by.get(t) || []);
  return S.stateHash(w); }
// ---- real-input helpers (as scripts/flows/lockstep.mjs) ----
const VW = 1280, VH = 760;
const R = (p, fn, a) => p.evaluate(fn, a);
const scr = (p, x, y) => p.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]);
const onScreen = async (p, x, y, m = 90) => { const s = await scr(p, x, y); return s.x > m && s.y > 60 && s.x < VW - m && s.y < VH - 170; };
const panTo = async (p, x, y) => { await p.mouse.move(640, 380);
  for (let i = 0; i < 80 && !(await onScreen(p, x, y)); i++) { const s = await scr(p, x, y);
    const keys = [s.x < 300 ? 'ArrowLeft' : s.x > 980 ? 'ArrowRight' : null, s.y < 200 ? 'ArrowUp' : s.y > 520 ? 'ArrowDown' : null].filter(Boolean);
    for (const k of keys) await p.keyboard.down(k); await p.waitForTimeout(70); for (const k of keys) await p.keyboard.up(k); } };
const click = async (p, x, y, button = 'left') => { await panTo(p, x, y); const s = await scr(p, x, y); await p.mouse.click(s.x, s.y, { button }); await p.waitForTimeout(60); };
const btn = (p, a) => { const l = p.locator(`#commands button[data-action="${a}"]`);
  const open = async () => { const k = await p.evaluate(t => window.game.buildTabOf?.(t), a); if (!k) return; const tab = p.locator(`#commands [data-action=btab-${k}]`);
    await tab.waitFor({ timeout: 3000 }).catch(() => {}); if (await tab.count() && !(await l.isVisible())) await tab.click(); };
  return new Proxy(l, { get: (o, m) => typeof o[m] === 'function' ? async (...x) => { await open(); return o[m](...x); } : o[m] }); };
const myUnits = p => R(p, () => { const w = window.game.world; return w.units.filter(u => u.owner === w.viewer).map(u => ({ id: u.id, type: u.type, x: u.x, y: u.y })); });
const myTc = p => R(p, () => { const w = window.game.world; const b = w.buildings.find(b => b.type === 'town_center' && b.owner === w.viewer); return { id: b.id, x: b.x, y: b.y }; });
const nearest = (p, kind, from) => R(p, ([kind, from]) => window.game.world.resources.filter(n => n.kind === kind && n.amount > 0).sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0], [kind, from]);
const econ = async p => { const tc = await myTc(p), us = (await myUnits(p)).filter(u => u.type === 'villager'), cc = { x: tc.x + 2, y: tc.y + 2 };
  const ber = await nearest(p, 'berries', cc), gold = await nearest(p, 'gold_mine', cc);
  await click(p, us[0].x, us[0].y); await click(p, ber.x, ber.y, 'right');
  await click(p, us[1].x, us[1].y); await click(p, gold.x, gold.y, 'right');
  await click(p, us[2].x, us[2].y); await btn(p, 'house').click();
  const hx = tc.x < 40 ? tc.x + 6 : tc.x - 3, hy = tc.y + 1; await click(p, hx + 1, hy + 1);
  await click(p, cc.x, cc.y); await btn(p, 'train').click(); await btn(p, 'train').click(); };
const b = await browser();
// ---- vs computer ----
{ const ctx = await b.newContext({ viewport: { width: VW, height: VH } }), p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?seed=11'); await p.waitForFunction(() => window.game && document.querySelector('#menu'));
  await p.selectOption('#civ', 'kai'); await p.selectOption('#ai-civ', 'hokkaido'); await p.click('#btn-ai'); await p.waitForFunction(() => window.game.world && window.game.matchRep());
  await econ(p); await R(p, () => window.game.tick(90));
  const u = (await myUnits(p)).filter(x => x.type === 'villager'); const wood = await nearest(p, 'tree', u[3] || u[0]);
  await click(p, u[u.length - 1].x, u[u.length - 1].y); await click(p, wood.x, wood.y, 'right'); await R(p, () => window.game.tick(150));
  const snap = await R(p, () => { const w = window.game.world, m = window.game.matchRep(); return { mode: m.mode, tick: w.tick, hash: window.game.stateHash(), seed: w.seed, civ: w.players.player.civ, enemy: w.computers.enemy.civ, commands: w.commandLog || [], win: m.win }; });
  const body = SC.submitBody({ mode: 'ai', win: { tick: snap.tick, hash: snap.hash }, commands: snap.commands }, 'T');
  c(snap.mode === 'ai' && body.log.length >= 6, `vs computer (seed ${snap.seed}, ${snap.civ} vs ${snap.enemy}): ${body.log.length} commands recorded from real clicks, ${(snap.tick / 1200).toFixed(1)} min`);
  const t0 = Date.now(), h = replay({ mode: 'ai', seed: snap.seed, civ: snap.civ, enemy: snap.enemy }, body.log, body.endTick);
  c(h === snap.hash, `node replay of the client's submit log = browser hash at tick ${snap.tick}: ${h} vs ${snap.hash} (${Date.now() - t0} ms)`);
  const bad = body.log.map((e, i) => i === 1 ? [e[0], e[1], { ...e[2], x: (e[2].x ?? 30) + 5 }] : e);
  c(replay({ mode: 'ai', seed: snap.seed, civ: snap.civ, enemy: snap.enemy }, bad, body.endTick) !== snap.hash, 'a tampered copy (one order moved 5 tiles) replays to another hash, so it would not be scored');
  c(!snap.win && !errs.length, `no result yet (nothing sent), no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close(); }
// ---- online 1v1 ----
{ const TABS = LIVE, ctxA = await b.newContext({ viewport: { width: VW, height: VH } }), ctxB = TABS ? ctxA : await b.newContext({ viewport: { width: VW, height: VH } });
  const host = await ctxA.newPage(), guest = await ctxB.newPage(), errs = []; for (const p of [host, guest]) p.on('pageerror', e => errs.push(String(e)));
  const q = `?speed=4${TABS ? '&net=tabs' : ''}`; await host.goto(BASE + q); await guest.goto(BASE + q);
  await host.click('#btn-host'); await host.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('lobby-code').textContent));
  const code = await host.locator('#lobby-code').innerText(); await guest.click('#join-code'); await guest.keyboard.type(code); await guest.click('#btn-join');
  for (const p of [host, guest]) await p.waitForFunction(() => !document.getElementById('btn-ready').disabled, null, { timeout: 15000 });
  await host.click('#btn-ready'); await host.waitForTimeout(300); await guest.click('#btn-ready');
  for (const p of [host, guest]) await p.waitForFunction(() => window.game.net && window.game.world && window.game.matchRep()?.lockstep, null, { timeout: 15000 });
  await Promise.all([econ(host), econ(guest)]);
  await host.waitForFunction(() => window.game.world.tick > 2400, null, { timeout: 240000 });
  const peer = p => R(p, () => { const w = window.game.world, m = window.game.matchRep(); return { lockstep: m.lockstep.slice(), hashes: window.game.net.hashes.slice(), seed: w.seed, civs: [w.players.player.civ, w.players.enemy.civ], tick: w.tick, desync: !!window.game.net.ls.desync }; });
  const [A, B] = await Promise.all([peer(host), peer(guest)]);
  const common = A.hashes.filter(([t, h]) => B.hashes.some(([u, g]) => u === t && g === h)).pop();
  c(!!common && !A.desync && !B.desync, `peers agree: last common checkpoint tick ${common?.[0]} hash ${common?.[1]} (seed ${A.seed}, ${A.civs.join(' vs ')})`);
  const T = common[0], la = A.lockstep.filter(e => e[0] < T), lb = B.lockstep.filter(e => e[0] < T);
  c(la.length >= 10 && JSON.stringify(la) === JSON.stringify(lb) && new Set(la.map(e => e[1])).size === 2, `both peers recorded the identical lockstep log: ${la.length} inputs from both seats before tick ${T}`);
  const t0 = Date.now(), h = replay({ mode: 'mp', seed: A.seed, civs: A.civs }, la, T);
  c(h === common[1], `node replay of that log = the hash both peers agreed on at tick ${T}: ${h} (${Date.now() - t0} ms)`);
  c(replay({ mode: 'mp', seed: A.seed, civs: A.civs }, la.filter(e => e[1] === 0), T) !== common[1], 'dropping one seat\'s inputs gives another hash (not scored)');
  c(!errs.length, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctxA.close(); if (!TABS) await ctxB.close(); }
if (LIVE) try { const j = await (await fetch('https://kibble-pay.vercel.app/api/empires')).json(); c(j.simId === SIM_ID, `live kibble-pay /api/empires replays sim ${j.simId} = this client's ${SIM_ID}`); } catch (e) { c(false, 'live /api/empires: ' + e.message); }
log(`\n${c.lines.filter(l => l.startsWith('PASS')).length} passed, ${c.fails} failed`);
writeFileSync(join(ROOT, 'proof', LIVE ? 'score-flow-live.log' : 'score-flow.log'), c.lines.join('\n') + '\n');
await closeAll(); srv?.close(); process.exit(c.fails ? 1 : 0);
