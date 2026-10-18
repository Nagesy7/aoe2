// Ages / tech tree browser proof. All selections/orders/UI actions are issued with REAL mouse/keyboard input
// through Playwright. page.evaluate is used only to READ state and to advance simulated time (window.game.tick).
import { startServer } from '../ctl.mjs';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = (await startServer({ root })).server;
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
// click a villager that is not standing on a building's hit area (real click; falls back across villagers)
const usedVil = new Set(); const clickFreeVil = async () => { const ids = await S(() => window.game.world.units.filter(u => u.type === 'villager' && u.owner === 'player').map(u => u.id));
  for (const id of ids) { if (usedVil.has(id)) continue; await clickUnit(id); const s = await S(() => window.game.world.selection); if (s && s.kind === 'unit' && s.id === id) { usedVil.add(id); return id; } } return null; };
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
// override: only hover/click canvas points that are not under a UI panel (real DOM hit test)
const onCanvas = (x, y) => S(`document.elementFromPoint(${x}, ${y})?.id === 'game'`);
const placeAt = async (wx, wy) => {
  for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const p = await scr(wx + dx, wy + dy); if (!(await onCanvas(p.x, p.y))) continue;
    await page.mouse.move(p.x, p.y); await page.waitForTimeout(30);
    const g = await S(() => window.game.ui.ghost); if (g && g.valid) { await page.mouse.click(p.x, p.y); return g; } }
  return null; };
const st = () => S(() => { const w = window.game.world; return { ...w.stockpile, age: w.age, t: w.time }; });
const ageBtn = () => btn('age-up');
const selectedIs = id => S(`window.game.world.selected === ${id}`);
log(`ages browser proof ${new Date().toISOString()}`);
// camera: middle-drag 40px so forest row 22 and the gold mines are both on screen (real mouse)
await page.mouse.move(640, 360); await page.mouse.down({ button: 'middle' }); await page.mouse.move(640, 400, { steps: 5 }); await page.mouse.up({ button: 'middle' });
const ids = await S(() => window.game.world.units.map(u => u.id));
const [v0, v1, v2] = ids;

// 1. Dark Age: locked menu
await clickUnit(v0);
check(/Puppy Age/.test(await hud()), `HUD shows age: ${await hud()}`);
const locked = {};
for (const t of ['archery_range', 'stable', 'blacksmith', 'market', 'watch_tower', 'castle', 'monastery', 'university', 'wonder']) locked[t] = { dis: await btn(t).isDisabled(), txt: (await btn(t).innerText()).replace(/\n/g, ' ') };
check(['archery_range', 'stable', 'blacksmith', 'market', 'watch_tower'].every(t => locked[t].dis && /(Requires|🔒) Pack Age/.test(locked[t].txt)), `Feudal buildings greyed: ${locked.archery_range.txt}; ${locked.watch_tower.txt}`);
check(['castle', 'monastery', 'university'].every(t => locked[t].dis && /(Requires|🔒) Fortress Age/.test(locked[t].txt)) && /(Requires|🔒) Shogun Age/.test(locked.wonder.txt), `Castle/Imperial greyed: ${locked.castle.txt}; ${locked.wonder.txt}`);
await shot('ages-01-dark-locked-menu.png');

// 2. TC: age-up requirements text; train 2 villagers; rally new villagers to the berries
await at(34, 34);
let ab = (await ageBtn().innerText()).replace(/\n/g, ' ');
check(await ageBtn().isDisabled() && /Advance to Pack Age/.test(ab) && /500 food, 130s/.test(ab) && /needs 2 of: Kennel Hut, Granary, Timber Lodge, Dig Site, Dojo \(have 0\)/.test(ab), `age button: "${ab}"`);
check(/Requires Fortress Age/.test(await btn('tech-hand_cart').innerText()), 'Hand Cart shows Requires Castle Age at the TC');
await shot('ages-02-age-up-requirements.png');
await btn('train').click(); await btn('train').click();
await at(41.5, 31.5, 'right');

