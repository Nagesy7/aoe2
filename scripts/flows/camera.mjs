// Camera panning proof with real input: middle-drag, WASD, arrows, edge-scroll in single player, skirmish and 1v1 (tabs).
import { startServer } from '../ctl.mjs';
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises'; import { join, extname, normalize } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url)); const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = (await startServer({ root })).server; const BASE = `http://localhost:${server.address().port}/`;
await mkdir(join(root, 'proof'), { recursive: true });
let fails = 0; const check = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };
const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
async function pans(p, name) {
  const cam = () => p.evaluate(() => ({ ...window.game.cam }));
  await p.mouse.move(640, 360); await p.waitForTimeout(100); let a = await cam();
  await p.mouse.down({ button: 'middle' }); await p.mouse.move(800, 500, { steps: 10 }); await p.mouse.up({ button: 'middle' }); let b = await cam();
  check(b.x < a.x && b.y < a.y, `${name}: middle-drag (${a.x},${a.y}) -> (${b.x},${b.y})`);
  for (const [k, ax, sg] of [['d', 'x', 1], ['s', 'y', 1], ['a', 'x', -1], ['w', 'y', -1], ['ArrowRight', 'x', 1], ['ArrowDown', 'y', 1], ['ArrowLeft', 'x', -1], ['ArrowUp', 'y', -1]]) {
    a = await cam(); await p.keyboard.down(k); await p.waitForTimeout(250); await p.keyboard.up(k); b = await cam();
    check(sg * (b[ax] - a[ax]) > 20, `${name}: key ${k} moves cam.${ax} ${Math.round(a[ax])} -> ${Math.round(b[ax])}`); }
  a = await cam(); await p.waitForTimeout(250); b = await cam(); check(a.x === b.x && a.y === b.y, `${name}: keys released, camera still`);
  for (const [x, y, ax, sg] of [[1279, 360, 'x', 1], [640, 719, 'y', 1], [0, 360, 'x', -1], [640, 0, 'y', -1]]) {
    a = await cam(); await p.mouse.move(x, y); await p.waitForTimeout(250); b = await cam(); await p.mouse.move(640, 360);
    check(sg * (b[ax] - a[ax]) > 20, `${name}: edge-scroll (${x},${y}) moves cam.${ax} ${Math.round(a[ax])} -> ${Math.round(b[ax])}`); }
  await p.screenshot({ path: join(root, 'proof', `camera-${name}.png`) });
}
// single player from the title menu (real click)
let p = await ctx.newPage(); p.on('pageerror', e => { console.error(e); fails++; });
await p.goto(BASE); await p.waitForFunction(() => window.game); await p.click('#btn-sp'); await p.waitForFunction(() => window.game.world); await pans(p, 'single-player'); await p.close();
p = await ctx.newPage(); await p.goto(BASE + '?scenario=skirmish'); await p.waitForFunction(() => window.game && window.game.world); await pans(p, 'skirmish'); await p.close();
// 1v1 over BroadcastChannel tabs
const host = await ctx.newPage(), guest = await ctx.newPage();
for (const t of [host, guest]) { t.on('pageerror', e => { console.error(e); fails++; }); await t.goto(BASE + '?net=tabs'); await t.waitForFunction(() => window.game); }
await host.click('#btn-host'); await host.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('lobby-code').textContent));
await guest.fill('#join-code', await host.locator('#lobby-code').innerText()); await guest.click('#btn-join');
for (const t of [host, guest]) await t.waitForFunction(() => !document.getElementById('btn-ready').disabled, null, { timeout: 15000 });
await host.click('#btn-ready'); await guest.click('#btn-ready');
for (const t of [host, guest]) await t.waitForFunction(() => window.game.world, null, { timeout: 15000 });
await host.bringToFront(); await pans(host, '1v1-host'); await guest.bringToFront(); await pans(guest, '1v1-guest');
await browser.close(); server.close();
console.log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED'); process.exit(fails ? 1 : 0);
