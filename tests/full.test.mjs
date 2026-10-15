// Full-RTS headless tests: pathfinding (A* + flow field + formations), unit AI (auto-gather, stances, retaliation,
// computer opponent), construction (multi-builder, repair, garrison, arrows), tech tree (4 ages, forge/eco/unit-line
// techs), civilizations (traits, unique units, cosmetics-only), lockstep determinism (AI-vs-AI), balance report.
// Run: node tests/full.test.mjs   (log -> proof/full-test.log)
import * as S from '../src/sim.js';
import { UNITS, TECHS, AGES, AGE_UPS } from '../src/techtree.js';
import { CIVS, CIV_IDS, COSMETICS } from '../src/civs.js';
import { setupComputers, score, findSpot } from '../src/ai.js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { createWorld, createMpWorld, tick, stepTick, spawnEnemy, selectUnits, commandAt, addBuilding, buildGrid, walkable, findPath, flowField, pathFromField, orderMoveGroup, applyCommand, makeCommand, stateHash, withPlayer, techEffects, unitStats, damageFor, research, trainUnit, unitCost, itemTime } = S;
const lines = []; let fail = 0, pass = 0;
const log = s => { console.log(s); lines.push(s); };
const assert = (c, m) => { log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };
const run = (w, secs) => { for (let t = 0; t < secs; t += 0.05) tick(w, 0.05); };
const steps = (w, secs) => { const n = Math.round(secs * 20); for (let i = 0; i < n; i++) stepTick(w); };
const arena = () => { const w = createWorld({ villagers: 0, stockpile: { food: 9999, wood: 9999, gold: 9999, stone: 9999 } }); w.resources = []; w.animals = []; return w; };
const mk = (w, type, x, y, owner = 'player') => { const u = spawnEnemy(w, type, x, y); u.owner = owner; return u; };
const cmd = (w, player, type, args) => applyCommand(w, makeCommand(type, args, player, w.tick));
log(`full RTS test ${new Date().toISOString()}`);

log('--- 1. pathfinding: A*, obstacles, flow field, formations ---');
{
  const w = arena(); // wall with a single gap at y=40
  for (let y = 0; y < 64; y++) if (y !== 40) w.resources.push({ id: w.nextId++, res: 'wood', kind: 'tree', x: 30.5, y: y + 0.5, amount: 100 });
  const g = buildGrid(w), p = findPath(w, 25, 25, [[35, 25]], g);
  assert(p && p.every(q => walkable(w, Math.floor(q.x), Math.floor(q.y), g)), `A* path (${p && p.length} steps) never enters a blocked tile`);
  assert(p && p.some(q => Math.floor(q.x) === 30 && Math.floor(q.y) === 40), 'A* goes through the only gap in the wall');
  let cut = false; for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], dx = Math.floor(b.x) - Math.floor(a.x), dy = Math.floor(b.y) - Math.floor(a.y);
    if (dx && dy && (!walkable(w, Math.floor(a.x) + dx, Math.floor(a.y), g) || !walkable(w, Math.floor(a.x), Math.floor(a.y) + dy, g))) cut = true; }
  assert(!cut, 'no diagonal corner cutting past obstacles');
  const f = flowField(w, [[35, 25]], g), fp = pathFromField(w, f, 25, 25, g);
  assert(fp && fp.length === p.length && fp.every(q => walkable(w, Math.floor(q.x), Math.floor(q.y), g)), `flow-field path is walkable and as short as A* (${fp && fp.length} vs ${p.length})`);
  assert(Math.abs(f[25 * w.width + 25] - p.reduce((t, q, i) => { const a = i ? p[i - 1] : { x: 25.5, y: 25.5 }; return t + Math.hypot(q.x - a.x, q.y - a.y); }, 0)) < 1e-6, 'flow-field distance equals A* path length');
  // enclosed goal: unreachable from outside
  const box = arena(); for (const [x, y] of S.ringTiles(10, 10, 1)) box.resources.push({ id: box.nextId++, res: 'wood', kind: 'tree', x: x + 0.5, y: y + 0.5, amount: 100 });
  assert(findPath(box, 2, 2, [[10, 10]]) === null && pathFromField(box, flowField(box, [[10, 10]]), 2, 2) === null, 'enclosed tile is unreachable for A* and flow field');
  // big group: flow-field move, distinct destination tiles, nobody walks through the wall, all arrive
  const us = []; for (let i = 0; i < 12; i++) us.push(mk(w, 'militia', 22.5 + (i % 4), 30.5 + Math.floor(i / 4)));
  const n = orderMoveGroup(w, us, 38, 30);
  assert(n === 12 && w.lastFlow && w.lastFlow.units === 12, `12-unit order uses the shared flow field (${n} moving)`);
  assert(new Set(us.map(u => u.goal)).size === 12, 'every unit has its own formation slot');
  let through = false; for (let t = 0; t < 40; t += 0.05) { tick(w, 0.05); for (const u of us) if (!walkable(w, Math.floor(u.x), Math.floor(u.y), g)) through = true; }
  assert(!through, 'no unit ever stood inside a blocked tile during the move');
  assert(us.every(u => u.state === 'idle' && u.x > 31), `all 12 arrived on the far side (${us.filter(u => u.x > 31).length}/12)`);
  assert(new Set(us.map(u => `${Math.floor(u.x)},${Math.floor(u.y)}`)).size === 12, 'separation: 12 units on 12 distinct tiles after arrival');
  const slow = arena(); const g2 = [mk(slow, 'militia', 10.5, 10.5), mk(slow, 'scout_cavalry', 11.5, 10.5), ...[0, 1, 2, 3, 4].map(i => mk(slow, 'militia', 10.5 + i, 11.5))];
  orderMoveGroup(slow, g2, 30, 10); assert(g2.every(u => u.groupSpeed === UNITS.militia.speed), 'formation (flow) moves at the slowest member speed');
}

