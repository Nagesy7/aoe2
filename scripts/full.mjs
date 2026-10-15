// Full-RTS browser proof with real input (mouse/keyboard on desktop, CDP touch on iPhone 13 landscape).
// Covers: clan pick + skirmish vs computer, box-select + right-click gather, multi-builder construction, garrison/ungarrison,
// repair, stances, Forge techs, AI opponent (fast-forwarded spectator battle), online 1v1 over the HTTP relay protocol.
// window.game.tick() is only used to fast-forward time and a few evaluate() calls only set up state (damage) or the
// spectator camera; every order is real input.   node scripts/full.mjs   -> proof/full-*.png, proof/full.log
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path'; import { fileURLToPath } from 'node:url';
import { startRelay } from '../server/relay.mjs';
const root = fileURLToPath(new URL('..', import.meta.url)); mkdirSync(join(root, 'proof'), { recursive: true });
const { server } = await startRelay({ port: 0, staticDir: root, log: () => {} }); const BASE = process.env.URL || `http://localhost:${server.address().port}/`;
const lines = []; let fails = 0; const log = s => { console.log(s); lines.push(s); };
const check = (c, m) => { log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };
const shot = (p, name) => p.screenshot({ path: join(root, 'proof', `full-${name}.png`) });
const browser = await chromium.launch();
const helpers = p => ({ S: f => p.evaluate(f), scr: (x, y) => p.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]),
  mid: async sel => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; } });
const ONLY = process.env.ONLY || '';

