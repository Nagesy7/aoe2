// Kibble Kennel (cosmetics only): tier from the player's OWN Streamflow $KIBBLE locks, read by kibble-pay /api/kennel
// (docs/KENNEL_API.md). The game never holds or moves tokens. Nothing here touches the simulation: cosmetics are render-only
// (src/kennel-draw.js) and sync to the opponent as a list of cosmetic ids. Pure module: no DOM at import time.
export const API = 'https://kibble-pay.vercel.app';
export const MINT = '4VE9sy4fEMJdZ6i7MkYPbnqDJd2oqzJQmg44WJ3opump', DECIMALS = 6, TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const STREAMFLOW_PROGRAM = 'strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m';
export const REFRESH_MS = 10 * 60_000;
export const TIERS = [ // same table as kibble-pay api/_lib/kennel.js
  { id: 'pup', name: 'Pup', amount: 100_000, minDays: 7 },
  { id: 'guard', name: 'Guard Dog', amount: 1_000_000, minDays: 30 },
  { id: 'alpha', name: 'Alpha', amount: 10_000_000, minDays: 90 },
  { id: 'top', name: 'Top Dog', amount: 50_000_000, minDays: 180 },
];
export const TIER_IDS = TIERS.map(t => t.id);
export const rankOf = id => TIER_IDS.indexOf(id); // -1 = no tier
export const tierById = id => TIERS.find(t => t.id === id) || null;
// slot -> one equipped id (or null). Every item belongs to one tier and one slot.
export const SLOTS = ['tag', 'banner', 'collar', 'flag', 'aura', 'title', 'bskin', 'name'];
export const SLOT_NAMES = { tag: 'Name tag', banner: 'Den Hall banner', collar: 'Collars', flag: 'Building flags', aura: 'Aura', title: 'Title', bskin: 'Building skins', name: 'Name colour' };
export const COSMETICS = {
  kn_tag: { slot: 'tag', tier: 'pup', name: 'Kennel name tag', desc: 'Your kennel tag above your units' },
  kn_banner_bronze: { slot: 'banner', tier: 'pup', name: 'Bronze banner', desc: 'Bronze banner on your Den Hall' },
  kn_collar: { slot: 'collar', tier: 'guard', name: 'Guard collars', desc: 'Collar colours on every unit' },
  kn_flag: { slot: 'flag', tier: 'guard', name: 'Guard flag colours', desc: 'Building flags recoloured' },
  kn_banner_silver: { slot: 'banner', tier: 'guard', name: 'Silver banner', desc: 'Silver banner on your Den Hall' },
  kn_aura_paw: { slot: 'aura', tier: 'alpha', name: 'Paw-print aura', desc: 'Glowing paw prints under your units' },
  kn_banner_anim: { slot: 'banner', tier: 'alpha', name: 'Animated Den Hall banner', desc: 'A waving banner on your Den Hall' },
  kn_title_alpha: { slot: 'title', tier: 'alpha', name: 'Title: Alpha', desc: '"Alpha" next to your name' },
  kn_aura_gold: { slot: 'aura', tier: 'top', name: 'Gold aura', desc: 'A gold glow under your units' },
  kn_bskin_gold: { slot: 'bskin', tier: 'top', name: 'Top Dog building skins', desc: 'Gold-trimmed building set' },
  kn_name_gold: { slot: 'name', tier: 'top', name: 'Golden name', desc: 'Your name in gold' },
};
export const IDS = Object.keys(COSMETICS);
export const unlockedBy = tier => IDS.filter(id => rankOf(tier) >= rankOf(COSMETICS[id].tier));
// default loadout when a tier is first reached: best item of each unlocked slot
export function defaultEquip(tier) { const eq = {}; for (const id of unlockedBy(tier)) eq[COSMETICS[id].slot] = id; return eq; }
// What is actually shown: equipped items the current tier allows. Items above the tier are kept in the save but greyed ("Relock to keep").
export function activeIds(equipped = {}, tier) { return SLOTS.map(s => equipped[s]).filter(id => id && COSMETICS[id] && rankOf(tier) >= rankOf(COSMETICS[id].tier)); }
// item state for the menu: on | available | relock (was reachable before, tier dropped) | locked
export function itemState(id, { tier, everTier, equipped = {} }) {
  const c = COSMETICS[id]; if (!c) return 'locked'; const ok = rankOf(tier) >= rankOf(c.tier);
  if (ok) return equipped[c.slot] === id ? 'on' : 'available';
  return rankOf(everTier) >= rankOf(c.tier) ? 'relock' : 'locked';
}
export function equip(equipped, id, tier) { const c = COSMETICS[id]; if (!c || rankOf(tier) < rankOf(c.tier)) return false; equipped[c.slot] = id; return true; }
export function unequip(equipped, slot) { if (!SLOTS.includes(slot)) return false; equipped[slot] = null; return true; }
// Opponent sync: only cosmetic ids cross the wire. Anything unknown is dropped; at most one per slot; never more than SLOTS.length.
export function sanitizeIds(ids) { if (!Array.isArray(ids)) return []; const seen = new Set(), out = [];
  for (const id of ids.slice(0, 32)) { const c = typeof id === 'string' && COSMETICS[id]; if (!c || seen.has(c.slot)) continue; seen.add(c.slot); out.push(id); } return out; }