log('--- 2. unit AI: stances, retaliation, auto-gather ---');
{
  const w = arena(); const a = mk(w, 'militia', 20.5, 20.5), e = mk(w, 'militia', 24.5, 20.5, 'enemy');
  cmd(w, 0, 'stance', { ids: [a.id], stance: 'passive' }); e.stance = 'passive';
  run(w, 2); assert(a.state === 'idle' && a.stance === 'passive', 'No-Attack stance: does not auto-acquire an enemy in sight');
  cmd(w, 0, 'stance', { ids: [a.id], stance: 'stand' }); run(w, 2); assert(a.state === 'idle' && Math.floor(a.x) === 20, 'Stand Ground: never walks to an enemy out of reach');
  cmd(w, 0, 'stance', { ids: [a.id], stance: 'aggressive' }); run(w, 1); assert(a.state === 'attacking', 'Aggressive: acquires the enemy in sight');
  const w2 = arena(); const d = mk(w2, 'spearman', 20.5, 20.5), att = mk(w2, 'archer', 23.5, 20.5, 'enemy'); d.stance = 'defensive'; att.stance = 'passive';
  S.orderAttack(w2, att, d); run(w2, 4); assert(d.state === 'attacking' && d.attack.id === att.id, 'auto-retaliate: a unit that is shot fights back');
  // villager auto-gather: depleted node -> next node of the same type
  const w3 = createWorld({ villagers: 1, stockpile: { food: 0, wood: 0, gold: 0, stone: 0 } }); const v = w3.units[0];
  const trees = w3.resources.filter(n => n.kind === 'tree' && n.x < 28 && n.y < 23).slice(0, 2); trees[0].amount = 3;
  S.orderGather(w3, v, trees[0]); run(w3, 60); assert(trees[0].amount <= 0 && v.target !== trees[0].id && ['gathering', 'to_resource', 'to_drop'].includes(v.state), `villager auto-retargets after a tree is exhausted (state ${v.state})`);
}

