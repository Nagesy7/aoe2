import * as K from '../src/kibble.js';
let pass = 0, fail = 0; const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };
// fee math (millionths)
let q = K.feeSplit(K.toU(250)); assert(q.fee === 5 * K.U && q.owner === 2.5 * K.U && q.daily === 0.625 * K.U && q.weekly === 1.25 * K.U && q.monthly === 0.625 * K.U && q.total === 255 * K.U, '250 KIBBLE: 2% fee = 1% owner + 0.25/0.5/0.25% pools');
for (const p of [1, 7, 33, 99999, 123457, 1e9 + 3]) { q = K.feeSplit(p); assert(q.owner + q.daily + q.weekly + q.monthly === q.fee && q.fee === Math.floor(p * 0.02) && q.owner >= Math.floor(p / 100), `exact split, no dust lost (price ${p}u)`); }
assert(K.OWNER_WALLET === 'BzLYTFAfUsjzQ5x8bx5BbPK4DFtaHrLCuferkvkxTNGJ', 'treasury address');
// shop + tiers
const s = K.newState(); assert(!K.buy(s, 'skin_snow_akita').ok, 'cannot buy without (simulated) wallet');
assert(K.connectDemo(s, 25_000).id === 'hound', '25k demo balance = Hound'); assert(K.tierOf(K.toU(1e6)).id === 'shogun' && K.tierOf(K.toU(5)).id === 'pup' && K.tierOf(0).id === 'none', 'tier thresholds');
const b0 = s.kibbleU; const r = K.buy(s, 'skin_snow_akita'); assert(r.ok && b0 - s.kibbleU === K.toU(255), 'buy deducts price + 2%');
assert(s.treasuryU === K.toU(2.5) && s.pools.weekly === K.toU(1.25) && s.ledger[0].to === K.OWNER_WALLET, 'fee settled to treasury + pools');
assert(K.equip(s, 'skin_snow_akita') && K.equip(s, 'title_hound') && !K.equip(s, 'title_shogun'), 'equip respects ownership + tier');
assert(Object.values(K.COSMETICS).every(c => ['colour', 'banner', 'title', 'skin', 'civ'].includes(c.kind)), 'cosmetics only');
// Elo + ranking
assert(JSON.stringify(K.elo(1200, 1200, 1)) === '[1216,1184]', 'Elo equal ratings win +16');
const d = K.recordMatch(s, { mode: 'ai', opp: 'hard', win: true, minutes: 20 }); assert(d > 16 && s.me.wins === 1 && s.bones === K.BONES_PER_WIN && s.packs.SHIB === 3, `beat hard AI: +${d}, bones + pack points`);
const R = K.rank([{ name: 'a', rating: 1300, wins: 5, minutesWon: 100 }, { name: 'b', rating: 1300, wins: 6, minutesWon: 300 }, { name: 'c', rating: 1300, wins: 6, minutesWon: 120 }, { name: 'd', rating: 1400, wins: 1, minutesWon: 9 }]);
assert(R.map(p => p.name).join('') === 'dcba', 'rank: rating, then wins, then fewer minutes per win');
// payouts by rank, exact
s.pools.daily = 1001; const pr = K.payout(s, 'daily', [s.me, ...K.RIVALS]); assert(pr.winners.reduce((a, w) => a + w.amountU, 0) === 1001 && s.pools.daily === 0 && pr.winners[0].amountU >= pr.winners[1].amountU, 'daily pool paid 50/30/20 by rank, nothing lost');
assert(K.joinCup(s, '2026-10').ok && K.joinCup(s, '2026-10').fee === 0, 'Kibble Cup entry free for holders'); const n = K.newState(); assert(!K.joinCup(n, '2026-10').ok, 'Cup needs a tier');
console.log(fail ? `RESULT: ${fail} FAILED` : `RESULT: ALL ${pass} PASSED`); process.exit(fail ? 1 : 0);
