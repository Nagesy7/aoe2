// Online 1v1 lockstep browser proof. Two independent browser contexts (= two players) host/join a room through the
// local WebSocket relay (server/relay.mjs) and play with REAL mouse/keyboard input in each window: gather, build,
// train, attack. page.evaluate is used only to READ state (hashes, positions); no fast-forward exists in multiplayer.
//   node scripts/lockstep.mjs                 -> relay mode (starts server/relay.mjs locally)
//   node scripts/lockstep.mjs --tabs [URL]    -> BroadcastChannel mode: two tabs of ONE browser context (default URL: live site)
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRelay } from '../../server/relay.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));
const TABS = process.argv.includes('--tabs');
const GAME_TICKS = +(process.env.TICKS || (TABS ? 2400 : 4800));   // 2400 ticks = 2 min, 4800 = 4 min of game time
const SPEED = 4;
const tag = TABS ? 'lockstep-tabs' : 'lockstep';
await mkdir(join(root, 'proof'), { recursive: true });
const logLines = []; const log = s => { console.log(s); logLines.push(s); };
let fails = 0; const check = (c, m) => { log(`${c ? 'PASS' : 'FAIL'}: ${m}`); if (!c) fails++; };

let relay = null, BASE;
if (TABS) BASE = process.argv.find(a => /^https?:/.test(a)) || 'https://aoe2-ashen.vercel.app/';
else { relay = await startRelay({ port: 0, staticDir: root, log: s => log('  [relay] ' + s) }); BASE = `http://localhost:${relay.port}/`; }
log(`${tag} browser proof ${new Date().toISOString()} base=${BASE} mode=${TABS ? 'BroadcastChannel (two tabs, one browser)' : 'WebSocket relay (two browser contexts)'} speed=${SPEED}x`);

const browser = await chromium.launch();
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 760 } });
const ctxB = TABS ? ctxA : await browser.newContext({ viewport: { width: 1280, height: 760 } });
const host = await ctxA.newPage(), guest = await ctxB.newPage();
for (const [n, p] of [['host', host], ['guest', guest]]) { p.on('pageerror', e => { log(`pageerror(${n}) ${e}`); fails++; }); p.on('console', m => { if (m.type() === 'error') log(`console.error(${n}) ${m.text()}`); }); }
const q = `?speed=${SPEED}${TABS ? '&net=tabs' : ''}`;
await host.goto(BASE + q); await guest.goto(BASE + q);
const shot = async (p, name) => { await p.waitForTimeout(150); await p.screenshot({ path: join(root, 'proof', name) }); log(`  saved proof/${name}`); };
await shot(host, `${tag}-01-menu.png`);

// ---- lobby: host creates a room, guest joins by code (typed), both click Ready ----
await host.click('#btn-host');
await host.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('lobby-code').textContent));
const code = await host.locator('#lobby-code').innerText(); log(`  room code ${code}`);
await guest.click('#join-code'); await guest.keyboard.type(code); await guest.click('#btn-join');
await host.waitForFunction(() => !document.getElementById('btn-ready').disabled, null, { timeout: 15000 });
await guest.waitForFunction(() => !document.getElementById('btn-ready').disabled, null, { timeout: 15000 });
check(/Both players connected/.test(await host.locator('#lobby-status').innerText()), 'host lobby: both players connected');
await host.click('#btn-ready'); await host.waitForTimeout(300);
await shot(guest, `${tag}-02-lobby-guest.png`);
check(/Player 1.*Ready/s.test(await guest.locator('#lobby-players').innerText()), 'guest sees host Ready');
await guest.click('#btn-ready');
await host.waitForFunction(() => window.game.net && window.game.world, null, { timeout: 10000 });
await guest.waitForFunction(() => window.game.net && window.game.world, null, { timeout: 10000 });
const info = p => p.evaluate(() => ({ me: window.game.net.me, viewer: window.game.world.viewer, seed: window.game.world.seed, tick: window.game.world.tick }));
const hi = await info(host), gi = await info(guest);
check(hi.me === 0 && gi.me === 1 && hi.viewer === 'player' && gi.viewer === 'enemy', `roles: host = player 1 (${hi.viewer}), guest = player 2 (${gi.viewer})`);
check(hi.seed === gi.seed, `same map seed on both (${hi.seed})`);

