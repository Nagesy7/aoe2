// Kibble Kennel tab (inside the $KIBBLE panel, behind the existing Connect Wallet). HYBRID: shows the wallet's HOLD-STREAK tier from
// kibble-pay GET /api/kennel (progress bar, next step, what resets the streak), an equip/unequip menu saved in the cloud-saved kibble
// state (s.kennel), and an OPTIONAL "Lock $KIBBLE" form (Locked flair only) that builds a Streamflow token lock (sender = recipient =
// the player) which the player signs in their own Phantom wallet, after the exact-fee review card. The game never holds,
// receives or moves tokens: the lock is a transaction from the player to their own Streamflow escrow, and only the player can sign it.
// Cosmetics only. Nothing here changes stats, resources, matchmaking or rewards.
import * as N from './kennel.js';
const $ = id => document.getElementById(id);
const K = { data: null, loading: false, at: 0, lastForce: 0, form: { amount: '', days: 30 }, busy: false, review: null, note: '', forced: N.overrideTier(), forcedFlair: N.overrideFlair() };
let S = null, ctx = { wallet: () => null, balance: () => Infinity, onChange: () => {}, real: true };
export const kennelState = () => K;
function st() { S.kennel ||= { equipped: {}, everTier: null }; S.kennel.equipped ||= {}; return S.kennel; }
export const tierNow = () => K.data?.tier || null;
export const flairNow = () => !!K.data?.locked?.flair;
// what render.js draws for this player (ids + name), or null when nothing is equipped
export function myLoadout() { if (!S) return null; const ids = N.activeIds(st().equipped, tierNow(), flairNow()); if (!ids.length) return null;
  return { ids: new Set(ids), name: N.sanitizeName(S.me?.name) || 'You', tier: tierNow() }; }
export const loadoutWire = () => { const L = myLoadout(); return L ? { ids: [...L.ids], name: L.name } : null; }; // multiplayer: ids + name only
export const loadoutFromWire = w => { const ids = N.sanitizeIds(w?.ids); return ids.length ? { ids: new Set(ids), name: N.sanitizeName(w?.name) || 'Rival' } : null; };
function adopt(data) { K.data = data; K.at = Date.now(); const k = st(), t = data?.tier;
  if (t && N.rankOf(t) > N.rankOf(k.everTier)) { const fresh = N.defaultEquip(t); for (const [slot, id] of Object.entries(fresh)) if (!k.equipped[slot] || N.rankOf(N.COSMETICS[k.equipped[slot]]?.tier) < N.rankOf(t)) k.equipped[slot] = id; k.everTier = t; }
  if (data?.locked?.flair && !k.flairSeen) { k.equipped.badge = 'kn_badge_locked'; k.flairSeen = true; } // first time: wear the flair (can be unequipped)
  ctx.onChange(!K.forced); } // dev override never writes the save
export async function refreshKennel({ force = false } = {}) {
  if (K.forced) { adopt(N.fixture(K.forced, Date.now(), { flair: K.forcedFlair })); return K.data; }
  const w = ctx.wallet(); if (!w) { K.data = null; ctx.onChange(); return null; }
  if (force && Date.now() - K.lastForce < 15_000) force = false; if (force) K.lastForce = Date.now();
  K.loading = true; ctx.onChange(); const d = await N.fetchKennel(w, { refresh: force }); K.loading = false; adopt(d); return d; }
export function initKennel(state, opts) { S = state; ctx = { ...ctx, ...opts }; st();
  if (K.forced) adopt(N.fixture(K.forced, Date.now(), { flair: K.forcedFlair }));
  setInterval(() => { if (!document.hidden && ctx.wallet() && Date.now() - K.at > N.REFRESH_MS) refreshKennel().catch(() => {}); }, 30_000); }
