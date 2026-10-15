// Computer opponent: a full economic + military player that only acts through the same lockstep commands a human issues
// (applyCommand), so it is deterministic, works in single player, and AI-vs-AI runs are used for the civ balance sim.
// It gathers, keeps villagers training, builds houses/drop sites/farms, military buildings, ages up, researches,
// trains a civ-flavoured army, defends its base (garrisoning villagers when raided) and attacks in waves.
import { applyCommand, withPlayer, canPlace, buildGrid, walkable, popCount, popCap, queuedCount, ageStatus, canAgeUp, canResearch,
  OWNERS, hyp, isMilitary, unitCost, nextAge, BUILDING_DEFS, UNIT_DEFS, TECHS } from './sim.js';
import { AGES, AGE_UPS, ageIndex } from './techtree.js';
const AGE_COST = a => (a && AGE_UPS[a] ? AGE_UPS[a].cost : {});
import { CIVS, civOf } from './civs.js';

const VIL_TARGET = { dark: 20, feudal: 28, castle: 36, imperial: 40 };
const RATIO = { dark: { food: 0.6, wood: 0.4, gold: 0, stone: 0 }, feudal: { food: 0.42, wood: 0.33, gold: 0.2, stone: 0.05 },
  castle: { food: 0.38, wood: 0.27, gold: 0.25, stone: 0.1 }, imperial: { food: 0.38, wood: 0.27, gold: 0.27, stone: 0.08 } };
const ATTACK_SIZE = { dark: 99, feudal: 8, castle: 14, imperial: 18 };
const ECO_TECHS = ['loom', 'double_bit_axe', 'horse_collar', 'wheelbarrow', 'gold_mining', 'bow_saw', 'heavy_plow', 'gold_shaft_mining', 'hand_cart', 'two_man_saw', 'crop_rotation'];
const MIL_TECHS = ['forging', 'lacquer_plates', 'fletched_arrows', 'quilted_vests', 'blade_paw', 'iron_casting', 'lamellar_plates', 'barbed_arrows', 'crossbowman', 'halberd_pup', 'swift_rider', 'blast_furnace', 'kabuto_plates'];
const TRAINER = { militia: 'barracks', spearman: 'barracks', archer: 'archery_range', scout_cavalry: 'stable', knight: 'stable' };

// Make owners computer-controlled: setupComputers(world, { enemy: 'kishu' }) (civ ids).
export function setupComputers(world, civs) {
  world.computers = {}; world.victory = true;
  for (const [owner, civ] of Object.entries(civs)) { world.computers[owner] = { civ, mem: { attacking: false, wave: 0, armyIdx: 0, lastAttack: -999 } }; if (civ) world.players[owner].civ = civ; }
}
export function tickComputers(world) {
  if (!world.computers || world.winner) return;
  for (const owner of Object.keys(world.computers)) {
    const idx = OWNERS.indexOf(owner); if ((world.tick || 0) % 20 !== idx * 10) continue; // think once per second, players staggered
    try { think(world, owner, world.computers[owner].mem); } finally { world.cur = 'player'; }
  }
}
// Conquest: a player whose Den Halls and Fortresses are all destroyed is defeated.
export function checkVictory(world) {
  if (!world.victory || world.winner) return;
  const alive = OWNERS.filter(o => world.buildings.some(b => b.owner === o && (b.type === 'town_center' || b.type === 'castle')));
  if (alive.length === 1) { world.winner = alive[0]; world.winTime = world.time;
    world.banner = { text: world.viewer && world.viewer !== alive[0] ? 'Defeat! Your Den Hall has fallen.' : (world.viewer || 'player') === alive[0] ? 'Victory!' : 'Game over', until: world.time + 9999 }; }
}
// Score for time-limited games: value of everything alive + stockpile.
export function score(world, owner) {
  const val = c => Object.values(c || {}).reduce((t, v) => t + v, 0);
  return world.units.filter(u => u.owner === owner).reduce((t, u) => t + val(UNIT_DEFS[u.type].cost), 0)
    + world.buildings.filter(b => b.owner === owner && b.complete).reduce((t, b) => t + val(BUILDING_DEFS[b.type].cost) * b.hp / b.maxHp, 0)
    + val(world.players[owner].stockpile) + 100 * ageIndex(world.players[owner].age);
}

