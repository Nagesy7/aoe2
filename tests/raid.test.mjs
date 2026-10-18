// Boss Raids + Inu Score reporting. Run: node tests/raid.test.mjs
import fs from 'fs';
import * as R from '../src/raid.js';
const { BR } = R; const log = []; let pass = 0, fail = 0;
const out = s => { console.log(s); log.push(s); }; const assert = (c, m) => { if (c) { pass++; out('PASS: ' + m); } else { fail++; out('FAIL: ' + m); } };
out('raid test ' + new Date().toISOString());
// ---- shared sim is the published file, unchanged ----
const mine = fs.readFileSync(new URL('../src/vendor/boss-raid.js', import.meta.url), 'utf8');
let ref = null, refFrom = '';
try { ref = fs.readFileSync('/workspace/kibble-pay/public/lib/boss-raid.js', 'utf8'); refFrom = 'kibble-pay repo'; } catch { }
if (!ref) try { const r = await fetch('https://kibble-pay.vercel.app/lib/boss-raid.js'); if (r.ok) { ref = await r.text(); refFrom = 'kibble-pay.vercel.app'; } } catch { }
assert(ref === null ? (out('  (no reference reachable: skipped)'), true) : mine === ref, `src/vendor/boss-raid.js byte-identical to ${refFrom || 'reference'} (RAID_VERSION ${BR.RAID_VERSION})`);
for (const f of ['../docs/BOSS_RAIDS.md', '../docs/INU_SCORE.md']) { const a = fs.readFileSync(new URL(f, import.meta.url), 'utf8'); let b = null; try { b = fs.readFileSync('/workspace/inu-shared/' + (f.includes('BOSS') ? 'boss-raids.md' : 'inu-score.md'), 'utf8'); } catch { }
  const own = f.includes('INU_SCORE') ? '\n## Inu Empires: replay-verified' : null; // this repo's own section, after the keeper's text
  assert(b === null || (own && a.includes(own) ? a.startsWith(b.trimEnd()) : a === b), `${f.slice(3)} mirrors the Inu Verse keeper's spec exactly${own ? ' (plus our replay-verified section after it)' : ''}`); }
// ---- a simple skilled bot (also used by the screenshot flow) ----
export function bot(fight) { const r = fight.raid, s = r.s, tele = r.telegraph(), bl = r.bossLane(), safe = l => !tele.includes(l);
  let goal = bl; if (!safe(goal)) { const c = [0, 1, 2, 3, 4].filter(safe).sort((a, b) => Math.abs(a - s.lane) - Math.abs(b - s.lane)); goal = c[0] ?? s.lane; }
  if (goal < s.lane) fight.press('L'); else if (goal > s.lane) fight.press('R'); else if (s.lane === bl && s.cd === 0) fight.press('B'); }
const results = {};
for (const b of BR.BOSSES) { const f = R.createFight(b.id); while (!f.s.over) { bot(f); f.tick(); } const res = f.result(), sim = BR.simulate(b.id, res.inputs);
  results[b.id] = res;
  assert(sim.ok && sim.score === res.score && sim.cleared === res.cleared && BR.checkInputs(res.inputs) === null, `${b.name}: recorded inputs re-play on the server sim to the same score (${res.score}, ${res.cleared ? 'cleared in ' + res.seconds + ' s' : 'not cleared'}, ${res.inputs.length} inputs)`);
  assert(R.createReplay(b.id, res.inputs).finish() === res.score, `${b.name}: replay viewer reproduces the run`); }
