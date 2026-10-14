// Pure game simulation: no DOM, runs in browser or Node.
export const TILE = 32;
export const RES_TYPES = ['food', 'wood', 'gold', 'stone'];
const NODE_KIND = { food: 'berries', wood: 'tree', gold: 'gold_mine', stone: 'stone_mine' };
const NODE_AMOUNT = { food: 125, wood: 100, gold: 800, stone: 350 };
export const START_STOCKPILE = { food: 200, wood: 200, gold: 100, stone: 100 };
import { AGES, AGE_NAMES, AGE_UPS, BUILDINGS, UNITS, TECHS, BUILD_MENU as TT_MENU, ageIndex, techsAt } from './techtree.js';
export { AGES, AGE_NAMES, AGE_UPS, TECHS, techsAt };
export const UNIT_DEFS = UNITS;
export const COSTS = Object.fromEntries([...Object.entries(UNITS), ...Object.entries(BUILDINGS)].map(([k, d]) => [k, d.cost]));
// Base gather rates (resource units / second / villager). Scaffold speeds, ~2.5x AoE2, but keeping AoE2's ordering:
// foraging berries is slower than farming, which is slower than butchering a carcass. Techs multiply these.
export const GATHER_RATES = { berries: 0.75, farm: 0.9, carcass: 1.2, tree: 1.0, gold_mine: 1.0, stone_mine: 1.0 };
export const FARM_FOOD = 175, CARCASS_FOOD = 100;
export const TRAIN_TIME = 25, HOUSE_BUILD_TIME = 25, POP_MAX = 200, QUEUE_MAX = 5;
export const CARRY_MAX = 10, GATHER_RATE = 1.0, REACH = 0.9;
export const BUILDING_DEFS = BUILDINGS;
export const BUILD_MENU = TT_MENU;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function addBuilding(world, type, x, y, complete = true) {
  const d = BUILDING_DEFS[type];
  const b = { id: world.nextId++, type, name: d.name, x, y, size: d.size, maxHp: d.maxHp, hp: complete ? d.maxHp : 1,
    popCap: d.popCap || 0, complete, progress: complete ? (d.buildTime || 0) : 0, buildTime: d.buildTime || 0,
    dropsite: !!d.accepts, accepts: d.accepts || [], trains: d.trains || [], walkable: !!d.walkable, queue: [], trainProgress: 0, rally: null };
  world.buildings.push(b); return b;
}
function newVillager(world, x, y, type = 'villager') {
  const d = UNIT_DEFS[type], fx = techEffects(world), vil = type === 'villager';
  const maxHp = d.hp + (vil ? fx.villagerHp : 0);
  const u = { id: world.nextId++, type, owner: 'player', x, y, speed: d.speed * (vil ? 1 + fx.villagerSpeedPct / 100 : 1), hp: maxHp, maxHp, state: 'idle', target: null, build: null,
    path: [], goal: null, carry: { res: null, amount: 0 }, gatherTimer: 0, note: null };
  world.units.push(u); return u;
}

export function createWorld({ width = 64, height = 64, seed = 1, stockpile = START_STOCKPILE, villagers = 3 } = {}) {
  const rand = rng(seed);
  const tiles = new Uint8Array(width * height);
  for (let i = 0; i < tiles.length; i++) tiles[i] = Math.floor(rand() * 4);
  const world = { width, height, tiles, time: 0, nextId: 1, stockpile: { ...stockpile },
    buildings: [], resources: [], units: [], animals: [], selection: null, selected: null, message: null, ledger: { created: 0 }, age: 'dark', researched: {}, banner: null };
  addBuilding(world, 'town_center', 32, 32, true);
  const used = new Set();
  const add = (res, tx, ty) => { const k = ty * width + tx; if (used.has(k)) return; used.add(k);
    world.resources.push({ id: world.nextId++, res, kind: NODE_KIND[res], x: tx + 0.5, y: ty + 0.5, amount: NODE_AMOUNT[res] }); };
  for (const [x, y] of [[40, 30], [41, 30], [42, 30], [40, 31], [41, 31]]) add('food', x, y);
  for (let ty = 18; ty <= 22; ty++) for (let tx = 20; tx <= 27; tx++) add('wood', tx, ty);
  for (const [x, y] of [[38, 42], [39, 42], [38, 43], [39, 43]]) add('gold', x, y);
  for (const [x, y] of [[26, 42], [27, 42], [28, 42]]) add('stone', x, y);
  for (let i = 0; i < 120; i++) { const x = Math.floor(rand() * width), y = Math.floor(rand() * height);
    if (Math.hypot(x - 34, y - 34) > 14) add('wood', x, y); }
  for (const [x, y] of [[36.5, 34.5], [36.5, 35.5], [31.5, 35.5]].slice(0, villagers)) newVillager(world, x, y);
  // sheep: 4 near the TC, 3 scattered. Neutral until a villager touches them. Kept in world.animals (not pop).
  for (const [x, y] of [[29.5, 30.5], [30.5, 29.5], [29.5, 29.5], [28.5, 31.5], [12.5, 40.5], [50.5, 24.5], [45.5, 52.5]])
    world.animals.push({ id: world.nextId++, type: 'sheep', owner: null, x, y, speed: 1.2, state: 'idle', path: [], goal: null, carry: { res: null, amount: 0 }, target: null, build: null, note: null });
  return world;
}

