// Ages / tech tree headless tests. Run: node tests/ages.test.mjs  (log -> proof/ages-test.log)
import * as S from '../src/sim.js';
import { AGE_UPS, TECHS, UNITS, BUILDINGS } from '../src/techtree.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { createWorld, tick, placeBuilding, trainUnit, research, ageUp, canAgeUp, ageStatus, orderGather, gatherRate, carryMax, farmFood, selectionInfo, select, RES_TYPES } = S;
const lines = []; let fail = 0, pass = 0;
const log = s => { console.log(s); lines.push(s); };
const assert = (c, m) => { log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };
const run = (w, secs, step = 0.05) => { for (let t = 0; t < secs; t += step) tick(w, step); };
const rich = () => createWorld({ stockpile: { food: 20000, wood: 20000, gold: 20000, stone: 20000 } });
// place + instantly complete a building (setup helper; construction itself is covered by gather tests)
function built(w, type, near = [44, 44]) {
  for (let r = 0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = near[0] + dx, y = near[1] + dy; if (S.canPlace(w, type, x, y)) { const b = placeBuilding(w, type, x, y, []); if (!b) return null;
      b.complete = true; b.progress = b.buildTime; b.hp = b.maxHp; return b; } }
  return null;
}
const tc = w => w.buildings[0];
function advanceAge(w) { const r = ageUp(w, tc(w)); if (!r.ok) return r; run(w, AGE_UPS[r.next].time + 0.2); return r; }
log(`ages test ${new Date().toISOString()}`);

log('--- age costs, timing, prerequisites ---');
{
  const w = rich(); assert(w.age === 'dark', 'start in Dark Age');
  assert(JSON.stringify(AGE_UPS.feudal.cost) === '{"food":500}' && AGE_UPS.feudal.time === 130, 'Feudal: 500 food, 130s');
  assert(JSON.stringify(AGE_UPS.castle.cost) === '{"food":800,"gold":200}' && AGE_UPS.castle.time === 160, 'Castle: 800 food + 200 gold, 160s');
  assert(JSON.stringify(AGE_UPS.imperial.cost) === '{"food":1000,"gold":800}' && AGE_UPS.imperial.time === 190, 'Imperial: 1000 food + 800 gold, 190s');
  let c = canAgeUp(w, tc(w)); assert(!c.ok && c.reason === 'prereq' && /needs 2 of: House, Mill, Lumber Camp, Mining Camp, Barracks \(have 0\)/.test(c.text), `Feudal blocked with 0 buildings: "${c.text}"`);
  built(w, 'house'); built(w, 'house', [48, 44]); c = canAgeUp(w, tc(w)); assert(!c.ok && /have 1/.test(c.text), 'two Houses count as ONE distinct building type');
  const mill = placeBuilding(w, 'mill', 40, 28, []); c = canAgeUp(w, tc(w)); assert(!c.ok, 'unfinished Mill foundation does not count');
  mill.complete = true; c = canAgeUp(w, tc(w)); assert(c.ok && c.next === 'feudal', 'House + Mill allow Feudal');
  const food0 = w.stockpile.food; const r = ageUp(w, tc(w));
  assert(r.ok && w.stockpile.food === food0 - 500 && tc(w).queue[0] === 'age:feudal', 'Feudal research started, 500 food spent');
  const again = ageUp(w, tc(w)); assert(!again.ok && again.reason === 'queued' && w.stockpile.food === food0 - 500, 'age research cannot be double-queued (no extra cost)');
  run(w, 129.5); assert(w.age === 'dark', 'still Dark at 129.5s');
  run(w, 0.7); assert(w.age === 'feudal' && /Feudal Age/.test(w.banner.text), `Feudal at 130s with banner "${w.banner.text}"`);
  c = canAgeUp(w, tc(w)); assert(!c.ok && /Archery Range, Stable, Blacksmith, Market \(have 0\)/.test(c.text), `Castle blocked: "${c.text}"`);
  built(w, 'blacksmith'); built(w, 'market', [50, 40]); c = canAgeUp(w, tc(w)); assert(c.ok && c.next === 'castle', 'Blacksmith + Market allow Castle');
  const g0 = w.stockpile.gold, f1 = w.stockpile.food; ageUp(w, tc(w)); assert(w.stockpile.gold === g0 - 200 && w.stockpile.food === f1 - 800, 'Castle costs 800 food + 200 gold');
  run(w, 159.5); assert(w.age === 'feudal', 'still Feudal at 159.5s'); run(w, 0.7); assert(w.age === 'castle', 'Castle Age at 160s');
  c = canAgeUp(w, tc(w)); assert(!c.ok && /Monastery, University, Castle/.test(c.text), `Imperial blocked: "${c.text}"`);
  built(w, 'monastery'); c = canAgeUp(w, tc(w)); assert(!c.ok, 'one Monastery alone is not enough');
  const w2 = JSON.parse(JSON.stringify(w)); built(w2, 'castle', [20, 30]); assert(canAgeUp(w2, w2.buildings[0]).ok, 'a Castle alone allows Imperial');
  built(w, 'university', [50, 50]); c = canAgeUp(w, tc(w)); assert(c.ok && c.next === 'imperial', 'Monastery + University allow Imperial');
  const g1 = w.stockpile.gold, f2 = w.stockpile.food; ageUp(w, tc(w)); assert(w.stockpile.gold === g1 - 800 && w.stockpile.food === f2 - 1000, 'Imperial costs 1000 food + 800 gold');
  run(w, 189.5); assert(w.age === 'castle', 'still Castle at 189.5s'); run(w, 0.7); assert(w.age === 'imperial', 'Imperial Age at 190s');
  assert(!canAgeUp(w, tc(w)).ok && ageStatus(w).next === null, 'no age after Imperial');
}
{ // TC busy researching -> villager waits (AoE2 behavior)
  const w = rich(); built(w, 'house'); built(w, 'mill', [40, 27]);
  ageUp(w, tc(w)); S.trainVillager(w, tc(w)); run(w, 100);
  assert(w.units.length === 3 && tc(w).queue[1] === 'villager', 'villager queued behind age research is not trained during research');
  run(w, 30.5 + 25.5); assert(w.age === 'feudal' && w.units.length === 4, 'villager trains after age research completes');
  assert(/Researching Feudal Age|Queue: 0/.test(selectionInfo((S.selectAt(w, 33, 33), w)).lines.join(' ')), 'TC panel line format');
}

