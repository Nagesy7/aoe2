// Combat headless tests. Run: node tests/combat.test.mjs  (log -> proof/combat-test.log)
import * as S from '../src/sim.js';
import { UNITS } from '../src/techtree.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { createWorld, tick, spawnEnemy, select, selectUnits, commandAt, damageFor, orderAttack, selectionInfo, addBuilding, buildGrid } = S;
const lines = []; let fail = 0, pass = 0;
const log = s => { console.log(s); lines.push(s); };
const assert = (c, m) => { log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };
const run = (w, secs, step = 0.05) => { for (let t = 0; t < secs; t += step) tick(w, step); };
const runUntil = (w, pred, max, step = 0.05) => { for (let t = 0; t < max; t += step) { if (pred()) return true; tick(w, step); } return pred(); };
// empty arena: no resources, no starting villagers, rich stockpile
const arena = () => { const w = createWorld({ villagers: 0, stockpile: { food: 9999, wood: 9999, gold: 9999, stone: 9999 } }); w.resources = []; w.animals = []; return w; };
const mk = (w, type, x, y, owner = 'player') => { const u = spawnEnemy(w, type, x, y); u.owner = owner; return u; };
const tileOf = u => `${Math.floor(u.x)},${Math.floor(u.y)}`;
log(`combat test ${new Date().toISOString()}`);

log('--- stats & damage formula ---');
{
  const w = arena();
  assert(UNITS.militia.hp === 40 && UNITS.militia.attack === 4 && UNITS.militia.armor === '0/1' && UNITS.militia.reload === 2, 'Militia: 40 HP, 4 atk, 0/1 armor, 2.0s reload');
  assert(UNITS.archer.hp === 30 && UNITS.archer.attack === 4 && UNITS.archer.range === 4 && UNITS.archer.reload === 2, 'Archer: 30 HP, 4 pierce atk, range 4, 2.0s reload');
  assert(UNITS.spearman.hp === 45 && UNITS.spearman.attack === 3 && UNITS.spearman.bonus.cavalry === 15 && UNITS.spearman.reload === 3, 'Spearman: 45 HP, 3 atk, +15 vs cavalry, 3.0s reload');
  const m = mk(w, 'militia', 10.5, 10.5), e = mk(w, 'militia', 11.5, 10.5, 'enemy'), a = mk(w, 'archer', 20.5, 20.5), sp = mk(w, 'spearman', 30.5, 10.5), sc = mk(w, 'scout_cavalry', 30.5, 12.5, 'enemy'), kn = mk(w, 'knight', 40.5, 10.5, 'enemy');
  assert(damageFor(w, m, e) === 4, 'militia vs militia: 4 melee - 0 melee armor = 4');
  assert(damageFor(w, a, e) === 3, 'archer vs militia: 4 pierce - 1 pierce armor = 3');
  assert(damageFor(w, sp, sc) === 18, 'spearman vs scout: 3 + 15 bonus - 0 = 18');
  assert(damageFor(w, sp, kn) === 16, 'spearman vs knight: 3 + 15 - 2 = 16');
  assert(damageFor(w, m, kn) === 2, 'militia vs knight: 4 - 2 = 2');
  const vil = mk(w, 'villager', 50.5, 50.5); const tc = w.buildings[0];
  assert(damageFor(w, a, tc) === 1 && damageFor(w, vil, tc) === 1, 'minimum damage is 1 (archer / villager vs Town Center 3/5 armor)');
  assert(damageFor(w, m, { type: 'house', size: 2 }) === 4 && damageFor(w, a, { type: 'house', size: 2 }) === 1, 'house: militia 4 (0 melee armor), archer 1 (7 pierce armor)');
}