const amt = n => `${N.fmtAmt(n)} $KIBBLE`;
const bar = (p, id) => `<div class="kn-bar"${id ? ` id="${id}"` : ''}><i style="width:${Math.round(Math.max(0, Math.min(1, p)) * 100)}%"></i></div>`;
function stepText(nx) { // next step line under the progress bar
  if (!nx) return 'Top tier reached: keep holding to keep it.';
  if (!nx.holding) return `Hold ${amt(nx.needAmount)} more to start the ${nx.name} streak (${amt(nx.amount)} for ${nx.days} days; reached ${N.fmtDate(nx.reachDateIfHeldFromNow)} if you hold it from today).`;
  return `${nx.daysHeld} / ${nx.days} days held · ${nx.needDays ? `${nx.name} on ${N.fmtDate(nx.reachDate)} if you keep holding` : `${nx.name} reached`}`;
}
export function kennelBody() {
  const w = ctx.wallet(), d = K.data, tier = tierNow(), flair = flairNow(), k = st();
  if (!w && !K.forced) return `<div class="kennel"><p><b>Kibble Kennel</b>: hold $KIBBLE in your wallet to earn cosmetic tiers. Free: no lock, no SOL.</p><p>${ctx.real ? '<button data-k="connect">Connect Wallet</button>' : '<button data-k="connect">Connect demo wallet</button>'} to open your Kennel.</p><p class="kh">${N.LAUNCH_NOTE}</p></div>`;
  const t = tier ? N.tierById(tier) : null, nx = d?.nextStep, reset = N.resetLine(d);
  const head = `<div class="kn-head"><div class="kn-tier kn-${tier || 'none'}" id="kn-tier">${t ? t.name : 'No tier yet'}${flair ? ' <span class="kn-flair" id="kn-flair" title="Locked flair">🔒 Locked</span>' : ''}</div>
    <div class="kn-facts"><span>Holding: <b id="kn-held">${amt(d?.held || 0)}</b></span>${flair ? `<span>Locked: <b>${amt(d.locked.amount)}</b> until <b>${N.fmtDate(d.locked.unlockDate)}</b></span>` : ''}
    <span>Next step: <b id="kn-next">${nx ? `${nx.name}: hold ${amt(nx.amount)} for ${nx.days} days` : 'none'}</b></span></div></div>
    <div class="kn-step">${bar(nx ? (nx.holding ? nx.progress : 0) : 1, 'kn-progress')}<small id="kn-step">${stepText(nx)}</small></div>
    ${reset ? `<p class="kwarn" id="kn-reset">${reset}</p>` : ''}
    <div class="kn-streaks">${(d?.streaks || []).map(s => `<div class="kn-st${s.earned ? ' on' : ''}" id="kn-st-${s.id}"><b>${s.name}</b><small>${amt(s.amount)} · ${s.days}d</small>${bar(s.progress)}<small>${s.earned ? 'earned' : s.holding ? `${s.daysHeld}/${s.days} days` : `${amt(s.needAmount)} short`}</small></div>`).join('')}</div>
    <p class="kh">Free: tiers come from holding, not locking. Hold at least a tier's amount in your wallet for its days; any dip below it restarts that streak. ${N.LAUNCH_NOTE}</p>
    ${K.forced ? `<p class="kh">Dev override ?kennel=${K.forced}${K.forcedFlair ? '&kflair=1' : ''}: nothing on-chain.</p>` : d?.stale || d?.source === 'holder-only' ? `<p class="kh">Chain data is offline right now (${d?.reason || d?.source || 'no data'}); showing what we last knew.</p>` : d?.history && !d.history.complete && d.history.reason ? `<p class="kh">Note: ${d.history.reason}.</p>` : ''}`;
  const items = N.SLOTS.map(slot => { const ids = N.IDS.filter(id => N.COSMETICS[id].slot === slot); return `<div class="kn-slot"><div class="kn-sname">${N.SLOT_NAMES[slot]}</div>${ids.map(id => {
    const c = N.COSMETICS[id], ss = N.itemState(id, { tier, everTier: k.everTier, equipped: k.equipped, flair }), tr = c.tier ? N.tierById(c.tier) : null, label = tr ? tr.name : 'Optional lock';
    const btn = ss === 'on' ? `<button data-kn-off="${slot}">Unequip</button>` : ss === 'available' ? `<button data-kn-eq="${id}">Equip</button>` : ss === 'relock' ? `<button disabled>Hold to get back</button>` : ss === 'flair' ? `<button disabled>Lock ${N.fmtAmt(N.FLAIR_MIN)}+</button>` : `<button disabled>${label}</button>`;
    return `<div class="kn-item ${ss}" data-id="${id}"><b>${c.name}</b><small>${label} · ${c.desc}</small>${btn}</div>`; }).join('')}</div>`; }).join('');
  const f = K.form, plan = f.amount ? N.lockPlan(f.amount, f.days, ctx.balance()) : null;
  const lock = `<div class="kn-lock"><b>Optional: Locked flair</b> <small>(Streamflow lock to your own wallet, signed in Phantom. Cosmetic only: no yield, no rewards, no draws. No tier needs a lock.)</small>
    <div class="kn-row"><input id="kn-amt" inputmode="numeric" placeholder="Amount of $KIBBLE" value="${f.amount}"> ${N.DURATIONS.map(dd => `<button class="kn-d${dd === f.days ? ' on' : ''}" data-kn-days="${dd}">${dd}d</button>`).join('')}</div>
    <div class="kn-plan">${N.planText(plan, N.fmtDate)}</div>
    <div class="kn-row"><button data-kn-lock="1" ${!plan?.ok || K.busy || K.forced || !ctx.real ? 'disabled' : ''}>${K.busy ? 'Waiting for Phantom…' : 'Lock $KIBBLE'}</button> <button data-kn-refresh="1" ${K.loading ? 'disabled' : ''}>${K.loading ? 'Checking…' : 'Refresh'}</button></div>
    <p class="kh">A lock costs about 0.168 SOL plus 0.5% of the amount in $KIBBLE, kept by Streamflow and the network (not refunded); the next step shows every fee, read live, before Phantom opens. Locked tokens still count toward your hold streak, but the 0.5% fee leaves your total, so lock with a margin above your tier's amount.</p><p class="kwarn" id="kn-warn">⚠ ${N.WARNING}</p><p class="kh" id="kn-note">${K.note}</p></div>`;
  return `<div class="kennel">${head}<div class="kn-grid">${items}</div>${K.review ? reviewCard(K.review) : lock}</div>`;
}
// returns true when the click was a Kennel control
export function kennelClick(b) {
  const k = st();
  if (b.dataset.knEq) { N.equip(k.equipped, b.dataset.knEq, tierNow(), flairNow()); ctx.onChange(true); return true; }
  if (b.dataset.knOff) { N.unequip(k.equipped, b.dataset.knOff); ctx.onChange(true); return true; }
  if (b.dataset.knDays) { K.form.amount = ($('kn-amt')?.value || '').replace(/[^0-9]/g, ''); K.form.days = +b.dataset.knDays; ctx.onChange(); return true; }
  if (b.dataset.knRefresh) { refreshKennel({ force: true }).catch(() => {}); return true; }
  if (b.dataset.knBack) { K.review = null; K.busy = false; K.note = ''; ctx.onChange(); return true; }
  if (b.dataset.knSign) { signReview().catch(e => { K.busy = false; K.note = 'Lock not sent: ' + (e?.message || e); ctx.onChange(); }); return true; }
  if (b.dataset.knLock) { K.form.amount = ($('kn-amt')?.value || '').replace(/[^0-9]/g, ''); lockNow().catch(e => { K.busy = false; K.note = 'Lock not sent: ' + (e?.message || e); ctx.onChange(); }); return true; }
  return false;
}
export function kennelInput(e) { if (e.target?.id === 'kn-ack' && K.review) { K.review.ack = !!e.target.checked; const sb = $('kn-sign'); if (sb) sb.disabled = !(K.review.ack && K.review.card.canSign && !K.busy); return; }
  if (e.target?.id !== 'kn-amt') return; K.form.amount = e.target.value.replace(/[^0-9]/g, ''); const p = $('kn-amt').closest('.kn-lock'), plan = K.form.amount ? N.lockPlan(K.form.amount, K.form.days, ctx.balance()) : null;
  const el = p?.querySelector('.kn-plan'); if (el) el.textContent = N.planText(plan, N.fmtDate);
  const lb = p?.querySelector('[data-kn-lock]'); if (lb) lb.disabled = !plan?.ok || K.busy; }