// ---------- grid / pathfinding ----------
const tkey = (w, x, y) => y * w.width + x;
export function buildGrid(world) {
  const g = new Uint8Array(world.width * world.height);
  for (const n of world.resources) if (n.amount > 0 && !n.walkable) { const x = Math.floor(n.x), y = Math.floor(n.y);
    if (x >= 0 && y >= 0 && x < world.width && y < world.height) g[tkey(world, x, y)] = 1; }
  for (const b of world.buildings) if (!(b.walkable && b.complete)) for (let y = b.y; y < b.y + b.size; y++) for (let x = b.x; x < b.x + b.size; x++)
    if (x >= 0 && y >= 0 && x < world.width && y < world.height) g[tkey(world, x, y)] = 1;
  return g;
}
export function walkable(world, x, y, grid = buildGrid(world)) {
  return x >= 0 && y >= 0 && x < world.width && y < world.height && !grid[tkey(world, x, y)];
}
// A* over 8-connected grid (no corner cutting). goals: array of [tx,ty]. Returns waypoint list (tile centers,
// excluding the start tile), [] if already at a goal, or null if unreachable.
export function findPath(world, sx, sy, goals, grid = buildGrid(world)) {
  const W = world.width, H = world.height, N = W * H;
  const gl = goals.filter(([x, y]) => walkable(world, x, y, grid)); if (!gl.length) return null;
  const goalSet = new Set(gl.map(([x, y]) => tkey(world, x, y)));
  const start = tkey(world, sx, sy); if (goalSet.has(start)) return [];
  const h = i => { const x = i % W, y = (i / W) | 0; let m = Infinity;
    for (const [gx, gy] of gl) { const dx = Math.abs(gx - x), dy = Math.abs(gy - y); const d = Math.max(dx, dy) + 0.41421356 * Math.min(dx, dy); if (d < m) m = d; } return m; };
  const g = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = []; const push = (f, i) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c;
    if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  g[start] = 0; push(h(start), start);
  while (heap.length) {
    const [, cur] = pop(); if (closed[cur]) continue; closed[cur] = 1;
    if (goalSet.has(cur)) { const out = []; for (let i = cur; i !== start; i = came[i]) out.push({ x: (i % W) + 0.5, y: ((i / W) | 0) + 0.5 }); return out.reverse(); }
    const cx = cur % W, cy = (cur / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy;
      if (!walkable(world, nx, ny, grid)) continue;
      if (dx && dy && (!walkable(world, cx + dx, cy, grid) || !walkable(world, cx, cy + dy, grid))) continue;
      const ni = tkey(world, nx, ny); if (closed[ni]) continue;
      const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
      if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ng + h(ni), ni); }
    }
  }
  return null;
}
export function ringTiles(x, y, size) { const out = [];
  for (let ty = y - 1; ty <= y + size; ty++) for (let tx = x - 1; tx <= x + size; tx++)
    if (tx < x || ty < y || tx >= x + size || ty >= y + size) out.push([tx, ty]); return out; }
const utile = u => [Math.floor(u.x), Math.floor(u.y)];
function adjacentToRect(u, x, y, size) { const [tx, ty] = utile(u); return tx >= x - 1 && ty >= y - 1 && tx <= x + size && ty <= y + size && !(tx >= x && ty >= y && tx < x + size && ty < y + size); }
function reserved(world, u) { const s = new Set(); for (const o of world.units) if (o !== u && o.goal != null) s.add(o.goal); return s; }
// Plan a path for u to any of goals, preferring tiles no other unit is heading to / standing on.
function planTo(world, u, goals, grid = buildGrid(world), strict = false) {
  const res = reserved(world, u); const [sx, sy] = utile(u);
  const free = goals.filter(([x, y]) => !res.has(tkey(world, x, y)));
  let p = free.length ? findPath(world, sx, sy, free, grid) : null;
  if (!p && !strict) p = findPath(world, sx, sy, goals, grid);
  if (!p) return false;
  u.path = p; const end = p.length ? p[p.length - 1] : { x: sx + 0.5, y: sy + 0.5 };
  u.goal = tkey(world, Math.floor(end.x), Math.floor(end.y));
  if (!p.length) u.path = [{ x: sx + 0.5, y: sy + 0.5 }]; // settle onto tile center
  return true;
}
function moveAlong(u, dt) {
  let s = u.speed * dt;
  while (u.path.length && s > 0) { const t = u.path[0], dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy);
    if (d <= s) { u.x = t.x; u.y = t.y; s -= d; u.path.shift(); } else { u.x += dx / d * s; u.y += dy / d * s; s = 0; } }
  return u.path.length === 0;
}
// nearest walkable tiles to (tx,ty) by BFS ring order, used for move targets and group spreading
export function nearestWalkable(world, tx, ty, n = 1, grid = buildGrid(world), exclude = new Set()) {
  const out = [], seen = new Set(); let q = [[tx, ty]]; seen.add(tkey(world, tx, ty));
  while (q.length && out.length < n) { const nq = [];
    for (const [x, y] of q) { if (walkable(world, x, y, grid) && !exclude.has(tkey(world, x, y))) { out.push([x, y]); if (out.length >= n) break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue; const k = tkey(world, nx, ny); if (!seen.has(k)) { seen.add(k); nq.push([nx, ny]); } } }
    q = nq; if (seen.size > world.width * world.height) break; }
  return out;
}

// ---------- queries / selection ----------
export function townCenterCenter(b) { return { x: b.x + b.size / 2, y: b.y + b.size / 2 }; }
export function findResourceAt(world, x, y, r = 0.6) { return world.resources.find(n => n.amount > 0 && Math.hypot(n.x - x, n.y - y) < r) || null; }
export const mobiles = world => [...world.units, ...world.animals];
export const mobile = (world, id) => world.units.find(u => u.id === id) || world.animals.find(a => a.id === id) || null;
export function unitAt(world, x, y, r = 0.6) { return world.units.find(u => Math.hypot(u.x - x, u.y - y) < r) || world.animals.find(u => Math.hypot(u.x - x, u.y - y) < r) || null; }
export function sheepAt(world, x, y, r = 0.6) { return world.animals.find(u => Math.hypot(u.x - x, u.y - y) < r) || null; }
const owned = u => u.owner === 'player';
export function buildingAt(world, x, y) { return world.buildings.find(b => x >= b.x && x < b.x + b.size && y >= b.y && y < b.y + b.size) || null; }
export function select(world, unit) { selectUnits(world, unit ? [unit] : []); }
export function selectUnits(world, units) {
  if (!units.length) { world.selection = null; world.selected = null; }
  else if (units.length === 1) { world.selection = { kind: 'unit', id: units[0].id }; world.selected = units[0].id; }
  else { world.selection = { kind: 'units', ids: units.map(u => u.id) }; world.selected = units[0].id; }
}
export function selectedUnits(world) { const s = world.selection; if (!s) return [];
  const ids = s.kind === 'unit' ? [s.id] : s.kind === 'units' ? s.ids : []; return mobiles(world).filter(u => ids.includes(u.id) && owned(u)); }
