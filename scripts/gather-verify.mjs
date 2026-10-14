// Gather verification: every resource type, farms, carcass, camps/mill, real input only. All selections/orders/UI actions are issued with REAL mouse/keyboard input
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
const btn = a => page.locator(`#commands button[data-action=${a}]`);
log(`gather verification ${new Date().toISOString()}`);
const ids = await S(() => window.game.world.units.map(u => u.id));
// snapshot for one resource: stockpile, total remaining in all nodes of that type (+ nodes created for it), carried
const snap = res => S(`(() => { const w = window.game.world; return { stock: w.stockpile['${res}'],
  nodes: w.resources.filter(n => n.res === '${res}').reduce((t, n) => t + n.amount, 0), created: '${res}' === 'food' ? w.ledger.created : 0,
  carried: w.units.reduce((t, u) => t + (u.carry.res === '${res}' ? u.carry.amount : 0), 0) }; })()`);
const balance = (name, res, a, b) => {
  const delivered = b.stock - a.stock, removed = (a.nodes + (b.created - a.created)) - b.nodes, dc = b.carried - a.carried;
  check(delivered > 0, `[${name}] ${res} stockpile rose ${a.stock} -> ${b.stock} (+${delivered})`);
  check(removed > 0, `[${name}] ${res} nodes decreased by ${removed}`);
  check(removed === delivered + dc, `[${name}] balance: node decrease ${removed} == delivered ${delivered} + change in carried ${dc}`);
};
const nodeAmt = id => S(`(window.game.world.resources.find(n => n.id === ${id}) || { amount: 0 }).amount`);
const carryText = async () => (await text('#info')).match(/Carrying: (\d+)( \w+)?/);

// ---------- Phase 1: all four types to the Town Center (no camps yet) ----------
const bush = await S(() => window.game.world.resources.find(n => n.kind === 'berries' && Math.floor(n.x) === 41 && Math.floor(n.y) === 31));
const gold = await S(() => window.game.world.resources.find(n => n.kind === 'gold_mine' && Math.floor(n.x) === 39 && Math.floor(n.y) === 42));
const stone = await S(() => window.game.world.resources.find(n => n.kind === 'stone_mine' && Math.floor(n.x) === 28));
const s0 = { food: await snap('food'), gold: await snap('gold'), stone: await snap('stone') };
await clickUnit(ids[0]); await at(bush.x, bush.y, 'right');
await clickUnit(ids[1]); await at(gold.x, gold.y, 'right');
await clickUnit(ids[2]); await at(stone.x, stone.y, 'right');
await clickUnit(ids[0]);
check(await until(`window.game.world.units.find(u => u.id === ${ids[0]}).state === 'gathering'`, 20, 0.5), 'forager reached the bush and is gathering');
await advance(5);
let ct = await carryText();
check(/Gathering/.test(await text('#info')) && ct && +ct[1] > 0 && ct[2] === ' food', `FOOD BUG CHECK: villager panel while foraging shows "${ct && ct[0]}" (non-zero food)`);
await shot('gather-verify-01-forager-carrying-food.png');
const bush0 = bush.amount; await advance(40);
const s1 = { food: await snap('food'), gold: await snap('gold'), stone: await snap('stone') };
for (const r of ['food', 'gold', 'stone']) balance('to TC', r, s0[r], s1[r]);
check((await nodeAmt(bush.id)) < bush0 && (await nodeAmt(gold.id)) < gold.amount && (await nodeAmt(stone.id)) < stone.amount, `bush ${bush0}->${await nodeAmt(bush.id)}, gold mine ${gold.amount}->${await nodeAmt(gold.id)}, stone mine ${stone.amount}->${await nodeAmt(stone.id)}`);
const tcId = await S(() => window.game.world.buildings[0].id);
check((await S(`[${ids}].every(id => window.game.world.units.find(u => u.id === id).lastDrop === ${tcId})`)), 'all three dropped at the Town Center');
await shot('gather-verify-02-food-gold-stone-to-tc.png');

