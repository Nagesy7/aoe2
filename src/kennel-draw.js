// Kibble Kennel cosmetics: drawing only. Called from render.js with a per-owner loadout { ids: Set, name, tier }.
// Reads unit/building position + type for placement; never writes to the world (tests/kennel.test.mjs checks the sim hash).
import { paw } from './inu.js';
const BRONZE = ['#b8733a', '#e3a868'], SILVER = ['#a9b4c2', '#eef3f8'], GOLD = ['#d9a520', '#fff0a0'];
const COLLARS = { player: '#1fd1c1', enemy: '#ff8a2a' };
export const has = (L, id) => !!(L && L.ids && L.ids.has(id));
// under the unit body
export function unitUnder(ctx, u, px, py, t, L) {
  if (!L || u.dying) return;
  if (has(L, 'kn_aura_gold')) { const k = 0.55 + 0.25 * Math.sin(t * 3 + u.id), g = ctx.createRadialGradient(px, py + 5, 2, px, py + 5, 22);
    g.addColorStop(0, `rgba(255,220,90,${k})`); g.addColorStop(1, 'rgba(255,200,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py + 5, 22, 11, 0, 0, 7); ctx.fill(); ctx.strokeStyle = `rgba(255,236,140,${k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(px, py + 5, 15, 7, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
  else if (has(L, 'kn_aura_paw')) { const k = 0.45 + 0.35 * Math.sin(t * 4 + u.id * 0.7); ctx.globalAlpha = k; ctx.shadowColor = '#9ff6ff'; ctx.shadowBlur = 6;
    for (let i = 0; i < 3; i++) { const a = t * 1.5 + u.id + i * 2.1; paw(ctx, px + Math.cos(a) * 14, py + 6 + Math.sin(a) * 6, 4.5, '#bff8ff'); }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
}
// over the unit body
export function unitOver(ctx, u, px, py, t, L, owner) {
  if (!L || u.dying) return;
  if (has(L, 'kn_collar')) { ctx.fillStyle = COLLARS[owner] || COLLARS.player; ctx.fillRect(px - 5, py - 13, 10, 2.5); ctx.fillStyle = '#ffe680'; ctx.fillRect(px - 1, py - 11, 2, 2); }
  if (has(L, 'kn_tag') || has(L, 'kn_title_alpha') || has(L, 'kn_name_gold')) {
    const txt = (L.name || 'Kennel') + (has(L, 'kn_title_alpha') ? ' · Alpha' : '');
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; const w = Math.min(70, ctx.measureText(txt).width + 6), y = py - 41;
    const [b, hi] = has(L, 'kn_name_gold') ? GOLD : BRONZE; ctx.fillStyle = '#1a0f08d0'; ctx.fillRect(px - w / 2, y - 7, w, 10); ctx.strokeStyle = b; ctx.lineWidth = 1; ctx.strokeRect(px - w / 2 + 0.5, y - 6.5, w - 1, 9);
    ctx.fillStyle = has(L, 'kn_name_gold') ? hi : '#f4e2b8'; ctx.fillText(txt, px, y + 1, w - 4); }
}
// buildings (complete only): Den Hall banner, flag recolour, Top Dog skin set
export function buildingOver(ctx, b, px, py, s, t, L) {
  if (!L || !b.complete || b.type === 'farm') return;
  if (has(L, 'kn_bskin_gold')) { ctx.strokeStyle = '#e8b830'; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, s - 2, s - 2); ctx.lineWidth = 1;
    ctx.fillStyle = GOLD[1]; for (const [x, y] of [[px + 2, py + 2], [px + s - 6, py + 2], [px + 2, py + s - 6], [px + s - 6, py + s - 6]]) ctx.fillRect(x, y, 4, 4);
    ctx.fillStyle = 'rgba(255,215,90,0.10)'; ctx.fillRect(px, py, s, s); }
  if (has(L, 'kn_flag')) { const fx = px + s - 8, fy = py - 6; ctx.fillStyle = '#3a2412'; ctx.fillRect(fx, fy, 2.5, 26); ctx.fillStyle = '#12a89a'; ctx.beginPath(); ctx.moveTo(fx + 2.5, fy); ctx.lineTo(fx + 22, fy + 6); ctx.lineTo(fx + 2.5, fy + 13); ctx.fill(); ctx.fillStyle = '#f4f0e0'; ctx.fillRect(fx + 2.5, fy + 5, 12, 2.5); }
  if (b.type !== 'town_center') return;
  const banner = has(L, 'kn_banner_anim') ? 'anim' : has(L, 'kn_banner_silver') ? 'silver' : has(L, 'kn_banner_bronze') ? 'bronze' : null; if (!banner) return;
  // a banner pole planted beside the Den Hall (left side), banner hanging from the top
  const [c0, c1] = banner === 'bronze' ? BRONZE : banner === 'silver' ? SILVER : GOLD, W = 30, H = 42, gx = px - 14, top = py + s * 0.08, bx = gx + 3, by = top + 6;
  ctx.fillStyle = '#3a2412'; ctx.fillRect(gx, top, 3, s * 0.9); ctx.fillRect(gx, top, W + 6, 3); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(gx + 1.5, top - 2, 3, 0, 7); ctx.fill();
  const wave = banner === 'anim' ? (k => Math.sin(t * 5 + k * 0.9) * 3) : () => 0;
  ctx.fillStyle = c0; ctx.beginPath(); ctx.moveTo(bx, by);
  for (let k = 0; k <= 6; k++) ctx.lineTo(bx + k * (W / 6) + wave(k) * (k / 6), by); ctx.lineTo(bx + W + wave(6), by + H); ctx.lineTo(bx + W / 2 + wave(3) * 0.6, by + H - 9); ctx.lineTo(bx + wave(0) * 0.2, by + H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = c1; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; paw(ctx, bx + W / 2 + wave(3) * 0.5, by + 15, 8, c1);
  if (banner === 'anim') { for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3) % 1; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff6c0'; ctx.fillRect(bx + 4 + i * 10 + wave(i * 2), by + 4 + k * (H - 8), 2.5, 2.5); } ctx.globalAlpha = 1; }
}
