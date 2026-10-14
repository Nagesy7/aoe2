// Determinism + lockstep tests (headless). Run: node tests/determinism.test.mjs
import fs from 'fs';
import * as S from '../src/sim.js';
import { Lockstep } from '../src/lockstep.js';
const log = []; let pass = 0, fail = 0;
const out = s => { console.log(s); log.push(s); };
const assert = (c, m) => { if (c) { pass++; out('PASS: ' + m); } else { fail++; out('FAIL: ' + m); } };
out('determinism test ' + new Date().toISOString());

// Seeded random command generator: reads state from sim A only (A and B are identical if deterministic).
function genCommands(w, tick, R) {
  const cmds = [];
  if (tick === 0 && w.mp) for (const player of [0, 1]) {   // scripted opening so the economy is certainly exercised
    const owner = S.OWNERS[player], tc = w.buildings.find(b => b.type === 'town_center' && b.owner === owner), v = w.units.filter(u => u.owner === owner), d = player ? -1 : 1;
    const near = kind => w.resources.filter(n => n.kind === kind).sort((a, b) => S.hyp(a.x - tc.x, a.y - tc.y) - S.hyp(b.x - tc.x, b.y - tc.y))[0];
    cmds.push(S.makeCommand('order', { ids: [v[0].id], x: near('berries').x, y: near('berries').y }, player, tick));
    cmds.push(S.makeCommand('order', { ids: [v[1].id], x: near('gold_mine').x, y: near('gold_mine').y }, player, tick));
    cmds.push(S.makeCommand('build', { type: 'house', tx: d > 0 ? tc.x + 6 : tc.x - 3, ty: tc.y + 1, ids: [v[2].id] }, player, tick));
    cmds.push(S.makeCommand('build', { type: 'barracks', tx: d > 0 ? tc.x + 1 : tc.x, ty: d > 0 ? tc.y + 6 : tc.y - 5, ids: [v[2].id] }, player, tick));
    cmds.push(S.makeCommand('train', { id: tc.id, unit: 'villager' }, player, tick));
  }
  if (tick === 0 && w.mp) { cmds.forEach((c, i) => c.seq = i); return cmds; }
  for (const player of [0, 1]) {
    if (R() > 0.03) continue;
    const owner = S.OWNERS[player], units = w.units.filter(u => u.owner === owner), vills = units.filter(u => u.type === 'villager');
    const bs = w.buildings.filter(b => b.owner === owner && b.complete), pick = a => a[Math.floor(R() * a.length)];
    const sub = a => a.filter(() => R() < 0.5).map(u => u.id);
    const r = R();
    if (r < 0.3 && units.length) { const ids = sub(units); if (!ids.length) ids.push(pick(units).id);
      const fnd = w.buildings.filter(b => b.owner === owner && !b.complete), tgt = fnd.length && R() < 0.4 ? { x: fnd[0].x + 0.5, y: fnd[0].y + 0.5 } : R() < 0.5 ? pick(w.resources) : R() < 0.5 ? pick(w.units.filter(u => u.owner !== owner)) : null;
      const x = tgt ? tgt.x : R() * w.width, y = tgt ? tgt.y : R() * w.height; cmds.push(S.makeCommand('order', { ids, x, y }, player, tick)); }
    else if (r < 0.45 && vills.length) { const tc = bs.find(b => b.type === 'town_center') || bs[0]; if (!tc) continue;
      const type = pick(['house', 'house', 'mill', 'lumber_camp', 'mining_camp', 'barracks', 'farm', 'archery_range', 'blacksmith']);
      cmds.push(S.makeCommand('build', { type, tx: tc.x - 8 + Math.floor(R() * 20), ty: tc.y - 8 + Math.floor(R() * 20), ids: sub(vills) }, player, tick)); }
    else if (r < 0.7 && bs.length) { const b = pick(bs); if (b.trains.length) cmds.push(S.makeCommand('train', { id: b.id, unit: pick(b.trains) }, player, tick)); }
    else if (r < 0.78 && bs.length) { const b = pick(bs), techs = S.techsAt(b.type); if (techs.length) cmds.push(S.makeCommand('research', { id: b.id, tech: pick(techs) }, player, tick)); }
    else if (r < 0.83) { const tc = bs.find(b => b.type === 'town_center'); if (tc) cmds.push(S.makeCommand('ageup', { id: tc.id }, player, tick)); }
    else if (r < 0.88 && bs.length) { const b = pick(bs); cmds.push(S.makeCommand('cancel', { id: b.id }, player, tick)); }
    else if (r < 0.94 && bs.length) { const b = pick(bs); cmds.push(S.makeCommand('rally', { id: b.id, x: R() * w.width, y: R() * w.height }, player, tick)); }
    else if (units.length) cmds.push(S.makeCommand('stop', { ids: sub(units) }, player, tick));
  }
  cmds.forEach((c, i) => c.seq = i);
  return cmds;
}
const rich = w => { for (const o of S.OWNERS) w.players[o].stockpile = { food: 3000, wood: 3000, gold: 2000, stone: 1000 }; return w; };