export function getSelected(world) { return world.selected == null ? null : mobile(world, world.selected); }
export function selectedBuilding(world) { const s = world.selection; return s && s.kind === 'building' ? world.buildings.find(b => b.id === s.id) || null : null; }
export function unitsInRect(world, x0, y0, x1, y1) { const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)], [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
  const inBox = mobiles(world).filter(u => owned(u) && u.x >= ax && u.x <= bx && u.y >= ay && u.y <= by);
  return inBox.some(u => u.type !== 'sheep') ? inBox.filter(u => u.type !== 'sheep') : inBox; }
export function boxSelect(world, x0, y0, x1, y1) { const us = unitsInRect(world, x0, y0, x1, y1); selectUnits(world, us); return us; }
export function pickAt(world, x, y) {
  const u = unitAt(world, x, y); if (u) return { kind: 'unit', id: u.id };
  const b = buildingAt(world, x, y); if (b) return { kind: 'building', id: b.id };
  const n = findResourceAt(world, x, y); if (n) return { kind: 'resource', id: n.id };
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx >= 0 && ty >= 0 && tx < world.width && ty < world.height) return { kind: 'tile', x: tx, y: ty };
  return null;
}
export function selectAt(world, x, y) { const s = pickAt(world, x, y); world.selection = s; world.selected = s && s.kind === 'unit' ? s.id : null; return s; }
export function popCount(world) { return world.units.length; }
export function queuedCount(world) { return world.buildings.reduce((t, b) => t + b.queue.filter(isUnitItem).length, 0); }
export function popCap(world) { return Math.min(POP_MAX, world.buildings.reduce((t, b) => t + (b.complete ? b.popCap : 0), 0)); }
const KIND_NAME = { berries: 'Berry Bush', tree: 'Tree', gold_mine: 'Gold Mine', stone_mine: 'Stone Mine' };
const TASK_NAME = { to_hunt: 'Going to sheep', idle: 'Idle', moving: 'Moving', to_resource: 'Walking to resource', gathering: 'Gathering', to_drop: 'Returning to Town Center', to_build: 'Walking to build', building: 'Building' };
export function selectionInfo(world) {
  const s = world.selection; if (!s) return null;
  if (s.kind === 'tile') return { kind: 'tile', title: 'Grass tile', lines: [`(${s.x}, ${s.y})`] };
  if (s.kind === 'building') { const b = world.buildings.find(o => o.id === s.id); if (!b) return null;
    if (!b.complete) return { kind: 'building', type: b.type, title: `${b.name} (foundation)`, lines: [`HP: ${b.hp}/${b.maxHp}`, `Construction: ${Math.floor(100 * b.progress / b.buildTime)}%`], progress: b.progress / b.buildTime };
    const lines = [`HP: ${b.hp}/${b.maxHp}`];
    if (b.trains.length || b.queue.length) { lines.push(`Queue: ${b.queue.length}/${QUEUE_MAX}`);
      if (b.queue.length) lines.push(`${isUnitItem(b.queue[0]) ? 'Training' : 'Researching'} ${itemName(b.queue[0])}: ${Math.floor(100 * b.trainProgress / itemTime(b.queue[0]))}%`);
      if (b.blocked) lines.push('Halted: population cap');
      if (b.rally) lines.push(`Rally: (${Math.floor(b.rally.x)}, ${Math.floor(b.rally.y)})`); }
    if (b.popCap && b.type !== 'town_center') lines.push(`Provides +${b.popCap} population`);
    if (b.type === 'farm') { const n = world.resources.find(r => r.farm === b.id); lines.push(`Food: ${n ? n.amount : 0}/${n ? n.max || n.amount : farmFood(world)}`); }
    if (b.accepts.length && b.type !== 'town_center') lines.push(`Drop-off: ${b.accepts.join(', ')}`);
    return { kind: 'building', type: b.type, title: b.name, lines, queue: b.queue.length, queueTypes: [...b.queue], progress: b.queue.length ? b.trainProgress / itemTime(b.queue[0]) : null };
  }
  if (s.kind === 'resource') { const n = world.resources.find(o => o.id === s.id); return n && { kind: 'resource', title: KIND_NAME[n.kind], lines: [`${n.res}: ${n.amount} remaining`] }; }
  if (s.kind === 'units') { const us = selectedUnits(world); const counts = {};
    for (const u of us) counts[TASK_NAME[u.state]] = (counts[TASK_NAME[u.state]] || 0) + 1;
    const allV = us.every(u => u.type === 'villager');
    return { kind: 'units', count: us.length, title: allV ? `${us.length} Villagers selected` : `${us.length} units selected`, lines: Object.entries(counts).map(([k, v]) => `${v} × ${k}`).concat([`Carrying: ${us.reduce((t, u) => t + u.carry.amount, 0)} total`]) }; }
  const u = mobile(world, s.id); if (!u) return null;
  if (u.type === 'sheep') return { kind: 'unit', type: 'sheep', title: 'Sheep', lines: [u.owner ? 'Owner: you' : 'Neutral (touch with a villager to convert)', `Food: ${CARCASS_FOOD} when butchered`] };
  if (u.type !== 'villager') { const d = UNIT_DEFS[u.type], fx = techEffects(world), melee = d.infantry || d.cavalry ? fx.meleeAttack : 0;
    return { kind: 'unit', type: u.type, title: d.name, lines: [`Task: ${TASK_NAME[u.state]}`, `HP ${u.hp}/${u.maxHp}  Attack ${d.attack + melee}  Armor ${d.armor}${d.range ? `  Range ${d.range}` : ''}  Speed ${d.speed}`, 'No combat in this scaffold'] }; }
  let task = TASK_NAME[u.state];
  if (u.state === 'to_drop' && u.goal != null) { // name the drop-off actually being walked to (Mill / camp / TC)
    const gx = u.goal % world.width, gy = Math.floor(u.goal / world.width);
    const site = dropsitesFor(world, u.carry.res).find(b => gx >= b.x - 1 && gy >= b.y - 1 && gx <= b.x + b.size && gy <= b.y + b.size);
    if (site) task = `Returning to ${site.name}`; }
  return { kind: 'unit', type: 'villager', title: 'Villager', lines: [`Task: ${task}${u.note ? ` (${u.note})` : ''}`, `Carrying: ${u.carry.amount}${u.carry.amount ? ' ' + u.carry.res : ''}/${carryMax(world)}`, `HP: ${u.hp}/${u.maxHp}`] };
}
function say(world, text) { world.message = { text, until: world.time + 4 }; }