log('--- 3. construction: multi-builder speed, repair, garrison, arrows ---');
{
  const time = n => { const w = arena(); const vs = []; for (let i = 0; i < n; i++) vs.push(mk(w, 'villager', 40.5 + i, 40.5));
    const b = S.placeBuilding(w, 'barracks', 42, 43, vs); let t = 0; while (!b.complete && t < 200) { tick(w, 0.05); t += 0.05; } return t; };
  const t1 = time(1), t3 = time(3); assert(t3 < t1 * 0.5, `3 builders finish a Dojo much faster than 1 (${t3.toFixed(1)} s vs ${t1.toFixed(1)} s)`);
  const w = arena(); const v = mk(w, 'villager', 30.5, 36.5); const tc = w.buildings[0]; tc.hp = 1400; const w0 = w.stockpile.wood;
  selectUnits(w, [v]); const r = commandAt(w, tc.x + 1, tc.y + 1); run(w, 20);
  assert(r === 'repair' && tc.hp > 1400 && w.stockpile.wood < w0, `right-click damaged Den Hall = repair (HP 1400 -> ${tc.hp}, wood -${w0 - w.stockpile.wood})`);
  const broke = arena(); broke.players.player.stockpile = { food: 0, wood: 0, gold: 0, stone: 0 }; const bv = mk(broke, 'villager', 30.5, 36.5); const btc = broke.buildings[0]; btc.hp = 1000;
  S.orderBuild(broke, bv, btc); run(broke, 10); assert(btc.hp === 1000 && bv.state === 'idle', 'repair stops without resources (no free HP)');
  const vs = [0, 1, 2, 3].map(i => mk(w, 'villager', 30.5 + i, 37.5)); const gr = cmd(w, 0, 'garrison', { id: tc.id, ids: vs.map(u => u.id) }); run(w, 10);
  assert(gr === 'garrison' && tc.garrison.length === 4 && vs.every(u => u.state === 'garrisoned'), `4 Worker Pups garrisoned in the Den Hall (${tc.garrison.length})`);
  const foe = mk(w, 'militia', tc.x + 6.5, tc.y + 2.5, 'enemy'); foe.stance = 'passive'; const hp0 = foe.hp; run(w, 2.2);
  const arrows = (w.combatLog || []).filter(l => l.tgt === foe.id).length;
  assert(arrows === 5 && foe.hp < hp0, `Den Hall fires 1 + 4 garrison = ${arrows} arrows per volley`);
  assert(S.unitAt(w, vs[0].x, vs[0].y) !== vs[0] && !S.unitsInRect(w, 0, 0, 64, 64).includes(vs[0]), 'garrisoned units cannot be clicked, box-selected or targeted');
  const ug = cmd(w, 0, 'ungarrison', { id: tc.id }); assert(ug && ug.n === 4 && vs.every(u => u.state === 'idle') && tc.garrison.length === 0, 'ungarrison releases all 4 next to the building');
  assert(vs.every(u => S.walkable(w, Math.floor(u.x), Math.floor(u.y))), 'released units stand on walkable tiles');
}

log('--- 4. ages + tech tree ---');
{
  assert(AGES.length === 4 && ['feudal', 'castle', 'imperial'].every(a => AGE_UPS[a].cost.food > 0), 'four ages with age-up costs');
  const w = arena(); w.age = 'imperial'; const bs = addBuilding(w, 'blacksmith', 40, 40), br = addBuilding(w, 'barracks', 44, 40), st = addBuilding(w, 'stable', 48, 40);
  const m = mk(w, 'militia', 20.5, 20.5), ar = mk(w, 'archer', 21.5, 20.5), e = mk(w, 'militia', 30.5, 30.5, 'enemy');
  const s0 = unitStats(w, m), a0 = unitStats(w, ar);
  for (const t of ['forging', 'lacquer_plates', 'fletched_arrows', 'quilted_vests']) w.researched[t] = 0;
  const s1 = unitStats(w, m), a1 = unitStats(w, ar);
  assert(s1.attack === s0.attack + 1 && s1.armor.melee === s0.armor.melee + 1 && s1.armor.pierce === s0.armor.pierce + 1, `Forge: infantry +1 attack, +1/+1 armor (${JSON.stringify(s1.armor)})`);
  assert(a1.attack === a0.attack + 1 && a1.range === a0.range + 1 && a1.armor.pierce === a0.armor.pierce + 1, `Forge: archers +1 attack +1 range +1/+1 armor (range ${a1.range})`);
  assert(damageFor(w, e, m) === Math.max(1, 4 - s1.armor.melee), 'armor techs reduce incoming damage');
  const r = research(w, br, 'blade_paw'); run(w, 41); assert(r.ok && m.type === 'blade_paw' && m.maxHp === UNITS.blade_paw.hp, 'unit-line upgrade: Footpaw -> Blade Paw (existing units upgraded)');
  assert(trainUnit(w, br, 'militia').unit === 'blade_paw', 'Dojo now trains Blade Paws');
  research(w, st, 'swift_rider'); run(w, 46); assert(trainUnit(w, st, 'scout_cavalry').unit === 'swift_rider', 'Scout Rider line upgrades to Swift Rider');
  const lc = addBuilding(w, 'lumber_camp', 52, 40); research(w, lc, 'double_bit_axe'); run(w, 26); research(w, lc, 'bow_saw'); run(w, 51);
  assert(S.gatherRate(w, 'tree') > S.GATHER_RATES.tree * 1.39, `economy techs stack (wood rate x${(S.gatherRate(w, 'tree') / S.GATHER_RATES.tree).toFixed(2)})`);
  assert(Object.keys(TECHS).length >= 27 && Object.values(TECHS).every(t => t.name && !/Double-Bit|Wheelbarrow|Loom|Blast Furnace|Bodkin|Fletching/.test(t.name)), `tech tree has ${Object.keys(TECHS).length} techs with original names`);
}

