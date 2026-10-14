import { screenToWorld, worldToScreen, createWorld, tick, TILE, pickAt, selectAt, selectionInfo, clampCamera, getSelected,
  selectedUnits, selectedBuilding, boxSelect, commandAt, trainVillager, popCount, popCap, RES_TYPES, COSTS, TRAIN_TIME, BUILD_MENU, BUILDING_DEFS, UNIT_DEFS, missingFor, trainUnit, research, ageUp, canAgeUp, canResearch, ageStatus, techsAt, TECHS, AGE_UPS, AGE_NAMES, isLocked, requiresText } from './sim.js';
import { render } from './render.js';
import * as SIM from './sim.js';
import { createUi, startPlacing, cancelPlacing, updateGhost, pointerDown, pointerMove, pointerUp } from './ui-state.js';
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const world = createWorld();
const cam = { x: 34 * TILE - innerWidth / 2, y: 34 * TILE - innerHeight / 2 };
const ui = createUi();
const keys = new Set(); addEventListener('blur', () => keys.clear());
let mouse = { x: -1, y: -1, inside: false }, drag = null;
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; clampCamera(cam, canvas.width, canvas.height, world); } resize(); addEventListener('resize', resize);
addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); if (e.key === 'Escape') cancelPlacing(ui); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('contextmenu', e => e.preventDefault());
const toWorld = (sx, sy) => screenToWorld(sx, sy, cam);
const refreshGhost = () => { const p = toWorld(mouse.x, mouse.y); updateGhost(ui, world, p.x, p.y); };
canvas.addEventListener('mousemove', e => { mouse = { x: e.clientX, y: e.clientY, inside: true };
  if (drag) { cam.x = drag.cx - (e.clientX - drag.x); cam.y = drag.cy - (e.clientY - drag.y); clampCamera(cam, canvas.width, canvas.height, world); }
  pointerMove(ui, e.clientX, e.clientY); refreshGhost(); });
canvas.addEventListener('mouseleave', () => { mouse.inside = false; drag = null; });
canvas.addEventListener('mousedown', e => {
  const p = toWorld(e.clientX, e.clientY);
  if (e.button === 1) { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; e.preventDefault(); return; }
  if (e.button === 0) { pointerDown(ui, e.clientX, e.clientY); return; }
  if (e.button === 2) { if (ui.placing) { cancelPlacing(ui); return; } commandAt(world, p.x, p.y); }
});
addEventListener('mouseup', e => {
  if (e.button === 1) drag = null;
  if (e.button === 0) pointerUp(ui, world, toWorld);
});
// ---- HUD / panels ----
const bannerEl = document.getElementById('banner'), hud = document.getElementById('hud'), infoEl = document.getElementById('info'), cmdEl = document.getElementById('commands'), msgEl = document.getElementById('msg');
let lastCmd = '';
cmdEl.addEventListener('click', e => { const btn = e.target.closest('button'); if (!btn || btn.disabled) return; const a = btn.dataset.action;
  if (a === 'train') trainUnit(world, selectedBuilding(world), 'villager');
  else if (a === 'age-up') ageUp(world, selectedBuilding(world));
  else if (a.startsWith('tech-')) research(world, selectedBuilding(world), a.slice(5));
  else if (UNIT_DEFS[a]) trainUnit(world, selectedBuilding(world), a);
  else if (BUILDING_DEFS[a]) { startPlacing(ui, a); refreshGhost(); } });
const costText = c => Object.entries(c).map(([r, v]) => `${v} ${r}`).join(', ');
function updateHud() {
  const pop = popCount(world), cap = popCap(world);
  hud.innerHTML = RES_TYPES.map(r => `<span id="res-${r}">${r[0].toUpperCase() + r.slice(1)}: ${world.stockpile[r]}</span>`).join('') +
    `<span id="pop" class="${pop >= cap ? 'capped' : ''}">Pop ${pop}/${cap}</span><span id="age">${AGE_NAMES[world.age]}</span>`;
  bannerEl.textContent = world.banner ? world.banner.text : ''; bannerEl.style.display = world.banner ? 'block' : 'none';
  msgEl.textContent = world.message ? world.message.text : ''; msgEl.style.display = world.message ? 'block' : 'none';
  const info = selectionInfo(world);
  infoEl.style.display = info ? 'block' : 'none';
  if (info) { infoEl.dataset.kind = info.kind; infoEl.innerHTML = `<b>${info.title}</b>` + info.lines.map(l => `<div>${l}</div>`).join('') +
    (info.progress != null ? `<div class="bar"><div style="width:${Math.round(info.progress * 100)}%"></div></div>` : '') +
    (info.queue ? `<div class="queue">${info.queueTypes.map(t => `<span class="qi" title="${t}">${t.startsWith('age:') ? 'A' : t.startsWith('tech:') ? 'T' : t === 'villager' ? 'V' : t === 'militia' ? 'M' : UNIT_DEFS[t].name[0]}</span>`).join('')}</div>` : ''); }
  const b = selectedBuilding(world), us = selectedUnits(world);
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
    cmd = parts.join('');
  } else if (us.some(u => u.type === 'villager')) cmd = BUILD_MENU.map(t => { const d = BUILDING_DEFS[t];
    if (isLocked(world, d.age)) return button(t, t === 'house' ? 'Build House' : d.name, requiresText(d.age), { disabled: true, title: `${d.name}: ${costText(d.cost)}` });
    const miss = missingFor(world, d.cost);
    return button(t, t === 'house' ? 'Build House' : d.name, miss || costText(d.cost), { disabled: !!miss, title: `${d.name} (${d.size}x${d.size}): ${costText(d.cost)}${t === 'farm' ? ', must touch a Mill or Town Center' : ''}` }); }).join('');
  if (cmd !== lastCmd) { cmdEl.innerHTML = cmd; lastCmd = cmd; } cmdEl.style.display = cmd ? 'flex' : 'none';
}
const PAN = 600, EDGE = 12; let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  let dx = 0, dy = 0;
  if (keys.has('a') || keys.has('arrowleft')) dx--; if (keys.has('d') || keys.has('arrowright')) dx++;
  if (keys.has('w') || keys.has('arrowup')) dy--; if (keys.has('s') || keys.has('arrowdown')) dy++;
  if (mouse.inside && !drag && !ui.press) { if (mouse.x < EDGE) dx--; if (mouse.x > innerWidth - EDGE) dx++; if (mouse.y < EDGE) dy--; if (mouse.y > innerHeight - EDGE) dy++; }
  if (dx || dy) { cam.x += dx * PAN * dt; cam.y += dy * PAN * dt; clampCamera(cam, canvas.width, canvas.height, world); }
  tick(world, dt); if (ui.placing) refreshGhost(); render(ctx, world, cam, ui); updateHud(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Automation hook: read-only state access + time advance (proof scripts must not use it to issue orders).
window.game = { sim: SIM, world, cam, ui, selectionInfo, pickAt, toScreen: (x, y) => worldToScreen(x, y, cam), toWorld,
  tick: (s, step = 0.05) => { for (let t = 0; t < s; t += step) tick(world, step); render(ctx, world, cam, ui); updateHud(); },
  // legacy helpers kept for compatibility with older scripts
  getSelected };