out('--- two sims, same command stream, 6000 ticks (5 min game time) ---');
{
  const A = rich(S.createWorld({ mp: true, seed: 42 })), B = rich(S.createWorld({ mp: true, seed: 42 })), C = rich(S.createWorld({ mp: true, seed: 42 }));
  B.viewer = 'enemy'; B.cur = 'enemy';   // B is "player 2's client": a different local viewer must not matter
  const R = S.rng(7); let same = 0, firstBad = -1, ncmd = 0; const stream = [], completed = new Set();
  const t0 = Date.now();
  for (let t = 0; t < 6000; t++) {
    const cmds = genCommands(A, t, R); ncmd += cmds.length; stream.push(...cmds.map(S.encodeCommand));
    S.stepTick(A, cmds); S.stepTick(B, cmds.map(c => JSON.parse(JSON.stringify(c))));
    S.stepTick(C, cmds.map(c => ({ ...S.decodeCommand(S.encodeCommand(c)), seq: c.seq })));
    const ha = S.stateHash(A), hb = S.stateHash(B), hc = S.stateHash(C);
    for (const b of A.buildings) if (b.complete && b.type !== 'town_center') completed.add(b.id);
    if (ha === hb && hb === hc) same++; else if (firstBad < 0) firstBad = t;
    if (t % 1000 === 999) out(`  tick ${t + 1}: hash ${ha} units ${A.units.length} buildings ${A.buildings.length} cmds so far ${ncmd}`);
  }
  out(`  ${Date.now() - t0} ms`);
  assert(same === 6000, `hashes identical on all 6000 ticks (${same}/6000${firstBad >= 0 ? ', first mismatch at ' + firstBad : ''})`);
  assert(ncmd > 250, `command stream exercised (${ncmd} commands)`);
  const kinds = new Set(stream.map(s => JSON.parse(s)[2])); assert(S.COMMAND_TYPES.every(k => kinds.has(k)), `all command types used: ${[...kinds].join(',')}`);
  assert(A.units.length > 6 && A.buildings.length > 2, `game actually progressed (units ${A.units.length}, buildings ${A.buildings.length}, deaths ${(A.deaths || []).length})`);
  const done = completed.size, techs = Object.keys(A.players.player.researched).length + Object.keys(A.players.enemy.researched).length;
  assert(done >= 2 && A.units.length + (A.deaths || []).length > 6, `economy ran: ${done} buildings completed during the run, ${techs} techs, ages ${A.players.player.age}/${A.players.enemy.age}, ${A.units.length} units alive`);
  // replay from the serialized stream reproduces the final hash
  const D = rich(S.createWorld({ mp: true, seed: 42 })); const by = new Map();
  stream.forEach((s, i) => { const c = S.decodeCommand(s); c.seq = i; (by.get(c.tick) || by.set(c.tick, []).get(c.tick)).push(c); });
  for (let t = 0; t < 6000; t++) S.stepTick(D, by.get(t) || []);
  assert(S.stateHash(D) === S.stateHash(A), `replay of serialized stream reproduces final hash ${S.stateHash(A)}`);
}

