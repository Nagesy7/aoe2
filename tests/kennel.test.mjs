// Kibble Kennel: tier/loadout logic + proof that cosmetics never touch the simulation. Run: node tests/kennel.test.mjs
import fs from 'fs';
import * as S from '../src/sim.js';
import { setupComputers } from '../src/ai.js';
import { render } from '../src/render.js';
import * as N from '../src/kennel.js';
const log = []; let pass = 0, fail = 0;
const out = s => { console.log(s); log.push(s); };
const assert = (c, m) => { if (c) { pass++; out('PASS: ' + m); } else { fail++; out('FAIL: ' + m); } };
out('kennel test ' + new Date().toISOString());

// ---- tiers and loadouts ----
assert(JSON.stringify(N.unlockedBy('pup')) === '["kn_tag","kn_banner_bronze"]', 'Pup unlocks name tag + bronze banner');
assert(['kn_collar', 'kn_flag', 'kn_banner_silver'].every(id => N.unlockedBy('guard').includes(id)) && N.unlockedBy('guard').length === 5, 'Guard Dog adds collars, flag recolour, silver banner');
assert(['kn_aura_paw', 'kn_banner_anim', 'kn_title_alpha'].every(id => N.unlockedBy('alpha').includes(id)), 'Alpha adds paw aura, animated Den Hall banner, Alpha title');
assert(['kn_aura_gold', 'kn_bskin_gold', 'kn_name_gold'].every(id => N.unlockedBy('top').includes(id)) && N.unlockedBy('top').length === N.IDS.length, 'Top Dog unlocks everything incl. gold aura, building skins, golden name');
assert(N.unlockedBy(null).length === 0, 'no tier: nothing unlocked');
const eq = N.defaultEquip('top');
assert(eq.banner === 'kn_banner_anim' && eq.aura === 'kn_aura_gold', 'default loadout picks the best item per slot');
assert(JSON.stringify(N.activeIds(eq, 'guard').sort()) === JSON.stringify(['kn_banner_silver', 'kn_collar', 'kn_flag', 'kn_tag'].filter(id => Object.values(eq).includes(id)).sort()) && !N.activeIds(eq, 'guard').includes('kn_aura_gold'), 'after a tier drop only still-allowed items show');
assert(N.itemState('kn_aura_gold', { tier: 'guard', everTier: 'top', equipped: eq }) === 'relock', 'expired tier item = "Relock to keep"');
assert(N.itemState('kn_aura_gold', { tier: 'guard', everTier: 'guard', equipped: {} }) === 'locked', 'never-reached item = locked');
assert(N.itemState('kn_tag', { tier: 'pup', everTier: 'pup', equipped: { tag: 'kn_tag' } }) === 'on' && N.itemState('kn_banner_bronze', { tier: 'pup', equipped: {} }) === 'available', 'on / available states');
const e2 = {}; assert(!N.equip(e2, 'kn_aura_gold', 'pup') && N.equip(e2, 'kn_tag', 'pup') && e2.tag === 'kn_tag' && N.unequip(e2, 'tag') && e2.tag === null, 'equip refuses above-tier items; unequip clears the slot');
assert(JSON.stringify(N.sanitizeIds(['kn_tag', 'kn_tag', 'evil<script>', 'kn_aura_gold', 'kn_aura_paw', 42, 'gold'])) === '["kn_tag","kn_aura_gold"]', 'peer ids: unknown dropped, one per slot');
assert(N.sanitizeIds('kn_tag').length === 0 && N.sanitizeIds(null).length === 0, 'peer ids: non-arrays ignored');
assert(N.sanitizeName('<img src=x onerror=1>Rex') === 'img srcx onerror1Rex'.slice(0, 14) && !/[<>]/.test(N.sanitizeName('<b>')), 'peer name stripped of markup and capped');
// ---- dev override ----
assert(N.overrideTier('?kennel=alpha') === 'alpha' && N.overrideTier('?kennel=none') === 'none' && N.overrideTier('?kennel=whale') === null && N.overrideTier('') === null, '?kennel= override parsing');
for (const t of N.TIER_IDS) { const f = N.fixture(t); assert(f.tier === t && f.lockedAmount >= N.tierById(t).amount && f.unlockDate && (t === 'top' ? !f.nextTier : f.nextTier?.id === N.TIERS[N.rankOf(t) + 1].id), `fixture ${t}: tier, locked, unlock date, next tier`); }
assert(N.fixture('none').tier === null && N.fixture('none').nextTier.id === 'pup', 'fixture none: no tier, next = Pup');
// ---- server response normalising ----
const junk = N.normalize({ tier: 'whale', lockedAmount: 'lots', nextTier: { id: 'x' } });
assert(junk.tier === null && junk.lockedAmount === 0 && junk.nextTier === null, 'unknown tier / junk values normalised to no tier');
assert(N.normalize(null).source === 'holder-only' && N.normalize(null).stale, 'missing response = holder-only, stale');
const ff = async () => { throw new Error('down'); }; const off = await N.fetchKennel('W', { f: ff });
assert(off.tier === null && off.reason === 'offline', 'kennel API down: degrades to no tier (no crash)');
let seen = ''; await N.fetchKennel('Wal let', { refresh: true, f: async u => { seen = u; return { ok: true, json: async () => ({ tier: 'guard', lockedAmount: 2e6 }) }; } });
assert(seen.endsWith('/api/kennel?wallet=Wal%20let&refresh=1'), 'fetch uses /api/kennel?wallet=&refresh=1');
// ---- lock form ----
const p = N.lockPlan(1_000_000, 60, 5_000_000);
assert(p.ok && p.raw === 1_000_000_000_000n && p.timeline[0].id === 'guard' && p.timeline[0].days === 30 && p.timeline[1].id === 'pup' && p.timeline[1].days === 53, '1M for 60 days: Guard Dog 30 days, then Pup 53 days; raw 6-decimals');
assert(p.unlockAt > Date.now() / 1000 + 60 * 86400, 'unlock time = now + duration (+10 min margin)');
assert(!N.lockPlan(0, 30).ok && !N.lockPlan(100, 31).ok && !N.lockPlan(2e6, 30, 1e6).ok, 'rejects zero amount, odd duration, more than the balance');
assert(N.lockPlan(50, 14).timeline.length === 0, 'small lock: no tier on its own');
// ---- copy: required warning, no banned words ----
const copy = [N.WARNING, ...Object.values(N.COSMETICS).flatMap(c => [c.name, c.desc]), ...Object.values(N.SLOT_NAMES), ...N.TIERS.map(t => t.name)].join(' | ');
const src = fs.readFileSync(new URL('../src/kennel-ui.js', import.meta.url), 'utf8');
const uiStrings = (src.match(/`[^`]*`|'[^']*'/g) || []).join(' ');
assert(N.WARNING === "Locked tokens can't be sold until the unlock date.", 'exact can\'t-sell warning');
const banned = [/\bbuy\b/i, /\bsell\b/i, /pump it/i, /\bmoon\b/i, /\bdump\b/i, /\byield\b(?!, no)/i];
assert(!banned.slice(0, 5).some(r => r.test(copy) || r.test(uiStrings)), 'no buy / sell / pump it / moon / dump in Kennel copy');
assert(/no yield, no rewards, no draws/.test(src), 'lock form states: no yield, no rewards, no draws');

// ---- cosmetics never touch the simulation ----
const TEXTS = new Set();
function mockCtx() { const noop = () => {}; const grad = { addColorStop: noop }; const t = { fillText: s => TEXTS.add(String(s)), measureText: s => ({ width: String(s).length * 5 }), createRadialGradient: () => grad, createLinearGradient: () => grad, createPattern: () => null, getImageData: () => ({ data: new Uint8ClampedArray(4) }), canvas: { width: 1280, height: 720 } };
  return new Proxy(t, { get: (o, k) => k in o ? o[k] : noop, set: (o, k, v) => { o[k] = v; return true; } }); }
const ALL = { ids: new Set(N.IDS), name: 'Top Dog Rex', tier: 'top' };
function run(withCos, ticks = 2400) {
  const w = S.createWorld({ mp: true, seed: 11 }); setupComputers(w, { player: 'shiba', enemy: 'akita' }); w.viewer = 'player';
  const ctx = mockCtx(), cam = { x: 0, y: 0 }, hashes = [];
  for (let i = 0; i < ticks; i++) { S.stepTick(w);
    if (i % 40 === 0) { cam.x = (i * 7) % 900; cam.y = (i * 3) % 600;
      const before = S.stateHash(w); render(ctx, w, cam, withCos ? { cosmetics: { player: ALL, enemy: { ids: new Set(N.unlockedBy('guard')), name: 'Rival' } } } : {}, null);
      if (S.stateHash(w) !== before) return { mutated: i }; hashes.push(S.stateHash(w)); } }
  return { hashes, final: S.stateHash(w), units: w.units.length, buildings: w.buildings.length, winner: w.winner || null };
}
let A, B; try { A = run(true); B = run(false); } catch (e) { out('render threw: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' / ')); A = { error: true }; B = {}; }
assert(!A.error && !A.mutated, 'render with every Kennel cosmetic leaves the sim hash unchanged on every frame');
assert(A.final && A.final === B.final && JSON.stringify(A.hashes) === JSON.stringify(B.hashes), `2400 ticks AI vs AI: identical state hashes with and without cosmetics (${A.hashes?.length} checkpoints, final ${A.final})`);
assert([...TEXTS].some(t => t.includes('Top Dog Rex')), 'cosmetics really were drawn in the test (golden name tag rendered)');
assert(A.units === B.units && A.buildings === B.buildings && A.winner === B.winner, 'same unit/building counts and outcome');
const simSrc = ['sim.js', 'ai.js', 'lockstep.js'].map(f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')).join('\n');
assert(!/kennel(?! hut)|cosmetic/i.test(simSrc), 'sim / AI / lockstep code never reads cosmetics or Kennel data');
const drawSrc = fs.readFileSync(new URL('../src/kennel-draw.js', import.meta.url), 'utf8');
assert(!/\b(u|b)\.[a-zA-Z_]+\s*(=(?!=)|\+\+|--|\+=|-=)/.test(drawSrc), 'kennel-draw.js never assigns to unit/building fields');

// ---- lock review card (fees shown before Phantom opens) ----
{ const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const b58 = u => { let n = 0n; for (const b of u) n = n * 256n + BigInt(b); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const b of u) { if (b) break; s = '1' + s; } return s; };
  const sv = (d, o) => { let v = 0, sh = 0, b; do { b = d[o++]; v |= (b & 127) << sh; sh += 7; } while (b & 128); return [v, o]; };
  function parseTx(b64) { const d = Uint8Array.from(Buffer.from(b64, 'base64')); let [ns, o] = sv(d, 0); o += 64 * ns; if (d[o] & 128) o++;
    const header = { numRequiredSignatures: d[o], numReadonlySignedAccounts: d[o + 1], numReadonlyUnsignedAccounts: d[o + 2] }; o += 3;
    let nk; [nk, o] = sv(d, o); const staticAccountKeys = []; for (let i = 0; i < nk; i++, o += 32) { const k = d.slice(o, o + 32); staticAccountKeys.push({ toBase58: () => b58(k) }); }
    o += 32; let ni; [ni, o] = sv(d, o); const compiledInstructions = [];
    for (let i = 0; i < ni; i++) { const programIdIndex = d[o++]; let na, nd; [na, o] = sv(d, o); const accountKeyIndexes = [...d.slice(o, o + na)]; o += na; [nd, o] = sv(d, o); compiledInstructions.push({ programIdIndex, accountKeyIndexes, data: d.slice(o, o + nd) }); o += nd; }
    return { message: { header, staticAccountKeys, compiledInstructions } }; }
  const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/kennel-lock-tx.json', import.meta.url))), tx = parseTx(fx.tx), facts = N.txFacts(tx);
  assert(facts.signatures === 2 && facts.priorityMicroLamports === 0 && facts.networkLamports === 10_000, `fee card: real built tx -> 2 signatures, no priority fee, network 10,000 lamports (${JSON.stringify(facts)})`);
  const plan = N.lockPlan(100_000, 14), card = N.feeCard(fx.costs, facts, plan);
  assert(card.ok, 'fee card: real kibble-pay response (with costs) renders: ' + (card.reason || ''));
  const row = k => card.rows.find(r => r.k === k)?.amount;
  assert(row('protocol') === '0.16 SOL' && row('token') === '500 $KIBBLE' && row('rent-meta') === '0.00625856 SOL' && row('rent-escrow') === '0.00148844 SOL' && row('rent-treasury') === '0.00151384 SOL' && row('network') === '0.00001 SOL',
    'fee card rows = fork-measured numbers: 0.16 SOL creation fee, 500 $KIBBLE (0.5%), rent 0.00625856 + 0.00148844 + 0.00151384 SOL, network 0.00001 SOL');
  assert(card.totalSol === '0.16927084' && card.tokenDebit === '100,500' && card.back === '100,000', `fee card totals: 0.16927084 SOL, 100,500 $KIBBLE out, 100,000 back at unlock (${card.totalSol}, ${card.tokenDebit})`);
  assert(card.rows.every(r => r.back === false), 'fee card: no fee or rent is marked as coming back');
  assert(!card.canSign && /0\.007887646 SOL/.test(card.warn[0] || ''), 'fee card: treasury test wallet (0.0079 SOL) -> "not enough SOL" warning and the sign button stays off');
  const ok2 = N.feeCard({ ...fx.costs, balances: { lamports: 2e8, tokenRaw: '200000000000', enoughSol: true, enoughToken: true } }, facts, plan); assert(ok2.ok && ok2.canSign && !ok2.warn.length, 'fee card: funded wallet -> can sign');
  const later = structuredClone(fx.costs); later.sol.rent.treasuryAta = 0; later.sol.total -= 1_513_840; const c3 = N.feeCard(later, facts, plan);
  assert(c3.ok && !c3.rows.some(r => r.k === 'rent-treasury') && c3.totalSol === '0.167757', 'fee card: once Streamflow\'s $KIBBLE account exists the one-time rent row disappears (0.167757 SOL)');
  const tamper = (f, why) => { const c = structuredClone(fx.costs); f(c); const r = N.feeCard(c, facts, plan); assert(!r.ok, `fee card refuses to open Phantom when ${why} (${r.reason})`); };
  tamper(c => { c.sol.total -= 1; }, 'the SOL total does not add up');
  tamper(c => { c.token.feeRaw = '0'; }, 'the token fee is understated');
  tamper(c => { c.token.lockedRaw = '1'; }, 'the locked amount differs from the form');
  tamper(c => { c.sol.network = 5000; c.sol.total -= 5000; }, 'the network fee does not match the transaction');
  tamper(c => { c.sol.protocolFee = -1; }, 'a fee is negative');
  for (const bad of [null, { error: 'rpc down' }, {}]) assert(!N.feeCard(bad, facts, plan).ok, `fee card: no made-up numbers when costs are ${JSON.stringify(bad)}`);
  const ui = fs.readFileSync(new URL('../src/kennel-ui.js', import.meta.url), 'utf8');
  assert(/K\.review = \{[^}]*card: N\.feeCard/.test(ui) && ui.indexOf('signAndSend') > ui.indexOf('async function signReview'), 'kennel-ui: the build shows the review card; signAndSend only runs from the card\'s Sign button');
  const copy = (ui.match(/reviewCard[\s\S]*?\n\}/)?.[0] || '') + card.rows.map(r => r.label + ' ' + r.note).join(' ');
  assert(!/\b(buy|pump it|moon|dump)\b/i.test(copy) && !/\bsell\b/i.test(copy.replace(N.WARNING, '')), 'fee card copy: no banned words');
}

out(`\n${pass} passed, ${fail} failed`);
fs.mkdirSync(new URL('../proof/', import.meta.url), { recursive: true }); fs.writeFileSync(new URL('../proof/kennel-test.log', import.meta.url), log.join('\n') + '\n');
process.exit(fail ? 1 : 0);