// ---------- orders ----------
const kindGroup = k => k === 'farm' ? 'farm' : 'wild';
function nodeGoals(world, node) { if (node.farm) { const b = world.buildings.find(o => o.id === node.farm); if (b) return footprintTiles(b.x, b.y, b.size); }
  return ringTiles(Math.floor(node.x), Math.floor(node.y), 1); }
function atNode(world, u, node) { if (node.farm) { const b = world.buildings.find(o => o.id === node.farm); const [x, y] = utile(u); return b && x >= b.x && y >= b.y && x < b.x + b.size && y < b.y + b.size; }
  return adjacentToRect(u, Math.floor(node.x), Math.floor(node.y), 1); }
function planResource(world, u, node) {
  const grid = buildGrid(world);
  // 1) a free tile at this node; 2) a free tile at a nearby node of the same kind (spread out); 3) share a tile here
  if (planTo(world, u, nodeGoals(world, node), grid, true)) { u.target = node.id; return true; }
  const near = world.resources.filter(n => n !== node && n.kind === node.kind && n.amount > 0 && Math.hypot(n.x - node.x, n.y - node.y) <= 4)
    .sort((a, b) => Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y));
  for (const n of near) if (planTo(world, u, nodeGoals(world, n), grid, true)) { u.target = n.id; return true; }
  if (planTo(world, u, nodeGoals(world, node), grid)) { u.target = node.id; return true; }
  // unreachable (e.g. interior forest tree): try nearest reachable node of the same type
  const alts = world.resources.filter(n => n !== node && n.res === node.res && n.amount > 0 && kindGroup(n.kind) === kindGroup(node.kind))
    .sort((a, b) => Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y)).slice(0, 12);
  for (const n of alts) if (planTo(world, u, nodeGoals(world, n), grid)) { u.target = n.id; return true; }
  return false;
}
// Drop-off for the carried type: A* to the union of all valid sites' adjacent tiles => nearest by path distance.
export function dropsitesFor(world, res) { return world.buildings.filter(b => b.dropsite && b.complete && (!res || b.accepts.includes(res))); }
function planDrop(world, u) {
  const goals = dropsitesFor(world, u.carry.res).flatMap(b => ringTiles(b.x, b.y, b.size));
  return goals.length > 0 && planTo(world, u, goals);
}
function idle(u, note = null) { u.state = 'idle'; u.path = []; u.note = note; u.target = null; u.build = null; }
export function orderMove(world, u, x, y, tile = null) {
  u.target = null; u.build = null; u.note = null; u.dest = tile ? [...tile] : [Math.floor(x), Math.floor(y)];
  // try the target tile, then the closest walkable tiles around it (handles blocked/enclosed targets)
  const cands = tile ? [tile, ...nearestWalkable(world, tile[0], tile[1], 24).slice(1)] : nearestWalkable(world, Math.floor(x), Math.floor(y), 24);
  const grid = buildGrid(world);
  const res = reserved(world, u), free = cands.filter(t => !res.has(tkey(world, t[0], t[1])));
  for (const t of [...free, ...cands]) if (planTo(world, u, [t], grid)) { u.state = 'moving'; return true; }
  idle(u, 'unreachable'); return false;
}
export function orderMoveGroup(world, units, x, y) {
  const tiles = nearestWalkable(world, Math.floor(x), Math.floor(y), units.length);
  // assign closest unit to each tile greedily
  const left = [...units]; let ok = 0;
  for (const t of tiles) { if (!left.length) break; left.sort((a, b) => Math.hypot(a.x - t[0], a.y - t[1]) - Math.hypot(b.x - t[0], b.y - t[1]));
    if (orderMove(world, left.shift(), 0, 0, t)) ok++; }
  for (const u of left) idle(u, 'unreachable');
  return ok;
}
// Never discards carried resources: on a type change with carry > 0 the villager first
// returns to the Town Center to deposit, then proceeds to the new target.
export function orderGather(world, u, node) {
  u.target = node.id; u.build = null; u.note = null;
  if (u.carry.amount > 0 && u.carry.res !== node.res) { u.state = 'to_drop'; if (!planDrop(world, u)) idle(u, 'no drop-off reachable'); return; }
  u.state = 'to_resource'; if (!planResource(world, u, node)) idle(u, 'unreachable');
}
export function orderBuild(world, u, b) {
  u.target = null; u.build = b.id; u.note = null; u.state = 'to_build';
  if (!planTo(world, u, ringTiles(b.x, b.y, b.size))) idle(u, 'unreachable');
}
// Right-click semantics for the current selection.
export function orderHunt(world, u, sheep) {
  u.target = null; u.build = null; u.note = null; u.hunt = sheep.id; u.huntMode = sheep.owner ? 'butcher' : 'convert'; u.state = 'to_hunt';
  if (!planTo(world, u, ringTiles(Math.floor(sheep.x), Math.floor(sheep.y), 1))) idle(u, 'unreachable');
}
export function commandAt(world, x, y) {
  const b = selectedBuilding(world);
  if (b) { if (b.trains.length && b.complete) { b.rally = { x, y }; return 'rally'; } return null; }
  const us = selectedUnits(world); if (!us.length) return null;
  const vills = us.filter(u => u.type === 'villager'), others = us.filter(u => u.type !== 'villager');
  const moveOthers = () => { if (others.length === 1) orderMove(world, others[0], x, y); else if (others.length) orderMoveGroup(world, others, x, y); };
  const sh = sheepAt(world, x, y);
  if (sh && vills.length) { for (const u of vills) orderHunt(world, u, sh); moveOthers(); return sh.owner ? 'butcher' : 'convert'; }
  const tb = buildingAt(world, x, y);
  const farmNode = tb && tb.type === 'farm' && tb.complete ? world.resources.find(n => n.farm === tb.id && n.amount > 0) : null;
  const n = farmNode || (tb ? null : findResourceAt(world, x, y));
  if (n && vills.length) { for (const u of vills) orderGather(world, u, n); moveOthers(); return 'gather'; }
  if (tb && !tb.complete && vills.length) { for (const u of vills) orderBuild(world, u, tb); moveOthers(); return 'build'; }
  if (us.length === 1) orderMove(world, us[0], x, y); else orderMoveGroup(world, us, x, y);
  return 'move';
}

