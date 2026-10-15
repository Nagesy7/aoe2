import { unitAction } from './anim.js';
import { CIV_LOOK } from './civs.js';
import { drawUnitArt, drawBuildingArt } from './art.js';
const ART_B = new WeakSet();
import { drawTerrain } from './terrain.js';
import { drawInu, paw, TEAM } from './inu.js';
import { TILE, camPixel, selectedUnits, itemTime, unitStats } from './sim.js';
// Per-player fog of war (multiplayer): what the viewer's own units and buildings currently see, plus explored memory.
// Purely presentational: computed from the (identical) world on each client, never fed back into the simulation.
const VIS_BUILDING = { town_center: 8, watch_tower: 8, castle: 9 };
export function computeFog(world, viewer, prev = null) {
  const W = world.width, H = world.height, visible = new Uint8Array(W * H);
  const explored = prev && prev.explored && prev.explored.length === W * H ? prev.explored : new Uint8Array(W * H);
  const seenBuildings = prev && prev.seenBuildings || new Set();
  const reveal = (cx, cy, r) => { const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.floor(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.floor(cx + r)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) { visible[y * W + x] = 1; explored[y * W + x] = 1; } } };
  for (const u of world.units) if (u.owner === viewer) reveal(u.x, u.y, u.type === 'villager' ? 4 : unitStats(world, u).los);
  for (const a of world.animals) if (a.owner === viewer) reveal(a.x, a.y, 2);
  for (const b of world.buildings) if (b.owner === viewer) reveal(b.x + b.size / 2, b.y + b.size / 2, VIS_BUILDING[b.type] || (b.complete ? 4 : 2) + b.size / 2);
  const tileVis = (x, y) => x >= 0 && y >= 0 && x < W && y < H && visible[Math.floor(y) * W + Math.floor(x)] === 1;
  const sees = o => { if (!o.owner || o.owner === viewer) return true;
    if (o.size) { for (let y = o.y; y < o.y + o.size; y++) for (let x = o.x; x < o.x + o.size; x++) if (tileVis(x, y)) return true; return false; }
    return tileVis(o.x, o.y); };
  for (const b of world.buildings) if (b.owner !== viewer && sees(b)) seenBuildings.add(b.id);
  return { visible, explored, seenBuildings, sees, viewer };
}
const GENERIC = { archery_range: ['#7a5a3a', '#3a6a2a'], stable: ['#7a5a3a', '#6a4a20'], blacksmith: ['#5a4a40', '#2a2a2a'], market: ['#9a7a4a', '#c0a020'],
  watch_tower: ['#8a8a80', '#5a3a2a'], castle: ['#8a8a80', '#4a4a4a'], monastery: ['#d0c8b0', '#8a2a2a'], university: ['#b0a080', '#3a4a8a'], wonder: ['#e0d0a0', '#d4a640'] };
