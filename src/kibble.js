import { COSMETICS as CIV_COSMETICS } from './civs.js';
// $KIBBLE network for Inu Empires: SIMULATED. No real wallet, no tokens move, no transactions are sent.
// Mirrors Inu Verse's Kibble Mall (inu-verse/src/mall.js): amounts are integer millionths (U), fee in basis points,
// owner takes the rounding remainder so every unit of the fee lands somewhere. Prize pools go by leaderboard rank
// (skill), never by chance; there is no wagering and no paid entry. Bones is the free in-game currency, never cashed out.
// Cosmetics only: nothing here touches stats, resources or build speed.
// Real mode (default): wallet, balance, purchases and inventory come from kibble-pay (Phantom SIWS, on-chain $KIBBLE).
// Demo (?demo=1): the original fully simulated wallet below. Ladder, packs and Cup stay local stubs in both modes.
export const SIMULATED = (() => { try { return new URLSearchParams(location.search).get('demo') === '1'; } catch { return false; } })();
export const U = 1_000_000;
export const OWNER = { name: 'President Inu', title: "President's Vault" }; // public name of the creator-share wallet
export const OWNER_WALLET = 'BzLYTFAfUsjzQ5x8bx5BbPK4DFtaHrLCuferkvkxTNGJ'; // President's Vault: Solana receive address, display only (simulated: no transfers)
export const shortAddr = a => `${a.slice(0, 4)}…${a.slice(-4)}`;
export const solscan = a => `https://solscan.io/account/${a}`;
export const vaultLink = (a = OWNER_WALLET, id = '') => `<a${id ? ` id="${id}"` : ''} href="${solscan(a)}" target="_blank" rel="noopener" title="${a}">${shortAddr(a)} ↗</a>`;
export const FEE_BPS = { owner: 100, daily: 25, weekly: 50, monthly: 25 }; // 2% total: 1% President's Vault, 0.25/0.5/0.25% pools
export const FEE_TOTAL_BPS = 200;
export const toU = k => Math.round(k * U);
export const fmtK = u => (u / U).toLocaleString('en-US', { maximumFractionDigits: 6 });
export function feeSplit(priceU) {
  const fee = Math.floor(priceU * FEE_TOTAL_BPS / 10000);
  const daily = Math.floor(priceU * FEE_BPS.daily / 10000), weekly = Math.floor(priceU * FEE_BPS.weekly / 10000), monthly = Math.floor(priceU * FEE_BPS.monthly / 10000);
  return { price: priceU, fee, owner: fee - daily - weekly - monthly, daily, weekly, monthly, total: priceU + fee };
}
// ---- holder tiers (demo token thresholds, reviewed monthly per the flywheel doc) ----
export const TIERS = [{ id: 'none', name: 'No tier', min: 0 }, { id: 'pup', name: 'Pup', min: 1 }, { id: 'hound', name: 'Hound', min: 20_000 }, { id: 'alpha', name: 'Alpha', min: 100_000 }, { id: 'shogun', name: 'Shogun', min: 1_000_000 }];
export const tierOf = balU => [...TIERS].reverse().find(t => balU >= toU(t.min) && (t.min > 0 || balU === 0)) || TIERS[0];
const tierRank = id => TIERS.findIndex(t => t.id === id);
// ---- cosmetics (tier unlocks + shop skins). kind: colour | banner | title | skin ----
export const COSMETICS = {
  colour_azure: { kind: 'colour', name: 'Azure team colour', value: '#2a50c8', tier: 'none' },
  colour_jade: { kind: 'colour', name: 'Jade team colour', value: '#1f8a5a', tier: 'pup' },
  colour_sakura: { kind: 'colour', name: 'Sakura team colour', value: '#d0508a', tier: 'hound' },
  colour_gold: { kind: 'colour', name: 'Shogun gold colour', value: '#c89a20', tier: 'shogun' },
  banner_paw: { kind: 'banner', name: 'Paw banner', tier: 'none' }, banner_bone: { kind: 'banner', name: 'Crossed-bones banner', tier: 'hound' }, banner_fuji: { kind: 'banner', name: 'Animated Fuji banner', tier: 'alpha' },
  title_pup: { kind: 'title', name: 'Pup', tier: 'pup' }, title_hound: { kind: 'title', name: 'Hound', tier: 'hound' }, title_alpha: { kind: 'title', name: 'Alpha', tier: 'alpha' }, title_shogun: { kind: 'title', name: 'Shogun', tier: 'shogun' },
  skin_golden_shiba: { kind: 'skin', name: 'Golden Shiba villagers', tier: 'hound' },
  skin_snow_akita: { kind: 'skin', name: 'Snow Akita riders', price: 2500000, tier: 'none' },
  skin_kai_brindle: { kind: 'skin', name: 'Kai brindle Footpaws', price: 4000000, tier: 'none' },
  skin_spitz_monk: { kind: 'skin', name: 'Spitz shrine-keeper robe', price: 9000000, tier: 'pup' },
  // clan shield finishes (match-select card glow; cosmetic only, every clan itself is free)
  ...Object.fromEntries(Object.values(CIV_COSMETICS).flat().map(c => [c.id, { kind: 'civ', name: c.name, price: c.price, tier: 'none' }])),
};
export const SHOP = Object.entries(COSMETICS).filter(([, c]) => c.price).map(([id]) => id);
export function newState(name = 'You') {
  return { v: 1, wallet: null, kibbleU: 0, bones: 0, owned: [], equipped: { colour: 'colour_azure', banner: 'banner_paw', title: null, skin: null },
    treasuryU: 0, pools: { daily: 0, weekly: 0, monthly: 0 }, ledger: [], payouts: [],
    me: { id: 'me', name, pack: 'SHIB', rating: 1200, wins: 0, losses: 0, minutesWon: 0 }, packs: { SHIB: 0 }, cup: { month: null, entrants: [] } };
}
// simulated wallet: fixed demo balance, no signature, no chain
export function connectDemo(s, balanceK = 25_000) { s.wallet = { address: 'DEMO-' + 'x'.repeat(8), simulated: true }; s.kibbleU = toU(balanceK); return tierOf(s.kibbleU); }
export function disconnect(s) { s.wallet = null; s.kibbleU = 0; for (const k of Object.keys(s.equipped)) if (s.equipped[k] && !canUse(s, s.equipped[k])) s.equipped[k] = k === 'colour' ? 'colour_azure' : k === 'banner' ? 'banner_paw' : null; }
export const tier = s => s.wallet ? tierOf(s.kibbleU) : TIERS[0];
export function canUse(s, id) { const c = COSMETICS[id]; if (!c) return false; if (c.price) return s.owned.includes(id) && tierRank(tier(s).id) >= tierRank(c.tier); return tierRank(tier(s).id) >= tierRank(c.tier); }
export function equip(s, id) { const c = COSMETICS[id]; if (!c || !canUse(s, id)) return false; s.equipped[c.kind] = id; return true; }
export function buy(s, id) {
  const c = COSMETICS[id]; if (!c || !c.price) return { ok: false, reason: 'not for sale' };
  if (!s.wallet) return { ok: false, reason: 'Connect the (simulated) wallet first' };
  if (s.owned.includes(id)) return { ok: false, reason: 'already owned' };
  if (tierRank(tier(s).id) < tierRank(c.tier)) return { ok: false, reason: `Needs ${c.tier} tier` };
  const q = feeSplit(toU(c.price)); if (s.kibbleU < q.total) return { ok: false, reason: `Need ${fmtK(q.total)} KIBBLE (incl. 2% fee)` };
  s.kibbleU -= q.total; s.owned.push(id); settle(s, id, q); return { ok: true, q };
}
function settle(s, item, q) { // single settlement point; a real backend would route q.owner to OWNER_WALLET and pools to pool wallets
  s.treasuryU += q.owner; s.pools.daily += q.daily; s.pools.weekly += q.weekly; s.pools.monthly += q.monthly;
  s.ledger.unshift({ item, price: q.price, fee: q.fee, owner: q.owner, daily: q.daily, weekly: q.weekly, monthly: q.monthly, to: OWNER_WALLET, simulated: true }); s.ledger.length = Math.min(s.ledger.length, 50); }