export const sanitizeName = n => String(n || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 14);
// ---- dev override: ?kennel=pup|guard|alpha|top (screenshots; no network, no wallet) ----
export function overrideTier(search = (typeof location !== 'undefined' ? location.search : '')) {
  try { const v = new URLSearchParams(search).get('kennel'); return v === 'none' ? 'none' : TIER_IDS.includes(v) ? v : null; } catch { return null; } }
export function fixture(tier, now = Date.now()) { // what /api/kennel would return for a wallet at that tier (dev override only)
  if (tier === 'none' || !tier) return normalize({ tier: null, lockedAmount: 0, unlockDate: null, nextTier: { ...TIERS[0], need: TIERS[0].amount }, source: 'override' });
  const t = tierById(tier), i = rankOf(tier), nt = TIERS[i + 1] || null, days = t.minDays + 14;
  return normalize({ tier, tierName: t.name, lockedAmount: t.amount, unlockDate: new Date(now + days * 864e5).toISOString(), tierUntil: new Date(now + 14 * 864e5).toISOString(),
    nextTier: nt ? { ...nt, need: nt.amount - t.amount } : null, locks: [{ id: 'override', amount: t.amount, unlockDate: new Date(now + days * 864e5).toISOString(), daysLeft: days }], source: 'override' });
}
// ---- server response ----
export function normalize(j) {
  if (!j || typeof j !== 'object') return { tier: null, lockedAmount: 0, unlockDate: null, nextTier: null, locks: [], source: 'holder-only', stale: true };
  const tier = TIER_IDS.includes(j.tier) ? j.tier : null, n = Number(j.lockedAmount);
  return { tier, tierName: tier ? tierById(tier).name : null, lockedAmount: Number.isFinite(n) && n > 0 ? n : 0, unlockDate: j.unlockDate || null, tierUntil: j.tierUntil || null,
    nextTier: j.nextTier && TIER_IDS.includes(j.nextTier.id) ? { ...tierById(j.nextTier.id), need: Math.max(0, Number(j.nextTier.need) || 0) } : null,
    locks: Array.isArray(j.locks) ? j.locks.slice(0, 20) : [], source: j.source || 'chain', stale: !!j.stale, fetchedAt: j.fetchedAt || null };
}
export async function fetchKennel(wallet, { refresh = false, f = globalThis.fetch, api = API } = {}) {
  try { const r = await f(`${api}/api/kennel?wallet=${encodeURIComponent(wallet)}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' });
    if (!r.ok) return { ...normalize(null), reason: 'http ' + r.status }; return normalize(await r.json()); } catch { return { ...normalize(null), reason: 'offline' }; } }
// ---- lock form ----
// Only locks with >= the tier's minimum days LEFT count, so a lock keeps a tier for (length - minimum) days: 60 days at 1M = Guard Dog for the first 30 days, Pup until 7 days are left (53 days in all).
export const DURATIONS = [14, 30, 60, 120, 210, 365];
export function lockPlan(amount, days, balance = Infinity) { // validate the player's choice; returns { ok, reason, raw, unlockAt, tier }
  const a = Math.floor(Number(amount)), d = Math.floor(Number(days));
  if (!Number.isFinite(a) || a < 1) return { ok: false, reason: 'Enter an amount of $KIBBLE' };
  if (!DURATIONS.includes(d)) return { ok: false, reason: 'Pick a lock length' };
  if (a > balance) return { ok: false, reason: 'That is more $KIBBLE than this wallet holds' };
  // this lock alone (other locks add on the server): which tiers it reaches and for how many days each
  const timeline = TIERS.filter(t => a >= t.amount && d >= t.minDays).map(t => ({ id: t.id, name: t.name, days: d - t.minDays })).reverse();
  return { ok: true, amount: a, days: d, raw: BigInt(a) * 10n ** BigInt(DECIMALS), unlockAt: Math.floor(Date.now() / 1000) + d * 86400 + 600, tier: timeline[0]?.id || null, timeline };
}
export const WARNING = "Locked tokens can't be sold until the unlock date.";
export const fmtAmt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const fmtDate = s => { if (!s) return '-'; const d = new Date(s); return isNaN(d) ? '-' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); };
