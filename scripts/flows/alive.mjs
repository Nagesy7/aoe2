// Alive layer proof (docs/ALIVE.md): effects appear, ✨ toggles work by real taps, mute honoured, no console/page errors,
// and the sim hash is unchanged with effects on vs off (both browser runs replayed headless in Node to the same tick).
//   ctl run alive [--url <preview>] [--shots] [--video proof/alive-phone.webm]
import { join } from 'node:path'; import { writeFileSync, mkdirSync } from 'node:fs';
import { ROOT, base, argOf, flag, newPage, checker, shot, closeAll, SHOTS } from '../ctl.mjs';
import * as S from '../../src/sim.js'; import { setupComputers } from '../../src/ai.js';
const WATCH = '?play=watch&seed=7';
const replay = (tick, civ, ai) => { const w = S.createWorld({ mp: true, seed: 7 }); setupComputers(w, { player: civ, enemy: ai }); w.players.player.civ = civ; w.viewer = 'player'; w.spectate = true;
  while (w.tick < tick) S.stepTick(w); return S.stateHash(w); };
async function open(url, q, opts) { const p = await newPage(opts); const cons = []; p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) cons.push(m.text()); });
  p.on('response', r => { if (r.status() >= 400 && !/\/_vercel\/(insights|speed-insights)\//.test(r.url())) cons.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); }); p.cons = cons;
  await p.goto(url + WATCH + q); await p.waitForFunction(() => window.game && window.game.world && window.game.alive, null, { timeout: 30000 }); return p; }
const st = p => p.S(() => window.game.alive.stats());
const camTo = (p, x, y) => p.S(([x, y]) => { const g = window.game, c = document.getElementById('game') || document.querySelector('canvas'); g.cam.x = x * 32 - c.width / 2; g.cam.y = y * 32 - c.height / 2; g.sim.clampCamera(g.cam, c.width, c.height, g.world); }, [x, y]);
export default async function (argv) {
  const srv = await base(argv); const url = srv.url; const c = checker(); const shots = flag('shots', argv) || !argOf('url', '', argv); const video = argOf('video', '', argv);
  // ---- 1. effects ON (phone landscape 844x390), real frames ----
  const p = await open(url, '', { phone: true, video: video ? '/tmp/alive-video' : undefined });
  await p.S(() => window.game.tick(480)); await p.waitForTimeout(6000);
  let s = await st(p); const civs = await p.S(() => [window.game.world.players.player.civ, window.game.world.players.enemy.civ]);
  c(s.settings.fx && s.settings.weather && s.frames > 100, `alive layer loaded and running (${s.frames} frames, low=${s.low} ${s.lowWhy})`);
  c(s.counts.emitted > 0 && s.counts.particlesPeak <= s.caps.particles, `particles: smoke/dust emitted (${s.counts.emitted}, peak ${s.counts.particlesPeak} <= cap ${s.caps.particles})`);
  c(s.counts.birds > 0, `ambient birds spawned (${s.counts.birds})`);
  c(s.walkers > 0 && s.walkers <= s.caps.walkers, `town bustle walkers scale with economy (${s.walkers}/${s.bustleTarget}, cap ${s.caps.walkers})`);
  const on1 = await p.S(() => ({ tick: window.game.world.tick, hash: window.game.stateHash() }));
  await p.S(() => window.game.alive.debug({ say: true })); await p.waitForTimeout(300); s = await st(p);
  c(s.bubbles.length > 0 && s.bubbles.length <= s.caps.bubbles, `chatter bubble shown (${JSON.stringify(s.bubbles)}), capped at ${s.caps.bubbles}`);
  if (shots) await shot(p, join(SHOTS, 'alive-day-844x390.png'));
  // ---- 2. ✨ panel toggles by real taps ----
  await p.press('#fx-open'); await p.waitForTimeout(150); c(await p.locator('#alive-panel').isVisible(), '✨ quick-bar button opens the Sound / Life / Weather panel');
  if (shots) await shot(p, join(SHOTS, 'alive-panel-844x390.png'));
  await p.press('#opt-fx'); await p.waitForTimeout(400); s = await st(p); c(!s.settings.fx && s.particles === 0 && s.bubbles.length === 0, `Life & effects off -> particles/bubbles cleared (${s.particles}, ${s.bubbles.length})`);
  await p.press('#opt-weather'); await p.waitForTimeout(300); s = await st(p); c(!s.settings.weather && s.tint.a === 0 && s.drops === 0, `Weather off -> no tint, no rain (a=${s.tint.a})`);
  await p.press('#opt-sound'); await p.waitForTimeout(150); let sx = await p.S(() => window.game.sfx.stats()); c(sx.muted && !(await p.S(() => window.game.sfx.ambient('birds'))), 'Sound off -> sfx muted, ambient refused');
  const stored = await p.S(() => JSON.parse(localStorage.getItem('inu-alive'))); c(stored.fx === false && stored.weather === false && stored.sound === false, `settings remembered (${JSON.stringify(stored)})`);
  for (const k of ['opt-fx', 'opt-weather', 'opt-sound']) await p.press('#' + k); await p.waitForTimeout(1500); s = await st(p); sx = await p.S(() => window.game.sfx.stats());
  c(s.settings.fx && s.settings.weather && !sx.muted && s.counts.emitted > 0, 'all three back on by tap');
  await p.tap({ x: 420, y: 250 }); await p.waitForTimeout(150); c(!(await p.locator('#alive-panel').isVisible()), 'tapping the map closes the panel');
  // ---- 3. scenes for proof shots (presentation-only debug hooks; shots page only) ----
  if (shots) {
    await p.S(() => window.game.alive.debug({ phase: 0.6 })); await p.waitForTimeout(400); await shot(p, join(SHOTS, 'alive-dusk-844x390.png'));
    await p.S(() => window.game.alive.debug({ phase: 0.78 })); await p.waitForTimeout(400); s = await st(p); c(s.tint.a > 0 && s.tint.a <= 0.3, `night tint stays readable (alpha ${s.tint.a} <= 0.3)`); await shot(p, join(SHOTS, 'alive-night-844x390.png'));
    await p.S(() => window.game.alive.debug({ phase: 0.3, rain: 1 })); await p.waitForTimeout(1500); s = await st(p); c(s.drops > 0, `rain shower draws drops (${s.drops})`); await shot(p, join(SHOTS, 'alive-rain-844x390.png'));
    await p.S(() => window.game.alive.debug({ rain: null })); await p.S(() => window.game.alive.debug({ rain: 0 }));
  }
  c(!p.errors.length && !p.cons.length, `no page errors / console errors on phone (${[...p.errors, ...p.cons].join(' | ').slice(0, 300)})`);
  if (video) { await p.saveVideo(join(ROOT, video)); c(true, `video saved ${video}`); } else await p.context().close();
  // ---- 4. effects OFF (?alive=0): same seed; both pages' hashes must equal a headless Node replay at the same tick ----
  const q = await open(url, '&alive=0', { phone: true }); await q.S(() => window.game.tick(480)); await q.waitForTimeout(6000);
  const offS = await st(q); const off1 = await q.S(() => ({ tick: window.game.world.tick, hash: window.game.stateHash() }));
  c(!offS.settings.fx && !offS.settings.weather && offS.counts.emitted === 0, '?alive=0 runs with the layer fully off');
  const rOn = replay(on1.tick, civs[0], civs[1]), rOff = replay(off1.tick, civs[0], civs[1]);
  c(on1.hash === rOn, `effects ON: browser hash at tick ${on1.tick} == Node replay (${on1.hash})`);
  c(off1.hash === rOff, `effects OFF: browser hash at tick ${off1.tick} == Node replay (${off1.hash})`);
  const offAt = await q.S(t => { const g = window.game; if (g.world.tick > t) return null; g.loop && g.loop.pause && g.loop.pause(); while (g.world.tick < t) g.sim.stepTick(g.world); return g.stateHash(); }, on1.tick);
  c(offAt === null ? off1.hash === rOff : offAt === on1.hash, offAt === null ? `off page already past tick ${on1.tick}; both matched the replay` : `same tick ${on1.tick}: effects ON hash == effects OFF hash (${offAt})`);
  c(!q.errors.length && !q.cons.length, 'no errors with effects off'); await q.context().close();
  // ---- 5. desktop 1366x768 + 750x342 phone: effects run, no errors; shots ----
  const d = await open(url, '', {}); await d.S(() => window.game.tick(900)); await d.waitForTimeout(5000); s = await st(d);
  c(!s.low && s.counts.emitted > 0 && s.counts.birds > 0, `desktop full mode (${s.counts.emitted} particles, ${s.counts.birds} birds, ${s.counts.butterflies} butterflies)`);
  if (shots) {
    const town = await d.S(() => { const w = window.game.world, tc = w.buildings.find(b => b.owner === 'player' && b.type === 'town_center'); return { x: tc.x + 2, y: tc.y + 2 }; });
    await camTo(d, town.x, town.y); await d.S(() => window.game.alive.debug({ say: true })); await d.waitForTimeout(2500); await shot(d, join(SHOTS, 'alive-busy-town-1366x768.png'));
    await d.S(() => window.game.alive.debug({ say: 'Fresh kibble at the market!' })); await d.waitForTimeout(200); await shot(d, join(SHOTS, 'alive-chatter-1366x768.png'));
    // smoke + fire: a damaged Den Hut in a separate sandbox page (watch-mode AIs repair at once; never the hash pages above)
    { const f = await newPage({}); f.errors = f.errors || []; await f.goto(url); await f.waitForFunction(() => window.game && document.querySelector('#menu'));
      await f.click('#m-campaign'); await f.locator('#btn-sp').scrollIntoViewIfNeeded(); await f.click('#btn-sp'); await f.waitForFunction(() => window.game.world && window.game.alive, null, { timeout: 30000 });
      const at = await f.S(() => { const g = window.game, w = g.world, tc = w.buildings.find(b => b.owner === 'player' && b.type === 'town_center'); const S = g.sim;
        const a = S.addBuilding(w, 'house', tc.x + 5, tc.y, true, 'player'), b = S.addBuilding(w, 'blacksmith', tc.x - 4, tc.y + 5, true, 'player'), h = S.addBuilding(w, 'house', tc.x + 5, tc.y + 3, true, 'player');
        for (const o of w.buildings) if (o.type === 'house' && o.x === tc.x + 5 && o.y === tc.y) o.hp = Math.round(o.maxHp * 0.25); return { x: tc.x + 3, y: tc.y + 3 }; });
      await camTo(f, at.x, at.y); await f.waitForTimeout(3500); s = await st(f); c(s.counts.emitted > 0 && !f.errors.length, `sandbox: smoke, forge sparks and fire on a damaged Den Hut (${s.particles} live particles)`);
      await shot(f, join(SHOTS, 'alive-smoke-fire-1366x768.png')); await f.context().close(); }
    const lake = await d.S(() => { const w = window.game.world, tc = w.buildings.find(b => b.owner === 'player' && b.type === 'town_center'); let best = null;
      for (let i = 0; i < w.water.length; i++) if (w.water[i]) { const x = i % w.width, y = i / w.width | 0, dd = Math.hypot(x - tc.x, y - tc.y); if (!best || dd < best.d) best = { x, y, d: dd }; } return best; });
    if (lake) { await camTo(d, lake.x, lake.y); for (let i = 0; i < 6; i++) { await d.S(() => window.game.alive.debug({ spawn: true })); await d.waitForTimeout(450); } }
    s = await st(d); c(s.counts.fishJumps > 0 || !lake, `fish jump in visible water (${s.counts.fishJumps})`); await shot(d, join(SHOTS, 'alive-birds-fish-1366x768.png'));
    await d.S(() => window.game.alive.debug({ phase: 0.6 })); await d.waitForTimeout(400); await camTo(d, town.x, town.y); await d.waitForTimeout(400); await shot(d, join(SHOTS, 'alive-dusk-1366x768.png'));
    await d.S(() => window.game.alive.debug({ phase: 0.78 })); await d.waitForTimeout(400); await shot(d, join(SHOTS, 'alive-night-1366x768.png'));
    await d.S(() => window.game.alive.debug({ phase: 0.3, rain: 1 })); await d.waitForTimeout(1500); await shot(d, join(SHOTS, 'alive-rain-1366x768.png'));
    await d.S(() => window.game.alive.debug({ phase: null, rain: null }));
  }
  c(!d.errors.length && !d.cons.length, `no errors on desktop (${[...d.errors, ...d.cons].join(' | ').slice(0, 300)})`); await d.context().close();
  const m = await open(url, '', { phone: true, ctxOpts: { viewport: { width: 750, height: 342 } } }); await m.S(() => window.game.tick(480)); await m.waitForTimeout(4000); s = await st(m);
  const fit = await m.S(() => { const b = document.getElementById('fx-open').getBoundingClientRect(); return b.width > 0 && b.right <= innerWidth && b.bottom <= innerHeight; });
  await m.press('#fx-open'); await m.waitForTimeout(150); const pf = await m.S(() => { const r = document.getElementById('alive-panel').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; });
  c(s.frames > 60 && s.low && fit && pf && !m.errors.length && !m.cons.length, `750x342 phone: running in low-power (${s.lowWhy}), ✨ button and panel fit on screen, no errors`);
  if (shots) await shot(m, join(SHOTS, 'alive-panel-750x342.png')); await m.context().close();
  mkdirSync(join(ROOT, 'proof'), { recursive: true }); writeFileSync(join(ROOT, 'proof/alive.log'), c.lines.join('\n') + `\n${c.fails ? 'FAIL' : 'ALL PASS'}\n`);
  await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