const UNIT_STYLE = { spearman: ['#7a3a1a', 'S'], archer: ['#3a7a2a', 'A'], crossbowman: ['#2a5a2a', 'C'], scout_cavalry: ['#a07040', 'Sc'], knight: ['#606080', 'K'], monk: ['#d0c060', 'Mo'], trebuchet: ['#5a4020', 'T'] };
const GRASS = ['#4a7a2c', '#4f8030', '#457228', '#538634'];
function bar(ctx, x, y, w, frac, col = '#4fd34f') { ctx.fillStyle = '#000a'; ctx.fillRect(x, y, w, 6); ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, frac)), 4); }
export function render(ctx, world, cam, ui = {}, fog = null) {
  const me = world.viewer || 'player', foe = o => !!o.owner && o.owner !== me, red = o => o.owner === 'enemy';
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
  const c = camPixel(cam);
  ctx.save(); ctx.translate(-c.x, -c.y);
  const x0 = Math.max(0, Math.floor(c.x / TILE)), y0 = Math.max(0, Math.floor(c.y / TILE));
  const x1 = Math.min(world.width, Math.ceil((c.x + W) / TILE)), y1 = Math.min(world.height, Math.ceil((c.y + H) / TILE));
  if (typeof document !== 'undefined' && x1 > x0 && y1 > y0) drawTerrain(ctx, world, TILE, x0, y0, x1, y1);
  else for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { ctx.fillStyle = GRASS[world.tiles[y * world.width + x]]; ctx.fillRect(x * TILE, y * TILE, TILE, TILE); }
  const sel = world.selection, selUnits = new Set(selectedUnits(world).map(u => u.id));
  if (sel && sel.kind === 'tile') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(sel.x * TILE + 1, sel.y * TILE + 1, TILE - 2, TILE - 2); ctx.lineWidth = 1; }
  const D = []; // depth-sorted by bottom y
  for (const b of world.buildings) D.push([(b.y + b.size) * TILE, () => {
    if (fog && foe(b) && !fog.sees(b) && !fog.seenBuildings.has(b.id)) return;
    const px = b.x * TILE, py = b.y * TILE, s = b.size * TILE;
    if (!b.complete) {
      ctx.fillStyle = '#c8a86a88'; ctx.fillRect(px, py, s, s); ctx.strokeStyle = '#6b4a20'; ctx.setLineDash([4, 3]); ctx.strokeRect(px + 1, py + 1, s - 2, s - 2); ctx.setLineDash([]);
      const f = b.progress / b.buildTime; ctx.fillStyle = '#8b6b43'; ctx.fillRect(px + 4, py + s - 4 - (s - 8) * f, s - 8, (s - 8) * f);
      bar(ctx, px, py - 9, s, f, '#e8c040');
    } else if (drawBuildingArt(ctx, b, b.owner ? (TEAM[b.owner] || TEAM.player) : null) && ART_B.add(b)) {
      if (b.queue && b.queue.length) bar(ctx, px, py - 18, s, b.trainProgress / itemTime(b.queue[0], world, b), b.blocked ? '#d33' : '#4fd34f');
    } else if (b.type === 'farm') {
      const n = world.resources.find(r => r.farm === b.id), f = n ? n.amount / 175 : 0;
      ctx.fillStyle = '#7a5a2a'; ctx.fillRect(px, py, s, s); ctx.fillStyle = `rgb(${150 + 60 * f | 0},${130 + 70 * f | 0},40)`;
      for (let i = 0; i < 6; i++) ctx.fillRect(px + 3, py + 3 + i * 15, s - 6, 8);
      ctx.strokeStyle = '#4a3010'; ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
    } else if (b.type === 'lumber_camp' || b.type === 'mining_camp' || b.type === 'mill') {
      ctx.fillStyle = '#8b6b43'; ctx.fillRect(px + 3, py + 14, s - 6, s - 16);
      ctx.fillStyle = b.type === 'lumber_camp' ? '#2d5a1d' : b.type === 'mining_camp' ? '#6a6a6a' : '#b89030';
      ctx.beginPath(); ctx.moveTo(px, py + 16); ctx.lineTo(px + s / 2, py + 2); ctx.lineTo(px + s, py + 16); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.type === 'lumber_camp' ? 'TIMBER' : b.type === 'mining_camp' ? 'DIG' : 'GRANARY', px + s / 2, py + s - 8);
      if (b.type === 'mill') { ctx.strokeStyle = '#eee'; ctx.lineWidth = 2; const cx = px + s / 2, cy = py + 10; ctx.beginPath(); ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx + 9, cy + 9); ctx.moveTo(cx + 9, cy - 9); ctx.lineTo(cx - 9, cy + 9); ctx.stroke(); ctx.lineWidth = 1; }
    } else if (b.type === 'barracks') {
      ctx.fillStyle = '#6a4a3a'; ctx.fillRect(px + 2, py + 18, s - 4, s - 20); ctx.fillStyle = '#3a2a2a'; ctx.fillRect(px - 2, py + 10, s + 4, 12);
      ctx.fillStyle = '#c02020'; ctx.fillRect(px + s / 2 - 1, py - 8, 2, 20); ctx.fillRect(px + s / 2 + 1, py - 8, 12, 8);
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.name, px + s / 2, py + s + 14);
      if (b.queue.length) bar(ctx, px, py - 18, s, b.trainProgress / itemTime(b.queue[0], world, b), b.blocked ? '#d33' : '#4fd34f');
    } else if (GENERIC[b.type]) {
      const [wall, roof] = GENERIC[b.type];
      ctx.fillStyle = wall; ctx.fillRect(px + 2, py + Math.min(16, s * 0.4), s - 4, s - Math.min(16, s * 0.4) - 2);
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(px - 2, py + Math.min(18, s * 0.45)); ctx.lineTo(px + s / 2, py); ctx.lineTo(px + s + 2, py + Math.min(18, s * 0.45)); ctx.fill();
      if (b.type === 'castle' || b.type === 'watch_tower') { ctx.fillStyle = '#5a5a5a'; for (let i = 0; i < b.size * 2; i++) if (i % 2 === 0) ctx.fillRect(px + i * TILE / 2, py + 10, TILE / 2, 6); }
      ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.name, px + s / 2, py + s + 13);
      if (b.queue.length) bar(ctx, px, py - 10, s, b.trainProgress / itemTime(b.queue[0], world, b), b.blocked ? '#d33' : '#4fd34f');
    } else if (b.type === 'house') {
      ctx.fillStyle = '#9b7b53'; ctx.fillRect(px + 4, py + 16, s - 8, s - 18);
      ctx.fillStyle = '#7a2a1a'; ctx.beginPath(); ctx.moveTo(px, py + 18); ctx.lineTo(px + s / 2, py + 2); ctx.lineTo(px + s, py + 18); ctx.fill();
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(px + s / 2 - 5, py + s - 16, 10, 14);
    } else {
      ctx.fillStyle = '#8b6b43'; ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#a33'; ctx.beginPath(); ctx.moveTo(px - 6, py + s * 0.45); ctx.lineTo(px + s / 2, py - 10); ctx.lineTo(px + s + 6, py + s * 0.45); ctx.fill();
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(px + s / 2 - 10, py + s - 28, 20, 28);
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.name, px + s / 2, py + s + 14);
      if (b.queue.length) bar(ctx, px, py - 18, s, b.trainProgress / itemTime(b.queue[0], world, b), b.blocked ? '#d33' : '#4fd34f');
    }
    if (b.complete && b.type !== 'farm' && b.owner && !ART_B.has(b)) { const tc = TEAM[b.owner] || TEAM.player; ctx.fillStyle = '#4a3018'; ctx.fillRect(px + s - 8, py - 14, 2, 20); ctx.fillStyle = tc; ctx.fillRect(px + s - 6, py - 14, 13, 10); paw(ctx, px + s + 0.5, py - 9, 4.5, '#f6e6c8'); }
    if (red(b)) { ctx.fillStyle = '#c02020'; ctx.fillRect(px + 2, py + 2, 4, 14); ctx.fillRect(px + 6, py + 2, 9, 6); ctx.strokeStyle = '#e04040'; ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1); }
    if (b.complete && (b.hp < b.maxHp || foe(b) || (sel && sel.kind === 'building' && sel.id === b.id))) bar(ctx, px, py - (b.queue.length ? 26 : 9), s, b.hp / b.maxHp, red(b) ? '#e04040' : '#4fd34f');
    if (sel && sel.kind === 'building' && sel.id === b.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px - 3, py - 3, s + 6, s + 6); ctx.lineWidth = 1;
      if (b.rally) { const rx = b.rally.x * TILE, ry = b.rally.y * TILE; ctx.strokeStyle = '#fff8'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(px + s / 2, py + s / 2); ctx.lineTo(rx, ry); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(rx - 1, ry - 20, 2, 20); ctx.fillStyle = '#2a50c8'; ctx.fillRect(rx + 1, ry - 20, 12, 8); } }
  }]);
  for (const n of world.resources) D.push([n.y * TILE + 10, () => {
    if (n.amount <= 0) return;
    const px = n.x * TILE, py = n.y * TILE;
    if (sel && sel.kind === 'resource' && sel.id === n.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, py + 8, 15, 7, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    if (n.res === 'wood') { ctx.fillStyle = '#5a3a1a'; ctx.fillRect(px - 3, py, 6, 12); ctx.fillStyle = '#1f5a1f'; ctx.beginPath(); ctx.arc(px, py - 4, 12, 0, 7); ctx.fill(); }
    else if (n.kind === 'farm') {}
    else if (n.kind === 'carcass') { ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.ellipse(px, py + 4, 10, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#a02020'; ctx.beginPath(); ctx.ellipse(px + 2, py + 5, 5, 3, 0, 0, 7); ctx.fill();
      bar(ctx, px - 12, py - 10, 24, n.amount / 100, '#e0a040'); }
    else if (n.res === 'food') { ctx.fillStyle = '#2d6b2d'; ctx.beginPath(); ctx.arc(px, py, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#c0203a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(px - 6 + (i * 5) % 13, py - 5 + (i * 7) % 11, 2.5, 0, 7); ctx.fill(); } }
    else { ctx.fillStyle = n.res === 'gold' ? '#e0b83a' : '#9a9a9a'; ctx.beginPath(); ctx.moveTo(px - 13, py + 9); ctx.lineTo(px - 4, py - 11); ctx.lineTo(px + 6, py - 6); ctx.lineTo(px + 13, py + 9); ctx.fill(); ctx.strokeStyle = '#333'; ctx.stroke(); }
  }]);
  for (const a of world.animals) D.push([a.y * TILE + 6, () => { if (fog && !fog.visible[Math.floor(a.y) * world.width + Math.floor(a.x)]) return; const px = a.x * TILE, py = a.y * TILE;
    if (selUnits.has(a.id) || (sel && sel.kind === 'unit' && sel.id === a.id)) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, py + 5, 11, 6, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    ctx.fillStyle = '#f4f0e6'; ctx.beginPath(); ctx.ellipse(px, py, 9, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(px + 8, py - 2, 3.5, 0, 7); ctx.fill();
    if (a.owner) { ctx.fillStyle = red(a) ? '#c02020' : '#2a50c8'; ctx.fillRect(px + 4, py - 6, 3, 8); } }]);
  for (const u of [...world.units.filter(o => o.state !== 'garrisoned'), ...dyingUnits(world)]) D.push([u.y * TILE + 6, () => {
    if (fog && foe(u) && !fog.sees(u)) return;
    const px = u.x * TILE, py = u.y * TILE;
    if (u.type !== 'villager' || red(u)) { ctx.fillStyle = red(u) ? '#ff2020d0' : '#3060ffb0'; ctx.beginPath(); ctx.ellipse(px, py + 6, 10, 5, 0, 0, 7); ctx.fill(); }
    if (u.type !== 'villager' || u.hp < u.maxHp || selUnits.has(u.id)) bar(ctx, px - 11, py - 30, 22, u.hp / u.maxHp, red(u) ? '#e04040' : '#4fd34f');
    if (u.lastAttackAt != null && world.time - u.lastAttackAt < 0.25 && !UNIT_STYLE[u.type]?.ranged) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px + (u.face ? u.face[0] : 1) * 10, py + (u.face ? u.face[1] : 0) * 10, 5, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    if (selUnits.has(u.id)) {
      if (u.path.length) { ctx.strokeStyle = '#ffffffaa'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(px, py); for (const q of u.path) ctx.lineTo(q.x * TILE, q.y * TILE); ctx.stroke(); ctx.setLineDash([]); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, py + 6, 11, 6, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    { let res = null, kind = null; if (u.type === 'villager' && u.target != null && !u.carry.amount) { const n = world.resources.find(r => r.id === u.target); if (n) { res = n.res; kind = n.kind; } }
      const act = unitAction(u, world, world.time || 0); // villagers: sprite sheet only for hammer work (build/repair) and death; otherwise procedural with the right tool
      if (u.type === 'villager' && act.tool !== 'hammer' && act.action !== 'death') drawInu(ctx, u, px, py, world.time || 0, { res, kind, act, attacking: act.action === 'attack' });
      else if (!drawUnitArt(ctx, u, px, py, world.time || 0, TEAM[u.owner] || TEAM.player, u.lastAttackAt != null && world.time - u.lastAttackAt < 0.6)) drawInu(ctx, u, px, py, world.time || 0, { res, kind, act, attacking: u.lastAttackAt != null && world.time - u.lastAttackAt < 0.6 }); }
    { const civ = world.players?.[u.owner]?.civ, L = civ && CIV_LOOK[civ]; // clan skin: back-banner in the clan palette with its accent stripe
      if (L) { const d = u.face && u.face[0] < -0.05 ? 1 : -1, bx = px + d * 7; ctx.fillStyle = '#2a1a10'; ctx.fillRect(bx, py - 26, 1.5, 16);
        ctx.fillStyle = L.primary; ctx.fillRect(bx + (d > 0 ? 1.5 : -7), py - 26, 7, 7); ctx.fillStyle = L.accent; ctx.fillRect(bx + (d > 0 ? 1.5 : -7), py - 22, 7, 1.5); } }
  }]);
  D.sort((a, b) => a[0] - b[0]); for (const d of D) d[1]();
  for (const p of world.projectiles || []) { if (fog && !fog.visible[Math.floor(p.y) * world.width + Math.floor(p.x)]) continue; const x = p.x * TILE, y = p.y * TILE, a = p.dir ? Math.atan2(p.dir[1], p.dir[0]) : 0;
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 8, y - Math.sin(a) * 8); ctx.lineTo(x, y); ctx.stroke(); ctx.lineWidth = 1; }
  const lo = world.lastOrder; if (lo && world.time - lo.t < 0.8) { const k = 1 - (world.time - lo.t) / 0.8, x = lo.x * TILE, y = lo.y * TILE;
    ctx.strokeStyle = lo.kind === 'attack' ? `rgba(255,50,50,${k})` : `rgba(80,255,80,${k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 14 * (1.5 - k / 2), 7 * (1.5 - k / 2), 0, 0, 7); ctx.stroke();
    if (lo.kind === 'attack') { ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); } ctx.lineWidth = 1; }
  if (fog) { // unexplored = black, explored but not currently seen = dimmed
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * world.width + x;
      if (!fog.explored[i]) { ctx.fillStyle = '#000'; ctx.fillRect(x * TILE, y * TILE, TILE, TILE); }
      else if (!fog.visible[i]) { ctx.fillStyle = '#00000080'; ctx.fillRect(x * TILE, y * TILE, TILE, TILE); } } }
  if (ui.ghost) { const g = ui.ghost; ctx.fillStyle = g.valid ? '#40ff4060' : '#ff303070'; ctx.strokeStyle = g.valid ? '#6f6' : '#f44'; ctx.lineWidth = 2;
    ctx.fillRect(g.tx * TILE, g.ty * TILE, g.size * TILE, g.size * TILE); ctx.strokeRect(g.tx * TILE, g.ty * TILE, g.size * TILE, g.size * TILE);
    ctx.strokeStyle = '#ffa500'; ctx.lineWidth = 3; for (const [x, y] of g.units || []) ctx.strokeRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4); ctx.lineWidth = 1; }
  ctx.restore();
  if (ui.box) { const b = ui.box; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#ffffff20'; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.strokeRect(b.x0 + 0.5, b.y0 + 0.5, b.x1 - b.x0, b.y1 - b.y0); }
}

// visual-only death animation: units removed by the sim linger for 0.6s (render state, not sim state)
const ghosts = new Map(); let lastSeen = new Map(), lastWorld = null;
function dyingUnits(world) {
  if (world !== lastWorld) { ghosts.clear(); lastSeen = new Map(); lastWorld = world; }
  const now = world.time || 0, cur = new Map(world.units.map(u => [u.id, u]));
  for (const [id, u] of lastSeen) if (!cur.has(id) && !ghosts.has(id)) ghosts.set(id, { ...u, path: [], t0: now });
  lastSeen = new Map([...cur].map(([id, u]) => [id, { id, type: u.type, owner: u.owner, x: u.x, y: u.y, face: u.face, hp: 0, maxHp: u.maxHp, carry: u.carry, state: 'idle' }]));
  const out = []; for (const [id, g] of ghosts) { const d = now - g.t0; if (d > 0.6 || d < 0) ghosts.delete(id); else out.push({ ...g, dying: d }); }
  return out;
}