// wood to TC: send the forager to the nearest visible tree
const tree = await S(() => { const g = window.game; return g.world.resources.filter(n => n.kind === 'tree').map(n => ({ ...n, p: g.toScreen(n.x, n.y) })).filter(n => n.p.x > 40 && n.p.x < 1240 && n.p.y > 60 && n.p.y < 600 && document.elementFromPoint(n.p.x, n.p.y)?.id === 'game') // not under a UI panel
  .sort((a, b) => Math.hypot(a.x - 34, a.y - 34) - Math.hypot(b.x - 34, b.y - 34))[0]; });
let w0 = await snap('wood'); await clickUnit(ids[0]); await at(tree.x, tree.y, 'right');
await advance(5); await clickUnit(ids[0]); ct = await carryText(); log(`  woodcutter panel: ${await text('#info')}`);
await advance(45); let w1 = await snap('wood');
balance('to TC', 'wood', w0, w1);
check((await nodeAmt(tree.id)) < tree.amount, `tree at (${Math.floor(tree.x)},${Math.floor(tree.y)}) ${tree.amount} -> ${await nodeAmt(tree.id)}`);
await shot('gather-verify-03-wood-to-tc.png');

// ---------- Phase 2: Mill, Mining Camp, Lumber Camp drop-offs ----------
await clickUnit(ids[0]); await btn('mill').click(); let g = await placeNear(41, 29); const mill = await bld('mill');
await clickUnit(ids[1]); await btn('mining_camp').click(); g = await placeNear(41, 42); const mc = await bld('mining_camp');
check(mill && mc, `mill at (${mill?.x},${mill?.y}), mining camp at (${mc?.x},${mc?.y})`);
check(await until(`(() => { const w = window.game.world; return w.buildings.find(b => b.id === ${mill.id}).complete && w.buildings.find(b => b.id === ${mc.id}).complete; })()`, 90), 'mill + mining camp built');
const f2 = await snap('food'), g2 = await snap('gold'), st2 = await snap('stone');
await clickUnit(ids[0]); await at(bush.x, bush.y, 'right');
await clickUnit(ids[1]); await at(gold.x, gold.y, 'right');
await clickUnit(ids[2]); const stoneNear = await S(() => window.game.world.resources.filter(n => n.kind === 'stone_mine' && n.amount > 0)[0]); await at(stoneNear.x, stoneNear.y, 'right');
check(await until(`(() => { const w = window.game.world, u = i => w.units.find(o => o.id === i); return u(${ids[0]}).lastDrop === ${mill.id} && u(${ids[1]}).lastDrop === ${mc.id}; })()`, 60), 'forager drops at the Mill, gold miner at the Mining Camp');
await advance(30);
const f3 = await snap('food'), g3 = await snap('gold'), st3 = await snap('stone');
balance('mill', 'food', f2, f3); balance('mining camp', 'gold', g2, g3); balance('stone (nearest of TC/mining camp)', 'stone', st2, st3);
log(`  stone miner last drop: ${await S(`window.game.world.buildings.find(b => b.id === window.game.world.units.find(u => u.id === ${ids[2]}).lastDrop)?.type`)}`);
await clickUnit(ids[0]); ct = await carryText(); log(`  forager panel at mill: ${await text('#info')}`);
await shot('gather-verify-04-mill-and-mining-camp.png');
check(/Returning to Mill|Gathering/.test(await text('#info')), `drop-off label names the Mill: ${await text('#info')}`);
// lumber camp needs 100 wood: pan to the forest, woodcut to the TC until affordable, then build the camp there
await clickUnit(ids[2]); await pan('w', 550);
await at(24.5, 22.5, 'right');
check(await until(`window.game.world.stockpile.wood >= 110`, 400, 5), `woodcut to TC until lumber camp affordable: ${await hud()}`);
await clickUnit(ids[2]); await btn('lumber_camp').click();
g = await placeNear(25, 25); const lc = await bld('lumber_camp');
check(lc, `lumber camp at (${lc?.x},${lc?.y}) under the forest`);
check(await until(`window.game.world.buildings.find(b => b.id === ${lc.id}).complete`, 80), 'lumber camp built');
const lw0 = await snap('wood');
const tree2 = await S(() => window.game.world.resources.filter(n => n.kind === 'tree' && n.amount > 0 && Math.floor(n.y) === 22).sort((a, b) => Math.abs(a.x - 25) - Math.abs(b.x - 25))[0]);
await clickUnit(ids[2]); await at(tree2.x, tree2.y, 'right');
check(await until(`window.game.world.units.find(u => u.id === ${ids[2]}).lastDrop === ${lc.id}`, 60), 'woodcutter drops at the Lumber Camp');
await advance(20); balance('lumber camp', 'wood', lw0, await snap('wood'));
const t2a = await nodeAmt(tree2.id); check(t2a < tree2.amount, `forest tree (${Math.floor(tree2.x)},${Math.floor(tree2.y)}) ${tree2.amount} -> ${t2a}`);
await shot('gather-verify-05-lumber-camp.png');

