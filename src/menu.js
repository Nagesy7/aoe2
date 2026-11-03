// Title menu (presentation only, never touches the sim): Campaign · Skirmish · Multiplayer · Store · Settings.
// Campaign / Skirmish / Multiplayer open the clan select (#pg-setup) with that mode's start panel; the start buttons are the
// existing ones (btn-sp / btn-ai / btn-host / btn-join), so the game starts through the same code as before.
// Store = cosmetics that exist in the code today (src/kibble.js, src/kennel.js, src/civs.js); no checkout here.
// Navigation: touch / mouse click, keyboard (arrows move focus, Enter/Space confirm, Esc/Backspace back),
// controller (D-pad / left stick move focus, A confirm, B back) via menu.nav / ok / back from src/gamepad.js.
import * as K from './kibble.js';
import * as KN from './kennel.js';
import { CIVS } from './civs.js';
const $ = id => document.getElementById(id);
const PAGES = ['home', 'setup', 'store', 'settings'];
const MODES = { campaign: { title: '📜 Campaign', step: 'Choose your clan, then a scenario' }, skirmish: { title: '⚔ Skirmish', step: 'Choose your clan and your opponent' },
  multiplayer: { title: '🌐 Multiplayer', step: 'Choose your clan, then host or join a 1v1' } };
