// Boss Raid screen (menu "Boss Raid"): pre-fight card (boss, time left, Auto-entered / Enter free, board, replays), the fight
// (5 lanes, red telegraphed lanes, boss marker, hearts, timer) and the replay viewer. Own art; shared sim (src/raid.js).
import * as R from './raid.js';
import { drawInu } from './inu.js';
const { BR } = R, $ = id => document.getElementById(id);
let ctx = { kp: () => null, kennelTier: () => null, hasCosmetic: () => false, onClose: () => {} };
const S = { mode: 'closed', data: null, entry: null, ticket: null, fight: null, replay: null, result: null, server: null, note: '', joined: null, acc: 0, last: 0, t: 0, speed: 1, label: '' };
export const raidState = () => S;
const signedIn = () => !!ctx.kp()?.session;
export async function autoJoin(force = false) { // on sign-in and every hour: Kennel tier / cosmetic -> auto-entered (server decides)
  const kp = ctx.kp(); if (!kp?.session) return null; const ev = BR.eventAt(Date.now()).eventId; if (!force && S.joined === ev) return S.entry;
  try { const r = await R.join(kp); S.joined = ev; S.entry = r.entry; } catch (e) { S.note = 'Could not reach the raid server: ' + e.message; } if (S.mode === 'card') paintCard(); return S.entry; }
export function initRaid(opts) { ctx = { ...ctx, ...opts };
  document.body.insertAdjacentHTML('beforeend', `<div id="raid" class="screen raid"><canvas id="raid-cv"></canvas><div id="raid-hud"></div>
    <div id="raid-pads"><button data-r="L" aria-label="Move left">◀</button><button data-r="B" class="bite" aria-label="Bite">Bite</button><button data-r="R" aria-label="Move right">▶</button></div>
    <div id="raid-card" class="panel"></div></div>`);
  $('raid').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset;
    if (a.r) return; // handled on pointerdown (no double press on touch)
    if (a.raid === 'fight') fight(); else if (a.raid === 'back') close(); else if (a.raid === 'card') openCard();
    else if (a.raid === 'replay-me') { const m = R.localBest(localStorage, S.data.event.eventId); if (m) playReplay(m.boss, m.inputs, 'My best'); }
    else if (a.raid === 'replay') loadReplay(a.ev, a.w); else if (a.raid === 'speed') { S.speed = S.speed === 1 ? 4 : 1; } });
  $('raid').addEventListener('pointerdown', e => { const b = e.target.closest('[data-r]'); if (b && S.fight) { e.preventDefault(); S.fight.press(b.dataset.r); b.dataset.pressed = '1'; } });
  addEventListener('keydown', e => { if (S.mode !== 'fight') return; const k = e.key.toLowerCase(), a = k === 'arrowleft' || k === 'a' ? 'L' : k === 'arrowright' || k === 'd' ? 'R' : k === ' ' || k === 'arrowup' || k === 'w' || k === 'b' ? 'B' : null;
    if (a) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) S.fight.press(a); } }, true);
  setInterval(() => autoJoin().catch(() => {}), 60_000); addEventListener('empires:wallet', () => autoJoin(true).catch(() => {}));
  requestAnimationFrame(loop); }
