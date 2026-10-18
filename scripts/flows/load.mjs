// Load-time probe at 844x390 (phone landscape). N cold loads (fresh browser context each = empty cache).
// Per run: TTFB, DOMContentLoaded, first paint / first contentful paint, title interactive (window.game ready and the
// Skirmish button visible + enabled), and the src/*.js module waterfall (start/end per module, waterfall depth).
// Usage: node scripts/ctl.mjs run load [--url U] [--runs 10] [--out proof/load-xxx.json]
import { writeFileSync, mkdirSync } from 'node:fs'; import { dirname } from 'node:path';
import { base, argOf, newPage, closeAll } from '../ctl.mjs';
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)].toFixed(1); };
export default async function (argv) {
  const srv = await base(argv); const runs = +argOf('runs', '10', argv); const out = argOf('out', '', argv); const res = [];
  for (let i = 0; i < runs; i++) {
    const p = await newPage({ phone: true }); const t0 = Date.now();
    await p.goto(srv.url + (srv.url.includes('?') ? '&' : '?') + 'cold=' + t0 + '-' + i, { waitUntil: 'commit' });
    await p.waitForFunction(() => { const b = document.getElementById('btn-ai'); return window.game && b && b.offsetParent && !b.disabled; }, null, { timeout: 30000, polling: 16 });
    const interactive = await p.evaluate(() => performance.now());
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const paint = Object.fromEntries(performance.getEntriesByType('paint').map(e => [e.name, e.startTime]));
      const mods = performance.getEntriesByType('resource').filter(e => /\/src\/[^?]+\.js/.test(e.name)).map(e => ({ file: new URL(e.name).pathname.slice(1), start: +e.startTime.toFixed(1), end: +e.responseEnd.toFixed(1), kb: +(e.transferSize / 1024).toFixed(1) }));
      return { ttfb: +(n.responseStart - n.startTime).toFixed(1), dcl: +n.domContentLoadedEventEnd.toFixed(1), load: +n.loadEventEnd.toFixed(1), firstPaint: paint['first-paint'] ?? null, fcp: paint['first-contentful-paint'] ?? null, mods }; });
    const ends = m.mods.map(x => x.end), starts = m.mods.map(x => x.start);
    // waterfall depth: count of distinct "waves" (a module whose start is after a previous module's end is one wave deeper)
    let depth = 0, edge = -1; for (const x of [...m.mods].sort((a, b) => a.start - b.start)) if (x.start > edge) { depth++; edge = Math.max(...m.mods.filter(y => y.start <= x.start).map(y => y.end)); }
    res.push({ ...m, interactive: +interactive.toFixed(1), modulesDone: ends.length ? Math.max(...ends) : null, firstModule: starts.length ? Math.min(...starts) : null, waves: depth, errors: p.errors.length, wall: Date.now() - t0 });
    console.log(`run ${i + 1}: ttfb ${m.ttfb} ms, fcp ${m.fcp}, modules ${m.mods.length} done @${res.at(-1).modulesDone} (${depth} waves), interactive ${interactive.toFixed(0)} ms`);
    await p.context().close();
  }
  const keys = ['ttfb', 'fcp', 'firstPaint', 'dcl', 'modulesDone', 'interactive', 'waves'];
  const summary = Object.fromEntries(keys.map(k => { const v = res.map(r => r[k]).filter(x => x != null); return [k, v.length ? { median: q(v, 0.5), p90: q(v, 0.9), min: Math.min(...v), max: Math.max(...v) } : null]; }));
  const report = { url: srv.url, viewport: '844x390', runs, when: new Date().toISOString(), summary, results: res };
  console.log(JSON.stringify(summary, null, 1));
  if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 1)); console.log('wrote', out); }
  await closeAll(); srv.close(); return 0;
}