// ---------- Phase 3: farm ----------
await until(`window.game.world.stockpile.wood >= 70`, 200, 5); await pan('s', 550);
await clickUnit(ids[0]); await btn('farm').click();
const fp = await scr(mill.x - 1.5, mill.y + 0.5); await page.mouse.move(fp.x, fp.y); await page.waitForTimeout(60);
g = await S(() => window.game.ui.ghost); if (!g.valid) g = await placeNear(mill.x + 3.5, mill.y + 1.5); else await page.mouse.click(fp.x, fp.y);
const farm = await bld('farm'); check(farm, `farm at (${farm?.x},${farm?.y})`);
check(await until(`(() => { const w = window.game.world, u = w.units.find(o => o.id === ${ids[0]}), n = w.resources.find(n => n.farm === ${farm.id}); return n && u.state === 'gathering' && u.target === n.id; })()`, 90), 'farm built, builder farming it');
const farmNode = await S(`window.game.world.resources.find(n => n.farm === ${farm.id}).id`);
const ff0 = await snap('food'), fa0 = await nodeAmt(farmNode);
await advance(5); await clickUnit(ids[0]); ct = await carryText();
check(ct && +ct[1] > 0 && ct[2] === ' food', `farmer panel shows "${ct && ct[0]}"`);
await shot('gather-verify-06-farming.png');
await advance(40); const ff1 = await snap('food'), fa1 = await nodeAmt(farmNode);
balance('farm', 'food', ff0, ff1);
check(fa1 < fa0, `farm food ${fa0} -> ${fa1}`);
log(`  farmer last drop: ${await S(`window.game.world.buildings.find(b => b.id === window.game.world.units.find(u => u.id === ${ids[0]}).lastDrop)?.type`)}`);

// ---------- Phase 4: sheep carcass ----------
const sheep = await S(() => { const g = window.game; const a = g.world.animals.map(a => ({ id: a.id, owner: a.owner, p: g.toScreen(a.x, a.y) })).find(a => a.p.x > 40 && a.p.x < 1240 && a.p.y > 40 && a.p.y < 560); return a; });
check(!!sheep, `sheep on screen (id ${sheep?.id}, owner ${sheep?.owner})`);
await clickUnit(ids[1]);
if (!sheep.owner) { const sp = await unit(sheep.id); await at(sp.x, sp.y, 'right'); check(await until(`window.game.world.animals.find(a => a.id === ${sheep.id})?.owner === 'player'`, 30, 0.5), 'sheep converted'); await clickUnit(ids[1]); }
const sc0 = await snap('food');
const sp2 = await unit(sheep.id); await at(sp2.x, sp2.y, 'right');
check(await until(`window.game.world.resources.some(n => n.kind === 'carcass' && n.amount < 100)`, 30, 0.5), 'sheep butchered, carcass being gathered');
await advance(3); await clickUnit(ids[1]); ct = await carryText();
check(/Gathering/.test(await text('#info')) && ct && +ct[1] > 0 && ct[2] === ' food', `butcher panel shows "${ct && ct[0]}"`);
await shot('gather-verify-07-butchering.png');
await advance(40); const sc1 = await snap('food');
const carcass = await S(() => window.game.world.resources.filter(n => n.kind === 'carcass').map(n => n.amount));
balance('carcass (+ farm still running)', 'food', sc0, sc1);
check(carcass.length && carcass[0] < 100, `carcass 100 -> ${carcass[0]}`);
await shot('gather-verify-08-final-stockpile.png');
log(`  final HUD: ${await hud()}`);

await browser.close(); server.close();
log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED');
await writeFile(join(root, 'proof/gather-verify.log'), logLines.join('\n') + '\n');
process.exit(fails ? 1 : 0);