// 3. Dark Age economy buildings (each placed with real clicks). 200 starting wood: Mill + Lumber Camp first.
await clickUnit(v0); await btn('mill').click(); const mill = await placeAt(41, 29);
await clickUnit(v2); await btn('lumber_camp').click(); const lc = await placeAt(25, 25);
await clickUnit(v1); await at(39.5, 42.5, 'right');
check(mill && lc, `placed mill (${mill?.tx},${mill?.ty}), lumber camp (${lc?.tx},${lc?.ty})`);
check(await until(() => ['mill', 'lumber_camp'].every(t => window.game.world.buildings.some(b => b.type === t && b.complete)), 120), 'mill + lumber camp built');
await clickUnit(v0); await at(41.5, 31.5, 'right');
await clickUnit(v2); await at(24.5, 22.5, 'right');
check(await until(() => window.game.world.stockpile.wood >= 125, 900, 2), 'wood for Mining Camp + House');
await clickUnit(v1); await btn('mining_camp').click(); const mc = await placeAt(41, 42);
check(mc, `mining camp at (${mc?.tx},${mc?.ty})`);
check(await until(() => window.game.world.buildings.some(b => b.type === 'mining_camp' && b.complete), 120), 'mining camp built');
await clickUnit(v1); await btn('house').click(); await placeAt(46, 35);
check(await until(() => window.game.world.buildings.some(b => b.type === 'house' && b.complete), 100), 'house built by the miner');
await clickUnit(v1); await at(39.5, 42.5, 'right');
const farmers = new Set([v0]); const goldIds = new Set([v1]);
// new villagers: 3rd/4th rally to berries (set above); later ones go to wood/gold by real clicks
let reserveWood = 0, farmAnchors = [[30.5, 33.5], [30.5, 36.5], [33.5, 37.5], [36.5, 37.5], [38.5, 28.5], [43.5, 27.5], [30.5, 30.5], [27.5, 33.5], [33.5, 40.5]];
async function maintain() { // keep everyone busy using real clicks
  const w = await S(() => { const w = window.game.world; return { wood: w.stockpile.wood, food: w.stockpile.food, pop: w.units.length, cap: window.game.sim.popCap(w),
    units: w.units.map(u => ({ id: u.id, state: u.state, x: u.x, y: u.y, kind: u.lastKind })), q: w.buildings[0].queue.length, berries: w.resources.filter(n => n.kind === 'berries' && n.amount > 0).length }; });
  for (const u of w.units) {
    if (!ids.includes(u.id)) { ids.push(u.id); if (ids.length === 4) farmers.add(u.id); else if (ids.length === 5) goldIds.add(u.id); }
    if (u.state !== 'idle') continue;
    const p = await scr(u.x, u.y); if (!(await onCanvas(p.x, p.y))) continue;
    if (goldIds.has(u.id)) { await clickUnit(u.id); await at(38.5 + (u.id % 2), 42.5 + ((u.id >> 1) % 2), 'right'); continue; }
    if (farmers.has(u.id) && w.berries === 0 && w.wood >= 60 + reserveWood) { await clickUnit(u.id); await btn('farm').click();
      let g = null; for (const a of farmAnchors) { g = await placeAt(...a); if (g) break; } if (!g) await page.keyboard.press('Escape'); continue; }
    if (farmers.has(u.id) && w.berries > 0) { await clickUnit(u.id); await at(41.5, 31.5, 'right'); continue; }
    if (!farmers.has(u.id) && !goldIds.has(u.id)) { await clickUnit(u.id); const t = await S(() => window.game.world.resources.filter(n => n.kind === 'tree' && n.amount > 0 && n.y < 23.5 && n.y > 21).sort((a, b) => b.y - a.y)[0]); if (t) await at(t.x, t.y, 'right'); }
  }
  // grow to 8 villagers: train when affordable and pop allows (TC idle)
  if (w.pop + w.q < Math.min(8, w.cap) && w.q === 0 && w.food >= 50 + 0) { await at(34, 34); if (await btn('train').isVisible()) await btn('train').click(); }
}
const waitFor = async (pred, max = 3000, step = 5) => { for (let t = 0; t < max; t += step) { if (await S(pred)) return true; await advance(step); await maintain(); } return !!(await S(pred)); };

