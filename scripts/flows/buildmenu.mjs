// Proof: compact build menu (tabs + small grid) with real input on desktop + iPhone 13 landscape -> proof/full-buildmenu-*.png
// and action->animation audit screenshots -> proof/full-anim-*.png.  Log: proof/full-buildmenu.log
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs'; import { join } from 'node:path'; import { fileURLToPath } from 'node:url';
import { startRelay } from '../../server/relay.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));
const { server } = await startRelay({ port: 0, staticDir: root, log: () => {} }); const BASE = process.env.URL || `http://localhost:${server.address().port}/`;
const lines = []; let fails = 0; const check = (c, m) => { const s = `${c ? 'PASS' : 'FAIL'}: ${m}`; console.log(s); lines.push(s); if (!c) fails++; };
const browser = await chromium.launch();
const vilScreen = p => p.evaluate(() => { const g = window.game, w = g.world, u = w.units.find(o => o.owner === 'player' && o.type === 'villager'); const q = g.toScreen(u.x, u.y); return { x: q.x, y: q.y }; });
const allBuilds = p => p.evaluate(() => window.game.sim.BUILD_MENU.length);
async function audit(p, name, click) {
  await p.waitForSelector('#commands .btabs', { state: 'attached' });
  const tabs = await p.locator('#commands .btab').count(); check(tabs === 3, `${name}: 3 build tabs (Economy / Military / Other)`);
  const seen = new Set(); let maxBtns = 0;
  for (let i = 0; i < tabs; i++) { await click(p.locator('#commands .btab').nth(i)); await p.waitForTimeout(150);
    check(await p.locator('#commands .btab').nth(i).getAttribute('aria-selected') === 'true', `${name}: tab ${i + 1} opens`);
    const ids = await p.locator('#commands .bgrid button').evaluateAll(bs => bs.map(b => b.dataset.action)); ids.forEach(x => seen.add(x)); maxBtns = Math.max(maxBtns, ids.length);
    const box = await p.locator('#commands').boundingBox(), vp = p.viewportSize();
    check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5, `${name}: tab ${i + 1} panel fully on screen (${Math.round(box.width)}x${Math.round(box.height)})`);
    check(box.width * box.height < vp.width * vp.height * 0.16, `${name}: panel is compact (${Math.round(100 * box.width * box.height / (vp.width * vp.height))}% of screen)`);
    await p.screenshot({ path: join(root, 'proof', `full-buildmenu-${name}-0${i + 1}-${['economy', 'military', 'other'][i]}.png`) }); }
  check(seen.size === await allBuilds(p), `${name}: every build option is still reachable (${seen.size}/${await allBuilds(p)})`);
  check(maxBtns <= 6, `${name}: at most 6 buttons shown at once (was all ${await allBuilds(p)})`);
  await click(p.locator('#commands .btab').nth(1)); await p.waitForTimeout(100); await click(p.locator('#commands .bgrid button[data-action=barracks]'));
  check(await p.evaluate(() => window.game.ui.placing === 'barracks'), `${name}: tapping Dojo in the Military tab starts placement`);
}
{ // desktop
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 }); const p = await ctx.newPage(); p.on('pageerror', e => check(false, 'pageerror ' + e.message));
  await p.goto(BASE); await p.click('#btn-sp'); await p.waitForFunction(() => window.game.world);
  const v = await vilScreen(p); await p.mouse.click(v.x, v.y);
  await audit(p, 'desktop', l => l.click());
  // animation audit: drive real sim states, crop around the villager
  const shots = [['wood', 'tree'], ['gold', 'gold_mine'], ['stone', 'stone_mine'], ['forage', 'berries'], ['farm', 'farm'], ['sheep', 'sheep'], ['build', 'house'], ['carry-meat', 'carry']];
  await p.keyboard.press('Escape');
  for (const [nm, kind] of shots) {
    const r = await p.evaluate(async ([nm, kind]) => { const g = window.game, S = g.sim, w = g.world; const u = w.units.find(o => o.owner === 'player' && o.type === 'villager'); const tc = w.buildings.find(b => b.type === 'town_center');
      const run = (s, f) => { for (let i = 0; i < s * 20; i++) { S.stepTick(w); if (f && f()) return true; } return false; };
      w.stockpile && Object.assign(w.stockpile, { food: 999, wood: 999, gold: 999, stone: 999 });
      if (kind === 'house') { S.selectUnits(w, [u]); S.placeBuilding(w, 'house', tc.x - 4, tc.y + 5, [u]); run(40, () => u.state === 'building'); }
      else if (kind === 'farm') { let b = null; S.selectUnits(w, [u]); for (const [dx, dy] of [[tc.size, 0], [-3, 0], [0, tc.size], [0, -3]]) if (!b) b = S.placeBuilding(w, 'farm', tc.x + dx, tc.y + dy, [u]); run(120, () => u.state === 'gathering'); }
      else if (kind === 'sheep' || kind === 'carry') { const sh = w.animals.find(a => a.type === 'sheep'); if (sh) { sh.owner = 'player'; S.orderHunt(w, u, sh); } run(60, () => u.state === 'gathering'); if (kind === 'carry') run(60, () => u.state === 'to_drop'); run(0.3); }
      else { const n = w.resources.filter(o => o.kind === kind && o.amount > 0).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0]; S.orderGather(w, u, n); run(60, () => u.state === 'gathering'); }
      S.selectUnits(w, []); g.cam.x = u.x * 32 * g.zoom() - innerWidth / 2; g.cam.y = u.y * 32 * g.zoom() - innerHeight / 2; g.tick(0.05);
      const { unitAction } = await import('/src/anim.js'); const q = g.toScreen(u.x, u.y); return { a: unitAction(u, w, w.time), q, st: u.state }; }, [nm, kind]);
    await p.waitForTimeout(120);
    const want = { wood: 'axe', gold: 'pick', stone: 'pick', forage: 'basket', farm: 'hoe', sheep: 'knife', build: 'hammer', 'carry-meat': null }[nm];
    check(r.a.tool === want && (nm === 'build' || r.a.tool !== 'hammer'), `anim ${nm}: ${r.a.action} / ${r.a.tool} / ${r.a.motion} (state ${r.st})`);
    await p.screenshot({ path: join(root, 'proof', `full-anim-${nm}.png`), clip: { x: Math.max(0, r.q.x - 60), y: Math.max(0, r.q.y - 50), width: 120, height: 80 }, scale: "device" });
  }
  await ctx.close();
}
{ // iPhone 13 landscape, CDP touch
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); p.on('pageerror', e => check(false, 'pageerror ' + e.message));
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: i })) });
  const tap = async q => { await touch('touchStart', [q]); await p.waitForTimeout(60); await touch('touchEnd', []); await p.waitForTimeout(120); };
  const tapL = async l => { const b = await l.boundingBox(); await tap({ x: b.x + b.width / 2, y: b.y + b.height / 2 }); };
  await p.goto(BASE); await p.locator('#btn-sp').scrollIntoViewIfNeeded(); await tapL(p.locator('#btn-sp')); await p.waitForFunction(() => window.game.world);
  await tap(await vilScreen(p)); await p.waitForTimeout(200);
  check(await p.evaluate(() => window.game.getSelected()?.type === 'villager'), 'iPhone: tap selects a villager');
  await p.screenshot({ path: join(root, 'proof', 'full-buildmenu-iphone-00-collapsed.png') });
  await tapL(p.locator('#cmdtab')); await p.waitForTimeout(200);
  await audit(p, 'iphone', tapL);
  await ctx.close();
}
await browser.close(); server.close();
lines.push(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED'); console.log(lines.at(-1));
writeFileSync(join(root, 'proof', 'full-buildmenu.log'), lines.join('\n') + '\n'); process.exit(fails ? 1 : 0);
