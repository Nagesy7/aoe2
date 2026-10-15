import { createWorld, tick, select, orderGather, getSelected, RES_TYPES, pickAt, selectAt, selectionInfo, clampCamera, TILE, orderMove, screenToWorld, worldToScreen, camPixel,
  trainVillager, popCount, popCap, placeBuilding, canPlace, buildGrid, findPath, boxSelect, commandAt, selectedUnits, TRAIN_TIME, START_STOCKPILE, unitsInFootprint, unitsInsideBuildings,
  trainUnit, orderHunt, dropsitesFor, farmAnchorOk, butcher, missingFor, GATHER_RATES, FARM_FOOD, CARCASS_FOOD, mobiles, queuedCount, BUILDING_DEFS } from '../src/sim.js';
import { createUi, startPlacing, cancelPlacing, pointerDown, pointerMove, pointerUp, ghostAt } from '../src/ui-state.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('../proof/gather-test.log', import.meta.url));
const lines = []; let fail = 0, pass = 0;
const log = s => { console.log(s); lines.push(s); };
const assert = (c, m) => { log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };
log(`gather test ${new Date().toISOString()}`);

// Legacy (round 1-3) tests use a fixture with a zeroed stockpile and a single villager so absolute
// stockpile assertions stay valid; round-4 tests below use the real default start.
const legacyWorld = () => createWorld({ stockpile: { food: 0, wood: 0, gold: 0, stone: 0 }, villagers: 1 });
log('--- gathering ---');
for (const res of RES_TYPES) {
  const w = legacyWorld(); select(w, w.units[0]); const u = getSelected(w);
  const node = w.resources.filter(n => n.res === res).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
  const startAmt = node.amount; orderGather(w, u, node);
  for (let t = 0; t < 120; t += 0.05) tick(w, 0.05);
  const removed = startAmt - node.amount, carried = u.carry.res === res ? u.carry.amount : 0;
  log(`[${res}] node ${node.kind} ${startAmt} -> ${node.amount}; stockpile ${res}=${w.stockpile[res]}; carried=${carried}; state=${u.state}`);
  assert(w.stockpile[res] > 0 && w.stockpile[res] % 10 === 0, `${res} stockpile increased in trips of 10 (${w.stockpile[res]})`);
  assert(node.amount < startAmt, `${res} node amount decreased`);
  assert(removed === w.stockpile[res] + carried, `${res} conservation: removed ${removed} == delivered ${w.stockpile[res]} + carried ${carried}`);
  assert(RES_TYPES.filter(r => r !== res).every(r => w.stockpile[r] === 0), `only ${res} collected`);
}

log('--- Puppy Age gather/deposit math ---');
{
  const expect = { berries: 0.31, carcass: 0.33, tree: 0.39, gold_mine: 0.38, stone_mine: 0.36 };
  for (const [k, r] of Object.entries(expect)) assert(GATHER_RATES[k] === r, `${k} rate ${GATHER_RATES[k]} == ${r}/s`);
  for (const res of RES_TYPES) {
    const w = legacyWorld(); const u = w.units[0];
    const node = w.resources.filter(n => n.res === res).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
    orderGather(w, u, node); let t = 0;
    while (u.state !== 'gathering' && t < 60) { tick(w, 0.05); t += 0.05; }
    const t0 = t; while (u.carry.amount < 10 && t < 200) { tick(w, 0.05); t += 0.05; }
    const secs = t - t0, ideal = 10 / GATHER_RATES[node.kind];
    assert(u.carry.amount === 10 && Math.abs(secs - ideal) < 1, `${res}: 10 carried in ${secs.toFixed(2)}s (ideal ${ideal.toFixed(2)}s)`);
    while (w.stockpile[res] === 0 && t < 400) { tick(w, 0.05); t += 0.05; }
    assert(w.stockpile[res] === 10, `${res}: deposit adds exactly 10 to stockpile (${w.stockpile[res]})`);
    while (u.state !== 'gathering' && t < 500) { tick(w, 0.05); t += 0.05; }
    assert(u.state === 'gathering', `${res}: villager returned to gather after deposit`);
  }
}

log('--- selection hit-testing ---');
{
  const w = legacyWorld(); const u = w.units[0], tc = w.buildings[0];
  const tree = w.resources.find(n => n.res === 'wood');
  assert(pickAt(w, u.x, u.y)?.kind === 'unit', 'villager picked at its position');
  assert(pickAt(w, tc.x + 1, tc.y + 1)?.kind === 'building', 'town center picked inside footprint');
  const p = pickAt(w, tree.x, tree.y); assert(p?.kind === 'resource' && p.id === tree.id, 'tree picked at its position');
  // find a guaranteed empty tile
  let ex, ey; outer: for (ey = 0; ey < 64; ey++) for (ex = 0; ex < 64; ex++) if (pickAt(w, ex + 0.5, ey + 0.5).kind === 'tile') break outer;
  assert(pickAt(w, ex + 0.5, ey + 0.5).x === ex, `tile (${ex},${ey}) coordinates correct`);
  assert(pickAt(w, -1, -1) === null, 'off-map picks nothing');
  // priority: villager over building
  u.x = tc.x + 0.5; u.y = tc.y + 0.5; assert(pickAt(w, u.x, u.y).kind === 'unit', 'priority villager > building');
  // priority: building over resource
  w.resources.push({ id: 999, res: 'food', kind: 'berries', x: tc.x + 2, y: tc.y + 2, amount: 5 });
  assert(pickAt(w, tc.x + 2, tc.y + 2).kind === 'building', 'priority building > resource');
  selectAt(w, tree.x, tree.y); assert(selectionInfo(w).title === 'Tree' && /100 remaining/.test(selectionInfo(w).lines[0]), 'resource info shows type + amount');
  tree.amount = 42; assert(/42 remaining/.test(selectionInfo(w).lines[0]), 'resource info updates live');
  selectAt(w, tc.x + 3.5, tc.y + 3.5); assert(selectionInfo(w).lines[0] === 'HP: 2400/2400', 'TC info shows HP 2400/2400');
  selectAt(w, u.x, u.y); assert(selectionInfo(w).title === 'Worker Pup' && getSelected(w) === u, 'villager selected via selectAt');
  selectAt(w, ex + 0.5, ey + 0.5); assert(selectionInfo(w).lines[0] === `(${ex}, ${ey})` && getSelected(w) === null, 'tile info shows (x, y) and deselects villager');
}