// ---------- economy: training, houses ----------
function afford(world, cost) { return Object.entries(cost).every(([r, v]) => world.stockpile[r] >= v); }
function pay(world, cost) { for (const [r, v] of Object.entries(cost)) world.stockpile[r] -= v; }
export function missingFor(world, cost) { const m = Object.entries(cost).filter(([r, v]) => world.stockpile[r] < v).map(([r, v]) => `${v - world.stockpile[r]} ${r}`);
  return m.length ? `need ${m.join(', ')}` : null; }
// Shared rules for every trainer: per-building queue cap, and pop + everything queued anywhere must stay below the cap.
export function trainUnit(world, b, type) {
  if (!b || !b.complete || !b.trains.includes(type)) return { ok: false, reason: 'invalid' };
  if (isLocked(world, UNIT_DEFS[type].age)) { say(world, `${UNIT_DEFS[type].name}: ${requiresText(UNIT_DEFS[type].age)}`); return { ok: false, reason: 'age' }; }
  if (b.queue.length >= QUEUE_MAX) { say(world, 'Queue is full'); return { ok: false, reason: 'queue' }; }
  if (popCount(world) + queuedCount(world) >= popCap(world)) { say(world, `Population cap reached (${popCount(world)}/${popCap(world)}): build a House`); return { ok: false, reason: 'pop' }; }
  if (!afford(world, COSTS[type])) { say(world, type === 'villager' ? 'Not enough food (50 needed)' : `Cannot train ${UNIT_DEFS[type].name}: ${missingFor(world, COSTS[type])}`); return { ok: false, reason: 'cost' }; }
  pay(world, COSTS[type]); const up = techEffects(world).upgrade[type]; b.queue.push(up || type); return { ok: true, unit: up || type };
}
export function trainVillager(world, tc) { if (!tc || tc.type !== 'town_center') return { ok: false, reason: 'invalid' }; return trainUnit(world, tc, 'villager'); }
const rectsOverlap = (ax, ay, as, bx, by, bs) => ax < bx + bs && bx < ax + as && ay < by + bs && by < ay + as;
export function farmAnchorOk(world, tx, ty, size = 3) {
  return world.buildings.some(b => (b.type === 'mill' || b.type === 'town_center') && rectsOverlap(tx - 1, ty - 1, size + 2, b.x, b.y, b.size) && !rectsOverlap(tx, ty, size, b.x, b.y, b.size));
}
export function canPlace(world, type, tx, ty) {
  const size = BUILDING_DEFS[type].size, grid = buildGrid(world);
  for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) if (!walkable(world, x, y, grid)) return false;
  if (world.buildings.some(b => rectsOverlap(tx, ty, size, b.x, b.y, b.size))) return false; // incl. walkable farms
  if (type === 'farm' && !farmAnchorOk(world, tx, ty, size)) return false;
  return true;
}
export function placeBuilding(world, type, tx, ty, builders = []) {
  if (isLocked(world, BUILDING_DEFS[type].age)) { say(world, `${BUILDING_DEFS[type].name}: ${requiresText(BUILDING_DEFS[type].age)}`); return null; }
  if (!canPlace(world, type, tx, ty)) { say(world, type === 'farm' && !farmAnchorOk(world, tx, ty) ? 'Farms must be placed next to a Mill or Town Center' : 'Cannot build there'); return null; }
  const cost = COSTS[type]; if (!afford(world, cost)) { say(world, `Cannot build ${BUILDING_DEFS[type].name}: ${missingFor(world, cost)}`); return null; }
  pay(world, cost); const b = addBuilding(world, type, tx, ty, false);
  onFootprintChanged(world, b);            // evict units inside, repath units crossing it
  for (const u of builders) orderBuild(world, u, b);
  return b;
}
function spawnFrom(world, tc, type = 'villager') {
  const grid = buildGrid(world), occ = new Set(world.units.map(u => tkey(world, ...utile(u))));
  const ref = tc.rally || { x: tc.x + tc.size / 2, y: tc.y + tc.size + 1 };
  const ring = ringTiles(tc.x, tc.y, tc.size).filter(([x, y]) => walkable(world, x, y, grid))
    .sort((a, b) => (occ.has(tkey(world, ...a)) - occ.has(tkey(world, ...b))) || Math.hypot(a[0] + 0.5 - ref.x, a[1] + 0.5 - ref.y) - Math.hypot(b[0] + 0.5 - ref.x, b[1] + 0.5 - ref.y));
  const t = ring[0] || nearestWalkable(world, tc.x + tc.size, tc.y + tc.size, 1, grid)[0];
  const u = newVillager(world, t[0] + 0.5, t[1] + 0.5, type);
  if (tc.rally) { const n = type === 'villager' ? findResourceAt(world, tc.rally.x, tc.rally.y) : null; n ? orderGather(world, u, n) : orderMove(world, u, tc.rally.x, tc.rally.y); }
  return u;
}

