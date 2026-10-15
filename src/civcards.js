// Match-select clan cards: animated preview, cosmetic rarity glow on the shield, short cinematic on hover / tap.
// Presentation only (DOM + canvas). Selecting a card sets the #civ select used by the game start.
import { CIVS, CIV_IDS, CIV_LOOK, civRarity } from './civs.js';
import { drawInu, BREEDS } from './inu.js';
const CINE_MS = 4000;
export function drawShield(ctx, x, y, s, id, t = 0, rarity = 'common') {
  const L = CIV_LOOK[id]; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (rarity !== 'common') { ctx.shadowColor = rarity === 'legendary' ? '#ffd86b' : '#7ac8ff'; ctx.shadowBlur = 10 + 6 * Math.sin(t * 3); }
  ctx.fillStyle = L.accent; ctx.beginPath(); ctx.moveTo(-22, -26); ctx.lineTo(22, -26); ctx.lineTo(22, 4); ctx.quadraticCurveTo(22, 22, 0, 30); ctx.quadraticCurveTo(-22, 22, -22, 4); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = L.primary; ctx.beginPath(); ctx.moveTo(-18, -22); ctx.lineTo(18, -22); ctx.lineTo(18, 3); ctx.quadraticCurveTo(18, 18, 0, 25); ctx.quadraticCurveTo(-18, 18, -18, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = L.secondary; ctx.strokeStyle = L.secondary; ctx.lineWidth = 2.5;
  switch (L.emblem) {
    case 'sun': ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); ctx.stroke(); } break;
    case 'crown': ctx.beginPath(); ctx.moveTo(-11, 8); ctx.lineTo(-11, -6); ctx.lineTo(-5, 1); ctx.lineTo(0, -10); ctx.lineTo(5, 1); ctx.lineTo(11, -6); ctx.lineTo(11, 8); ctx.fill(); break;
    case 'bow': ctx.beginPath(); ctx.arc(-4, 0, 13, -1.2, 1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(1, -12); ctx.lineTo(1, 12); ctx.moveTo(-8, 0); ctx.lineTo(12, 0); ctx.stroke(); break;
    case 'horse': ctx.beginPath(); ctx.moveTo(-10, 12); ctx.lineTo(-6, -2); ctx.lineTo(-2, -12); ctx.lineTo(8, -8); ctx.lineTo(4, -4); ctx.lineTo(8, 12); ctx.closePath(); ctx.fill(); break;
    case 'snow': for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * -12, Math.sin(a) * -12); ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.stroke(); } break;
    case 'stripe': for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 6 - 4, -12); ctx.lineTo(i * 6 + 4, 12); ctx.stroke(); } break;
  }
  ctx.restore();
}
function landmark(ctx, id, x, y, t, cine) {
  const L = CIV_LOOK[id]; ctx.save(); ctx.translate(x, y); ctx.fillStyle = L.primary; ctx.strokeStyle = L.accent;
  switch (L.landmark) {
    case 'torii': ctx.fillRect(-26, -40, 6, 40); ctx.fillRect(20, -40, 6, 40); ctx.fillRect(-34, -46, 68, 7); ctx.fillRect(-28, -34, 56, 4); break;
    case 'castle': ctx.fillRect(-30, -30, 60, 30); for (let i = -30; i < 30; i += 12) ctx.fillRect(i, -36, 7, 6); ctx.fillRect(-8, -52, 16, 22); break;
    case 'pagoda': for (let k = 0; k < 3; k++) { ctx.fillRect(-18 + k * 4, -14 - k * 16, 36 - k * 8, 12); ctx.fillStyle = L.accent; ctx.fillRect(-26 + k * 4, -16 - k * 16, 52 - k * 8, 3); ctx.fillStyle = L.primary; } break;
    case 'stable': ctx.fillRect(-32, -24, 64, 24); ctx.beginPath(); ctx.moveTo(-36, -24); ctx.lineTo(0, -42); ctx.lineTo(36, -24); ctx.fill(); break;
    case 'wall': ctx.fillStyle = L.secondary; ctx.fillRect(-40, -22, 80, 22); ctx.fillStyle = L.primary; for (let i = -40; i < 40; i += 10) ctx.fillRect(i, -28, 6, 6); break;
    case 'dojo': ctx.fillRect(-28, -22, 56, 22); ctx.fillStyle = L.accent; ctx.beginPath(); ctx.moveTo(-38, -20); ctx.lineTo(0, -40); ctx.lineTo(38, -20); ctx.fill(); break;
  }
  const fy = -58 - (cine ? 6 : 0); ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, fy); ctx.stroke();
  ctx.fillStyle = L.primary; ctx.beginPath(); ctx.moveTo(0, fy); for (let k = 0; k <= 8; k++) ctx.lineTo(k * 3, fy + Math.sin(t * (cine ? 9 : 4) - k * 0.7) * 2); for (let k = 8; k >= 0; k--) ctx.lineTo(k * 3, fy + 12 + Math.sin(t * (cine ? 9 : 4) - k * 0.7) * 2); ctx.fill();
  ctx.restore();
}
export function paintCard(ctx, id, W, H, t, cine = 0, rarity = 'common') {
  const L = CIV_LOOK[id], g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, L.sky[0]); g.addColorStop(1, L.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#00000030'; ctx.beginPath(); ctx.moveTo(0, H * 0.7); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * 0.66 + Math.sin(x * 0.05 + id.length) * 6); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillStyle = '#3d6b2a'; ctx.fillRect(0, H * 0.8, W, H * 0.2);
  landmark(ctx, id, W * 0.72, H * 0.8, t, cine > 0);
  // units: idle bob in preview; during the cinematic a column marches across under the clan banner
  const types = ['villager', CIVS[id].unique, 'militia', 'archer'], n = cine ? 4 : 2;
  for (let i = 0; i < n; i++) { const p = cine ? ((cine * 0.9 + i * 0.22) % 1.2) - 0.1 : 0; const x = cine ? p * W : W * (0.18 + i * 0.2), y = H * 0.86;
    drawInu(ctx, { id: i + 1, type: BREEDS[types[i]] ? types[i] : 'militia', owner: 'player', state: cine ? 'moving' : 'idle', path: cine ? [1] : [], face: [1, 0] }, x, y - 6, t, { scale: 1.3 });
    ctx.fillStyle = L.primary; ctx.fillRect(x - 9, y - 30, 2, 12); ctx.fillRect(x - 7, y - 30, 7, 5); }
  drawShield(ctx, 30, 34, 0.9, id, t, rarity);
  if (cine) { ctx.fillStyle = `rgba(0,0,0,${0.35 * Math.max(0, 1 - cine * 4)})`; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 8, W, 8); }
}
// Build the card grid into `root`. owned = Kibble-owned cosmetic ids (only for the glow). onPick(id).
export function mountCivCards(root, { owned = [], selected = 'shiba', onPick = () => {} } = {}) {
  const rar = civRarity(owned), cards = [];
  root.innerHTML = '';
  for (const id of CIV_IDS) {
    const r = rar(id), el = document.createElement('button'); el.type = 'button'; el.className = `civ-card rar-${r}${id === selected ? ' sel' : ''}`; el.dataset.civ = id;
    el.innerHTML = `<canvas width="176" height="104"></canvas><b>${CIVS[id].name}</b><small>${CIVS[id].style}</small><i class="rar" title="Cosmetic shield finish from Kibble cosmetics. No gameplay effect.">${r} shield</i>`;
    const card = { id, el, cv: el.querySelector('canvas'), cineAt: 0, rarity: r }; cards.push(card);
    const start = () => { card.cineAt = performance.now(); el.classList.add('cine'); };
    el.addEventListener('mouseenter', start); el.addEventListener('focus', start);
    el.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') start(); }); // tap = hover preview
    el.addEventListener('click', () => { for (const c of cards) c.el.classList.toggle('sel', c === card); onPick(id); start(); });
  }
  for (const c of cards) root.appendChild(c.el);
  let raf = 0; const loop = now => { if (!root.isConnected || root.offsetParent === null) { raf = requestAnimationFrame(loop); return; }
    for (const c of cards) { const ctx = c.cv.getContext('2d'), age = c.cineAt ? (now - c.cineAt) / CINE_MS : 1;
      if (age >= 1 && c.el.classList.contains('cine')) c.el.classList.remove('cine');
      paintCard(ctx, c.id, c.cv.width, c.cv.height, now / 1000, age < 1 ? Math.max(0.001, age) : 0, c.rarity); }
    raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  return { cards, stop: () => cancelAnimationFrame(raf) };
}