log('--- camera clamp ---');
{
  const w = legacyWorld(); const M = 64 * TILE;
  const c = v => clampCamera({ ...v }, 1280, 720, w);
  assert(c({ x: -500, y: -500 }).x === 0 && c({ x: -500, y: -500 }).y === 0, 'clamp top-left');
  const br = c({ x: 1e6, y: 1e6 }); assert(br.x === M - 1280 && br.y === M - 720, 'clamp bottom-right');
  const mid = c({ x: 300, y: 400 }); assert(mid.x === 300 && mid.y === 400, 'in-range unchanged');
  const big = clampCamera({ x: 0, y: 0 }, 3000, 2500, w); assert(big.x === -(3000 - M) / 2 && big.y === -(2500 - M) / 2, 'viewport larger than map centers it');
}

log('--- retask (round 3): never lose carried resources ---');
const nearest = (w, u, res) => w.resources.filter(n => n.res === res && n.amount > 0).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
const conserved = (w, init, u) => {
  const removed = w.resources.reduce((t, n) => t + (init.get(n.id) - n.amount), 0);
  const held = RES_TYPES.reduce((t, r) => t + w.stockpile[r], 0) + u.carry.amount;
  return { removed, held, ok: removed === held };
};
for (const a of RES_TYPES) for (const b of RES_TYPES) {
  if (a === b) continue;
  const w = legacyWorld(); const u = w.units[0]; const init = new Map(w.resources.map(n => [n.id, n.amount]));
  orderGather(w, u, nearest(w, u, a));
  let guard = 0; while (!(u.state === 'gathering' && u.carry.amount >= 5) && guard++ < 10000) tick(w, 0.05);
  const carried = u.carry.amount;
  orderGather(w, u, nearest(w, u, b));
  const ok1 = u.state === 'to_drop' && u.carry.amount === carried && u.carry.res === a;
  let sawDeposit = false;
  for (let t = 0; t < 90; t += 0.05) { tick(w, 0.05); if (w.stockpile[a] >= carried) sawDeposit = true; }
  const c = conserved(w, init, u);
  log(`[${a}->${b}] carried ${carried} ${a} at retask; final stockpile ${a}=${w.stockpile[a]} ${b}=${w.stockpile[b]}; carry=${u.carry.amount} ${u.carry.res}; removed=${c.removed} held=${c.held}`);
  assert(ok1, `${a}->${b}: retask sends villager to drop off with carry intact`);
  assert(sawDeposit && w.stockpile[a] === carried, `${a}->${b}: carried ${a} deposited (${w.stockpile[a]})`);
  assert(w.stockpile[b] > 0 || (u.carry.res === b && u.carry.amount > 0), `${a}->${b}: then gathers ${b}`);
  assert(c.ok, `${a}->${b}: total node decrease ${c.removed} == delivered + carried ${c.held}`);
}
{
  const w = legacyWorld(); const u = w.units[0]; const init = new Map(w.resources.map(n => [n.id, n.amount]));
  const trees = w.resources.filter(n => n.res === 'wood').sort((p, q) => Math.hypot(p.x - u.x, p.y - u.y) - Math.hypot(q.x - u.x, q.y - u.y));
  orderGather(w, u, trees[0]);
  let guard = 0; while (!(u.state === 'gathering' && u.carry.amount >= 4) && guard++ < 10000) tick(w, 0.05);
  const carried = u.carry.amount; orderGather(w, u, trees[1]);
  assert(u.state === 'to_resource' && u.carry.amount === carried && u.carry.res === 'wood', `same-type retask keeps carry (${carried} wood) and continues to new tree`);
  for (let t = 0; t < 60; t += 0.05) tick(w, 0.05);
  const c = conserved(w, init, u);
  assert(trees[1].amount < 100 && c.ok, `same-type retask: new tree gathered (${trees[1].amount} left), conservation ${c.removed} == ${c.held}`);
}

