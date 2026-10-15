// Round 5 browser proof (eviction rule). All selections/orders/UI actions are issued with REAL mouse/keyboard input
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

const inside = () => S(() => { const w = window.game.world; return w.units.filter(u => { const x = Math.floor(u.x), y = Math.floor(u.y);
  return w.buildings.some(b => x >= b.x && y >= b.y && x < b.x + b.size && y < b.y + b.size); }).length; });
const unitPos = i => S(`(() => { const u = window.game.world.units[${i}]; return [u.x, u.y]; })()`);
log(`round5 browser proof ${new Date().toISOString()}  rule: placement ignores units; units inside are evicted`);

// 1. ghost over villagers (valid + orange hint on occupied tiles)
const p0 = await scr(...await unitPos(0)); await page.mouse.click(p0.x, p0.y);
await page.locator('button[data-action=house]').click();
const gp = await scr(37, 35); await page.mouse.move(gp.x, gp.y);
let g = await S(() => window.game.ui.ghost);
check(g.valid && g.tx === 36 && g.ty === 34 && g.units.length === 2, `ghost at (36,34) valid over ${g.units.length} villagers, hinted tiles ${JSON.stringify(g.units)}`);
await shot('round5-01-ghost-over-villagers.png');

// 2. place -> both villagers evicted, builder builds from adjacent tile
await page.mouse.click(gp.x, gp.y);
const ev = await S(() => window.game.world.lastEviction);
check(ev && ev.evicted.length === 2 && (await inside()) === 0, `foundation placed; evicted ${ev?.evicted.length} villagers; units inside footprints: ${await inside()}`);
await advance(1.5);
check((await S(() => window.game.world.units[0].state)) === 'building' && (await inside()) === 0, `builder building from adjacent tile; inside=${await inside()}`);
await shot('round5-02-villagers-evicted.png');

// 3. moving villager reroutes around a new foundation
const p2 = await scr(...await unitPos(2)); await page.mouse.click(p2.x, p2.y);
const moverId = await S(() => window.game.world.selected);
const dst = await scr(49.5, 37.5); await page.mouse.click(dst.x, dst.y, { button: 'right' });
await page.waitForTimeout(150);
await shot('round5-03a-mover-path-before.png');
const p1 = await scr(...await unitPos(1)); await page.mouse.click(p1.x, p1.y);   // select another villager to build
await page.locator('button[data-action=house]').click();
const path = await S(`window.game.world.units.find(u => u.id === ${moverId}).path.map(q => [Math.floor(q.x), Math.floor(q.y)])`);
let placedAt = null;
for (const [x, y] of path.slice(6)) { // a tile well ahead of the mover
  const m = await scr(x + 1, y + 1); await page.mouse.move(m.x, m.y); g = await S(() => window.game.ui.ghost);
  if (g.valid && g.units.length === 0) { placedAt = [g.tx, g.ty]; await page.mouse.click(m.x, m.y); break; }
}
const re = await S(() => window.game.world.lastEviction);
const newPath = await S(`window.game.world.units.find(u => u.id === ${moverId}).path.map(q => [Math.floor(q.x), Math.floor(q.y)])`);
const hit = placedAt && newPath.some(([x, y]) => x >= placedAt[0] && y >= placedAt[1] && x < placedAt[0] + 2 && y < placedAt[1] + 2);
check(placedAt && re.repathed.includes(moverId) && !hit, `foundation at (${placedAt}) on mover's path; mover repathed immediately, new path avoids it (${newPath.length} waypoints)`);
const pm = await scr(...(await S(`(() => { const u = window.game.world.units.find(u => u.id === ${moverId}); return [u.x, u.y]; })()`)));
await page.mouse.click(pm.x, pm.y); // reselect mover to show its new path
await shot('round5-03b-mover-rerouted.png');

// 4. advance to completion, sampling that nobody ever stands inside
let maxIn = 0; for (let k = 0; k < 40; k++) { await advance(1); maxIn = Math.max(maxIn, await inside()); }
const st = await S(`(() => { const w = window.game.world, u = w.units.find(u => u.id === ${moverId}); return { done: w.buildings.filter(b => b.type === 'house' && b.complete).length, mover: [Math.floor(u.x), Math.floor(u.y), u.state] }; })()`);
check(st.done === 2 && maxIn === 0 && (await inside()) === 0, `2 houses complete; max units inside any footprint during construction: ${maxIn}`);
check(st.mover[0] === 49 && st.mover[1] === 37 && st.mover[2] === 'idle', `mover arrived at (${st.mover[0]},${st.mover[1]})`);
check(/Pop 3\/15/.test(await hud()), `HUD: ${await hud()}`);
const hp = await scr(37, 35); await page.mouse.click(hp.x, hp.y);
check(/Kennel Hut \| HP: 550\/550/.test(await text('#info')), `completed house selected: ${await text('#info')}`);
await shot('round5-04-completed-house-nobody-inside.png');

await browser.close(); server.close();
log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED');
await writeFile(join(root, 'proof/round5.log'), logLines.join('\n') + '\n');
process.exit(fails ? 1 : 0);
