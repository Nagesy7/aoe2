// Gamepad API controller support (PS5 DualSense / Xbox over Bluetooth or USB). Input only: every action calls back into
// main.js through the SAME functions the mouse uses (primaryDown/Up -> pointerUp -> issue(), secondary -> rightClick ->
// issue()), so single player records the command and multiplayer queues it in lockstep. Nothing here touches the sim.
// Lazy-loaded on the first `gamepadconnected` event. Button map (standard mapping) is documented in docs/FEATURES.md.
export const PAD_DEFAULTS = { deadzone: 0.18, cursor: 950, pan: 900, edge: 6 }; // cursor / pan speed in CSS px per second
const B = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 };
export const BUTTONS = B;
export function padKind(id = '') {
  if (/045e|xbox|xinput|x-box/i.test(id)) return 'xbox'; // first: "Xbox Wireless Controller" also says "wireless controller"
  if (/054c|playstation|dualsense|dualshock|wireless controller|ps[345]/i.test(id)) return 'ps';
  return 'generic';
}
export const GLYPHS = {
  ps: { a: '✕', b: '○', x: '□', y: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', start: 'Options', back: 'Create', ls: 'L-stick', rs: 'R-stick', dpad: 'D-pad', name: 'PlayStation controller' },
  xbox: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', start: 'Menu', back: 'View', ls: 'L-stick', rs: 'R-stick', dpad: 'D-pad', name: 'Xbox controller' },
};
GLYPHS.generic = { ...GLYPHS.xbox, name: 'Controller' };
// radial deadzone with rescale: |v| < dz -> 0, then 0..1 over the rest of the travel (no jump at the edge)
export function stick(x, y, dz) { const m = Math.hypot(x, y); if (m < dz || m === 0) return { x: 0, y: 0 }; const k = Math.min(1, (m - dz) / (1 - dz)) / m; return { x: x * k, y: y * k }; }
export const hints = g => [[g.a, 'select / command'], [g.x, 'command'], [g.b, 'cancel'], [`${g.lb}/${g.rb}`, 'idle pup / next unit'], [`${g.lt}/${g.rt}`, 'build & train'], [g.y, 'attack-move'], [g.start, 'menu']];
export function loadSettings(params) {
  let s = {}; try { s = JSON.parse(localStorage.getItem('inu-pad') || '{}'); } catch {}
  const q = params && parseFloat(params.get('padDeadzone')); const dz = Number.isFinite(q) ? q : Number.isFinite(s.deadzone) ? s.deadzone : PAD_DEFAULTS.deadzone;
  return { deadzone: Math.max(0.05, Math.min(0.45, dz)) };
}
// api (from main.js): inGame(), move(x,y), primaryDown(x,y), primaryUp(x,y), secondary(x,y), smartCommand(x,y) -> bool,
// cancel() -> bool, idle(), nextUnit(), army(), amove(), pan(dx,dy), focusables() -> [button], el(id), onFocusChange()
export function createGamepad(api, opts = {}) { const { params } = opts;
  const S = loadSettings(params);
  const st = { index: null, id: '', kind: 'generic', prev: [], cursor: { x: innerWidth / 2, y: innerHeight / 2 }, active: false, aDown: null, focus: -1, menu: false, menuIdx: 0,
    stats: { polls: 0, presses: {}, commands: 0, selects: 0, toasts: 0 } };
  // ---- DOM: cursor, toast, menu (pointer-events none on the cursor; menu is a small fixed panel) ----
  const css = document.createElement('style'); css.textContent = `#pad-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-2px 0 0 -2px;z-index:9999;pointer-events:none;display:none;filter:drop-shadow(0 1px 1px #000a)}
#pad-toast{position:fixed;top:calc(8px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:9999;max-width:min(96vw,620px);padding:6px 10px;border-radius:8px;background:#2a1c0cee;border:2px solid #d4a640;color:#f4e2b8;font:bold 12px sans-serif;text-align:center;pointer-events:none;transition:opacity .4s}
#pad-toast b{color:#ffd84a}#pad-toast .gl{display:inline-block;min-width:16px;padding:0 3px;margin:0 2px;border-radius:9px;background:#f4e2b8;color:#2a1c0c;font-size:11px}#pad-toast .h{display:inline-block;margin:2px 5px;white-space:nowrap;font-weight:normal}
.pad-focus{outline:3px solid #ffd84a!important;outline-offset:1px;box-shadow:0 0 10px #ffd84a}
#pad-menu{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;min-width:220px;padding:10px;border-radius:10px;background:#2a1c0cf2;border:2px solid #d4a640;color:#f4e2b8;font:bold 13px sans-serif;display:flex;flex-direction:column;gap:5px}
#pad-menu[hidden]{display:none}#pad-menu div{padding:6px 10px;border-radius:6px;border:1px solid #a07a3a}#pad-menu div.on{background:#5a3c18;border-color:#ffd84a;color:#ffd84a}#pad-menu small{font-weight:normal;opacity:.8;text-align:center}
@media (max-height:520px){#pad-toast{font-size:11px;padding:4px 8px;top:calc(46px + env(safe-area-inset-top))}#pad-menu{font-size:12px;gap:3px;padding:8px}#pad-menu div{padding:4px 8px}}`;
  document.head.appendChild(css);
  const cur = document.createElement('div'); cur.id = 'pad-cursor';
  cur.innerHTML = '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M2 2 L2 18 L7 13.5 L10.5 20.5 L13.5 19 L10 12 L17 12 Z" fill="#ffd84a" stroke="#2a1c0c" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const toast = document.createElement('div'); toast.id = 'pad-toast'; toast.style.opacity = '0'; toast.setAttribute('role', 'status');
  const menu = document.createElement('div'); menu.id = 'pad-menu'; menu.hidden = true; menu.setAttribute('role', 'menu');
  document.body.append(cur, toast, menu);
  let toastT = null;
  function showToast(connected = true) {
    const g = GLYPHS[st.kind]; st.stats.toasts++;
    toast.innerHTML = `🎮 <b>${connected ? `${g.name} connected` : `${g.name} disconnected`}</b>` + (connected ? '<br>' + hints(g).map(([k, v]) => `<span class="h"><span class="gl">${k}</span>${v}</span>`).join('') : '');
    toast.dataset.kind = st.kind; toast.style.opacity = '1'; clearTimeout(toastT); toastT = setTimeout(() => { toast.style.opacity = '0'; }, connected ? 6000 : 2500);
  }
  const MENU = () => [
    { t: 'Resume', go: () => openMenu(false) },
    { t: '✨ Sound & effects', go: () => { openMenu(false); api.el('fx-open')?.click(); } },
    { t: `Stick deadzone: ${S.deadzone.toFixed(2)}  ◀ ▶`, adj: d => { S.deadzone = Math.max(0.05, Math.min(0.45, +(S.deadzone + d * 0.02).toFixed(2))); try { localStorage.setItem('inu-pad', JSON.stringify(S)); } catch {} } },
    { t: '🎮 Button hints', go: () => { openMenu(false); showToast(true); } },
    ...(api.homeEl() ? [{ t: '🏠 Back to Inu Verse', go: () => { openMenu(false); api.homeEl().click(); } }] : []),
  ];
  function drawMenu() { const g = GLYPHS[st.kind]; menu.innerHTML = MENU().map((m, i) => `<div role="menuitem" class="${i === st.menuIdx ? 'on' : ''}">${m.t}</div>`).join('') + `<small>${g.dpad} move · ${g.a} choose · ${g.b} close</small>`; }
  function openMenu(on) { st.menu = on; menu.hidden = !on; if (on) { st.menuIdx = 0; drawMenu(); toast.style.opacity = '0'; } }
  function setFocus(i) { const fs = api.focusables(); for (const b of document.querySelectorAll('.pad-focus')) b.classList.remove('pad-focus');
    if (!fs.length || i < 0) { st.focus = -1; return; } st.focus = ((i % fs.length) + fs.length) % fs.length; fs[st.focus].classList.add('pad-focus'); fs[st.focus].scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }
  const focused = () => { const fs = api.focusables(); return st.focus >= 0 && fs[st.focus] && fs[st.focus].isConnected ? fs[st.focus] : null; };
  function showCursor(on) { st.active = on; cur.style.display = on ? 'block' : 'none'; }
  addEventListener('pointerdown', e => { if (e.isTrusted && st.active) showCursor(false); }, true); // mouse/touch take over: hide the pad cursor
  function pick() { const pads = navigator.getGamepads ? [...navigator.getGamepads()] : []; const p = (st.index != null && pads[st.index]) || pads.find(q => q && q.connected);
    if (p && (p.index !== st.index || p.id !== st.id)) { st.index = p.index; st.id = p.id; st.kind = padKind(p.id); } return p || null; }
  const pressed = (p, i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
  function poll(dt) {
    const p = pick(); if (!p) return; st.stats.polls++;
    const now = p.buttons.map((_, i) => pressed(p, i)), was = st.prev; st.prev = now;
    const down = i => now[i] && !was[i], up = i => !now[i] && was[i];
    const L = stick(p.axes[0] || 0, p.axes[1] || 0, S.deadzone), R = stick(p.axes[2] || 0, p.axes[3] || 0, S.deadzone);
    const any = L.x || L.y || R.x || R.y || now.some(Boolean); if (any && !st.active) showCursor(true);
    for (let i = 0; i < now.length; i++) if (down(i)) st.stats.presses[i] = (st.stats.presses[i] || 0) + 1;
    // menu captures everything while open
    if (st.menu) { const items = MENU();
      if (down(B.up)) st.menuIdx = (st.menuIdx + items.length - 1) % items.length; if (down(B.down)) st.menuIdx = (st.menuIdx + 1) % items.length;
      if ((down(B.left) || down(B.right)) && items[st.menuIdx].adj) items[st.menuIdx].adj(down(B.left) ? -1 : 1);
      if (down(B.a)) { const m = items[st.menuIdx]; m.go ? m.go() : m.adj?.(1); }
      if (down(B.b) || down(B.start)) openMenu(false); if (st.menu) drawMenu(); return; }
    // title / menus (src/menu.js): D-pad or left stick move focus, A confirms, B goes back, Start opens Settings
    if (!api.inGame()) { const m = api.menu && api.menu(); if (!m || !m.visible()) { st.prev = now; return; } showCursor(false);
      let dir = down(B.up) ? 'up' : down(B.down) ? 'down' : down(B.left) ? 'left' : down(B.right) ? 'right' : null;
      const sd = Math.abs(L.x) > Math.abs(L.y) ? (L.x > 0.5 ? 'right' : L.x < -0.5 ? 'left' : null) : (L.y > 0.5 ? 'down' : L.y < -0.5 ? 'up' : null);
      if (sd) { if (sd !== st.navDir) { st.navDir = sd; st.navT = 0.38; dir = dir || sd; } else if ((st.navT -= dt) <= 0) { st.navT = 0.16; dir = dir || sd; } } else st.navDir = null;
      if (dir) m.nav(dir); if (down(B.a)) m.ok(); if (down(B.b)) m.back(); if (down(B.start)) m.show('settings'); return; }
    if (down(B.start)) { openMenu(true); return; }
    const W = innerWidth, H = innerHeight, c = st.cursor;
    // left stick: cursor; pushing it into a screen edge pans the camera. Right stick + D-pad: camera pan.
    let px = 0, py = 0;
    if (L.x || L.y) { c.x += L.x * PAD_DEFAULTS.cursor * dt; c.y += L.y * PAD_DEFAULTS.cursor * dt;
      if (c.x <= PAD_DEFAULTS.edge && L.x < 0) px += L.x; if (c.x >= W - PAD_DEFAULTS.edge && L.x > 0) px += L.x; if (c.y <= PAD_DEFAULTS.edge && L.y < 0) py += L.y; if (c.y >= H - PAD_DEFAULTS.edge && L.y > 0) py += L.y;
      c.x = Math.max(0, Math.min(W - 1, c.x)); c.y = Math.max(0, Math.min(H - 1, c.y)); }
    px += R.x; py += R.y; if (now[B.left]) px--; if (now[B.right]) px++; if (now[B.up]) py--; if (now[B.down]) py++;
    if (px || py) api.pan(px * PAD_DEFAULTS.pan * dt, py * PAD_DEFAULTS.pan * dt);
    cur.style.transform = `translate(${Math.round(c.x)}px,${Math.round(c.y)}px)`;
    if (L.x || L.y || px || py) { api.move(c.x, c.y); if (L.x || L.y) setFocus(-1); }
    // LT/RT: step a highlight through the build / train buttons (opens the phone Build tab first); A presses it
    if (down(B.lt) || down(B.rt)) { api.openCommands(); const fs = api.focusables(); if (fs.length) setFocus(st.focus < 0 ? (down(B.rt) ? 0 : fs.length - 1) : st.focus + (down(B.rt) ? 1 : -1)); }
    // A: focused button -> click it; else smart: own units selected + target not one of ours -> context command, else select (hold + move = box)
    if (down(B.a)) { const f = focused();
      if (f) { f.click(); st.aDown = 'button'; }
      else if (api.smartCommand(c.x, c.y)) { api.secondary(c.x, c.y); st.stats.commands++; st.aDown = 'command'; }
      else { api.primaryDown(c.x, c.y); st.aDown = 'select'; } }
    if (st.aDown === 'select' && now[B.a]) api.move(c.x, c.y);
    if (up(B.a)) { if (st.aDown === 'select') { api.primaryUp(c.x, c.y); st.stats.selects++; } st.aDown = null; }
    if (down(B.x)) { api.secondary(c.x, c.y); st.stats.commands++; }
    if (down(B.b)) { if (focused()) setFocus(-1); else api.cancel(); }
    if (down(B.y)) api.amove();
    if (down(B.lb)) api.idle(); if (down(B.rb)) api.nextUnit(); if (down(B.back)) api.army();
  }
  addEventListener('gamepaddisconnected', e => { if (e.gamepad && e.gamepad.index === st.index) { st.index = null; st.prev = []; showCursor(false); setFocus(-1); openMenu(false); showToast(false); } });
  function connected(gp) { if (gp) { st.index = gp.index; st.id = gp.id; st.kind = padKind(gp.id); } else pick(); showToast(true); }
  // own frame loop (title and in-game alike); input only, the sim never sees it
  let lastT = 0; const loop = t => { const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0.016; lastT = t; try { poll(dt); } catch (e) { console.warn('controller poll', e); } requestAnimationFrame(loop); };
  if (typeof requestAnimationFrame === 'function' && !opts.manual) requestAnimationFrame(loop);
  return { poll, connected, showHints: () => showToast(true), settings: S, set(o) { if ('deadzone' in o) S.deadzone = Math.max(0.05, Math.min(0.45, +o.deadzone)); try { localStorage.setItem('inu-pad', JSON.stringify(S)); } catch {} return { ...S }; },
    stats: () => ({ ...st.stats, kind: st.kind, id: st.id, active: st.active, cursor: { x: Math.round(st.cursor.x), y: Math.round(st.cursor.y) }, focus: st.focus, menu: st.menu, deadzone: S.deadzone, toast: toast.style.opacity === '1' ? toast.textContent : '' }),
    cursor: st.cursor };
}
