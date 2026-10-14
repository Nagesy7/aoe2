// Round 4 browser proof. All selections/orders/UI actions are issued with REAL mouse/keyboard input
// through Playwright. page.evaluate is used only to READ state and to advance simulated time (window.game.tick).
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try { const f = join(root, p === '/' ? 'index.html' : p); res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, r));
await mkdir(join(root, 'proof'), { recursive: true });
const logLines = []; const log = s => { console.log(s); logLines.push(s); };
let fails = 0; const check = (c, m) => { log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { log('pageerror ' + e); fails++; });
await page.goto(`http://localhost:${server.address().port}/`); await page.waitForFunction(() => window.game);
const shot = async name => { await page.waitForTimeout(120); await page.screenshot({ path: join(root, 'proof', name) }); log(`  saved proof/${name}`); };
const S = fn => page.evaluate(fn);                      // read-only state access
const advance = s => page.evaluate(s => window.game.tick(s), s); // time advance hook
const scr = (x, y) => page.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]);
const text = async sel => { await page.waitForTimeout(100); return (await page.locator(sel).innerText()).replace(/\n/g, ' | '); };
const hud = () => text('#hud');

log(`round4 browser proof ${new Date().toISOString()}`);
check(/Food: 200.*Wood: 200.*Gold: 100.*Stone: 100.*Pop 3\/5/.test(await hud()), `start HUD: ${await hud()}`);
await shot('round4-00-start.png');

// --- TC: train queue ---
const tcP = await scr(34, 34); await page.mouse.click(tcP.x, tcP.y);
const trainBtn = page.locator('button[data-action=train]');
await trainBtn.click(); await trainBtn.click();
await advance(6);
check((await S(() => window.game.world.buildings[0].queue.length)) === 2 && /Food: 100/.test(await hud()), `2 villagers queued, food 200 -> 100: ${await hud()}`);
check(/Queue: 2\/5 .*Training Villager: 2\d%/.test(await text('#info')) && await page.locator('#info .bar div').count() === 1 && await page.locator('#info .qi').count() === 2, `TC panel: ${await text('#info')}`);
await shot('round4-01-tc-train-queue.png');

// --- rally point: right-click ground with TC selected ---
const rallyP = await scr(44.5, 36.5); await page.mouse.click(rallyP.x, rallyP.y, { button: 'right' });
check((await S(() => window.game.world.buildings[0].rally)) !== null, 'rally point set by right-click');
await advance(50);
const spawned = await S(() => window.game.world.units.slice(3).map(u => [u.x, u.y]));
check(spawned.length === 2 && new Set(spawned.map(p => p.map(Math.floor).join())).size === 2 && spawned.every(([x, y]) => Math.hypot(x - 44.5, y - 36.5) < 2.5), `2 trained villagers walked to rally: ${JSON.stringify(spawned.map(p => p.map(v => v.toFixed(1))))}`);
check(/Pop 5\/5/.test(await hud()), `HUD ${await hud()}`);
await shot('round4-02-rally-trained.png');

// --- pop cap block ---
await trainBtn.click();
const msg = await text('#msg');
check(/Population cap reached/.test(msg) && /Food: 100/.test(await hud()) && (await S(() => window.game.world.buildings[0].queue.length)) === 0, `training blocked at cap: "${msg}"`);
await shot('round4-03-pop-cap-message.png');

// --- house: ghost valid/invalid, place, construct ---
const v0 = await S(() => { const u = window.game.world.units[0]; return [u.x, u.y]; }); const v0p = await scr(...v0);
await page.mouse.click(v0p.x, v0p.y);
await page.locator('button[data-action=house]').click();
const good = await scr(39, 39); await page.mouse.move(good.x, good.y);
let g = await S(() => window.game.ui.ghost);
check(g && g.valid && g.tx === 38 && g.ty === 38, `ghost follows cursor, valid at (${g?.tx},${g?.ty})`);
await shot('round4-04-house-ghost-valid.png');
await page.mouse.move(tcP.x, tcP.y); g = await S(() => window.game.ui.ghost);
check(g && !g.valid, `ghost red over Town Center at (${g?.tx},${g?.ty})`);
await shot('round4-05-house-ghost-invalid.png');
const bush = await scr(41.5, 31.5); await page.mouse.move(bush.x, bush.y); g = await S(() => window.game.ui.ghost);
check(g && !g.valid, `ghost red over berry bushes at (${g?.tx},${g?.ty})`);
await shot('round4-05b-house-ghost-invalid-bushes.png');
await page.mouse.move(good.x, good.y); await page.mouse.click(good.x, good.y);
const house = await S(() => window.game.world.buildings.find(b => b.type === 'house'));
check(house && !house.complete && /Wood: 175/.test(await hud()), `foundation placed at (${house?.x},${house?.y}), wood 200 -> 175`);
await advance(4);
// drag-box select the 2 rally villagers and right-click the foundation to help build
const bA = await scr(42.5, 34.5), bB = await scr(47, 39);
await page.mouse.move(bA.x, bA.y); await page.mouse.down(); await page.mouse.move(bB.x, bB.y, { steps: 8 }); await page.mouse.up();
check(/2 Villagers selected/.test(await text('#info')), `drag-selected rally villagers: ${await text('#info')}`);
const fP = await scr(39, 39); await page.mouse.click(fP.x, fP.y, { button: 'right' });
await advance(5);
const builders = await S(() => window.game.world.units.filter(u => u.state === 'building').length);
const p1 = await S(() => window.game.world.buildings.find(b => b.type === 'house').progress);
await page.mouse.click(fP.x, fP.y);   // select the foundation to show its progress panel
check(builders === 3 && /House \(foundation\)/.test(await text('#info')), `3 villagers building; panel: ${await text('#info')}`);
await shot('round4-06-house-construction.png');
await advance(1); const p2 = await S(() => window.game.world.buildings.find(b => b.type === 'house').progress);
check((p2 - p1) >= 2.5, `3 builders add >=2.5 build-seconds per 1s advance (${(p2 - p1).toFixed(2)}; extra from real-time frames)`);
await advance(15);
check((await S(() => window.game.world.buildings.find(b => b.type === 'house').complete)) && /Pop 5\/10/.test(await hud()), `house complete: ${await hud()}`);
check(/Provides \+5 population/.test(await text('#info')), `house panel: ${await text('#info')}`);
await shot('round4-07-house-complete-pop10.png');

