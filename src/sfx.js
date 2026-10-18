// WebAudio blips (no audio files): select, order ack, build done, train done.
// One AudioContext, created + resumed on the first touch/click/key (autoplay rules), a per-sound cooldown so a box-select
// or a burst of trained units cannot machine-gun, and the context is suspended while the tab is hidden.
// Render-side only: callers diff game state per frame, the deterministic sim is never touched.
const SOUNDS = { // [freq Hz, duration s, wave] notes played back to back
  select: { cd: 120, notes: [[880, 0.045, 'square']], vol: 0.05 },
  order: { cd: 160, notes: [[520, 0.04, 'triangle'], [780, 0.06, 'triangle']], vol: 0.08 },
  build: { cd: 700, notes: [[523, 0.08, 'triangle'], [659, 0.08, 'triangle'], [784, 0.14, 'triangle']], vol: 0.09 },
  train: { cd: 450, notes: [[660, 0.06, 'square'], [990, 0.09, 'square']], vol: 0.05 },
};
let ctx = null, muted = false; const last = {}; const played = { select: 0, order: 0, build: 0, train: 0 }; let skipped = 0;
export function unlock() {
  if (!ctx) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return false; ctx = new AC(); }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
  return true;
}
export function play(name) {
  const s = SOUNDS[name]; if (!s || !ctx || muted || document.hidden || ctx.state !== 'running') { skipped++; return false; }
  const now = performance.now(); if (now - (last[name] ?? -1e9) < s.cd) { skipped++; return false; } last[name] = now;
  let t = ctx.currentTime + 0.005;
  for (const [f, d, wave] of s.notes) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = wave; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(s.vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.9; }
  played[name]++; return true;
}
export function setMuted(m) { muted = !!m; }
export function stats() { return { hasContext: !!ctx, state: ctx ? ctx.state : 'none', played: { ...played }, skipped, muted }; }
let installed = false;
export function install() {
  if (installed) return; installed = true;
  const first = () => { if (unlock() && ctx.state !== 'suspended') for (const e of ['pointerdown', 'touchstart', 'keydown']) removeEventListener(e, first, true); };
  for (const e of ['pointerdown', 'touchstart', 'keydown']) addEventListener(e, first, true);
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); });
}
// per-frame watcher: selection change -> select, new order -> order ack, own building completed -> build, own unit count up -> train
let prev = null;
export function watch(world, me) {
  if (!world) { prev = null; return; }
  const sel = world.selection ? JSON.stringify(world.selection) : ''; const ord = world.lastOrder ? world.lastOrder.t + ':' + world.lastOrder.kind : '';
  let built = 0, units = 0; for (const b of world.buildings) if (b.owner === me && b.complete) built++; for (const u of world.units) if (u.owner === me) units++;
  if (prev && prev.world === world) {
    if (sel && sel !== prev.sel) play('select');
    if (ord && ord !== prev.ord) play('order');
    if (built > prev.built) play('build');
    if (units > prev.units) play('train');
  }
  prev = { world, sel, ord, built, units };
}