export async function openRaid() { $('raid').style.display = 'block'; S.mode = 'card'; S.result = null; S.server = null; paintCard(); S.data = await R.getRaid(); await autoJoin(); paintCard(); }
function close() { S.mode = 'closed'; S.fight = S.replay = null; $('raid').style.display = 'none'; ctx.onClose(); }
function openCard() { S.mode = 'card'; S.fight = S.replay = null; paintCard(); }
function paintCard() { const card = $('raid-card'), d = S.data, ev = d?.event || BR.eventAt(Date.now()), boss = BR.bossById(ev.boss), now = Date.now();
  card.style.display = S.mode === 'card' ? 'flex' : 'none'; $('raid-pads').style.display = S.mode === 'fight' ? 'flex' : 'none'; $('raid-hud').style.display = S.mode === 'card' ? 'none' : 'block';
  if (S.mode !== 'card') return;
  const lab = R.entryLabel({ signedIn: signedIn(), entry: S.entry, kennelTier: ctx.kennelTier(), hasCosmetic: ctx.hasCosmetic() }), mine = R.localBest(localStorage, ev.eventId);
  const board = (d?.event?.board || []).map(e => `<tr><td>${e.rank}</td><td>${R.short(e.wallet)}</td><td>${e.score}</td><td>${e.cleared ? '✓ ' + e.seconds + ' s' : '-'}</td><td><button data-raid="replay" data-ev="${ev.eventId}" data-w="${e.wallet}">Replay</button></td></tr>`).join('');
  const res = S.result ? `<div class="raid-res"><b>${S.result.cleared ? 'Boss cleared!' : S.result.hpLeft <= 0 ? 'Knocked out' : 'Time up'}</b> Score ${S.server?.result?.score ?? S.result.score}${S.server ? ` (checked by the server${S.server.best ? ', new event best' : ''}${S.server.inuScore != null ? ` · Inu Score ${S.server.inuScore}` : ''})` : signedIn() ? '' : ' (guest: saved on this device)'}</div>` : '';
  card.innerHTML = `<h2>Boss Raid: <span id="raid-boss">${boss.name}</span></h2>
    <div class="raid-meta"><span id="raid-entry" class="raid-entry ${lab.auto ? 'auto' : ''}">${lab.text}</span><span>Event ${ev.eventId}:00 UTC · ends in ${R.fmtLeft(ev.endMs - now)}</span><span>Roster ${d?.event?.roster?.total ?? 0} (${d?.event?.roster?.auto ?? 0} auto)</span></div>
    ${res}<div class="hint">Free entry, skill only: the boss follows a fixed published script; the server re-plays your inputs and decides the score. No bets, no raffles. Tiers, clans and cosmetics give no boosts.</div>
    <div class="row"><button id="raid-fight" data-raid="fight">⚔ Fight ${boss.name}</button>${mine ? `<button data-raid="replay-me">▶ My best (${mine.score})</button>` : ''}<button data-raid="back">Back</button></div>
    <div class="raid-cols"><div><b>Leaderboard</b> <small>(skill only, this hour)</small><table id="raid-board"><tr><th>#</th><th>Pup</th><th>Score</th><th>Clear</th><th></th></tr>${board || '<tr><td colspan="5">No results yet: be the first.</td></tr>'}</table></div>
    <div><b>Next bosses</b> <small>(your time)</small><ul>${(d?.schedule || BR.schedule(now, 6)).slice(1, 4).map(e => `<li>${e.bossName} · ${new Date(e.startMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</li>`).join('')}</ul>
    <small>← → / A D move · Space / tap Bite. Bite only lands from the lane under the boss; red lanes are about to be slammed.</small></div></div>
    <div class="hint" id="raid-note">${S.note}${d?.offline ? ' Raid server offline: playing as guest.' : ''}</div>`; }
async function fight() { const ev = BR.eventAt(Date.now()); S.ticket = null; S.note = '';
  if (signedIn()) { try { S.ticket = (await R.start(ctx.kp())).ticket; } catch (e) { S.note = 'No start ticket (' + e.message + '): this run stays on this device.'; } }
  S.fight = R.createFight(ev.boss); S.ev = ev; S.replay = null; S.mode = 'fight'; S.label = 'LIVE'; S.acc = 0; S.last = performance.now(); paintCard(); }
async function finishFight() { const res = S.fight.result(), ev = S.ev; S.result = res; S.server = null; S.mode = 'card';
  if (S.ticket) { try { S.server = await R.submit(ctx.kp(), S.ticket, res.inputs); } catch (e) { S.note = 'Server did not accept the run: ' + e.message; } }
  R.saveLocal(localStorage, ev.eventId, res); S.data = await R.getRaid(); S.fight = null; paintCard(); }
async function loadReplay(eventId, wallet) { try { const r = await R.getReplay(eventId, wallet); playReplay(r.boss, r.inputs, `Replay ${R.short(wallet)}`); } catch (e) { S.note = 'Replay unavailable: ' + e.message; paintCard(); } }
export function playReplay(boss, inputs, label) { S.replay = R.createReplay(boss, inputs); S.fight = null; S.mode = 'replay'; S.label = label; S.acc = 0; S.last = performance.now(); paintCard();
 }
function loop(now) { requestAnimationFrame(loop); if (S.mode !== 'fight' && S.mode !== 'replay') return; const run = S.fight || S.replay;
  S.acc += Math.min(250, now - S.last) * (S.mode === 'replay' ? S.speed : 1); S.last = now; S.t += 1 / 60;
  while (S.acc >= 100 && !run.s.over) { run.tick(); S.acc -= 100; }
  draw(run); if (run.s.over && S.mode === 'fight') { S.mode = 'ending'; setTimeout(finishFight, 900); }
  if (run.s.over && S.mode === 'replay' && !S.replayDone) { S.replayDone = true; setTimeout(() => { S.replayDone = false; if (S.mode === 'replay') openCard(); }, 1800); } }
// ---- art ----
function drawBoss(c, b, x, y, r, t, hurt) { c.save(); c.translate(x, y + Math.sin(t * 3) * r * 0.05);
  c.fillStyle = b.color; c.strokeStyle = b.dark; c.lineWidth = r * 0.08;
  c.beginPath(); c.ellipse(0, 0, r, r * 0.72, 0, 0, 7); c.fill(); c.stroke(); if (hurt) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill(); }
  if (b.id === 'gutter-gator') { c.fillStyle = b.color; c.fillRect(-r * 0.45, r * 0.3, r * 0.9, r * 0.5); c.fillStyle = '#fff'; for (let i = 0; i < 5; i++) c.fillRect(-r * 0.4 + i * r * 0.19, r * 0.72, r * 0.08, r * 0.12); }
  if (b.id === 'storm-crow') { c.fillStyle = b.dark; c.beginPath(); c.moveTo(-r, 0); c.lineTo(-r * 1.7, -r * 0.4 + Math.sin(t * 8) * r * 0.3); c.lineTo(-r * 0.7, r * 0.3); c.moveTo(r, 0); c.lineTo(r * 1.7, -r * 0.4 + Math.sin(t * 8) * r * 0.3); c.lineTo(r * 0.7, r * 0.3); c.fill();
    c.fillStyle = b.accent; c.beginPath(); c.moveTo(-r * 0.15, r * 0.2); c.lineTo(r * 0.15, r * 0.2); c.lineTo(0, r * 0.65); c.fill(); }
  if (b.id === 'iron-tomcat') { c.fillStyle = b.dark; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * 0.35, -r * 0.6); c.lineTo(s * r * 0.75, -r * 1.15); c.lineTo(s * r * 0.85, -r * 0.4); c.fill(); }
    c.strokeStyle = b.accent; c.lineWidth = r * 0.04; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * r * 0.3, r * 0.2 + i * r * 0.08); c.lineTo(s * r * 0.95, r * 0.1 + i * r * 0.14); c.stroke(); } }
  if (b.id === 'fog-badger') { c.fillStyle = b.accent; c.beginPath(); c.ellipse(0, -r * 0.1, r * 0.18, r * 0.62, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(230,230,240,0.25)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(Math.sin(t + i) * r * 1.3, r * 0.5 + i * 3, r * 0.4, 0, 7); c.fill(); } }
  c.fillStyle = b.accent; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * 0.32, -r * 0.18, r * 0.13, 0, 7); c.fill(); } c.fillStyle = '#111'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * 0.32, -r * 0.16, r * 0.06, 0, 7); c.fill(); }
  c.restore(); }