log('--- locked content refused before its age, allowed after ---');
{
  const w = rich(); const br = built(w, 'barracks', [44, 36]); const lc = built(w, 'lumber_camp', [24, 24]);
  for (const t of ['archery_range', 'stable', 'blacksmith', 'market', 'watch_tower']) assert(placeBuilding(w, t, 46, 46, []) === null && /Requires Feudal Age/.test(w.message.text), `${BUILDINGS[t].name} refused in Dark: "${w.message.text}"`);
  for (const t of ['castle', 'monastery', 'university']) assert(placeBuilding(w, t, 46, 46, []) === null && /Requires Castle Age/.test(w.message.text), `${BUILDINGS[t].name} refused before Castle`);
  assert(placeBuilding(w, 'wonder', 46, 46, []) === null && /Requires Imperial Age/.test(w.message.text), 'Wonder refused before Imperial');
  assert(!trainUnit(w, br, 'spearman').ok && /Requires Feudal Age/.test(w.message.text), 'Spearman refused in Dark');
  assert(!research(w, lc, 'double_bit_axe').ok && /Requires Feudal Age/.test(w.message.text), 'Double-Bit Axe refused in Dark');
  assert(research(w, tc(w), 'loom').ok && research(w, tc(w), 'wheelbarrow').ok, 'Dark Age TC techs Loom + Wheelbarrow allowed');
  assert(!research(w, tc(w), 'loom').ok && /already being researched/.test(w.message.text), 'tech cannot be double-queued');
  assert(!research(w, tc(w), 'hand_cart').ok, 'Hand Cart refused in Dark');
  built(w, 'house'); built(w, 'mill', [40, 27]); advanceAge(w); run(w, 120); assert(w.age === 'feudal', 'reached Feudal');
  assert(!research(w, tc(w), 'loom').ok && /already researched/.test(w.message.text), 'researched tech cannot be repeated');
  for (const t of ['archery_range', 'stable', 'blacksmith', 'market', 'watch_tower']) assert(built(w, t, [48, 40]) !== null, `${BUILDINGS[t].name} allowed in Feudal`);
  const wood = w.stockpile.wood, stone = w.stockpile.stone; const wt = built(w, 'watch_tower', [20, 40]);
  assert(wt && w.stockpile.wood === wood - 25 && w.stockpile.stone === stone - 125, 'Watch Tower costs 25 wood + 125 stone');
  const ar = w.buildings.find(b => b.type === 'archery_range'), st = w.buildings.find(b => b.type === 'stable');
  const g = w.stockpile.gold, wd = w.stockpile.wood; assert(trainUnit(w, ar, 'archer').ok && w.stockpile.gold === g - 45 && w.stockpile.wood === wd - 25, 'Archer: 25 wood 45 gold');
  const f = w.stockpile.food; assert(trainUnit(w, st, 'scout_cavalry').ok && w.stockpile.food === f - 80, 'Scout Cavalry: 80 food');
  const f2 = w.stockpile.food, w2 = w.stockpile.wood; assert(trainUnit(w, br, 'spearman').ok && w.stockpile.food === f2 - 35 && w.stockpile.wood === w2 - 25, 'Spearman: 35 food 25 wood');
  assert(!trainUnit(w, st, 'knight').ok && /Requires Castle Age/.test(w.message.text), 'Knight refused in Feudal');
  assert(!research(w, ar, 'crossbowman').ok, 'Crossbowman upgrade refused in Feudal');
  for (let i = 0; i < 4; i++) built(w, 'house', [52, 30 + i * 3]);
  run(w, 40); const types = w.units.map(u => u.type);
  assert(['archer', 'scout_cavalry', 'spearman'].every(t => types.includes(t)), `Feudal units trained: ${types.slice(3).join(', ')}`);
  const sc = w.units.find(u => u.type === 'scout_cavalry'); select(w, sc); S.commandAt(w, 20.5, 45.5); run(w, 15);
  assert(Math.hypot(sc.x - 20.5, sc.y - 45.5) < 1.5, 'Scout Cavalry moves');
  select(w, sc); const info = selectionInfo(w).lines.join(' | '); assert(/HP 45\/45 +Attack 3 +Armor 0\/2 +Speed 3.6/.test(info), `unit stats shown: ${info}`);
  const bs = w.buildings.find(b => b.type === 'blacksmith'); research(w, bs, 'forging'); run(w, 51);
  select(w, sc); assert(/Attack 4/.test(selectionInfo(w).lines[1]), 'Forging: +1 attack displayed for cavalry');
  built(w, 'market', [56, 52]); advanceAge(w); assert(w.age === 'castle', 'reached Castle');
  assert(research(w, ar, 'crossbowman').ok, 'Crossbowman upgrade allowed in Castle'); run(w, 36);
  assert(w.units.some(u => u.type === 'crossbowman') && !w.units.some(u => u.type === 'archer'), 'existing Archers upgraded to Crossbowmen');
  trainUnit(w, ar, 'archer'); run(w, 28); assert(w.units.filter(u => u.type === 'crossbowman').length === 2, 'Archer button now trains Crossbowmen');
  const mon = built(w, 'monastery', [16, 50]); const cas = built(w, 'castle', [10, 30]); built(w, 'university', [56, 20]);
  assert(mon && cas && trainUnit(w, mon, 'monk').ok && trainUnit(w, st, 'knight').ok, 'Castle buildings + Monk + Knight allowed');
  assert(!trainUnit(w, cas, 'trebuchet').ok && /Requires Imperial Age/.test(w.message.text), 'Trebuchet refused before Imperial');
  assert(research(w, tc(w), 'hand_cart').ok, 'Hand Cart allowed in Castle (Wheelbarrow done)');
  run(w, 56); advanceAge(w); assert(w.age === 'imperial', 'reached Imperial (Hand Cart finished first: one item at a time)');
  assert(built(w, 'wonder', [8, 8]) !== null, 'Wonder allowed in Imperial');
  assert(trainUnit(w, cas, 'trebuchet').ok, 'Trebuchet allowed in Imperial');
}

