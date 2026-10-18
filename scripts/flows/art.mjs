// Art proof: base (single player, villagers working + buildings) and battle (skirmish, real mouse box-select + right-click attack).
import { startServer } from '../ctl.mjs';
import { chromium } from 'playwright'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url)); const M = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const s = (await startServer({ root })).server; const BASE = process.env.URL || `http://localhost:${s.address().port}/`;
const b = await chromium.launch(); let fails = 0; const check = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => { console.log('ERR', e); fails++; });
const scr = (x, y) => p.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]);
await p.goto(BASE + '?play=sp'); await p.waitForFunction(() => window.game.world); await p.waitForTimeout(1200);
check(await p.evaluate(async () => (await import('./src/art.js')).artReady()), 'art manifest loaded');
const vs = await p.evaluate(() => window.game.world.units.map(u => ({ x: u.x, y: u.y })));
const berry = await p.evaluate(() => window.game.world.resources.find(n => n.kind === 'berries'));
for (const v of vs) { const q = await scr(v.x, v.y); await p.mouse.click(q.x, q.y); const r = await scr(berry.x, berry.y); await p.mouse.click(r.x, r.y, { button: 'right' }); }
await p.waitForTimeout(2500); await p.screenshot({ path: join(root, 'proof', 'art-base.png') });
await p.goto(BASE + '?scenario=skirmish'); await p.waitForFunction(() => window.game.world); await p.waitForTimeout(1200);
const mil = await p.evaluate(() => window.game.world.units.filter(u => u.owner === 'player' && u.type !== 'villager').map(u => window.game.toScreen(u.x, u.y)));
const xs = mil.map(q => q.x), ys = mil.map(q => q.y);
await p.mouse.move(Math.min(...xs) - 25, Math.min(...ys) - 25); await p.mouse.down(); await p.mouse.move(Math.max(...xs) + 25, Math.max(...ys) + 25, { steps: 8 }); await p.mouse.up();
const foe = await p.evaluate(() => window.game.world.units.find(u => u.owner === 'enemy'));
// pan toward the enemy so both sides are on screen
await p.evaluate(([x, y]) => { const c = window.game.cam; c.x = x * 32 - 900; c.y = y * 32 - 360; }, [foe.x, foe.y]); await p.waitForTimeout(100);
const fq = await scr(foe.x, foe.y); check(true, `enemy at screen ${Math.round(fq.x)},${Math.round(fq.y)}`);
await p.mouse.click(fq.x, fq.y, { button: 'right' });
for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); const fight = await p.evaluate(() => window.game.world.units.some(u => u.state === 'attacking' && u.owner === 'player'));
  if (fight) break; }
await p.evaluate(() => { const w = window.game.world, a = w.units.find(u => u.state === 'attacking') || w.units[0], c = window.game.cam; c.x = a.x * 32 - innerWidth / 2; c.y = a.y * 32 - innerHeight / 2; }); // camera only
await p.waitForTimeout(700); check(await p.evaluate(() => window.game.world.units.some(u => u.state === 'attacking')), 'battle in progress');
await p.screenshot({ path: join(root, 'proof', 'art-battle.png') });
await b.close(); s.close(); console.log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED'); process.exit(fails ? 1 : 0);
