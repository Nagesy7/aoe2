// Combat: attack orders, damage, projectiles, death, aggro, separation and stuck detection. Pure (no DOM).
import { UNITS, BUILDINGS } from './techtree.js';
import { buildGrid, walkable, nearestWalkable, ringTiles, techEffects, planTo, moveAlong, idleUnit, tileKey } from './sim.js';

export const LOS = 6;            // auto-acquire radius (tiles)
export const LEASH = 10;         // auto-acquired chases give up beyond LOS + this from where they started
export const ARROW_SPEED = 9;    // tiles / second
const MELEE_REACH = 1.5, BUILDING_REACH = 1.0;
export const parseArmor = a => { const [m, p] = String(a || '0/0').split('/').map(Number); return { melee: m || 0, pierce: p || 0 }; };
export const isEnemy = (a, b) => !!a.owner && !!b.owner && a.owner !== b.owner;
export const isMilitary = u => u.type !== 'villager' && u.type !== 'sheep' && (UNITS[u.type]?.attack || 0) > 0;

// Effective combat stats of a unit (player blacksmith techs apply to player infantry/cavalry only).
export function unitStats(world, u) {
  const d = UNITS[u.type]; const melee = u.owner === 'player' && (d.infantry || d.cavalry) ? techEffects(world).meleeAttack : 0;
  return { attack: d.attack + melee, armor: parseArmor(d.armor), range: d.range || 0, ranged: !!d.range, reload: d.reload || 2, bonus: d.bonus || {}, los: Math.max(LOS, (d.range || 0) + 2) };
}
export function armorOf(t) { return t.size ? parseArmor(BUILDINGS[t.type].armor || '0/7') : parseArmor(UNITS[t.type]?.armor); }
const classes = t => { if (t.size) return ['building']; const d = UNITS[t.type] || {}; return [d.infantry && 'infantry', d.cavalry && 'cavalry', d.range && 'archer'].filter(Boolean); };
// AoE2 damage: max(1, attack + class bonuses - matching armor (melee or pierce))
export function damageFor(world, att, tgt) {
  const s = unitStats(world, att), arm = armorOf(tgt);
  const bonus = classes(tgt).reduce((t, c) => t + (s.bonus[c] || 0), 0);
  return Math.max(1, s.attack + bonus - (s.ranged ? arm.pierce : arm.melee));
}
export function findTarget(world, ref) {
  if (!ref) return null;
  return ref.kind === 'building' ? world.buildings.find(b => b.id === ref.id) || null : world.units.find(u => u.id === ref.id) || null;
}
const center = t => t.size ? { x: t.x + t.size / 2, y: t.y + t.size / 2 } : { x: t.x, y: t.y };
export function distTo(u, t) {
  if (!t.size) return Math.hypot(t.x - u.x, t.y - u.y);
  const dx = Math.max(t.x - u.x, 0, u.x - (t.x + t.size)), dy = Math.max(t.y - u.y, 0, u.y - (t.y + t.size)); return Math.hypot(dx, dy);
}
export function inRange(world, u, t) { const s = unitStats(world, u); return distTo(u, t) <= (s.ranged ? s.range + 0.5 : t.size ? BUILDING_REACH : MELEE_REACH); }
// Walkable tiles from which u can hit t.
function attackGoals(world, u, t, grid) {
  const s = unitStats(world, u);
  if (!s.ranged) return t.size ? ringTiles(t.x, t.y, t.size) : ringTiles(Math.floor(t.x), Math.floor(t.y), 1);
  const out = [], c = center(t), R = Math.ceil(s.range + (t.size || 1));
  for (let y = Math.floor(c.y) - R; y <= Math.floor(c.y) + R; y++) for (let x = Math.floor(c.x) - R; x <= Math.floor(c.x) + R; x++)
    if (walkable(world, x, y, grid) && distTo({ x: x + 0.5, y: y + 0.5 }, t) <= s.range + 0.4) out.push([x, y]);
  return out;
}
function planAttack(world, u, t) {
  const grid = buildGrid(world); u.tpos = { ...center(t) }; u.replanAt = world.time + 0.5;
  if (planTo(world, u, attackGoals(world, u, t, grid), grid)) return true;
  // fully surrounded target: get as close as possible
  const c = center(t); const near = nearestWalkable(world, Math.floor(c.x), Math.floor(c.y), 8, grid);
  return planTo(world, u, near, grid);
}
export function orderAttack(world, u, t, auto = false) {
  if (!t || t === u || !isEnemy(u, t) || !(UNITS[u.type]?.attack > 0)) return false;
  u.target = null; u.build = null; u.note = null; u.hunt = null;
  u.attack = { kind: t.size ? 'building' : 'unit', id: t.id, auto, home: { x: u.x, y: u.y } };
  u.state = 'attacking'; u.path = []; u.stuck = 0;
  if (inRange(world, u, t)) return true;
  if (!planAttack(world, u, t)) { idleUnit(u, 'unreachable'); u.attack = null; return false; }
  return true;
}
export function orderAttackGroup(world, units, t) { let n = 0; for (const u of units) if (orderAttack(world, u, t)) n++; return n; }

