// Balance A/B: run sim/balance.mjs on two refs with the same seeds and compare.
//   node sim/compare.mjs [--base HEAD~] [--head WORKTREE|<ref>] [--seeds 4] [--minutes 30] [--jobs 8] [--no-test]
//                        [--base-json f] [--head-json f]   (reuse an existing balance.json instead of simulating that side)
//                        [--out proof/compare.json]
// A ref is checked out with `git worktree add` into a temp dir (removed afterwards); WORKTREE = the current working tree.
// Prints the per-clan win-rate diff, flags clans outside 45-55% (Kishu must be <= 53%), lists matchups whose winner flipped,
// and runs `npm test` in both trees (exit code + RESULT lines). Long: 16 seeds ~ 15-45 min per side, so run with & + log.
import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path'; import { tmpdir } from 'node:os'; import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);
const seeds = arg('seeds', '4'), minutes = arg('minutes', '30'), jobs = arg('jobs', '8'), out = arg('out', join(ROOT, 'proof/compare.json'));
const sides = [{ name: 'base', ref: arg('base', 'HEAD~'), json: arg('base-json') }, { name: 'head', ref: arg('head', 'WORKTREE'), json: arg('head-json') }];
const sh = (c, cwd = ROOT) => execSync(c, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const run = (cmd, args, cwd) => new Promise(ok => { const c = spawn(cmd, args, { cwd }); let o = ''; c.stdout.on('data', d => { o += d; }); c.stderr.on('data', d => { o += d; }); c.on('close', code => ok({ code, out: o })); });
const temps = [];
for (const s of sides) {
  if (s.ref === 'WORKTREE') { s.dir = ROOT; s.sha = sh('git rev-parse --short HEAD') + (sh('git status --porcelain -- src sim tests') ? '+dirty' : ''); continue; }
  s.sha = sh(`git rev-parse --short ${s.ref}`); s.dir = mkdtempSync(join(tmpdir(), `inu-cmp-${s.sha}-`)); rmSync(s.dir, { recursive: true });
  sh(`git worktree add --detach ${s.dir} ${s.sha}`); temps.push(s.dir);
  if (existsSync(join(ROOT, 'node_modules')) && !existsSync(join(s.dir, 'node_modules'))) symlinkSync(join(ROOT, 'node_modules'), join(s.dir, 'node_modules'));
}
try {
  await Promise.all(sides.map(async s => {
    if (s.json) { s.report = JSON.parse(readFileSync(s.json, 'utf8')); console.log(`${s.name} ${s.ref} (${s.sha}): reused ${s.json}`); return; }
    const f = join(tmpdir(), `inu-cmp-${s.name}-${Date.now()}.json`); console.log(`${s.name} ${s.ref} (${s.sha}): simulating ${seeds} seeds x ${minutes} min ...`);
    const r = await run(process.execPath, ['sim/balance.mjs', '--seeds', seeds, '--minutes', minutes, '--jobs', String(Math.max(1, Math.floor(+jobs / 2))), '--out', f], s.dir);
    if (r.code) throw new Error(`${s.name} sim failed:\n${r.out}`); s.report = JSON.parse(readFileSync(f, 'utf8'));
  }));
  const [A, B] = sides.map(s => s.report); const civs = Object.keys(B.table); const lines = [];
  const L = s => { console.log(s); lines.push(s); };
  L(`\nper-clan win rate (${A.seeds} vs ${B.seeds} seeds, ${A.minutes}/${B.minutes} min)   base ${sides[0].sha}  ->  head ${sides[1].sha}`);
  const flags = [];
  for (const c of civs) { const a = A.table[c]?.winRate, b = B.table[c].winRate; const d = a == null ? NaN : b - a;
    const bad = b < 0.45 || b > 0.55 || (c === 'kishu' && b > 0.53); if (bad) flags.push(c);
    L(`${c.padEnd(9)} ${a == null ? '  -  ' : (100 * a).toFixed(1).padStart(5)}%  -> ${(100 * b).toFixed(1).padStart(5)}%   ${isNaN(d) ? '' : (d >= 0 ? '+' : '') + (100 * d).toFixed(1)}${bad ? '   <-- OUTSIDE 45-55%' + (c === 'kishu' ? ' (Kishu cap 53%)' : '') : ''}`); }
  const mu = R => { const m = {}; for (const r of R.results) { const k = [r.a, r.b].sort().join(' v '); m[k] ||= {}; m[k][r.winnerCiv] = (m[k][r.winnerCiv] || 0) + 1; } return m; };
  const lead = o => { const e = Object.entries(o || {}).sort((x, y) => y[1] - x[1]); return !e.length ? null : e[1] && e[0][1] === e[1][1] ? 'even' : e[0][0]; };
  const ma = mu(A), mb = mu(B); const flipped = Object.keys(mb).filter(k => lead(ma[k]) && lead(ma[k]) !== lead(mb[k]));
  L(`\nflipped matchups (${flipped.length}):`); for (const k of flipped) L(`  ${k}: ${lead(ma[k])} ${JSON.stringify(ma[k])} -> ${lead(mb[k])} ${JSON.stringify(mb[k])}`);
  L(flags.length ? `\nFLAGGED (outside 45-55%): ${flags.join(', ')}` : '\nall clans within 45-55% (Kishu <= 53%)');
  const tests = {};
  if (!has('no-test')) for (const s of sides) { const r = await run('npm', ['test', '--silent'], s.dir); const res = r.out.split('\n').filter(l => /RESULT|^FAIL/.test(l));
    tests[s.name] = { code: r.code, lines: res }; L(`\nnpm test @ ${s.name} ${s.sha}: exit ${r.code}`); for (const l of res) L('  ' + l); }
  writeFileSync(out, JSON.stringify({ base: { ref: sides[0].ref, sha: sides[0].sha, table: A.table }, head: { ref: sides[1].ref, sha: sides[1].sha, table: B.table }, flagged: flags, flipped, tests, text: lines }, null, 1));
  console.log(`\nwrote ${out}`); process.exitCode = flags.length || tests.head?.code ? 1 : 0; // head decides; a failing base is expected when fixing it
} finally { for (const d of temps) try { sh(`git worktree remove --force ${d}`); } catch { } }
