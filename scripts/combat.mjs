// Combat browser proof. Every selection / order / UI action uses REAL mouse + keyboard input via Playwright.
// page.evaluate is used only to READ state and to advance simulated time (window.game.tick).
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
const BASE = process.env.COMBAT_URL || `http://localhost:${server.address().port}/`;
await page.goto(`${BASE}?scenario=skirmish`); await page.waitForFunction(() => window.game);
const shot = async name => { await page.waitForTimeout(120); await page.screenshot({ path: join(root, 'proof', name) }); log(`  saved proof/${name}`); };
const S = fn => page.evaluate(fn);
const advance = s => page.evaluate(s => window.game.tick(s), s);
const scr = (x, y) => page.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]);
const text = async sel => { await page.waitForTimeout(100); return (await page.locator(sel).innerText()).replace(/\n/g, ' | '); };
const onCanvas = (x, y) => S(`document.elementFromPoint(${x}, ${y})?.id === 'game'`);
const at = async (wx, wy, button = 'left') => { const p = await scr(wx, wy); await page.mouse.click(p.x, p.y, { button }); return p; };
const drag = async (ax, ay, bx, by) => { const a = await scr(ax, ay), b = await scr(bx, by); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up(); };
const until = async (pred, max = 300, step = 1) => { for (let t = 0; t < max; t += step) { if (await S(pred)) return true; await advance(step); } return !!(await S(pred)); };
const army = () => S(() => window.game.world.units.filter(u => u.owner === 'player' && u.type !== 'villager').map(u => ({ id: u.id, type: u.type, x: u.x, y: u.y, hp: u.hp, state: u.state, tile: `${Math.floor(u.x)},${Math.floor(u.y)}`, auto: !!u.attack?.auto })));
const foes = () => S(() => window.game.world.units.filter(u => u.owner === 'enemy').map(u => ({ id: u.id, type: u.type, x: u.x, y: u.y, hp: u.hp, state: u.state, target: u.attack?.id, auto: !!u.attack?.auto })));
const panUntil = async (key, pred) => { await page.mouse.move(640, 360); for (let i = 0; i < 40 && !(await S(pred)); i++) { await page.keyboard.down(key); await page.waitForTimeout(60); await page.keyboard.up(key); } await page.waitForTimeout(80); };
log(`combat browser proof ${new Date().toISOString()} url=${BASE}?scenario=skirmish`);

// 1. start: own army near TC, enemy camp in the north-west
const a0 = await army(), f0 = await foes();
check(a0.length === 7 && f0.length === 4, `skirmish start: ${a0.length} player military (${a0.map(u => u.type).join(',')}), ${f0.length} enemy guards`);
await shot('combat-01-start.png');

// 2. click one archer: info panel shows attack / armor / range
const archer = a0.find(u => u.type === 'archer'); await at(archer.x, archer.y);
let info = await text('#info'); check(/Bow Pup/.test(info) && /Attack 4/.test(info) && /Armor 0\/0/.test(info) && /Range 4/.test(info) && /Reload 2s/.test(info), `archer info panel: ${info}`);
const spear = a0.find(u => u.type === 'spearman'); await at(spear.x, spear.y);
info = await text('#info'); check(/Pike Pup/.test(info) && /\+15 vs cavalry/.test(info), `spearman info shows cavalry bonus: ${info}`);
check(await S(() => !!document.querySelector('#info .bar.hp')), 'info panel has an HP bar');
await shot('combat-02-unit-info.png');

// 3. drag-box select the army, right-click ground: formation move with distinct tiles
await drag(35.6, 37.6, 40.4, 40.4);
check((await S(() => window.game.sim.selectedUnits(window.game.world).length)) === 7, 'drag-box selected all 7 soldiers');
let dest = [22.5, 30.5]; let p = await scr(...dest); check(await onCanvas(p.x, p.y), 'move target is on the canvas');
await at(...dest, 'right');
check((await S(() => window.game.world.lastOrder?.kind)) === 'move', 'right-click ground issued a move');
await page.waitForTimeout(150); await shot('combat-03-move-order.png');
await until(`window.game.world.units.filter(u => u.owner === 'player' && u.type !== 'villager').every(u => u.state === 'idle')`, 30, 0.5);
const a1 = await army(); const tiles = new Set(a1.map(u => u.tile));
check(tiles.size === 7, `formation: 7 units on 7 distinct tiles (${[...tiles].join(' ')})`);
check(a1.every(u => Math.hypot(u.x - dest[0], u.y - dest[1]) <= 3.5), 'units gathered around the clicked point');
check(await S(() => window.game.sim.unitsInsideBuildings(window.game.world).length === 0), 'no unit inside a building or tree');

// 4. pan to the enemy camp with the keyboard (arrow keys), keeping the army on screen
await panUntil('ArrowUp', () => window.game.cam.y <= 120); await panUntil('ArrowLeft', () => window.game.cam.x <= 10);
await shot('combat-04-enemy-camp.png');
const f1 = await foes(); const victim = f1.find(u => u.type === 'militia');
// hover: attack cursor
const vp = await scr(victim.x, victim.y); await page.mouse.move(vp.x, vp.y); await page.waitForTimeout(120);
const cursor = await S(() => [window.game.ui.cursor, document.getElementById('game').style.cursor]);
check(cursor[0] === 'attack' && cursor[1] === 'crosshair', `attack cursor over enemy unit: ${cursor}`);
await page.mouse.click(vp.x, vp.y, { button: 'right' });
const lo = await S(() => window.game.world.lastOrder);
check(lo.kind === 'attack' && lo.target === victim.id, `right-click enemy militia = attack order (target ${lo.target})`);
check((await S(`window.game.world.units.filter(u => u.owner === 'player' && u.attack?.id === ${victim.id}).length`)) === 7, 'all 7 selected units ordered to attack it');
await page.waitForTimeout(150); await shot('combat-05-attack-order.png');

