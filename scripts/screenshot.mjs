import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
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
const url = `http://localhost:${server.address().port}/`;
await mkdir(join(root, 'proof'), { recursive: true });
const shot = name => page.screenshot({ path: join(root, 'proof', name) });
let fails = 0; const check = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { console.error('pageerror', e); fails++; });
await page.goto(url); await page.waitForFunction(() => window.game);
// the bare URL now opens the title menu (no world yet); start single player with a real click like a player would
await page.click('#btn-sp'); await page.waitForFunction(() => window.game.world);
const scr = (x, y) => page.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]);
const info = async () => { await page.waitForTimeout(120); return page.evaluate(() => { const e = document.getElementById('info'); return e.style.display === 'none' ? null : { kind: e.dataset.kind, text: e.innerText.replace(/\n/g, ' | ') }; }); };

// --- 1. Pan to the forest with a real middle-mouse drag ---
const cam0 = await page.evaluate(() => ({ ...window.game.cam }));
await page.mouse.move(640, 360); await page.mouse.down({ button: 'middle' });
await page.mouse.move(740, 490, { steps: 10 }); await page.mouse.move(832, 616, { steps: 10 }); await page.mouse.up({ button: 'middle' });
const cam1 = await page.evaluate(() => ({ ...window.game.cam }));
check(cam1.x < cam0.x && cam1.y < cam0.y, `drag pan moved camera (${cam0.x},${cam0.y}) -> (${cam1.x},${cam1.y})`);
await shot('01-panned-to-forest.png');

// --- 2. Selection info panel for each type (real left clicks) ---
const tree = await page.evaluate(() => { const g = window.game, W = innerWidth, H = innerHeight;
  return g.world.resources.filter(n => n.res === 'wood' && Math.floor(n.y) === 22 && Math.floor(n.x) === 24).map(n => ({ id: n.id, ...g.toScreen(n.x, n.y) })).find(p => p.x > 60 && p.x < W - 60 && p.y > 80 && p.y < H - 140); });
const tc = await page.evaluate(() => { const b = window.game.world.buildings[0]; return window.game.toScreen(b.x + 2, b.y + 2); });
const vil = await page.evaluate(() => { const u = window.game.world.units[0]; return window.game.toScreen(u.x, u.y); });
const tile = await page.evaluate(() => { const g = window.game;
  for (let ty = 0; ty < 64; ty++) for (let tx = 0; tx < 64; tx++) { const p = g.toScreen(tx + 0.5, ty + 0.5);
    if (p.x > 300 && p.x < 1200 && p.y > 80 && p.y < 560 && g.pickAt(g.world, tx + 0.5, ty + 0.5)?.kind === 'tile') return { ...p, tx, ty }; } });
await page.mouse.click(tile.x, tile.y); let i = await info(); await shot('02-select-tile.png');
check(i?.kind === 'tile' && i.text.includes(`(${tile.tx}, ${tile.ty})`), `tile info: ${i?.text}`);
await page.mouse.click(tree.x, tree.y); i = await info(); await shot('03-select-resource-tree.png');
check(i?.kind === 'resource' && /Tree/.test(i.text) && /wood: \d+ remaining/.test(i.text), `resource info: ${i?.text}`);
await page.mouse.click(tc.x, tc.y); i = await info(); await shot('04-select-town-center.png');
check(i?.kind === 'building' && /Town Center/.test(i.text) && /HP: 2400\/2400/.test(i.text), `TC info: ${i?.text}`);
await page.mouse.click(vil.x, vil.y); i = await info(); await shot('05-select-villager.png');
check(i?.kind === 'unit' && /Villager/.test(i.text) && /Idle/.test(i.text), `villager info: ${i?.text}`);

