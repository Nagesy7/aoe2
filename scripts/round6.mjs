// Round 6 browser proof (camps, farms, sheep, barracks, build menu). All selections/orders/UI actions are issued with REAL mouse/keyboard input
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
// economy-only scenario: these checks predate the enemy camp (combat is covered by scripts/combat.mjs)
await page.goto(`http://localhost:${server.address().port}/?enemy=0`); await page.waitForFunction(() => window.game);
const shot = async name => { await page.waitForTimeout(120); await page.screenshot({ path: join(root, 'proof', name) }); log(`  saved proof/${name}`); };
const S = fn => page.evaluate(fn);                      // read-only state access
const advance = s => page.evaluate(s => window.game.tick(s), s); // time advance hook
const scr = (x, y) => page.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]);
const text = async sel => { await page.waitForTimeout(100); return (await page.locator(sel).innerText()).replace(/\n/g, ' | '); };
const hud = () => text('#hud');
const W = fn => page.evaluate(fn);
const at = async (wx, wy, button = 'left') => { const p = await scr(wx, wy); await page.mouse.click(p.x, p.y, { button }); };
const unit = id => S(`(() => { const w = window.game.world; const u = w.units.find(o => o.id === ${id}) || w.animals.find(o => o.id === ${id}); return u ? { x: u.x, y: u.y, state: u.state, lastDrop: u.lastDrop, type: u.type, owner: u.owner } : null; })()`);
const clickUnit = async id => { const u = await unit(id); await at(u.x, u.y); };
const bld = type => S(`(() => { const b = window.game.world.buildings.filter(o => o.type === '${type}').at(-1); return b ? { id: b.id, x: b.x, y: b.y, size: b.size, complete: b.complete } : null; })()`);
const until = async (pred, max = 300, step = 1) => { for (let t = 0; t < max; t += step) { if (await S(pred)) return true; await advance(step); } return !!(await S(pred)); };
const drag = async (ax, ay, bx, by) => { const a = await scr(ax, ay), b = await scr(bx, by); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up(); };
const pan = async (key, ms) => { await page.mouse.move(640, 360); await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(80); };
const placeNear = async (wx, wy) => { // real mouse: move ghost around the target until the game reports it valid, then click
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
    const p = await scr(wx + dx, wy + dy); await page.mouse.move(p.x, p.y); await page.waitForTimeout(40);
    const g = await S(() => window.game.ui.ghost); if (g && g.valid) { await page.mouse.click(p.x, p.y); return g; } }
  return null; };
const btn = a => { const l = page.locator(`#commands button[data-action=${a}]`); // build buttons live in tabs: open the right tab with a real click first
  const open = async () => { const k = await page.evaluate(t => window.game.buildTabOf?.(t), a); if (k) await page.locator(`#commands [data-action=btab-${k}]`).waitFor({ timeout: 3000 }).catch(() => {}); if (k && await page.locator(`#commands [data-action=btab-${k}]`).count() && !(await l.isVisible())) await page.click(`#commands [data-action=btab-${k}]`); };
  return new Proxy(l, { get: (o, m) => typeof o[m] === 'function' ? async (...x) => { await open(); return o[m](...x); } : o[m] }); };
const inside = () => S(() => { const w = window.game.world; return [...w.units, ...w.animals].filter(u => { const x = Math.floor(u.x), y = Math.floor(u.y);
  return w.buildings.some(b => !(b.walkable && b.complete) && x >= b.x && y >= b.y && x < b.x + b.size && y < b.y + b.size); }).length; });
log(`round6 browser proof ${new Date().toISOString()}`);
const ids = await S(() => window.game.world.units.map(u => u.id));

// 1. build menu (all 3 villagers box-selected; sheep nearby are not picked up)
await drag(30, 33.6, 38, 36.6);
check(/3 Worker Pups selected/.test(await text('#info')), `drag-box: ${await text('#info')}`);
const labels = await page.locator('#commands .bgrid button').allInnerTexts();
check(['Kennel Hut', 'Granary', 'Rice Paddy', 'Timber Lodge', 'Dig Site', 'Bazaar'].every((n, i) => labels[i]?.startsWith(n)) && /25 wood/.test(labels[0]) && /100 wood/.test(labels[1]), `build menu: ${labels.map(l => l.replace(/\n/g, ' ')).join(' | ')}`);
await shot('round6-01-build-menu.png');

// 2. Lumber Camp by the forest
await btn('lumber_camp').click(); await pan('w', 550);
let g = await placeNear(25, 25); let lc = await bld('lumber_camp');
check(g && lc && !lc.complete && /Wood: 100/.test(await hud()), `lumber camp foundation at (${lc?.x},${lc?.y}); ${await hud()}`);
check(await btn('barracks').isDisabled() && /need 75 wood/.test(await btn('barracks').innerText()) && !(await btn('mill').isDisabled()), `greyed: Barracks "${(await btn('barracks').innerText()).replace(/\n/g, ' ')}"`);
await shot('round6-02-build-menu-greyed.png');
check(await until(`window.game.world.buildings.find(b => b.id === ${lc.id}).complete`, 60), 'lumber camp built by 3 villagers'); check((await inside()) === 0, 'nobody inside');
await shot('round6-03-lumber-camp-built.png');
await drag(lc.x - 3, lc.y - 2, lc.x + 5, lc.y + 4);
await at(24.5, 22.5, 'right');
check(await until(`[${ids}].every(id => window.game.world.units.find(u => u.id === id).lastDrop === ${lc.id})`, 60), 'all 3 woodcutters drop at the Lumber Camp (nearest wood drop-off), not the TC');
await shot('round6-04-villager-uses-lumber-camp.png');
await advance(220);
log(`  after 220s of woodcutting: ${await hud()}`);