// ---------------- desktop ----------------
if (!ONLY || ONLY === 'desktop') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage();
  p.on('pageerror', e => { log('pageerror ' + e.message); fails++; }); const { S, scr } = helpers(p);
  await p.goto(BASE); await p.waitForFunction(() => window.game);
  await p.selectOption('#civ', 'kishu'); await p.selectOption('#ai-civ', 'shikoku');
  check(/Archers \+1 range/.test(await p.locator('#civ-info').innerText()), 'menu shows the Kishu clan traits');
  await shot(p, 'desktop-01-menu');
  await p.click('#btn-ai'); await p.waitForFunction(() => window.game.world);
  check(await S(() => window.game.mode === 'ai' && window.game.world.players.player.civ === 'kishu' && window.game.world.computers.enemy.civ === 'shikoku'), 'skirmish vs computer started (Kishu vs Shikoku AI)');
  check(/Kishu Archers/.test(await p.locator('#hud').innerText()), 'HUD shows the clan');
  const vs = await S(() => window.game.world.units.filter(u => u.owner === 'player').map(u => ({ id: u.id, x: u.x, y: u.y })));
  const qs = await Promise.all(vs.map(v => scr(v.x, v.y)));
  const x0 = Math.min(...qs.map(q => q.x)) - 25, y0 = Math.min(...qs.map(q => q.y)) - 25, x1 = Math.max(...qs.map(q => q.x)) + 25, y1 = Math.max(...qs.map(q => q.y)) + 25;
  const boxSel = async (a, b, c, d) => { await p.mouse.move(a, b); await p.mouse.down(); await p.mouse.move(c, d, { steps: 8 }); await p.mouse.up(); };
  await boxSel(x0, y0, x1, y1);
  check((await S(() => window.game.world.selection?.ids?.length)) === 3, 'drag-box selects 3 Worker Pups');
  const berry = await S(() => { const w = window.game.world, tc = w.buildings.find(b => b.owner === 'player'); return w.resources.filter(n => n.kind === 'berries').sort((a, b) => Math.hypot(a.x - tc.x, a.y - tc.y) - Math.hypot(b.x - tc.x, b.y - tc.y))[0]; });
  const bq = await scr(berry.x, berry.y); await p.mouse.click(bq.x, bq.y, { button: 'right' });
  await S(() => window.game.tick(4));
  check((await S(() => window.game.world.units.filter(u => u.owner === 'player' && ['to_resource', 'gathering'].includes(u.state)).length)) === 3, 'right-click berries: all 3 go gathering');
  const tc = await S(() => { const b = window.game.world.buildings.find(b => b.owner === 'player' && b.type === 'town_center'); return { id: b.id, x: b.x, y: b.y }; });
  const vs2 = await S(() => window.game.world.units.filter(u => u.owner === 'player').map(u => ({ x: u.x, y: u.y })));
  const qs2 = await Promise.all(vs2.map(v => scr(v.x, v.y)));
  await boxSel(Math.min(...qs2.map(q => q.x)) - 25, Math.min(...qs2.map(q => q.y)) - 25, Math.max(...qs2.map(q => q.x)) + 25, Math.max(...qs2.map(q => q.y)) + 25);
  await p.click('#commands button[data-action=house]');
  let placed = false;
  for (const [dx, dy] of [[-4, 0], [0, -4], [6, 0], [0, 6], [-4, -4], [6, 6]]) { const q = await scr(tc.x + dx + 1, tc.y + dy + 1); await p.mouse.move(q.x, q.y, { steps: 4 }); await p.waitForTimeout(60);
    if (await S(() => window.game.ui.ghost?.valid)) { await p.mouse.down(); await p.mouse.up(); placed = true; break; } }
  check(placed, 'Kennel Hut foundation placed with a real click');
  const builders = await S(() => { const w = window.game.world, h = w.buildings.find(b => b.type === 'house' && b.owner === 'player'); return h ? w.units.filter(u => u.build === h.id).length : 0; });
  check(builders === 3, `all selected Worker Pups build together (${builders} builders)`);
  await S(() => window.game.tick(4)); await shot(p, 'desktop-02-construction');
  await S(() => window.game.tick(10));
  check(await S(() => window.game.world.buildings.some(b => b.type === 'house' && b.owner === 'player' && b.complete)), 'Kennel Hut finished within 14 s incl. walking with 3 builders (25 s of work alone)');
  const vs3 = await S(() => window.game.world.units.filter(u => u.owner === 'player').map(u => ({ x: u.x, y: u.y })));
  const qs3 = await Promise.all(vs3.map(v => scr(v.x, v.y)));
  await boxSel(Math.min(...qs3.map(q => q.x)) - 25, Math.min(...qs3.map(q => q.y)) - 25, Math.max(...qs3.map(q => q.x)) + 25, Math.max(...qs3.map(q => q.y)) + 25);
  const n = await S(() => window.game.world.selection?.ids?.length || 0);
  const tq = await scr(tc.x + 2, tc.y + 2); await p.mouse.click(tq.x, tq.y, { button: 'right' }); await S(() => window.game.tick(6));
  const g = await S(() => window.game.world.buildings.find(b => b.owner === 'player' && b.type === 'town_center').garrison.length);
  check(n > 0 && g === n, `right-click Den Hall garrisons the selection (${g}/${n})`);
  await p.mouse.click(tq.x, tq.y); await p.waitForTimeout(150);
  check(/Ungarrison \(\d+\/15\)/.test(await p.locator('#commands').innerText()), 'Den Hall panel shows the garrison count');
  await shot(p, 'desktop-03-garrison');
  await p.click('#commands button[data-action=ungarrison]'); await S(() => window.game.tick(0.2));
  check((await S(() => window.game.world.buildings.find(b => b.owner === 'player' && b.type === 'town_center').garrison.length)) === 0, 'Ungarrison button releases everyone');
  await S(() => { const b = window.game.world.buildings.find(b => b.owner === 'player' && b.type === 'town_center'); b.hp = 1500; });
  const v1 = await S(() => { const u = window.game.world.units.find(u => u.owner === 'player' && u.type === 'villager'); return { id: u.id, x: u.x, y: u.y }; });
  const vq = await scr(v1.x, v1.y); await p.mouse.click(vq.x, vq.y); await p.mouse.click(tq.x, tq.y, { button: 'right' }); await S(() => window.game.tick(15));
  const hp = await S(() => window.game.world.buildings.find(b => b.owner === 'player' && b.type === 'town_center').hp);
  check(hp > 1500, `right-click damaged Den Hall repairs it (1500 -> ${hp})`);
  await p.mouse.click(tq.x, tq.y); await shot(p, 'desktop-04-repair');
  await S(() => window.game.tick(600));
  const ai = await S(() => { const w = window.game.world; return { vil: w.units.filter(u => u.owner === 'enemy' && u.type === 'villager').length, b: w.buildings.filter(b => b.owner === 'enemy').length }; });
  check(ai.vil >= 14 && ai.b >= 6, `computer opponent built an economy in 10 min (${ai.vil} Worker Pups, ${ai.b} buildings)`);
  await p.close();
  const p2 = await ctx.newPage(); p2.on('pageerror', e => { log('pageerror ' + e.message); fails++; }); const H2 = helpers(p2);
  await p2.goto(BASE + '?scenario=skirmish'); await p2.waitForFunction(() => window.game && window.game.world);
  const army = await H2.S(() => window.game.world.units.filter(u => u.owner === 'player' && u.type !== 'villager').map(u => ({ x: u.x, y: u.y })));
  const aq = await Promise.all(army.map(a => H2.scr(a.x, a.y)));
  await p2.mouse.move(Math.min(...aq.map(q => q.x)) - 20, Math.min(...aq.map(q => q.y)) - 20); await p2.mouse.down();
  await p2.mouse.move(Math.max(...aq.map(q => q.x)) + 20, Math.max(...aq.map(q => q.y)) + 20, { steps: 8 }); await p2.mouse.up();
  await p2.click('#commands button[data-action=stance-stand]'); await H2.S(() => window.game.tick(0.1));
  const st = await H2.S(() => window.game.world.units.filter(u => u.owner === 'player' && u.type !== 'villager').map(u => u.stance));
  check(st.length === 7 && st.every(s => s === 'stand'), `stance buttons: 7 soldiers set to Stand Ground (${[...new Set(st)]})`);
  await shot(p2, 'desktop-05-stances');
  const v = await H2.S(() => { const u = window.game.world.units.find(u => u.owner === 'player' && u.type === 'villager'); return { x: u.x, y: u.y }; });
  const q = await H2.scr(v.x, v.y); await p2.mouse.click(q.x, q.y); await p2.click('#commands [data-action=btab-mil]'); await p2.click('#commands button[data-action=blacksmith]');
  let ok = false; for (const [dx, dy] of [[3, 3], [-6, 3], [3, -6], [5, -2], [-6, -6], [8, 0]]) { const gq = await H2.scr(v.x + dx, v.y + dy); await p2.mouse.move(gq.x, gq.y, { steps: 3 }); await p2.waitForTimeout(60);
    if (await H2.S(() => window.game.ui.ghost?.valid)) { await p2.mouse.down(); await p2.mouse.up(); ok = true; break; } }
  check(ok, 'Forge placed'); await H2.S(() => window.game.tick(45));
  const fg = await H2.S(() => { const b = window.game.world.buildings.find(b => b.type === 'blacksmith'); return b && b.complete ? { x: b.x + 1.5, y: b.y + 1.5 } : null; });
  check(!!fg, 'Forge completed');
  if (fg) { const fq = await H2.scr(fg.x, fg.y); await p2.mouse.click(fq.x, fq.y); await p2.waitForTimeout(150);
    const forgeTxt = await p2.locator('#commands').innerText();
    check(['Tempered Claws', 'Lacquer Plates', 'Fletched Arrows', 'Quilted Vests'].every(t => forgeTxt.includes(t)), 'Forge offers attack + armor upgrade lines');
    await p2.click('#commands button[data-action="tech-forging"]'); await H2.S(() => window.game.tick(51));
    check(await H2.S(() => 'forging' in window.game.world.researched), 'Tempered Claws researched');
    await p2.mouse.click(fq.x, fq.y); }
  await shot(p2, 'desktop-06-forge-techs'); await p2.close();
  const p3 = await ctx.newPage(); p3.on('pageerror', e => { log('pageerror ' + e.message); fails++; }); const H3 = helpers(p3);
  await p3.goto(BASE + '?play=watch&civ=kai&aiciv=hokkaido&seed=5'); await p3.waitForFunction(() => window.game && window.game.world);
  let found = null;
  for (let m = 0; m < 40 && !found; m++) { await H3.S(() => window.game.tick(60));
    found = await H3.S(() => { const w = window.game.world; const f = w.units.filter(u => u.state === 'attacking' && u.type !== 'villager'); return f.length >= 4 ? { x: f[0].x, y: f[0].y, n: f.length, t: w.time } : null; }); }
  check(!!found, `AI-vs-AI: armies clash at ${found ? (found.t / 60).toFixed(0) + ' min' : '-'} (${found?.n} fighting)`);
  if (found) { await H3.S(`(() => { const g = window.game; g.cam.x = ${found.x} * 32 - 640 / g.zoom(); g.cam.y = ${found.y} * 32 - 360 / g.zoom(); })()`); await H3.S(() => window.game.tick(1)); await p3.waitForTimeout(300); }
  const ages = await H3.S(() => [window.game.world.players.player.age, window.game.world.players.enemy.age]);
  check(ages.every(a => a !== 'dark'), `both computer players aged up (${ages})`);
  await shot(p3, 'desktop-07-ai-battle'); await p3.close();
  const host = await ctx.newPage(), guest = await ctx.newPage();
  for (const t of [host, guest]) { t.on('pageerror', e => { log('pageerror ' + e.message); fails++; }); await t.goto(BASE + '?net=http'); await t.waitForFunction(() => window.game); }
  await host.selectOption('#civ', 'akita'); await guest.selectOption('#civ', 'kai');
  await host.click('#btn-host'); await host.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('lobby-code').textContent));
  await guest.fill('#join-code', await host.locator('#lobby-code').innerText()); await guest.click('#btn-join');
  for (const t of [host, guest]) await t.waitForFunction(() => !document.getElementById('btn-ready').disabled, null, { timeout: 20000 });
  await host.click('#btn-ready'); await guest.click('#btn-ready');
  for (const t of [host, guest]) await t.waitForFunction(() => window.game.world && window.game.world.tick > 40, null, { timeout: 30000 });
  const civs = await guest.evaluate(() => [window.game.world.players.player.civ, window.game.world.players.enemy.civ]);
  check(civs[0] === 'akita' && civs[1] === 'kai', `lobby carries each player's clan (${civs})`);
  const Hh = helpers(host); await host.bringToFront();
  const hvp = await Hh.S(() => { const u = window.game.world.units.find(u => u.owner === 'player'); return { id: u.id, x: u.x, y: u.y }; });
  let hq = await Hh.scr(hvp.x, hvp.y); await host.mouse.click(hq.x, hq.y); hq = await Hh.scr(hvp.x + 3, hvp.y + 3); await host.mouse.click(hq.x, hq.y, { button: 'right' });
  await host.waitForTimeout(5000);
  const moved = await guest.evaluate(([id, x, y]) => { const u = window.game.world.units.find(o => o.id === id); return Math.hypot(u.x - x, u.y - y) > 1; }, [hvp.id, hvp.x, hvp.y]);
  check(moved, 'host right-click move arrives on the guest through the HTTP relay');
  const sync = await Promise.all([host, guest].map(t => t.evaluate(() => ({ n: window.game.net.ls.checked, desync: !!window.game.net.ls.desync }))));
  check(sync.every(s => s.n >= 3 && !s.desync), `HTTP relay lockstep: ${sync[0].n}/${sync[1].n} hash checks matched, no desync`);
  await shot(host, 'desktop-08-http-relay-1v1');
  await ctx.close();
}