function draw(run) { const cv = $('raid-cv'), W = cv.width = innerWidth, H = cv.height = innerHeight, c = cv.getContext('2d'), s = run.s, b = s.boss, raid = run.raid, t = S.t;
  const top = Math.min(64, H * 0.14), bot = H - Math.min(130, H * 0.33), lw = Math.min(W / BR.LANES, 220), x0 = (W - lw * BR.LANES) / 2, lx = l => x0 + lw * (l + 0.5);
  c.fillStyle = '#1d2a18'; c.fillRect(0, 0, W, H);
  const tele = raid.telegraph(), left = s.next - s.tick, bl = raid.bossLane(), open = s.tick <= s.openUntil;
  for (let l = 0; l < BR.LANES; l++) { c.fillStyle = l % 2 ? '#2d4424' : '#34502a'; c.fillRect(x0 + l * lw, top, lw, H - top);
    if (tele.includes(l)) { c.fillStyle = `rgba(220,40,40,${0.25 + 0.5 * (1 - Math.max(0, left) / b.warn)})`; c.fillRect(x0 + l * lw, top, lw, H - top); c.fillStyle = '#ffd0d0'; c.font = `bold ${Math.round(lw * 0.12)}px sans-serif`; c.textAlign = 'center'; c.fillText('!', lx(l), bot - lw * 0.25); }
    if (l === bl) { c.strokeStyle = open ? '#ffe680' : '#f6e6c8aa'; c.lineWidth = 3; c.setLineDash([8, 6]); c.strokeRect(x0 + l * lw + 3, top + 3, lw - 6, H - top - 6); c.setLineDash([]); } }
  const lastHit = [...s.events].reverse().find(e => e.e === 'hit'), lastBite = [...s.events].reverse().find(e => e.e === 'bite');
  drawBoss(c, b, lx(bl), top + Math.min(70, H * 0.17), Math.min(lw * 0.36, H * 0.12), t, lastBite && s.tick - lastBite.t < 2);
  if (open) { c.fillStyle = '#ffe680'; c.font = `bold ${Math.round(Math.min(28, H * 0.07))}px Georgia,serif`; c.textAlign = 'center'; c.fillText('OPEN!', lx(bl), top + Math.min(150, H * 0.36)); }
  const flash = lastHit && s.tick - lastHit.t < 4; if (flash) { c.fillStyle = 'rgba(255,60,60,0.25)'; c.fillRect(0, 0, W, H); }
  const sc = Math.min(1.6, H / 260); drawInu(c, { id: 1, type: 'militia', owner: 'player', state: 'idle', path: [], face: [0, -1], attack: lastBite && s.tick - lastBite.t < 3 ? { id: 0 } : null }, lx(s.lane), bot + 26 * sc, t, { scale: sc });
  if (s.inv > 0 && Math.floor(t * 12) % 2) { c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(lx(s.lane), bot, 24 * sc, 0, 7); c.fill(); }
  // boss HP bar
  const bw = Math.min(W * 0.6, 520), bx = (W - bw) / 2; c.fillStyle = '#000a'; c.fillRect(bx, 6, bw, 12); c.fillStyle = b.accent; c.fillRect(bx, 6, bw * (1 - s.dmg / b.hp), 12); c.strokeStyle = '#f6e6c8'; c.strokeRect(bx + 0.5, 6.5, bw - 1, 11);
  const secs = Math.max(0, (BR.MAX_TICKS - s.tick) / BR.TICK_HZ);
  const hud = `<span id="raid-hearts">${'❤'.repeat(Math.max(0, s.hp))}${'♡'.repeat(Math.max(0, 3 - s.hp))}</span> <b>${b.name}</b> ${s.dmg}/${b.hp} · <span id="raid-timer">${secs.toFixed(1)} s</span> · Score <span id="raid-score">${BR.scoreOf(s)}</span>${s.combo ? ` · combo +${s.combo}` : ''} · <i>${S.label}</i>${S.mode === 'replay' ? ` <button data-raid="speed">${S.speed}x</button> <button data-raid="card">Close</button>` : ''}`;
  if (hud !== S.hud) { S.hud = hud; $('raid-hud').innerHTML = hud; } }
