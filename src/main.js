import { screenToWorld, worldToScreen, createWorld, TILE, pickAt, selectionInfo, clampCamera, getSelected,
  selectedUnits, selectedBuilding, popCount, popCap, RES_TYPES, BUILD_MENU, BUILDING_DEFS, UNIT_DEFS, missingFor, canAgeUp, canResearch, ageStatus, techsAt, TECHS, AGE_UPS, AGE_NAMES, isLocked, requiresText,
  stepTick, applyCommand, makeCommand, stateHash, TICK_DT, OWNERS, hyp } from './sim.js';
import { render, computeFog } from './render.js';
import * as SIM from './sim.js';
import { Lockstep } from './lockstep.js';
import { NetSession, TabsBus, RelayBus, defaultRelayUrl, newRoomCode } from './net.js';
import { createUi, startPlacing, cancelPlacing, updateGhost, pointerDown, pointerMove, pointerUp } from './ui-state.js';
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
let world = null, cam = { x: 0, y: 0 }, ui = createUi(), net = null, fog = null;
const keys = new Set(); addEventListener('blur', () => keys.clear());
let mouse = { x: -1, y: -1, inside: false }, drag = null;
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; if (world) clampCamera(cam, canvas.width, canvas.height, world); } resize(); addEventListener('resize', resize);
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; keys.add(e.key.toLowerCase()); if (e.key === 'Escape') cancelPlacing(ui); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('contextmenu', e => e.preventDefault());
const toWorld = (sx, sy) => screenToWorld(sx, sy, cam);
const viewer = () => (world && world.viewer) || 'player';
const isFoe = o => !!o.owner && o.owner !== viewer();
const seen = o => !fog || fog.sees(o);

// ---- commands: every gameplay action goes through here ----
// Single player applies the command at the current tick boundary (recorded for replay); multiplayer queues it in the
// lockstep scheduler, which executes it on both clients at tick + input delay.
function issue(type, args, valid = true) {
  if (!world) return null;
  if (!net) { const c = makeCommand(type, args, 0, world.tick); (world.commandLog ||= []).push(c); return applyCommand(world, c); }
  if (!valid) { world.message = { text: 'Cannot build there', until: world.time + 3 }; return null; }
  net.ls.queue(type, makeCommand(type, args).args); net.issued++; return undefined;
}

const refreshGhost = () => { if (!world) return; const p = toWorld(mouse.x, mouse.y); updateGhost(ui, world, p.x, p.y); };
canvas.addEventListener('mousemove', e => { mouse = { x: e.clientX, y: e.clientY, inside: true }; if (!world) return;
  if (drag) { cam.x = drag.cx - (e.clientX - drag.x); cam.y = drag.cy - (e.clientY - drag.y); clampCamera(cam, canvas.width, canvas.height, world); }
  pointerMove(ui, e.clientX, e.clientY); refreshGhost(); updateCursor(); });
// Attack cursor: crosshair when own units are selected and the pointer is over a visible enemy unit/building.
function hoverEnemy() { const p = toWorld(mouse.x, mouse.y);
  return world.units.find(o => isFoe(o) && seen(o) && hyp(o.x - p.x, o.y - p.y) < 0.7) || (() => { const b = SIM.buildingAt(world, p.x, p.y); return b && isFoe(b) && seen(b) ? b : null; })(); }
