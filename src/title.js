// Animated, procedurally painted title backdrop for Inu Empires (original art; presentation only).
import { drawInu, paw, TEAM } from './inu.js';
let raf = 0;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function ridge(ctx, W, H, base, amp, seed, col, off = 0) {
  const r = rng(seed); const pts = []; for (let i = 0; i <= 24; i++) pts.push(base + (r() - 0.5) * amp + Math.sin(i * 0.7 + seed) * amp * 0.4);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-50, H);
  for (let i = 0; i <= 24; i++) ctx.lineTo(-50 + i * (W + 100) / 24 + off, H * pts[i]); ctx.lineTo(W + 50, H); ctx.fill();
}
function castle(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const stone = '#4a3a4e', lit = '#6e5466', dark = '#2c2030';
  ctx.fillStyle = stone; ctx.fillRect(-120, -60, 240, 60);
  for (let i = -120; i < 120; i += 16) ctx.fillRect(i, -70, 10, 10);
  for (const [tx, th, tw] of [[-130, 130, 40], [90, 130, 40], [-35, 190, 70]]) {
    ctx.fillStyle = stone; ctx.fillRect(tx, -th, tw, th); ctx.fillStyle = lit; ctx.fillRect(tx + tw * 0.65, -th, tw * 0.35, th);
    ctx.fillStyle = '#5a2a2a'; ctx.beginPath(); ctx.moveTo(tx - 8, -th); ctx.lineTo(tx + tw / 2, -th - tw * 0.95); ctx.lineTo(tx + tw + 8, -th); ctx.fill();
    ctx.fillStyle = '#ffcf6a'; for (let k = 0; k < 3; k++) ctx.fillRect(tx + tw / 2 - 3, -th + 22 + k * 32, 6, 11);
    const fx = tx + tw / 2, fy = -th - tw * 0.95; ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 40); ctx.stroke();
    ctx.fillStyle = tx < 0 && tx > -100 ? TEAM.enemy : TEAM.player; ctx.beginPath(); ctx.moveTo(fx, fy - 40);
    for (let k = 0; k <= 10; k++) ctx.lineTo(fx + k * 4, fy - 40 + Math.sin(t * 4 - k * 0.6 + tx) * 2.5); for (let k = 10; k >= 0; k--) ctx.lineTo(fx + k * 4, fy - 20 + Math.sin(t * 4 - k * 0.6 + tx) * 2.5); ctx.fill();
    paw(ctx, fx + 20, fy - 30 + Math.sin(t * 4 - 3 + tx) * 2.5, 7, '#f6e6c8'); }
  ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, -22, 18, Math.PI, 0); ctx.lineTo(18, 0); ctx.lineTo(-18, 0); ctx.fill();
  // hanging paw banners on the wall
  for (const bx of [-80, 60]) { ctx.fillStyle = TEAM.player; ctx.beginPath(); ctx.moveTo(bx, -58); ctx.lineTo(bx + 22, -58); ctx.lineTo(bx + 22, -18); ctx.lineTo(bx + 11, -26); ctx.lineTo(bx, -18); ctx.fill(); paw(ctx, bx + 11, -42, 8, '#f6e6c8'); }
  ctx.restore();
}
function tree(ctx, x, y, s, col) { ctx.fillStyle = '#2a1a14'; ctx.fillRect(x - 2 * s, y - 14 * s, 4 * s, 14 * s); ctx.fillStyle = col;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x - (16 - k * 4) * s, y - (10 + k * 12) * s); ctx.lineTo(x, y - (34 + k * 12) * s); ctx.lineTo(x + (16 - k * 4) * s, y - (10 + k * 12) * s); ctx.fill(); } }
// ---- Kibble Mood looks (presentation only) ----
const MOOD_LOOK = { zoomies: { march: true, speed: 1.8, bounce: 9, hop: 0.025, tint: 'rgba(255,216,74,0.10)' }, happy: { march: true, speed: 1, bounce: 4, hop: 0.006, tint: 'rgba(255,226,140,0.10)' },
  chill: { march: false, speed: 0.6, tint: null }, grumpy: { march: false, speed: 0.5, tint: 'rgba(70,90,130,0.22)' }, doghouse: { march: false, speed: 0.5, tint: 'rgba(20,24,52,0.42)' } };
