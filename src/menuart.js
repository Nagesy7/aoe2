// Pixel-art title backdrop + menu chrome (art/menu/*, original art, see /workspace/inu-shared/art/inu-empires-menu/README.md).
// Presentation only: never read by the sim. First screen = one flattened WebP sized for the viewport (42 KB on phones);
// the 5 parallax layers (sky/clouds/far/mid/front, ~75 KB) load after the page is idle and fade in over it. prefers-reduced-motion
// keeps every layer still (no parallax, no cloud drift). ?art=0 falls back to the procedural canvas title.
const DIR = new URL('../art/menu/', import.meta.url).href;
export const ART_ON = typeof location !== 'undefined' && !/[?&]art=0\b/.test(location.search);
export const artUrl = f => DIR + f;
const LAYERS = [['sky', 0.05], ['clouds', 0.15], ['far', 0.25], ['mid', 0.5], ['front', 1]]; // back -> front, parallax speed
const DRIFT = 8; // cloud drift in art px/s (1688-wide art), snapped to 4 art px steps so the pixels stay crisp
export function mountTitleArt(root) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)'), big = () => innerWidth > 900 && innerHeight > 520;
  root.innerHTML = `<div class="flat"></div>${LAYERS.map(([n]) => `<div class="lyr" data-l="${n}"></div>`).join('')}<div class="gnd"></div>`;
  const flat = root.querySelector('.flat'), lyrs = [...root.querySelectorAll('.lyr')], gnd = root.querySelector('.gnd');
  // Framing: the art's left Inu group (art x 96-552) would sit behind the left menu column. The scene layers (far / mid / front, and
  // the flattened first-screen picture) are scaled down just enough and anchored bottom-right so that group stands clear of the
  // column; sky + clouds stay full-bleed (both tile in x) and a grass strip (cut from the front layer) runs on under the column.
  const OVX = 28, OVY = 12, GROUP_X = 96;
  let colRight = 0; const measure = () => { const n = document.querySelector('#pg-home .mnavs'); if (n && n.offsetParent) { const r = n.getBoundingClientRect(); if (r.width) colRight = r.right; } };
  function reframe() { measure(); const W = innerWidth, H = innerHeight, cover = Math.max((W + 2 * OVX) / 1688, (H + 2 * OVY) / 780);
    const fit = colRight ? (W + OVX - colRight - 14) / (1688 - GROUP_X) : cover, sc = Math.max(cover * 0.55, Math.min(cover, fit));
    const ax = x => W + OVX - (1688 - x) * sc; // art x -> screen x (scene anchored bottom-right)
    st.scale = sc; st.cover = cover; st.groupX = ax(GROUP_X); st.colRight = colRight;
    // for the mood overlay (src/title.js): open grass between the two Inu groups, and the sky above the right group
    st.scene = { gapL: ax(560), gapR: ax(1110), rightL: ax(1120), rightR: ax(1600), groundY: H + OVY - (780 - 700) * sc, top: H + OVY - 780 * sc, sc };
    const size = `${(1688 * sc).toFixed(1)}px ${(780 * sc).toFixed(1)}px`, framed = sc < cover - 1e-6;
    for (const el of [flat, ...lyrs.slice(2)]) { el.style.backgroundSize = framed ? size : ''; el.style.backgroundPosition = framed ? 'right bottom' : ''; }
    const left = W + 2 * OVX - 1688 * sc; gnd.style.display = framed ? 'block' : 'none';
    // soften the scene's left edge into the full-bleed sky and the grass strip (no hard seam)
    const mask = framed ? `linear-gradient(to right, transparent ${left.toFixed(0)}px, #000 ${(left + 20).toFixed(0)}px)` : '';
    for (const el of lyrs.slice(2)) { el.style.maskImage = mask; el.style.webkitMaskImage = mask; }
    gnd.style.width = `${Math.ceil(left + 24)}px`; gnd.style.height = `${Math.ceil(92 * sc)}px`; gnd.style.backgroundSize = `${(400 * sc).toFixed(1)}px ${(92 * sc).toFixed(1)}px`; }
  addEventListener('resize', reframe); new MutationObserver(reframe).observe(document.getElementById('menu'), { attributes: true, attributeFilter: ['data-page', 'style'] });
  flat.style.backgroundImage = `url(${DIR}title-bg-${big() ? '1688x780' : '844x390'}.webp)`;
  const st = { layers: false, moving: false, px: 0, py: 0, reduce: reduce.matches }; root.dataset.art = 'flat'; reframe(); requestAnimationFrame(reframe);
  const load = () => Promise.all(LAYERS.map(([n]) => { const i = new Image(); i.src = `${DIR}title-${n}-1688x780.webp`; return i.decode().then(() => i.src); }))
    .then(srcs => { lyrs.forEach((l, k) => { l.style.backgroundImage = `url(${srcs[k]})`; }); root.classList.add('layers'); st.layers = true; root.dataset.art = 'layers'; start(); })
    .catch(() => {}); // stay on the flattened picture
  const idle = cb => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 800));
  const later = () => idle(load); // reduced motion still gets the layers (the framed scene needs them), just never moving
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
  reduce.addEventListener?.('change', e => { st.reduce = e.matches; });
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { st.px = e.clientX / innerWidth * 2 - 1; st.py = e.clientY / innerHeight * 2 - 1; } }, { passive: true });
  let raf = 0, cx = 0, cy = 0; const t0 = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (root.style.display === 'none' || document.hidden) return;
    const t = (now - t0) / 1000, still = st.reduce;
    if (still) { if (st.moving) { for (const l of lyrs) l.style.transform = ''; gnd.style.transform = ''; cx = cy = 0; } st.moving = false; return; } // reduced motion: nothing moves
    // slow ambient drift (phones have no pointer) + eased mouse parallax; max offset stays inside the CSS overscan (28px); sky and clouds tile in x
    const tx = still ? 0 : Math.sin(t * 0.09) * 0.55 + st.px * 0.45, ty = still ? 0 : Math.sin(t * 0.07 + 1) * 0.15 + st.py * 0.2;
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06; st.moving = !still;
    for (let k = 0; k < LAYERS.length; k++) { const s = LAYERS[k][1]; lyrs[k].style.transform = `translate3d(${(-cx * 24 * s).toFixed(1)}px,${(-cy * 10 * s).toFixed(1)}px,0)`; }
    gnd.style.transform = lyrs[4].style.transform;
    if (!still) { const sc = st.cover; // clouds stay at background-size: cover
      st.drift = (Math.floor(t * DRIFT / 4) * 4) % 1688; lyrs[1].style.backgroundPositionX = `calc(50% + ${(st.drift * sc).toFixed(2)}px)`; }
  }
  function start() { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  return st;
}