// ---- Elo ladder (1v1 and vs-AI) ----
export const K = 32;
export const expected = (a, b) => 1 / (1 + 10 ** ((b - a) / 400));
export function elo(a, b, scoreA) { const d = Math.round(K * (scoreA - expected(a, b))); return [a + d, b - d]; }
export const AI_RATING = { easy: 1000, normal: 1200, hard: 1450 };
// skill criterion: rating; ties -> more wins -> fewer minutes per win -> name (stable)
export const mpw = p => p.wins ? p.minutesWon / p.wins : Infinity;
export function rank(players) { return [...players].sort((a, b) => b.rating - a.rating || b.wins - a.wins || mpw(a) - mpw(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); }
export const PACK_POINTS_PER_WIN = 3, BONES_PER_WIN = 25;
export function recordMatch(s, { mode = 'ai', opp = 'normal', oppRating, win, minutes }) {
  const r = mode === 'ai' ? AI_RATING[opp] : oppRating; const [na] = elo(s.me.rating, r, win ? 1 : 0); const delta = na - s.me.rating; s.me.rating = na;
  if (win) { s.me.wins++; s.me.minutesWon += minutes; s.bones += BONES_PER_WIN; if (s.me.pack) s.packs[s.me.pack] = (s.packs[s.me.pack] || 0) + PACK_POINTS_PER_WIN; } else s.me.losses++;
  return delta;
}
// prize split by rank: 50/30/20 of the pool to the top three; remainder of integer division goes to #1. No randomness.
export const PRIZE_SPLIT = [5000, 3000, 2000];
export function payout(s, pool, players) {
  const amt = s.pools[pool], ranked = rank(players).filter(p => p.wins + p.losses > 0); if (!amt || !ranked.length) return null;
  const n = Math.min(3, ranked.length), w = PRIZE_SPLIT.slice(0, n), tot = w.reduce((a, b) => a + b, 0);
  const shares = w.map(x => Math.floor(amt * x / tot)); shares[0] += amt - shares.reduce((a, b) => a + b, 0);
  s.pools[pool] = 0; const rec = { pool, simulated: true, winners: ranked.slice(0, n).map((p, i) => ({ name: p.name, rating: p.rating, amountU: shares[i] })) };
  const me = rec.winners.find(x => x.name === s.me.name); if (me && s.wallet) s.kibbleU += me.amountU; s.payouts.unshift(rec); return rec;
}
// ---- Kibble Cup: free monthly holder tournament (stub). Entry requires any tier; no fee. ----
export function joinCup(s, month) { if (tier(s).id === 'none') return { ok: false, reason: 'Hold any $KIBBLE (Pup tier) to enter. Entry is free.' };
  if (s.cup.month !== month) s.cup = { month, entrants: [] }; if (!s.cup.entrants.includes(s.me.name)) s.cup.entrants.push(s.me.name); return { ok: true, fee: 0 }; }
// demo rivals for the ladder display (static, simulated)
export const RIVALS = [{ id: 'r1', name: 'KaiKage', pack: 'AKTA', rating: 1386, wins: 21, losses: 9, minutesWon: 441 }, { id: 'r2', name: 'ShibaSan', pack: 'SHIB', rating: 1302, wins: 14, losses: 10, minutesWon: 322 },
  { id: 'r3', name: 'HokkaidoHana', pack: 'HKDO', rating: 1302, wins: 14, losses: 6, minutesWon: 280 }, { id: 'r4', name: 'SpitzStorm', pack: 'AKTA', rating: 1188, wins: 8, losses: 9, minutesWon: 200 }];

// ---- real wallet (kibble-pay) ----
// applyWallet: connected wallet -> on-chain balance (base units = U, 6 decimals) and server inventory ({"inu-empires": {"<id>": n}}).
// Owned shop items come ONLY from the wallet's server inventory (never from local state) in real mode.
export function applyWallet(s, { address, units = 0, inventory = {} } = {}) {
  if (!address) { s.owned = []; disconnect(s); return tier(s); }
  s.wallet = { address, simulated: false }; s.kibbleU = Number(units) || 0;
  const inv = inventory['inu-empires'] || inventory || {};
  s.owned = Object.keys(inv).filter(k => inv[k] > 0).map(k => k.startsWith('inu-empires:') ? k.slice(12) : k).filter(id => COSMETICS[id]?.price);
  for (const k of Object.keys(s.equipped)) if (s.equipped[k] && !canUse(s, s.equipped[k])) s.equipped[k] = k === 'colour' ? 'colour_azure' : k === 'banner' ? 'banner_paw' : null;
  return tier(s);
}
export const catalogId = id => 'inu-empires:' + id;
