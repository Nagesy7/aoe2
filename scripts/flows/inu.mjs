// Inu reskin proof: title screen, labelled breed lineup, per-unit close-ups (blue + red, animated poses), and in-play shots.
import { startServer } from '../ctl.mjs';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png' };
const server = (await startServer({ root })).server; await mkdir(join(root, 'proof'), { recursive: true });
const BASE = process.env.INU_URL || `http://localhost:${server.address().port}/`;
const out = []; const log = s => { console.log(s); out.push(s); }; let fails = 0; const check = (c, m) => { log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { log('pageerror ' + e); fails++; });
const shot = async n => { await page.waitForTimeout(150); await page.screenshot({ path: join(root, 'proof', n) }); log(`  saved proof/${n}`); };

// 1. title screen
await page.goto(BASE); await page.waitForTimeout(1500);
check((await page.title()) === 'Inu Empires', `page title: ${await page.title()}`);
check(/Inu Empires/.test(await page.locator('#menu h1').innerText()), 'menu shows Inu Empires logo');
check(await page.evaluate(() => { const c = document.getElementById('title-bg'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const s = new Set(); for (let i = 0; i < d.length; i += 4000) s.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4); return s.size > 60; }), 'title backdrop is painted (rich colour variety)');
await shot('inu-title-screen.png');