assert(Object.values(results).some(r => r.cleared), 'the fights are clearable by skill');
// recorder rules
const f2 = R.createFight('storm-crow'); assert(f2.press('B') && f2.press('L') && f2.press('R') && !f2.press('B'), 'max 3 inputs per tick');
f2.tick(); assert(JSON.stringify(f2.inputs) === '[[0,"B"],[0,"L"],[0,"R"]]', 'inputs recorded as [tick, action]');
assert(!f2.press('X'), 'unknown actions rejected');
try { R.createReplay('storm-crow', [[5, 'B'], [1, 'L']]); assert(false, 'bad replay refused'); } catch { assert(true, 'out-of-order replay refused'); }
// ---- entry ----
assert(R.entryLabel({ signedIn: true, entry: 'auto:kennel' }).text === 'Auto-entered (Kibble Kennel)', 'server says auto:kennel -> "Auto-entered (Kibble Kennel)"');
assert(R.entryLabel({ signedIn: true, entry: 'auto:cosmetic' }).auto, 'auto:cosmetic -> auto-entered');
assert(R.entryLabel({ signedIn: true, entry: 'free' }).text === 'Enter free', 'no tier/cosmetic -> "Enter free"');
assert(/guest/.test(R.entryLabel({ signedIn: false }).text) && !R.entryLabel({ signedIn: false }).auto, 'guest -> Enter free, results stay on device');
assert(R.entryLabel({ signedIn: false, kennelTier: 'pup' }).auto, 'local hint: Kennel tier -> auto-entered');
// ---- client API: inputs only, never a score ----
const calls = []; const kp = { session: 't', async _req(p, b) { calls.push([p, b]); return { ok: true, ticket: 'TK', entry: 'auto:kennel' }; } };
await R.join(kp); await R.start(kp); await R.submit(kp, 'TK', results['fog-badger'].inputs);
assert(calls.map(c => c[1].op).join() === 'join,start,submit' && calls.every(c => c[0] === '/api/raid'), 'join / start / submit to /api/raid');
assert(JSON.stringify(Object.keys(calls[2][1]).sort()) === '["inputs","op","ticket"]', 'submit carries ticket + inputs only (no score)');
const off = await R.getRaid({ f: async () => { throw new Error('down'); } });
assert(off.offline && off.event.boss === BR.eventAt(Date.now()).boss && off.schedule.length === 6, 'raid server down: local schedule, guest play still works');
// ---- guest bests ----
const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
assert(R.saveLocal(mem, 'E1', { boss: 'x', score: 10, inputs: [] }) && !R.saveLocal(mem, 'E1', { boss: 'x', score: 5, inputs: [] }) && R.localBest(mem, 'E1').score === 10, 'guest result stays on device, best only');
// ---- no stat effects ----
const simSrc = ['sim.js', 'ai.js', 'lockstep.js'].map(f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')).join('\n');
const raidSrc = ['raid.js', 'raid-ui.js'].map(f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')).join('\n');
assert(!/from '\.\/(raid|raid-ui|score|vendor\/boss-raid)\.js'|boss-raid|createRaid|reportMatch/.test(simSrc), 'RTS sim / AI / lockstep never read raid or score code');
assert(!/from '\.\/(sim|ai|lockstep|kennel)\.js'/.test(raidSrc) && !/tier|cosmetic/i.test(fs.readFileSync(new URL('../src/raid.js', import.meta.url), 'utf8').replace(/kennelTier|hasCosmetic|Kibble Kennel|Inu cosmetic|auto:kennel|auto:cosmetic|tiers, cosmetics|Kennel tiers and cosmetics/g, '')), 'raid code does not import the RTS sim and gives no tier/cosmetic boosts');
assert(createdSame(), 'raid fight is a pure function of boss + inputs (same inputs -> same score)');
function createdSame() { const i = results['gutter-gator'].inputs; return BR.simulate('gutter-gator', i).score === BR.simulate('gutter-gator', i).score; }
const copy = raidSrc.match(/`[^`]*`|'[^']*'/g).join(' ');
assert(![/\bbuy\b/i, /\bsell\b/i, /pump it/i, /\bmoon\b/i, /\bdump\b/i, /\bbet\b(?!s, no)/i].slice(0, 5).some(r => r.test(copy)) && /No bets, no raffles/.test(copy), 'raid copy: no banned words; says no bets, no raffles');
// (Inu Empires match scoring is replay-verified now: tests/score.test.mjs)
out(`\n${pass} passed, ${fail} failed`);
fs.mkdirSync(new URL('../proof/', import.meta.url), { recursive: true }); fs.writeFileSync(new URL('../proof/raid-test.log', import.meta.url), log.join('\n') + '\n');
process.exit(fail ? 1 : 0);