log('--- 5. civilizations: traits, unique units, no pay-to-win ---');
{
  assert(CIV_IDS.length === 6 && CIV_IDS.every(id => CIVS[id].unique && UNITS[CIVS[id].unique].unique === id), '6 clans, each with its own unique unit');
  const mkCiv = civ => { const w = createMpWorld({ seed: 3 }); w.players.player.civ = civ; return w; };
  { const w = mkCiv('kishu'); const a = mk(w, 'archer', 30.5, 30.5); assert(unitStats(w, a).range === UNITS.archer.range + 1, 'Kishu: archers +1 range'); }
  { const w = mkCiv('shikoku'); const st = addBuilding(w, 'stable', 30, 30); assert(unitCost(w, 'scout_cavalry', st).food === 40, 'Shikoku: Paddock units 50% cheaper (80 -> 40 food)');
    w.players.enemy.civ = 'shikoku'; const s = mk(w, 'scout_cavalry', 30.5, 36.5); assert(Math.abs(s.speed - UNITS.scout_cavalry.speed * 1.15) < 1e-9, 'Shikoku: cavalry +15% speed'); }
  { const w = mkCiv('akita'); const tc = w.buildings.find(b => b.owner === 'player'); assert(Math.abs(itemTime('age:feudal', w, tc) - 130 * 0.94) < 1e-9, 'Akita: Pack Age researched 6% faster (130 -> 122.2 s)'); }
  { const w = mkCiv('hokkaido'); const h = addBuilding(w, 'house', 30, 30); assert(h.maxHp === Math.round(550 * 1.10) && techEffects(w, 'player').buildSpeedPct === 20, 'Hokkaido: buildings +10% HP, build 20% faster'); }
  { const w = mkCiv('kai'); const br = addBuilding(w, 'barracks', 30, 30); assert(Math.abs(itemTime('militia', w, br) - UNITS.militia.time * 0.70) < 1e-9, 'Kai: Dojo trains 30% faster'); }
  { const w = mkCiv('shiba'); assert(S.gatherRate(w, 'tree') > S.GATHER_RATES.tree, 'Shiba: lumber +8%'); }
  { const w = mkCiv('kai'); w.players.player.age = 'castle'; const c = addBuilding(w, 'castle', 30, 30);
    assert(c.trains.includes('brindle_striker') && !c.trains.includes('red_fang'), 'Fortress trains only the own clan unique unit');
    w.players.player.civ = 'shiba'; assert(!trainUnit(w, c, 'red_fang').ok, 'another clan cannot train a unique unit it does not own'); }
  const allKeys = Object.values(COSMETICS).flat();
  assert(allKeys.length === 12 && allKeys.every(c => ['banner', 'coat'].includes(c.kind) && !('effect' in c)), 'Kibble unlocks are cosmetic only (banners/coats, no effects)');
  assert(!CIV_IDS.some(id => 'price' in CIVS[id] || 'locked' in CIVS[id]), 'every clan is free to play (no price / lock on a clan)');
}

log('--- 6. computer opponent (AI-vs-AI, real commands) ---');
{
  const w = createMpWorld({ seed: 5 }); setupComputers(w, { player: 'shiba', enemy: 'kai' });
  const issued = []; const orig = S.applyCommand; // count commands through the stream
  steps(w, 8 * 60);
  const vil = o => w.units.filter(u => u.owner === o && u.type === 'villager').length;
  assert(vil('player') >= 14 && vil('enemy') >= 14, `AI builds an economy: ${vil('player')} / ${vil('enemy')} Worker Pups at 8:00`);
  const types = o => new Set(w.buildings.filter(b => b.owner === o).map(b => b.type));
  assert(['house', 'farm'].every(t => types('player').has(t)) && (types('player').has('lumber_camp') || types('player').has('mill')), `AI builds houses, farms and drop sites (${[...types('player')].join(', ')})`);
  steps(w, 14 * 60);
  assert(w.players.player.age !== 'dark' && w.players.enemy.age !== 'dark', `AI ages up (22:00: ${w.players.player.age} / ${w.players.enemy.age})`);
  const army = o => w.units.filter(u => u.owner === o && S.isMilitary(u)).length;
  assert(army('player') + army('enemy') > 0 || (w.deaths || []).length > 0, `AI trains an army (${army('player')} / ${army('enemy')}, deaths ${(w.deaths || []).length})`);
  steps(w, 10 * 60);
  const fought = (w.deaths || []).filter(d => !d.building).length, raided = (w.deaths || []).filter(d => d.building).length;
  assert(fought > 0, `AI attacks: ${fought} units and ${raided} buildings destroyed by 32:00`);
  assert(score(w, 'player') > 0 && score(w, 'enemy') > 0, `score ${Math.round(score(w, 'player'))} vs ${Math.round(score(w, 'enemy'))}`);
}

