// Phase 5 proof: render loop pauses while the tab is hidden and resumes (no sim catch-up burst) when visible again.
import { join } from 'node:path'; import { writeFileSync } from 'node:fs';
import { ROOT, base, newPage, openTitle, startSkirmish, checker, closeAll } from '../ctl.mjs';
export default async function (argv) {
  const srv = await base(argv); const c = checker(); const p = await newPage({ phone: true }); await openTitle(p, srv.url); await startSkirmish(p);
  const st = () => p.S(() => ({ f: window.game.loop.frames, paused: window.game.loop.paused, tick: window.game.world.tick }));
  const a = await st(); await p.waitForTimeout(500); const b = await st(); c(b.f > a.f + 10 && b.tick > a.tick, `visible: loop running (${b.f - a.f} frames, ${b.tick - a.tick} ticks in 0.5 s)`);
  const setHidden = h => p.S(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  await setHidden(true); await p.waitForTimeout(150); const h0 = await st(); await p.waitForTimeout(1500); const h1 = await st();
  c(h0.paused && h1.f === h0.f && h1.tick === h0.tick, `hidden: no frames, no ticks for 1.5 s (frames ${h0.f}->${h1.f}, tick ${h0.tick}->${h1.tick})`);
  c((await p.S(() => window.game.sfx.stats().state)) !== 'running', 'hidden: audio suspended too');
  await setHidden(false); await p.waitForTimeout(100); const v0 = await st(); await p.waitForTimeout(500); const v1 = await st();
  c(!v1.paused && v1.f > v0.f + 10, `visible again: loop resumed (${v1.f - v0.f} frames in 0.5 s)`);
  c(v0.tick - h1.tick <= 4, `no catch-up burst on resume (${v0.tick - h1.tick} ticks in the first 100 ms)`);
  c(!p.errors.length, `no page errors ${p.errors.join(' | ')}`);
  writeFileSync(join(ROOT, 'proof/phase5-visibility.log'), c.lines.join('\n') + '\n'); await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
