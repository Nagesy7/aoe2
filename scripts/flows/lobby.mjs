// Match-select clan cards proof: real mouse hover (cinematic), click select, rarity glow from owned cosmetics,
// iPhone 13 landscape: tap = hover preview. -> proof/full-lobby-*.png, proof/full-lobby.log
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs'; import { join } from 'node:path'; import { fileURLToPath } from 'node:url';
import { startRelay } from '../../server/relay.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));
const { server } = await startRelay({ port: 0, staticDir: root, log: () => {} }); const BASE = process.env.URL || `http://localhost:${server.address().port}/`;
const lines = []; let fails = 0; const check = (c, m) => { const s = `${c ? 'PASS' : 'FAIL'}: ${m}`; console.log(s); lines.push(s); if (!c) fails++; };
const shot = (p, n) => p.screenshot({ path: join(root, 'proof', `full-lobby-${n}.png`) });
const browser = await chromium.launch();
// owned cosmetics (setup only): Akita gold banner = rare, both Kishu finishes = legendary
const seedPage = async p => { await p.goto(BASE); await p.evaluate(async () => { const K = await import('/src/kibble.js'); const s = K.newState(); s.owned.push('akita_banner_gold', 'kishu_banner_gold', 'kishu_coat_winter'); localStorage.setItem('inu-empires-kibble-sim', JSON.stringify(s)); }); await p.reload(); };
const seed0 = () => localStorage.setItem('inu-empires-kibble-sim', JSON.stringify({ v: 1, wallet: null, kibbleU: 0, bones: 0, owned: ['akita_banner_gold', 'kishu_banner_gold', 'kishu_coat_winter'], equipped: { colour: 'colour_azure', banner: 'banner_paw', title: null, skin: null }, ledger: [], elo: 1200, wins: 0, games: 0, history: [], pack: null, points: 0 }));
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage();
  p.on('pageerror', e => { check(false, 'pageerror ' + e.message); });
  await seedPage(p); await p.waitForFunction(() => document.querySelectorAll('.civ-card').length === 6);
  check(await p.locator('.civ-card').count() === 6, 'six clan cards on the match-select menu');
  check(await p.locator('.civ-card.rar-common').count() === 4 && await p.locator('.civ-card[data-civ=akita].rar-rare').count() === 1 && await p.locator('.civ-card[data-civ=kishu].rar-legendary').count() === 1, 'shield glow follows owned cosmetics (Akita rare, Kishu legendary, rest common)');
  const px = async sel => p.evaluate(s => { const c = document.querySelector(s); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.reduce((a, v, i) => (a + v * (i % 7)) % 1e9, 0); }, sel);
  const a1 = await px('.civ-card[data-civ=shiba] canvas'); await p.waitForTimeout(300); const a2 = await px('.civ-card[data-civ=shiba] canvas');
  check(a1 !== a2, 'card previews are animated');
  await shot(p, 'desktop-01-cards');
  const b = await p.locator('.civ-card[data-civ=shikoku]').boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 }); await p.waitForTimeout(1200);
  check(await p.locator('.civ-card[data-civ=shikoku].cine').count() === 1, 'mouse hover starts the Shikoku cinematic');
  await shot(p, 'desktop-02-hover-cinematic');
  await p.waitForTimeout(3500); check(await p.locator('.civ-card[data-civ=shikoku].cine').count() === 0, 'cinematic ends after ~4 s');
  await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  check(await p.inputValue('#civ') === 'shikoku' && /Cavalry move/.test(await p.locator('#civ-info').innerText()), 'click selects Shikoku and shows its traits');
  await p.click('#btn-ai'); await p.waitForFunction(() => window.game.world); await p.evaluate(() => window.game.tick(60)); await p.waitForTimeout(400);
  check(await p.evaluate(() => window.game.world.players.player.civ === 'shikoku'), 'picked clan is played in game');
  await shot(p, 'desktop-03-ingame-skin'); await ctx.close();
}
{
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  p.on('pageerror', e => { check(false, 'pageerror ' + e.message); });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: i })) });
  await seedPage(p); await p.waitForFunction(() => document.querySelectorAll('.civ-card').length === 6);
  await p.locator('.civ-card[data-civ=hokkaido]').scrollIntoViewIfNeeded();
  const b = await p.locator('.civ-card[data-civ=hokkaido]').boundingBox(), vp = p.viewportSize();
  console.log('hit', await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 80), [b.x + b.width / 2, b.y + b.height / 2])); check(b && b.x >= 0 && b.x + b.width <= vp.width && b.y + b.height <= vp.height, 'iPhone: card on screen in landscape');
  await touch('touchStart', [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }]); await p.waitForTimeout(80); await touch('touchEnd', []); await p.waitForTimeout(1200);
  check(await p.locator('.civ-card[data-civ=hokkaido].cine').count() === 1, 'iPhone: tap plays the hover cinematic');
  check(await p.inputValue('#civ') === 'hokkaido', 'iPhone: tap selects Hokkaido');
  await shot(p, 'iphone-01-tap-cinematic'); await ctx.close();
}
await browser.close(); server.close();
lines.push(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED'); console.log(lines.at(-1));
writeFileSync(join(root, 'proof', 'full-lobby.log'), lines.join('\n') + '\n'); process.exit(fails ? 1 : 0);