function umbrella(ctx, x, y, s, i) { ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 18 * s); ctx.stroke();
  ctx.fillStyle = ['#c8323c', '#2a50c8', '#1f8a5a'][i % 3]; ctx.beginPath(); ctx.arc(x, y, 13 * s, Math.PI, 0); ctx.fill(); }
function fire(ctx, x, y, s, t) { ctx.fillStyle = '#3a2412'; ctx.fillRect(x - 14 * s, y + 2 * s, 28 * s, 5 * s);
  for (let k = 0; k < 5; k++) { const h = (14 + 8 * Math.sin(t * 9 + k * 1.7)) * s; ctx.fillStyle = k % 2 ? '#ffb030' : '#ff6a20'; ctx.beginPath(); ctx.moveTo(x - 10 * s + k * 5 * s, y + 3 * s); ctx.lineTo(x - 7 * s + k * 5 * s, y - h); ctx.lineTo(x - 4 * s + k * 5 * s, y + 3 * s); ctx.fill(); }
  const g = ctx.createRadialGradient(x, y, 2, x, y, 90 * s); g.addColorStop(0, 'rgba(255,150,60,0.35)'); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.fillRect(x - 90 * s, y - 90 * s, 180 * s, 180 * s); }
function cloud(ctx, cx, cy, w, col) { ctx.fillStyle = col; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(cx - w / 2 + k * w / 4, cy + Math.sin(k * 2) * w * 0.05, w * 0.22, w * 0.11, 0, 0, 7); ctx.fill(); } }
function moodSky(ctx, W, H, t, mood, sc) {
  const L = MOOD_LOOK[mood] || MOOD_LOOK.chill; if (L.tint) { ctx.fillStyle = L.tint; ctx.fillRect(0, 0, W, H); }
  if (mood === 'grumpy' || mood === 'doghouse') { const cx = W * 0.86, cy = H * 0.6, w = W * (mood === 'doghouse' ? 0.34 : 0.28);
    if (mood === 'doghouse' && Math.sin(t * 1.7) > 0.985) { ctx.fillStyle = 'rgba(230,235,255,0.35)'; ctx.fillRect(0, 0, W, H); }
    ctx.strokeStyle = 'rgba(170,200,255,0.55)'; ctx.lineWidth = 1.2; for (let i = 0; i < (mood === 'doghouse' ? 90 : 50); i++) { const x = cx - w / 2 + ((i * 53.7) % w), y = cy + ((t * 260 + i * 37) % (H * 0.35));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9); ctx.stroke(); }
    cloud(ctx, cx, cy, w, mood === 'doghouse' ? '#23233aee' : '#59607add'); }
  if (mood === 'doghouse') { const bw = Math.min(W * 0.2, 220), bx = W * 0.89 - bw / 2, by = H * 0.70; ctx.fillStyle = '#5a1a1aee'; ctx.fillRect(bx, by, bw, 30 * sc * 0.9); ctx.strokeStyle = '#f6e6c8'; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 30 * sc * 0.9 - 1);
    ctx.fillStyle = '#f6e6c8'; ctx.font = `bold ${Math.round(15 * sc * 0.7)}px serif`; ctx.textAlign = 'center'; ctx.fillText('HOLD THE LINE', bx + bw / 2, by + 20 * sc * 0.9); ctx.textAlign = 'start'; }
  if (mood === 'zoomies') { for (let i = 0; i < 26; i++) { const x = (i * 97 + t * 40) % W, y = ((i * 61 + t * (90 + i * 7)) % (H * 0.9)), a = t * 3 + i; ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = ['#ffd84a', '#f6e6c8', '#ff8ab0', '#8ad8ff'][i % 4]; ctx.fillRect(-6, -1.5, 12, 3); ctx.beginPath(); ctx.arc(-6, -2, 2.2, 0, 7); ctx.arc(-6, 2, 2.2, 0, 7); ctx.arc(6, -2, 2.2, 0, 7); ctx.arc(6, 2, 2.2, 0, 7); ctx.fill(); ctx.restore(); }
    for (let i = 0; i < 8; i++) { const k = (t * 2 + i / 8) % 1, x = W * 0.76 + Math.cos(i * 1.3) * H * 0.12, y = H * 0.5 + Math.sin(i * 2.1) * H * 0.1; ctx.fillStyle = `rgba(255,230,120,${1 - k})`; ctx.fillRect(x - 1, y - 6 * k - 1, 3, 3); } }
}
export function paintTitle(ctx, W, H, t, mood = 'chill') {
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1d1840'); sky.addColorStop(0.35, '#7a3466'); sky.addColorStop(0.6, '#f07a3e'); sky.addColorStop(0.75, '#ffc66a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const r = rng(7); ctx.fillStyle = '#ffffffb0'; for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H * 0.3; ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t + i)); ctx.fillRect(x, y, 1.6, 1.6); } ctx.globalAlpha = 1;
  const sx = W * 0.6, sy = H * 0.6; const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, H * 0.5); glow.addColorStop(0, '#fff2c0'); glow.addColorStop(0.15, '#ffd070c0'); glow.addColorStop(1, '#ff804000');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(sx, sy, H * 0.07, 0, 7); ctx.fill();
  for (let i = 0; i < 6; i++) { const cx = ((i * 260 + t * (8 + i * 3)) % (W + 400)) - 200, cy = H * (0.12 + (i % 3) * 0.08); ctx.fillStyle = i % 2 ? '#c8608088' : '#f0a07088';
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(cx + k * 34, cy + Math.sin(k) * 6, 60, 12, 0, 0, 7); ctx.fill(); } }
  // snow-capped volcano
  const mx = W * 0.52, my = H * 0.62; ctx.fillStyle = '#5a4a78'; ctx.beginPath(); ctx.moveTo(mx - H * 0.55, my); ctx.lineTo(mx - H * 0.08, H * 0.27); ctx.lineTo(mx + H * 0.08, H * 0.27); ctx.lineTo(mx + H * 0.55, my); ctx.fill();
  ctx.fillStyle = '#f4e8f4'; ctx.beginPath(); ctx.moveTo(mx - H * 0.15, H * 0.36); ctx.lineTo(mx - H * 0.08, H * 0.27); ctx.lineTo(mx + H * 0.08, H * 0.27); ctx.lineTo(mx + H * 0.15, H * 0.36);
  for (let k = 0; k < 6; k++) ctx.lineTo(mx + H * 0.15 - k * H * 0.06, H * (0.36 + (k % 2 ? 0.03 : 0))); ctx.fill();
  const par = Math.sin(t * 0.15) * 10;
  ridge(ctx, W, H, 0.64, 0.08, 3, '#4a2e5a', par * 0.3);
  ridge(ctx, W, H, 0.72, 0.06, 11, '#33203e', par * 0.6);
  // castle hill
  ctx.fillStyle = '#26182c'; ctx.beginPath(); ctx.moveTo(W * 0.42, H); ctx.quadraticCurveTo(W * 0.76, H * 0.52, W * 1.02, H); ctx.fill();
  castle(ctx, W * 0.76, H * 0.66, H / 900, t);
  for (let i = 0; i < 14; i++) tree(ctx, (i * 97 + par) % W, H * 0.8 + (i % 3) * 8, 1 + (i % 2) * 0.4, '#1a1222');
  const fg = ctx.createLinearGradient(0, H * 0.78, 0, H); fg.addColorStop(0, '#3a2a1a'); fg.addColorStop(1, '#140c06'); ctx.fillStyle = fg;
  ctx.beginPath(); ctx.moveTo(0, H * 0.82); ctx.quadraticCurveTo(W * 0.5, H * 0.76, W, H * 0.84); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  // marching Inu army, rim-lit. Kibble Mood (title/lobby/between matches only) changes their idles: zoomies bounce,
  // happy wag + march, chill nap, grumpy umbrellas, doghouse huddle by the fire pit.
  const army = ['knight', 'militia', 'spearman', 'archer', 'villager', 'monk', 'crossbowman', 'scout_cavalry', 'spearman', 'militia', 'knight', 'trebuchet'];
  const sc = H / 260, M = MOOD_LOOK[mood] || MOOD_LOOK.chill, pit = { x: W * 0.89, y: H * 0.88 };
  if (mood === 'doghouse') fire(ctx, pit.x, pit.y, sc, t);
  army.forEach((type, i) => { let x = W * 0.04 + i * (W * 0.075) + (type === 'trebuchet' ? 20 : 0), y = H * 0.9 + (i % 2) * H * 0.03;
    if (mood === 'doghouse' && type !== 'trebuchet') { const a = (i / 11) * Math.PI * 2; x = pit.x + Math.cos(a) * Math.min(W * 0.09, 90); y = pit.y + Math.sin(a) * H * 0.05; }
    if (M.bounce) y -= Math.abs(Math.sin(t * M.bounce + i)) * H * M.hop;
    const nap = mood === 'chill' && i % 4 === 1, moving = M.march && !nap;
    drawInu(ctx, { id: i, type, owner: 'player', state: moving ? 'moving' : 'idle', path: moving ? [1] : [], face: [mood === 'doghouse' && x > pit.x ? -1 : 1, 0] }, x, y + (nap ? H * 0.01 : 0), t * M.speed + i * 0.3, { scale: sc, res: 'wood' });
    if (nap) { ctx.fillStyle = '#e8f0ffcc'; ctx.font = `bold ${Math.round(10 * sc)}px sans-serif`; for (let k = 0; k < 3; k++) { const z = (t * 0.6 + k / 3) % 1; ctx.globalAlpha = 1 - z; ctx.fillText('z', x + 8 * sc + z * 14 * sc, y - 26 * sc - z * 24 * sc); } ctx.globalAlpha = 1; }
    if (mood === 'grumpy' && i % 2 === 0 && type !== 'trebuchet') umbrella(ctx, x, y - 40 * sc, sc, i);
    if (mood === 'happy' || mood === 'zoomies') { ctx.strokeStyle = '#f6e6c8'; ctx.lineWidth = 2 * sc; ctx.beginPath(); const w = Math.sin(t * (mood === 'zoomies' ? 22 : 12) + i) * 6 * sc; ctx.moveTo(x - 9 * sc, y - 12 * sc); ctx.quadraticCurveTo(x - 15 * sc, y - 20 * sc, x - 13 * sc + w, y - 26 * sc); ctx.stroke(); }
  });
  moodSky(ctx, W, H, t, mood, sc);
  // embers
  for (let i = 0; i < 40; i++) { const x = (i * 131 + t * 20 * (1 + i % 3)) % W, y = H - ((i * 71 + t * 30 * (1 + i % 4)) % (H * 0.6)); ctx.fillStyle = `rgba(255,${160 + (i % 5) * 15},80,${0.35 + 0.3 * Math.sin(t * 3 + i)})`; ctx.fillRect(x, y, 2, 2); }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H); vg.addColorStop(0, '#0000'); vg.addColorStop(1, '#000a'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
export function startTitle(canvas, getMood = () => 'chill') {
  const ctx = canvas.getContext('2d'), t0 = performance.now();
  const loop = () => { const W = canvas.clientWidth, H = canvas.clientHeight; if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if (canvas.style.display !== 'none') paintTitle(ctx, W, H, (performance.now() - t0) / 1000, getMood());
    raf = requestAnimationFrame(loop); };
  cancelAnimationFrame(raf); loop();
}