function updateCursor() { ui.cursor = !ui.placing && selectedUnits(world).length && hoverEnemy() ? 'attack' : 'default'; canvas.style.cursor = ui.cursor === 'attack' ? 'crosshair' : 'default'; }
canvas.addEventListener('mouseleave', () => { mouse.inside = false; drag = null; });
canvas.addEventListener('mousedown', e => {
  if (!world) return; const p = toWorld(e.clientX, e.clientY);
  if (e.button === 1) { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; e.preventDefault(); return; }
  if (e.button === 0) { pointerDown(ui, e.clientX, e.clientY); return; }
  if (e.button === 2) { if (ui.placing) { cancelPlacing(ui); return; } rightClick(p.x, p.y); }
});
function rightClick(x, y) {
  const b = selectedBuilding(world);
  if (b) { if (!isFoe(b) && b.trains.length && b.complete) { issue('rally', { id: b.id, x, y }); } return; }
  const us = selectedUnits(world); if (!us.length) return;
  issue('order', { ids: us.map(u => u.id), x, y });
  if (net) world.lastOrder = { kind: hoverEnemy() ? 'attack' : 'move', x, y, t: world.time };   // instant local feedback
}
addEventListener('mouseup', e => {
  if (e.button === 1) drag = null;
  if (e.button === 0 && world) { const r = pointerUp(ui, world, toWorld, issue);
    const s = world.selection; // fog: cannot select what you cannot see
    if (r && r.kind === 'select' && s && (s.kind === 'unit' || s.kind === 'building')) { const o = s.kind === 'unit' ? SIM.mobile(world, s.id) : world.buildings.find(q => q.id === s.id); if (o && !seen(o)) { world.selection = null; world.selected = null; } } }
});
// ---- HUD / panels ----
const bannerEl = $('banner'), hud = $('hud'), infoEl = $('info'), cmdEl = $('commands'), msgEl = $('msg'), netEl = $('net'), stallEl = $('stall'), desyncEl = $('desync');
let lastCmd = '';
cmdEl.addEventListener('click', e => { const btn = e.target.closest('button'); if (!btn || btn.disabled) return; const a = btn.dataset.action, b = selectedBuilding(world);
  if (a === 'train') issue('train', { id: b.id, unit: 'villager' });
  else if (a === 'age-up') issue('ageup', { id: b.id });
  else if (a === 'cancel') issue('cancel', { id: b.id });
  else if (a.startsWith('tech-')) issue('research', { id: b.id, tech: a.slice(5) });
  else if (UNIT_DEFS[a]) issue('train', { id: b.id, unit: a });
  else if (BUILDING_DEFS[a]) { startPlacing(ui, a); refreshGhost(); } });
