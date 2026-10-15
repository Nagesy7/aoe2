// Inu Verse-style sprite art (art/manifest.json). Visual only: never read by the sim. Falls back to procedural drawing until loaded.
const BASE = new URL('../art/', import.meta.url);
const img = f => { const i = new Image(); i.src = new URL(f, BASE).href; return i; };
let M = null; const U = {}, B = {}, tintCache = new Map();
export const artReady = () => !!M;
if (typeof Image !== 'undefined') fetch(new URL('manifest.json', BASE)).then(r => r.json()).then(m => {
  for (const u of m.units) U[u.id] = { ...u, img: img(u.file), team: img(u.team_layer) };
  for (const b of m.buildings) B[b.id] = { ...b, img: img(b.file), team: img(b.team_layer) };
  M = m; }).catch(() => {});
const ok = i => i && i.complete && i.naturalWidth > 0;
function tinted(key, mask, col) { const k = key + col; let c = tintCache.get(k); if (c) return c;
  c = document.createElement('canvas'); c.width = mask.naturalWidth; c.height = mask.naturalHeight; const g = c.getContext('2d');
  g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); tintCache.set(k, c); return c; }
function blit(ctx, a, key, sx, sy, sw, sh, dx, dy, col, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.drawImage(a.img, sx, sy, sw, sh, dx, dy, sw, sh);
  if (col && ok(a.team)) { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(tinted(key, a.team, col), sx, sy, sw, sh, dx, dy, sw, sh); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = 1; }
// rows S, W, E, N
export function dirRow(face) { const [fx, fy] = face || [0, 1]; return Math.abs(fx) > Math.abs(fy) ? (fx < 0 ? 1 : 2) : (fy < 0 ? 3 : 0); }
export function unitAnim(u, t, attacking) {
  if (u.dying != null) return { anim: 'death', f: Math.min(3, Math.floor(u.dying * 7)) };
  if (attacking || u.state === 'attacking' || u.state === 'gathering' || u.state === 'building') return { anim: 'attack', f: Math.floor(t * 6 + u.id) % 3 };
  if (u.path && u.path.length) return { anim: 'walk', f: Math.floor(t * 8 + u.id) % 4 };
  return { anim: 'idle', f: Math.floor(t * 2 + u.id) % 2 };
}
// Upgraded / clan-unique units reuse the sprite sheet of their base line (same Inu Verse style, team-tinted).
const ALIAS = { blade_paw: 'militia', halberd_pup: 'spearman', swift_rider: 'scout_cavalry', red_fang: 'militia', akita_guardian: 'militia', kishu_longbow: 'crossbowman', boar_rider: 'knight', frost_guard: 'spearman', brindle_striker: 'militia' };
export function drawUnitArt(ctx, u, px, py, t, col, attacking) {
  const a = U[u.type] || U[ALIAS[u.type]]; if (!a || !ok(a.img)) return false;
  const { anim, f } = unitAnim(u, t, attacking), w = a.frame_size.w, h = a.frame_size.h, col0 = a.animations[anim].start_col + f;
  blit(ctx, a, 'u' + (U[u.type] ? u.type : ALIAS[u.type]), col0 * w, dirRow(u.face) * h, w, h, Math.round(px - a.anchor.x), Math.round(py + 6 - a.anchor.y), col, u.dying != null ? Math.max(0, 1 - u.dying * 0.8) : 1);
  return true; }
export function drawBuildingArt(ctx, b, col) {
  const a = B[b.type]; if (!a || !ok(a.img)) return false; const T = 32, w = a.img.naturalWidth, h = a.img.naturalHeight;
  blit(ctx, a, 'b' + b.type, 0, 0, w, h, b.x * T, (b.y + b.size) * T - h, col); return true; }
export const unitArtHeight = type => (type = U[type] ? type : ALIAS[type] || type, U[type]) ? U[type].frame_size.h - (U[type].frame_size.h - U[type].anchor.y) : 30;