// 2. lineup + close-ups drawn with the game's own renderer module on a scratch canvas
const TYPES = ['villager', 'militia', 'spearman', 'archer', 'crossbowman', 'scout_cavalry', 'knight', 'monk', 'trebuchet'];
const pngs = await page.evaluate(async TYPES => {
  const { drawInu, BREEDS } = await import('/src/inu.js'); const res = {};
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const grass = (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5a8a3a'); g.addColorStop(1, '#3f6a24'); x.fillStyle = g; x.fillRect(0, 0, w, h); };
  { const [c, x] = mk(1500, 560); grass(x, 1500, 560); x.fillStyle = '#20140ae0'; x.fillRect(0, 0, 1500, 60); x.fillStyle = '#ffd86b'; x.font = 'bold 34px Georgia'; x.textAlign = 'center'; x.fillText('Inu Empires: unit breeds (blue = player, red = enemy)', 750, 42);
    TYPES.forEach((t, i) => { const cx = 85 + i * 166; drawInu(x, { id: i, type: t, owner: 'player', state: 'idle', carry: t === 'villager' ? { res: 'wood', amount: 10 } : { amount: 0 } }, cx, 250, 0.3, { scale: 3.4 });
      drawInu(x, { id: i, type: t, owner: 'enemy', state: 'attacking', face: [-1, 0], carry: { amount: 0 } }, cx, 420, 0.5, { scale: 2.2 });
      x.fillStyle = '#000a'; x.fillRect(cx - 80, 460, 160, 84); x.fillStyle = '#fff'; x.font = 'bold 17px sans-serif'; x.fillText(BREEDS[t].label, cx, 488); x.fillStyle = '#f4d8a0'; x.font = '14px sans-serif'; x.fillText(BREEDS[t].breed + (t === 'trebuchet' ? '' : ' Inu'), cx, 510); x.fillStyle = '#aaa'; x.fillText(`id: ${t}`, cx, 530); });
    res['inu-lineup.png'] = c.toDataURL(); }
  for (const t of TYPES) { const [c, x] = mk(720, 260); grass(x, 720, 260); x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText(`${BREEDS[t].label}  (${t})`, 14, 30);
    const poses = [['idle', {}], ['walk', { moving: true }], ['walk 2', { moving: true, tt: 0.13 }], ['attack/work', { attacking: true, working: true }], ['enemy', { attacking: true, owner: 'enemy' }]];
    poses.forEach(([n, o], i) => { const cx = 75 + i * 140; drawInu(x, { id: 1, type: t, owner: o.owner || 'player', state: o.moving ? 'moving' : 'idle', carry: { amount: 0 } }, cx, 190, (o.tt || 0) + 0.1 + (o.attacking ? 0.15 : 0), { scale: 3, ...o, res: 'gold' });
      x.fillStyle = '#fffd'; x.font = '14px sans-serif'; x.textAlign = 'center'; x.fillText(n, cx, 245); x.textAlign = 'left'; });
    res[`inu-unit-${t}.png`] = c.toDataURL(); }
  { const [c, x] = mk(760, 220); grass(x, 760, 220); x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText('Shiba Villager: tool + carried load per resource', 14, 30);
    [['wood', null, 'wood'], ['gold', null, 'gold'], ['stone', null, 'stone'], ['food', 'bush', 'berries'], ['food', 'farm', 'farm'], ['food', 'carcass', 'hunt'], [null, null, 'build']].forEach(([r, k, n], i) => { const cx = 60 + i * 105;
      drawInu(x, { id: i, type: 'villager', owner: 'player', state: n === 'build' ? 'building' : 'gathering', carry: r ? { res: r, amount: 5 } : { amount: 0 } }, cx, 170, 0.2, { scale: 2.8, res: r, kind: k });
      x.fillStyle = '#fffd'; x.font = '14px sans-serif'; x.textAlign = 'center'; x.fillText(n, cx, 205); x.textAlign = 'left'; });
    res['inu-villager-resources.png'] = c.toDataURL(); }
  return res; }, TYPES);
for (const [n, d] of Object.entries(pngs)) { await writeFile(join(root, 'proof', n), Buffer.from(d.split(',')[1], 'base64')); log(`  saved proof/${n}`); }
check(Object.keys(pngs).length === TYPES.length + 2, `lineup + ${TYPES.length} close-ups + villager resource sheet rendered`);

// 3. in play: economy start and the skirmish (army vs enemy camp), plus spawned castle/imperial units
await page.goto(`${BASE}?play=sp`); await page.waitForFunction(() => window.game); await page.evaluate(() => window.game.tick(6));
check(/Inu Empires/.test(await page.locator('#hud').innerText()), 'HUD shows Inu Empires');
await shot('inu-play-economy.png');
const v = await page.evaluate(() => { const u = window.game.world.units.find(u => u.type === 'villager'); return window.game.toScreen(u.x, u.y); });
await page.mouse.click(v.x, v.y); await page.waitForTimeout(150);
check(/Shiba Worker Pup/.test(await page.locator('#info').innerText()), `villager info title: ${(await page.locator('#info').innerText()).split('\n')[0]}`);
await page.goto(`${BASE}?scenario=skirmish`); await page.waitForFunction(() => window.game);
const added = await page.evaluate(() => { const w = window.game.world, p = w.units.find(u => u.owner === 'player' && u.type !== 'villager'); const id0 = w.nextId;
  const ts = ['crossbowman', 'scout_cavalry', 'knight', 'monk', 'trebuchet'];
  ts.forEach((t, i) => w.units.push({ ...JSON.parse(JSON.stringify(p)), id: w.nextId++, type: t, x: p.x - 3 + i * 1.3, y: p.y + 2.2, path: [], state: 'idle', attack: null }));
  return ts.length; });
await page.evaluate(() => window.game.tick(0.5)); await shot('inu-play-army.png');
// zoomed close-up crop of the army
const a = await page.evaluate(() => { const p = window.game.world.units.find(u => u.owner === 'player' && u.type !== 'villager'); return window.game.toScreen(p.x, p.y); });
await page.screenshot({ path: join(root, 'proof', 'inu-play-army-closeup.png'), clip: { x: Math.max(0, a.x - 220), y: Math.max(0, a.y - 140), width: 440, height: 260 } }); log('  saved proof/inu-play-army-closeup.png');
// battle: order the army to attack the camp
for (let i = 0; i < 6; i++) await page.evaluate(() => window.game.tick(1));
const camp = await page.evaluate(() => { const e = window.game.world.units.find(u => u.owner === 'enemy'); return e ? window.game.toScreen(e.x, e.y) : null; });
log(`  ${added} castle/imperial units placed for display only (proof page, not a sim test)`);
await shot('inu-play-battle-start.png');
await writeFile(join(root, 'proof', 'inu.log'), out.join('\n') + '\n');
await browser.close(); server.close();
log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED'); process.exit(fails ? 1 : 0);
