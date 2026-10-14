// $KIBBLE network panel (SIMULATED). UI over src/kibble.js; state in localStorage. Cosmetics only.
import * as K from './kibble.js';
import { TEAM } from './inu.js';
const KEY = 'inu-empires-kibble-sim';
let s; try { s = JSON.parse(localStorage.getItem(KEY)) || K.newState(); } catch { s = K.newState(); }
const save = () => localStorage.setItem(KEY, JSON.stringify(s));
const $ = id => document.getElementById(id);
export const kibbleState = () => s;
function apply() { const c = K.COSMETICS[s.equipped.colour]; if (c && c.value) TEAM.player = c.value; // visual team colour only
  const t = s.equipped.title ? K.COSMETICS[s.equipped.title].name : null; const el = $('kid');
  el.innerHTML = `<b>[${s.me.pack}]</b> ${s.me.name}${t ? ` <i>· ${t}</i>` : ''} · ${s.me.rating} Elo · 🦴 ${s.bones}`; }
const period = () => { const d = new Date(); return { day: d.toISOString().slice(0, 10), month: d.toISOString().slice(0, 7) }; };
function render() {
  const tr = K.tier(s), tab = $('kb').dataset.tab || 'wallet', B = (a, l, dis = false) => `<button data-k="${a}" ${dis ? 'disabled' : ''}>${l}</button>`;
  const tabs = ['wallet', 'shop', 'ladder', 'pools', 'packs', 'cup'].map(t => `<button class="kt${t === tab ? ' on' : ''}" data-tab="${t}">${{ wallet: 'Wallet & tiers', shop: 'Kibble shop', ladder: 'Ranked ladder', pools: "Pools & treasury", packs: 'Packs', cup: 'Kibble Cup' }[t]}</button>`).join('');
  let body = '';
  if (tab === 'wallet') body = `<p>${s.wallet ? `Connected <code>${s.wallet.address}</code> (demo wallet, nothing on-chain)` : 'Not connected.'}</p>
    <p>Balance: <b>${K.fmtK(s.kibbleU)} $KIBBLE</b> (demo) · Tier: <b id="kb-tier">${tr.name}</b> · Bones (free, never cashed out): ${s.bones}</p>
    ${s.wallet ? B('disconnect', 'Disconnect') : B('connect', 'Connect wallet (simulated)')}
    <p class="kh">Tiers: ${K.TIERS.slice(1).map(t => `${t.name} ≥ ${t.min.toLocaleString()}`).join(' · ')}. Tiers unlock cosmetics only: skins, banners, team colours, titles. Never stats, resources or build speed.</p>
    <div class="kgrid">${Object.entries(K.COSMETICS).filter(([, c]) => !c.price).map(([id, c]) => `<button data-eq="${id}" ${K.canUse(s, id) ? '' : 'disabled'} class="${s.equipped[c.kind] === id ? 'on' : ''}">${c.name}<small>${c.kind} · ${c.tier === 'none' ? 'free' : c.tier}</small></button>`).join('')}</div>`;
  if (tab === 'shop') body = `<p class="kh">2% fee on every purchase: 1% to the President's treasury, 0.25% daily, 0.5% weekly, 0.25% monthly prize pools.</p><div class="kgrid">${K.SHOP.map(id => { const c = K.COSMETICS[id], q = K.feeSplit(K.toU(c.price)), own = s.owned.includes(id);
    return `<div class="kitem"><b>${c.name}</b><small>${c.price} + ${K.fmtK(q.fee)} fee = ${K.fmtK(q.total)} $KIBBLE${c.tier !== 'none' ? ` · ${c.tier}+` : ''}</small>${own ? `<button data-eq="${id}" class="${s.equipped.skin === id ? 'on' : ''}">${s.equipped.skin === id ? 'Equipped' : 'Equip'}</button>` : `<button data-buy="${id}">Buy (simulated)</button>`}</div>`; }).join('')}</div><div id="kb-msg"></div>`;
  if (tab === 'ladder') { const rows = K.rank([s.me, ...K.RIVALS]);
    body = `<p class="kh">Elo (K=${K.K}). Ranked by rating; ties go to more wins, then fewer minutes per win. Free to play; no wallet needed for ranked.</p>
    <table><tr><th>#</th><th>Player</th><th>Elo</th><th>W-L</th><th>min/win</th></tr>${rows.map((p, i) => `<tr class="${p === s.me ? 'me' : ''}"><td>${i + 1}</td><td>[${p.pack}] ${p.name}</td><td>${p.rating}</td><td>${p.wins}-${p.losses}</td><td>${p.wins ? (p.minutesWon / p.wins).toFixed(1) : '-'}</td></tr>`).join('')}</table>
    <p class="kh">Record a result (demo: there is no in-game victory condition yet, so results are entered here):</p>${B('win-ai', 'Won vs Hard AI (18 min)')} ${B('loss-ai', 'Lost vs Normal AI')} ${B('win-1v1', 'Won 1v1 vs 1300')}`; }
  if (tab === 'pools') body = `<div class="ktreasury"><b>President's treasury</b> (${K.OWNER.name})<br><code id="kb-owner">${K.OWNER_WALLET}</code><br>Simulated balance: ${K.fmtK(s.treasuryU)} $KIBBLE. Display only: no transfers are made.</div>
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
  $('kb-body').innerHTML = `<div class="ktabs">${tabs}</div>${body}`;
}
function msg(t) { const m = $('kb-msg'); if (m) m.textContent = t; }
export function initKibble() {
  document.body.insertAdjacentHTML('beforeend', `<div id="kid"></div><div id="kb" class="kb" data-tab="wallet"><div class="kpanel"><div class="khead"><b>$KIBBLE network</b> <span class="ksim">SIMULATED · demo only · no real wallet or transactions</span><button id="kb-close">✕</button></div><div id="kb-body"></div></div></div>`);
  for (const id of ['btn-kibble', 'kb-open']) $(id)?.addEventListener('click', () => { $('kb').style.display = 'flex'; render(); });
  $('kb-close').onclick = () => { $('kb').style.display = 'none'; };
  $('kb').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.tab) $('kb').dataset.tab = b.dataset.tab;
    const k = b.dataset.k;
    if (k === 'connect') K.connectDemo(s); else if (k === 'disconnect') K.disconnect(s);
    else if (k === 'win-ai') K.recordMatch(s, { mode: 'ai', opp: 'hard', win: true, minutes: 18 }); else if (k === 'loss-ai') K.recordMatch(s, { mode: 'ai', opp: 'normal', win: false, minutes: 15 });
    else if (k === 'win-1v1') K.recordMatch(s, { mode: '1v1', oppRating: 1300, win: true, minutes: 22 });
    else if (k && k.startsWith('pay-')) K.payout(s, k.slice(4), [s.me, ...K.RIVALS]);
    else if (k === 'set-pack') { s.me.pack = ($('kb-pack').value.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SHIB').slice(0, 4); s.me.name = ($('kb-name').value.trim() || 'You').slice(0, 14); }
    if (b.dataset.eq) K.equip(s, b.dataset.eq);
    let note = '';
    if (b.dataset.buy) { const r = K.buy(s, b.dataset.buy); note = r.ok ? `Bought (simulated). Fee ${K.fmtK(r.q.fee)}: ${K.fmtK(r.q.owner)} to treasury, ${K.fmtK(r.q.daily + r.q.weekly + r.q.monthly)} to pools.` : r.reason; }
    if (k === 'cup') { const r = K.joinCup(s, period().month); note = r.ok ? 'Entered (free).' : r.reason; }
    save(); apply(); render(); if (note) msg(note); });
  apply();
}
