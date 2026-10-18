// Phase 1 proof: WebAudio blips. Real phone-landscape taps; reads window.game.sfx.stats() (read-only).
// Checks: no AudioContext before the first touch, one context after, select / order / build / train blips play,
// per-sound cooldown drops a rapid repeat, context suspends on visibilitychange (hidden) and resumes when visible.
import { join } from 'node:path';
import { ROOT, base, argOf, newPage, openTitle, startSandbox, select, order, checker, shot, closeAll, SHOTS } from '../ctl.mjs';
import { writeFileSync } from 'node:fs';
export default async function (argv) {
  const srv = await base(argv); const c = checker(); const p = await newPage({ phone: true }); const st = () => p.S(() => window.game.sfx.stats());
  await openTitle(p, srv.url); c((await st()).hasContext === false, 'no AudioContext before the first user gesture');
  await startSandbox(p); let s = await st(); c(s.hasContext && s.state === 'running', `first touch creates + resumes one AudioContext (${s.state})`);
  const v = await select(p, 'villager'); await p.waitForTimeout(150); s = await st(); c(v && s.played.select === 1, `tap-select a Worker Pup -> select blip (${JSON.stringify(s.played)})`);
  await p.S(() => { const w = window.game.world; w.selection = null; }); await p.waitForTimeout(40); await p.tap(v.q); await p.waitForTimeout(40); s = await st();
  await p.waitForTimeout(300); const pair = await p.S(() => [window.game.sfx.play('select'), window.game.sfx.play('select')]);
  c(pair[0] === true && pair[1] === false, `per-sound cooldown: two select blips in the same frame -> second dropped (${pair})`);
  await p.waitForTimeout(300); const lo = await order(p, { kind: 'berries' }); await p.waitForTimeout(150); s = await st(); c(lo && s.played.order >= 1, `Command tap -> order ack blip (${lo && lo.kind}, order=${s.played.order})`);
  // train: queue a Worker Pup at the Den Hall through the UI command buttons is covered elsewhere; here advance time after a real build order
  await p.S(() => { const g = window.game, w = g.world, tc = w.buildings.find(b => b.owner === 'player' && b.type === 'town_center'); g.sim.selectUnits(w, []); w.selection = { kind: 'building', id: tc.id }; });
  await p.waitForTimeout(100); const trainBtn = p.locator('#commands button').filter({ hasText: /Worker Pup/ }).first();
  if (!(await p.locator('#commands').isVisible()) && await p.locator('#cmdtab').isVisible()) await p.press('#cmdtab');
  if (await trainBtn.count()) await p.tap(await p.mid('#commands button:has-text("Worker Pup")')); else c(false, 'train button visible');
  await p.S(() => window.game.tick(30)); await p.waitForTimeout(200); s = await st(); c(s.played.train >= 1, `Worker Pup trained -> train blip (train=${s.played.train})`);
  await p.S(() => { const g = window.game, w = g.world; g.sim.addBuilding(w, 'house', 40, 40, false, 'player'); }); await p.waitForTimeout(100);
  await p.S(() => { const w = window.game.world, h = w.buildings.find(b => b.type === 'house' && !b.complete); h.progress = h.buildTime; h.hp = h.maxHp; h.complete = true; }); await p.waitForTimeout(200);
  s = await st(); c(s.played.build >= 1, `building completed -> build blip (build=${s.played.build})`);
  await p.S(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(200);
  s = await st(); c(s.state === 'suspended', `tab hidden -> AudioContext suspended (${s.state})`);
  await p.S(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(200);
  s = await st(); c(s.state === 'running', `tab visible -> resumed (${s.state})`);
  c((await p.S(() => window.game.sfx.stats().hasContext)) && !p.errors.length, `single context, no page errors ${p.errors.join(' | ')}`);
  await shot(p, join(SHOTS, 'oct18-phase1-sfx-844x390.png'));
  writeFileSync(join(ROOT, 'proof/phase1-sfx.log'), c.lines.join('\n') + '\n'); await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