const costText = c => Object.entries(c).map(([r, v]) => `${v} ${r}`).join(', ');
function updateHud() {
  const pop = popCount(world), cap = popCap(world);
  hud.innerHTML = RES_TYPES.map(r => `<span id="res-${r}">${r[0].toUpperCase() + r.slice(1)}: ${world.stockpile[r]}</span>`).join('') +
    `<span id="pop" class="${pop >= cap ? 'capped' : ''}">Pop ${pop}/${cap}</span>` + (net ? `<span id="side" class="${net.me ? 'p2' : 'p1'}">Player ${net.me + 1} (${net.me ? 'Red' : 'Blue'})</span>` : '') + `<span id="age">${AGE_NAMES[world.age]}</span>`;
  bannerEl.textContent = world.banner ? world.banner.text : ''; bannerEl.style.display = world.banner ? 'block' : 'none';
  msgEl.textContent = world.message ? world.message.text : ''; msgEl.style.display = world.message ? 'block' : 'none';
  const info = selectionInfo(world);
  infoEl.style.display = info ? 'block' : 'none';
  if (info) { infoEl.dataset.kind = info.kind; infoEl.innerHTML = `<b>${info.title}</b>` + info.lines.map(l => `<div>${l}</div>`).join('') +
    (info.hp != null ? `<div class="bar hp${info.enemy ? ' enemy' : ''}"><div style="width:${Math.round(Math.max(0, info.hp) * 100)}%"></div></div>` : '') +
    (info.progress != null ? `<div class="bar"><div style="width:${Math.round(info.progress * 100)}%"></div></div>` : '') +
    (info.queue ? `<div class="queue">${info.queueTypes.map(t => `<span class="qi" title="${t}">${t.startsWith('age:') ? 'A' : t.startsWith('tech:') ? 'T' : t === 'villager' ? 'V' : t === 'militia' ? 'M' : UNIT_DEFS[t].name[0]}</span>`).join('')}</div>` : ''); }
  const b = SIM.selectedOwnBuilding(world), us = selectedUnits(world);
  let cmd = '';
  const button = (action, label, sub, { disabled = false, grey = false, title = '' } = {}) =>
    `<button data-action="${action}" ${disabled ? 'disabled' : ''} class="${grey ? 'unaffordable' : ''}${ui.placing === action ? ' active' : ''}" title="${title}">${label}<br><small>${sub}</small></button>`;
  if (b && b.complete && (b.trains.length || techsAt(b.type).length)) {
    const parts = b.trains.map(t => { const d = UNIT_DEFS[t], up = Object.keys(world.researched).map(k => TECHS[k].effect.upgrade?.[t]).find(Boolean), shown = up ? UNIT_DEFS[up] : d;
      if (isLocked(world, d.age)) return button(t === 'villager' ? 'train' : t, `Train ${d.name}`, requiresText(d.age), { disabled: true, title: `${d.name}: ${costText(d.cost)}, ${d.time}s` });
      const miss = missingFor(world, shown.cost);
      return button(t === 'villager' ? 'train' : t, `Train ${shown.name}`, miss || `${costText(shown.cost)}, ${shown.time}s`, { grey: !!miss, title: `${shown.name}: HP ${shown.hp}, attack ${shown.attack}, armor ${shown.armor}` }); });
    for (const id of techsAt(b.type)) { const t = TECHS[id]; if (id in world.researched) continue;
      const c = canResearch(world, b, id); const queued = c.reason === 'queued';
      const sub = c.ok ? `${costText(t.cost)}, ${t.time}s` : c.reason === 'age' ? requiresText(t.age) : queued ? 'researching…' : c.reason === 'cost' ? c.text : c.text;
      parts.push(button('tech-' + id, t.name, sub, { disabled: !c.ok && c.reason !== 'cost', grey: c.reason === 'cost', title: `${t.desc}. ${costText(t.cost)}, ${t.time}s` })); }
    if (b.type === 'town_center') { const st = ageStatus(world);
      if (st.next) { const c = canAgeUp(world, b), up = AGE_UPS[st.next];
        const sub = `${costText(up.cost)}, ${up.time}s` + (c.ok ? '' : ` | ${c.reason === 'queued' ? 'researching…' : c.text}`);
        parts.push(button('age-up', `Advance to ${AGE_NAMES[st.next]}`, sub, { disabled: !c.ok && c.reason !== 'cost', grey: c.reason === 'cost', title: `${AGE_NAMES[st.next]}: ${costText(up.cost)}, ${up.time}s; ${st.missing || 'requirements met'}` })); } }
    if (b.queue.length) parts.push(button('cancel', 'Cancel last', `refund ${SIM.itemName(b.queue[b.queue.length - 1])}`, { title: 'Remove the last queued item and refund its cost' }));
    cmd = parts.join('');
  } else if (us.some(u => u.type === 'villager')) cmd = BUILD_MENU.map(t => { const d = BUILDING_DEFS[t];
    if (isLocked(world, d.age)) return button(t, t === 'house' ? 'Build House' : d.name, requiresText(d.age), { disabled: true, title: `${d.name}: ${costText(d.cost)}` });
    const miss = missingFor(world, d.cost);
    return button(t, t === 'house' ? 'Build House' : d.name, miss || costText(d.cost), { disabled: !!miss, title: `${d.name} (${d.size}x${d.size}): ${costText(d.cost)}${t === 'farm' ? ', must touch a Mill or Town Center' : ''}` }); }).join('');
  if (cmd !== lastCmd) { cmdEl.innerHTML = cmd; lastCmd = cmd; } cmdEl.style.display = cmd ? 'flex' : 'none';
  if (net) {
    const ping = net.session.rtt == null ? '…' : Math.round(net.session.rtt);
    netEl.style.display = 'block';
    netEl.innerHTML = `<span id="net-ping">Ping ${ping} ms</span> · <span id="net-delay">Delay ${net.ls.delay} ticks (${net.ls.delay * 50} ms)</span> · <span id="net-tick">Tick ${world.tick}</span> · <span id="net-sync">${net.ls.desync ? 'DESYNC' : `sync ✓ ${net.ls.checked}`}</span> · ${net.session.bus.kind === 'tabs' ? 'same-browser tabs' : 'relay'} · room ${net.session.code}`;
    const waiting = net.session.peerLost ? 'Opponent disconnected — waiting for them to return…' : net.stallMs > 250 ? `Waiting for opponent… (${(net.stallMs / 1000).toFixed(1)} s)` : '';
    stallEl.textContent = waiting; stallEl.style.display = waiting ? 'block' : 'none';
    if (net.ls.desync) { desyncEl.style.display = 'block'; desyncEl.textContent = `DESYNC detected at tick ${net.ls.desync.tick} (local ${net.ls.desync.local} ≠ remote ${net.ls.desync.remote})`; }
  }
}