// 4. Feudal Age research
check(await waitFor(() => window.game.world.stockpile.food >= 550, 600), `500+ food gathered: ${JSON.stringify(await st())}`);
await at(34, 34); ab = (await ageBtn().innerText()).replace(/\n/g, ' ');
check(!(await ageBtn().isDisabled()) && !/needs/.test(ab), `requirements met: "${ab}"`);
const f0 = (await st()).food; await ageBtn().click();
check((await st()).food === f0 - 500, 'Feudal research started (-500 food)');
await advance(40); await at(34, 34);
const info = await text('#info');
check(/Researching Pack Age: 3\d%/.test(info) && await page.locator('#info .bar div').count() === 1 && /researching/.test(await ageBtn().innerText()), `research progress: ${info}`);
await shot('ages-03-feudal-research-progress.png');
check(await until(() => window.game.world.age === 'feudal', 100, 1), 'Feudal Age reached');
check(/You have advanced to the Pack Age/.test(await text('#banner')) && /Pack Age/.test(await hud()), `banner: "${await text('#banner')}"; HUD ${await hud()}`);
await shot('ages-04-feudal-banner.png');
await clickUnit(v2);
const fe = { ar: (await btn('archery_range').innerText()).replace(/\n/g, ' '), bs: (await btn('blacksmith').innerText()).replace(/\n/g, ' '), ca: (await btn('castle').innerText()).replace(/\n/g, ' ') };
check(!/Requires/.test(fe.ar) && !/Requires/.test(fe.bs) && /(Requires|🔒) Fortress Age/.test(fe.ca), `unlocked in Feudal: "${fe.ar}", "${fe.bs}"; still locked: "${fe.ca}"`);
await shot('ages-05-feudal-unlocked-menu.png');

// 5. Techs: Loom (TC) and Gold Mining (Mining Camp) with measured effect
const minerRate = async secs => { let got = 0, time = 0; let prev = await S(`window.game.world.units.filter(u => [${[...goldIds]}].includes(u.id)).map(u => [u.state, u.carry.amount])`);
  for (let t = 0; t < secs; t += 0.5) { await advance(0.5); const cur = await S(`window.game.world.units.filter(u => [${[...goldIds]}].includes(u.id)).map(u => [u.state, u.carry.amount])`);
    cur.forEach((c, i) => { if (c[0] === 'gathering' && prev[i][0] === 'gathering' && c[1] >= prev[i][1]) { got += c[1] - prev[i][1]; time += 0.5; } }); prev = cur; }
  return got / time; };
const r0 = await minerRate(60);
await waitFor(() => window.game.world.stockpile.food >= 150 && window.game.world.stockpile.wood >= 80, 600);
await at(mc.tx + 1, mc.ty + 1);
check(/Gold Sniffing/.test(await btn('tech-gold_mining').innerText()) && /100 food, 75 wood, 30s/.test(await btn('tech-gold_mining').innerText()), `Mining Camp tech button: ${(await btn('tech-gold_mining').innerText()).replace(/\n/g, ' ')}`);
check(/Requires Fortress Age/.test(await btn('tech-gold_shaft_mining').innerText()), 'Gold Shaft Mining greyed: Requires Fortress Age');
await btn('tech-gold_mining').click();
check(await until(() => 'gold_mining' in window.game.world.researched, 40, 1), 'Gold Mining researched');
const r1 = await minerRate(60);
const GR = await S(() => window.game.sim.GATHER_RATES.gold_mine); const rates = await S(() => [window.game.sim.gatherRate(window.game.world, 'gold_mine'), window.game.sim.gatherRate(window.game.world, 'tree')]);
check(Math.abs(rates[0] - GR * 1.15) < 1e-9 && r1 / r0 > 1.05 && r1 / r0 < 1.3, `Gold Mining effect: rate ${GR} -> ${rates[0].toFixed(2)}; measured miner rate ${r0.toFixed(3)} -> ${r1.toFixed(3)} /s (x${(r1 / r0).toFixed(2)})`);
await at(mc.tx + 1, mc.ty + 1); await shot('ages-06-tech-gold-mining-researched.png');
await waitFor(() => window.game.world.stockpile.gold >= 60, 300);
await at(34, 34); await btn('tech-loom').click();
check(await until(() => 'loom' in window.game.world.researched, 40, 1), 'Loom researched');
await clickUnit(v0); check(/HP: 40\/40/.test(await text('#info')), `Loom effect on villager panel: ${await text('#info')}`);
await shot('ages-07-loom-villager-hp.png');