log('--- melee duel: damage per reload, death at 0 HP removes unit ---');
{
  const w = arena(); const m = mk(w, 'militia', 10.5, 10.5), e = mk(w, 'militia', 11.5, 10.5, 'enemy'); e.state = 'idle';
  e.hp = 40; w.nextAggro = 1e9; // disable auto aggro for a clean count
  orderAttack(w, m, e); run(w, 0.05);
  assert(e.hp === 36, `first hit immediately: enemy HP 40 -> ${e.hp}`);
  run(w, 1.9); assert(e.hp === 36, 'no second hit before 2.0s reload');
  run(w, 0.2); assert(e.hp === 32, `second hit after reload (HP ${e.hp})`);
  assert(e.state === 'attacking' && e.attack.id === m.id, 'victim retaliates against attacker');
  const died = runUntil(w, () => !w.units.includes(e) || !w.units.includes(m), 40);
  assert(died, 'one militia dies');
  const dead = w.deaths[0]; assert(dead && (dead.id === e.id || dead.id === m.id), `death recorded (${dead?.type} id ${dead?.id})`);
  assert(!w.units.some(u => u.hp <= 0), 'no units at <= 0 HP remain in world.units');
  const survivor = w.units.find(u => u.type === 'militia'); run(w, 0.5); assert(survivor && survivor.state === 'idle', 'survivor goes idle when no enemies remain');
}

log('--- ranged vs melee ---');
{
  const w = arena(); const a = mk(w, 'archer', 10.5, 10.5), e = mk(w, 'militia', 30.5, 10.5, 'enemy');
  select(w, a); const r = commandAt(w, e.x, e.y); assert(r === 'attack', `right-click on enemy unit = attack (${r})`);
  let fired = runUntil(w, () => (w.projectiles || []).length > 0, 20); const ax = a.x;
  const d = Math.hypot(a.x - e.x, a.y - e.y);
  assert(fired && d <= 4.6 && d > 1.6, `archer fires from range (${d.toFixed(2)} tiles, not melee distance)`);
  const hp0 = e.hp; runUntil(w, () => e.hp < hp0, 3); assert(hp0 - e.hp === 3, `arrow lands as projectile for 3 dmg (4 pierce - 1)`);
  // fresh duel: archer at range 4 vs militia closing in
  const w2 = arena(); const a2 = mk(w2, 'archer', 10.5, 10.5), m2 = mk(w2, 'militia', 14.5, 10.5, 'enemy');
  orderAttack(w2, a2, m2); orderAttack(w2, m2, a2); runUntil(w2, () => !w2.units.includes(a2) || !w2.units.includes(m2), 60);
  assert(!w2.units.includes(a2) && w2.units.includes(m2) && m2.hp < 40, `militia that closes the gap beats a lone archer (militia HP left ${m2.hp})`);
  const w3 = arena(); const as = [mk(w3, 'archer', 10.5, 10.5), mk(w3, 'archer', 10.5, 11.5), mk(w3, 'archer', 10.5, 12.5)], m3 = mk(w3, 'militia', 16.5, 11.5, 'enemy');
  for (const x of as) orderAttack(w3, x, m3); runUntil(w3, () => !w3.units.includes(m3), 60);
  assert(!w3.units.includes(m3) && as.every(x => w3.units.includes(x)), 'three archers kill a militia before it reaches them');
}