// ---- game start ----
function startGame({ mp = false, seed = 1, me = 0, cfg = {}, session = null } = {}) {
  world = mp ? createWorld({ mp: true, seed }) : createWorld({ enemy: params.get('enemy') !== '0', raids: params.get('raids') === '1', scenario: params.get('scenario') });
  ui = createUi();
  if (mp) {
    world.viewer = OWNERS[me]; world.cur = world.viewer;
    const ls = new Lockstep({ me, delay: cfg.delay || 3, hashEvery: cfg.hashEvery || 20, send: m => session.send(m),
      onDesync: d => { console.error(`DESYNC at tick ${d.tick}: local ${d.local} remote ${d.remote}`); net.log.push(`desync tick ${d.tick} ${d.local} ${d.remote}`); } });
    net = { me, ls, session, speed: cfg.speed || 1, stallMs: 0, stalledTotalMs: 0, lastNeed: 0, issued: 0, log: [], hashes: [] };
    session.onGame = m => ls.receive(m);
    fog = { explored: new Uint8Array(world.width * world.height), seenBuildings: new Set() };
    window.game.net = net;
  }
  const tc = world.buildings.find(b => b.type === 'town_center' && b.owner === viewer());
  const c = mp ? { x: tc.x + 2, y: tc.y + 2 } : { x: 34, y: 34 };
  cam.x = c.x * TILE - innerWidth / 2; cam.y = c.y * TILE - innerHeight / 2; clampCamera(cam, canvas.width, canvas.height, world);
  Object.assign(window.game, { world, cam, ui, mode: mp ? 'mp' : 'sp' });
  for (const id of ['menu', 'lobby']) $(id).style.display = 'none';
  last = performance.now(); requestAnimationFrame(frame);
}
const PAN = 600, EDGE = 12; let last = performance.now(), acc = 0, running = false;
function frame(now) {
  if (!world) return;
  const real = Math.min(0.25, (now - last) / 1000); last = now; const dt = Math.min(0.1, real);
  let dx = 0, dy = 0;
  if (keys.has('a') || keys.has('arrowleft')) dx--; if (keys.has('d') || keys.has('arrowright')) dx++;
  if (keys.has('w') || keys.has('arrowup')) dy--; if (keys.has('s') || keys.has('arrowdown')) dy++;
  if (mouse.inside && !drag && !ui.press) { if (mouse.x < EDGE) dx--; if (mouse.x > innerWidth - EDGE) dx++; if (mouse.y < EDGE) dy--; if (mouse.y > innerHeight - EDGE) dy++; }
  if (dx || dy) { cam.x += dx * PAN * dt; cam.y += dy * PAN * dt; clampCamera(cam, canvas.width, canvas.height, world); }
  // fixed 20 Hz simulation ticks
  if (!net) { acc += dt; let n = 0; while (acc >= TICK_DT && n++ < 8) { stepTick(world); acc -= TICK_DT; } }
  else {
    acc += real * net.speed; let n = 0, stalled = false;
    while (acc >= TICK_DT && n < 12) {
      const cmds = net.ls.next(); if (!cmds) { stalled = true; break; }
      stepTick(world, cmds); acc -= TICK_DT; n++;
      const h = stateHash(world); if (world.tick % net.ls.hashEvery === 0) net.hashes.push([world.tick, h]); net.ls.hash(world.tick, h);
    }
    if (stalled) { acc = Math.min(acc, TICK_DT); net.stallMs += real * 1000; net.stalledTotalMs += real * 1000;
      if (net.stallMs > 1000 && now - net.lastNeed > 1000) { net.ls.requestMissing(); net.lastNeed = now; } }
    else if (n) net.stallMs = 0;
    fog = computeFog(world, viewer(), fog); window.game.fog = fog;
  }
  if (ui.placing) refreshGhost(); if (mouse.inside) updateCursor(); render(ctx, world, cam, ui, net ? fog : null); updateHud(); requestAnimationFrame(frame);
}
// Automation hook: read-only state access + time advance in single player (proof scripts must not use it to issue orders).
window.game = { sim: SIM, world: null, cam, ui, selectionInfo, pickAt, toScreen: (x, y) => worldToScreen(x, y, cam), toWorld,
  tick: (s) => { if (net) throw new Error('no fast-forward in multiplayer'); const n = Math.round(s / TICK_DT); for (let i = 0; i < n; i++) stepTick(world); render(ctx, world, cam, ui); updateHud(); },
  stateHash: () => world && stateHash(world),
  getSelected: () => getSelected(world) };

