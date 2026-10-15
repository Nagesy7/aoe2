// AI-vs-AI civilization balance simulation. Every pair of clans plays on mirrored 1v1 maps from both sides
// (so map side never favours a clan). Conquest win (Den Hall + Fortress destroyed) or, at the time limit, higher score.
// Usage: node sim/balance.mjs [--seeds 2] [--minutes 35] [--jobs 8] [--out proof/balance.json]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

export async function playGame(a, b, seed, minutes) {
  const { createMpWorld, stepTick } = await import('../src/sim.js');
  const { setupComputers, score } = await import('../src/ai.js');
  const w = createMpWorld({ seed }); setupComputers(w, { player: a, enemy: b });
  const N = minutes * 60 * 20; for (let i = 0; i < N && !w.winner; i++) stepTick(w);
  const sp = score(w, 'player'), se = score(w, 'enemy');
  const winner = w.winner || (sp >= se ? 'player' : 'enemy');
  return { a, b, seed, winnerCiv: winner === 'player' ? a : b, conquest: !!w.winner, minutes: +(w.time / 60).toFixed(1), score: [Math.round(sp), Math.round(se)],
    ages: [w.players.player.age, w.players.enemy.age] };
}
if (!isMainThread) {
  const { jobs, minutes } = workerData; const out = [];
  for (const [a, b, seed] of jobs) out.push(await playGame(a, b, seed, minutes));
  parentPort.postMessage(out);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { CIV_IDS } = await import('../src/civs.js');
  const seeds = +arg('seeds', 2), minutes = +arg('minutes', 35), nj = +arg('jobs', 8), out = arg('out', 'proof/balance.json');
  const civs = (arg('civs', '') || CIV_IDS.join(',')).split(',');
  const games = [];
  for (let i = 0; i < civs.length; i++) for (let j = i + 1; j < civs.length; j++) for (let s = 1; s <= seeds; s++) { games.push([civs[i], civs[j], s]); games.push([civs[j], civs[i], s]); }
  const buckets = Array.from({ length: nj }, () => []); games.forEach((g, i) => buckets[i % nj].push(g));
  const t0 = Date.now();
  const res = (await Promise.all(buckets.filter(b => b.length).map(jobs => new Promise((ok, ko) => { const w = new Worker(fileURLToPath(import.meta.url), { workerData: { jobs, minutes } }); w.on('message', ok); w.on('error', ko); })))).flat();
  const table = {}; for (const c of civs) table[c] = { games: 0, wins: 0 };
  for (const r of res) { table[r.a].games++; table[r.b].games++; table[r.winnerCiv].wins++; }
  for (const c of civs) table[c].winRate = +(table[c].wins / table[c].games).toFixed(3);
  const side = { player: res.filter(r => r.winnerCiv === r.a).length, enemy: res.filter(r => r.winnerCiv === r.b).length };
  const report = { minutes, seeds, games: res.length, conquests: res.filter(r => r.conquest).length, sideWins: side, table, ms: Date.now() - t0, results: res };
  writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(`games ${res.length} (conquest ${report.conquests}), side wins P1 ${side.player} / P2 ${side.enemy}, ${(report.ms / 1000).toFixed(0)} s`);
  for (const c of civs) console.log(`${c.padEnd(9)} ${table[c].wins}/${table[c].games}  ${(100 * table[c].winRate).toFixed(1)}%`);
}