function think(world, owner, mem) {
  const pi = OWNERS.indexOf(owner), civ = civOf(world, owner), P = world.players[owner];
  const cmd = (type, args) => applyCommand(world, { tick: world.tick, player: pi, type, args });
  const units = world.units.filter(u => u.owner === owner), vills = units.filter(u => u.type === 'villager');
  const mine = world.buildings.filter(b => b.owner === owner), done = t => mine.filter(b => b.type === t && b.complete), any = t => mine.filter(b => b.type === t);
  const tc = mine.find(b => b.type === 'town_center'); if (!tc) return;
  const age = P.age, home = { x: tc.x + tc.size / 2, y: tc.y + tc.size / 2 };
  const foeOwner = OWNERS.find(o => o !== owner);
  const has = c => withPlayer(world, owner, () => Object.entries(c).every(([r, v]) => P.stockpile[r] >= v));
  const room = () => withPlayer(world, owner, () => popCap(world) - popCount(world) - queuedCount(world));

  // --- defence: enemies near the base ---
  const threats = world.units.filter(u => u.owner === foeOwner && u.state !== 'garrisoned' && hyp(u.x - home.x, u.y - home.y) < 14);
  const army = units.filter(u => isMilitary(u) && u.state !== 'garrisoned');
  const milThreat = threats.filter(isMilitary).length;
  if (milThreat >= 3 && milThreat > army.length) { // hide villagers near the hall
    const near = vills.filter(v => v.state !== 'garrisoned' && hyp(v.x - home.x, v.y - home.y) < 12).slice(0, tc.garrisonCap - tc.garrison.length);
    if (near.length) cmd('garrison', { id: tc.id, ids: near.map(v => v.id) }); mem.hiding = true;
  } else if (mem.hiding && milThreat === 0) { cmd('ungarrison', { id: tc.id }); mem.hiding = false; }
  if (threats.length) {
    const t = threats[0], idle = army.filter(u => u.state === 'idle' || u.state === 'moving' || (mem.attacking && u.state !== 'attacking'));
    if (idle.length) cmd('order', { ids: idle.map(u => u.id), x: t.x, y: t.y, amove: true });
  }

  // --- villagers ---
  const working = vills.filter(v => v.state !== 'garrisoned');
  const count = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const v of working) { const n = world.resources.find(r => r.id === v.target); const r = n ? n.res : v.carry.res; if (r && v.state !== 'idle') count[r]++; }
  const ratio = { ...RATIO[age] }; // lean away from resources already piling up, toward what the next age costs
  const nxA = AGES[ageIndex(age) + 1]; if (nxA && vills.length >= 14) for (const [r, v] of Object.entries(AGE_COST(nxA))) if (P.stockpile[r] < v) ratio[r] += 0.2;
  for (const r in ratio) if (P.stockpile[r] > 700) ratio[r] *= 0.35; { const t = Object.values(ratio).reduce((a, b) => a + b, 0) || 1; for (const r in ratio) ratio[r] /= t; }
  const want = r => ratio[r] * working.length;
  // rebalance up to two busy gatherers per second from surplus to deficit
  for (let k = 0; k < 2; k++) {
    const res = Object.keys(ratio), def = res.sort((a, b) => (count[a] - want(a)) - (count[b] - want(b)))[0], sur = res[res.length - 1];
    if (!(want(def) - count[def] > 1 && count[sur] - want(sur) > 1)) break;
    const v = working.find(v => v.state === 'gathering' && v.carry.res === sur && v.carry.amount <= 3 && world.resources.find(n => n.id === v.target)?.kind !== 'farm'); if (!v) break;
    const node = nearestNode(world, owner, v, def, home);
    if (node) cmd('order', { ids: [v.id], x: node.x, y: node.y });
    else if (!(def === 'food' && has({ wood: 60 }) && buildNear(world, owner, cmd, 'farm', home, tc.size, [v]))) break;
    count[def]++; count[sur]--;
  }
  for (const v of working.filter(v => v.state === 'idle')) {
    const res = Object.keys(ratio).filter(r => ratio[r] > 0).sort((a, b) => (count[a] - want(a)) - (count[b] - want(b)))[0];
    const node = nearestNode(world, owner, v, res, home);
    if (node) { cmd('order', { ids: [v.id], x: node.x, y: node.y }); count[res]++; }
    else if (res === 'food') { if (!buildNear(world, owner, cmd, 'farm', home, tc.size, [v])) gatherAny(world, owner, cmd, v, home); }
    else gatherAny(world, owner, cmd, v, home);
  }
  // keep farms coming once wild food runs out
  const foodNodes = world.resources.filter(n => n.res === 'food' && n.amount > 0 && n.kind !== 'farm' && hyp(n.x - home.x, n.y - home.y) < 16).length;
  if (!foodNodes && count.food < want('food') - 1 && has({ wood: 60 })) {
    const v = pick(working, 'wood') || working[0]; if (v) buildNear(world, owner, cmd, 'farm', home, tc.size, [v]);
  }
  // --- age up ---
  const nx = nextAge(world.players[owner] ? { age } : world);
  const ageReady = nx && withPlayer(world, owner, () => canAgeUp(world, tc).ok);
  const minVil = { feudal: 16, castle: 24, imperial: 30 }[nx] || 99;
  if (ageReady && vills.length >= minVil) cmd('ageup', { id: tc.id });
  const saving = nx && vills.length >= minVil - 2 && withPlayer(world, owner, () => ageStatus(world).ok);
  // --- villager production ---
  if (vills.length < VIL_TARGET[age] && !(saving && vills.length >= minVil && !has(AGE_COST(nx))) && tc.queue.length < 2 && !tc.queue.some(q => q.startsWith('age:')) && room() > 0 && has({ food: 50 })) cmd('train', { id: tc.id, unit: 'villager' });
  // --- houses ---
  const building = t => any(t).some(b => !b.complete);
  const cap = withPlayer(world, owner, () => popCap(world));
  const housing = any('house').filter(b => !b.complete).length;
  if (cap < 200 && room() <= 3 + 3 * ageIndex(age) && housing < 1 + (ageIndex(age) >= 1 ? 1 : 0) && has({ wood: 25 })) { const v = pick(working, 'wood'), v2 = v && pick(working.filter(o => o !== v), 'wood'); if (v) buildNear(world, owner, cmd, 'house', home, tc.size + 5, [v, ...(v2 && vills.length > 12 ? [v2] : [])], 18); }
  // --- drop sites ---
  for (const [t, res, need] of [['lumber_camp', 'wood', 3], ['mill', 'food', 3], ['mining_camp', 'gold', 2], ['mining_camp', 'stone', 2]]) {
    if (count[res] < need || building(t) || !has(BUILDING_DEFS[t].cost)) continue;
    const gs = working.filter(v => { const n = world.resources.find(r => r.id === v.target); return n && n.res === res && n.kind !== 'farm'; }); if (!gs.length) continue;
    const n = world.resources.find(r => r.id === gs[0].target);
    const nearDrop = world.buildings.some(b => b.owner === owner && b.accepts.includes(res) && hyp(b.x + b.size / 2 - n.x, b.y + b.size / 2 - n.y) < 8);
    if (!nearDrop) { buildNear(world, owner, cmd, t, n, 1, [gs[0]], 3); break; }
  }
  // --- tech-tree progression (buildings) ---
  const plan = [];
  if (vills.length >= 11) plan.push('barracks');
  if (ageIndex(age) >= 1) { plan.push('archery_range', 'blacksmith'); if (civ.ai.army.includes('scout_cavalry')) plan.push('stable'); }
  if (ageIndex(age) >= 2) { plan.push('university'); if (P.stockpile.stone >= 650 || any('castle').length) plan.push('castle'); plan.push('monastery'); }
  if (ageIndex(age) >= 1 && vills.length >= 24) plan.push(civ.ai.army.includes('archer') ? 'archery_range' : 'barracks');
  const wantB = {}; for (const t of plan) wantB[t] = (wantB[t] || 0) + 1;
  for (const [t, n] of Object.entries(wantB)) {
    if (any(t).length >= n || building(t) || !has(BUILDING_DEFS[t].cost)) continue;
    if (BUILDING_DEFS[t].age && ageIndex(BUILDING_DEFS[t].age) > ageIndex(age)) continue;
    const v = pick(working, 'wood'); if (v && buildNear(world, owner, cmd, t, home, tc.size + 6, [v], 20)) break;
  }
  // --- research ---
  for (const id of [...ECO_TECHS, ...MIL_TECHS]) {
    const t = TECHS[id], b = done(t.at)[0]; if (!b || b.queue.length) continue;
    if (saving && t.at === 'town_center') continue;
    const ok = withPlayer(world, owner, () => canResearch(world, b, id).ok);
    if (ok && (!saving || ECO_TECHS.includes(id))) { cmd('research', { id: b.id, tech: id }); }
  }
  // --- army ---
  if (ageIndex(age) >= 1 || threats.length) {
    const mix = [...civ.ai.army]; const uu = ageIndex(age) >= 2 && done('castle').length ? civ.unique : null;
    for (const b of mine.filter(b => b.complete && ['barracks', 'archery_range', 'stable', 'castle'].includes(b.type))) {
      if (b.queue.length >= 2 || room() <= 0) continue;
      let unit = b.type === 'castle' ? uu : null;
      if (!unit) { const opts = mix.filter(u => TRAINER[u] === b.type).concat(b.type === 'stable' && ageIndex(age) >= 2 ? ['knight'] : []); if (!opts.length) { if (b.type === 'barracks') opts.push('spearman'); else continue; }
        unit = opts[mem.armyIdx++ % opts.length]; }
      if (!unit || ageIndex(UNIT_DEFS[unit].age) > ageIndex(age)) unit = b.type === 'barracks' ? 'militia' : null; if (!unit) continue;
      if (saving && (UNIT_DEFS[unit].cost.food || 0) > 0 && !threats.length) continue;
      if (has(withPlayer(world, owner, () => unitCost(world, unit, b)))) cmd('train', { id: b.id, unit });
    }
  }
  // --- attack waves ---
  const foeTc = world.buildings.find(b => b.owner === foeOwner && (b.type === 'town_center' || b.type === 'castle'));
  if (!threats.length && foeTc) {
    if (!mem.attacking && army.length >= ATTACK_SIZE[age]) { mem.attacking = true; mem.wave++; mem.lastAttack = world.time; }
    if (mem.attacking && army.length < 3) { mem.attacking = false; cmd('order', { ids: army.map(u => u.id), x: home.x + 3, y: home.y + 3 }); }
    if (mem.attacking) { const idle = army.filter(u => u.state === 'idle'); // approach the side of the enemy hall that faces our base (symmetric for both map sides)
      const fx = foeTc.x + foeTc.size / 2, fy = foeTc.y + foeTc.size / 2, dx = home.x - fx, dy = home.y - fy, d = hyp(dx, dy) || 1, k = foeTc.size / 2 + 1.5;
      if (idle.length) cmd('order', { ids: idle.map(u => u.id), x: fx + dx / d * k, y: fy + dy / d * k, amove: true }); }
  }
}
function pick(vills, res) {
  return vills.find(v => v.state === 'gathering' && v.carry.res === res && v.carry.amount < 4) || vills.find(v => v.state === 'gathering' || v.state === 'idle');
}
function nearestNode(world, owner, v, res, home) {
  let best = null, bd = 1e9;
  for (const n of world.resources) {
    if (n.res !== res || n.amount <= 0) continue;
    if (n.farm) { const b = world.buildings.find(o => o.id === n.farm); if (!b || b.owner !== owner || world.units.some(u => u.target === n.id && u !== v)) continue; }
    const d = hyp(n.x - v.x, n.y - v.y) + 0.5 * hyp(n.x - home.x, n.y - home.y); if (d < bd) { bd = d; best = n; }
  }
  return bd < 60 ? best : null;
}
function gatherAny(world, owner, cmd, v, home) {
  for (const r of ['wood', 'food', 'gold', 'stone']) { const n = nearestNode(world, owner, v, r, home); if (n) { cmd('order', { ids: [v.id], x: n.x, y: n.y }); return true; } }
  return false;
}
// Find a placement on rings around `at` (keeping a free 1-tile border so bases never wall themselves in) and issue a build.
export function findSpot(world, owner, type, at, r0 = 1, r1 = 10) {
  const size = BUILDING_DEFS[type].size, grid = buildGrid(world), cx = Math.floor(at.x), cy = Math.floor(at.y - (owner === 'enemy' && Number.isInteger(at.y) ? 1 : 0)), cx2 = owner === 'enemy' && Number.isInteger(at.x) ? cx - 1 : cx;
  for (let r = r0; r <= r1; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    // player 2's search runs point-mirrored so both bases grow the same shape on the mirrored map
    const sx = owner === 'enemy' ? -dx : dx, sy = owner === 'enemy' ? -dy : dy, half = type === 'farm' ? (owner === 'enemy' ? size - 1 : 0) : (owner === 'enemy' ? size - 1 - Math.floor(size / 2) : Math.floor(size / 2));
    const tx = cx2 + sx - half, ty = cy + sy - half;
    if (!withPlayer(world, owner, () => canPlace(world, type, tx, ty))) continue;
    if (type !== 'farm') { let clear = true;
      for (let y = ty - 1; y <= ty + size && clear; y++) for (let x = tx - 1; x <= tx + size; x++) if ((x < tx || y < ty || x >= tx + size || y >= ty + size) && x >= 0 && y >= 0 && x < world.width && y < world.height && !walkable(world, x, y, grid) && !world.buildings.some(b => b.type === 'farm' && x >= b.x && y >= b.y && x < b.x + b.size && y < b.y + b.size)) { clear = false; break; }
      if (!clear) continue; }
    return [tx, ty];
  }
  return null;
}
function buildNear(world, owner, cmd, type, at, r0, builders, r1 = r0 + 8) {
  let spot = type === 'farm' ? findSpot(world, owner, 'farm', owner === 'enemy' ? { x: at.x + 0.5, y: at.y + 0.5 } : { x: at.x - 1.5, y: at.y - 1.5 }, 2, 6) : findSpot(world, owner, type, at, r0, r1);
  if (!spot && type === 'farm') for (const m of world.buildings.filter(b => b.owner === owner && b.type === 'mill' && b.complete)) { spot = findSpot(world, owner, 'farm', owner === 'enemy' ? { x: m.x + m.size - 0.5, y: m.y + m.size - 0.5 } : { x: m.x - 0.5, y: m.y - 0.5 }, 1, 4); if (spot) break; }
  if (!spot && type === 'farm' && !world.buildings.some(b => b.owner === owner && b.type === 'mill' && !b.complete) && withPlayer(world, owner, () => Object.entries(BUILDING_DEFS.mill.cost).every(([r, v]) => world.players[owner].stockpile[r] >= v))) {
    const m = findSpot(world, owner, 'mill', at, 7, 14); if (m) return !!cmd('build', { type: 'mill', tx: m[0], ty: m[1], ids: builders.map(v => v.id) }); }
  if (!spot) return false;
  return !!cmd('build', { type, tx: spot[0], ty: spot[1], ids: builders.map(v => v.id) });
}
export { CIVS };