log('--- pathing around obstacles to target, chase + re-path ---');
{
  const w = arena();
  // wall of houses between attacker and target, with a gap at the bottom
  for (let y = 4; y < 20; y += 2) addBuilding(w, 'house', 20, y, true);
  const m = mk(w, 'militia', 15.5, 10.5), e = mk(w, 'spearman', 25.5, 10.5, 'enemy'); w.nextAggro = 1e9;
  orderAttack(w, m, e);
  const grid = buildGrid(w); assert(m.path.length > 0 && m.path.every(p => !grid[Math.floor(p.y) * w.width + Math.floor(p.x)]), `path (${m.path.length} steps) avoids the wall`);
  assert(m.path.some(p => p.y >= 20 || p.y < 4), 'path detours around an end of the wall');
  let inside = 0; const ok = runUntil(w, () => { if (grid[Math.floor(m.y) * w.width + Math.floor(m.x)]) inside++; return e.hp < 45; }, 30);
  assert(ok && inside === 0, 'attacker reaches target around the wall and hits it, never entering buildings');
  // chase: target walks away; attacker re-paths
  const w2 = arena(); const c = mk(w2, 'militia', 10.5, 30.5), r = mk(w2, 'villager', 14.5, 30.5, 'enemy'); w2.nextAggro = 1e9;
  orderAttack(w2, c, r); S.orderMove(w2, r, 14.5, 50.5, [14, 50]); const g0 = c.path.at(-1);
  run(w2, 3); const g1 = c.path.at(-1) || { x: c.x, y: c.y };
  assert(g0 && Math.hypot(g1.x - g0.x, g1.y - g0.y) > 2, `attacker re-paths after moving target (goal ${g0.x},${g0.y} -> ${g1.x.toFixed(1)},${g1.y.toFixed(1)})`);
  const caught = runUntil(w2, () => r.hp < 25, 30); assert(caught, 'faster-chasing attacker catches and hits the moving target');
  // stuck detection: block next waypoint with a new building -> re-plan
  const w3 = arena(); const s = mk(w3, 'militia', 10.5, 40.5); S.orderMove(w3, s, 30.5, 40.5, [30, 40]); run(w3, 0.5);
  addBuilding(w3, 'house', Math.floor(s.path[1].x), Math.floor(s.path[1].y) - 1, true);
  run(w3, 15); assert(Math.floor(s.x) === 30 && Math.floor(s.y) === 40 && s.stuckRepaths >= 1, `blocked waypoint detected, re-pathed (${s.stuckRepaths}) and arrived`);
}

log('--- group move: formation, no stacking ---');
{
  const w = arena(); const us = [];
  for (let i = 0; i < 9; i++) us.push(mk(w, i % 3 ? 'militia' : 'archer', 10.5 + (i % 3), 40.5 + Math.floor(i / 3)));
  selectUnits(w, us); assert(commandAt(w, 30.5, 45.5) === 'move', 'group right-click ground = move');
  const goals = new Set(us.map(u => u.goal)); assert(goals.size === 9, '9 distinct formation goal tiles');
  run(w, 20); const tiles = new Set(us.map(tileOf));
  assert(tiles.size === 9 && us.every(u => u.state === 'idle'), `9 units on 9 distinct tiles after the move (${[...tiles].join(' ')})`);
  assert(us.every(u => Math.abs(u.x - 30.5) <= 2.5 && Math.abs(u.y - 45.5) <= 2.5), 'formation is a compact block around the click');
  // forced stack: separation spreads them
  const w2 = arena(); const st = [0, 1, 2, 3].map(() => mk(w2, 'spearman', 20.5, 20.5)); run(w2, 3);
  assert(new Set(st.map(tileOf)).size === 4, `4 units spawned on one tile separate to 4 tiles (${st.map(tileOf).join(' ')})`);
  // group attack: melee spread around the target
  const w3 = arena(); const g = [0, 1, 2, 3].map(i => mk(w3, 'militia', 10.5 + i, 10.5)), tgt = mk(w3, 'knight', 20.5, 10.5, 'enemy'); tgt.hp = 1000; tgt.maxHp = 1000;
  selectUnits(w3, g); commandAt(w3, tgt.x, tgt.y); run(w3, 8);
  assert(g.every(u => u.state === 'attacking') && new Set(g.map(tileOf)).size === 4 && tgt.hp < 1000, `4 attackers surround target on distinct tiles (${g.map(tileOf).join(' ')})`);
}

