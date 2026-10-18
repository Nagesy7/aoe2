// Kibble Kennel (cosmetics only), HYBRID: tiers come from $KIBBLE HOLD STREAKS (hold at least a tier's amount for its days; free,
// no lock, no SOL), read by kibble-pay /api/kennel (docs/KENNEL_API.md). An optional Streamflow self-lock only adds the Locked flair. The game never holds or moves tokens. Nothing here touches the simulation: cosmetics are render-only
// (src/kennel-draw.js) and sync to the opponent as a list of cosmetic ids. Pure module: no DOM at import time.
export const API = 'https://kibble-pay.vercel.app';
export const MINT = '4VE9sy4fEMJdZ6i7MkYPbnqDJd2oqzJQmg44WJ3opump', DECIMALS = 6, TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const STREAMFLOW_PROGRAM = 'strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m';
export const REFRESH_MS = 10 * 60_000;
export const TIERS = [ // same table as kibble-pay api/_lib/kennel-streak.js (hold streaks: amount held continuously for `days`)
  { id: 'pup', name: 'Pup', amount: 100_000, days: 7, minDays: 7 },
  { id: 'guard', name: 'Guard Dog', amount: 1_000_000, days: 30, minDays: 30 },
  { id: 'alpha', name: 'Alpha', amount: 10_000_000, days: 90, minDays: 90 },
  { id: 'top', name: 'Top Dog', amount: 50_000_000, days: 90, minDays: 90 },
];
export const LAUNCH = Date.parse('2026-10-15T00:00:00+11:00'), DAY_MS = 864e5, FLAIR_MIN = 100_000;
export const LAUNCH_NOTE = "$KIBBLE launched on 15 Oct 2026, so long streaks can't exist yet: Pup is possible from 22 Oct, Guard Dog from 14 Nov, Alpha and Top Dog from 13 Jan 2027.";
export const TIER_IDS = TIERS.map(t => t.id);
export const rankOf = id => TIER_IDS.indexOf(id); // -1 = no tier
export const tierById = id => TIERS.find(t => t.id === id) || null;
// slot -> one equipped id (or null). Every item belongs to one tier and one slot.
export const SLOTS = ['tag', 'banner', 'collar', 'flag', 'aura', 'title', 'bskin', 'name', 'badge'];
export const SLOT_NAMES = { tag: 'Name tag', banner: 'Den Hall banner', collar: 'Collars', flag: 'Building flags', aura: 'Aura', title: 'Title', bskin: 'Building skins', name: 'Name colour', badge: 'Flair' };
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
  // optional extra, not a tier: shown while the wallet has a live Streamflow self-lock of FLAIR_MIN+ $KIBBLE
  kn_badge_locked: { slot: 'badge', tier: null, flair: 'locked', name: 'Locked flair', desc: 'A padlock badge on your name tag' },
};
export const isFlair = id => !!COSMETICS[id]?.flair;
export const IDS = Object.keys(COSMETICS);
export const unlockedBy = tier => IDS.filter(id => !isFlair(id) && rankOf(tier) >= rankOf(COSMETICS[id].tier));
const allowed = (id, tier, flair) => isFlair(id) ? !!flair : rankOf(tier) >= rankOf(COSMETICS[id].tier);
// default loadout when a tier is first reached: best item of each unlocked slot
export function defaultEquip(tier) { const eq = {}; for (const id of unlockedBy(tier)) eq[COSMETICS[id].slot] = id; return eq; }
// What is actually shown: equipped items the current tier allows. Items above the tier are kept in the save but greyed ("Hold to get back"); the Locked flair needs a live optional lock.
export function activeIds(equipped = {}, tier, flair = false) { return SLOTS.map(s => equipped[s]).filter(id => id && COSMETICS[id] && allowed(id, tier, flair)); }
// item state for the menu: on | available | relock (was reachable before, streak broke) | locked | flair (needs the optional lock)
export function itemState(id, { tier, everTier, equipped = {}, flair = false }) {
  const c = COSMETICS[id]; if (!c) return 'locked'; const ok = allowed(id, tier, flair);
  if (ok) return equipped[c.slot] === id ? 'on' : 'available';
  if (c.flair) return 'flair';
  return rankOf(everTier) >= rankOf(c.tier) ? 'relock' : 'locked';
}
export function equip(equipped, id, tier, flair = false) { const c = COSMETICS[id]; if (!c || !allowed(id, tier, flair)) return false; equipped[c.slot] = id; return true; }
export function unequip(equipped, slot) { if (!SLOTS.includes(slot)) return false; equipped[slot] = null; return true; }
// Opponent sync: only cosmetic ids cross the wire. Anything unknown is dropped; at most one per slot; never more than SLOTS.length.
export function sanitizeIds(ids) { if (!Array.isArray(ids)) return []; const seen = new Set(), out = [];
  for (const id of ids.slice(0, 32)) { const c = typeof id === 'string' && COSMETICS[id]; if (!c || seen.has(c.slot)) continue; seen.add(c.slot); out.push(id); } return out; }
