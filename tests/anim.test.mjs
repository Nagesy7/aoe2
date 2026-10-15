// Animation audit: every unit action maps to the right animation + tool (src/anim.js, used by the renderer).
// Drives the real sim (gather each node type, hunt sheep, build, repair, carry, attack, death). Run: node tests/anim.test.mjs
import * as S from '../src/sim.js';
import { unitAction, GATHER_TOOL, ATTACK_TOOL } from '../src/anim.js';
import { UNITS } from '../src/techtree.js';
import { writeFileSync, mkdirSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
const lines = []; let fail = 0, pass = 0; const log = s => { console.log(s); lines.push(s); };
const assert = (c, m) => { log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };
const run = (w, secs, until) => { for (let t = 0; t < secs; t += 0.05) { S.tick(w, 0.05); if (until && until()) return true; } return false; };
const world = () => { const w = S.createWorld({ stockpile: { food: 999, wood: 999, gold: 999, stone: 999 } }); return w; };
const vill = w => w.units.find(u => u.owner === 'player' && u.type === 'villager');
const near = (w, u, kind) => w.resources.filter(n => n.kind === kind && n.amount > 0).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
const seen = {};
// gather types
for (const [kind, tool] of [['tree', 'axe'], ['gold_mine', 'pick'], ['stone_mine', 'pick'], ['berries', 'basket']]) {
  const w = world(), u = vill(w), n = near(w, u, kind); S.orderGather(w, u, n);
  assert(run(w, 60, () => u.state === 'gathering'), `${kind}: villager reaches node and gathers`);
  const a = unitAction(u, w, w.time); seen[a.action] = a; assert(a.tool === tool && a.tool !== 'hammer' && a.motion !== 'walk', `${kind}: ${a.action} uses ${a.tool} (${a.motion}), expected ${tool}`);
  run(w, 80, () => u.state === 'to_drop'); const c = unitAction(u, w, w.time);
  assert(c.action === 'carry' && c.tool !== 'hammer' && c.carry === n.res && u.carry.amount > 0 && u.carry.kind === kind, `${kind}: returning villager carries ${c.carry} visibly (no tool)`);
}
{ // farm
  const w = world(), u = vill(w), tc = w.buildings.find(b => b.type === 'town_center'); let r = null; for (const [dx, dy] of [[tc.size, 0], [-3, 0], [0, tc.size], [0, -3], [tc.size, 1], [-3, 1]]) if (!r) r = S.placeBuilding(w, 'farm', tc.x + dx, tc.y + dy, [u]);
  assert(r && r.ok !== false, 'farm placed');
  assert(run(w, 120, () => u.state === 'gathering'), 'farm: villager builds then farms');
  const a = unitAction(u, w, w.time); assert(a.action === 'farm' && a.tool === 'hoe', `farm: ${a.action} with ${a.tool}`);
}
{ // build + repair use the hammer
  const w = world(), u = vill(w), tc = w.buildings.find(b => b.type === 'town_center'); S.placeBuilding(w, 'house', tc.x - 4, tc.y - 4, [u]);
  run(w, 30, () => u.state === 'building'); let a = unitAction(u, w, w.time); assert(a.action === 'build' && a.tool === 'hammer' && a.motion === 'swing', `build: ${a.action} with ${a.tool} (${a.motion})`);
  tc.hp -= 300; S.orderBuild(w, u, tc); run(w, 30, () => u.state === 'building'); a = unitAction(u, w, w.time); assert(a.action === 'repair' && a.tool === 'hammer', `repair: ${a.action} with ${a.tool}`);
}
{ // sheep: spear stab to kill, then knife butcher (stab/grab cycle), then carry meat
  const w = world(), u = vill(w); const sh = w.animals[0]; sh.owner = 'player'; S.orderHunt(w, u, sh);
  let a = unitAction(u, w, w.time); assert(a.action === 'hunt' && a.tool === 'spear' && a.tool !== 'hammer', `hunt: approaching sheep with ${a.tool}`);
  run(w, 60, () => Math.hypot(sh.x - u.x, sh.y - u.y) < 2.2 && u.state === 'to_hunt'); a = unitAction(u, w, w.time);
  assert(u.state !== 'to_hunt' || (a.tool === 'spear' && a.motion === 'stab'), `hunt: kill blow is a spear stab (${a.motion})`);
  assert(run(w, 60, () => u.state === 'gathering'), 'sheep butchered into a carcass and gathered');
  const ms = new Set(); for (let t = 0; t < 1.2; t += 0.1) { const b = unitAction(u, w, t); ms.add(b.motion); assert(b.tool === 'knife', `butcher t=${t.toFixed(1)}: knife (${b.motion})`); }
  assert(ms.has('stab') && ms.has('grab'), 'butcher cycle = knife stab then grab meat');
  run(w, 80, () => u.state === 'to_drop'); a = unitAction(u, w, w.time); assert(a.action === 'carry' && a.meat && a.tool !== 'hammer', 'returning with meat (carry, meat visible)');
}
{ // attack per unit type, move, idle, death
  const w = world(); w.resources = []; w.animals = [];
  for (const type of Object.keys(UNITS)) { const u = S.spawnEnemy(w, type, 20, 20); u.state = 'attacking'; const a = unitAction(u, w, 0);
    assert(a.action === 'attack' && a.tool === ATTACK_TOOL[type] && a.tool && a.tool !== 'hammer' && a.motion, `${type}: attack ${a.tool} (${a.motion})`);
    u.state = 'moving'; u.path = [{ x: 22, y: 20 }]; u.lastAttackAt = null; assert(unitAction(u, w, 0).motion === 'walk', `${type}: move = walk`);
    u.state = 'idle'; u.path = []; assert(unitAction(u, w, 0).motion === 'idle', `${type}: idle`);
    u.dying = 0.2; assert(unitAction(u, w, 0).motion === 'death', `${type}: death`); }
}
assert(!Object.values(GATHER_TOOL).includes('hammer'), 'no gather type maps to the hammer');
log(fail ? `RESULT: ${fail} FAILED, ${pass} PASSED` : `RESULT: ALL ${pass} PASSED`);
const root = fileURLToPath(new URL('..', import.meta.url)); mkdirSync(root + 'proof', { recursive: true }); writeFileSync(root + 'proof/anim-test.log', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