const STAB_ICON = { tier: 'wallet', shop: 'cosmetics', kennel: 'effects' }; // pixel-art tab icons (art/menu, shown with body.menu-art)
const STORE_TABS = { tier: 'Free & tier unlocks', shop: '🦴 Kibble shop', kennel: 'Kennel rewards' }; // shop = the $KIBBLE panel's shop, moved here unchanged (src/kibble-ui.js renderShop)
// api: kibble() -> state, equip(id) -> bool, tier() -> kennel tier id|null, openKibble(tab), alive() -> {sound,fx,weather}, setAlive(k,v),
//      pad() -> gamepad instance|null, padSettings() -> {deadzone}, setDeadzone(v), onPage(page)
export function initMenu(api) {
  const menu = $('menu'), st = { page: 'home', mode: null, storeTab: 'tier', stack: [] };
  const shown = el => !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
  const kbOpen = () => $('kb')?.style.display === 'flex', lobbyOpen = () => shown($('lobby'));
  const visible = () => shown(menu) || lobbyOpen();
  // keyboard / controller focus ring (pointer input hides it again)
  const navMode = on => { for (const el of [menu, $('lobby'), $('kb')]) el?.classList.toggle('navkeys', on); };
  addEventListener('pointerdown', () => navMode(false), true);
  function show(page, mode = st.mode, { push = true } = {}) {
    if (push && page !== st.page) st.stack.push(st.page);
    st.page = page; if (mode) st.mode = mode; menu.dataset.page = page; if (page === 'setup') menu.dataset.mode = st.mode;
    for (const p of PAGES) $('pg-' + p).hidden = p !== page;
    if (page === 'home') st.stack = [];
    if (page === 'setup') { $('setup-title').textContent = MODES[st.mode].title; $('setup-step').textContent = MODES[st.mode].step;
      for (const el of document.querySelectorAll('#pg-setup .mode')) el.hidden = el.dataset.mode !== st.mode; $('menu-err').textContent = ''; }
    if (page === 'store') renderStore(); if (page === 'settings') renderSettings();
    menu.scrollTop = 0; api.onPage?.(page, st.mode);
    requestAnimationFrame(() => focusFirst()); }
  function back() { if (kbOpen()) { $('kb-close').click(); requestAnimationFrame(() => focusFirst()); return true; }
    if (lobbyOpen()) { $('btn-leave').click(); requestAnimationFrame(() => focusFirst()); return true; }
    if (st.page === 'home') return false; show(st.stack.pop() || 'home', st.mode, { push: false }); return true; }
  for (const b of document.querySelectorAll('#menu [data-go]')) b.addEventListener('click', () => { const [page, mode] = b.dataset.go.split(':'); show(page, mode); });
  for (const b of document.querySelectorAll('#menu .mback')) b.addEventListener('click', () => back());
  // ---- focus / spatial navigation (keyboard + controller) ----
  const focusables = () => { const root = kbOpen() ? $('kb') : lobbyOpen() ? $('lobby') : $('pg-' + st.page);
    return [...root.querySelectorAll('button, select, input, a[href], [tabindex="0"]')].filter(e => !e.disabled && e.offsetParent !== null && !e.closest('[hidden]')); };
  // first focus on a page: the first main entry on home, the picked clan card on the clan select, else the first control
  const prefer = f => (kbOpen() || lobbyOpen() ? null : st.page === 'home' ? f.find(e => e.classList.contains('mnav')) : st.page === 'setup' ? f.find(e => e.classList.contains('civ-card') && e.classList.contains('sel')) : null) || f[0];
  function focusFirst() { if (!visible() || !(st.kbd || st.pad)) return; const pick = prefer(focusables()); if (pick && document.activeElement !== pick) { pick.focus({ preventScroll: false }); navMode(true); } }
  function nav(dir) { navMode(true); const f = focusables(); if (!f.length) return; const a = document.activeElement;
    if (!f.includes(a)) { prefer(f).focus(); return; }
    const r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    let best = null, bd = Infinity;
    for (const e of f) { if (e === a) continue; const q = e.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy, along = dx * v[0] + dy * v[1];
      if (along <= 2) continue; const across = Math.abs(dx * v[1] + dy * v[0]), d = along + across * 2.5; if (d < bd) { bd = d; best = e; } }
    if (!best) { const i = f.indexOf(a), step = dir === 'down' || dir === 'right' ? 1 : -1; best = f[(i + step + f.length) % f.length]; }
    best.focus(); best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }
  // controller A: buttons click; checkbox toggles; select steps forward; range nudges up
  function ok() { const a = document.activeElement; st.pad = true; if (!a || !visible() && !kbOpen()) return false; navMode(true);
    const f = focusables(); if (!f.includes(a)) { const q = prefer(f); q?.focus(); return !!q; }
    if (a.tagName === 'SELECT') { adjust(1); return true; }
    if (a.tagName === 'INPUT' && a.type === 'range') { adjust(1); return true; }
    if (a.tagName === 'INPUT' && a.type !== 'checkbox') return true; // text: the on-screen keyboard is the player's
    a.click(); return true; }
  function adjust(d) { const a = document.activeElement; if (!a) return false;
    if (a.tagName === 'SELECT') { a.selectedIndex = (a.selectedIndex + d + a.options.length) % a.options.length; a.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    if (a.tagName === 'INPUT' && a.type === 'range') { const s = +a.step || 1; a.value = String(Math.min(+a.max, Math.max(+a.min, +a.value + d * s))); a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    return false; }
  // padNav: left/right on a select or slider change it; elsewhere they move focus
  function padNav(dir) { st.pad = true; const a = document.activeElement; if ((dir === 'left' || dir === 'right') && a && (a.tagName === 'SELECT' || a.type === 'range')) { adjust(dir === 'right' ? 1 : -1); return; } nav(dir); }
  addEventListener('keydown', e => { if (!visible() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return; const a = document.activeElement, typing = a && (a.tagName === 'INPUT' && a.type !== 'checkbox' && a.type !== 'range' || a.tagName === 'TEXTAREA');
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') st.kbd = true;
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
    // selects and sliders: left / right change the value, up / down move focus (same as the controller)
    if (dir && !typing) { st.kbd = true; e.preventDefault(); if ((dir === 'left' || dir === 'right') && a && (a.tagName === 'SELECT' || a.type === 'range')) adjust(dir === 'right' ? 1 : -1); else nav(dir); return; }
    if ((e.key === 'Escape' || e.key === 'Backspace' && !typing)) { if (back()) e.preventDefault(); } });
  // ---- Store (cosmetics only; nothing here changes stats, resources, build speed or prize odds) ----
  function storeItems(tab) { const s = api.kibble(), tierId = K.tier(s).id;
    if (tab === 'tier') return Object.entries(K.COSMETICS).filter(([, c]) => !c.price).map(([id, c]) => { const can = K.canUse(s, id), on = s.equipped[c.kind] === id;
      return { id, name: c.name, kind: c.kind, status: on ? 'Equipped' : can ? 'Unlocked' : `Unlocks at ${K.TIERS.find(t => t.id === c.tier)?.name || c.tier} tier`, action: can && !on ? 'equip' : null, on }; });
    if (tab === 'kennel') { const t = api.tier(); return Object.entries(KN.COSMETICS).map(([id, c]) => { const un = c.flair ? false : t != null && KN.rankOf(t) >= KN.rankOf(c.tier);
      return { id, name: c.name, kind: KN.SLOT_NAMES[c.slot] || c.slot, desc: c.desc, status: un ? 'Unlocked' : c.flair ? 'Optional lock flair' : `${KN.tierById(c.tier)?.name || c.tier} hold streak`, action: null, on: false }; }); }
    return K.SHOP.map(id => { const c = K.COSMETICS[id], own = s.owned.includes(id), on = c.kind !== 'civ' && s.equipped[c.kind] === id;
      return { id, name: c.name, kind: c.kind === 'civ' ? 'clan shield finish' : c.kind, status: on ? 'Equipped' : own ? 'Owned' : 'Coming soon to the Store', action: own && c.kind !== 'civ' && !on && K.canUse(s, id) ? 'equip' : null, on, soon: !own }; }); }
  function renderStore() { const tabs = Object.entries(STORE_TABS).map(([k, l]) => `<button type="button" class="stab${k === st.storeTab ? ' on' : ''}" data-stab="${k}"><img class="ti" src="art/menu/icon-${STAB_ICON[k]}-64.webp" width="32" height="32" alt="" loading="lazy">${l}</button>`).join('');
    const items = storeItems(st.storeTab).map(i => `<div class="sitem${i.on ? ' on' : ''}${i.soon ? ' soon' : ''}" data-item="${i.id}"><b>${i.name}</b><small>${i.kind}${i.desc ? ' · ' + i.desc : ''}</small><span class="sst">${i.status}</span>${i.action ? `<button type="button" data-equip="${i.id}">Equip</button>` : ''}</div>`).join('');
    const foot = st.storeTab === 'kennel' ? `<button type="button" id="store-kennel">🐾 Open my Kibble Kennel</button>` : st.storeTab === 'tier' ? `<span class="hint">Tiers come from holding $KIBBLE in a connected wallet (Settings ▸ Wallet).</span>` : `<span class="hint">Buying skins in this Store: coming soon.</span>`;
    const grid = $('store-items'); $('store-tabs').innerHTML = tabs; grid.dataset.shop = st.storeTab === 'shop' ? '1' : '';
    if (st.storeTab === 'shop') api.renderShop(grid, $('store-foot')); else { grid.innerHTML = items; $('store-foot').innerHTML = foot; } }
  $('pg-store').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.stab) { st.storeTab = b.dataset.stab; renderStore(); requestAnimationFrame(() => $('pg-store').querySelector(`[data-stab=${st.storeTab}]`)?.focus()); }
    else if (b.dataset.equip) { api.equip(b.dataset.equip); renderStore(); }
    else if (b.id === 'store-kennel') api.openKibble('kennel');
    else if (st.storeTab === 'shop' && b.closest('#store-items')) { const id = b.dataset.buy || b.dataset.eq, kb = st.kbd || st.pad; api.shopClick(e); // the original buy / equip handler
      // the grid re-renders: keep keyboard / controller focus on the same item
      if (id && kb) requestAnimationFrame(() => { const n = $('store-items').querySelector(`[data-buy="${id}"],[data-eq="${id}"]`); if (n && document.activeElement !== n) n.focus(); }); } });
  // the $KIBBLE panel's "Kibble shop ▸ Store" link
  addEventListener('empires:store', e => { st.storeTab = e.detail?.tab || 'shop'; show('store'); });
  // ---- Settings (only settings that already exist) ----
  function renderSettings() { const a = api.alive(), dz = api.padSettings().deadzone;
    $('set-sound').checked = a.sound; $('set-fx').checked = a.fx; $('set-weather').checked = a.weather;
    $('set-deadzone').value = String(dz); $('set-dz-val').textContent = dz.toFixed(2);
    const p = api.pad(); $('set-pad-status').textContent = p ? `${p.stats().kind === 'ps' ? 'PlayStation' : p.stats().kind === 'xbox' ? 'Xbox' : 'A'} controller connected` : 'No controller connected (press any button on a paired pad)';
    import('./gamepad.js').then(m => { const row = k => `<tr><th>${m.GLYPHS.xbox[k] ?? k}</th><th>${m.GLYPHS.ps[k] ?? k}</th>`;
      $('set-hints').innerHTML = `<tr><th>Xbox</th><th>PS</th><th></th></tr>` + [['ls', 'Move cursor (edge pans) · menus: move'], ['rs', 'Pan camera'], ['dpad', 'Pan camera · menus: move'], ['a', 'Select / command · menus: confirm'], ['x', 'Command (right-click)'], ['b', 'Cancel / deselect · menus: back'],
        ['y', 'Attack-move'], ['lb', 'Next idle pup'], ['rb', 'Next military unit'], ['lt', 'Build & train buttons (back)'], ['rt', 'Build & train buttons (next)'], ['back', 'Select army'], ['start', 'Game menu']].map(([k, d]) => `${row(k)}<td>${d}</td></tr>`).join(''); }).catch(() => {}); }
  for (const k of ['sound', 'fx', 'weather']) $('set-' + k).addEventListener('change', e => api.setAlive(k, e.target.checked));
  $('set-deadzone').addEventListener('input', e => { const v = +e.target.value; api.setDeadzone(v); $('set-dz-val').textContent = v.toFixed(2); });
  $('set-kibble').addEventListener('click', () => api.openKibble('wallet'));
  $('set-hints-show').addEventListener('click', () => { const p = api.pad(); if (p && p.showHints) p.showHints(); else $('set-pad-status').textContent = 'Connect a controller to see its on-screen hints'; });
  const M = { show, back, nav: padNav, ok, adjust, state: st, focusables, get page() { return st.page; }, visible };
  show('home', null, { push: false }); return M;
}