// ---------- ages & technologies ----------
export function techEffects(world) {
  const fx = { villagerHp: 0, carryPct: 0, villagerSpeedPct: 0, ratePct: {}, farmFood: 0, meleeAttack: 0, upgrade: {} };
  for (const id of Object.keys(world.researched || {})) { const e = TECHS[id]?.effect; if (!e) continue;
    for (const [k, v] of Object.entries(e)) {
      if (k === 'ratePct') for (const [kind, pct] of Object.entries(v)) fx.ratePct[kind] = (fx.ratePct[kind] || 0) + pct;
      else if (k === 'upgrade') Object.assign(fx.upgrade, v); else fx[k] += v; } }
  return fx;
}
export function carryMax(world) { return Math.round(CARRY_MAX * (1 + techEffects(world).carryPct / 100)); }
export function gatherRate(world, kind) { return (GATHER_RATES[kind] ?? GATHER_RATE) * (1 + (techEffects(world).ratePct[kind] || 0) / 100); }
export function farmFood(world) { return FARM_FOOD + techEffects(world).farmFood; }
export const isLocked = (world, age) => ageIndex(world.age) < ageIndex(age);
export const requiresText = age => `Requires ${AGE_NAMES[age]}`;
export function nextAge(world) { return AGES[ageIndex(world.age) + 1] || null; }
// What is still missing to start the next age-up (null = can research now, ignoring cost).
export function ageStatus(world) {
  const next = nextAge(world); if (!next) return { next: null, ok: false, missing: 'Already in the Imperial Age' };
  const req = AGE_UPS[next];
  const have = [...new Set(world.buildings.filter(b => b.complete && req.from.includes(b.type)).map(b => b.type))];
  const any = (req.orAny || []).some(t => world.buildings.some(b => b.complete && b.type === t));
  const ok = have.length >= req.needs || any;
  const names = req.from.filter(t => BUILDINGS[t]).map(t => BUILDINGS[t].name);
  return { next, ok, have, req, missing: ok ? null : `needs ${req.needs} of: ${names.join(', ')}${req.orAny ? ' (or a Castle)' : ''} (have ${have.length})` };
}
const queuedAnywhere = (world, item) => world.buildings.some(b => b.queue.includes(item));
export function itemTime(item) {
  if (item.startsWith('tech:')) return TECHS[item.slice(5)].time;
  if (item.startsWith('age:')) return AGE_UPS[item.slice(4)].time;
  return UNIT_DEFS[item].time;
}
export function itemName(item) {
  if (item.startsWith('tech:')) return TECHS[item.slice(5)].name;
  if (item.startsWith('age:')) return AGE_NAMES[item.slice(4)];
  return UNIT_DEFS[item].name;
}
export const isUnitItem = item => !item.includes(':');
export function canResearch(world, b, techId) {
  const t = TECHS[techId]; if (!t) return { ok: false, reason: 'invalid', text: 'Unknown technology' };
  if (!b || !b.complete || b.type !== t.at) return { ok: false, reason: 'invalid', text: `Researched at the ${BUILDINGS[t.at].name}` };
  if (techId in world.researched) return { ok: false, reason: 'done', text: `${t.name} already researched` };
  if (queuedAnywhere(world, 'tech:' + techId)) return { ok: false, reason: 'queued', text: `${t.name} is already being researched` };
  if (isLocked(world, t.age)) return { ok: false, reason: 'age', text: requiresText(t.age) };
  const pre = (t.requires || []).find(r => !(r in world.researched)); if (pre) return { ok: false, reason: 'prereq', text: `Requires ${TECHS[pre].name}` };
  if (!afford(world, t.cost)) return { ok: false, reason: 'cost', text: missingFor(world, t.cost) };
  return { ok: true };
}
export function research(world, b, techId) {
  const c = canResearch(world, b, techId); if (!c.ok) { say(world, `${TECHS[techId]?.name || techId}: ${c.text}`); return c; }
  if (b.queue.length >= QUEUE_MAX) { say(world, 'Queue is full'); return { ok: false, reason: 'queue' }; }
  pay(world, TECHS[techId].cost); b.queue.push('tech:' + techId); return { ok: true };
}
export function canAgeUp(world, tc) {
  const st = ageStatus(world);
  if (!tc || tc.type !== 'town_center' || !tc.complete) return { ok: false, reason: 'invalid', text: 'Researched at the Town Center' };
  if (!st.next) return { ok: false, reason: 'max', text: st.missing };
  if (world.buildings.some(b => b.queue.some(q => q.startsWith('age:')))) return { ok: false, reason: 'queued', text: 'Already advancing to the next age' };
  if (!st.ok) return { ok: false, reason: 'prereq', text: st.missing };
  if (!afford(world, AGE_UPS[st.next].cost)) return { ok: false, reason: 'cost', text: missingFor(world, AGE_UPS[st.next].cost) };
  return { ok: true, next: st.next };
}
export function ageUp(world, tc) {
  const c = canAgeUp(world, tc); if (!c.ok) { say(world, `Cannot advance: ${c.text}`); return c; }
  if (tc.queue.length >= QUEUE_MAX) { say(world, 'Queue is full'); return { ok: false, reason: 'queue' }; }
  pay(world, AGE_UPS[c.next].cost); tc.queue.push('age:' + c.next); return { ok: true, next: c.next };
}
function finishItem(world, b, item) {
  if (isUnitItem(item)) { spawnFrom(world, b, item); return; }
  if (item.startsWith('age:')) { world.age = item.slice(4); world.banner = { text: `You have advanced to the ${AGE_NAMES[world.age]}!`, until: world.time + 6 }; say(world, `${AGE_NAMES[world.age]} reached`); return; }
  const id = item.slice(5); world.researched[id] = world.time;
  const e = TECHS[id].effect;
  if (e.villagerHp) for (const u of world.units) if (u.type === 'villager') { u.maxHp += e.villagerHp; u.hp += e.villagerHp; }
  if (e.villagerSpeedPct) for (const u of world.units) if (u.type === 'villager') u.speed = UNIT_DEFS.villager.speed * (1 + techEffects(world).villagerSpeedPct / 100);
  if (e.upgrade) for (const u of world.units) if (e.upgrade[u.type]) { const to = e.upgrade[u.type]; u.type = to; u.maxHp = UNIT_DEFS[to].hp; u.hp = u.maxHp; }
  say(world, `${TECHS[id].name} researched`);
}

