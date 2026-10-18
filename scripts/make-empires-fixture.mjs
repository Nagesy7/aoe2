// Test fixture: a real, replayable, WINNING command log in the exact format the client submits for the One Inu Score (--mode ai: vs computer; --mode mp: online lockstep log).
// The "player" is the built-in computer brain, run at tick boundaries (where the game applies a human's clicks) through a patched
// copy of ai.js in a temp dir; every command it issues is recorded. The enemy is the normal computer opponent. The log is then
// replayed in a fresh world with the real modules and must reproduce the same final hash, or the fixture is not written.
// Usage: node scripts/make-empires-fixture.mjs [--out tests/fixtures/empires-win.json] [--max-min 40]
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path'; import { pathToFileURL } from 'node:url';
import { SIM_FILES, simId } from './sim-id.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('mode', 'ai'), out = arg('out', MODE === 'mp' ? 'tests/fixtures/empires-mp-win.json' : 'tests/fixtures/empires-win.json'), MAXT = +arg('max-min', 40) * 60 * 20, THINK = +arg('think', 20);
const src = new URL('../src/', import.meta.url), tmp = mkdtempSync(join(tmpdir(), 'emp-fx-'));
for (const f of SIM_FILES) copyFileSync(new URL(f, src), join(tmp, f));
let ai = readFileSync(join(tmp, 'ai.js'), 'utf8');
ai = ai.replace('const cmd = (type, args) => applyCommand(world, { tick: world.tick, player: pi, type, args });', 'const cmd = (type, args) => (globalThis.__rec || applyCommand)(world, { tick: world.tick, player: pi, type, args });');
ai += '\nexport { think as __think };\n'; writeFileSync(join(tmp, 'ai.js'), ai);
const P = await import(pathToFileURL(join(tmp, 'sim.js'))), PA = await import(pathToFileURL(join(tmp, 'ai.js')));
const R = await import(new URL('sim.js', src)), RA = await import(new URL('ai.js', src));
const { CIV_IDS } = await import(new URL('civs.js', src));
function play(seed, civ, enemy) {
  const w = P.createMpWorld({ seed }); if (MODE === 'ai') { PA.setupComputers(w, { enemy }); w.players.player.civ = civ; w.viewer = 'player'; } else { w.players.player.civ = civ; w.players.enemy.civ = enemy; w.victory = true; }
  const mem = { attacking: false, wave: 0, armyIdx: 0, lastAttack: -999 }, log = []; let seq = 0;
  globalThis.__rec = (world, c) => { const m = P.makeCommand(c.type, c.args, 0, world.tick); log.push(MODE === 'mp' ? [m.tick, 0, seq++, m.type, m.args] : [m.tick, m.type, m.args]); return P.applyCommand(world, m); };
  const RUSH = +arg('rush-min', 12) * 60 * 20;
  for (let t = 0; t < MAXT && !w.winner; t++) { if (t % THINK === 5 % THINK) { try { PA.__think(w, 'player', mem); } finally { w.cur = 'player'; } }
    if (t % 100 === 3) for (const b of w.buildings) if (b.owner === 'player' && b.complete && b.type !== 'town_center' && (b.trains || []).length && b.queue.length < 2)
      globalThis.__rec(w, { type: 'train', args: { id: b.id, unit: b.trains[b.trains.length - 1] } });
    const armyN = w.units.filter(u => u.owner === 'player' && u.type !== 'villager' && u.hp > 0).length;
    if (t >= RUSH && t % 200 === 7 && (armyN >= 18 || (t >= 2 * RUSH && armyN >= 10))) { // keep the whole army on attack-move at the enemy Den Hall (then any enemy building)
      const army = w.units.filter(u => u.owner === 'player' && u.type !== 'villager' && u.state !== 'garrisoned' && u.hp > 0).map(u => u.id);
      const tgt = w.buildings.find(b => b.owner === 'enemy' && b.type === 'town_center') || w.buildings.find(b => b.owner === 'enemy' && b.type === 'castle') || w.buildings.find(b => b.owner === 'enemy');
      if (process.argv.includes('--debug')) console.log(`  t=${(t / 1200).toFixed(1)}m attack army ${army.length} tgt ${tgt?.type} ${tgt?.hp}/${tgt?.maxHp} enemy mil ${w.units.filter(u => u.owner === 'enemy' && u.type !== 'villager').length} res ${JSON.stringify(w.players.player.stockpile)}`);
      if (tgt) globalThis.__rec(w, { type: 'order', args: { ids: army, x: tgt.x + tgt.size / 2, y: tgt.y + tgt.size / 2, amove: true } }); } globalThis.__recOn = 0; const r = globalThis.__rec; globalThis.__rec = null; P.stepTick(w); globalThis.__rec = r; }
  globalThis.__rec = null; return { w, log };
}
for (let seed = +arg('seed0', 1); seed < 40; seed++) for (const [civ, enemy] of [['kai', 'shiba'], ['hokkaido', 'akita'], ['shiba', 'kishu']]) {
  if (!CIV_IDS.includes(civ) || !CIV_IDS.includes(enemy)) continue;
  const t0 = Date.now(), { w, log } = play(seed, civ, enemy);
  console.log(`seed ${seed} ${civ} vs ${enemy}: winner ${w.winner || '-'} at ${(w.time / 60).toFixed(1)} min, ${log.length} commands, ${Date.now() - t0} ms`);
  if (w.winner !== 'player') continue;
  // independent replay with the real modules, exactly as the server does it
  const v = R.createMpWorld({ seed }); if (MODE === 'ai') { RA.setupComputers(v, { enemy }); v.players.player.civ = civ; v.viewer = 'player'; } else { v.players.player.civ = civ; v.players.enemy.civ = enemy; v.victory = true; }
  let i = 0; const end = w.tick; for (let t = 0; t < end; t++) { const cmds = []; while (i < log.length && log[i][0] === t) { const e = log[i++]; cmds.push(MODE === 'mp' ? { tick: e[0], player: e[1], seq: e[2], type: e[3], args: e[4] } : { tick: e[0], player: 0, type: e[1], args: e[2] }); } R.stepTick(v, cmds); }
  const hw = P.stateHash(w), hv = R.stateHash(v);
  if (hw !== hv || v.winner !== 'player') { console.log(`  replay mismatch ${hw} vs ${hv} (${v.winner}); skipping`); continue; }
  writeFileSync(out, JSON.stringify({ note: MODE === 'mp' ? 'Generated by scripts/make-empires-fixture.mjs: a real winning online-1v1 lockstep log (seat 0 driven by the computer brain at tick boundaries and conquers; seat 1 sends no commands). Test fixture.' : 'Generated by scripts/make-empires-fixture.mjs: a real vs-computer log (player side driven by the computer brain at tick boundaries). Test fixture.', simId: simId(src), mode: MODE, seed, civ, enemy, ...(MODE === 'mp' ? { civs: [civ, enemy] } : {}), endTick: end, winTime: v.winTime, hash: hv, log }));
  console.log(`wrote ${out}: ${end} ticks (${(v.winTime / 60).toFixed(1)} min), ${log.length} commands, hash ${hv}, ${JSON.stringify(log).length} bytes`); process.exit(0);
}
console.log('no player win found'); process.exit(1);