// ---- main menu / lobby ----
let session = null;
function showLobby() {
  const s = session; if (!s) return;
  $('menu').style.display = 'none'; $('lobby').style.display = 'flex';
  $('lobby-code').textContent = s.code;
  $('lobby-link').textContent = s.bus.kind === 'tabs' ? 'Open this site in a second tab of this browser, choose Join and enter the code.' : `Share the code; the other player picks Join with relay ${s.bus.url}`;
  const status = s.state === 'connecting' ? 'Connecting…' : s.state === 'error' ? `Error: ${s.error}` : s.error ? s.error : !s.peer ? 'Waiting for the other player to join…' : s.peerLost ? 'Other player disconnected' : 'Both players connected';
  $('lobby-status').textContent = status;
  const row = (n, you, ready, here) => `<div class="pl p${n}">Player ${n} (${n === 1 ? 'Blue, top-left' : 'Red, bottom-right'})${you ? ' — you' : ''}: ${here ? (ready ? '<b>Ready</b>' : 'not ready') : '<i>empty</i>'}</div>`;
  const peerHere = !!s.peer && !s.peerLost;
  $('lobby-players').innerHTML = s.role === 'host' ? row(1, true, s.ready, true) + row(2, false, s.peer?.ready, peerHere) : row(1, false, s.peer?.ready, peerHere) + row(2, true, s.ready, true);
  $('lobby-ping').textContent = s.rtt == null ? '' : `Ping ${Math.round(s.rtt)} ms`;
  $('btn-ready').disabled = !peerHere || s.state !== 'lobby'; $('btn-ready').textContent = s.ready ? 'Not ready' : 'Ready';
}
function openSession(role, code) {
  const transport = $('transport').value, relayUrl = $('relay-url').value.trim();
  const bus = transport === 'tabs' ? new TabsBus(code) : new RelayBus(relayUrl, code);
  session = new NetSession({ bus, role, code, onChange: () => { if (session.state !== 'playing') showLobby(); },
    onStart: cfg => startGame({ mp: true, seed: cfg.seed, me: session.me, cfg, session }) });
  session.startCfg = { speed: +(params.get('speed') || 1), delay: +(params.get('delay') || 3) };
  window.game.session = session; showLobby();
}
$('btn-sp').onclick = () => startGame();
$('btn-host').onclick = () => openSession('host', newRoomCode());
$('btn-join').onclick = () => { const code = $('join-code').value.trim().toUpperCase(); if (!/^[A-Z0-9]{3,8}$/.test(code)) { $('menu-err').textContent = 'Enter the room code shown to the host'; return; } openSession('guest', code); };
$('btn-ready').onclick = () => session.setReady(!session.ready);
$('btn-leave').onclick = () => { session.leave(); session = null; $('lobby').style.display = 'none'; $('menu').style.display = 'flex'; };
$('relay-url').value = defaultRelayUrl();
$('transport').value = params.get('net') || (params.get('relay') ? 'relay' : /vercel\.app$/.test(location.hostname) ? 'tabs' : 'relay');
const syncTransport = () => { $('relay-row').style.display = $('transport').value === 'relay' ? 'block' : 'none'; }; $('transport').onchange = syncTransport; syncTransport();
if (params.get('join')) $('join-code').value = params.get('join');
// Legacy / direct single-player URLs (?enemy=, ?scenario=, ?raids=, ?play=sp) skip the menu.
if (['enemy', 'scenario', 'raids'].some(k => params.has(k)) || params.get('play') === 'sp') startGame();
else $('menu').style.display = 'flex';