log('--- 7. lockstep determinism: two AI-vs-AI clients, 10 min, hash every tick ---');
{
  const A = createMpWorld({ seed: 11 }), B = createMpWorld({ seed: 11 }); B.viewer = 'enemy'; B.cur = 'enemy';
  setupComputers(A, { player: 'kishu', enemy: 'shikoku' }); setupComputers(B, { player: 'kishu', enemy: 'shikoku' });
  let same = 0, first = -1; const N = 10 * 60 * 20;
  for (let t = 0; t < N; t++) { stepTick(A); stepTick(B); if (stateHash(A) === stateHash(B)) same++; else if (first < 0) first = t; }
  assert(same === N, `identical hashes on ${same}/${N} ticks${first >= 0 ? ' (first mismatch ' + first + ')' : ''}`);
  assert(A.units.length > 20, `simulation progressed (${A.units.length} units)`);
  const c = makeCommand('stance', { ids: [1, 2], stance: 'defensive' }, 1, 99); assert(JSON.stringify(S.decodeCommand(S.encodeCommand(c))) === JSON.stringify({ tick: 99, player: 1, type: 'stance', args: { ids: [1, 2], stance: 'defensive' } }), 'new command types round-trip through encode/decode');
}

log('--- 7b. computer economy ---');
{ const { createMpWorld, stepTick } = await import('../src/sim.js'); const { setupComputers } = await import('../src/ai.js');
  const w = createMpWorld({ seed: 2 }); setupComputers(w, { player: 'shiba', enemy: 'kai' }); let feudalAt = null, mills = 0;
  for (let i = 0; i < 15 * 1200; i++) { stepTick(w); if (feudalAt == null && w.players.player.age !== 'dark') feudalAt = w.time / 60; }
  const v = o => w.units.filter(u => u.owner === o && u.type === 'villager').length;
  assert(Math.max(v('player'), v('enemy')) >= 27 && Math.min(v('player'), v('enemy')) >= 20, `AI keeps the hall busy: ${v('player')} / ${v('enemy')} Worker Pups at 15 min`);
  assert(feudalAt != null && feudalAt < 12, `AI reaches the Pack Age on time (${feudalAt?.toFixed(1)} min)`);
  assert(w.buildings.some(b => b.owner === 'player' && b.type === 'farm'), 'AI transitions to farms');
  assert(w.resources.some(n => n.kind === 'fish' && n.amount < 200), 'AI fishes'); }

log('--- 8. balance report (sim/balance.mjs) ---');
{
  const f = fileURLToPath(new URL('../proof/balance.json', import.meta.url));
  if (!existsSync(f)) assert(false, 'proof/balance.json exists (run: node sim/balance.mjs)');
  else { const r = JSON.parse(readFileSync(f, 'utf8'));
    assert(r.games >= 60 && Object.keys(r.table).length === 6, `${r.games} AI-vs-AI games across 6 clans (${r.conquests} conquests)`);
    for (const [c, t] of Object.entries(r.table)) assert(t.winRate >= 0.45 && t.winRate <= 0.55, `${CIVS[c].name}: ${(t.winRate * 100).toFixed(1)}% (${t.wins}/${t.games}) within 45-55%`); }
}

log(`RESULT: ${fail ? fail + ' FAILED, ' : 'ALL '}${pass} PASSED${fail ? '' : ''}`);
mkdirSync(fileURLToPath(new URL('../proof/', import.meta.url)), { recursive: true });
writeFileSync(fileURLToPath(new URL('../proof/full-test.log', import.meta.url)), lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