log('--- screen<->world uses rounded camera (round 3) ---');
{
  const cam = { x: 10.6, y: 20.4 }; const c = camPixel(cam);
  assert(c.x === 11 && c.y === 20, 'camPixel rounds like the renderer');
  // Rendered tile 1 starts at screen x = 1*32 - 11 = 21; tile 0's last pixel is x = 20.
  const at = (sx, sy) => { const p = screenToWorld(sx, sy, cam); return [Math.floor(p.x), Math.floor(p.y)]; };
  assert(at(21, 0)[0] === 1, 'pixel 21 (first pixel of rendered tile 1) -> tile 1 (unrounded math would give 0)');
  assert(at(20, 0)[0] === 0, 'pixel 20 (last pixel of rendered tile 0) -> tile 0');
  assert(at(20.999, 0)[0] === 0 && at(21.001, 0)[0] === 1, 'sub-pixel either side of border');
  assert(at(0, 12)[1] === 1 && at(0, 11)[1] === 0, 'y border: pixel 12 -> tile 1, 11 -> tile 0');
  const w = legacyWorld(); let ex, ey;
  outer: for (ey = 1; ey < 63; ey++) for (ex = 1; ex < 63; ex++) if ([[0,0],[-1,0],[0,-1]].every(([dx,dy]) => pickAt(w, ex + dx + 0.5, ey + dy + 0.5).kind === 'tile')) break outer;
  const s0 = worldToScreen(ex, ey, cam);
  selectAt(w, ...Object.values(screenToWorld(s0.x, s0.y, cam))); assert(w.selection.x === ex && w.selection.y === ey, `click on top-left border pixel of tile (${ex},${ey}) selects it`);
  selectAt(w, ...Object.values(screenToWorld(s0.x - 1, s0.y, cam))); assert(w.selection.x === ex - 1, 'one pixel left selects left neighbour');
  selectAt(w, ...Object.values(screenToWorld(s0.x, s0.y - 1, cam))); assert(w.selection.y === ey - 1, 'one pixel up selects upper neighbour');
  const back = worldToScreen(...Object.values(screenToWorld(123, 456, cam)), cam); assert(Math.abs(back.x - 123) < 1e-9 && Math.abs(back.y - 456) < 1e-9, 'screenToWorld/worldToScreen round-trip');
}

log('--- round 4: start state, training, pop cap, houses ---');
const run = (w, secs, step = 0.05) => { for (let t = 0; t < secs; t += step) tick(w, step); };
{
  const w = createWorld();
  assert(w.units.length === 3 && JSON.stringify(w.stockpile) === JSON.stringify({ food: 200, wood: 200, gold: 100, stone: 100 }), 'default start: 3 villagers, 200/200/100/100');
  assert(popCount(w) === 3 && popCap(w) === 5, 'pop 3/5 from Town Center');
  const tc = w.buildings[0];
  assert(trainVillager(w, tc).ok && w.stockpile.food === 150 && tc.queue.length === 1, 'train villager costs 50 food and queues');
  run(w, TRAIN_TIME - 1); assert(w.units.length === 3 && tc.trainProgress > 23, `not spawned before ${TRAIN_TIME}s (progress ${tc.trainProgress.toFixed(1)})`);
  run(w, 1.2); const nu = w.units[3];
  assert(w.units.length === 4 && tc.queue.length === 0, 'villager spawned after 25s');
  assert(nu && Math.max(Math.abs(Math.floor(nu.x) - (tc.x + 1.5)) - 1.5, Math.abs(Math.floor(nu.y) - (tc.y + 1.5)) - 1.5) <= 1.5 && !buildGrid(w)[Math.floor(nu.y) * 64 + Math.floor(nu.x)], 'spawned on a walkable tile beside the TC');
  // rally point
  selectAt(w, tc.x + 1, tc.y + 1); commandAt(w, 45.5, 36.5); assert(tc.rally && tc.rally.x === 45.5, 'right-click with TC selected sets rally');
  assert(trainVillager(w, tc).ok, 'queue 5th villager'); run(w, TRAIN_TIME + 10);
  const r = w.units[4]; assert(r && Math.floor(r.x) === 45 && Math.floor(r.y) === 36, `new villager walked to rally (at ${r && r.x.toFixed(1)},${r && r.y.toFixed(1)})`);
  assert(popCount(w) === 5, 'pop now 5/5');
  const food = w.stockpile.food, res = trainVillager(w, tc);
  assert(!res.ok && res.reason === 'pop' && w.stockpile.food === food && /Population cap/.test(w.message.text), `training blocked at cap with message: "${w.message.text}"`);
  // house
  assert(!canPlace(w, 'house', tc.x, tc.y) && !canPlace(w, 'house', 63, 10) && !canPlace(w, 'house', 20, 18), 'house invalid on TC / off-map edge / forest');
  assert(canPlace(w, 'house', 44, 38), 'house valid on open grass');
  const builders = w.units.slice(0, 1); const h = placeBuilding(w, 'house', 44, 38, builders);
  assert(h && !h.complete && w.stockpile.wood === 175, 'house foundation placed, 25 wood spent');
  assert(!canPlace(w, 'house', 45, 39), 'cannot overlap foundation');
  assert(popCap(w) === 5, 'foundation gives no pop yet');
  run(w, 40); assert(h.complete && popCap(w) === 10, `house complete -> pop cap ${popCap(w)}`);
  assert(trainVillager(w, tc).ok, 'training allowed again after house');
}
{ // multiple builders faster
  const time = n => { const w = createWorld(); const h = placeBuilding(w, 'house', 38, 36, w.units.slice(0, n)); let t = 0; while (!h.complete && t < 120) { tick(w, 0.05); t += 0.05; } return t; };
  const t1 = time(1), t3 = time(3); assert(t3 < t1 * 0.6, `3 builders faster (${t3.toFixed(1)}s) than 1 (${t1.toFixed(1)}s)`);
}