log('--- buildings can be attacked and destroyed ---');
{
  const w = arena(); const h = addBuilding(w, 'house', 30, 30, true, 'enemy'); const ms = [mk(w, 'militia', 25.5, 30.5), mk(w, 'militia', 25.5, 31.5), mk(w, 'militia', 25.5, 32.5)];
  selectUnits(w, ms); assert(commandAt(w, 31, 31) === 'attack', 'right-click enemy building = attack');
  const hp0 = h.hp; run(w, 6); assert(h.hp < hp0, `house taking damage (${h.hp}/${hp0})`);
  const gone = runUntil(w, () => !w.buildings.includes(h), 200);
  assert(gone && w.deaths.some(d => d.id === h.id && d.building), `house destroyed at t=${w.time.toFixed(1)}s and removed`);
  const grid = buildGrid(w); assert(!grid[30 * w.width + 30], 'destroyed building footprint is walkable again');
  run(w, 1); assert(ms.every(u => u.state === 'idle'), 'attackers go idle afterwards');
  const sel = arena(); const eb = addBuilding(sel, 'barracks', 20, 20, true, 'enemy'); sel.selection = { kind: 'building', id: eb.id };
  const info = selectionInfo(sel); assert(/Enemy/.test(info.title) && info.lines.some(l => /Armor 0\/7/.test(l)), `enemy building info: ${info.title} | ${info.lines.join(' | ')}`);
  assert(S.trainUnit(sel, eb, 'militia').ok === false, 'cannot train from an enemy Barracks');
  assert(S.popCap(sel) === 5, 'enemy houses do not raise player pop cap');
}

log('--- aggro: idle units auto-acquire; villagers do not; leash ---');
{
  const w = arena(); const m = mk(w, 'militia', 10.5, 10.5), e = mk(w, 'militia', 15.5, 10.5, 'enemy'), far = mk(w, 'archer', 40.5, 40.5, 'enemy');
  run(w, 0.5); assert(m.state === 'attacking' && m.attack.id === e.id && m.attack.auto, 'idle player militia auto-acquires enemy within 6 tiles');
  assert(e.state === 'attacking' && e.attack.id === m.id, 'idle enemy militia auto-acquires too');
  assert(far.state === 'idle', 'enemy beyond line of sight stays idle');
  const w2 = arena(); const v = mk(w2, 'villager', 10.5, 10.5), e2 = mk(w2, 'spearman', 13.5, 10.5, 'enemy');
  run(w2, 0.5); assert(v.state === 'idle' && e2.state === 'attacking' && e2.attack.id === v.id, 'villagers do not auto-attack but enemy military targets them');
  runUntil(w2, () => !w2.units.includes(v), 40); assert(!w2.units.includes(v), 'undefended villager killed');
  // moving units ignore aggro (move = move)
  const w3 = arena(); const mv = mk(w3, 'militia', 10.5, 20.5); mk(w3, 'militia', 14.5, 22.5, 'enemy').hp = 999; S.orderMove(w3, mv, 30.5, 20.5, [30, 20]); run(w3, 0.3);
  assert(mv.state === 'moving', 'unit under a move order does not divert to aggro');
  // the full enemy camp
  const w4 = createWorld({ enemy: true }); const camp = w4.units.filter(u => u.owner === 'enemy');
  assert(camp.length === 4 && w4.buildings.filter(b => b.owner === 'enemy').length === 3, 'createWorld({enemy:true}) adds a 3-building enemy camp with 4 guards');
  assert(S.popCount(w4) === 3, 'enemy units do not count toward player population');
  run(w4, 10); assert(camp.every(u => u.state === 'idle') && w4.units.filter(u => u.owner === 'player').every(u => u.hp === u.maxHp), 'camp guards stay home while the player is out of sight');
  const w5 = createWorld({ enemy: true, raids: true }); w5.ai.nextRaid = 1; run(w5, 1.2);
  assert(w5.ai.raidsSent === 1 && w5.units.filter(u => u.owner === 'enemy' && u.state === 'attacking').length >= 3, 'AI raid: 3 units sent to attack the player');
}

log(`RESULT: ${fail ? `${fail} FAILED, ${pass} passed` : `ALL ${pass} PASSED`}`);
const root = fileURLToPath(new URL('..', import.meta.url)); mkdirSync(root + 'proof', { recursive: true }); writeFileSync(root + 'proof/combat-test.log', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