// ---- helpers (real input) ----
const S = (p, fn, a) => p.evaluate(fn, a);
const scr = (p, x, y) => p.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]);
const onScreen = async (p, x, y, m = 90) => { const s = await scr(p, x, y); return s.x > m && s.y > 60 && s.x < 1280 - m && s.y < 760 - 170; };
const panTo = async (p, x, y) => { await p.mouse.move(640, 380);
  for (let i = 0; i < 80 && !(await onScreen(p, x, y)); i++) { const s = await scr(p, x, y);
    const keys = [s.x < 300 ? 'ArrowLeft' : s.x > 980 ? 'ArrowRight' : null, s.y < 200 ? 'ArrowUp' : s.y > 520 ? 'ArrowDown' : null].filter(Boolean);
    for (const k of keys) await p.keyboard.down(k); await p.waitForTimeout(70); for (const k of keys) await p.keyboard.up(k); } };
const click = async (p, x, y, button = 'left') => { await panTo(p, x, y); const s = await scr(p, x, y); await p.mouse.click(s.x, s.y, { button }); await p.waitForTimeout(60); };
const mine = (p, f) => S(p, f);
const myUnits = p => S(p, () => { const w = window.game.world; return w.units.filter(u => u.owner === w.viewer).map(u => ({ id: u.id, type: u.type, x: u.x, y: u.y, state: u.state })); });
const myTc = p => S(p, () => { const w = window.game.world; const b = w.buildings.find(b => b.type === 'town_center' && b.owner === w.viewer); return { id: b.id, x: b.x, y: b.y }; });
const nearest = (p, kind, from) => S(p, ([kind, from]) => window.game.world.resources.filter(n => n.kind === kind && n.amount > 0).sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0], [kind, from]);
const waitTicks = async n => { const t0 = await S(host, () => window.game.world.tick); await host.waitForFunction(t => window.game.world.tick >= t, t0 + n, { timeout: 120000 }); };
const btn = (p, a) => p.locator(`#commands button[data-action="${a}"]`);
const issued = p => S(p, () => window.game.net.issued);

// ---- fog: each player sees only their own side ----
const fogCheck = await Promise.all([host, guest].map(p => S(p, () => { const w = window.game.world, f = window.game.net && w;
  const foeTc = w.buildings.find(b => b.type === 'town_center' && b.owner !== w.viewer), ownTc = w.buildings.find(b => b.type === 'town_center' && b.owner === w.viewer);
  return { cam: [window.game.cam.x, window.game.cam.y], ownTc: [ownTc.x, ownTc.y] }; })));
check(fogCheck[0].ownTc[0] === 20 && fogCheck[1].ownTc[0] === 64, `mirrored bases: host TC at (${fogCheck[0].ownTc}), guest TC at (${fogCheck[1].ownTc}); each camera starts on its own TC`);

// ---- both players: gather berries, gold, build a house, train villagers ----
const econ = async (p, name) => {
  const tc = await myTc(p), us = (await myUnits(p)).filter(u => u.type === 'villager');
  const c = { x: tc.x + 2, y: tc.y + 2 };
  const ber = await nearest(p, 'berries', c), gold = await nearest(p, 'gold_mine', c);
  await click(p, us[0].x, us[0].y); await click(p, ber.x, ber.y, 'right');
  await click(p, us[1].x, us[1].y); await click(p, gold.x, gold.y, 'right');
  // villager 3 builds a House (button + ghost click), placed 3 tiles beside the TC on the side facing the map centre
  await click(p, us[2].x, us[2].y); await btn(p, 'house').click();
  const d = tc.x < 40 ? 1 : -1, hx = d > 0 ? tc.x + 6 : tc.x - 3, hy = tc.y + 1;
  await click(p, hx + 1, hy + 1);
  // TC: train 2 villagers
  await click(p, c.x, c.y); await btn(p, 'train').click(); await btn(p, 'train').click();
  log(`  ${name}: gather berries #${ber.id}, gold #${gold.id}, house at (${hx},${hy}), 2 villagers queued; commands issued ${await issued(p)}`);
  return { tc, us, hx, hy };
};
const [eh, eg] = await Promise.all([econ(host, 'host'), econ(guest, 'guest')]);
await waitTicks(30); await shot(host, `${tag}-03-host-economy.png`); await shot(guest, `${tag}-04-guest-economy.png`);
const fogProbe = p => S(p, () => { const w = window.game.world, f = window.game.fog, foe = w.buildings.find(b => b.type === 'town_center' && b.owner !== w.viewer);
  return { foeTcSeen: f.sees(foe), foeUnitsSeen: w.units.filter(u => u.owner !== w.viewer && f.sees(u)).length, ownSeen: w.units.filter(u => u.owner === w.viewer && f.sees(u)).length,
    explored: f.explored.reduce((a, b) => a + b, 0), total: f.explored.length }; });