log('--- tech prerequisites ---');
{
  const w = rich(); w.age = 'imperial'; const lc = built(w, 'lumber_camp', [24, 24]);
  assert(!research(w, lc, 'bow_saw').ok && /Requires Double-Bit Axe/.test(w.message.text), 'Bow Saw requires Double-Bit Axe');
  research(w, lc, 'double_bit_axe'); assert(!research(w, lc, 'bow_saw').ok, 'cannot queue Bow Saw while Double-Bit Axe still researching');
  run(w, 26); assert(research(w, lc, 'bow_saw').ok, 'Bow Saw allowed once Double-Bit Axe completes');
  assert(!research(w, tc(w), 'double_bit_axe').ok, 'tech only at its building');
}

log('--- eco tech numeric effects (live) ---');
{
  const time = (w, n) => { for (let t = 0; t < 600; t += 0.05) { tick(w, 0.05); if (n()) return w.time; } return Infinity; };
  // Double-Bit Axe +20% wood: measured gathered amount over a fixed window while standing at a tree
  const woodIn = techs => { const w = rich(); w.age = 'imperial'; for (const t of techs) w.researched[t] = 0;
    const u = w.units[0], tree = w.resources.find(n => n.kind === 'tree' && Math.floor(n.y) === 22); orderGather(w, u, tree);
    for (let k = 0; k < 2000 && u.state !== 'gathering'; k++) tick(w, 0.05); const a0 = tree.amount; run(w, 5); return a0 - tree.amount; };
  assert(gatherRate(rich(), 'tree') === 1 && (() => { const w = rich(); w.researched.double_bit_axe = 0; return Math.abs(gatherRate(w, 'tree') - 1.2) < 1e-9; })(), 'Double-Bit Axe: wood rate 1.0 -> 1.2 (+20%)');
  const base = woodIn([]), dba = woodIn(['double_bit_axe']), bs = woodIn(['double_bit_axe', 'bow_saw']), tms = woodIn(['double_bit_axe', 'bow_saw', 'two_man_saw']);
  assert(base === 5 && dba === 6 && bs === 7, `measured wood in 5s at a tree: base ${base}, DBA ${dba}, +Bow Saw ${bs}, +Two-Man Saw ${tms}`);
  { const w = rich(); w.researched.double_bit_axe = 0; w.researched.bow_saw = 0; w.researched.two_man_saw = 0; assert(Math.abs(gatherRate(w, 'tree') - 1.5) < 1e-9, 'wood bonuses stack additively: +20 +20 +10 = 1.5x'); }
  { const w = rich(); w.researched.gold_mining = 0; assert(Math.abs(gatherRate(w, 'gold_mine') - 1.15) < 1e-9, 'Gold Mining: gold rate +15%'); w.researched.gold_shaft_mining = 0; assert(Math.abs(gatherRate(w, 'gold_mine') - 1.3) < 1e-9, 'Gold Shaft Mining: +15% more (1.3x)'); assert(gatherRate(w, 'stone_mine') === 1, 'gold techs do not affect stone'); }
  // Wheelbarrow: carry 10 -> 13 (+25%, rounded); Hand Cart -> 15; delivered per trip changes live
  { const w = rich(); assert(carryMax(w) === 10, 'base carry 10');
    const u = w.units[0], bush = w.resources.find(n => n.kind === 'berries'); orderGather(w, u, bush);
    const tc0 = tc(w); research(w, tc0, 'wheelbarrow'); const s0 = w.stockpile.food;
    run(w, 76); assert(w.researched.wheelbarrow !== undefined && carryMax(w) === 13, `Wheelbarrow researched while gathering: carry 10 -> ${carryMax(w)}`);
    assert(Math.abs(u.speed - 2.75) < 1e-9, `Wheelbarrow: villager speed 2.5 -> ${u.speed}`);
    let maxCarry = 0; for (let t = 0; t < 60; t += 0.05) { tick(w, 0.05); maxCarry = Math.max(maxCarry, u.carry.amount); }
    assert(maxCarry === 13, `villager now carries up to ${maxCarry}`);
    w.researched.hand_cart = 0; assert(carryMax(w) === 15, 'Hand Cart: carry 15 (+25% of base again)'); }
  // Horse Collar +75 farm food; stacks with Heavy Plow / Crop Rotation; only new farms
  { const w = rich(); w.age = 'feudal'; const mill = built(w, 'mill', [40, 28]);
    assert(farmFood(w) === 175, 'farm food 175'); research(w, mill, 'horse_collar'); run(w, 21);
    assert(farmFood(w) === 250, 'Horse Collar: farms 250 food');
    const f = placeBuilding(w, 'farm', 37, 27, [w.units[0]]); for (let t = 0; t < 60 && !f.complete; t += 0.05) tick(w, 0.05);
    const n = w.resources.find(r => r.farm === f.id); assert(n && n.max === 250 && n.amount > 240, `new farm holds ${n?.max} food`);
    w.researched.heavy_plow = 0; w.researched.crop_rotation = 0; assert(farmFood(w) === 550, 'Horse Collar + Heavy Plow + Crop Rotation: 550'); }
  // Loom +15 HP (existing and new villagers)
  { const w = rich(); const u = w.units[0]; assert(u.hp === 25 && u.maxHp === 25, 'villager HP 25'); research(w, tc(w), 'loom'); run(w, 25.2);
    assert(u.hp === 40 && u.maxHp === 40, 'Loom: existing villagers 40 HP'); S.trainVillager(w, tc(w)); run(w, 26); assert(w.units[3].maxHp === 40, 'Loom: new villagers 40 HP');
    select(w, u); assert(selectionInfo(w).lines.includes('HP: 40/40'), 'HP shown in villager panel'); }
}