log('--- round 4: A* pathfinding ---');
{
  const w = createWorld(); const g = buildGrid(w);
  const p = findPath(w, 24, 24, [[24, 16]]); // straight north through the forest block (x 20..27, y 18..22)
  assert(p && p.length > 0, `path found around forest (${p && p.length} steps)`);
  assert(p.every(q => !g[Math.floor(q.y) * 64 + Math.floor(q.x)]), 'path never enters a blocked tile');
  assert(p.length > 8, 'path is longer than the straight line (detour)');
  for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i]; const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
    if (dx && dy && (g[Math.floor(a.y) * 64 + Math.floor(a.x + dx)] || g[Math.floor(a.y + dy) * 64 + Math.floor(a.x)])) { assert(false, 'no corner cutting'); break; } }
  const u = w.units[0]; u.x = 24.5; u.y = 24.5; select(w, u); commandAt(w, 24.5, 16.5); let blockedSteps = 0;
  for (let t = 0; t < 30; t += 0.05) { tick(w, 0.05); if (buildGrid(w)[Math.floor(u.y) * 64 + Math.floor(u.x)]) blockedSteps++; }
  assert(Math.floor(u.x) === 24 && Math.floor(u.y) === 16 && blockedSteps === 0, `villager walked around forest and arrived (${u.x},${u.y}), never on a blocked tile`);
  // unreachable: enclosed tile
  const w2 = createWorld(); for (const [x, y] of [[49,49],[50,49],[51,49],[49,50],[51,50],[49,51],[50,51],[51,51]]) w2.resources.push({ id: 900 + x * 100 + y, res: 'wood', kind: 'tree', x: x + 0.5, y: y + 0.5, amount: 100 });
  w2.resources = w2.resources.filter(n => !(Math.floor(n.x) === 50 && Math.floor(n.y) === 50));
  assert(findPath(w2, 36, 34, [[50, 50]]) === null, 'enclosed tile is unreachable (null path)');
  const u2 = w2.units[0]; const ok = orderMove(w2, u2, 50.5, 50.5);
  assert(ok && Math.max(Math.abs(u2.path.at(-1).x - 50.5), Math.abs(u2.path.at(-1).y - 50.5)) <= 2.1, 'move to enclosed tile goes to nearest reachable walkable tile instead');
  w2.resources.push({ id: 5000, res: 'gold', kind: 'gold_mine', x: 50.5, y: 50.5, amount: 800 });
  // mine at 50,50 surrounded by trees: unreachable gold -> no other gold within reach? there are other gold mines; try deeply unreachable by blocking all gold
  for (const n of w2.resources) if (n.res === 'gold' && n.id !== 5000) n.amount = 0;
  orderGather(w2, u2, w2.resources.find(n => n.id === 5000));
  assert(u2.state === 'idle' && u2.note === 'unreachable', `unreachable gather target handled gracefully (state ${u2.state}, note ${u2.note})`);
  run(w2, 2); assert(u2.state === 'idle', 'stays idle, no crash');
}

log('--- round 4: drag-box multi-select + parallel gather ---');
{
  const w = createWorld(); const init = new Map(w.resources.map(n => [n.id, n.amount])); const base = { ...w.stockpile };
  const sel = boxSelect(w, 30, 33, 38, 37); assert(sel.length === 3 && selectionInfo(w).title === '3 Worker Pups selected', `box selects 3 villagers (${selectionInfo(w).title})`);
  const bush = w.resources.find(n => n.res === 'food'); commandAt(w, bush.x, bush.y);
  assert(selectedUnits(w).every(u => u.state === 'to_resource'), 'all selected villagers ordered to gather');
  let onNode = 0; const g0 = () => buildGrid(w);
  for (let t = 0; t < 90; t += 0.05) { tick(w, 0.05); if (Math.round(t * 20) % 20 === 0) { const g = g0(); for (const u of w.units) if (g[Math.floor(u.y) * 64 + Math.floor(u.x)]) onNode++; } }
  const tiles = new Set(w.units.filter(u => u.state === 'gathering').map(u => `${Math.floor(u.x)},${Math.floor(u.y)}`));
  const removed = w.resources.reduce((t, n) => t + init.get(n.id) - n.amount, 0);
  const delivered = RES_TYPES.reduce((t, r) => t + w.stockpile[r] - base[r], 0), carried = w.units.reduce((t, u) => t + u.carry.amount, 0);
  log(`parallel: removed=${removed} delivered=${delivered} carried=${carried} gatheringTiles=${[...tiles].join(' ')}`);
  assert(delivered > 0 && removed === delivered + carried, `3 villagers: node decrease ${removed} == delivered ${delivered} + carried ${carried}`);
  assert(onNode === 0, 'no villager ever stood on a blocked (node/building) tile');
  assert(tiles.size === w.units.filter(u => u.state === 'gathering').length, 'gatherers spread across distinct adjacent tiles');
  const before = w.units.map(u => [u.x, u.y]); commandAt(w, 45.5, 36.5); run(w, 20);
  const dest = new Set(w.units.map(u => `${Math.floor(u.x)},${Math.floor(u.y)}`));
  assert(dest.size === 3 && w.units.every(u => Math.hypot(u.x - 45.5, u.y - 36.5) < 2.5), `group move spreads across tiles near target (${[...dest].join(' ')})`);
}