// 3. Mining Camp next to gold
const miner = ids[2]; await clickUnit(miner);
await btn('mining_camp').click(); await pan('s', 550);
g = await placeNear(41, 42); const mc = await bld('mining_camp');
check(g && mc, `mining camp foundation at (${mc?.x},${mc?.y})`);
check(await until(`window.game.world.buildings.find(b => b.id === ${mc.id}).complete`, 120), 'mining camp built');
await shot('round6-05-mining-camp-built.png');
await clickUnit(miner); await at(38.5, 42.5, 'right');
check(await until(`window.game.world.units.find(u => u.id === ${miner}).lastDrop === ${mc.id}`, 60), 'gold miner drops at the Mining Camp');
await shot('round6-06-villager-uses-mining-camp.png');

// 4. Mill by the berries
await clickUnit(miner); await btn('mill').click();
g = await placeNear(41, 29); const mill = await bld('mill');
check(g && mill, `mill foundation at (${mill?.x},${mill?.y})`);
check(await until(`window.game.world.buildings.find(b => b.id === ${mill.id}).complete`, 120), 'mill built');
await shot('round6-07-mill-built.png');
await clickUnit(miner); await at(41.5, 31.5, 'right');
check(await until(`window.game.world.units.find(u => u.id === ${miner}).lastDrop === ${mill.id}`, 60), 'forager drops berries at the Mill');
await shot('round6-08-villager-uses-mill.png');

// 5. Farm: ghost invalid away from Mill/TC, valid next to the Mill, built, auto-farmed, depleted
await clickUnit(miner); await btn('farm').click();
let p = await scr(47, 40); await page.mouse.move(p.x, p.y); g = await S(() => window.game.ui.ghost);
check(g && !g.valid && g.size === 3, `farm ghost red away from Mill/TC at (${g?.tx},${g?.ty})`);
await shot('round6-09-farm-ghost-invalid.png');
const fx = mill.x - 1.5, fy = mill.y + 0.5; p = await scr(fx, fy); await page.mouse.move(p.x, p.y); g = await S(() => window.game.ui.ghost);
check(g && g.valid, `farm ghost green touching the Mill at (${g?.tx},${g?.ty})`);
await shot('round6-10-farm-ghost-valid.png');
await page.mouse.click(p.x, p.y); const farm = await bld('farm');
check(farm && (await S(() => window.game.ui.placing)) === null, `farm placed at (${farm?.x},${farm?.y}); build mode exited`);
check(await until(`(() => { const w = window.game.world, u = w.units.find(u => u.id === ${miner}), n = w.resources.find(n => n.farm === ${farm.id}); return n && u.state === 'gathering' && u.target === n.id; })()`, 90), 'farm built; builder auto-farms (standing on the farm)');
await at(farm.x + 0.5, farm.y + 0.5); log(`  farm panel: ${await text('#info')}`);
await shot('round6-11-farming.png');
check(await until(`!window.game.world.buildings.some(b => b.id === ${farm.id})`, 400, 5), 'depleted farm disappears');
await shot('round6-12-farm-depleted-gone.png');

// 6. Sheep: convert by ordering a villager onto it, move it, butcher it
const sheep = await S(() => { const g = window.game; const a = g.world.animals.find(a => { const p = g.toScreen(a.x, a.y); return !a.owner && p.x > 40 && p.x < 1240 && p.y > 36 && p.y < 560; }); return a && a.id; });
check(sheep && (await unit(sheep)).owner === null, `picked a neutral on-screen sheep (id ${sheep}) at ${JSON.stringify(await unit(sheep))}`);
await clickUnit(miner); const sp = await unit(sheep); await at(sp.x, sp.y, 'right');
check(await until(`window.game.world.animals.find(a => a.id === ${sheep}).owner === 'player'`, 40, 0.5), 'villager reached the sheep and converted it');
await clickUnit(sheep); check(/Sheep \| Owner: you/.test(await text('#info')), `sheep panel: ${await text('#info')}`);
await shot('round6-13-sheep-converted.png');
await at(33.5, 38.5, 'right');
await advance(2); await shot('round6-14a-sheep-moving.png');
check(await until(`(() => { const a = window.game.world.animals.find(a => a.id === ${sheep}); return Math.floor(a.x) === 33 && Math.floor(a.y) === 38; })()`, 30, 0.5), 'owned sheep follows its move order to (33,38)');
await shot('round6-14b-sheep-arrived.png');
const food0 = await S(() => window.game.world.stockpile.food);
await clickUnit(miner); const sp2 = await unit(sheep); await at(sp2.x, sp2.y, 'right');
check(await until(`(() => { const w = window.game.world; return !w.animals.some(a => a.id === ${sheep}) && w.resources.some(n => n.kind === 'carcass' && n.amount < 100); })()`, 30, 0.5), 'sheep killed at its location; carcass (100 food) being butchered');
const cc = await S(() => { const n = window.game.world.resources.find(n => n.kind === 'carcass'); return [Math.floor(n.x), Math.floor(n.y), n.amount]; });
check(cc[0] === 33 && cc[1] === 38, `carcass at the sheep's tile (${cc[0]},${cc[1]}), ${cc[2]} left`);
await shot('round6-15-butchering.png');
check(await until(`window.game.world.stockpile.food >= ${food0} + 20`, 60), 'butchered food delivered');