log('--- resource balance with techs ---');
{
  const w = rich(); w.age = 'imperial'; Object.assign(w.researched, { double_bit_axe: 0, bow_saw: 0, gold_mining: 0, wheelbarrow: 0, hand_cart: 0, horse_collar: 0 });
  const mill = built(w, 'mill', [40, 28]), lc = built(w, 'lumber_camp', [24, 24]), mc = built(w, 'mining_camp', [40, 41]);
  const start = w.resources.reduce((t, n) => t + n.amount, 0), base = { ...w.stockpile }, c0 = w.ledger.created;
  const [a, b, c] = w.units;
  orderGather(w, a, w.resources.find(n => n.kind === 'tree' && Math.floor(n.y) === 22));
  orderGather(w, b, w.resources.find(n => n.kind === 'gold_mine'));
  const f = placeBuilding(w, 'farm', 37, 27, [c]); const spent = { ...w.stockpile };
  run(w, 200);
  const removed = start + (w.ledger.created - c0) - w.resources.reduce((t, n) => t + n.amount, 0);
  const delivered = RES_TYPES.reduce((t, r) => t + w.stockpile[r] - spent[r], 0), carried = w.units.reduce((t, u) => t + u.carry.amount, 0);
  assert(f.complete && w.ledger.created - c0 === 250, 'farm built with Horse Collar food (250)');
  assert(delivered > 0 && removed === delivered + carried, `balance with techs: node decrease ${removed} == delivered ${delivered} + carried ${carried}`);
}
log(fail ? `RESULT: ${fail} FAILED, ${pass} passed` : `RESULT: ALL ${pass} PASSED`);
mkdirSync(fileURLToPath(new URL('../proof/', import.meta.url)), { recursive: true });
writeFileSync(fileURLToPath(new URL('../proof/ages-test.log', import.meta.url)), lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