// Lock flow: kibble-pay POST /api/kennel-lock builds the Streamflow self-lock (sender = recipient = player, not cancelable, everything
// unlocks at the unlock date) with the Streamflow SDK server-side and returns the transaction; the player signs it in Phantom and
// Phantom sends it. Then we poll /api/kennel?refresh=1 until the tier shows it. (docs/KENNEL_API.md)
export async function requestLockTx(kp, plan) { return kp._req('/api/kennel-lock', { amount: plan.amount, days: plan.days }); }
export function checkLockTx(r, wallet, web3) { // never hand Phantom anything that is not this wallet's own self-lock
  if (!r?.ok || !r.tx) throw new Error(r?.reason || r?.error || 'no transaction');
  if (r.sender !== wallet || r.recipient !== wallet || r.feePayer !== wallet || r.mint !== N.MINT || r.program !== N.STREAMFLOW_PROGRAM || r.cancelable !== false) throw new Error('lock details do not match this wallet');
  const tx = web3.VersionedTransaction.deserialize(Uint8Array.from(atob(r.tx), c => c.charCodeAt(0))), keys = tx.message.staticAccountKeys.map(k => k.toBase58());
  const progs = new Set(tx.message.compiledInstructions.map(ix => keys[ix.programIdIndex]));
  if (keys[0] !== wallet || !progs.has(N.STREAMFLOW_PROGRAM) || [...progs].some(p => ![N.STREAMFLOW_PROGRAM, 'ComputeBudget111111111111111111111111111111', '11111111111111111111111111111111', N.TOKEN_2022, 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'].includes(p))) throw new Error('unexpected programs in the lock transaction');
  return tx; }
// Review card (like the Inu Verse Launch Hall cost card): itemised costs from the built transaction + kibble-pay's live read of
// Streamflow's fee oracle; an acknowledgement box; Phantom opens only from the "Sign in Phantom" button on this card.
function reviewCard(R) { const c = R.card, p = R.plan;
  if (!c.ok) return `<div class="kn-lock kn-review" id="kn-review"><b>Review your lock</b><p class="kwarn">${c.reason}</p><div class="kn-row"><button data-kn-back="1">Back</button></div></div>`;
  return `<div class="kn-lock kn-review" id="kn-review"><b>Review your lock</b> <small>(nothing is signed yet)</small>
    <div class="kn-facts"><span>Lock: <b>${c.locked} $KIBBLE</b></span><span>Unlock date: <b>${N.fmtDate(R.unlockDate)}</b></span><span>From and back to: <b>your wallet</b></span><span>Cancel early: <b>no</b></span></div>
    <table class="kn-fees"><tr><th>Cost</th><th>Amount</th><th>Back at unlock?</th></tr>${c.rows.map(r => `<tr data-fee="${r.k}"><td>${r.label}</td><td><b>${r.amount}</b></td><td>${r.back ? 'yes' : 'no'}${r.note ? ` <small>(${r.note})</small>` : ''}</td></tr>`).join('')}
    <tr class="kn-total"><td>Total SOL from your wallet</td><td><b id="kn-total-sol">${c.totalSol} SOL</b></td><td>no</td></tr>
    <tr class="kn-total"><td>$KIBBLE leaving your wallet now</td><td><b id="kn-total-kib">${c.tokenDebit} $KIBBLE</b></td><td>${c.back} at unlock</td></tr></table>
    ${c.warn.map(w => `<p class="kwarn">${w}</p>`).join('')}
    <p class="kh">Fees read live from Streamflow's on-chain fee settings (${c.source}) and checked against the transaction. Phantom also shows the transaction before you approve.</p>
    <p class="kwarn">⚠ ${N.WARNING}</p>
    <label class="kn-ack"><input type="checkbox" id="kn-ack" ${R.ack ? 'checked' : ''}> I understand the fees and that this lock can't be cancelled.</label>
    <div class="kn-row"><button data-kn-sign="1" id="kn-sign" ${R.ack && c.canSign && !K.busy ? '' : 'disabled'}>${K.busy ? 'Waiting for Phantom…' : 'Sign in Phantom'}</button> <button data-kn-back="1" ${K.busy ? 'disabled' : ''}>Back</button></div><p class="kh" id="kn-note">${K.note}</p></div>`; }
async function lockNow() {
  const w = ctx.wallet(), plan = N.lockPlan(K.form.amount, K.form.days, ctx.balance()); if (!w || !plan.ok) { K.note = plan.reason || 'Connect your wallet first.'; ctx.onChange(); return; }
  const kp = ctx.kp?.(); if (!kp?.session) { K.note = 'Sign in with your wallet first (Connect Wallet).'; ctx.onChange(); ctx.connect?.(); return; }
  K.busy = true; K.note = 'Preparing your Streamflow lock…'; ctx.onChange();
  const web3 = await import('@solana/web3.js');
  const r = await requestLockTx(kp, plan), tx = checkLockTx(r, w, web3);
  K.review = { tx, plan, unlockDate: r.unlockDate, card: N.feeCard(r.costs, N.txFacts(tx), plan), ack: false }; K.busy = false; K.note = ''; ctx.onChange();
}
async function signReview() {
  const R = K.review, kp = ctx.kp?.(); if (!R?.card?.ok || !R.card.canSign || !R.ack || !kp) return;
  K.busy = true; K.note = 'Approve the lock in Phantom…'; ctx.onChange();
  let signature; try { signature = await kp.wallet.signAndSend(R.tx); } catch (e) { K.busy = false; K.note = 'Lock not sent: ' + (e?.message || e); ctx.onChange(); return; }
  K.review = null;
  K.note = `Lock sent (${String(signature).slice(0, 10)}…). Checking your tier…`; ctx.onChange();
  const before = K.data?.lockedAmount || 0;
  for (let i = 0; i < 8; i++) { await new Promise(r => setTimeout(r, 16_000)); K.lastForce = 0; const d = await refreshKennel({ force: true }); if ((d?.lockedAmount || 0) > before) break; }
  K.busy = false; K.note = (K.data?.lockedAmount || 0) > before ? `Lock confirmed${K.data.locked?.flair ? ': Locked flair on' : ''}. Your hold streak keeps counting.` : 'The lock was sent; it shows once the network confirms it (press Refresh).'; ctx.onChange();
}