out('--- single player world (enemy camp + raids) is deterministic too ---');
{
  const A = S.createWorld({ enemy: true, raids: true, scenario: 'skirmish' }), B = S.createWorld({ enemy: true, raids: true, scenario: 'skirmish' });
  const R = S.rng(3); let ok = true;
  for (let t = 0; t < 4000; t++) { const cmds = genCommands(A, t, R).filter(c => c.player === 0); S.stepTick(A, cmds); S.stepTick(B, cmds); if (S.stateHash(A) !== S.stateHash(B)) { ok = false; break; } }
  assert(ok, `skirmish + raids: identical hashes for 4000 ticks (deaths ${(A.deaths || []).length}, raids ${A.ai.raidsSent})`);
}

out('--- different seeds differ ---');
{
  const a = S.createWorld({ mp: true, seed: 1 }), b = S.createWorld({ mp: true, seed: 2 });
  assert(S.stateHash(a) !== S.stateHash(b), `seed 1 ${S.stateHash(a)} != seed 2 ${S.stateHash(b)}`);
  // same seed, one extra command => hashes diverge
  const c = S.createWorld({ mp: true, seed: 1 }), d = S.createWorld({ mp: true, seed: 1 });
  const v = c.units.find(u => u.owner === 'player');
  S.stepTick(c, [S.makeCommand('order', { ids: [v.id], x: 30, y: 30 }, 0, 0)]); S.stepTick(d, []);
  for (let i = 0; i < 20; i++) { S.stepTick(c); S.stepTick(d); }
  assert(S.stateHash(c) !== S.stateHash(d), 'a single extra move command changes the hash');
}

out('--- mirrored 1v1 start ---');
{
  const w = S.createWorld({ mp: true, seed: 5 });
  const tcs = w.buildings.filter(b => b.type === 'town_center');
  assert(tcs.length === 2 && tcs[0].owner === 'player' && tcs[1].owner === 'enemy', 'two Town Centers, one per player');
  assert(tcs[0].x + tcs[1].x + 4 === w.width && tcs[0].y + tcs[1].y + 4 === w.height, `TCs point-mirrored (${tcs[0].x},${tcs[0].y}) / (${tcs[1].x},${tcs[1].y})`);
  const cnt = (o, f) => w.units.filter(u => u.owner === o && f(u)).length;
  assert(cnt('player', () => true) === 3 && cnt('enemy', () => true) === 3, '3 villagers each');
  const mirrored = w.resources.every(n => w.resources.some(m => m.res === n.res && m.x === w.width - n.x && m.y === w.height - n.y));
  assert(mirrored, `all ${w.resources.length} resources have a mirrored twin`);
  assert(w.players.player.stockpile.food === 200 && w.players.enemy.stockpile.food === 200, 'separate stockpiles, 200 food each');
  // player 2 commands only affect player 2
  const v2 = w.units.find(u => u.owner === 'enemy'), v1 = w.units.find(u => u.owner === 'player'), tc2 = tcs[1];
  S.stepTick(w, [S.makeCommand('train', { id: tc2.id, unit: 'villager' }, 1, 0)]);
  assert(w.players.enemy.stockpile.food === 150 && w.players.player.stockpile.food === 200, 'player 2 training pays from player 2 stockpile');
  S.stepTick(w, [S.makeCommand('train', { id: tc2.id, unit: 'villager' }, 0, 1)]);
  assert(tc2.queue.length === 1, 'player 1 cannot use player 2 Town Center');
  S.stepTick(w, [S.makeCommand('order', { ids: [v2.id], x: 10, y: 10 }, 0, 2)]);
  assert(v2.state === 'idle', 'player 1 cannot order player 2 units');
  S.stepTick(w, [S.makeCommand('order', { ids: [v1.id], x: v2.x, y: v2.y }, 0, 3)]);
  assert(w.units.length === 6, 'state intact after foreign order attempts');
  const hb = S.applyCommand(w, S.makeCommand('build', { type: 'house', tx: tc2.x - 4, ty: tc2.y, ids: [v2.id] }, 1, 4));
  assert(hb && hb.owner === 'enemy' && v2.state === 'to_build', 'player 2 foundation is owned by player 2 and its villager goes to build');
  assert(S.withPlayer(w, 'enemy', () => S.queuedCount(w)) === 1 && S.queuedCount(w) === 0, 'queued units count only against their own player\'s population');
}

