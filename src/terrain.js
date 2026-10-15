// Textured classic-RTS-style grass, pre-rendered in cached 16x16-tile chunks. Purely visual: deterministic hash of (x, y), no sim RNG.
const CH = 16;
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = t => t * t * (3 - 2 * t);
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
const BASE = [74, 124, 42], VAR = [0, 0.025, -0.02, 0.04]; // tile variants nudge brightness only (no visible checkerboard)
function drawChunk(world, cx, cy, T) {
  const cv = document.createElement('canvas'), w = Math.min(CH, world.width - cx * CH), h = Math.min(CH, world.height - cy * CH);
  cv.width = w * T; cv.height = h * T; const g = cv.getContext('2d'), ox = cx * CH * T, oy = cy * CH * T;
  // 1) base: per-pixel-block colour from low-frequency noise (light/dark patches) + tile variant tint, 4px blocks, seamless across chunks
  const B = 4;
  for (let py = 0; py < cv.height; py += B) for (let px = 0; px < cv.width; px += B) {
    const wx = (ox + px) / T, wy = (oy + py) / T, tx = Math.floor(wx), ty = Math.floor(wy), v = BASE, vt = VAR[world.tiles[ty * world.width + tx] & 3];
    const n = vnoise(wx / 5, wy / 5, 1) * 0.6 + vnoise(wx / 1.6, wy / 1.6, 2) * 0.4, k = 0.8 + n * 0.36 + vt, j = (hash(ox + px, oy + py, 3) - 0.5) * 8;
    g.fillStyle = `rgb(${v[0] * k + j | 0},${v[1] * k + j | 0},${v[2] * k + j * 0.6 | 0})`; g.fillRect(px, py, B, B);
  }
  // 2) clumps, blades, flowers, dirt specks: seeded per tile, tiles in a 1-tile margin are drawn too so features cross chunk edges seamlessly
  for (let ty = cy * CH - 1; ty <= cy * CH + h; ty++) for (let tx = cx * CH - 1; tx <= cx * CH + w; tx++) {
    const bx = tx * T - ox, by = ty * T - oy;
    for (let i = 0; i < 3; i++) { const r = hash(tx, ty, 10 + i); if (r > 0.55) continue;
      const x = bx + hash(tx, ty, 20 + i) * T, y = by + hash(tx, ty, 30 + i) * T, rad = 4 + hash(tx, ty, 40 + i) * 7, dark = hash(tx, ty, 50 + i) < 0.55;
      g.fillStyle = dark ? 'rgba(30,60,15,0.22)' : 'rgba(150,190,80,0.16)'; g.beginPath(); g.ellipse(x, y, rad, rad * 0.65, 0, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 14; i++) { const x = bx + hash(tx, ty, 60 + i) * T | 0, y = by + hash(tx, ty, 80 + i) * T | 0, l = hash(tx, ty, 100 + i);
      g.fillStyle = l < 0.5 ? 'rgba(25,55,12,0.55)' : 'rgba(160,205,90,0.5)'; g.fillRect(x, y, 1, 2 + (l * 3 | 0)); if (l > 0.8) g.fillRect(x + 1, y - 1, 1, 2); }
    if (hash(tx, ty, 200) < 0.09) { const x = bx + 4 + hash(tx, ty, 201) * (T - 8) | 0, y = by + 4 + hash(tx, ty, 202) * (T - 8) | 0, f = ['#f4f0d8', '#f0d040', '#d890e0', '#f2a0a0'][hash(tx, ty, 203) * 4 | 0];
      g.fillStyle = '#2a5a18'; g.fillRect(x, y + 1, 1, 2); g.fillStyle = f; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
    if (hash(tx, ty, 300) < 0.18) { const n = 1 + (hash(tx, ty, 301) * 3 | 0); for (let i = 0; i < n; i++) {
      const x = bx + hash(tx, ty, 310 + i) * T | 0, y = by + hash(tx, ty, 320 + i) * T | 0; g.fillStyle = i % 2 ? 'rgba(120,90,50,0.6)' : 'rgba(95,72,40,0.55)'; g.fillRect(x, y, 2, 1); } }
  }
  // 3) very light grid
  g.fillStyle = 'rgba(0,0,0,0.07)'; for (let i = 0; i <= w; i++) g.fillRect(i * T, 0, 1, cv.height); for (let i = 0; i <= h; i++) g.fillRect(0, i * T, cv.width, 1);
  return cv;
}
const caches = new WeakMap();
export function drawTerrain(ctx, world, T, x0, y0, x1, y1) {
  let c = caches.get(world.tiles); if (!c) caches.set(world.tiles, c = new Map());
  for (let cy = Math.floor(y0 / CH); cy <= Math.floor((y1 - 1) / CH); cy++) for (let cx = Math.floor(x0 / CH); cx <= Math.floor((x1 - 1) / CH); cx++) {
    const k = cy * 1000 + cx; let cv = c.get(k); if (!cv) c.set(k, cv = drawChunk(world, cx, cy, T)); ctx.drawImage(cv, cx * CH * T, cy * CH * T); }
}
