// Unit-handling efficiency: formation moves, smart commands, auto-reassign, attack-move, waypoint queue, determinism.
import * as S from '../src/sim.js';
let pass = 0, fail = 0; const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };
const { createWorld, applyCommand, makeCommand, stepTick, stateHash, hyp } = S;
const cmd = (w, type, args) => applyCommand(w, makeCommand(type, args, 0, w.tick));
const steps = (w, n) => { for (let i = 0; i < n; i++) stepTick(w); };
const mil = w => w.units.filter(u => u.owner === 'player' && u.type !== 'villager');
const vil = w => w.units.filter(u => u.owner === 'player' && u.type === 'villager');
{ // formation
  const w = createWorld({ scenario: 'skirmish', enemy: true }); const us = mil(w); const ids = us.map(u => u.id);
  const r = cmd(w, 'order', { ids, x: 30.5, y: 30.5 }); assert(r === 'move', `ground -> move (${r})`);
  const dests = us.map(u => u.dest.join()); assert(new Set(dests).size === us.length, `formation: ${us.length} distinct destination tiles`);
  const xs = us.map(u => u.dest[0]), ys = us.map(u => u.dest[1]); assert(Math.max(...xs) - Math.min(...xs) <= 3 && Math.max(...ys) - Math.min(...ys) <= 3, 'formation: compact grid around target');
  const slow = Math.min(...us.map(u => u.speed)); assert(us.every(u => u.groupSpeed === slow), `formation: group moves at slowest speed ${slow}`);
  steps(w, 400); assert(us.every(u => u.state !== 'moving' && hyp(u.x - 30.5, u.y - 30.5) < 4), 'formation: everyone arrived, none stacked');
  assert(new Set(us.map(u => `${Math.floor(u.x)},${Math.floor(u.y)}`)).size === us.length, 'formation: no two units share a tile on arrival');
}
{ // smart commands
  const w = createWorld({ enemy: false }); const v = vil(w)[0];
  const bush = w.resources.find(n => n.kind === 'berries'); assert(cmd(w, 'order', { ids: [v.id], x: bush.x, y: bush.y }) === 'gather' && v.target === bush.id, 'resource -> gather');
  steps(w, 200); assert(v.carry.amount > 0 || w.stockpile.food > 200, 'villager gathering food');
  v.carry = { res: 'food', amount: 5 }; const tc = w.buildings[0];
  const r = cmd(w, 'order', { ids: [v.id], x: tc.x + 1, y: tc.y + 1 }); assert(r === 'dropoff' && v.state === 'to_drop', `friendly drop-off building -> drop off (${r})`);
  const f0 = w.stockpile.food; steps(w, 120); assert(w.stockpile.food >= f0 + 5, 'drop-off delivered carried food');
  const s = createWorld({ scenario: 'skirmish', enemy: true }); const foe = s.units.find(u => u.owner === 'enemy'); const m = mil(s);
  assert(cmd(s, 'order', { ids: m.map(u => u.id), x: foe.x, y: foe.y }) === 'attack' && m.every(u => u.attack), 'enemy -> attack');
}
{ // auto-reassign: exhausted node -> nearest node of the same kind
  const w = createWorld({ enemy: false }); const v = vil(w)[0]; const bush = w.resources.find(n => n.kind === 'berries');
  cmd(w, 'order', { ids: [v.id], x: bush.x, y: bush.y }); bush.amount = 3; steps(w, 600);
  const nt = w.resources.find(n => n.id === v.target); assert(nt && nt.id !== bush.id && nt.kind === 'berries', `exhausted bush -> villager moved on to bush #${nt && nt.id}`);
  assert(v.lastDrop != null, 'dropped off, then went back to gathering');
}
{ // attack-move and waypoint queue
  const s = createWorld({ scenario: 'skirmish', enemy: true }); const m = mil(s); const foe = s.units.find(u => u.owner === 'enemy');
  const r = cmd(s, 'order', { ids: m.map(u => u.id), x: foe.x, y: foe.y + 3, amove: true }); assert(r === 'amove' && m.some(u => u.amove), 'attack-move issued');
  let engaged = false; for (let i = 0; i < 1200 && !engaged; i++) { stepTick(s); engaged = m.some(u => u.attack); } assert(engaged, 'attack-move: units engage enemies on the way');
  const w = createWorld({ scenario: 'skirmish', enemy: true }); const u = mil(w)[0];
  cmd(w, 'order', { ids: [u.id], x: 30.5, y: 30.5 }); assert(cmd(w, 'order', { ids: [u.id], x: 26.5, y: 34.5, queue: true }) === 'queue' && u.waypoints.length === 1, 'shift-queue adds a waypoint');
  steps(w, 800); assert(hyp(u.x - 26.5, u.y - 34.5) < 2.5, `waypoints followed in order (ended at ${u.x.toFixed(1)},${u.y.toFixed(1)})`);
}
{ // determinism: same command stream -> same hash
  const run = () => { const w = createWorld({ scenario: 'skirmish', enemy: true }); const m = mil(w).map(u => u.id), foe = w.units.find(u => u.owner === 'enemy');
    cmd(w, 'order', { ids: m, x: foe.x, y: foe.y + 3, amove: true }); steps(w, 50); cmd(w, 'order', { ids: m.slice(0, 2), x: 30.5, y: 30.5, queue: true }); steps(w, 600); return stateHash(w); };
  const a = run(), b = run(); assert(a === b, `deterministic hash ${a}`);
}
console.log(fail ? `RESULT: ${fail} FAILED` : `RESULT: ALL ${pass} PASSED`); process.exit(fail ? 1 : 0);
