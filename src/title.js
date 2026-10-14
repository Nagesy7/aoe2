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
export function paintTitle(ctx, W, H, t) {
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
  // marching Inu army, rim-lit
  const army = ['knight', 'militia', 'spearman', 'archer', 'villager', 'monk', 'crossbowman', 'scout_cavalry', 'spearman', 'militia', 'knight', 'trebuchet'];
  const sc = H / 260;
  army.forEach((type, i) => { const x = W * 0.04 + i * (W * 0.075) + (type === 'trebuchet' ? 20 : 0), y = H * 0.9 + (i % 2) * H * 0.03;
    drawInu(ctx, { id: i, type, owner: i % 5 === 4 ? 'player' : 'player', state: 'moving', path: [1], face: [1, 0] }, x, y, t * 0.8 + i * 0.3, { scale: sc, res: 'wood' }); });
  // embers
  for (let i = 0; i < 40; i++) { const x = (i * 131 + t * 20 * (1 + i % 3)) % W, y = H - ((i * 71 + t * 30 * (1 + i % 4)) % (H * 0.6)); ctx.fillStyle = `rgba(255,${160 + (i % 5) * 15},80,${0.35 + 0.3 * Math.sin(t * 3 + i)})`; ctx.fillRect(x, y, 2, 2); }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H); vg.addColorStop(0, '#0000'); vg.addColorStop(1, '#000a'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
export function startTitle(canvas) {
  const ctx = canvas.getContext('2d'), t0 = performance.now();
  const loop = () => { const W = canvas.clientWidth, H = canvas.clientHeight; if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if (canvas.style.display !== 'none') paintTitle(ctx, W, H, (performance.now() - t0) / 1000);
    raf = requestAnimationFrame(loop); };
  cancelAnimationFrame(raf); loop();
}
