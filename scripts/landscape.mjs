// Landscape touch proof: iPhone 13 + Pixel 7 landscape with real CDP touch input.
// Tap-select a villager, long-press / Command-tap gather orders, drag-pan, pinch zoom, Box select, build menu; layout + rotation.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import { readFile, mkdir } from 'node:fs/promises'; import { join, extname, normalize } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)); const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let BASE = process.env.URL, server;
if (!BASE) { server = http.createServer(async (req, res) => { const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try { const f = join(root, p === '/' ? 'index.html' : p); res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); } catch { res.writeHead(404); res.end(); } });
  await new Promise(r => server.listen(0, r)); BASE = `http://localhost:${server.address().port}/`; }
await mkdir(join(root, 'proof'), { recursive: true });
let fails = 0; const check = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };
const over = (a, b) => a && b && a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
const browser = await chromium.launch();
for (const [name, tag] of [['iPhone 13 landscape', 'iphone'], ['Pixel 7 landscape', 'pixel']]) {
  const ctx = await browser.newContext({ ...devices[name] }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  p.on('pageerror', e => { console.error(e); fails++; });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: q.id ?? i })) });
  const tap = async (q, ms = 60) => { await touch('touchStart', [q]); await p.waitForTimeout(ms); await touch('touchEnd', []); await p.waitForTimeout(80); };
  const swipe = async (a, b, n = 10) => { await touch('touchStart', [a]); for (let i = 1; i <= n; i++) { await touch('touchMove', [{ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }]); await p.waitForTimeout(16); } await touch('touchEnd', []); await p.waitForTimeout(80); };
  const mid = async sel => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const S = f => p.evaluate(f); const scr = (x, y) => p.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]);
  const bb = async sel => (await p.locator(sel).isVisible()) ? p.locator(sel).boundingBox() : null;
  const vp = p.viewportSize();
  await p.goto(BASE); await p.waitForFunction(() => window.game);
  check(await S(() => document.querySelector('meta[name=viewport]').content.includes('viewport-fit=cover')), `${name}: viewport meta has viewport-fit=cover`);
  const sp = await bb('#btn-sp'); check(sp && sp.y + sp.height <= vp.height, `${name}: Single Player button on screen in landscape menu`);
  await tap(await mid('#btn-sp')); await p.waitForFunction(() => window.game.world);
  const cv = await bb('#game'); check(cv.x === 0 && cv.y === 0 && Math.abs(cv.width - vp.width) < 1 && Math.abs(cv.height - vp.height) < 1, `${name}: canvas fills ${vp.width}x${vp.height}`);
  check(!(await bb('#rotate')), `${name}: no rotate hint in landscape`);
  // tap-select a villager
  const vil = await S(() => { const w = window.game.world; return w.units.filter(u => u.type === 'villager' && u.owner === 'player').map(u => ({ id: u.id, x: u.x, y: u.y })); });
  let v = null; for (const u of vil) { const q = await scr(u.x, u.y); if (q.x > 220 && q.x < vp.width - 240 && q.y > 50 && q.y < vp.height - 40) { v = { ...u, q }; break; } }
  check(!!v, `${name}: a villager is on screen`);
  await tap(v.q); let sel = await S(() => window.game.world.selection);
  check(sel && sel.kind === 'unit' && sel.id === v.id, `${name}: tap selects villager #${v.id} (${JSON.stringify(sel)})`);
  // HUD / info / build menu / touchbar fit without overlapping
  const boxes = { hud: await bb('#hud'), info: await bb('#info'), commands: await bb('#commands'), touchbar: await bb('#touchbar') };
  check(boxes.info && boxes.commands, `${name}: info panel and build menu shown`);
  const ks = Object.keys(boxes); for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) check(!over(boxes[ks[i]], boxes[ks[j]]), `${name}: ${ks[i]} and ${ks[j]} do not overlap`);
  for (const k of ks) { const b = boxes[k]; check(b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1, `${name}: ${k} inside viewport`); }
  // long-press a resource to gather
  const res = await S(() => window.game.world.resources.map(n => ({ id: n.id, x: n.x, y: n.y, res: n.res })));
  const near = res.filter(n => n.res === 'food' || n.res === 'gold' || n.res === 'wood').sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
  let rq = await scr(near.x, near.y); const tgt = { x: vp.width * 0.45, y: vp.height * 0.5 };
  if (Math.hypot(rq.x - tgt.x, rq.y - tgt.y) > 30) { await swipe(rq.x > 0 && rq.x < vp.width && rq.y > 0 && rq.y < vp.height ? rq : { x: vp.width / 2, y: vp.height / 2 }, { x: (rq.x > 0 && rq.x < vp.width && rq.y > 0 && rq.y < vp.height ? tgt.x : vp.width / 2 - (rq.x - tgt.x)), y: (rq.x > 0 && rq.x < vp.width && rq.y > 0 && rq.y < vp.height ? tgt.y : vp.height / 2 - (rq.y - tgt.y)) }); rq = await scr(near.x, near.y); }
  const r = rq.x > 0 && rq.x < vp.width && rq.y > 0 && rq.y < vp.height ? { ...near, q: rq } : null;
  check((await S(() => window.game.world.selection))?.id === v.id, `${name}: villager still selected after touch pan`);
  check(!!r, `${name}: a resource is on screen`);
  await touch('touchStart', [r.q]); await p.waitForTimeout(650); await touch('touchEnd', []);
  await S(() => window.game.tick(15));
  let u = await S(`(() => { const u = window.game.world.units.find(o => o.id === ${v.id}); return { state: u.state, carry: u.carry }; })()`);
  check(u.carry.amount > 0 || u.state === 'gathering', `${name}: long-press orders gather on ${r.res} (state ${u.state}, carry ${u.carry.amount} ${u.carry.res || ''})`);
  // Command toggle + tap also orders
  await tap(await mid('#touchbar [data-t=command]')); check((await S(() => window.game.touch)).command, `${name}: Command toggle on`);
  const sel2 = await S(() => window.game.world.selection); await tap(v.q.x + 60 > vp.width - 250 ? { x: v.q.x - 60, y: v.q.y } : { x: v.q.x + 60, y: v.q.y });
  const lo = await S(() => window.game.world.lastOrder); check(lo && (lo.kind === 'move' || lo.kind === 'attack'), `${name}: Command tap issues order (${lo && lo.kind}) and keeps selection ${JSON.stringify(sel2)}`);
  await tap(await mid('#touchbar [data-t=command]'));
  // open build menu and place a house via touch
  await tap(await mid('#commands button[data-action=house]')); check((await S(() => window.game.ui.placing)) === 'house', `${name}: build menu tap -> placing house`);
  await p.screenshot({ path: join(root, 'proof', `landscape-${tag}-build.png`) });
  await tap(await mid('#touchbar [data-t=cancel]')); check(!(await S(() => window.game.ui.placing)), `${name}: Clear cancels placement`);
  // drag on empty ground pans
  let c0 = await S(() => ({ ...window.game.cam })); await swipe({ x: vp.width / 2 + 80, y: vp.height / 2 }, { x: vp.width / 2 - 80, y: vp.height / 2 - 60 });
  let c1 = await S(() => ({ ...window.game.cam })); check(c1.x > c0.x + 50 && c1.y > c0.y + 30, `${name}: drag pans camera (${Math.round(c0.x)},${Math.round(c0.y)}) -> (${Math.round(c1.x)},${Math.round(c1.y)})`);
  check(!(await S(() => window.game.world.selection)), `${name}: pan did not select anything`);
  await swipe({ x: vp.width / 2 - 80, y: vp.height / 2 - 60 }, { x: vp.width / 2 + 80, y: vp.height / 2 });
  // pinch zoom
  const cx = vp.width / 2, cy = vp.height / 2; await touch('touchStart', [{ x: cx - 40, y: cy }, { x: cx + 40, y: cy, id: 1 }]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: cx - 40 - i * 10, y: cy }, { x: cx + 40 + i * 10, y: cy, id: 1 }]); await p.waitForTimeout(16); }
  await touch('touchEnd', []); const z = await S(() => window.game.zoom()); check(z > 1.5, `${name}: pinch zooms in (zoom ${z.toFixed(2)})`);
  await touch('touchStart', [{ x: cx - 120, y: cy }, { x: cx + 120, y: cy, id: 1 }]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: cx - 120 + i * 10, y: cy }, { x: cx + 120 - i * 10, y: cy, id: 1 }]); await p.waitForTimeout(16); }
  await touch('touchEnd', []); const z2 = await S(() => window.game.zoom()); check(z2 < z, `${name}: pinch zooms out (zoom ${z2.toFixed(2)})`);
  // zoomed tap still selects accurately
  const vq = await S(`(() => { const u = window.game.world.units.find(o => o.id === ${v.id}); return window.game.toScreen(u.x, u.y); })()`);
  if (vq.x > 200 && vq.x < vp.width - 240 && vq.y > 50 && vq.y < vp.height - 50) { await tap(vq); sel = await S(() => window.game.world.selection); check(sel && sel.id === v.id, `${name}: tap-select still accurate at zoom ${z2.toFixed(2)}`); }
  // box select toggle
  await tap(await mid('#touchbar [data-t=box]')); check((await S(() => window.game.touch)).box, `${name}: Box select toggle on`);
  const all = await S(() => window.game.world.units.filter(u => u.owner === 'player').map(u => window.game.toScreen(u.x, u.y)));
  const xs = all.map(q => q.x), ys = all.map(q => q.y);
  await swipe({ x: Math.max(5, Math.min(...xs) - 30), y: Math.max(40, Math.min(...ys) - 30) }, { x: Math.max(...xs) + 30, y: Math.max(...ys) + 30 });
  sel = await S(() => window.game.world.selection); check(sel && sel.kind === 'units' && sel.ids.length >= 2, `${name}: box-drag selects ${sel && sel.ids && sel.ids.length} units`);
  await tap(await mid('#touchbar [data-t=box]'));
  await p.screenshot({ path: join(root, 'proof', `landscape-${tag}.png`) });
  check((await S(() => [scrollX, scrollY, visualViewport.scale].join())) === '0,0,1', `${name}: no page scroll/zoom`);
  // live rotation to portrait: hint shown, not blocking; back to landscape refits
  await p.setViewportSize({ width: vp.height, height: vp.width }); await p.waitForTimeout(250);
  const pc = await bb('#game'), rot = await bb('#rotate');
  check(rot && pc.width === vp.height && pc.height === vp.width && (await S(() => getComputedStyle(document.getElementById('rotate')).pointerEvents)) === 'none', `${name}: portrait shows non-blocking "Rotate for best play", canvas refits ${pc.width}x${pc.height}`);
  await p.screenshot({ path: join(root, 'proof', `landscape-${tag}-rotated-portrait.png`) });
  await p.setViewportSize(vp); await p.waitForTimeout(250); const lc = await bb('#game');
  check(lc.width === vp.width && lc.height === vp.height && !(await bb('#rotate')), `${name}: rotated back, canvas refits ${lc.width}x${lc.height}`);
  await ctx.close();
}
await browser.close(); server?.close();
console.log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED'); process.exit(fails ? 1 : 0);
