// WebAudio blips (no audio files): select/order voice barks, build done, train done, plus quiet ambient beds (alive layer).
// One AudioContext, created + resumed on the first touch/click/key (autoplay rules), a per-sound cooldown so a box-select
// or a burst of trained units cannot machine-gun, and the context is suspended while the tab is hidden.
// Render-side only: callers diff game state per frame, the deterministic sim is never touched.
const SOUNDS = { // notes [freq Hz, duration s, wave, endFreq?] played back to back; select/order are short synthesized pup barks
  select: { cd: 120, notes: [[760, 0.05, 'square', 1180]], vol: 0.045 },
  order: { cd: 160, notes: [[540, 0.045, 'triangle', 820], [700, 0.07, 'triangle', 460]], vol: 0.08 },
  build: { cd: 700, notes: [[523, 0.08, 'triangle'], [659, 0.08, 'triangle'], [784, 0.14, 'triangle']], vol: 0.09 },
  train: { cd: 450, notes: [[660, 0.06, 'square'], [990, 0.09, 'square']], vol: 0.05 },
};
// voice pitch per unit family (select/order barks): small pups yip higher, riders and siege lower
const VOICE = { villager: 1.2, monk: 1.1, archer: 1.05, crossbowman: 1.0, militia: 0.95, spearman: 0.95, scout_cavalry: 0.85, knight: 0.78, trebuchet: 0.7 };
export const voicePitch = type => VOICE[type] || (/rider|knight|cav/.test(type || '') ? 0.82 : /guard|halberd|striker|fang|blade/.test(type || '') ? 0.92 : 1);
let ctx = null, muted = false; const last = {}; const played = { select: 0, order: 0, build: 0, train: 0 }; let skipped = 0;
export function unlock() {
  if (!ctx) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return false; ctx = new AC(); }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
  return true;
}
const ready = () => ctx && !muted && !document.hidden && ctx.state === 'running';
export function play(name, { pitch = 1 } = {}) {
  const s = SOUNDS[name]; if (!s || !ready()) { skipped++; return false; }
  const now = performance.now(); if (now - (last[name] ?? -1e9) < s.cd) { skipped++; return false; } last[name] = now;
  let t = ctx.currentTime + 0.005;
  for (const [f, d, wave, f2] of s.notes) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = wave; o.frequency.setValueAtTime(f * pitch, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2 * pitch, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(s.vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.9; }
  played[name]++; return true;
}
// ---- ambient beds (alive layer): quiet, long cooldowns, one at a time ----
const AMB = { birds: 14000, wind: 18000, rain: 16000, hammer: 9000, murmur: 20000 }; const ambLast = {}; let ambAny = -1e9; const ambPlayed = {};
let noise = null; const noiseBuf = () => { if (noise) return noise; noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noise; };
function noiseNode(t, dur, type, freq, q, env) { const src = ctx.createBufferSource(); src.buffer = noiseBuf(); src.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); for (const [dt, v] of env) g.gain.linearRampToValueAtTime(v, t + dt); src.connect(f).connect(g).connect(ctx.destination); src.start(t); src.stop(t + dur + 0.05); }
function tone(t, f, f2, d, wave, vol) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = wave; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02); }
export function ambient(name) {
  if (!AMB[name] || !ready()) return false; const now = performance.now();
  if (now - ambAny < 4500 || now - (ambLast[name] ?? -1e9) < AMB[name]) return false; ambAny = ambLast[name] = now; ambPlayed[name] = (ambPlayed[name] || 0) + 1;
  const t = ctx.currentTime + 0.02, r = Math.random;
  if (name === 'birds') { const n = 2 + (r() * 3 | 0), base = 2600 + r() * 900; for (let i = 0; i < n; i++) tone(t + i * (0.11 + r() * 0.06), base, base * (1.25 + r() * 0.3), 0.06, 'sine', 0.012); }
  else if (name === 'wind') noiseNode(t, 2.6, 'bandpass', 380 + r() * 200, 0.6, [[1.1, 0.022], [2.6, 0.0001]]);
  else if (name === 'rain') noiseNode(t, 3, 'highpass', 2500, 0.4, [[0.8, 0.012], [2.2, 0.012], [3, 0.0001]]);
  else if (name === 'hammer') for (let i = 0; i < 3; i++) { tone(t + i * 0.32, 210, 150, 0.05, 'triangle', 0.03); noiseNode(t + i * 0.32, 0.04, 'highpass', 3000, 0.7, [[0.004, 0.012], [0.04, 0.0001]]); }
  else if (name === 'murmur') noiseNode(t, 1.8, 'bandpass', 650, 1.4, [[0.3, 0.008], [0.6, 0.004], [0.9, 0.009], [1.3, 0.005], [1.8, 0.0001]]);
  return true;
}
export function setMuted(m) { muted = !!m; }
export function stats() { return { hasContext: !!ctx, state: ctx ? ctx.state : 'none', played: { ...played }, ambient: { ...ambPlayed }, skipped, muted }; }
let installed = false;
export function install() {
  if (installed) return; installed = true;
  const first = () => { if (unlock() && ctx.state !== 'suspended') for (const e of ['pointerdown', 'touchstart', 'keydown']) removeEventListener(e, first, true); };
  for (const e of ['pointerdown', 'touchstart', 'keydown']) addEventListener(e, first, true);
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); });
}
// per-frame watcher: selection change -> select bark, new order -> order bark, own building completed -> build, own unit count up -> train
let prev = null;
const selType = world => { const s = world.selection; const id = s && (s.kind === 'unit' ? s.id : s.ids && s.ids[0]); if (id == null) return null; const u = world.units.find(o => o.id === id); return u ? u.type : null; };
export function watch(world, me) {
  if (!world) { prev = null; return; }
  const sel = world.selection ? JSON.stringify(world.selection) : ''; const ord = world.lastOrder ? world.lastOrder.t + ':' + world.lastOrder.kind : '';
  let built = 0, units = 0; for (const b of world.buildings) if (b.owner === me && b.complete) built++; for (const u of world.units) if (u.owner === me) units++;
  if (prev && prev.world === world) {
    if (sel && sel !== prev.sel) play('select', { pitch: voicePitch(selType(world)) * (0.95 + Math.random() * 0.1) });
    if (ord && ord !== prev.ord) play('order', { pitch: voicePitch(selType(world)) * (0.95 + Math.random() * 0.1) });
    if (built > prev.built) play('build');
    if (units > prev.units) play('train');
  }
  prev = { world, sel, ord, built, units };
}
