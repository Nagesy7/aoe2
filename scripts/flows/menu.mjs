// Title menu proof (src/menu.js): Campaign · Skirmish · Multiplayer · Store · Settings, every path, with touch (844x390 / 750x342),
// mouse + keyboard (1366x768) and a mocked controller (D-pad / stick move focus, A confirm, B back, Start = Settings).
// UI only: a match started from the menu hashes the same as the same match started by URL, and the Practice Camp equals a Node createWorld.
//   ctl run menu [--url <preview>] [--shots]      -> proof/menu.log, shots /workspace/inu-empires-shots/menu-*.png
import { join } from 'node:path'; import { writeFileSync } from 'node:fs';
import { ROOT, base, argOf, flag, newPage, openTitle, menuTo, checker, shot, closeAll, SHOTS } from '../ctl.mjs';
import { MOCK } from './gamepad.mjs';
import * as S from '../../src/sim.js';
import * as K from '../../src/kibble.js';
const B = { a: 0, b: 1, x: 2, y: 3, start: 9, up: 12, down: 13, left: 14, right: 15 };
const XB_ID = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
const page = p => p.S(() => ({ page: window.game.menu.page, mode: window.game.menu.state.mode, shown: document.getElementById('menu').style.display, focus: document.activeElement && (document.activeElement.id || document.activeElement.dataset.civ || (document.activeElement.dataset.stab && 'stab:' + document.activeElement.dataset.stab) || (document.activeElement.dataset.buy && 'buy:' + document.activeElement.dataset.buy) || document.activeElement.className) }));
const hashAt = (p, T) => p.S(T => { const g = window.game; g.paused = true; g.loop?.pause?.(); if (g.world.tick > T) return null; while (g.world.tick < T) g.sim.stepTick(g.world); return g.stateHash(); }, T);
export default async function (argv) {
  const srv = await base(argv); const url = srv.url, q = url.includes('?') ? '&' : '?'; const c = checker(); const shots = flag('shots', argv) || !argOf('url', '', argv);
  const tag = argOf('tag', '', argv), S_ = n => join(SHOTS, `menu-${n}${tag ? '-' + tag : ''}.png`);
  // ===== 1. phone landscape 844x390, touch =====
  let p = await newPage({ phone: true }); await openTitle(p, url, q + 'demo=1');
  const navs = await p.S(() => [...document.querySelectorAll('#menu .mnav')].map(b => b.querySelector('b').textContent));
  c(navs.join(',') === 'Campaign,Skirmish,Multiplayer,Store,Settings', `main menu has exactly five entries in order: ${navs.join(' · ')}`);
  const sec = await p.S(() => [...document.querySelectorAll('#pg-home .msec')].map(b => b.id + ':' + b.textContent.trim()));
  c(sec.length === 2 && /btn-raid/.test(sec[0]) && /btn-kibble/.test(sec[1]), `secondary row keeps Boss Raid + $KIBBLE network (${sec.join(', ')})`);
  if (shots) { await p.waitForTimeout(400); await shot(p, S_('main-844x390')); }
  // Campaign -> clan select + scenarios; story campaign is honest 'Coming soon'
  await p.press('#m-campaign'); let pg = await page(p); c(pg.page === 'setup' && pg.mode === 'campaign', `tap Campaign -> clan select (campaign) ${JSON.stringify(pg)}`);
  const camp = await p.S(() => ({ soon: document.querySelector('#pg-setup .mode[data-mode=campaign] .soon').textContent, cards: document.querySelectorAll('#civ-cards .civ-card').length, scen: [...document.querySelectorAll('#pg-setup .mode[data-mode=campaign] button')].filter(b => b.offsetParent).map(b => b.id) }));
  c(/Coming soon/.test(camp.soon) && !/mission \d/i.test(camp.soon), `story campaign marked "Coming soon", no fake missions ("${camp.soon.replace(/\s+/g, ' ')}")`);
  c(camp.cards === 6 && camp.scen.join() === 'btn-sp,btn-raids,btn-headstart', `6 clan cards + existing scenarios ${camp.scen.join(', ')}`);
  await p.press('#civ-cards .civ-card[data-civ=kai]'); c(await p.inputValue('#menu #civ') === 'kai' && /Infantry/.test(await p.locator('#civ-info').innerText()), 'tap Kai Brindles card picks it, blurb shows its traits');
  if (shots) await shot(p, S_('campaign-844x390'));
  await p.press('#pg-setup .mback'); pg = await page(p); c(pg.page === 'home', 'Back -> main menu');
  // Skirmish -> clan select with opponent -> Start
  await p.press('#m-skirmish'); pg = await page(p); c(pg.page === 'setup' && pg.mode === 'skirmish' && await p.isVisible('#btn-ai') && await p.isVisible('#ai-civ') && !(await p.isVisible('#btn-sp')), 'tap Skirmish -> clan select with opponent picker + Start');
  await p.press('#civ-cards .civ-card[data-civ=hokkaido]'); await p.selectOption('#ai-civ', 'shikoku');
  if (shots) await shot(p, S_('civselect-844x390'));
  const startB = await p.locator('#btn-ai').boundingBox(); c(startB && startB.y + startB.height <= 390 && startB.x + startB.width <= 844, `Start Skirmish on screen at 844x390 (bottom ${Math.round(startB.y + startB.height)})`);
  await p.press('#btn-ai'); await p.waitForFunction(() => window.game.world);
  let w = await p.S(() => ({ civ: window.game.world.players.player.civ, ai: !!window.game.aiMode, menu: document.getElementById('menu').style.display }));
  c(w.civ === 'hokkaido' && w.ai && w.menu === 'none', `Start -> skirmish vs computer as the picked clan (${JSON.stringify(w)})`);
  const T = 400; const hMenu = await hashAt(p, T); await p.context().close();
  { const r = await newPage({ phone: true }); await r.goto(url + q + 'play=ai&civ=hokkaido&aiciv=shikoku&seed=7'); await r.waitForFunction(() => window.game.world); const hUrl = await hashAt(r, T);
    c(hMenu && hMenu === hUrl, `UI only: menu-started skirmish hash at tick ${T} == the same match by URL (${hMenu} vs ${hUrl})`); await r.context().close(); }
  // Campaign scenarios start the existing single-player modes with the picked clan
  const runs = {};
  for (const [id, want] of [['btn-sp', { raids: false, scenario: null }], ['btn-raids', { raids: true, scenario: null }], ['btn-headstart', { raids: false, scenario: 'skirmish' }]]) {
    p = await newPage({ phone: true }); await openTitle(p, url); await p.press('#m-campaign'); await p.press('#civ-cards .civ-card[data-civ=akita]'); await p.press('#' + id); await p.waitForFunction(() => window.game.world);
    w = await p.S(() => { const w = window.game.world; return { civ: w.players.player.civ, raids: !!(w.ai && w.ai.raids), dojo: w.buildings.some(b => b.owner === 'player' && b.type === 'barracks'), tick: w.tick }; });
    const ok = w.civ === 'akita' && w.raids === want.raids && w.dojo === (want.scenario === 'skirmish'); runs[id] = w;
    const node = S.createWorld({ enemy: true, raids: want.raids, scenario: want.scenario }); node.players.player.civ = 'akita'; const h = await hashAt(p, 300); while (node.tick < 300) S.stepTick(node);
    c(ok && h === S.stateHash(node), `Campaign ▸ ${id} starts as Akita (raids ${w.raids}, head-start Dojo (barracks) ${w.dojo}); browser hash == Node createWorld at tick 300 (${h})`);
    if (id === 'btn-sp' && shots) { await p.S(() => { window.game.paused = false; }); }
    c(!p.errors.length, `${id}: no page errors ${p.errors.join(' | ')}`); await p.context().close(); }
  // Multiplayer -> clan select + online panel -> Host -> lobby -> Leave returns to the Multiplayer page
  p = await newPage({ phone: true }); await openTitle(p, url, q + 'net=tabs');
  await p.press('#m-multiplayer'); pg = await page(p); c(pg.page === 'setup' && pg.mode === 'multiplayer' && await p.isVisible('#btn-host') && await p.isVisible('#btn-join') && await p.isVisible('#transport'), 'tap Multiplayer -> clan select + transport / Host / Join');
  await p.press('#civ-cards .civ-card[data-civ=kishu]'); if (shots) await shot(p, S_('multiplayer-844x390'));
  await p.press('#btn-join'); c(/room code/.test(await p.locator('#menu-err').innerText()), 'Join without a code shows the existing hint');
  await p.press('#btn-host'); await p.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('lobby-code').textContent)); c(await p.isVisible('#lobby'), 'Host 1v1 opens the existing net.js lobby with a room code');
  await p.press('#btn-leave'); await p.waitForTimeout(200); pg = await page(p); c(pg.shown === 'flex' && pg.page === 'setup' && pg.mode === 'multiplayer', `Leave -> back on the Multiplayer clan select (${JSON.stringify(pg)})`);
  await p.context().close();
  // Store: cosmetics that exist in code; Equip follows K.canUse; no buy / price / wager anywhere on the page
  p = await newPage({ phone: true }); await openTitle(p, url, q + 'demo=1'); await p.S(() => localStorage.removeItem('inu-empires-kibble-sim')); await p.reload(); await p.waitForFunction(() => window.game && window.game.menu);
  await p.press('#m-store'); pg = await page(p); c(pg.page === 'store', 'tap Store -> Store');
  const free = Object.entries(K.COSMETICS).filter(([, x]) => !x.price).length;
  let st = await p.S(() => ({ items: [...document.querySelectorAll('#store-items .sitem')].map(e => e.dataset.item), txt: document.getElementById('pg-store').innerText }));
  c(st.items.length === free && st.items.every(id => id in { ...Object.fromEntries(Object.keys(K.COSMETICS).map(k => [k, 1])) }), `Free & tier tab lists the ${free} tier cosmetics from src/kibble.js`);
  if (shots) await shot(p, S_('store-844x390'));
  const noBuy = t => !/\bbuy\b|checkout|wager|\bbet\b/i.test(t);
  c(noBuy(st.txt), 'Free & tier tab: no buy / wager text (equip only)');
  await p.press('[data-stab=kennel]'); st = await p.S(() => [...document.querySelectorAll('#store-items .sitem')].map(e => e.dataset.item)); c(st.length > 0 && st.every(id => id.startsWith('kn_')), `Kennel rewards tab lists ${st.length} kn_* cosmetics from src/kennel.js`);
  await p.press('#store-kennel'); c(await p.S(() => document.getElementById('kb').style.display === 'flex' && document.getElementById('kb').dataset.tab === 'kennel'), 'Store ▸ Open my Kibble Kennel opens the Kennel tab');
  await p.press('#kb [data-k=connect]').catch(() => {}); await p.waitForTimeout(150); await p.press('#kb-close');
  await p.press('[data-stab=tier]'); const eq = await p.S(() => [...document.querySelectorAll('#store-items [data-equip]')].map(b => b.dataset.equip));
  c(eq.includes('colour_jade'), `after the demo wallet connects (Hound tier), tier cosmetics show Equip (${eq.join(', ')})`);
  await p.press('[data-equip=colour_jade]'); const after = await p.S(() => ({ sst: document.querySelector('[data-item=colour_jade] .sst').textContent, eq: JSON.parse(localStorage.getItem('inu-empires-kibble-sim')).equipped.colour }));
  c(after.sst === 'Equipped' && after.eq === 'colour_jade', `Equip -> Jade team colour equipped (${JSON.stringify(after)})`);
  // the $KIBBLE panel's shop, moved into the Store: same items, prices, risk notes and buy flow (simulated here: ?demo=1)
  await p.press('[data-stab=shop]'); st = await p.S(() => { const it = document.getElementById('store-items'), n = document.querySelector('#store-foot .kshop-note'), r = n?.getBoundingClientRect();
    return { items: [...it.querySelectorAll('.kitem')].map(e => [e.querySelector('[data-buy],[data-eq]')?.dataset.buy || e.querySelector('[data-eq]')?.dataset.eq, e.querySelector('small').textContent]), note: n?.innerText || '', noteOn: !!r && r.top >= 0 && r.bottom <= innerHeight && r.width > 0 }; });
  c(st.items.length === K.SHOP.length && st.items.every(([id], i) => id === K.SHOP[i]), `Kibble shop tab lists the ${K.SHOP.length} K.SHOP items in order, each with Buy`);
  c(st.items.every(([id, t]) => { const x = K.COSMETICS[id], q = K.feeSplit(K.toU(x.price)); return t.startsWith(`${x.price} + ${K.fmtK(q.fee)} fee = ${K.fmtK(q.total)} $KIBBLE`); }), 'prices unchanged: price + 2% fee = total, same as the old panel');
  c(st.noteOn && /SIMULATED · demo only · no real wallet or transactions/.test(st.note) && /2% fee on every purchase: 1% to the President's Vault/.test(st.note) && /prize pools/.test(st.note), `risk notes on screen next to the Buy buttons: ${st.note.replace(/\s+/g, ' ').slice(0, 120)}`);
  c(!/wager|\bbet\b|odds/i.test(st.note), 'shop notes: no wagers / odds');
  if (shots) await shot(p, S_('store-shop-844x390'));
  const tre0 = await p.S(() => JSON.parse(localStorage.getItem('inu-empires-kibble-sim')).treasuryU || 0);
  await p.press('[data-buy=skin_snow_akita]'); const bm = await p.locator('#kb-shop-msg').innerText();
  c(/Need 2,550,000 KIBBLE \(incl\. 2% fee\)/.test(bm), `Buy runs the existing flow (25k demo wallet cannot afford 2.55M): ${bm}`);
  c(await p.S(() => JSON.parse(localStorage.getItem('inu-empires-kibble-sim')).treasuryU || 0) === tre0, 'refused buy moves nothing (President\'s Vault unchanged)');
  await p.press('#pg-store .mback'); await p.press('#btn-kibble');
  { const k = await p.S(() => ({ shopTab: !!document.querySelector('#kb [data-tab=shop]'), link: !!document.querySelector('#kb [data-k=to-store]'), tabs: [...document.querySelectorAll('#kb [data-tab]')].map(b => b.dataset.tab) }));
    c(!k.shopTab && k.link && ['wallet', 'kennel', 'ladder', 'pools', 'packs', 'cup'].every(t => k.tabs.includes(t)), `$KIBBLE panel: shop tab gone, "Kibble shop ▸ Store" link, other tabs kept (${k.tabs.join(', ')})`); }
  await p.press('#kb [data-k=to-store]'); await p.waitForTimeout(150); pg = await page(p);
  c(pg.page === 'store' && !(await p.isVisible('#kb')) && await p.S(() => document.querySelectorAll('#store-items [data-buy]').length) === K.SHOP.length, 'panel link opens Store ▸ Kibble shop');
  await p.press('[data-stab=tier]');
  // cosmetics never touch the sim: a match with Jade equipped hashes the same as one without
  await p.press('#pg-store .mback'); await p.press('#m-skirmish'); await p.press('#btn-ai'); await p.waitForFunction(() => window.game.world); const hJade = await hashAt(p, T);
  { const r = await newPage({ phone: true }); await r.goto(url + q + 'play=ai&civ=shiba&aiciv=akita&seed=7'); await r.waitForFunction(() => window.game.world); const h0 = await hashAt(r, T);
    c(hJade === h0, `cosmetics are render-only: skirmish hash with Jade equipped == default (${hJade} vs ${h0})`); await r.context().close(); }
  await p.context().close();
  // Settings: real settings only
  p = await newPage({ phone: true }); await openTitle(p, url); await p.S(() => { localStorage.removeItem('inu-alive'); localStorage.removeItem('inu-pad'); }); await p.reload(); await p.waitForFunction(() => window.game && window.game.menu);
  await p.press('#m-settings'); pg = await page(p); c(pg.page === 'settings', 'tap Settings -> Settings');
  const secs = await p.S(() => [...document.querySelectorAll('#pg-settings h3')].map(h => h.textContent)); c(secs.length === 3, `sections: ${secs.join(' | ')}`);
  await p.waitForFunction(() => document.querySelectorAll('#set-hints tr').length > 5); if (shots) await shot(p, S_('settings-844x390'));
  await p.press('#set-weather'); let ls = await p.S(() => JSON.parse(localStorage.getItem('inu-alive') || '{}')); c(ls.weather === false, `Weather toggle writes the same inu-alive setting as the ✨ panel (${JSON.stringify(ls)})`);
  await p.press('#set-weather'); await p.press('#set-sound'); ls = await p.S(() => JSON.parse(localStorage.getItem('inu-alive') || '{}')); c(ls.sound === false && ls.weather === true, `Sound toggle off (${JSON.stringify(ls)})`); await p.press('#set-sound');
  await p.S(() => { const r = document.getElementById('set-deadzone'); r.value = '0.3'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  ls = await p.S(() => JSON.parse(localStorage.getItem('inu-pad') || '{}')); c(ls.deadzone === 0.3 && /0\.30/.test(await p.locator('#set-dz-val').innerText()), `deadzone slider stores inu-pad deadzone ${ls.deadzone}`);
  const hints = await p.S(() => document.getElementById('set-hints').innerText); c(/LB/.test(hints) && /L1/.test(hints) && /menus: back/.test(hints), 'button hints table shows Xbox + PlayStation glyphs');
  await p.press('#set-kibble'); c(await p.S(() => document.getElementById('kb').style.display === 'flex' && document.getElementById('kb').dataset.tab === 'wallet'), 'Settings ▸ Open $KIBBLE network opens the wallet tab'); await p.press('#kb-close');
  await p.press('#pg-settings .mback');
  // secondary row: Boss Raid + $KIBBLE network still reachable
  await p.press('#btn-kibble'); c(await p.S(() => document.getElementById('kb').style.display === 'flex'), 'home ▸ $KIBBLE network opens the panel (wallet, Kennel, ladder, pools, Cup)'); await p.press('#kb-close');
  await p.press('#btn-raid'); await p.waitForTimeout(600); c(await p.S(() => document.getElementById('raid').style.display !== 'none' && document.getElementById('menu').style.display === 'none'), 'home ▸ Boss Raid opens the raid');
  c(!p.errors.length, `phone: no page errors ${p.errors.join(' | ')}`); await p.context().close();
  // ===== 2. 750x342 (iPhone 13 landscape in Playwright): every page fits =====
  p = await newPage({ phone: true, ctxOpts: { viewport: { width: 750, height: 342 } } }); await openTitle(p, url);
  for (const pgn of ['home', 'campaign', 'skirmish', 'multiplayer', 'store', 'settings']) { await menuTo(p, pgn); await p.waitForTimeout(200);
    const fit = await p.S(() => { const m = document.getElementById('menu'), vis = [...m.querySelectorAll('button[id], .mback, .mnav')].filter(b => b.offsetParent && !b.closest('[hidden]'));
      const r = vis.map(b => b.getBoundingClientRect()); return { scroll: m.scrollHeight - m.clientHeight, off: r.filter(q => q.right > innerWidth + 1 || q.bottom > innerHeight + 1 || q.left < -1 || q.top < -1).length, n: vis.length }; });
    c(fit.scroll <= 0 && fit.off === 0, `750x342 ${pgn}: fits without scrolling, ${fit.n} buttons on screen (overflow ${fit.scroll}px, off-screen ${fit.off})`);
    if (shots) await shot(p, S_(`${pgn}-750x342`));
    if (pgn === 'store') { await p.press('[data-stab=shop]'); await p.waitForTimeout(150);
      const f2 = await p.S(() => { const m = document.getElementById('menu'), n = document.querySelector('.kshop-note').getBoundingClientRect(), b = document.querySelector('#store-items [data-buy]').getBoundingClientRect();
        return { scroll: m.scrollHeight - m.clientHeight, note: n.top >= 0 && n.bottom <= innerHeight, buy: b.top >= 0 && b.bottom <= innerHeight }; });
      c(f2.scroll <= 0 && f2.note && f2.buy, `750x342 Kibble shop: fits, first Buy and the risk notes on screen together (${JSON.stringify(f2)})`); if (shots) await shot(p, S_('store-shop-750x342')); } }
  await p.context().close();
  // ===== 3. desktop 1366x768: mouse + keyboard =====
  p = await newPage({}); await openTitle(p, url); if (shots) { await p.waitForTimeout(400); await shot(p, S_('main-1366x768')); }
  await p.keyboard.press('ArrowDown'); pg = await page(p); c(pg.focus === 'm-campaign', `keyboard: first arrow focuses Campaign (${pg.focus})`);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); pg = await page(p); c(pg.focus === 'm-store', `ArrowDown x3 -> Store (${pg.focus})`);
  await p.keyboard.press('Enter'); await p.waitForTimeout(150); pg = await page(p); c(pg.page === 'store', 'Enter opens Store');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); pg = await page(p); c(pg.page === 'home', 'Escape -> back to main menu');
  for (let i = 0; i < 6 && (await page(p)).focus !== 'm-settings'; i++) await p.keyboard.press('ArrowDown');
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); pg = await page(p);
  c(pg.focus === 'm-skirmish', `ArrowUp moves back up: Settings x3 -> ${pg.focus}`); await p.keyboard.press('Enter'); await p.waitForTimeout(200); pg = await page(p);
  c(pg.page === 'setup' && pg.mode === 'skirmish' && pg.focus === 'shiba', `Enter on Skirmish -> clan select, focus on the picked clan card (${pg.focus})`);
  await p.keyboard.press('ArrowRight'); pg = await page(p); await p.keyboard.press('Enter'); c(await p.inputValue('#menu #civ') === pg.focus, `ArrowRight + Enter picks ${pg.focus}`);
  if (shots) await shot(p, S_('civselect-1366x768'));
  for (let i = 0; i < 4; i++) { await p.keyboard.press('ArrowRight'); pg = await page(p); if (pg.focus === 'ai-civ') break; }
  await p.keyboard.press('ArrowDown'); pg = await page(p); c(pg.focus === 'btn-ai', `arrows reach Start Skirmish (${pg.focus})`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); c((await page(p)).page === 'home', 'Escape from clan select -> main menu');
  await p.click('#m-settings'); c((await page(p)).page === 'settings', 'mouse click Settings'); if (shots) await shot(p, S_('settings-1366x768'));
  await p.click('#pg-settings .mback'); await p.click('#m-store'); if (shots) await shot(p, S_('store-1366x768'));
  await p.click('#pg-store .mback'); await p.click('#m-campaign'); if (shots) await shot(p, S_('campaign-1366x768'));
  const pick = await p.inputValue('#menu #civ'); await p.click('#btn-sp'); await p.waitForFunction(() => window.game.world); c(await p.S(() => window.game.world.players.player.civ) === pick, 'mouse: Campaign ▸ Practice Camp starts with the picked clan');
  c(!p.errors.length, `desktop: no page errors ${p.errors.join(' | ')}`); await p.context().close();
  // ===== 4. controller on the title (mocked Xbox pad), phone landscape =====
  p = await newPage({ phone: true }); await p.addInitScript(MOCK); await openTitle(p, url);
  await p.S(id => window.__pad.connect(id), XB_ID); await p.waitForFunction(() => window.game.pad); await p.waitForTimeout(150);
  const tap = i => p.S(i => window.__pad.tap(i), i);
  await tap(B.down); pg = await page(p); c(pg.focus === 'm-campaign', `pad: D-pad down focuses Campaign (${pg.focus})`);
  await tap(B.down); pg = await page(p); c(pg.focus === 'm-skirmish', `D-pad down -> Skirmish (${pg.focus})`);
  await p.S(() => window.__pad.hold([0, 0.9, 0, 0], 120)); pg = await page(p); c(pg.focus === 'm-multiplayer', `left stick down -> Multiplayer (${pg.focus})`);
  if (shots) await shot(p, S_('pad-focus-844x390'));
  await tap(B.a); pg = await page(p); c(pg.page === 'setup' && pg.mode === 'multiplayer', 'A confirms -> Multiplayer clan select');
  await tap(B.b); pg = await page(p); c(pg.page === 'home', 'B goes back to the main menu');
  await tap(B.start); pg = await page(p); c(pg.page === 'settings', 'Start on the title opens Settings');
  for (let i = 0; i < 6 && (await page(p)).focus !== 'set-deadzone'; i++) await tap(B.down);
  const dz0 = await p.S(() => window.game.pad.settings.deadzone); await tap(B.right); const dz1 = await p.S(() => window.game.pad.settings.deadzone);
  c((await page(p)).focus === 'set-deadzone' && dz1 > dz0, `D-pad right on the deadzone slider raises it (${dz0} -> ${dz1})`); await tap(B.left);
  await tap(B.b); for (let i = 0; i < 6 && (await page(p)).focus !== 'm-skirmish'; i++) await tap(B.up); pg = await page(p); c(pg.page === 'home' && pg.focus === 'm-skirmish', `B back to home, D-pad to Skirmish (${pg.focus})`); await tap(B.a); pg = await page(p); c(pg.page === 'setup' && pg.mode === 'skirmish' && pg.focus === 'shiba', `A on Skirmish -> clan select, focus on Shiba (${pg.page}/${pg.mode}/${pg.focus})`);
  await tap(B.down); pg = await page(p); await tap(B.a); const picked = await p.inputValue('#menu #civ'); c(picked === pg.focus && picked !== 'shiba', `D-pad + A picks a clan (${picked})`);
  const path = []; for (let i = 0; i < 6 && (await page(p)).focus !== 'btn-ai'; i++) { const f = (await page(p)).focus; path.push(f); await tap(f === 'ai-civ' || f === 'civ' ? B.down : B.right); }
  pg = await page(p); c(pg.focus === 'btn-ai', `D-pad reaches Start Skirmish (${path.join(' > ')} > ${pg.focus})`); await tap(B.a); await p.waitForFunction(() => window.game.world);
  c(await p.S(() => window.game.world.players.player.civ) === picked, `A starts the skirmish as ${picked}`);
  c(!p.errors.length, `pad: no page errors ${p.errors.join(' | ')}`); await p.context().close();
  // ===== 5. Kibble shop in the Store with keyboard (desktop) and controller (phone), ?demo=1 so Buy stays simulated =====
  const toShop = async (p, step, ok, label) => { const path = []; for (let i = 0; i < 8; i++) { const f = (await page(p)).focus; path.push(f); if (f === 'stab:shop') break; await step(f); }
    await ok(); await p.waitForTimeout(150); const pg = await page(p); c(pg.page === 'store' && await p.S(() => document.querySelectorAll('#store-items [data-buy]').length) > 0, `${label}: reach the Kibble shop tab (${path.join(' > ')})`); };
  const buyKeepsFocus = async (p, move, ok, label) => { await move(); let pg = await page(p); const f0 = pg.focus; await ok(); await p.waitForTimeout(200); pg = await page(p); const m = await p.locator('#kb-shop-msg').innerText();
    c(/^buy:/.test(f0) && pg.focus === f0 && /Connect the \(simulated\) wallet first/.test(m), `${label}: Buy on ${f0} runs the existing flow (${m}) and focus stays on it (${pg.focus})`); };
  p = await newPage({}); await openTitle(p, url, q + 'demo=1'); await p.S(() => localStorage.removeItem('inu-empires-kibble-sim')); await p.reload(); await p.waitForFunction(() => window.game && window.game.menu);
  for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  await toShop(p, async f => p.keyboard.press(/^stab:/.test(f) ? 'ArrowRight' : 'ArrowDown'), () => p.keyboard.press('Enter'), 'keyboard');
  await buyKeepsFocus(p, () => p.keyboard.press('ArrowDown'), () => p.keyboard.press('Enter'), 'keyboard');
  c(!p.errors.length, `keyboard shop: no page errors ${p.errors.join(' | ')}`); await p.context().close();
  p = await newPage({ phone: true }); await p.addInitScript(MOCK); await openTitle(p, url, q + 'demo=1'); await p.S(() => localStorage.removeItem('inu-empires-kibble-sim')); await p.reload(); await p.waitForFunction(() => window.game && window.game.menu);
  await p.S(id => window.__pad.connect(id), XB_ID); await p.waitForFunction(() => window.game.pad); await p.waitForTimeout(150);
  { const tp = i => p.S(i => window.__pad.tap(i), i);
    for (let i = 0; i < 5 && (await page(p)).focus !== 'm-store'; i++) await tp(B.down); await tp(B.a); await p.waitForTimeout(150);
    await toShop(p, async f => tp(/^stab:/.test(f) ? B.right : B.down), () => tp(B.a), 'pad');
    await buyKeepsFocus(p, () => tp(B.down), () => tp(B.a), 'pad');
    await tp(B.b); c((await page(p)).page === 'home', 'pad: B leaves the Store'); }
  c(!p.errors.length, `pad shop: no page errors ${p.errors.join(' | ')}`); await p.context().close();
  await closeAll(); srv.close(); console.log(c.fails ? `MENU: ${c.fails} FAILED` : 'MENU: ALL PASSED');
  writeFileSync(join(ROOT, `proof/menu${tag ? '-' + tag : ''}.log`), c.lines.join('\n') + '\n'); return c.fails ? 1 : 0;
}