for (const [n, p] of [['host', host], ['guest', guest]]) { const f = await fogProbe(p);
  check(!f.foeTcSeen && f.foeUnitsSeen === 0 && f.explored < f.total * 0.25, `${n} fog of war: enemy TC hidden, 0 enemy units visible, ${f.explored}/${f.total} tiles explored`); }
// villager 3 then builds a Barracks once the house is done
await host.waitForFunction(() => window.game.world.buildings.some(b => b.type === 'house' && b.owner === 'player' && b.complete), null, { timeout: 120000 });
await guest.waitForFunction(() => window.game.world.buildings.some(b => b.type === 'house' && b.owner === 'enemy' && b.complete), null, { timeout: 120000 });
check(true, 'both houses completed');
const barracks = async (p, e) => { const v = (await myUnits(p)).find(u => u.id === e.us[2].id);
  await click(p, v.x, v.y); await btn(p, 'barracks').click();
  const d = e.tc.x < 40 ? 1 : -1, bx = d > 0 ? e.tc.x + 1 : e.tc.x, by = d > 0 ? e.tc.y + 6 : e.tc.y - 5;
  await click(p, bx + 1.5, by + 1.5); };
await Promise.all([barracks(host, eh), barracks(guest, eg)]);
await host.waitForFunction(() => window.game.world.buildings.some(b => b.type === 'barracks' && b.owner === 'player' && b.complete), null, { timeout: 180000 });
await guest.waitForFunction(() => window.game.world.buildings.some(b => b.type === 'barracks' && b.owner === 'enemy' && b.complete), null, { timeout: 180000 });
check(true, 'both barracks completed');
// train militia on both sides
const militia = async p => { const b = await S(p, () => { const w = window.game.world; const b = w.buildings.find(b => b.type === 'barracks' && b.owner === w.viewer); return { x: b.x + 1.5, y: b.y + 1.5 }; });
  await click(p, b.x, b.y); await btn(p, 'militia').click(); await btn(p, 'militia').click(); };
await Promise.all([militia(host), militia(guest)]);
await host.waitForFunction(() => window.game.world.units.filter(u => u.type === 'militia').length >= 2, null, { timeout: 180000 });
await shot(host, `${tag}-05-host-militia.png`);

// ---- host attacks: select own militia, pan to the guest's Town Center, right-click it (real input) ----
const hm = (await myUnits(host)).filter(u => u.type === 'militia');
for (const [i, m] of hm.entries()) { await panTo(host, m.x, m.y); const s = await scr(host, m.x, m.y); if (i) await host.keyboard.down('Shift'); await host.mouse.click(s.x, s.y); if (i) await host.keyboard.up('Shift'); }
// drag-box over the militia so the whole group is selected
{ const xs = hm.map(m => m.x), ys = hm.map(m => m.y); await panTo(host, xs[0], ys[0]);
  const a = await scr(host, Math.min(...xs) - 0.8, Math.min(...ys) - 0.8), b = await scr(host, Math.max(...xs) + 0.8, Math.max(...ys) + 0.8);
  await host.mouse.move(a.x, a.y); await host.mouse.down(); await host.mouse.move(b.x, b.y, { steps: 6 }); await host.mouse.up(); }
const nsel = await S(host, () => window.game.sim.selectedUnits(window.game.world).length);
check(nsel >= 1, `host selected ${nsel} militia`);
const gtc = await myTc(guest);
await click(host, gtc.x + 2, gtc.y + 2, 'right');
check(await S(host, () => window.game.world.lastOrder?.kind === 'attack'), 'host right-click on the enemy Town Center = attack order (crosshair target)');
// guest also attacks with its militia: right-click a host villager position far away -> move/attack across the map
const gm = (await myUnits(guest)).filter(u => u.type === 'militia');
if (gm.length) { await click(guest, gm[0].x, gm[0].y); const htc = await myTc(host); await click(guest, htc.x + 2, htc.y + 2, 'right'); }
await host.waitForFunction(() => (window.game.world.combatLog || []).length > 0, null, { timeout: 180000 }).catch(() => {});
const hits = await S(host, () => (window.game.world.combatLog || []).length);
check(hits > 0, `combat happened (${hits} hits logged)`);
await panTo(host, gtc.x + 2, gtc.y + 2); await shot(host, `${tag}-06-host-attacking.png`);
await panTo(guest, gtc.x + 2, gtc.y + 2); await shot(guest, `${tag}-07-guest-under-attack.png`);
const gfog = await S(guest, () => { const w = window.game.world; return w.units.filter(u => u.owner === 'player' && u.type === 'villager').map(u => [u.x, u.y]); });

