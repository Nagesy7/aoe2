// $KIBBLE network panel. Real mode (default): Phantom sign-in, on-chain balance -> tier, purchases + inventory via kibble-pay,
// cloud save to the wallet. Demo (?demo=1): the original simulated wallet. Cosmetics only.
import * as K from './kibble.js';
import { TEAM } from './inu.js';
import { initKennel, kennelBody, kennelClick, kennelInput, refreshKennel, myLoadout, tierNow } from './kennel-ui.js';
export { tierNow } from './kennel-ui.js';
export { myLoadout, loadoutWire, loadoutFromWire } from './kennel-ui.js';
const REAL = !K.SIMULATED, API = 'https://kibble-pay.vercel.app', GAME = 'inu-empires';
const KEY = REAL ? 'inu-empires-kibble' : 'inu-empires-kibble-sim';
let KP = null, glue = null, walletUi = null, serverPools = null;
let s; try { s = JSON.parse(localStorage.getItem(KEY)) || K.newState(); } catch { s = K.newState(); }
const save = () => localStorage.setItem(KEY, JSON.stringify(REAL ? { ...s, wallet: null, kibbleU: 0, owned: [] } : s)); // real wallet data is never stored locally
if (REAL) { s.wallet = null; s.kibbleU = 0; s.owned = []; }
const $ = id => document.getElementById(id);
export const kibbleState = () => s;
export const kibblePay = () => KP; // kibble-pay client (session + Phantom adapter) for the raid / score calls
function apply() { const c = K.COSMETICS[s.equipped.colour]; if (c && c.value) TEAM.player = c.value; // visual team colour only
  const t = s.equipped.title ? K.COSMETICS[s.equipped.title].name : null; const el = $('kid');
  el.innerHTML = `<b>[${s.me.pack}]</b> ${s.me.name}${t ? ` <i>· ${t}</i>` : ''} · ${s.me.rating} Elo · 🦴 ${s.bones}`; }