log('--- round 5: placement ignores units (eviction) ---');
{
  const inside = w => unitsInsideBuildings(w).length;
  // ghost validity: valid over units, still invalid for terrain/buildings
  const w = createWorld(); const [a, b, c] = w.units; // a(36,34) b(36,35) c(31,35)
  assert(unitsInFootprint(w, 36, 34, 2).length === 2 && canPlace(w, 'house', 36, 34), 'ghost valid over 2 villagers (units ignored)');
  assert(!canPlace(w, 'house', 35, 34) && !canPlace(w, 'house', 40, 30), 'still invalid over TC / bushes');
  // idle units + builders inside footprint, multiple builders
  const h = placeBuilding(w, 'house', 36, 34, [a, b, c]);
  assert(h && inside(w) === 0, `no unit inside any footprint right after placement (evicted ${w.lastEviction.evicted.length})`);
  assert(w.lastEviction.evicted.includes(a.id) && w.lastEviction.evicted.includes(b.id), 'both builders standing in footprint were evicted');
  let maxIn = 0, sawBuilding = false;
  while (!h.complete && w.time < 200) { tick(w, 0.05); maxIn = Math.max(maxIn, inside(w)); if (w.units.filter(u => u.state === 'building').length === 3) sawBuilding = true; }
  assert(maxIn === 0 && sawBuilding, `nobody inside during construction; 3 builders worked from adjacent tiles`);
  assert(h.complete && inside(w) === 0, 'nobody inside after completion');
  // gatherer standing where the house goes, plus unit reservation inside footprint
  const w2 = createWorld({ villagers: 2 }); const g = w2.units[0], bush = w2.resources.find(n => n.res === 'food');
  orderGather(w2, g, bush); run(w2, 12); for (let k = 0; k < 400 && g.state !== 'gathering'; k++) tick(w2, 0.05);
  assert(g.state === 'gathering', `gatherer gathering at (${Math.floor(g.x)},${Math.floor(g.y)})`);
  const gx = Math.floor(g.x), gy = Math.floor(g.y); const ht = canPlace(w2, 'house', gx, gy) ? [gx, gy] : canPlace(w2, 'house', gx - 1, gy) ? [gx - 1, gy] : [gx, gy + 0];
  const amt0 = bush.amount; const h2 = placeBuilding(w2, 'house', ht[0], ht[1], []);
  assert(h2 && inside(w2) === 0 && w2.lastEviction.evicted.includes(g.id), `gatherer evicted from house at (${ht})`);
  run(w2, 15); assert(inside(w2) === 0 && bush.amount < amt0 && ['gathering', 'to_drop', 'to_resource'].includes(g.state), `gatherer resumes (${g.state}), bush ${amt0}->${bush.amount}`);
  // moving unit whose path crosses the new foundation repaths immediately; destination inside footprint reassigned
  const w3 = createWorld({ villagers: 2 }); const m = w3.units[0], d = w3.units[1];
  m.x = 44.5; m.y = 36.5; orderMove(w3, m, 52.5, 36.5); run(w3, 0.5);
  const crossTile = m.path.map(q => [Math.floor(q.x), Math.floor(q.y)]).find(([x]) => x === 48);
  assert(crossTile && crossTile[1] === 36, `mover's planned path crosses tile (48,${crossTile && crossTile[1]}) before placement`);
  orderMove(w3, d, 49.5, 40.5); // destination that will be inside the 2nd house
  const h3 = placeBuilding(w3, 'house', 48, crossTile[1] - 0, []);
  const crosses = m.path.some(q => Math.floor(q.x) >= 48 && Math.floor(q.x) <= 49 && Math.floor(q.y) >= h3.y && Math.floor(q.y) <= h3.y + 1);
  assert(w3.lastEviction.repathed.includes(m.id) && !crosses && m.state === 'moving', 'mover whose path crossed the foundation repathed immediately around it');
  const h4 = placeBuilding(w3, 'house', 49, 40, []);
  const dg = d.path.at(-1); assert(w3.lastEviction.repathed.includes(d.id) && !(Math.floor(dg.x) >= 49 && Math.floor(dg.x) <= 50 && Math.floor(dg.y) >= 40 && Math.floor(dg.y) <= 41), `destination inside footprint reassigned to (${Math.floor(dg.x)},${Math.floor(dg.y)})`);
  let maxIn3 = 0; for (let t = 0; t < 10; t += 0.05) { tick(w3, 0.05); maxIn3 = Math.max(maxIn3, inside(w3)); }
  assert(maxIn3 === 0 && Math.floor(m.x) === 52 && Math.floor(m.y) === 36, `mover arrived at (52,36) without entering any footprint`);
  // safety pass at construction start and completion: a unit teleported inside gets evicted
  const w4 = createWorld(); const hb = placeBuilding(w4, 'house', 38, 37, [w4.units[0]]);
  w4.units[2].x = 38.5; w4.units[2].y = 37.5; w4.units[2].path = [];
  let started = false; for (let t = 0; t < 10 && !started; t += 0.05) { tick(w4, 0.05); started = hb.started; }
  assert(started && inside(w4) === 0, 'safety eviction at construction start');
  w4.units[2].x = 39.5; w4.units[2].y = 38.5; while (!hb.complete && w4.time < 100) tick(w4, 0.05);
  assert(hb.complete && inside(w4) === 0, 'safety eviction at completion');
}