// --- drag-box multi-select of all 5 ---
const dA = { x: 420, y: 250 }, dB = { x: 1150, y: 600 };
await page.mouse.move(dA.x, dA.y); await page.mouse.down(); await page.mouse.move(dB.x, dB.y, { steps: 10 });
await shot('round4-08a-drag-box-in-progress.png');
await page.mouse.up();
check(/5 Villagers selected/.test(await text('#info')), `drag-box: ${await text('#info')}`);
await shot('round4-08b-drag-box-multiselect.png');

// --- multi gather (right-click berry bush) ---
const food0 = await S(() => window.game.world.stockpile.food);
const init = await S(() => window.game.world.resources.reduce((t, n) => t + n.amount, 0));
await page.mouse.click(bush.x, bush.y, { button: 'right' });
await advance(40);
const st = await S(() => { const w = window.game.world; const occ = new Set();
  for (const n of w.resources) if (n.amount > 0) occ.add(`${Math.floor(n.x)},${Math.floor(n.y)}`);
  for (const b of w.buildings) for (let y = b.y; y < b.y + b.size; y++) for (let x = b.x; x < b.x + b.size; x++) occ.add(`${x},${y}`);
  return { food: w.stockpile.food, total: w.resources.reduce((t, n) => t + n.amount, 0), carried: w.units.reduce((t, u) => t + u.carry.amount, 0),
    tiles: w.units.filter(u => u.state === 'gathering').map(u => `${Math.floor(u.x)},${Math.floor(u.y)}`), onBlocked: w.units.filter(u => occ.has(`${Math.floor(u.x)},${Math.floor(u.y)}`)).length }; });
check(st.food > food0 && (init - st.total) === (st.food - food0) + st.carried, `5 villagers on berries: food ${food0} -> ${st.food}, node decrease ${init - st.total} == delivered ${st.food - food0} + carried ${st.carried}`);
check(st.onBlocked === 0 && new Set(st.tiles).size === st.tiles.length, `gatherers on distinct walkable tiles: ${st.tiles.join(' ')}`);
await shot('round4-09-multi-gather.png');

// --- path around forest ---
const u1 = await S(() => { const u = window.game.world.units[0]; return [u.x, u.y]; }); const u1p = await scr(...u1);
await page.mouse.click(u1p.x, u1p.y);
const selId = await S(() => window.game.world.selected);
await page.keyboard.down('w'); await page.waitForTimeout(550); await page.keyboard.up('w'); await page.waitForTimeout(100);
const tgt = await scr(24.5, 16.5); await page.mouse.click(tgt.x, tgt.y, { button: 'right' });
await advance(1.5);
const path = await S(() => { const w = window.game.world, u = w.units.find(o => o.id === w.selected);
  const blocked = (x, y) => w.resources.some(n => n.amount > 0 && Math.floor(n.x) === x && Math.floor(n.y) === y) || w.buildings.some(b => x >= b.x && y >= b.y && x < b.x + b.size && y < b.y + b.size);
  return { n: u.path.length, end: u.path.at(-1), hits: u.path.filter(q => blocked(Math.floor(q.x), Math.floor(q.y))).length, state: u.state }; });
check(selId != null && path.state === 'moving' && path.hits === 0 && path.end && Math.floor(path.end.x) === 24 && Math.floor(path.end.y) === 16, `A* path (${path.n} waypoints) to (24,16) avoids all obstacles`);
await shot('round4-10-path-around-forest.png');
await advance(30);
const fin = await S(() => { const w = window.game.world, u = w.units.find(o => o.id === w.selected); return [Math.floor(u.x), Math.floor(u.y), u.state]; });
check(fin[0] === 24 && fin[1] === 16 && fin[2] === 'idle', `villager arrived above the forest at (${fin[0]},${fin[1]})`);
await shot('round4-11-path-arrived.png');

await browser.close(); server.close();
log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED');
await writeFile(join(root, 'proof/round4.log'), logLines.join('\n') + '\n');
process.exit(fails ? 1 : 0);