// ---- stall: freeze the guest's page for 2.5 s (busy loop); the host must wait and show the indicator ----
const tBefore = await S(host, () => window.game.world.tick);
const freeze = guest.evaluate(() => { const t = performance.now(); while (performance.now() - t < 2500); });
await host.waitForTimeout(1500);
const stallTxt = await host.locator('#stall').innerText().catch(() => '');
const tDuring = await S(host, () => window.game.world.tick);
await shot(host, `${tag}-08-stall-indicator.png`);
await freeze;
check(/Waiting for opponent/.test(stallTxt) && tDuring - tBefore <= 30, `host stalls while guest is frozen: "${stallTxt}", advanced only ${tDuring - tBefore} ticks in 1.5 s at ${SPEED}x`);
await waitTicks(40);
check(!(await host.locator('#stall').isVisible()), 'host resumes after guest is back; indicator hidden');

// ---- run to the target game time ----
log(`  running to tick ${GAME_TICKS} (${GAME_TICKS / 20} s of game time)...`);
await host.waitForFunction(t => window.game.world.tick >= t, GAME_TICKS, { timeout: 600000 });
await guest.waitForFunction(t => window.game.world.tick >= t, GAME_TICKS, { timeout: 600000 });
const H = await S(host, () => ({ hashes: window.game.net.hashes, checked: window.game.net.ls.checked, desync: window.game.net.ls.desync, stall: Math.round(window.game.net.stalledTotalMs), issued: window.game.net.issued, ping: window.game.net.session.rtt, net: document.getElementById('net').innerText }));
const G = await S(guest, () => ({ hashes: window.game.net.hashes, checked: window.game.net.ls.checked, desync: window.game.net.ls.desync, stall: Math.round(window.game.net.stalledTotalMs), issued: window.game.net.issued, net: document.getElementById('net').innerText }));
const gm2 = new Map(G.hashes.map(([t, h]) => [t, h])); let common = 0, diff = 0;
for (const [t, h] of H.hashes) if (gm2.has(t)) { common++; if (gm2.get(t) !== h) diff++; }
check(!H.desync && !G.desync, `no desync on either client (host: ${H.desync ? JSON.stringify(H.desync) : 'none'}, guest: ${G.desync ? JSON.stringify(G.desync) : 'none'})`);
check(common >= GAME_TICKS / 20 - 2 && diff === 0, `${common} hash checkpoints (every 20 ticks) compared offline: ${diff} mismatches`);
check(H.checked >= GAME_TICKS / 20 - 5 && G.checked >= GAME_TICKS / 20 - 5, `live hash exchange confirmed ${H.checked} (host) / ${G.checked} (guest) matches`);
check(H.issued >= 8 && G.issued >= 8, `commands from real input: host ${H.issued}, guest ${G.issued}`);
log(`  last checkpoint: tick ${H.hashes.at(-1)[0]} host ${H.hashes.at(-1)[1]} guest ${gm2.get(H.hashes.at(-1)[0])}`);
log(`  host HUD: ${H.net}`); log(`  guest HUD: ${G.net}`); log(`  total stall time: host ${H.stall} ms, guest ${G.stall} ms`);
const summary = p => S(p, () => { const w = window.game.world; return { tick: w.tick, units: w.units.map(u => `${u.owner[0]}${u.type[0]}`).sort().join(''), buildings: w.buildings.length,
  p1: { ...w.players.player.stockpile }, p2: { ...w.players.enemy.stockpile }, deaths: (w.deaths || []).length }; });
const sh = await summary(host), sg = await summary(guest);
log(`  host  view: ${JSON.stringify(sh)}`); log(`  guest view: ${JSON.stringify(sg)}`);
await shot(host, `${tag}-09-host-final.png`); await shot(guest, `${tag}-10-guest-final.png`);

// ---- disconnect handling: close the guest; host shows the disconnect notice ----
await guest.close();
await host.waitForFunction(() => /disconnected/.test(document.getElementById('stall').textContent), null, { timeout: 15000 }).catch(() => {});
check(/disconnected/i.test(await host.locator('#stall').innerText().catch(() => '')), `host notices the guest leaving: "${await host.locator('#stall').innerText().catch(() => '')}"`);
await shot(host, `${tag}-11-host-opponent-left.png`);

log(`RESULT: ${fails ? fails + ' FAILED' : 'ALL PASSED'}`);
await writeFile(join(root, 'proof', `${tag}.log`), logLines.join('\n') + '\n');
await browser.close(); if (relay) relay.server.close();
process.exit(fails ? 1 : 0);