// ---------------- iPhone 13 landscape (real CDP touch) ----------------
if (!ONLY || ONLY === 'iphone') {
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  p.on('pageerror', e => { log('pageerror ' + e.message); fails++; }); const { S, scr, mid } = helpers(p); const vp = p.viewportSize();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: i })) });
  const tap = async (q, ms = 60) => { await touch('touchStart', [q]); await p.waitForTimeout(ms); await touch('touchEnd', []); await p.waitForTimeout(120); };
  await p.goto(BASE); await p.waitForFunction(() => window.game);
  await p.selectOption('#civ', 'shikoku');
  const b = await p.locator('#btn-ai').boundingBox(); check(b && b.y + b.height <= vp.height, 'iPhone: Skirmish button on screen in landscape menu');
  await shot(p, 'iphone-01-menu');
  await tap(await mid('#btn-ai')); await p.waitForFunction(() => window.game.world);
  check(await S(() => window.game.mode === 'ai'), 'iPhone: tap starts a skirmish vs computer');
  const tc = await S(() => { const b = window.game.world.buildings.find(b => b.owner === 'player'); return { x: b.x, y: b.y }; });
  const vs = await S(() => window.game.world.units.filter(u => u.owner === 'player').map(u => ({ id: u.id, x: u.x, y: u.y })));
  let v = null; for (const u of vs) { const q = await scr(u.x, u.y); if (q.x > 60 && q.x < vp.width - 200 && q.y > 50 && q.y < vp.height - 40) { v = { ...u, q }; break; } }
  check(!!v, 'iPhone: a Worker Pup is on screen');
  if (v) { await tap(v.q); check((await S(() => window.game.world.selection))?.id === v.id, 'iPhone: tap selects the Worker Pup');
    await tap(await mid('#cmdtab')); await tap(await mid('#commands button[data-action=house]'));
    let placed = false; for (const [dx, dy] of [[-4, 1], [1, -4], [6, 1], [1, 6], [-4, -4]]) { const q = await scr(tc.x + dx + 1, tc.y + dy + 1);
      if (q.x < 10 || q.y < 40 || q.x > vp.width - 10 || q.y > vp.height - 10) continue; await tap(q);
      if (await S(() => window.game.world.buildings.some(b => b.type === 'house' && b.owner === 'player'))) { placed = true; break; }
      await tap(await mid('#cmdtab')); if (await p.locator('#commands button[data-action=house]').isVisible()) await tap(await mid('#commands button[data-action=house]')); }
    check(placed, 'iPhone: tap places a Kennel Hut foundation'); }
  await S(() => window.game.tick(5)); await shot(p, 'iphone-02-build');
  const tq = await scr(tc.x + 2, tc.y + 2); await tap(tq); await tap(await mid('#cmdtab'));
  const txt = await p.locator('#commands').innerText(); check(/Train .*Worker Pup/.test(txt) && /Advance to Pack Age/.test(txt) && /Ungarrison/.test(txt), 'iPhone: Den Hall menu (train, age up, garrison) via tab');
  await tap(await mid('#commands button[data-action=train]')); check((await S(() => window.game.world.buildings.find(b => b.owner === 'player' && b.type === 'town_center').queue.length)) >= 1, 'iPhone: tap trains a Worker Pup');
  await shot(p, 'iphone-03-den-hall'); await p.close();
  const p3 = await ctx.newPage(); const H3 = helpers(p3); await p3.goto(BASE + '?play=watch&civ=kishu&aiciv=akita&seed=3'); await p3.waitForFunction(() => window.game && window.game.world);
  let found = null; for (let m = 0; m < 40 && !found; m++) { await H3.S(() => window.game.tick(60));
    found = await H3.S(() => { const w = window.game.world; const f = w.units.filter(u => u.state === 'attacking' && u.type !== 'villager'); return f.length >= 4 ? { x: f[0].x, y: f[0].y } : null; }); }
  if (found) { await H3.S(`(() => { const g = window.game; g.cam.x = ${found.x} * 32 - innerWidth / 2 / g.zoom(); g.cam.y = ${found.y} * 32 - innerHeight / 2 / g.zoom(); })()`); await H3.S(() => window.game.tick(1)); await p3.waitForTimeout(300); }
  check(!!found, 'iPhone: AI-vs-AI battle rendered in landscape'); await shot(p3, 'iphone-04-ai-battle');
  await ctx.close();
}
await browser.close(); server.close();
log(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED');
writeFileSync(join(root, 'proof', ONLY ? `full-${ONLY}.log` : 'full.log'), lines.join('\n') + '\n'); process.exit(fails ? 1 : 0);
