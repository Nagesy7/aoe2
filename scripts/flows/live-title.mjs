// Live-lag check: does the live site serve the code in this checkout?
// 1) live title buttons (rendered in a real phone-landscape browser) == the <button id=btn-*> labels in index.html
// 2) every src/*.js + index.html served by live is byte-identical to the working tree (lists the files that lag)
// Usage: node scripts/ctl.mjs run live-title [--url https://inu-empires.vercel.app] [--video proof/vid] [--save proof/x.webm]
import { readdirSync, readFileSync } from 'node:fs'; import { join } from 'node:path';
import { ROOT, argOf, newPage, openTitle, titleButtons, indexButtons, startSkirmish, checker, closeAll } from '../ctl.mjs';
export default async function (argv) {
  const url = argOf('url', 'https://inu-empires.vercel.app/', argv).replace(/\/?$/, '/'); const c = checker(); const save = argOf('save', '', argv);
  const p = await newPage({ phone: true, video: save ? '/tmp/ctl-video' : undefined });
  await openTitle(p, url, '?nocache=' + Date.now());
  const want = indexButtons(), got = (await titleButtons(p)).filter(b => !['btn-ready', 'btn-leave'].includes(b.id));
  for (const w of want) { const g = got.find(b => b.id === w.id); c(g && g.text === w.text, `title button #${w.id}: live "${g ? g.text : '(missing)'}" vs repo "${w.text}"`); }
  for (const g of got) if (!want.some(w => w.id === g.id)) c(false, `title button #${g.id} "${g.text}" is on live but not in index.html`);
  const files = ['index.html', ...readdirSync(join(ROOT, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f)]; const lag = [];
  for (const f of files) { const r = await fetch(url + f + '?v=' + Date.now(), { cache: 'no-store' }); const live = r.ok ? await r.text() : null; if (live !== readFileSync(join(ROOT, f), 'utf8')) lag.push(f + (r.ok ? '' : ` (${r.status})`)); }
  c(!lag.length, `live serves the repo's files byte-for-byte (${files.length} checked${lag.length ? '; differ: ' + lag.join(', ') : ''})`);
  await p.waitForTimeout(600); await startSkirmish(p); await p.waitForTimeout(2500);
  if (save) { await p.saveVideo(save); console.log('video', save); }
  await closeAll(); console.log(c.fails ? `LIVE-TITLE: ${c.fails} FAILED (live lags the repo)` : 'LIVE-TITLE: live matches the repo'); return c.fails ? 1 : 0;
}