log('--- round 6: drop-off camps, farms, sheep, barracks ---');
const complete = (w, b, n = 200) => { for (let t = 0; t < n && !b.complete; t += 0.05) tick(w, 0.05); return b.complete; };
const rich = () => createWorld({ stockpile: { food: 2000, wood: 2000, gold: 1000, stone: 1000 } });
{ // camps accept the right types; villager drops at nearest valid site by path distance
  const w = rich(); const [a, b, c] = w.units;
  const lc = placeBuilding(w, 'lumber_camp', 24, 24, [a, b]); const mc = placeBuilding(w, 'mining_camp', 40, 41, [c]);
  assert(lc && mc && w.stockpile.wood === 1800, 'lumber + mining camp placed (100 wood each)');
  complete(w, lc); complete(w, mc);
  assert(lc.complete && mc.complete && unitsInsideBuildings(w).length === 0, 'camps built by builders, nobody inside');
  assert(JSON.stringify(dropsitesFor(w, 'wood').map(o => o.type).sort()) === '["lumber_camp","town_center"]', 'wood drop-offs: lumber camp + TC');
  assert(JSON.stringify(dropsitesFor(w, 'gold').map(o => o.type).sort()) === '["mining_camp","town_center"]' && dropsitesFor(w, 'stone').some(o => o.type === 'mining_camp'), 'gold/stone drop-offs: mining camp + TC');
  assert(!dropsitesFor(w, 'food').some(o => o.type === 'lumber_camp' || o.type === 'mining_camp'), 'camps reject food');
  const tree = w.resources.find(n => n.res === 'wood' && Math.floor(n.x) === 24 && Math.floor(n.y) === 22);
  orderGather(w, a, tree); const gold = w.resources.find(n => n.res === 'gold'); orderGather(w, c, gold);
  const food = w.resources.find(n => n.res === 'food'); orderGather(w, b, food);
  run(w, 40);
  assert(a.lastDrop === lc.id, `woodcutter used nearest lumber camp (drop at ${w.buildings.find(o => o.id === a.lastDrop)?.type})`);
  assert(c.lastDrop === mc.id, `gold miner used mining camp (drop at ${w.buildings.find(o => o.id === c.lastDrop)?.type})`);
  assert(b.lastDrop === w.buildings[0].id, 'forager without a mill uses the TC');
  const mill = placeBuilding(w, 'mill', 40, 28, [b]); complete(w, mill); orderGather(w, b, food); run(w, 70);
  assert(mill.complete && b.lastDrop === mill.id, 'after a mill is built the forager drops at the mill');
  // path distance preferred: camp behind a wall is farther by path than TC even if closer in a straight line
  const w2 = rich(); const v = w2.units[0];
  const camp = placeBuilding(w2, 'lumber_camp', 44, 33, []); camp.complete = true; camp.progress = camp.buildTime;
  for (let y = 30; y <= 38; y++) w2.resources.push({ id: 7000 + y, res: 'stone', kind: 'stone_mine', x: 42.5, y: y + 0.5, amount: 350 });
  for (let x = 42; x <= 47; x++) { w2.resources.push({ id: 7100 + x, res: 'stone', kind: 'stone_mine', x: x + 0.5, y: 29.5, amount: 350 }); w2.resources.push({ id: 7200 + x, res: 'stone', kind: 'stone_mine', x: x + 0.5, y: 38.5, amount: 350 }); }
  for (let y = 30; y <= 38; y++) w2.resources.push({ id: 7300 + y, res: 'stone', kind: 'stone_mine', x: 47.5, y: y + 0.5, amount: 350 }); // closed box around camp
  w2.resources.push({ id: 7400, res: 'wood', kind: 'tree', x: 40.5, y: 34.5, amount: 100 });
  v.x = 39.5; v.y = 35.5; orderGather(w2, v, w2.resources.find(n => n.id === 7400)); run(w2, 30);
  assert(v.lastDrop === w2.buildings[0].id, 'walled-off (unreachable) camp is skipped; TC used by path distance');
}
{ // farms
  const w = rich(); const tc = w.buildings[0];
  assert(!canPlace(w, 'farm', 46, 46) && /Granary or Den Hall/.test((placeBuilding(w, 'farm', 46, 46, []), w.message.text)), 'farm far from Mill/TC invalid with message');
  assert(canPlace(w, 'farm', 36, 33) && farmAnchorOk(w, 36, 33), 'farm adjacent to TC valid');
  assert(!canPlace(w, 'farm', 34, 33), 'farm overlapping TC invalid');
  const u = w.units[0]; const f = placeBuilding(w, 'farm', 36, 36, [u]);
  assert(f && w.stockpile.wood === 1940, 'farm costs 60 wood');
  assert(complete(w, f) && f.complete, 'farm built');
  const node = w.resources.find(n => n.farm === f.id);
  assert(node && node.amount <= FARM_FOOD && u.target === node.id && ['to_resource', 'gathering'].includes(u.state), `builder auto-farms (${u.state})`);
  assert(findPath(w, 35, 37, [[40, 37]]).length === 5, 'completed farm is walkable (straight path across it)');
  assert(!canPlace(w, 'house', 37, 37), 'cannot build on top of a farm');
  run(w, 5); assert(u.state === 'gathering' && f.x <= Math.floor(u.x) && Math.floor(u.x) < f.x + 3 && f.y <= Math.floor(u.y) && Math.floor(u.y) < f.y + 3, 'farmer stands on the farm');
  const food0 = w.stockpile.food; let t = 0; while (w.buildings.includes(f) && t < 600) { tick(w, 0.1); t += 0.1; }
  assert(!w.buildings.includes(f) && !w.resources.includes(node), `depleted farm removed after ${t.toFixed(0)}s`);
  run(w, 20); assert(w.stockpile.food - food0 === FARM_FOOD && u.carry.amount === 0, `all ${FARM_FOOD} farm food delivered (${w.stockpile.food - food0})`);
  assert(GATHER_RATES.berries < GATHER_RATES.farm && GATHER_RATES.farm < GATHER_RATES.carcass, `rates: forage ${GATHER_RATES.berries} < farm ${GATHER_RATES.farm} < butcher ${GATHER_RATES.carcass}`);
  const mill = placeBuilding(w, 'mill', 46, 44, []); assert(canPlace(w, 'farm', 46, 41) && canPlace(w, 'farm', 43, 44), 'farm adjacent to a Mill (even a foundation) valid');
}
{ // sheep
  const w = createWorld(); const v = w.units[0]; const sh = w.animals[0];
  assert(w.animals.length >= 7 && w.animals.every(a => a.owner === null) && popCount(w) === 3, '7 neutral sheep, not counted in pop');
  select(w, v); commandAt(w, sh.x, sh.y); assert(v.state === 'to_hunt', 'right-click neutral sheep -> villager goes to it');
  run(w, 8); assert(sh.owner === 'player' && w.animals.includes(sh), 'villager reached sheep and converted it');
  const far = w.animals.find(a => Math.floor(a.x) === 50); v.x = far.x - 0.5; v.y = far.y; v.path = []; v.state = 'idle'; tick(w, 0.05);
  assert(far.owner === 'player', 'touching a neutral sheep converts it');
  selectAt(w, sh.x, sh.y); assert(selectionInfo(w).title === 'Sheep' && selectedUnits(w)[0] === sh, 'owned sheep selectable');
  commandAt(w, 26.5, 26.5); run(w, 10); assert(Math.floor(sh.x) === 26 && Math.floor(sh.y) === 26, 'owned sheep moves on command');
  const box = boxSelect(w, 20, 20, 40, 40); assert(box.every(u => u.type !== 'sheep'), 'drag-box prefers villagers over sheep');
  const base = w.stockpile.food, created0 = w.ledger.created;
  select(w, v); commandAt(w, sh.x, sh.y); assert(v.state === 'to_hunt', 'right-click own sheep -> butcher order');
  run(w, 10); const carcass = w.resources.find(n => n.kind === 'carcass');
  assert(!w.animals.includes(sh) && carcass && Math.floor(carcass.x) === 26 && Math.floor(carcass.y) === 26, 'sheep killed where it stood -> carcass at (26,26)');
  assert(w.ledger.created - created0 === CARCASS_FOOD, 'carcass holds 100 food');
  for (let t = 0; t < 600 && carcass.amount > 0; t += 0.05) tick(w, 0.05); run(w, 15);
  assert(carcass.amount === 0 && w.stockpile.food - base + v.carry.amount >= CARCASS_FOOD, `butcher yield 100 delivered (+${w.stockpile.food - base}, carrying ${v.carry.amount})`);
  const w2 = createWorld({ villagers: 1 }); const s2 = w2.animals[0]; const h2 = butcher(w2, s2);
  assert(h2.amount === 100 && h2.kind === 'carcass', 'butcher() yields a 100-food carcass');
}
{ // barracks + militia, shared pop/queue rules
  const w = rich(); const tc = w.buildings[0];
  const br = placeBuilding(w, 'barracks', 38, 36, w.units.slice(0, 3)); assert(br && w.stockpile.wood === 1825, 'barracks costs 175 wood');
  complete(w, br); assert(br.complete && unitsInsideBuildings(w).length === 0, 'barracks built');
  const f0 = w.stockpile.food, g0 = w.stockpile.gold;
  assert(trainUnit(w, br, 'militia').ok && w.stockpile.food === f0 - 60 && w.stockpile.gold === g0 - 20, 'militia costs 60 food 20 gold');
  assert(!trainUnit(w, br, 'villager').ok && !trainUnit(w, tc, 'militia').ok, 'barracks cannot train villagers, TC cannot train militia');
  selectAt(w, br.x + 1, br.y + 1); commandAt(w, 44.5, 40.5); assert(br.rally, 'barracks rally point');
  run(w, 20.5); assert(w.units.length === 3, 'no militia before 21s');
  run(w, 1); const m = w.units[3]; assert(m && m.type === 'militia' && popCount(w) === 4, 'militia spawned after 21s, counts as pop');
  run(w, 10); assert(Math.hypot(m.x - 44.5, m.y - 40.5) < 1.5, 'militia walked to rally');
  select(w, m); commandAt(w, 30.5, 40.5); run(w, 10); assert(Math.floor(m.x) === 30 && Math.floor(m.y) === 40, 'militia selectable + movable');
  assert(trainUnit(w, br, 'militia').ok, '5th pop slot queued at barracks');
  const r = trainVillager(w, tc); assert(!r.ok && r.reason === 'pop', 'shared cap: TC blocked while barracks queue fills last slot (4 pop + 1 queued = 5)');
  run(w, 22); assert(popCount(w) === 5 && !trainUnit(w, br, 'militia').ok, 'pop 5/5: militia blocked too');
  let hn = 0; for (let y = 44; y < 60 && hn < 5; y += 2) for (let x = 40; x < 60 && hn < 5; x += 2) if (canPlace(w, 'house', x, y)) { placeBuilding(w, 'house', x, y, []).complete = true; hn++; }
  let ok = 0; for (let i = 0; i < 6; i++) if (trainUnit(w, br, 'militia').ok) ok++;
  assert(ok === 5 && br.queue.length === 5 && queuedCount(w) === 5, 'per-building queue cap 5');
}
{ // menu helpers
  const w = createWorld(); w.stockpile.wood = 60;
  assert(missingFor(w, { wood: 100 }) === 'need 40 wood' && missingFor(w, { wood: 60 }) === null, 'missing-resource text "need 40 wood"');
}
{ // resource balance: 6 villagers on mixed tasks incl. farm and carcass
  const w = createWorld({ stockpile: { food: 2000, wood: 2000, gold: 1000, stone: 1000 } });
  const tc = w.buildings[0]; const h = placeBuilding(w, 'house', 44, 44, []); h.complete = true;
  for (let i = 0; i < 3; i++) trainVillager(w, tc);
  run(w, 80); assert(w.units.length === 6, '6 villagers');
  const start = w.resources.reduce((t, n) => t + n.amount, 0), base = { ...w.stockpile }, created0 = w.ledger.created;
  const [v1, v2, v3, v4, v5, v6] = w.units;
  const lc = placeBuilding(w, 'lumber_camp', 24, 24, [v1]); const mc = placeBuilding(w, 'mining_camp', 40, 41, [v2]);
  const farm = placeBuilding(w, 'farm', 29, 32, [v3]);
  orderGather(w, v4, w.resources.find(n => n.res === 'stone'));
  orderGather(w, v5, w.resources.find(n => n.res === 'food' && n.kind === 'berries'));
  orderHunt(w, v6, w.animals[0]);
  const spent = { ...w.stockpile };
  run(w, 45); orderGather(w, v1, w.resources.find(n => n.res === 'wood' && Math.floor(n.x) === 24 && Math.floor(n.y) === 22));
  orderGather(w, v2, w.resources.find(n => n.res === 'gold')); select(w, v6); commandAt(w, w.animals[0].x, w.animals[0].y);
  const kinds = new Set(); for (let t = 0; t < 150; t += 0.05) { tick(w, 0.05); for (const u of w.units) if (u.state === 'gathering') kinds.add(u.lastKind); }
  const end = w.resources.reduce((t, n) => t + n.amount, 0);
  const removed = start + (w.ledger.created - created0) - end;
  const delivered = RES_TYPES.reduce((t, r) => t + w.stockpile[r] - spent[r], 0), carried = w.units.reduce((t, u) => t + u.carry.amount, 0);
  const tasks = w.units.map(u => `${u.state}:${u.lastKind || '-'}`).join(' ');
  log(`mixed: removed=${removed} delivered=${delivered} carried=${carried} created=${w.ledger.created - created0} tasks=${tasks}`);
  assert(farm.complete && w.ledger.created - created0 === FARM_FOOD + CARCASS_FOOD, 'farm + carcass created during run');
  assert(['farm', 'carcass', 'berries', 'tree', 'gold_mine', 'stone_mine'].every(k => kinds.has(k)), 'all six task kinds active');
  assert(delivered > 0 && removed === delivered + carried, `mixed 6-villager balance: node decrease ${removed} == delivered ${delivered} + carried ${carried}`);
}