// ---------- eviction (AoE2-style): building placement ignores units; units inside get pushed out ----------
export function footprintTiles(tx, ty, size) { const out = []; for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) out.push([x, y]); return out; }
export function unitsInFootprint(world, tx, ty, size) {
  return mobiles(world).filter(u => { const [x, y] = utile(u); return x >= tx && y >= ty && x < tx + size && y < ty + size; });
}
export function unitsInsideBuildings(world) {
  return mobiles(world).filter(u => { const [x, y] = utile(u); return world.buildings.some(b => !(b.walkable && b.complete) && x >= b.x && y >= b.y && x < b.x + b.size && y < b.y + b.size); });
}
// Re-plan a unit's current task from where it stands (after eviction or when its path became invalid).
function replan(world, u) {
  switch (u.state) {
    case 'moving': { const d = u.dest || utile(u); const keep = u.dest; if (!orderMove(world, u, 0, 0, d)) idle(u, 'unreachable'); else u.dest = keep; break; }
    case 'to_resource': case 'gathering': { const node = world.resources.find(n => n.id === u.target);
      if (!node || node.amount <= 0) { u.state = 'to_resource'; u.path = []; break; } // tick() retargets
      if (u.state === 'gathering' && atNode(world, u, node)) break;
      u.state = 'to_resource'; if (!planResource(world, u, node)) idle(u, 'unreachable'); break; }
    case 'to_drop': if (!planDrop(world, u)) idle(u, 'no drop-off reachable'); break;
    case 'to_hunt': { const sh = world.animals.find(a => a.id === u.hunt); if (!sh || !planTo(world, u, ringTiles(Math.floor(sh.x), Math.floor(sh.y), 1))) idle(u); break; }
    case 'to_build': case 'building': { const b = world.buildings.find(o => o.id === u.build); if (!b || b.complete) { idle(u); break; }
      if (u.state === 'building' && adjacentToRect(u, b.x, b.y, b.size)) break;
      u.state = 'to_build'; if (!planTo(world, u, ringTiles(b.x, b.y, b.size))) idle(u, 'unreachable'); break; }
    default: u.path = []; u.goal = tkey(world, ...utile(u));
  }
}
export function onFootprintChanged(world, b) {
  const grid = buildGrid(world);
  const inFoot = (x, y) => x >= b.x && y >= b.y && x < b.x + b.size && y < b.y + b.size;
  const taken = new Set(mobiles(world).filter(u => !inFoot(...utile(u))).map(u => tkey(world, ...utile(u))));
  const evicted = [], repathed = [];
  for (const u of mobiles(world)) {
    const [tx, ty] = utile(u);
    if (inFoot(tx, ty)) {
      const t = nearestWalkable(world, tx, ty, 1, grid, taken)[0] || nearestWalkable(world, tx, ty, 1, grid)[0];
      if (t) { u.x = t[0] + 0.5; u.y = t[1] + 0.5; taken.add(tkey(world, t[0], t[1])); }
      u.path = []; evicted.push(u.id); replan(world, u); continue;
    }
    const goalIn = u.goal != null && inFoot(u.goal % world.width, Math.floor(u.goal / world.width));
    const pathIn = u.path.some(q => inFoot(Math.floor(q.x), Math.floor(q.y)));
    if (goalIn || pathIn) { repathed.push(u.id); replan(world, u); }
  }
  world.lastEviction = { building: b.id, evicted, repathed, time: world.time };
  return world.lastEviction;
}