export const sanitizeName = n => String(n || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 14);
// ---- dev override: ?kennel=none|progress|pup|guard|alpha|top [&kflair=1] (screenshots; no network, no wallet) ----
export const OVERRIDES = ['none', 'progress', ...TIER_IDS];
export function overrideTier(search = (typeof location !== 'undefined' ? location.search : '')) {
  try { const v = new URLSearchParams(search).get('kennel'); return OVERRIDES.includes(v) ? v : null; } catch { return null; } }
export function overrideFlair(search = (typeof location !== 'undefined' ? location.search : '')) { try { return new URLSearchParams(search).get('kflair') === '1'; } catch { return false; } }
// what /api/kennel (v2) would return (dev override only). progress = 1.2M held for 3 days, i.e. since launch week (Pup 3/7, Guard Dog 3/30, no tier yet)
export function fixture(kind, now = Date.now(), { flair = false } = {}) {
  const iso = ms => new Date(ms).toISOString(), plan = { none: [0, 0], progress: [1_200_000, 3], pup: [400_000, 12], guard: [2_500_000, 41], alpha: [18_000_000, 95], top: [64_000_000, 120] }[kind] || [0, 0];
  const [held, days] = plan, start = now - days * DAY_MS;
  const streaks = TIERS.map(t => { const holding = held >= t.amount, el = holding ? days : 0, earned = holding && el >= t.days;
    return { id: t.id, name: t.name, amount: t.amount, days: t.days, holding, start: holding ? iso(start) : null, daysHeld: el, earned, earnedAt: earned ? iso(start + t.days * DAY_MS) : null,
      reachDate: holding ? iso(start + t.days * DAY_MS) : null, needAmount: Math.max(0, t.amount - held), needDays: holding ? Math.max(0, t.days - el) : t.days, progress: holding ? Math.min(1, el / t.days) : 0 }; });
  let tier = null; for (const s of streaks) if (s.earned) tier = s;
  const nx = streaks[tier ? streaks.indexOf(tier) + 1 : 0] || null, lockAmt = flair ? Math.max(FLAIR_MIN, Math.round(held / 4)) : 0;
  return normalize({ tier: tier?.id || null, held, streaks, nextStep: nx && { ...nx, reachDateIfHeldFromNow: iso(now + nx.days * DAY_MS) },
    nextTier: nx && { id: nx.id, need: nx.needAmount }, lockedAmount: lockAmt, unlockDate: flair ? iso(now + 60 * DAY_MS) : null,
    locked: { flair, amount: lockAmt, minAmount: FLAIR_MIN, unlockDate: flair ? iso(now + 60 * DAY_MS) : null },
    locks: flair ? [{ id: 'override', amount: lockAmt, unlockDate: iso(now + 60 * DAY_MS), daysLeft: 60 }] : [],
    history: { complete: true, from: iso(LAUNCH), reason: null }, launchDate: iso(LAUNCH), source: 'override' });
}
// ---- server response ----
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };
export function normalize(j) {
  if (!j || typeof j !== 'object') j = { source: 'holder-only', stale: true };
  const tier = TIER_IDS.includes(j.tier) ? j.tier : null, held = num(j.held);
  const byId = Object.fromEntries((Array.isArray(j.streaks) ? j.streaks : []).filter(s => s && TIER_IDS.includes(s.id)).map(s => [s.id, s]));
  const streaks = TIERS.map(t => { const s = byId[t.id] || {}, holding = !!s.holding && !!s.start;
    return { id: t.id, name: t.name, amount: t.amount, days: t.days, holding, start: holding ? s.start : null, daysHeld: holding ? Math.floor(num(s.daysHeld)) : 0, earned: !!s.earned && holding,
      reachDate: holding ? s.reachDate || null : null, needAmount: num(s.needAmount, Math.max(0, t.amount - held)), needDays: holding ? Math.ceil(num(s.needDays)) : t.days, progress: holding ? Math.min(1, num(s.progress)) : 0 }; });
  const nxId = j.nextStep && TIER_IDS.includes(j.nextStep.id) ? j.nextStep.id : j.nextTier && TIER_IDS.includes(j.nextTier.id) ? j.nextTier.id : null;
  const nx = nxId ? streaks.find(s => s.id === nxId) : null, L = j.locked && typeof j.locked === 'object' ? j.locked : {};
  return { tier, tierName: tier ? tierById(tier).name : null, held, streaks,
    nextStep: nx ? { ...nx, reachDateIfHeldFromNow: j.nextStep?.reachDateIfHeldFromNow || null } : null,
    nextTier: nx ? { ...tierById(nx.id), need: nx.needAmount } : null,
    lockedAmount: num(j.lockedAmount), unlockDate: j.unlockDate || null, tierUntil: null,
    locked: { flair: !!L.flair, amount: num(L.amount), unlockDate: L.unlockDate || null, minAmount: num(L.minAmount, FLAIR_MIN) },
    locks: Array.isArray(j.locks) ? j.locks.slice(0, 20) : [], history: j.history && typeof j.history === 'object' ? { complete: !!j.history.complete, reason: j.history.reason || null, from: j.history.from || null } : null,
    launchDate: j.launchDate || new Date(LAUNCH).toISOString(), source: j.source || 'chain', stale: !!j.stale, reason: j.reason || null, fetchedAt: j.fetchedAt || null };
}
// the streak the player should watch: the highest tier they are currently holding enough for (null = holding none)
export function guardedStreak(d) { const h = (d?.streaks || []).filter(s => s.holding); return h.length ? h[h.length - 1] : null; }
export function resetLine(d) { const g = guardedStreak(d); return g ? `Selling below ${fmtAmt(g.amount)} $KIBBLE resets your ${g.name} streak${g.earned ? ' (and the tier)' : ''}.` : ''; }
export async function fetchKennel(wallet, { refresh = false, f = globalThis.fetch, api = API } = {}) {
  try { const r = await f(`${api}/api/kennel?wallet=${encodeURIComponent(wallet)}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' });
    if (!r.ok) return { ...normalize(null), reason: 'http ' + r.status }; return normalize(await r.json()); } catch { return { ...normalize(null), reason: 'offline' }; } }
// ---- optional lock form (the Locked flair) ----
// No tier needs a lock. A live self-lock of FLAIR_MIN+ $KIBBLE adds the Locked flair; the locked tokens still count toward hold streaks
// (only the 0.5% Streamflow fee leaves the total, so lock with a margin above your tier's amount).
export const DURATIONS = [14, 30, 60, 120, 210, 365];
export function lockPlan(amount, days, balance = Infinity) { // validate the player's choice; returns { ok, reason, raw, unlockAt, flair }
  const a = Math.floor(Number(amount)), d = Math.floor(Number(days));
  if (!Number.isFinite(a) || a < 1) return { ok: false, reason: 'Enter an amount of $KIBBLE' };
  if (!DURATIONS.includes(d)) return { ok: false, reason: 'Pick a lock length' };
  if (a > balance) return { ok: false, reason: 'That is more $KIBBLE than this wallet holds' };
  return { ok: true, amount: a, days: d, raw: BigInt(a) * 10n ** BigInt(DECIMALS), unlockAt: Math.floor(Date.now() / 1000) + d * 86400 + 600, flair: a >= FLAIR_MIN };
}
export const planText = (p, fmtD) => !p ? `Optional: a lock of ${fmtAmt(FLAIR_MIN)}+ $KIBBLE adds the Locked flair. No tier needs a lock.` : !p.ok ? p.reason
  : `Unlocks ${fmtD(p.unlockAt * 1000)}. ${p.flair ? 'Adds the Locked flair until then.' : `Below ${fmtAmt(FLAIR_MIN)}: no flair on its own (your other locks add up).`} Locked tokens still count toward your hold streak.`;
export const WARNING = "Locked tokens can't be sold until the unlock date.";
export const fmtAmt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const fmtDate = s => { if (!s) return '-'; const d = new Date(s); return isNaN(d) ? '-' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); };
// ---- lock review card: what the lock costs, shown BEFORE Phantom opens (kibble-pay docs/KENNEL_API.md "What a lock costs") ----
// The server reads Streamflow's on-chain fee oracle + live rent; the client re-derives what it can from the built transaction itself
// (signatures, priority fee) and from the plan (token fee = Streamflow's deposit formula), and refuses to open Phantom if the server's
// numbers and the transaction disagree or the costs could not be read. Nothing is hardcoded here: no costs -> no card -> no signing.
export const LAMPORTS = 1_000_000_000, LAMPORTS_PER_SIGNATURE = 5000;
export const fmtSol = l => { const s = (Number(l) / LAMPORTS).toFixed(9).replace(/0+$/, '').replace(/\.$/, ''); return s === '0' ? '0' : s; };
export const fmtRaw = raw => { const r = BigInt(raw), U = 10n ** BigInt(DECIMALS), w = r / U, f = (r % U).toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  return Number(w).toLocaleString('en-US') + (f ? '.' + f : ''); };
export const tokenFeeRaw = (raw, pct) => (BigInt(raw) * BigInt(Math.round(Number(pct) * 1e4))) / 1_000_000n;
export function txFacts(tx) { // from a web3.js VersionedTransaction
  const m = tx.message, keys = m.staticAccountKeys.map(k => k.toBase58()); let price = 0, limit = 200_000;
  for (const ix of m.compiledInstructions) { if (keys[ix.programIdIndex] !== 'ComputeBudget111111111111111111111111111111') continue; const d = ix.data, dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    if (d[0] === 3) price = Number(dv.getBigUint64(1, true)); if (d[0] === 2) limit = dv.getUint32(1, true); }
  const signatures = m.header.numRequiredSignatures; return { signatures, priorityMicroLamports: price, networkLamports: signatures * LAMPORTS_PER_SIGNATURE + Math.ceil(price * limit / 1e6) };
}
export function feeCard(costs, facts, plan) {
  if (!costs || costs.error || !costs.sol || !costs.token) return { ok: false, reason: `Couldn't read Streamflow's fees right now${costs?.error ? ` (${String(costs.error).slice(0, 60)})` : ''}, so Phantom stays closed. Try again in a moment.` };
  const s = costs.sol, r = s.rent || {}, nums = [s.protocolFee, r.metadata, r.escrow, r.treasuryAta || 0, r.playerAta || 0, s.network, s.total];
  if (nums.some(n => !Number.isInteger(n) || n < 0)) return { ok: false, reason: 'The fee numbers look wrong, so Phantom stays closed.' };
  const raw = BigInt(plan.raw), fee = tokenFeeRaw(raw, costs.token.feePercent);
  if (String(raw) !== String(costs.token.lockedRaw) || String(fee) !== String(costs.token.feeRaw) || String(raw + fee) !== String(costs.token.totalDebitRaw)) return { ok: false, reason: 'The token fee does not add up, so Phantom stays closed.' };
  if (facts && facts.networkLamports !== s.network) return { ok: false, reason: 'The network fee in the transaction does not match, so Phantom stays closed.' };
  const sum = s.protocolFee + r.metadata + r.escrow + (r.treasuryAta || 0) + (r.playerAta || 0) + s.network;
  if (sum !== s.total) return { ok: false, reason: 'The SOL total does not add up, so Phantom stays closed.' };
  const rows = [
    { k: 'protocol', label: 'Streamflow creation fee', amount: `${fmtSol(s.protocolFee)} SOL`, back: false, note: 'kept by Streamflow' },
    { k: 'token', label: `Streamflow lock fee (${costs.token.feePercent}% on top)`, amount: `${fmtRaw(fee)} $KIBBLE`, back: false, note: 'kept by Streamflow' },
    { k: 'rent-meta', label: 'Rent: lock record account', amount: `${fmtSol(r.metadata)} SOL`, back: false, note: 'stays with the lock' },
    { k: 'rent-escrow', label: 'Rent: lock token account', amount: `${fmtSol(r.escrow)} SOL`, back: false, note: 'stays with the lock' },
    ...(r.treasuryAta ? [{ k: 'rent-treasury', label: "Rent: Streamflow's $KIBBLE account (first lock ever only)", amount: `${fmtSol(r.treasuryAta)} SOL`, back: false, note: 'one time' }] : []),
    ...(r.playerAta ? [{ k: 'rent-ata', label: 'Rent: your $KIBBLE account', amount: `${fmtSol(r.playerAta)} SOL`, back: false, note: '' }] : []),
    { k: 'network', label: `Network fee (${facts?.signatures ?? costs.tx?.signatures ?? 2} signatures${facts?.priorityMicroLamports ? ' + priority' : ''})`, amount: `${fmtSol(s.network)} SOL`, back: false, note: 'Solana' },
  ];
  const b = costs.balances || {}, warn = [];
  if (b.enoughSol === false) warn.push(`This wallet has ${fmtSol(b.lamports)} SOL; the lock needs ${fmtSol(s.total)} SOL.`);
  if (b.enoughToken === false) warn.push(`This wallet has ${fmtRaw(b.tokenRaw)} $KIBBLE; the lock needs ${fmtRaw(raw + fee)} $KIBBLE (amount + fee).`);
  return { ok: true, rows, totalSol: fmtSol(s.total), totalSolLamports: s.total, locked: fmtRaw(raw), tokenFee: fmtRaw(fee), tokenDebit: fmtRaw(raw + fee), back: fmtRaw(raw),
    canSign: !warn.length, warn, source: costs.source?.fees || 'unknown' };
}
