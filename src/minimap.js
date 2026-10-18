// Corner minimap (render-side only). Terrain + resources are cached per world; units/buildings and the camera
// rectangle are redrawn at ~5 Hz. Fog: tiles never explored stay dark and enemy units only show while seen.
// Tap / click / drag on it re-centres the camera.
const RES_COL = { tree: '#1d4a1a', berries: '#c8507a', gold_mine: '#e8c04a', stone_mine: '#a8adb3', fish: '#7fd0ff' };
const OWNER_COL = { player: '#4aa3ff', enemy: '#ff5a4a' };
export function createMinimap(el, { getWorld, getFog, getView, jump }) {
  const ctx = el.getContext('2d'); let base = null, baseWorld = null, last = 0, fogC = null, fogImg = null;
  const size = () => ({ w: el.width, h: el.height });
  function drawBase(world) {
    const W = world.width, H = world.height; base = document.createElement('canvas'); base.width = W; base.height = H; const b = base.getContext('2d');
    b.fillStyle = '#4b7a32'; b.fillRect(0, 0, W, H);
    if (world.water) { b.fillStyle = '#3a78b5'; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (world.water[y * W + x]) b.fillRect(x, y, 1, 1); }
    baseWorld = world;
  }
  function draw(now = performance.now(), force = false) {
    const world = getWorld(); if (!world || !el.getClientRects().length) return false; if (!force && now - last < 200) return false; last = now;
    if (baseWorld !== world) drawBase(world);
    const { w, h } = size(), W = world.width, H = world.height, sx = w / W, sy = h / H, fog = getFog();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(base, 0, 0, w, h);
    for (const n of world.resources) { if (n.amount <= 0) continue; const c = RES_COL[n.kind]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect(Math.floor(n.x) * sx, Math.floor(n.y) * sy, Math.max(1, sx), Math.max(1, sy)); }
    for (const bl of world.buildings) { const foe = fog && bl.owner !== fog.viewer; if (foe && !fog.sees(bl) && !fog.seenBuildings?.has(bl.id)) continue;
      ctx.fillStyle = OWNER_COL[bl.owner] || '#ddd'; ctx.fillRect(bl.x * sx, bl.y * sy, Math.max(2, bl.size * sx), Math.max(2, bl.size * sy)); }
    for (const u of world.units) { if (fog && u.owner !== fog.viewer && !fog.sees(u)) continue; ctx.fillStyle = OWNER_COL[u.owner] || '#fff'; ctx.fillRect(u.x * sx - 1, u.y * sy - 1, 2.5, 2.5); }
    if (world.animals) for (const a of world.animals) { ctx.fillStyle = '#f4f4f4'; ctx.fillRect(a.x * sx - 1, a.y * sy - 1, 2, 2); }
    if (fog && fog.explored) { if (!fogC || fogC.width !== W) { fogC = document.createElement('canvas'); fogC.width = W; fogC.height = H; fogImg = fogC.getContext('2d').createImageData(W, H); }
      const d = fogImg.data; for (let i = 0; i < W * H; i++) d[i * 4 + 3] = fog.explored[i] ? (fog.visible[i] ? 0 : 90) : 255;
      fogC.getContext('2d').putImageData(fogImg, 0, 0); ctx.drawImage(fogC, 0, 0, w, h); }
    const v = getView(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(v.x * sx + 0.5, v.y * sy + 0.5, v.w * sx, v.h * sy);
    return true;
  }
  const at = e => { const r = el.getBoundingClientRect(), world = getWorld(); return { x: (e.clientX - r.left) / r.width * world.width, y: (e.clientY - r.top) / r.height * world.height }; };
  let down = false;
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); down = true; el.setPointerCapture?.(e.pointerId); const p = at(e); jump(p.x, p.y); draw(performance.now(), true); });
  el.addEventListener('pointermove', e => { if (!down) return; e.preventDefault(); e.stopPropagation(); const p = at(e); jump(p.x, p.y); draw(performance.now(), true); });
  const up = e => { down = false; e.stopPropagation(); }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  for (const t of ['touchstart', 'touchmove', 'touchend', 'mousedown', 'contextmenu']) el.addEventListener(t, e => { e.stopPropagation(); if (t !== 'touchend') e.preventDefault(); }, { passive: false });
  return { draw };
}