const period = () => { const d = new Date(); return { day: d.toISOString().slice(0, 10), month: d.toISOString().slice(0, 7) }; };
function render() {
  const tr = K.tier(s), tab = $('kb').dataset.tab || 'wallet', B = (a, l, dis = false) => `<button data-k="${a}" ${dis ? 'disabled' : ''}>${l}</button>`;
  const tabs = ['wallet', 'kennel', 'shop', 'ladder', 'pools', 'packs', 'cup'].map(t => `<button class="kt${t === tab ? ' on' : ''}" data-tab="${t}">${{ wallet: 'Wallet & tiers', kennel: 'Kibble Kennel', shop: 'Kibble shop', ladder: 'Ranked ladder', pools: "Pools & treasury", packs: 'Packs', cup: 'Kibble Cup' }[t]}</button>`).join('');
  let body = '';
  if (tab === 'wallet') body = `<p>${s.wallet ? `Connected <code>${s.wallet.address}</code> ${REAL ? '(Phantom, signed in)' : '(demo wallet, nothing on-chain)'}` : REAL ? 'Not connected. Connect Phantom to save your progress to your wallet, use your $KIBBLE cosmetics and get your holder tier.' : 'Not connected.'}</p>
    <p>Balance: <b>${K.fmtK(s.kibbleU)} $KIBBLE</b> ${REAL ? '(on-chain)' : '(demo)'} · Tier: <b id="kb-tier">${tr.name}</b> · Bones (free, never cashed out): ${s.bones}</p>
    ${s.wallet ? B('disconnect', 'Disconnect') : B('connect', REAL ? '🔗 Connect Wallet (Phantom)' : 'Connect wallet (simulated)')}
    <p class="kh">Tiers: ${K.TIERS.slice(1).map(t => `${t.name} ≥ ${t.min.toLocaleString()}`).join(' · ')}. Tiers unlock cosmetics only: skins, banners, team colours, titles. Never stats, resources or build speed.</p>
    <div class="kgrid">${Object.entries(K.COSMETICS).filter(([, c]) => !c.price).map(([id, c]) => `<button data-eq="${id}" ${K.canUse(s, id) ? '' : 'disabled'} class="${s.equipped[c.kind] === id ? 'on' : ''}">${c.name}<small>${c.kind} · ${c.tier === 'none' ? 'free' : c.tier}</small></button>`).join('')}</div>`;
  if (tab === 'shop') body = `<p class="kh">2% fee on every purchase: 1% to the President's treasury, 0.25% daily, 0.5% weekly, 0.25% monthly prize pools.</p><div class="kgrid">${K.SHOP.map(id => { const c = K.COSMETICS[id], q = K.feeSplit(K.toU(c.price)), own = s.owned.includes(id);
    return `<div class="kitem"><b>${c.name}</b><small>${c.price} + ${K.fmtK(q.fee)} fee = ${K.fmtK(q.total)} $KIBBLE${c.tier !== 'none' ? ` · ${c.tier}+` : ''}</small>${own ? `<button data-eq="${id}" class="${s.equipped.skin === id ? 'on' : ''}">${s.equipped.skin === id ? 'Equipped' : 'Equip'}</button>` : `<button data-buy="${id}">${REAL ? 'Buy' : 'Buy (simulated)'}</button>`}</div>`; }).join('')}</div><div id="kb-msg"></div>`;
  if (tab === 'shop' && REAL) body = `<p class="kh">Real $KIBBLE via Phantom. Prices include the 2% split (1% President's treasury, 1% prize pools). Cosmetic only: no stats, resources or build speed.</p><div class="kgrid">${K.SHOP.map(id => { const c = K.COSMETICS[id], own = s.owned.includes(id);
    return `<div class="kitem"><b>${c.name}</b><small>${Number(c.price).toLocaleString()} $KIBBLE${c.tier !== 'none' ? ` · ${c.tier}+` : ''}</small>${own ? `<button data-eq="${id}" class="${s.equipped[c.kind] === id ? 'on' : ''}">${s.equipped[c.kind] === id ? 'Equipped' : 'Equip'}</button>` : `<button data-buy="${id}">Buy</button>`}</div>`; }).join('')}</div><div id="kb-msg"></div>`;
  if (tab === 'ladder') { const rows = K.rank([s.me, ...K.RIVALS]);
    body = `<p class="kh">Elo (K=${K.K}). Ranked by rating; ties go to more wins, then fewer minutes per win. Free to play; no wallet needed for ranked.</p>
    <table><tr><th>#</th><th>Player</th><th>Elo</th><th>W-L</th><th>min/win</th></tr>${rows.map((p, i) => `<tr class="${p === s.me ? 'me' : ''}"><td>${i + 1}</td><td>[${p.pack}] ${p.name}</td><td>${p.rating}</td><td>${p.wins}-${p.losses}</td><td>${p.wins ? (p.minutesWon / p.wins).toFixed(1) : '-'}</td></tr>`).join('')}</table>
    <p class="kh">Record a result (demo: there is no in-game victory condition yet, so results are entered here):</p>${B('win-ai', 'Won vs Hard AI (18 min)')} ${B('loss-ai', 'Lost vs Normal AI')} ${B('win-1v1', 'Won 1v1 vs 1300')}`; }
  if (tab === 'pools' && REAL) body = `<div class="ktreasury"><b>President's treasury</b> (${K.OWNER.name})<br><code id="kb-owner">${K.OWNER_WALLET}</code></div>
    <p>Live prize pools shared by all Inu games (from shop fees): ${serverPools ? ['daily', 'weekly', 'monthly'].map(p => `${p} ${K.fmtK(Number(serverPools[p].accruedBaseUnits))}`).join(' · ') + ' $KIBBLE' : 'loading…'}</p>
    <p class="kh">Paid by leaderboard rank (top 3: 50/30/20). No random draws, no wagering, no paid entry. <a href="${API}/pools" target="_blank" rel="noopener">Public pools page ↗</a></p>`;
  else if (tab === 'pools') body = `<div class="ktreasury"><b>President's treasury</b> (${K.OWNER.name})<br><code id="kb-owner">${K.OWNER_WALLET}</code><br>Simulated balance: ${K.fmtK(s.treasuryU)} $KIBBLE. Display only: no transfers are made.</div>
    <p>Prize pools (simulated, local stub; shared state with Inu Verse needs the backend, as the two games run on different domains):</p>
    <p>Daily ${K.fmtK(s.pools.daily)} · Weekly ${K.fmtK(s.pools.weekly)} · Monthly ${K.fmtK(s.pools.monthly)} $KIBBLE</p>
    <p class="kh">Paid by ladder rank (top 3: 50/30/20). No random draws, no wagering, no paid entry.</p>${B('pay-daily', 'Close daily period (demo)')} ${B('pay-weekly', 'Close weekly')} ${B('pay-monthly', 'Close monthly')}
    <ul>${s.payouts.slice(0, 5).map(p => `<li>${p.pool}: ${p.winners.map(w => `${w.name} ${K.fmtK(w.amountU)}`).join(', ')}</li>`).join('')}</ul>
    <ul class="kh">${s.ledger.slice(0, 5).map(l => `<li>${l.item}: fee ${K.fmtK(l.fee)} → treasury ${K.fmtK(l.owner)}, pools ${K.fmtK(l.daily)}/${K.fmtK(l.weekly)}/${K.fmtK(l.monthly)}</li>`).join('')}</ul>`;
  if (tab === 'packs') { const pk = { ...Object.fromEntries(K.RIVALS.map(r => [r.pack, 0])), ...s.packs };
    body = `<p>Your pack tag: <input id="kb-pack" maxlength="4" size="5" value="${s.me.pack}"> ${B('set-pack', 'Set')} · Name: <input id="kb-name" maxlength="14" size="12" value="${s.me.name}"></p><p class="kh">Pack tags show on names. Each ranked win earns your pack ${K.PACK_POINTS_PER_WIN} pack points.</p>
    <table><tr><th>Pack</th><th>Points</th></tr>${Object.entries(pk).sort((a, b) => b[1] - a[1]).map(([p, v]) => `<tr><td>[${p}]</td><td>${v}</td></tr>`).join('')}</table>`; }
  if (tab === 'cup') body = `<p><b>Kibble Cup</b>, ${period().month} (stub). Free monthly holder tournament: any tier may enter, no entry fee. The bracket runs on the future server.</p>
    ${B('cup', 'Enter Kibble Cup (free)')}<div id="kb-msg"></div><p>Entrants: ${s.cup.month === period().month ? s.cup.entrants.join(', ') || 'none yet' : 'none yet'}</p>`;
  if (tab === 'kennel') body = kennelBody();
  $('kb-body').innerHTML = `<div class="ktabs">${tabs}</div>${body}`;
}
function msg(t) { const m = $('kb-msg'); if (m) m.textContent = t; }
export function initKibble() {
  document.body.insertAdjacentHTML('beforeend', `<div id="kid"></div><div id="kb" class="kb" data-tab="wallet"><div class="kpanel"><div class="khead"><b>$KIBBLE network</b> <span class="ksim">${REAL ? 'LIVE · Phantom · cosmetics only' : 'SIMULATED · demo only · no real wallet or transactions'}</span><button id="kb-close">✕</button></div><div id="kb-body"></div></div></div>`);
  for (const id of ['btn-kibble', 'kb-open']) $(id)?.addEventListener('click', () => { $('kb').style.display = 'flex'; render(); });
  $('kb-close').onclick = () => { $('kb').style.display = 'none'; };
  $('kb').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.tab) $('kb').dataset.tab = b.dataset.tab;
    if (kennelClick(b)) return;
    const k = b.dataset.k;
    if (REAL && k === 'connect') { msg('Approve the sign-in message in Phantom…'); walletUi?.connect(); return; }
    if (REAL && k === 'disconnect') { KP?.disconnect().then(() => { K.applyWallet(s, {}); save(); apply(); render(); walletUi?.el && location.reload(); }); return; }
    if (REAL && b.dataset.buy) { buyReal(b.dataset.buy, b); return; }
    if (k === 'connect') K.connectDemo(s); else if (k === 'disconnect') K.disconnect(s);
    else if (k === 'win-ai') K.recordMatch(s, { mode: 'ai', opp: 'hard', win: true, minutes: 18 }); else if (k === 'loss-ai') K.recordMatch(s, { mode: 'ai', opp: 'normal', win: false, minutes: 15 });
    else if (k === 'win-1v1') K.recordMatch(s, { mode: '1v1', oppRating: 1300, win: true, minutes: 22 });
    else if (k && k.startsWith('pay-') && !REAL) K.payout(s, k.slice(4), [s.me, ...K.RIVALS]);
    else if (k === 'set-pack') { s.me.pack = ($('kb-pack').value.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SHIB').slice(0, 4); s.me.name = ($('kb-name').value.trim() || 'You').slice(0, 14); }
    if (b.dataset.eq) K.equip(s, b.dataset.eq);
    let note = '';
    if (b.dataset.buy) { const r = K.buy(s, b.dataset.buy); note = r.ok ? `Bought (simulated). Fee ${K.fmtK(r.q.fee)}: ${K.fmtK(r.q.owner)} to treasury, ${K.fmtK(r.q.daily + r.q.weekly + r.q.monthly)} to pools.` : r.reason; }
    if (k === 'cup') { const r = K.joinCup(s, period().month); note = r.ok ? 'Entered (free).' : r.reason; }
    save(); apply(); render(); if (note) msg(note); });
  $('kb').addEventListener('input', kennelInput);
  initKennel(s, { real: REAL, kp: () => KP, connect: () => walletUi?.connect(), wallet: () => s.wallet?.address || null, balance: () => s.wallet ? Number(s.kibbleU || 0) / 1e6 : Infinity,
    onChange: persist => { if (persist) save(); if ($('kb')?.style.display === 'flex' && $('kb').dataset.tab === 'kennel') render(); try { dispatchEvent(new CustomEvent('empires:kennel', { detail: myLoadout() })); } catch {} } });
  apply();
  if (REAL) bootReal();
}
async function syncWallet(w) { // on connect / restore: on-chain balance -> tier, server inventory -> owned items
  if (!w?.address) { K.applyWallet(s, {}); } else { const inv = await KP.inventory(GAME).catch(() => ({})); K.applyWallet(s, { address: w.address, units: w.units ?? (await KP.balance().catch(() => ({ units: 0 }))).units, inventory: inv }); }
  refreshKennel().catch(() => {});
  save(); apply(); if ($('kb')?.style.display === 'flex') render(); try { dispatchEvent(new CustomEvent('empires:wallet', { detail: { owned: s.owned, tier: K.tier(s) } })); } catch {}
}
async function buyReal(id, b) {
  if (!KP || !KP.live) return msg('$KIBBLE payments are offline right now.');
  if (!s.wallet) { msg('Connect your wallet first.'); return walletUi?.connect(); }
  const c = K.COSMETICS[id]; if (c.tier !== 'none' && !K.canUse(s, id) && !s.owned.includes(id)) { const tr = K.TIERS.find(t => t.id === c.tier); if (s.kibbleU < K.toU(tr.min)) return msg(`Needs ${tr.name} tier (hold ≥ ${tr.min.toLocaleString()} $KIBBLE).`); }
  b.disabled = true; b.textContent = 'Confirm in Phantom…';
  const r = await KP.buy({ itemId: K.catalogId(id), game: GAME });
  if (r.ok) { await syncWallet({ address: KP.address }); msg('Payment confirmed: added to your wallet inventory.'); }
  else { b.disabled = false; b.textContent = 'Buy'; msg(r.url ? 'On phone: open the payment link in Phantom.' : (r.error || r.reason || 'Payment failed')); if (r.url) location.href = r.url; }
}
async function bootReal() {
  try { glue = await import(API + '/inu-games.js'); const R = await glue.initKibble({ game: GAME }); glue.mountFooter(R.mode); KP = R.kp; if (!KP) return;
    KP.pools().then(P => { serverPools = P.pools; }).catch(() => {});
    glue.mountHome?.(); // 🏠 Back to Inu Verse (title/pause/results; confirms + saves via globalThis.__inuHome)
    walletUi = glue.mountWallet(R, { game: GAME, keys: [KEY], position: 'top-right',
      progress: g => { try { const x = JSON.parse(g(KEY) || 'null'); return x ? (x.me?.wins || 0) * 10 + (x.me?.losses || 0) + (x.bones || 0) / 25 : 0; } catch { return 0; } },
      label: g => { try { const x = JSON.parse(g(KEY) || 'null'); return x ? `${x.me?.rating ?? 1200} Elo · ${x.me?.wins || 0}W ${x.me?.losses || 0}L` : ''; } catch { return ''; } },
      onWallet: w => syncWallet(w).catch(() => {}) });
  } catch (e) { console.warn('kibble-pay unavailable', e); }
}