out('--- command serialization roundtrip ---');
{
  const cmds = [S.makeCommand('order', { ids: [3, 4], x: 12.3456789, y: 40.1 }, 1, 77), S.makeCommand('build', { type: 'house', tx: 10, ty: 11, ids: [5] }, 0, 3),
    S.makeCommand('train', { id: 1, unit: 'villager' }, 0, 9), S.makeCommand('research', { id: 1, tech: 'loom' }, 1, 9), S.makeCommand('ageup', { id: 1 }, 0, 9),
    S.makeCommand('cancel', { id: 1, index: 0 }, 1, 10), S.makeCommand('rally', { id: 2, x: 1, y: 2 }, 0, 11), S.makeCommand('stop', { ids: [1] }, 1, 12)];
  const rt = cmds.map(c => S.decodeCommand(S.encodeCommand(c)));
  assert(JSON.stringify(rt) === JSON.stringify(cmds), `${cmds.length} commands survive encode/decode exactly`);
  assert(cmds[0].args.x === Math.round(12.3456789 * 64) / 64, 'coordinates quantized to 1/64 tile');
  let bad = 0; for (const s of ['[1,2,"order",{}]', '[1,0,"explode",{}]', '["x",0,"stop",{}]', '[1,0,"stop",null]']) { try { S.decodeCommand(s); } catch { bad++; } }
  assert(bad === 4, 'malformed commands rejected (bad player / type / tick / args)');
}