// 7. Barracks -> Militia queue, rally, pop cap
await clickUnit(miner); check(!(await btn('barracks').isDisabled()), 'barracks affordable now'); await btn('barracks').click();
g = await placeNear(45.5, 37.5); const br = await bld('barracks');
check(g && br, `barracks foundation at (${br?.x},${br?.y})`);
check(await until(`window.game.world.buildings.find(b => b.id === ${br.id}).complete`, 150), 'barracks built');
await at(br.x + 1.5, br.y + 1.5);
check(/Train (Kai )?Footpaw/.test(await btn('militia').innerText()) && /60 food, 20 gold, 21s/.test(await btn('militia').innerText()), `barracks button: ${(await btn('militia').innerText()).replace(/\n/g, ' ')}`);
const res0 = await S(() => ({ ...window.game.world.stockpile }));
await btn('militia').click(); await btn('militia').click(); await advance(5);
const res1 = await S(() => ({ ...window.game.world.stockpile }));
check(res0.food - res1.food >= 120 && res0.gold - res1.gold === 40, `2 militia queued: gold ${res0.gold} -> ${res1.gold}`);
check(/Queue: 2\/5 .*Training Kai Footpaw: 2\d%/.test(await text('#info')) && await page.locator('#info .qi').allInnerTexts().then(a => a.join('')) === 'KK', `barracks panel: ${await text('#info')}`);
await at(br.x + 6.5, br.y + 4.5, 'right');
await shot('round6-16-barracks-queue.png');
check(await until(`window.game.world.units.filter(u => u.type === 'militia').length === 2`, 50), '2 militia trained');
await advance(6);
check(/Pop 5\/5/.test(await hud()), `HUD ${await hud()}`);
await btn('militia').click(); check(/Population cap reached/.test(await text('#msg')), `militia blocked at cap: "${await text('#msg')}"`);
await shot('round6-17-militia-trained-pop-cap.png');
const mil = await S(() => window.game.world.units.filter(u => u.type === 'militia').map(u => [u.x, u.y]));
await drag(Math.min(...mil.map(m => m[0])) - 1, Math.min(...mil.map(m => m[1])) - 1, Math.max(...mil.map(m => m[0])) + 1, Math.max(...mil.map(m => m[1])) + 1);
check(/2 units selected/.test(await text('#info')), `militia selected: ${await text('#info')}`);
await at(48.5, 33.5, 'right'); await advance(8);
const milNow = await S(() => window.game.world.units.filter(u => u.type === 'militia').map(u => Math.hypot(u.x - 48.5, u.y - 33.5)));
check(milNow.every(d => d < 2), 'militia move on command');
await shot('round6-18-militia-moved.png');

// 8. build mode exits after a refused placement; a drag never places
await clickUnit(miner); await btn('house').click();
const tcp = await scr(34, 34); const nb = await S(() => window.game.world.buildings.length);
await page.mouse.move(tcp.x, tcp.y); await page.waitForTimeout(60); await page.mouse.click(tcp.x, tcp.y);
check((await S(() => window.game.ui.placing)) === null && (await S(() => window.game.world.buildings.length)) === nb && /Cannot build there/.test(await text('#msg')), `refused over TC: build mode exited, message "${await text('#msg')}"`);
await shot('round6-19-build-mode-exit-after-refusal.png');
await clickUnit(miner); await btn('house').click();
await drag(44, 44, 47, 46);
check((await S(() => window.game.world.buildings.length)) === nb && (await S(() => window.game.ui.placing)) === 'house', 'drag-box while in build mode never places (still in build mode)');
await page.keyboard.press('Escape'); check((await S(() => window.game.ui.placing)) === null, 'Esc exits build mode');
await clickUnit(miner); await btn('house').click(); await page.mouse.move(640, 400); await page.mouse.click(640, 400, { button: 'right' });
check((await S(() => window.game.ui.placing)) === null, 'right-click exits build mode');
check((await inside()) === 0, 'final: no unit inside any non-walkable footprint');

await browser.close(); server.close();
log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED');
await writeFile(join(root, 'proof/round6.log'), logLines.join('\n') + '\n');
process.exit(fails ? 1 : 0);