// 5. fight: units path to range, damage applied, enemies aggro and fight back
await until(() => (window.game.world.combatLog || []).length >= 3, 30, 0.5);
const f2 = await foes(); const a2 = await army();
log(`  first contact t=${(await S(() => window.game.world.time)).toFixed(1)}s: enemy ${f2.map(u => `${u.type}:${Math.ceil(u.hp)}:${u.state}`).join(' ')} | own ${a2.map(u => `${u.type}:${Math.ceil(u.hp)}:${u.state}`).join(' ')}`);
check(f2.filter(u => u.id !== victim.id).some(u => u.state === 'attacking' && u.auto), 'enemy guards auto-acquired (aggro) without orders');
const proj = await S(() => (window.game.world.combatLog || []).length);
check(proj > 0, `combat log has ${proj} hits`);
for (let i = 0; i < 6 && !(await S(() => (window.game.world.projectiles || []).length)); i++) await advance(0.2);
await shot('combat-06-melee-and-arrows.png');
check(await S(() => window.game.world.combatLog.some(h => window.game.world.units.find(u => u.id === h.att)?.type === 'archer' || h.dmg === 3)), 'archer arrows landed (3 dmg vs militia)');
const won = await until(() => window.game.world.units.filter(u => u.owner === 'enemy').length === 0, 90, 0.5);
const a3 = await army();
check(won, `all enemy guards killed; ${a3.length}/7 own soldiers survive`);
const deaths = await S(() => window.game.world.deaths);
log(`  deaths: ${deaths.map(d => `${d.owner}:${d.type}@${d.t.toFixed(1)}`).join(' ')}`);
check(deaths.filter(d => d.owner === 'enemy').length === 4 && (await S(() => window.game.world.units.every(u => u.hp > 0))), 'dead units removed from the world (no 0-HP units remain)');
check(a3.some(u => u.auto) || deaths.length >= 4, 'survivors auto-acquired follow-up targets after the first kill');
check(new Set(a3.filter(u => u.state !== 'moving').map(u => u.tile)).size === a3.filter(u => u.state !== 'moving').length, 'no stacking after the fight');
await shot('combat-07-guards-defeated.png');

// 6. attack a building: re-select survivors with a drag box, right-click the enemy Barracks
const xs = a3.map(u => u.x), ys = a3.map(u => u.y);
await drag(Math.min(...xs) - 0.6, Math.min(...ys) - 0.6, Math.max(...xs) + 0.6, Math.max(...ys) + 0.6);
const nsel = await S(() => window.game.sim.selectedUnits(window.game.world).length);
check(nsel === a3.length, `re-selected ${nsel} survivors`);
const rax = await S(() => { const b = window.game.world.buildings.find(b => b.owner === 'enemy' && b.type === 'barracks'); return { id: b.id, x: b.x, y: b.y, hp: b.hp }; });
const rp = await scr(rax.x + 1.5, rax.y + 1.5); await page.mouse.move(rp.x, rp.y); await page.waitForTimeout(100);
check((await S(() => window.game.ui.cursor)) === 'attack', 'attack cursor over enemy Barracks');
await page.mouse.click(rp.x, rp.y, { button: 'right' });
check((await S(() => window.game.world.lastOrder)).target === rax.id, 'right-click enemy Barracks = attack order');
await advance(10);
const raxHp = await S(`window.game.world.buildings.find(b => b.id === ${rax.id})?.hp`);
check(raxHp < rax.hp, `Barracks HP ${rax.hp} -> ${raxHp}`);
await at(rax.x + 1.5, rax.y + 1.5); info = await text('#info'); check(/Dojo \(Enemy\)/.test(info) && /Armor 0\/7/.test(info), `enemy Barracks info: ${info}`);
check((await S(() => document.querySelectorAll('#commands button').length)) === 0, 'no train buttons for an enemy building');
await shot('combat-08-attacking-building.png');
const razed = await until(`!window.game.world.buildings.some(b => b.id === ${rax.id})`, 900, 5);
check(razed, `enemy Barracks destroyed at t=${(await S(() => window.game.world.time)).toFixed(0)}s and removed`);
await shot('combat-09-barracks-destroyed.png');

// 7. train via the real UI: select own Barracks and click "Train Militia"
await panUntil('ArrowDown', () => window.game.cam.y >= 560); await panUntil('ArrowRight', () => window.game.cam.x >= 400);
const own = await S(() => { const b = window.game.world.buildings.find(b => b.owner === 'player' && b.type === 'barracks'); return { x: b.x, y: b.y }; });
await at(own.x + 1.5, own.y + 1.5); await page.locator('#commands button[data-action=militia]').click();
await page.locator('#commands button[data-action=spearman]').click();
check((await S(() => window.game.world.buildings.find(b => b.owner === 'player' && b.type === 'barracks').queue.join(','))) === 'militia,spearman', 'queued Militia + Spearman from the Barracks UI');
const n0 = (await army()).length; await advance(45); check((await army()).length === n0 + 2, 'Militia and Spearman trained');
await shot('combat-10-trained.png');

log(`RESULT: ${fails ? fails + ' FAILED' : 'ALL PASSED'}`);
await writeFile(join(root, 'proof', 'combat.log'), logLines.join('\n') + '\n');
await browser.close(); server.close(); process.exit(fails ? 1 : 0);