// ---------- tick ----------
function retarget(world, u, res) {
  const grp = kindGroup(u.lastKind);
  const cands = world.resources.filter(n => n.res === res && n.amount > 0 && kindGroup(n.kind) === grp).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y)).slice(0, 8);
  const grid = buildGrid(world);
  for (const n of cands) { if (Math.hypot(n.x - u.x, n.y - u.y) > 12) break; if (planTo(world, u, nodeGoals(world, n), grid)) { u.target = n.id; return n; } }
  return null;
}
export function tick(world, dt) {
  world.time += dt;
  if (world.message && world.time > world.message.until) world.message = null;
  if (world.banner && world.time > world.banner.until) world.banner = null;
  for (const b of world.buildings) {
    if (!b.complete || !b.queue.length) continue;
    // one item at a time (AoE2: a TC researching an age/tech is not training villagers meanwhile)
    if (isUnitItem(b.queue[0]) && popCount(world) >= popCap(world)) { b.blocked = true; continue; } b.blocked = false;
    b.trainProgress += dt;
    if (b.trainProgress >= itemTime(b.queue[0])) { b.trainProgress = 0; finishItem(world, b, b.queue.shift()); }
  }
  for (const u of world.units) {
    switch (u.state) {
      case 'idle': break;
      case 'moving': if (moveAlong(u, dt)) { u.state = 'idle'; } break;
      case 'to_resource': case 'gathering': {
        let node = world.resources.find(n => n.id === u.target);
        if (!node || node.amount <= 0) {
          const res = node ? node.res : u.carry.res; node = res ? retarget(world, u, res) : null;
          if (!node) { if (u.carry.amount) { u.state = 'to_drop'; u.target = null; if (!planDrop(world, u)) idle(u, 'no drop-off reachable'); } else idle(u); break; }
          u.state = 'to_resource';
        }
        if (u.state === 'to_resource') {
          if (!moveAlong(u, dt)) break;
          if (atNode(world, u, node)) { u.state = 'gathering'; u.gatherTimer = 0; }
          else if (!planResource(world, u, node)) idle(u, 'unreachable');
          break;
        }
        u.lastKind = node.kind;
        u.gatherTimer += dt * gatherRate(world, node.kind);
        const cap = carryMax(world);
        while (u.gatherTimer >= 1 && u.carry.amount < cap && node.amount > 0) { u.gatherTimer -= 1; node.amount -= 1; u.carry.res = node.res; u.carry.amount += 1; }
        if (node.amount <= 0 && node.farm) removeFarm(world, node);
        if (u.carry.amount >= cap || node.amount <= 0) { u.state = 'to_drop'; if (!planDrop(world, u)) idle(u, 'no drop-off reachable'); }
        break;
      }
      case 'to_drop': {
        if (!moveAlong(u, dt)) break;
        const site = dropsitesFor(world, u.carry.res).find(b => adjacentToRect(u, b.x, b.y, b.size));
        if (!site) { if (!planDrop(world, u)) idle(u, 'no drop-off reachable'); break; }
        if (u.carry.res && u.carry.amount) { world.stockpile[u.carry.res] += u.carry.amount; u.lastDrop = site.id; }
        u.carry = { res: u.carry.res, amount: 0 };
        const node = world.resources.find(n => n.id === u.target);
        if (node && node.amount > 0) { u.state = 'to_resource'; if (!planResource(world, u, node)) idle(u, 'unreachable'); }
        else if (u.carry.res && retarget(world, u, u.carry.res)) u.state = 'to_resource';
        else idle(u);
        break;
      }
      case 'to_build': case 'building': {
        const b = world.buildings.find(o => o.id === u.build);
        if (!b || b.complete) { idle(u); break; }
        if (u.state === 'to_build') { if (!moveAlong(u, dt)) break;
          if (adjacentToRect(u, b.x, b.y, b.size)) u.state = 'building'; else if (!planTo(world, u, ringTiles(b.x, b.y, b.size))) idle(u, 'unreachable'); break; }
        if (!b.started) { b.started = true; onFootprintChanged(world, b); }   // safety pass at construction start
        b.progress = Math.min(b.buildTime, b.progress + dt); // each builder adds its own work: n builders => n x speed
        b.hp = Math.max(1, Math.round(b.maxHp * b.progress / b.buildTime));
        if (b.progress >= b.buildTime) completeBuilding(world, b);
        break;
      }
      case 'to_hunt': {
        const sh = world.animals.find(a => a.id === u.hunt);
        if (!sh) { const c = world.resources.find(n => n.id === world.carcassOf?.[u.hunt] && n.amount > 0); c ? orderGather(world, u, c) : idle(u); break; }
        if (u.huntMode === 'convert' && sh.owner) { idle(u); break; } // converted (e.g. by touch) on the way: done
        const near = Math.hypot(sh.x - u.x, sh.y - u.y) <= 1.6;
        if (!near) { if (moveAlong(u, dt) && !planTo(world, u, ringTiles(Math.floor(sh.x), Math.floor(sh.y), 1))) idle(u, 'unreachable'); break; }
        if (!sh.owner) { convertSheep(world, sh); idle(u); break; }
        orderGather(world, u, butcher(world, sh));
        break;
      }
    }
    if (u.state === 'idle') u.goal = tkey(world, ...utile(u));
  }
  for (const a of world.animals) {
    if (!a.owner && world.units.some(u => u.type === 'villager' && Math.hypot(u.x - a.x, u.y - a.y) < 1.0)) convertSheep(world, a);
    if (a.state === 'moving' && moveAlong(a, dt)) a.state = 'idle';
  }
}
export function convertSheep(world, sh) { sh.owner = 'player'; }
// Kill an owned sheep where it stands: it becomes a 100-food carcass node at its tile.
export function butcher(world, sh) {
  world.animals = world.animals.filter(a => a !== sh);
  const n = { id: world.nextId++, res: 'food', kind: 'carcass', x: Math.floor(sh.x) + 0.5, y: Math.floor(sh.y) + 0.5, amount: CARCASS_FOOD };
  world.resources.push(n); world.ledger.created += CARCASS_FOOD; (world.carcassOf ||= {})[sh.id] = n.id;
  if (world.selection && world.selection.kind === 'unit' && world.selection.id === sh.id) world.selection = null;
  return n;
}
function completeBuilding(world, b) {
  b.complete = true; b.hp = b.maxHp;
  const builders = world.units.filter(o => o.build === b.id); for (const o of builders) idle(o);
  if (b.type === 'farm') { // walkable field with 175 food; the first builder starts farming it
    const n = { id: world.nextId++, res: 'food', kind: 'farm', farm: b.id, walkable: true, x: b.x + 1.5, y: b.y + 1.5, amount: farmFood(world), max: farmFood(world) };
    world.resources.push(n); world.ledger.created += n.amount;
    if (builders[0]) orderGather(world, builders[0], n);
    return;
  }
  onFootprintChanged(world, b);
}
function removeFarm(world, node) {
  world.buildings = world.buildings.filter(b => b.id !== node.farm);
  world.resources = world.resources.filter(n => n !== node);
  if (world.selection && world.selection.kind === 'building' && world.selection.id === node.farm) world.selection = null;
}

// Camera clamp (pixels). If viewport is larger than the map on an axis, center the map on that axis.
export function clampCamera(cam, viewW, viewH, world, tile = TILE) {
  const mw = world.width * tile, mh = world.height * tile;
  cam.x = viewW >= mw ? -(viewW - mw) / 2 : Math.max(0, Math.min(mw - viewW, cam.x));
  cam.y = viewH >= mh ? -(viewH - mh) / 2 : Math.max(0, Math.min(mh - viewH, cam.y));
  return cam;
}
// Shared camera/screen transform. Rendering translates by the rounded camera, so input must too.
export function camPixel(cam) { return { x: Math.round(cam.x), y: Math.round(cam.y) }; }
export function screenToWorld(sx, sy, cam, tile = TILE) { const c = camPixel(cam); return { x: (sx + c.x) / tile, y: (sy + c.y) / tile }; }
export function worldToScreen(wx, wy, cam, tile = TILE) { const c = camPixel(cam); return { x: wx * tile - c.x, y: wy * tile - c.y }; }
