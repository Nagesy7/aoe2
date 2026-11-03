// Pixel-art title backdrop + menu chrome (art/menu/*, original art, see /workspace/inu-shared/art/inu-empires-menu/README.md).
// Presentation only: never read by the sim. First screen = one flattened WebP sized for the viewport (42 KB on phones);
// the 5 parallax layers (sky/clouds/far/mid/front, ~75 KB) load after the page is idle and fade in over it. prefers-reduced-motion
// keeps the flattened, static picture. ?art=0 falls back to the procedural canvas title.
const DIR = new URL('../art/menu/', import.meta.url).href;
export const ART_ON = typeof location !== 'undefined' && !/[?&]art=0\b/.test(location.search);
export const artUrl = f => DIR + f;
const LAYERS = [['sky', 0.05], ['clouds', 0.15], ['far', 0.25], ['mid', 0.5], ['front', 1]]; // back -> front, parallax speed
const DRIFT = 8; // cloud drift in art px/s (1688-wide art), snapped to 4 art px steps so the pixels stay crisp
export function mountTitleArt(root) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)'), big = () => innerWidth > 900 && innerHeight > 520;
  root.innerHTML = `<div class="flat"></div>${LAYERS.map(([n]) => `<div class="lyr" data-l="${n}"></div>`).join('')}`;
  const flat = root.querySelector('.flat'), lyrs = [...root.querySelectorAll('.lyr')];
  flat.style.backgroundImage = `url(${DIR}title-bg-${big() ? '1688x780' : '844x390'}.webp)`;
  const st = { layers: false, moving: false, px: 0, py: 0, reduce: reduce.matches }; root.dataset.art = 'flat';
  const load = () => Promise.all(LAYERS.map(([n]) => { const i = new Image(); i.src = `${DIR}title-${n}-1688x780.webp`; return i.decode().then(() => i.src); }))
    .then(srcs => { lyrs.forEach((l, k) => { l.style.backgroundImage = `url(${srcs[k]})`; }); root.classList.add('layers'); st.layers = true; root.dataset.art = 'layers'; start(); })
    .catch(() => {}); // stay on the flattened picture
  const idle = cb => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 800));
  const later = () => idle(() => { if (!st.reduce) load(); });
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
  reduce.addEventListener?.('change', e => { st.reduce = e.matches; if (!e.matches && !st.layers) load(); });
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { st.px = e.clientX / innerWidth * 2 - 1; st.py = e.clientY / innerHeight * 2 - 1; } }, { passive: true });
  let raf = 0, cx = 0, cy = 0; const t0 = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (root.style.display === 'none' || document.hidden) return;
    const t = (now - t0) / 1000, still = st.reduce;
    // slow ambient drift (phones have no pointer) + eased mouse parallax; max offset stays inside the CSS overscan (28px); sky and clouds tile in x
    const tx = still ? 0 : Math.sin(t * 0.09) * 0.55 + st.px * 0.45, ty = still ? 0 : Math.sin(t * 0.07 + 1) * 0.15 + st.py * 0.2;
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06; st.moving = !still;
    for (let k = 0; k < LAYERS.length; k++) { const s = LAYERS[k][1]; lyrs[k].style.transform = `translate3d(${(-cx * 24 * s).toFixed(1)}px,${(-cy * 10 * s).toFixed(1)}px,0)`; }
    if (!still) { const box = lyrs[1].getBoundingClientRect(), sc = Math.max(box.width / 1688, box.height / 780); // background-size: cover scale
      st.drift = (Math.floor(t * DRIFT / 4) * 4) % 1688; lyrs[1].style.backgroundPositionX = `calc(50% + ${(st.drift * sc).toFixed(2)}px)`; }
  }
  function start() { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  return st;
}
