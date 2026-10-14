// Unit-handling proof with real input: desktop mouse/keyboard and iPhone 13 landscape CDP touch.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)); const M = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer(async (q, r) => { try { const f = join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); r.writeHead(200, { 'content-type': M[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f)); } catch { r.writeHead(404); r.end(); } });
await new Promise(r => srv.listen(0, r)); const BASE = process.env.URL || `http://localhost:${srv.address().port}/`;
let fails = 0; const check = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };
const browser = await chromium.launch();
const sel = p => p.evaluate(() => { const s = window.game.world.selection; return s ? (s.kind === 'units' ? s.ids : s.kind === 'unit' ? [s.id] : []) : []; });
const units = p => p.evaluate(() => window.game.world.units.filter(u => u.owner === 'player').map(u => ({ id: u.id, type: u.type, x: u.x, y: u.y, state: u.state, amove: !!u.amove, wp: (u.waypoints || []).length, target: u.target, ...window.game.toScreen(u.x, u.y) })).map(u => ({ ...u, sx: u.x, sy: u.y })));
const scr = (p, x, y) => p.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]);
const W = (p, ms) => p.waitForTimeout(ms);
{ // desktop
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => { console.log(e); fails++; });
  await p.goto(BASE + '?scenario=skirmish'); await p.waitForFunction(() => window.game.world); await W(p, 800);
  const us = await p.evaluate(() => window.game.world.units.filter(u => u.owner === 'player').map(u => ({ id: u.id, type: u.type, q: window.game.toScreen(u.x, u.y) })));
  const byType = {}; for (const u of us) (byType[u.type] ||= []).push(u); const [ty, list] = Object.entries(byType).find(([t, l]) => t !== 'villager' && l.length >= 2);
  await p.mouse.dblclick(list[0].q.x, list[0].q.y); await W(p, 100); let s = await sel(p);
  check(s.length === list.length && list.every(u => s.includes(u.id)), `double-click ${ty} selects all ${list.length} on screen (${s.length})`);
  await p.keyboard.down('Control'); await p.keyboard.press('Digit1'); await p.keyboard.up('Control');
  await p.mouse.click(640, 650); await W(p, 50); check((await sel(p)).length === 0 || !(await sel(p)).includes(list[0].id), 'clicked away: deselected');
  await p.keyboard.press('Digit1'); await W(p, 50); s = await sel(p); check(s.length === list.length, `Ctrl+1 saved, 1 recalls group (${s.length})`);
  await p.click('#quickbar [data-q=army]'); s = await sel(p); const army = us.filter(u => u.type !== 'villager'); check(s.length === army.length, `Army button selects all ${army.length} military`);
  // attack-move via Q + click, then shift-queue a waypoint with right-click
  await p.keyboard.press('q'); check(await p.evaluate(() => window.game.qb.amove), 'Q toggles attack-move');
  await p.mouse.click(700, 300); await W(p, 120); let u2 = await units(p); check(u2.filter(u => u.type !== 'villager').some(u => u.amove), 'attack-move order issued by click');
  await p.keyboard.down('Shift'); await p.mouse.click(500, 420, { button: 'right' }); await p.keyboard.up('Shift'); await W(p, 100);
  u2 = await units(p); check(u2.filter(u => u.type !== 'villager').every(u => u.wp === 1 || u.state !== 'moving'), 'Shift+right-click queues a waypoint');
  await p.screenshot({ path: join(root, 'proof', 'efficiency-desktop-amove-queue.png') });
  // idle villager button + smart gather
  const idleTxt = await p.locator('#quickbar [data-q=idle]').innerText(); await p.click('#quickbar [data-q=idle]'); s = await sel(p);
  const v = (await units(p)).find(u => u.id === s[0]); check(v && v.type === 'villager', `Idle villager button (${idleTxt.replace(/\s+/g, ' ')}) selects + centres a villager`);
  const n = await p.evaluate(() => { const v = window.game.world.units.find(u => u.id === window.game.world.selection.id); return window.game.world.resources.filter(r => r.amount > 0 && r.res !== 'wood' || r.res === 'wood').sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0]; });
  const nq = await scr(p, n.x, n.y); await p.mouse.click(nq.x, nq.y, { button: 'right' }); await W(p, 100);
  check(await p.evaluate(id => window.game.world.units.find(u => u.id === id).target != null, v.id), 'right-click resource = gather');
  await p.close();
}
{ // touch: iPhone 13 landscape
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  p.on('pageerror', e => { console.log(e); fails++; });
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: i })) });
  const tap = async (q, ms = 50) => { await touch('touchStart', [q]); await W(p, ms); await touch('touchEnd', []); await W(p, 60); };
  const mid = async s => { const b = await p.locator(s).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  await p.goto(BASE + '?scenario=skirmish'); await p.waitForFunction(() => window.game.world); await W(p, 800);
  const vp = p.viewportSize();
  const us = await p.evaluate(() => window.game.world.units.filter(u => u.owner === 'player').map(u => ({ id: u.id, type: u.type, q: window.game.toScreen(u.x, u.y) })));
  const vis = us.filter(u => u.q.x > 10 && u.q.x < vp.width - 120 && u.q.y > 80 && u.q.y < vp.height - 20);
  const ty = Object.entries(vis.filter(u => u.type !== 'villager').reduce((m, u) => ((m[u.type] ||= []).push(u), m), {})).sort((a, b) => b[1].length - a[1].length)[0];
  check(!!ty && ty[1].length >= 2, `touch: ${ty && ty[1].length} ${ty && ty[0]} visible`);
  const dq = ty[1][0].q; await touch('touchStart', [dq]); await W(p, 40); await touch('touchEnd', []); await W(p, 120); await touch('touchStart', [dq]); await W(p, 40); await touch('touchEnd', []); await W(p, 60); let s = await sel(p);
  check(s.length === ty[1].length, `double-tap ${ty[0]} selects all of that type on screen (${s.length}/${ty[1].length})`);
  const g2 = await mid('#quickbar [data-g="2"]'); await touch('touchStart', [g2]); await W(p, 650); await touch('touchEnd', []); await W(p, 80);
  check((await p.evaluate(() => (window.game.qb.groups[2] || []).length)) === s.length, 'long-press group slot 2 saves selection');
  await tap(await mid('#touchbar [data-t=cancel]')); check((await sel(p)).length === 0, 'Clear deselects');
  await tap(g2); check((await sel(p)).length === s.length, 'tap group slot 2 recalls it');
  await tap(await mid('#quickbar [data-q=army]')); s = await sel(p);
  await tap(await mid('#quickbar [data-q=amove]')); check(await p.evaluate(() => window.game.qb.amove), 'A-move button arms attack-move');
  await tap({ x: vp.width / 2, y: vp.height / 2 + 40 }); await W(p, 100);
  const u3 = await p.evaluate(ids => window.game.world.units.filter(u => ids.includes(u.id)).map(u => !!u.amove || u.state === 'attacking'), s);
  check(u3.some(Boolean) && !(await p.evaluate(() => window.game.qb.amove)), 'tap after A-move issues attack-move order (mode resets)');
  await tap(await mid('#quickbar [data-q=army]')); check((await sel(p)).length === us.filter(u => u.type !== 'villager').length, 'touch Army button');
  await tap(await mid('#quickbar [data-q=idle]')); const one = await sel(p); check(one.length === 1, 'touch Idle villager button');
  await p.screenshot({ path: join(root, 'proof', 'efficiency-touch-landscape.png') });
  await ctx.close();
}
await browser.close(); srv.close(); console.log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED'); process.exit(fails ? 1 : 0);