// 6. Feudal buildings: Blacksmith + Market
reserveWood = 330;
check(await waitFor(() => window.game.world.stockpile.wood >= 340, 1500), `wood for Blacksmith + Market: ${JSON.stringify(await st())}`);
await clickUnit(v2); await btn('blacksmith').click(); const bsg = await placeAt(47, 31);
await clickUnit(v1); await btn('market').click(); const mkg = await placeAt(48, 39);
check(bsg && mkg, `Blacksmith at (${bsg?.tx},${bsg?.ty}), Market at (${mkg?.tx},${mkg?.ty})`);
reserveWood = 0;
check(await waitFor(() => ['blacksmith', 'market'].every(t => window.game.world.buildings.some(b => b.type === t && b.complete)), 400), 'Blacksmith + Market built (Feudal buildings)');
await at(bsg.tx + 1.5, bsg.ty + 1.5); check(/Tempered Claws/.test(await btn('tech-forging').innerText()), 'Blacksmith offers Tempered Claws');
await shot('ages-08-feudal-building-built.png');
await clickUnit(v2); await at(24.5, 22.5, 'right');

// 7. Castle Age
check(await waitFor(() => window.game.world.stockpile.food >= 800 && window.game.world.stockpile.gold >= 200, 3000), `800 food + 200 gold: ${JSON.stringify(await st())}`);
await at(34, 34); ab = (await ageBtn().innerText()).replace(/\n/g, ' '); check(/Advance to Fortress Age/.test(ab) && /800 food, 200 gold, 160s/.test(ab) && !(await ageBtn().isDisabled()), `castle button: "${ab}"`);
await ageBtn().click();
check(await waitFor(() => window.game.world.age === 'castle', 200, 2), 'Castle Age reached');
check(/Fortress Age/.test(await text('#banner')), `banner: ${await text('#banner')}`);
await shot('ages-09-castle-banner.png');

// 8. Castle buildings: Monastery + University -> Imperial
reserveWood = 380;
check(await waitFor(() => window.game.world.stockpile.wood >= 390, 2000), `wood for Monastery + University: ${JSON.stringify(await st())}`);
await clickFreeVil(); await btn('monastery').click(); const mo = await placeAt(46, 25);
await clickFreeVil(); await btn('university').click(); const un = await placeAt(51, 33);
check(mo && un, `Monastery at (${mo?.tx},${mo?.ty}), University at (${un?.tx},${un?.ty})`);
reserveWood = 0;
{ const okB = await waitFor(() => ['monastery', 'university'].every(t => window.game.world.buildings.some(b => b.type === t && b.complete)), 600); check(okB, 'Monastery + University built ' + JSON.stringify(await S(() => window.game.world.buildings.filter(b => ['monastery', 'university'].includes(b.type)).map(b => [b.type, b.complete, Math.round(b.progress)])))); }
await clickUnit(v2); await at(24.5, 22.5, 'right');
await at(34, 34); ab = (await ageBtn().innerText()).replace(/\n/g, ' '); log(`  imperial button: "${ab}"`);
check(await waitFor(() => window.game.world.stockpile.food >= 1000 && window.game.world.stockpile.gold >= 800, 4000), `1000 food + 800 gold: ${JSON.stringify(await st())}`);
await at(34, 34); await ageBtn().click();
check(await waitFor(() => window.game.world.age === 'imperial', 250, 2), 'Imperial Age reached');
check(/Shogun Age/.test(await text('#banner')) && /Shogun Age/.test(await hud()), `banner: ${await text('#banner')}; HUD ${await hud()}`);
await shot('ages-10-imperial-banner.png');
await clickUnit(v2); const wonderTxt = (await btn('wonder').innerText()).replace(/\n/g, ' ');
check(!/Requires/.test(wonderTxt), `Wonder unlocked in Imperial: "${wonderTxt}"`);
await shot('ages-11-imperial-menu.png');
log(`  final: ${JSON.stringify(await st())}, villagers ${ids.length}, sim time ${(await st()).t.toFixed(0)}s`);
await browser.close(); server.close();
log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED');
await writeFile(join(root, 'proof/ages.log'), logLines.join('\n') + '\n');
process.exit(fails ? 1 : 0);