log('--- round 6: build mode (pure ui-state) ---');
{
  const w = createWorld(); const ui = createUi(); const tw = (x, y) => ({ x: x / 32, y: y / 32 }); // cam at 0,0
  select(w, w.units[0]); const n0 = w.buildings.length;
  startPlacing(ui, 'house'); pointerDown(ui, 39 * 32, 39 * 32); pointerUp(ui, w, tw);
  assert(w.buildings.length === n0 + 1 && ui.placing === null, 'successful placement exits build mode');
  startPlacing(ui, 'house'); pointerDown(ui, 34 * 32, 34 * 32); const r = pointerUp(ui, w, tw);
  assert(r.kind === 'place' && !r.ok && ui.placing === null && w.buildings.length === n0 + 1 && /Cannot build/.test(w.message.text), 'refused placement (over TC) exits build mode with message');
  startPlacing(ui, 'lumber_camp'); w.stockpile.wood = 10; pointerDown(ui, 45 * 32, 45 * 32); const r2 = pointerUp(ui, w, tw);
  assert(!r2.ok && ui.placing === null && /need 90 wood/.test(w.message.text), 'unaffordable placement refused, exits build mode');
  w.stockpile.wood = 200; startPlacing(ui, 'house'); pointerDown(ui, 44 * 32, 44 * 32); pointerMove(ui, 44 * 32 + 3, 44 * 32 + 3); pointerMove(ui, 48 * 32, 47 * 32); const r3 = pointerUp(ui, w, tw);
  assert(r3.kind === 'box' && w.buildings.length === n0 + 1 && ui.placing === 'house', 'drag-box in build mode never places (stays in build mode)');
  pointerDown(ui, 44 * 32, 44 * 32); pointerMove(ui, 44 * 32 + 3, 44 * 32 + 2); const r4 = pointerUp(ui, w, tw);
  assert(r4.kind === 'place' && r4.ok && ui.placing === null, 'small jitter (<=5px) still counts as a click and places');
  startPlacing(ui, 'house'); cancelPlacing(ui); assert(ui.placing === null && ui.ghost === null, 'cancel (Esc/right-click) exits build mode');
  const g = ghostAt(w, 'farm', 46, 46); assert(!g.valid && g.size === 3, 'farm ghost far from Mill/TC invalid');
  const g2 = ghostAt(w, 'farm', 37.5, 31.5); assert(g2.valid && g2.tx === 36 && g2.ty === 30, `farm ghost adjacent to TC valid at (${g2.tx},${g2.ty})`);
}
log(fail ? `RESULT: ${fail} FAILED, ${pass} passed` : `RESULT: ALL ${pass} PASSED`);
mkdirSync(fileURLToPath(new URL('../proof/', import.meta.url)), { recursive: true });
writeFileSync(out, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