function hit(world, att, tgt, dmg) {
  if (tgt.hp <= 0) return;
  tgt.hp -= dmg; tgt.lastHitBy = att.id; tgt.lastHitAt = world.time;
  (world.combatLog ||= []).push({ t: +world.time.toFixed(2), att: att.id, tgt: tgt.id, dmg, hp: Math.max(0, tgt.hp) });
  if (world.combatLog.length > 200) world.combatLog.shift();
  if (tgt.hp <= 0) kill(world, tgt);
  else if (!tgt.size) retaliate(world, tgt, att);
}
export function kill(world, t) {
  t.hp = 0; t.dead = true;
  (world.deaths ||= []).push({ id: t.id, type: t.type, owner: t.owner, t: world.time, building: !!t.size });
  if (t.size) { world.buildings = world.buildings.filter(b => b !== t);
    if (t.type === 'farm') world.resources = world.resources.filter(n => n.farm !== t.id); }
  else world.units = world.units.filter(u => u !== t);
  const s = world.selection;
  if (s && ((s.kind === 'unit' || s.kind === 'building') && s.id === t.id)) { world.selection = null; world.selected = null; }
  if (s && s.kind === 'units') { s.ids = s.ids.filter(i => i !== t.id); if (!s.ids.length) { world.selection = null; world.selected = null; } }
  if (world.selected === t.id) world.selected = null;
}
function retaliate(world, victim, att) {
  if (!world.units.includes(att) || !isMilitary(victim)) return;
  if (victim.state === 'idle' || (victim.state === 'attacking' && victim.attack?.auto && victim.attack.kind === 'building')) orderAttack(world, victim, att, true);
}
function nearestEnemy(world, u, r, buildingsToo = false) {
  let best = null, bd = r;
  for (const o of world.units) if (isEnemy(u, o)) { const d = Math.hypot(o.x - u.x, o.y - u.y); if (d <= bd) { bd = d; best = o; } }
  if (!best && buildingsToo) for (const b of world.buildings) if (isEnemy(u, b)) { const d = distTo(u, b); if (d <= bd) { bd = d; best = b; } }
  return best;
}
// One unit in the 'attacking' state.
export function tickAttack(world, u, dt) {
  const t = findTarget(world, u.attack);
  const s = unitStats(world, u);
  u.atkTimer = Math.max(0, (u.atkTimer || 0) - dt);
  if (!t || t.dead || t.hp <= 0) { // target gone: look for the next one nearby, else stop
    const auto = u.attack?.auto; u.attack = null; idleUnit(u);
    const n = nearestEnemy(world, u, s.los, u.owner !== 'player'); if (n) orderAttack(world, u, n, true); else if (auto) u.goal = tileKey(world, Math.floor(u.x), Math.floor(u.y));
    return;
  }
  if (u.attack.auto && Math.hypot(u.x - u.attack.home.x, u.y - u.attack.home.y) > s.los + LEASH) { u.attack = null; idleUnit(u, 'gave up chase'); return; }
  if (u.nudge && u.path.length) { moveAlong(u, dt); return; } u.nudge = false;
  if (inRange(world, u, t)) {
    u.path = []; u.goal = tileKey(world, Math.floor(u.x), Math.floor(u.y)); u.stuck = 0; u.facing = Math.atan2(center(t).y - u.y, center(t).x - u.x);
    if (u.atkTimer <= 0) {
      u.atkTimer = s.reload; u.lastAttackAt = world.time; const dmg = damageFor(world, u, t);
      if (s.ranged) (world.projectiles ||= []).push({ from: u.id, owner: u.owner, x: u.x, y: u.y - 0.3, tgt: { kind: u.attack.kind, id: t.id }, dmg, speed: ARROW_SPEED });
      else hit(world, u, t, dmg);
    }
    return;
  }
  // chase: re-path when the target moved away from where we planned, or our path ended
  const c = center(t), moved = u.tpos ? Math.hypot(c.x - u.tpos.x, c.y - u.tpos.y) : 99;
  if ((!u.path.length || moved > 1.0) && world.time >= (u.replanAt || 0)) { if (!planAttack(world, u, t)) { u.attack = null; idleUnit(u, 'unreachable'); return; } }
  stepWithStuckCheck(world, u, dt, () => planAttack(world, u, t));
}
// Move along the path; if the next waypoint became blocked or no progress is made for 1s, re-plan.
export function stepWithStuckCheck(world, u, dt, replan) {
  const nx = u.path[0]; const grid = nx ? buildGrid(world) : null;
  if (nx && !walkable(world, Math.floor(nx.x), Math.floor(nx.y), grid)) { u.stuckRepaths = (u.stuckRepaths || 0) + 1; replan(); return false; }
  const x0 = u.x, y0 = u.y; const done = moveAlong(u, dt);
  if (!done && Math.hypot(u.x - x0, u.y - y0) < u.speed * dt * 0.25) { u.stuck = (u.stuck || 0) + dt; if (u.stuck > 1) { u.stuck = 0; u.stuckRepaths = (u.stuckRepaths || 0) + 1; replan(); } }
  else u.stuck = 0;
  return done;
}
export function tickProjectiles(world, dt) {
  const ps = world.projectiles || (world.projectiles = []);
  for (const p of ps) {
    const t = findTarget(world, p.tgt); if (!t || t.dead) { p.done = true; continue; }
    const c = center(t), dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy), step = p.speed * dt;
    p.angle = Math.atan2(dy, dx);
    if (d <= step + (t.size ? t.size / 2 : 0.2)) { p.done = true; const att = world.units.find(o => o.id === p.from) || { id: p.from, owner: p.owner }; hit(world, att, t, p.dmg); }
    else { p.x += dx / d * step; p.y += dy / d * step; }
  }
  world.projectiles = ps.filter(p => !p.done);
}
// Idle military units (and all enemy units) auto-acquire enemies within line of sight. Throttled.
export function tickAggro(world) {
  if (world.time < (world.nextAggro || 0)) return; world.nextAggro = world.time + 0.25;
  for (const u of world.units) {
    if (!isMilitary(u)) continue;
    // raiders marching on a building divert to defending units that come into sight
    if (u.owner !== 'player' && u.state === 'attacking' && u.attack?.kind === 'building') { const n = nearestEnemy(world, u, unitStats(world, u).los); if (n) orderAttack(world, u, n, true); continue; }
    if (u.state !== 'idle') continue;
    const n = nearestEnemy(world, u, unitStats(world, u).los, u.owner !== 'player'); if (n) orderAttack(world, u, n, true);
  }
}
// Separation: stationary non-villager units never share a tile; extras step to the nearest free tile.
export function tickSeparation(world) {
  if (world.time < (world.nextSep || 0)) return; world.nextSep = world.time + 0.3;
  const grid = buildGrid(world), occ = new Map();
  const still = u => (u.state === 'idle' || (u.state === 'attacking' && !u.path.length));
  for (const u of world.units) { const k = tileKey(world, Math.floor(u.x), Math.floor(u.y)); if (!occ.has(k)) occ.set(k, []); occ.get(k).push(u); }
  const taken = new Set([...occ.keys()]);
  for (const [, us] of occ) {
    const movers = us.filter(u => still(u) && u.type !== 'villager'); if (us.length < 2 || !movers.length) continue;
    const keepFirst = us.length - movers.length === 0; // if a non-mover is on the tile, all still military step off
    for (const u of movers.slice(keepFirst ? 1 : 0)) {
      const [tx, ty] = [Math.floor(u.x), Math.floor(u.y)];
      const cand = nearestWalkable(world, tx, ty, 12, grid, taken).find(([x, y]) => {
        if (u.state !== 'attacking') return true; const t = findTarget(world, u.attack); return t && inRange(world, { ...u, x: x + 0.5, y: y + 0.5 }, t); });
      if (!cand) continue; taken.add(tileKey(world, cand[0], cand[1]));
      u.path = [{ x: cand[0] + 0.5, y: cand[1] + 0.5 }]; u.goal = tileKey(world, cand[0], cand[1]);
      if (u.state === 'idle') u.state = 'moving'; else u.nudge = true;
    }
  }
}
// Simple enemy AI: periodically sends a small raid from its Barracks at the player's nearest building.
export const AI_PERIOD = 120;
export function tickAi(world, spawnUnit) {
  const ai = world.ai; if (!ai || !ai.raids) return;
  if (world.time < ai.nextRaid) return; ai.nextRaid = world.time + AI_PERIOD;
  const rax = world.buildings.find(b => b.owner === 'enemy' && b.type === 'barracks'); if (!rax) return;
  const raid = ['militia', 'militia', 'spearman'].map(type => spawnUnit(world, rax, type, 'enemy'));
  const tgt = world.buildings.filter(b => b.owner === 'player').sort((a, b) => distTo(center(rax), a) - distTo(center(rax), b))[0];
  for (const u of raid) if (tgt) orderAttack(world, u, tgt, false);
  ai.raidsSent = (ai.raidsSent || 0) + 1; world.message = { text: 'Enemy raid incoming!', until: world.time + 4 };
}