// --- 3. Right-click tree, advance time, verify wood increases ---
const wood0 = await page.evaluate(() => window.game.world.stockpile.wood);
await page.mouse.click(tree.x, tree.y, { button: 'right' });
await page.evaluate(() => window.game.tick(10)); await page.waitForTimeout(100);
i = await info(); await shot('06-villager-gathering-wood.png');
check(/Gathering|Walking|Returning/.test(i.text), `villager working: ${i.text}`);
// select the tree (villager is still walking/away) and watch its amount update live while time advances
await page.evaluate(() => window.game.tick(50));
const wood1 = await page.evaluate(() => window.game.world.stockpile.wood);
await shot('07-after-wood-gather.png');
check(wood1 > wood0, `wood increased ${wood0} -> ${wood1}`);
// real left click on the tree (villager now stands on an adjacent tile, not on the tree)
await page.mouse.click(tree.x, tree.y);
i = await info(); await shot('08-tree-amount-after-gather.png');
check(/wood: (\d+) remaining/.test(i.text) && +i.text.match(/wood: (\d+)/)[1] < 100, `tree amount decreased in panel: ${i.text}`);

// --- 3b. Round 3: retask mid-carry to berries -> villager returns to TC first ---
// advance time (only) until the villager is mid-load at the tree
for (let k = 0; k < 60 && !(await page.evaluate(() => { const u = window.game.world.units[0]; return u.state === 'gathering' && u.carry.amount >= 2; })); k++) await page.evaluate(() => window.game.tick(0.5));
const vpos = await page.evaluate(() => { const u = window.game.world.units[0]; return window.game.toScreen(u.x, u.y); });
await page.mouse.click(vpos.x, vpos.y);
const pre = await page.evaluate(() => { const u = window.game.world.units[0]; return { carry: { ...u.carry }, wood: window.game.world.stockpile.wood, food0: window.game.world.stockpile.food }; });
const bush = await page.evaluate(() => { const n = window.game.world.resources.find(r => r.res === 'food'); return window.game.toScreen(n.x, n.y); });
await page.mouse.click(bush.x, bush.y, { button: 'right' });
await page.evaluate(() => window.game.tick(2)); i = await info(); await shot('10-retask-dropoff.png');
check(pre.carry.amount > 0 && /Returning to Town Center/.test(i.text) && i.text.includes(`${pre.carry.amount} wood`), `retask with ${pre.carry.amount} wood: ${i.text}`);
await page.evaluate(() => window.game.tick(40)); i = await info();
const post = await page.evaluate(() => ({ ...window.game.world.stockpile }));
await shot('11-after-retask-gathering-food.png');
check(post.wood === pre.wood + pre.carry.amount && (post.food > pre.food0 || /food/.test(i.text)), `carried wood deposited (${pre.wood} -> ${post.wood}), then food (${post.food}): ${i.text}`);

// --- 4. Try to pan beyond each edge/corner; verify no black bands ---
await page.mouse.move(640, 360);
const corners = () => page.evaluate(() => { const c = document.getElementById('game'), x = c.getContext('2d'), W = c.width, H = c.height;
  return [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1], [W >> 1, 0], [W >> 1, H - 1], [0, H >> 1], [W - 1, H >> 1]].map(([px, py]) => Array.from(x.getImageData(px, py, 1, 1).data)); });
for (const [name, keys] of [['top-left', ['w', 'a']], ['top-right', ['w', 'd']], ['bottom-left', ['s', 'a']], ['bottom-right', ['s', 'd']]]) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(4500);
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(100);
  const cam = await page.evaluate(() => ({ ...window.game.cam })), px = await corners();
  const black = px.filter(([r, g, b]) => r + g + b < 90);
  await shot(`09-edge-${name}.png`);
  check(black.length === 0, `edge ${name}: cam=(${Math.round(cam.x)},${Math.round(cam.y)}) edge pixels non-black ${JSON.stringify(px.slice(0, 4))}`);
}
const camLimits = await page.evaluate(() => ({ ...window.game.cam }));
check(camLimits.x === 2048 - 1280 && camLimits.y === 2048 - 720, `bottom-right clamp exact (${camLimits.x},${camLimits.y})`);

await browser.close(); server.close();
console.log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED');
process.exit(fails ? 1 : 0);