out('--- lockstep scheduler ---');
{
  // fake network: per-direction queues delivered manually
  const q = [[], []];
  const L = [0, 1].map(me => new Lockstep({ me, delay: 3, hashEvery: 5, send: m => q[1 - me].push(m) }));
  const deliver = i => { for (const m of q[i].splice(0)) L[i].receive(m); };
  // ticks 0..2 are pre-filled (input delay), so both can run them alone
  let n0 = 0; while (L[0].next()) n0++;
  assert(n0 === 3, `player 1 runs the 3 pre-filled delay ticks and then waits (ran ${n0})`);
  assert(L[0].next() === null && L[0].missing().join() === '1', 'tick 3 blocked: waiting for player 2 input');
  L[0].queue('train', { id: 1, unit: 'villager' });
  // player 2 has not sent anything for tick 3 yet
  deliver(0); for (let i = 0; i < 3; i++) L[1].next();     // player 2 reaches tick 3, sending sets for 3..5
  deliver(0); deliver(1);
  const row = L[0].next(); assert(row !== null && L[0].tick === 4, 'tick 3 proceeds once both sets (incl. an empty one) arrived');
  // commands queued at tick 4 execute at tick 7 on both
  L[1].queue('order', { ids: [9], x: 1, y: 2 });
  const got = [[], []];
  for (let step = 0; step < 40; step++) { for (const i of [0, 1]) { const c = L[i].next(); if (c) got[i].push(...c.map(x => `${x.tick}:${x.player}:${x.type}`)); } deliver(0); deliver(1); }
  assert(got[0].join() === got[1].join() && got[0].length === 2, `both execute the same commands on the same ticks: ${got[0].join(' ')}`);
  let ran = 0;
  for (let i = 0; i < 10; i++) if (L[1].next()) ran++;   // player 1 now silent
  assert(L[1].tick <= L[0].tick + 3 && L[1].next() === null, `without peer input a client stops at most "delay" ticks past the peer (peer ${L[0].tick}, self ${L[1].tick}, ran ${ran})`);
  // lost message recovery
  const lost = q[0].splice(0); assert(lost.length >= 1, 'messages in flight'); L[0].next(); q[1].splice(0);
  L[1].requestMissing(); deliver(1); deliver(0);
  let ok = false; for (let i = 0; i < 10; i++) { if (L[1].next()) ok = true; deliver(0); deliver(1); }
  assert(ok, 'stalled client recovers dropped inputs via resend request');
  // hash exchange
  const D = [0, 1].map(me => new Lockstep({ me, delay: 2, hashEvery: 10, send: m => q[1 - me].push(m) }));
  q[0].length = q[1].length = 0; let desync = null; D[0].onDesync = d => desync = d;
  D[0].hash(10, 'aa'); D[1].hash(10, 'aa'); for (const m of q[0].splice(0)) D[0].receive(m); for (const m of q[1].splice(0)) D[1].receive(m);
  assert(D[0].checked === 1 && D[1].checked === 1 && !desync, 'matching hashes counted on both');
  D[0].hash(20, 'aa'); D[1].hash(20, 'bb'); for (const m of q[0].splice(0)) D[0].receive(m);
  assert(desync && desync.tick === 20, `hash mismatch reported as desync at tick ${desync && desync.tick}`);
}

out('--- full lockstep loop: two clients with independent worlds and jittery delivery ---');
{
  const W = [0, 1].map(() => rich(S.createWorld({ mp: true, seed: 99 }))); W[1].viewer = 'enemy'; W[1].cur = 'enemy';
  const net = [];   // {to, at, m}
  let now = 0; const R = S.rng(11), J = S.rng(12);
  const L = [0, 1].map(me => new Lockstep({ me, delay: 3, hashEvery: 20, send: m => net.push({ to: 1 - me, at: now + 1 + Math.floor(J() * 4), m: JSON.parse(JSON.stringify(m)) }) }));
  let desync = null; L.forEach(l => l.onDesync = d => desync = d);
  let stalls = 0;
  for (now = 0; now < 9000 && Math.min(L[0].tick, L[1].tick) < 3000; now++) {
    for (let i = net.length - 1; i >= 0; i--) if (net[i].at <= now) { L[net[i].to].receive(net[i].m); net.splice(i, 1); }
    for (const i of [0, 1]) {
      if (R() < 0.04) { const cmds = genCommands(W[i], L[i].tick, R).filter(c => c.player === i); for (const c of cmds) L[i].queue(c.type, c.args); }
      const cmds = L[i].next(); if (!cmds) { stalls++; continue; }
      S.stepTick(W[i], cmds); L[i].hash(W[i].tick, S.stateHash(W[i]));
    }
  }
  assert(L[0].tick >= 3000 && L[1].tick >= 2997, `both clients advanced 3000 ticks (${L[0].tick}/${L[1].tick}, ${stalls} stall-steps waiting for input)`);
  assert(!desync && L[0].checked >= 140, `no desync, ${L[0].checked} hash checks matched`);
  assert(stalls > 0, 'scheduler actually waited on late input');
}

out(`RESULT: ${fail ? fail + ' FAILED, ' : 'ALL '}${pass} PASSED`);
fs.mkdirSync(new URL('../proof/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../proof/determinism.log', import.meta.url), log.join('\n') + '\n');
process.exit(fail ? 1 : 0);
