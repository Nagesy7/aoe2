import { TILE, camPixel, selectedUnits } from './sim.js';
const GRASS = ['#4a7a2c', '#4f8030', '#457228', '#538634'];
function bar(ctx, x, y, w, frac, col = '#4fd34f') { ctx.fillStyle = '#000a'; ctx.fillRect(x, y, w, 6); ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, frac)), 4); }
export function render(ctx, world, cam, ui = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
  const c = camPixel(cam);
  ctx.save(); ctx.translate(-c.x, -c.y);
  const x0 = Math.max(0, Math.floor(c.x / TILE)), y0 = Math.max(0, Math.floor(c.y / TILE));
  const x1 = Math.min(world.width, Math.ceil((c.x + W) / TILE)), y1 = Math.min(world.height, Math.ceil((c.y + H) / TILE));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { ctx.fillStyle = GRASS[world.tiles[y * world.width + x]]; ctx.fillRect(x * TILE, y * TILE, TILE, TILE); }
  const sel = world.selection, selUnits = new Set(selectedUnits(world).map(u => u.id));
  if (sel && sel.kind === 'tile') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(sel.x * TILE + 1, sel.y * TILE + 1, TILE - 2, TILE - 2); ctx.lineWidth = 1; }
  for (const b of world.buildings) {
    const px = b.x * TILE, py = b.y * TILE, s = b.size * TILE;
    if (!b.complete) {
      ctx.fillStyle = '#c8a86a88'; ctx.fillRect(px, py, s, s); ctx.strokeStyle = '#6b4a20'; ctx.setLineDash([4, 3]); ctx.strokeRect(px + 1, py + 1, s - 2, s - 2); ctx.setLineDash([]);
      const f = b.progress / b.buildTime; ctx.fillStyle = '#8b6b43'; ctx.fillRect(px + 4, py + s - 4 - (s - 8) * f, s - 8, (s - 8) * f);
      bar(ctx, px, py - 9, s, f, '#e8c040');
    } else if (b.type === 'farm') {
      const n = world.resources.find(r => r.farm === b.id), f = n ? n.amount / 175 : 0;
      ctx.fillStyle = '#7a5a2a'; ctx.fillRect(px, py, s, s); ctx.fillStyle = `rgb(${150 + 60 * f | 0},${130 + 70 * f | 0},40)`;
      for (let i = 0; i < 6; i++) ctx.fillRect(px + 3, py + 3 + i * 15, s - 6, 8);
      ctx.strokeStyle = '#4a3010'; ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
    } else if (b.type === 'lumber_camp' || b.type === 'mining_camp' || b.type === 'mill') {
      ctx.fillStyle = '#8b6b43'; ctx.fillRect(px + 3, py + 14, s - 6, s - 16);
      ctx.fillStyle = b.type === 'lumber_camp' ? '#2d5a1d' : b.type === 'mining_camp' ? '#6a6a6a' : '#b89030';
      ctx.beginPath(); ctx.moveTo(px, py + 16); ctx.lineTo(px + s / 2, py + 2); ctx.lineTo(px + s, py + 16); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.type === 'lumber_camp' ? 'LUMBER' : b.type === 'mining_camp' ? 'MINING' : 'MILL', px + s / 2, py + s - 8);
      if (b.type === 'mill') { ctx.strokeStyle = '#eee'; ctx.lineWidth = 2; const cx = px + s / 2, cy = py + 10; ctx.beginPath(); ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx + 9, cy + 9); ctx.moveTo(cx + 9, cy - 9); ctx.lineTo(cx - 9, cy + 9); ctx.stroke(); ctx.lineWidth = 1; }
    } else if (b.type === 'barracks') {
      ctx.fillStyle = '#6a4a3a'; ctx.fillRect(px + 2, py + 18, s - 4, s - 20); ctx.fillStyle = '#3a2a2a'; ctx.fillRect(px - 2, py + 10, s + 4, 12);
      ctx.fillStyle = '#c02020'; ctx.fillRect(px + s / 2 - 1, py - 8, 2, 20); ctx.fillRect(px + s / 2 + 1, py - 8, 12, 8);
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Barracks', px + s / 2, py + s + 14);
      if (b.queue.length) bar(ctx, px, py - 18, s, b.trainProgress / 21, b.blocked ? '#d33' : '#4fd34f');
    } else if (b.type === 'house') {
      ctx.fillStyle = '#9b7b53'; ctx.fillRect(px + 4, py + 16, s - 8, s - 18);
      ctx.fillStyle = '#7a2a1a'; ctx.beginPath(); ctx.moveTo(px, py + 18); ctx.lineTo(px + s / 2, py + 2); ctx.lineTo(px + s, py + 18); ctx.fill();
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(px + s / 2 - 5, py + s - 16, 10, 14);
    } else {
      ctx.fillStyle = '#8b6b43'; ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#a33'; ctx.beginPath(); ctx.moveTo(px - 6, py + s * 0.45); ctx.lineTo(px + s / 2, py - 10); ctx.lineTo(px + s + 6, py + s * 0.45); ctx.fill();
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(px + s / 2 - 10, py + s - 28, 20, 28);
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.name, px + s / 2, py + s + 14);
      if (b.queue.length) bar(ctx, px, py - 18, s, b.trainProgress / 25, b.blocked ? '#d33' : '#4fd34f');
    }
    if (sel && sel.kind === 'building' && sel.id === b.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px - 3, py - 3, s + 6, s + 6); ctx.lineWidth = 1;
      if (b.rally) { const rx = b.rally.x * TILE, ry = b.rally.y * TILE; ctx.strokeStyle = '#fff8'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(px + s / 2, py + s / 2); ctx.lineTo(rx, ry); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(rx - 1, ry - 20, 2, 20); ctx.fillStyle = '#2a50c8'; ctx.fillRect(rx + 1, ry - 20, 12, 8); } }
  }
  for (const n of world.resources) {
    if (n.amount <= 0) continue;
    const px = n.x * TILE, py = n.y * TILE;
    if (sel && sel.kind === 'resource' && sel.id === n.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, py + 8, 15, 7, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    if (n.res === 'wood') { ctx.fillStyle = '#5a3a1a'; ctx.fillRect(px - 3, py, 6, 12); ctx.fillStyle = '#1f5a1f'; ctx.beginPath(); ctx.arc(px, py - 4, 12, 0, 7); ctx.fill(); }
    else if (n.kind === 'farm') {}
    else if (n.kind === 'carcass') { ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.ellipse(px, py + 4, 10, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#a02020'; ctx.beginPath(); ctx.ellipse(px + 2, py + 5, 5, 3, 0, 0, 7); ctx.fill();
      bar(ctx, px - 12, py - 10, 24, n.amount / 100, '#e0a040'); }
    else if (n.res === 'food') { ctx.fillStyle = '#2d6b2d'; ctx.beginPath(); ctx.arc(px, py, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#c0203a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(px - 6 + (i * 5) % 13, py - 5 + (i * 7) % 11, 2.5, 0, 7); ctx.fill(); } }
    else { ctx.fillStyle = n.res === 'gold' ? '#e0b83a' : '#9a9a9a'; ctx.beginPath(); ctx.moveTo(px - 13, py + 9); ctx.lineTo(px - 4, py - 11); ctx.lineTo(px + 6, py - 6); ctx.lineTo(px + 13, py + 9); ctx.fill(); ctx.strokeStyle = '#333'; ctx.stroke(); }
  }
  for (const a of world.animals) { const px = a.x * TILE, py = a.y * TILE;
    if (selUnits.has(a.id) || (sel && sel.kind === 'unit' && sel.id === a.id)) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, py + 5, 11, 6, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    ctx.fillStyle = '#f4f0e6'; ctx.beginPath(); ctx.ellipse(px, py, 9, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(px + 8, py - 2, 3.5, 0, 7); ctx.fill();
    if (a.owner) { ctx.fillStyle = '#2a50c8'; ctx.fillRect(px + 4, py - 6, 3, 8); } }
  for (const u of world.units) {
    const px = u.x * TILE, py = u.y * TILE;
    if (selUnits.has(u.id)) {
      if (u.path.length) { ctx.strokeStyle = '#ffffffaa'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(px, py); for (const q of u.path) ctx.lineTo(q.x * TILE, q.y * TILE); ctx.stroke(); ctx.setLineDash([]); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, py + 6, 11, 6, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    if (u.type === 'militia') { ctx.fillStyle = '#8a1a1a'; ctx.fillRect(px - 6, py - 7, 12, 14); ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.arc(px, py - 11, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 8, py + 6); ctx.lineTo(px + 8, py - 16); ctx.stroke(); ctx.lineWidth = 1; continue; }
    ctx.fillStyle = '#2a50c8'; ctx.fillRect(px - 5, py - 6, 10, 12);
    ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(px, py - 10, 4.5, 0, 7); ctx.fill();
    if (u.carry.amount) { ctx.fillStyle = { food: '#c0203a', wood: '#7a4a1a', gold: '#e0b83a', stone: '#aaa' }[u.carry.res]; ctx.fillRect(px + 5, py - 4, 6, 6); }
  }
  if (ui.ghost) { const g = ui.ghost; ctx.fillStyle = g.valid ? '#40ff4060' : '#ff303070'; ctx.strokeStyle = g.valid ? '#6f6' : '#f44'; ctx.lineWidth = 2;
    ctx.fillRect(g.tx * TILE, g.ty * TILE, g.size * TILE, g.size * TILE); ctx.strokeRect(g.tx * TILE, g.ty * TILE, g.size * TILE, g.size * TILE);
    ctx.strokeStyle = '#ffa500'; ctx.lineWidth = 3; for (const [x, y] of g.units || []) ctx.strokeRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4); ctx.lineWidth = 1; }
  ctx.restore();
  if (ui.box) { const b = ui.box; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#ffffff20'; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.strokeRect(b.x0 + 0.5, b.y0 + 0.5, b.x1 - b.x0, b.y1 - b.y0); }
}
