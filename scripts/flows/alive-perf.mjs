// Perf probe for the "alive" layer: title interactive time + in-game frame times at 844x390 (4x CPU throttle via CDP)
// and 1366x768 (no throttle). Busy scene: ?play=watch&seed=7 fast-forwarded 8 sim-minutes so both towns are grown.
//   ctl run alive-perf [--root <dir>] [--tag before|after] [--out proof/alive-perf.json] [--secs 6] [--query '&alive=0']
// --root serves another tree (e.g. a git worktree of HEAD~ for the "before" numbers). Results merge into --out under --tag.
import { resolve } from 'node:path'; import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ROOT, argOf, startServer, base, newPage, closeAll } from '../ctl.mjs';
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
async function measure(phone, url, secs, query, throttle) {
  const p = await newPage({ phone }); const cdp = await p.context().newCDPSession(p);
  const loads = [];
  for (let i = 0; i < 3; i++) { await p.goto(url + '?perf=' + i); if (throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await p.waitForFunction(() => window.game && document.querySelector('#menu') && document.querySelector('#menu').style.display === 'flex', null, { timeout: 60000 });
    loads.push(await p.evaluate(() => Math.round(performance.now()))); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
  await p.goto(url + '?play=watch&seed=7' + query); await p.waitForFunction(() => window.game && window.game.world);
  await p.evaluate(() => window.game.tick(480)); await p.waitForTimeout(1500);
  if (throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); await p.waitForTimeout(1500);
  await cdp.send('Performance.enable'); const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const ft = await p.evaluate(secs => new Promise(ok => { const out = []; let last = performance.now(); const t0 = last;
    const f = now => { out.push(now - last); last = now; if (now - t0 < secs * 1000) requestAnimationFrame(f); else ok(out); }; requestAnimationFrame(f); }), secs);
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const alive = await p.evaluate(() => window.game.alive ? window.game.alive.stats() : null);
  const errors = p.errors.slice(); await p.context().close();
  const frames = ft.slice(1); const total = frames.reduce((a, b) => a + b, 0);
  return { viewport: phone ? '844x390' : '1366x768', cpuThrottle: throttle || 1, titleInteractiveMs: { runs: loads, median: med(loads) },
    fps: +(1000 * frames.length / total).toFixed(1), frameMs: { median: +med(frames).toFixed(2), p95: +pct(frames, 0.95).toFixed(2), max: +Math.max(...frames).toFixed(2) },
    frames: frames.length, busyMsPerFrame: { task: +((m1.TaskDuration - m0.TaskDuration) * 1000 / frames.length).toFixed(2), script: +((m1.ScriptDuration - m0.ScriptDuration) * 1000 / frames.length).toFixed(2) }, alive, errors };
}
export default async function (argv) {
  const root = argOf('root', '', argv), tag = argOf('tag', 'after', argv), out = resolve(ROOT, argOf('out', 'proof/alive-perf.json', argv)), secs = +argOf('secs', '6', argv), query = argOf('query', '', argv);
  const srv = root ? await startServer({ root }) : await base(argv);
  const res = { at: new Date().toISOString(), root: root || 'working tree', query, phone: await measure(true, srv.url, secs, query, 4), desktop: await measure(false, srv.url, secs, query, 0) };
  console.log(tag, JSON.stringify(res, null, 1));
  const all = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {}; all[tag] = res; writeFileSync(out, JSON.stringify(all, null, 1) + '\n');
  await closeAll(); srv.close(); return 0;
}
