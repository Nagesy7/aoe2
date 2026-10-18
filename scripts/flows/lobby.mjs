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
const seedPage = async (p, q = '?demo=1') => { await p.goto(BASE + q); await p.evaluate(async () => { const K = await import('/src/kibble.js'); const s = K.newState(); s.owned.push('akita_banner_gold', 'kishu_banner_gold', 'kishu_coat_winter'); localStorage.setItem('inu-empires-kibble-sim', JSON.stringify(s)); }); await p.reload(); };
const seed0 = () => localStorage.setItem('inu-empires-kibble-sim', JSON.stringify({ v: 1, wallet: null, kibbleU: 0, bones: 0, owned: ['akita_banner_gold', 'kishu_banner_gold', 'kishu_coat_winter'], equipped: { colour: 'colour_azure', banner: 'banner_paw', title: null, skin: null }, ledger: [], elo: 1200, wins: 0, games: 0, history: [], pack: null, points: 0 }));
// Cosmetics are granted through the simulated wallet (?demo=1, localStorage 'inu-empires-kibble-sim'); without ?demo=1 the
// game is in real-wallet mode and owned cosmetics come only from the kibble-pay inventory after a Phantom sign-in.
const px = (p, sel) => p.evaluate(s => { const c = document.querySelector(s); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.reduce((a, v, i) => (a + v * (i % 7)) % 1e9, 0); }, sel);
// 6 samples 170 ms apart (not 2): the glow pulse is a sine, so two samples straddling its peak can render identical frames
const moving = async (p, id) => { const h = new Set(); for (let i = 0; i < 6; i++) { h.add(await px(p, `.civ-card[data-civ=${id}] canvas`)); await p.waitForTimeout(170); } return h.size > 1; };
for (const ui of ['b', 'a']) { // b = default layout (no ?ui), a = ?ui=a comparison layout
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); const tag = ui === 'b' ? 'default (b)' : '?ui=a';
  p.on('pageerror', e => { check(false, 'pageerror ' + e.message); });
  await seedPage(p, ui === 'b' ? '?demo=1' : '?demo=1&ui=a'); await p.waitForFunction(() => document.querySelectorAll('.civ-card').length === 6); await p.waitForTimeout(400);
  check(await p.evaluate(() => document.getElementById('civ-cards').dataset.ui) === ui, `${tag}: renders layout ${ui}`);
  check(await p.locator('.civ-card.rar-common').count() === 4 && await p.locator('.civ-card[data-civ=akita].rar-rare').count() === 1 && await p.locator('.civ-card[data-civ=kishu].rar-legendary').count() === 1, `${tag}: shield finish follows owned cosmetics (Akita rare, Kishu legendary, rest common)`);
  const vis = await p.evaluate(() => Object.fromEntries(['shiba', 'akita', 'kishu'].map(id => { const e = document.querySelector(`.civ-card[data-civ=${id}]`); return [id, { shadow: getComputedStyle(e).boxShadow, label: getComputedStyle(e.querySelector('.rar')).color, text: e.querySelector('.rar').textContent }]; })));
  check(vis.shiba.shadow === 'none' && /122, 200, 255/.test(vis.akita.shadow) && /255, 216, 107/.test(vis.kishu.shadow), `${tag}: owned finishes glow on the card (Akita blue, Kishu gold; Shiba none)`);
  check(vis.akita.label !== vis.shiba.label && vis.kishu.label !== vis.shiba.label && /rare/i.test(vis.akita.text) && /legendary/i.test(vis.kishu.text), `${tag}: finish label coloured (Akita "${vis.akita.text}" ${vis.akita.label}, Kishu "${vis.kishu.text}" ${vis.kishu.label}, Shiba ${vis.shiba.label})`);
  if (ui === 'b') {
    // B: the shield canvas is the card art. Owned finishes draw a pulsing glow halo around the shield (must not be clipped by the canvas);
    // a common shield is static by design (no halo, no motion).
    const halo = await p.evaluate(() => Object.fromEntries(['shiba', 'akita', 'kishu'].map(id => { const c = document.querySelector(`.civ-card[data-civ=${id}] canvas`), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let ring = 0, edge = 0; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const a = d[(y * c.width + x) * 4 + 3]; if (x >= 4 && x <= 10 && y >= 20 && y <= 44) ring += a; if (x === 0 || y === 0 || x === c.width - 1) edge += a; }
      return [id, { ring, edge }]; })));
    check(halo.shiba.ring === 0 && halo.akita.ring > 200 && halo.kishu.ring > 200, `${tag}: glow halo drawn around owned shields (ring alpha Shiba ${halo.shiba.ring}, Akita ${halo.akita.ring}, Kishu ${halo.kishu.ring})`);
    check(halo.akita.edge < halo.akita.ring && halo.kishu.edge < halo.kishu.ring, `${tag}: halo fades out inside the canvas, not clipped at its edge (edge alpha Akita ${halo.akita.edge}, Kishu ${halo.kishu.edge})`);
    const m = { shiba: await moving(p, 'shiba'), akita: await moving(p, 'akita'), kishu: await moving(p, 'kishu') };
    check(m.akita && m.kishu && !m.shiba, `${tag}: owned shields animate (glow pulse), common shield static by design (Shiba ${m.shiba}, Akita ${m.akita}, Kishu ${m.kishu})`);
  } else {
    const m = { shiba: await moving(p, 'shiba'), akita: await moving(p, 'akita'), kishu: await moving(p, 'kishu') };
    check(m.shiba && m.akita && m.kishu, `${tag}: card previews are animated scenes (Shiba ${m.shiba}, Akita ${m.akita}, Kishu ${m.kishu})`);
  }
  await p.locator('#civ-cards').screenshot({ path: join(root, 'proof', `full-lobby-cards-${ui}.png`) });
  if (ui === 'a') { await ctx.close(); continue; }
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
