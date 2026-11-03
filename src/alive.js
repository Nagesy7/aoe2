// "Alive" layer: chatter, idle fidgets, ambient fauna, smoke/fire/dust/splash particles, light weather, day/night tint,
// ambient sound and town bustle. PRESENTATION ONLY (docs/ALIVE.md):
//  - never writes the world (per-unit visual state lives in Maps keyed by id; nothing is stored on sim objects);
//  - uses its own PRNG (vrand, seeded from Math.random), never the sim RNG;
//  - fauna, walkers and carts are not sim entities and cannot be selected or gathered;
//  - hard caps + pooled particles + off-screen culling + a low-power mode for phones.
const TILE = 32;
let seed = (Math.random() * 4294967296) >>> 0;
export const vrand = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const R = (a, b) => a + (b - a) * vrand(), pick = a => a[Math.floor(vrand() * a.length)];
const hash = (n, k) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(k + 1, 0xc2b2ae35); h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// Original Inu flavour lines (no franchise quotes; checked by tests/ip.test.mjs like the rest of src/).
export const LINES = {
  idle: ['Need a job…', 'Sniff sniff…', 'Any treats?', '*yawn*', 'Tail ready!', 'Who wants a task?', 'Nap time?', 'Paws are bored'],
  hit: ['Grr!', 'Arf! Help!', 'Hey, my fur!', 'Ow ow ow!', 'Bark back!'],
  age: ['New age, new tricks!', 'Awoo!', 'Tails up, clan!', 'Look how far we came!', 'Woof woof!'],
  built: ['Done! Woof!', 'Built with paws!', 'Good build!', 'Sturdy as a bone!', 'Ta-da!'],
  trained: ['Ready to fetch!', 'Reporting, paws on!', 'Fresh pup here!', 'Where to?', 'Ears up!'],
  folk: ['♪', '…', 'Nice day!', 'Bones on sale', 'Arf!', 'Sniff?'],
};
const EMOTES = { hit: '!', idle: '♪', sit: 'z', look: '?' };
const WORKING = new Set(['town_center', 'house', 'blacksmith', 'market', 'mill', 'monastery', 'university']);
const ART_H = { town_center: 192, house: 128, lumber_camp: 128, mining_camp: 128, mill: 128, barracks: 128, archery_range: 128, stable: 128, blacksmith: 128,
  market: 192, watch_tower: 96, castle: 192, monastery: 128, university: 128, wonder: 224 };
const CAPS = { full: { particles: 240, birds: 7, butterflies: 5, critters: 4, fish: 2, rain: 110, bubbles: 3, walkers: 8, clouds: 3 },
  low: { particles: 110, birds: 4, butterflies: 0, critters: 2, fish: 1, rain: 45, bubbles: 2, walkers: 4, clouds: 2 } };
const DAY = 480; // s per day/night cycle (visual clock)
function sprite(w, h, stops, blobs) { if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  for (const [x, y, r] of blobs) { const gr = g.createRadialGradient(x, y, 0, x, y, r); for (const [o, col] of stops) gr.addColorStop(o, col); g.fillStyle = gr; g.fillRect(0, 0, w, h); } return c; }

export function createAlive(opts = {}) {
  const store = (() => { try { return JSON.parse(localStorage.getItem('inu-alive') || '{}'); } catch { return {}; } })();
  const qp = opts.params || new URLSearchParams('');
  const S = { fx: store.fx !== false, weather: store.weather !== false, sound: store.sound !== false };
  if (qp.get('alive') === '0') S.fx = S.weather = false; if (qp.get('weather') === '0') S.weather = false;
  const phoneLandscape = () => typeof innerWidth !== 'undefined' && innerWidth > innerHeight && innerHeight <= 500 && (globalThis.matchMedia?.('(pointer:coarse)').matches || innerWidth <= 932);
  const st = { low: qp.get('lowfx') === '1' || phoneLandscape(), lowWhy: qp.get('lowfx') === '1' ? 'forced' : phoneLandscape() ? 'phone-landscape' : '', ema: 16, overT: 0, underT: 0,
    clock: DAY * 0.12, phaseOverride: null, rainOverride: null, frames: 0, counts: { bubbles: 0, particlesPeak: 0, emitted: 0, birds: 0, butterflies: 0, critters: 0, fishJumps: 0, walkers: 0, ambient: 0, events: {} } };
  const cap = () => CAPS[st.low ? 'low' : 'full'];
  // ---- particle pool ----
  const POOL = Array.from({ length: CAPS.full.particles }, () => ({ k: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, s: 1 })); let nP = 0;
  const K = { smoke: 1, dsmoke: 2, dust: 3, spark: 4, fire: 5, ring: 6, drop: 7 };
  function emit(k, x, y, vx, vy, life, s = 1) { if (nP >= cap().particles || !inView(x, y, 80)) return null; const p = POOL[nP++]; p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = 0; p.max = life; p.s = s; st.counts.emitted++; return p; }
  // ---- view (canvas px, world space) ----
  const view = { x: 0, y: 0, w: 1, h: 1 };
  const inView = (x, y, m = 0) => x >= view.x - m && y >= view.y - m && x <= view.x + view.w + m && y <= view.y + view.h + m;
  let world = null, fog = null, me = 'player', dt = 0;
  const visTile = (tx, ty) => { if (!world || tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return false; return !fog || !fog.visible || fog.visible[ty * world.width + tx] === 1; };
  const water = (tx, ty) => !!(world && world.water && tx >= 0 && ty >= 0 && tx < world.width && ty < world.height && world.water[ty * world.width + tx]);
  const blocked = (tx, ty) => { if (water(tx, ty)) return true; for (const b of world.buildings) if (tx >= b.x && ty >= b.y && tx < b.x + b.size && ty < b.y + b.size) return true; return false; };
  const randTileInView = () => ({ tx: Math.floor((view.x + vrand() * view.w) / TILE), ty: Math.floor((view.y + vrand() * view.h) / TILE) });
  // ---- per-unit visual state (keyed by id: never stored on sim objects) ----
  const U = new Map(); // id -> { idleT, pose, poseT, poseLen, lastHit, bubbleCd, dustT }
  const bubbles = []; let bubbleGate = 0;
  function say(u, text, { force = false, emote = false, dur = 2.4 } = {}) {
    const v = U.get(u.id) || {}; if (!force && (bubbleGate > 0 || (v.bubbleCd || 0) > 0)) return false;
    if (bubbles.length >= cap().bubbles) { if (!force) return false; bubbles.shift(); }
    bubbles.push({ id: u.id, text, t: 0, dur, emote, x: u.x, y: u.y }); v.bubbleCd = emote ? 4 : 14; U.set(u.id, v); bubbleGate = emote ? 0.5 : 1.5; st.counts.bubbles++; return true; }
  // ---- fauna / bustle / weather state ----
  const burning = []; // flat x,y pairs of fire spots this frame (glow under the flames)
  const birds = [], butterflies = [], critters = [], fishes = [], walkers = [], clouds = [], drops = [];
  const W = { rain: 0, rainTarget: 0, next: R(70, 160), wind: 0.3, gust: 0, gustT: 0 };
  let ambT = 2, fishT = 3, birdT = 1.5, prevAge = null, prevComplete = null, prevUnits = null, firstFrame = true, lastWorld = null;
  const glow = sprite(64, 64, [[0, 'rgba(255,200,110,0.9)'], [0.4, 'rgba(255,170,70,0.35)'], [1, 'rgba(255,150,50,0)']], [[32, 32, 32]]);
  const cloudSpr = sprite(256, 150, [[0, 'rgba(10,20,30,0.55)'], [0.6, 'rgba(10,20,30,0.25)'], [1, 'rgba(10,20,30,0)']], [[90, 80, 70], [150, 70, 80], [200, 85, 55], [125, 95, 60]]);

  function reset(w) { U.clear(); bubbles.length = 0; birds.length = butterflies.length = critters.length = fishes.length = walkers.length = clouds.length = drops.length = 0; nP = 0;
    prevAge = w.age; prevComplete = new Set(w.buildings.filter(b => b.complete).map(b => b.id)); prevUnits = new Set(w.units.map(u => u.id)); firstFrame = true; st.clock = DAY * 0.12; }

  // ===== update: called once per rendered frame from main.js (never from the sim) =====
  function update(w, cam, canvas, f, realDt) {
    if (!w) return; if (w !== lastWorld) { lastWorld = w; reset(w); }
    world = w; fog = f; me = w.viewer || 'player'; dt = Math.min(0.1, realDt); st.frames++;
    view.x = cam.x; view.y = cam.y; view.w = canvas.width; view.h = canvas.height;
    // low-power auto: smoothed frame time over budget -> low; recover only off-phone after a calm stretch
    st.ema += (realDt * 1000 - st.ema) * 0.05;
    if (st.lowWhy !== 'forced') { if (st.ema > 24) { st.overT += realDt; st.underT = 0; if (st.overT > 2 && !st.low) { st.low = true; st.lowWhy = 'frame-time'; } }
      else if (st.ema < 15) { st.underT += realDt; st.overT = 0; if (st.low && st.underT > 8 && !phoneLandscape()) { st.low = false; st.lowWhy = ''; } } }
    st.clock += dt;
    if (!S.fx && !S.weather) { nP = 0; bubbles.length = 0; return; }
    if (S.weather) weather();
    if (S.fx) { events(); units(); buildings(); fauna(); bustle(); }
    if (S.fx) ambientSound();
    // particles
    for (let i = 0; i < nP; i++) { const p = POOL[i]; p.life += dt;
      if (p.life >= p.max) { const q = POOL[--nP]; POOL[nP] = p; POOL[i] = q; i--; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === K.spark || p.k === K.drop) p.vy += 220 * dt; if (p.k === K.smoke || p.k === K.dsmoke) p.vx += (W.wind * 14 - p.vx) * dt * 0.5; }
    st.counts.particlesPeak = Math.max(st.counts.particlesPeak, nP);
    bubbleGate -= dt; for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.t += dt; const u = w.units.find(o => o.id === b.id); if (u) { b.x = u.x; b.y = u.y; } if (b.t > b.dur || (!u && !b.folk)) bubbles.splice(i, 1); }
    for (const v of U.values()) if (v.bubbleCd > 0) v.bubbleCd -= dt;
  }
  function events() {
    const w = world, mine = w.units.filter(u => u.owner === me), onScr = u => inView(u.x * TILE, u.y * TILE, -20);
    if (prevAge !== w.age && prevAge != null) { let n = 0; for (const u of mine) if (onScr(u) && n < 3 && say(u, pick(LINES.age), { force: true, dur: 3 })) n++; st.counts.events.age = (st.counts.events.age || 0) + 1; burst(); }
    prevAge = w.age;
    const comp = new Set(); for (const b of w.buildings) if (b.complete) comp.add(b.id);
    for (const b of w.buildings) if (b.complete && !prevComplete.has(b.id) && !firstFrame) { const cx = (b.x + b.size / 2) * TILE, by = (b.y + b.size) * TILE;
      for (let i = 0; i < 10; i++) emit(K.dust, cx + R(-b.size, b.size) * 14, by - R(0, 6), R(-30, 30), R(-26, -6), R(0.5, 0.9), R(2, 4));
      if (b.owner === me) { const v = mine.filter(u => u.type === 'villager' && onScr(u)).sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0]; if (v && say(v, pick(LINES.built), { force: true })) st.counts.events.built = (st.counts.events.built || 0) + 1; } }
    prevComplete = comp;
    const ids = new Set(); for (const u of w.units) ids.add(u.id);
    if (!firstFrame) for (const u of mine) if (!prevUnits.has(u.id) && onScr(u) && vrand() < 0.6) { if (say(u, pick(LINES.trained))) st.counts.events.trained = (st.counts.events.trained || 0) + 1; }
    prevUnits = ids; firstFrame = false;
  }
  function burst() { for (let i = 0; i < 18; i++) emit(K.spark, view.x + view.w / 2 + R(-120, 120), view.y + view.h / 2 + R(-60, 40), R(-60, 60), R(-160, -60), R(0.6, 1.1), 2); }
  // idle fidgets, chatter, hit reactions, walk/build dust
  function units() {
    const w = world; let dustBudget = st.low ? 2 : 5;
    for (const u of w.units) { if (u.state === 'garrisoned') continue; const px = u.x * TILE, py = u.y * TILE; if (!inView(px, py, 40)) continue;
      if (fog && u.owner !== me && fog.sees && !fog.sees(u)) continue;
      let v = U.get(u.id); if (!v) { v = { idleT: 0, pose: null, poseT: 0, poseLen: 0, lastHit: u.lastHitAt ?? null, bubbleCd: R(2, 8), dustT: R(0, 0.3), cd: R(1, 4) }; U.set(u.id, v); }
      const moving = (u.path && u.path.length) || u.state === 'moving' || (u.state || '').startsWith('to_');
      const idle = !moving && u.state === 'idle';
      if (u.lastHitAt != null && u.lastHitAt !== v.lastHit) { v.lastHit = u.lastHitAt; if (u.owner === me) { if (!(vrand() < 0.3 && say(u, pick(LINES.hit)))) say(u, '!', { emote: true, dur: 0.9 }); st.counts.events.hit = (st.counts.events.hit || 0) + 1; } }
      if (idle) { v.idleT += dt; v.cd -= dt;
        if (v.pose) { v.poseT += dt; if (v.poseT > v.poseLen) v.pose = null; }
        else if (v.cd <= 0) { v.pose = pick(['look', 'look', 'sit', 'scratch', 'wag', 'wag', 'hop']); v.poseT = 0; v.poseLen = v.pose === 'sit' ? R(3, 6) : v.pose === 'look' ? R(1.2, 2.2) : R(0.8, 1.6); v.cd = R(2.5, 6);
          if (v.pose === 'sit' && u.owner === me && v.idleT > 10 && vrand() < 0.3) say(u, 'z', { emote: true, dur: 1.6 }); }
        if (u.owner === me && u.type === 'villager' && v.idleT > 9 && vrand() < dt * 0.08) say(u, pick(LINES.idle)); }
      else { v.idleT = 0; v.pose = null; }
      if (moving && dustBudget > 0) { v.dustT -= dt; if (v.dustT <= 0) { v.dustT = R(0.25, 0.45); dustBudget--; emit(K.dust, px + R(-4, 4), py + 6, R(-12, 12), R(-14, -4), R(0.35, 0.6), R(1.5, 3)); } }
      if (u.state === 'building' && dustBudget > 0 && vrand() < dt * 2.5) { dustBudget--; const b = w.buildings.find(o => o.id === u.build); if (b) emit(K.dust, (b.x + R(0, b.size)) * TILE, (b.y + b.size) * TILE - R(0, 8), R(-20, 20), R(-30, -8), R(0.4, 0.8), R(2, 3.5)); }
      if (u.state === 'gathering' && vrand() < dt * 0.5) { const n = w.resources.find(r => r.id === u.target); if (n && n.kind === 'fish') splash(n.x * TILE + R(-6, 6), n.y * TILE + R(-3, 3), 0.7); }
    }
    if (U.size > 600) for (const id of U.keys()) if (!w.units.some(u => u.id === id)) U.delete(id);
  }
  function splash(x, y, s = 1) { const p = emit(K.ring, x, y, 0, 0, R(0.5, 0.8), s); if (!p) return; for (let i = 0; i < 3 * s; i++) emit(K.drop, x, y, R(-25, 25), R(-70, -40), R(0.3, 0.5), 1.5); }
  const roofOf = b => { const left = b.x * TILE, s = b.size * TILE, bottom = (b.y + b.size) * TILE, h = ART_H[b.type] || s * 2; return { left, s, bottom, top: bottom - h, h }; };
  function buildings() {
    const w = world; burning.length = 0;
    for (const b of w.buildings) { if (!b.complete || b.type === 'farm') continue; const g = roofOf(b); if (g.left > view.x + view.w + 40 || g.left + g.s < view.x - 40 || g.bottom < view.y - 40 || g.top > view.y + view.h + 60) continue;
      if (fog && fog.sees && !fog.sees(b)) continue;
      const working = WORKING.has(b.type) || (b.queue && b.queue.length);
      if (working && vrand() < dt * (st.low ? 1.2 : 2.4)) emit(K.smoke, g.left + g.s * 0.74 + R(-2, 2), g.top + 12, R(-4, 4), R(-22, -14), R(1.8, 2.8), R(3, 5));
      if (b.type === 'blacksmith' && vrand() < dt * 3) emit(K.spark, g.left + g.s / 2 + R(-8, 8), g.bottom - 16, R(-40, 40), R(-90, -40), R(0.3, 0.6), 1.5);
      const hp = b.hp / b.maxHp; if (hp < 0.66) { const n = hp < 0.33 ? 3 : 2; if (burning.length < 12) for (let i = 0; i < n; i++) burning.push(g.left + 8 + hash(b.id, i) * (g.s - 16), g.top + g.h * (0.35 + hash(b.id, i + 7) * 0.45));
        for (let i = 0; i < n; i++) if (vrand() < dt * (st.low ? 5 : 9)) { const fx = g.left + 8 + hash(b.id, i) * (g.s - 16), fy = g.top + g.h * (0.35 + hash(b.id, i + 7) * 0.45);
          emit(K.fire, fx + R(-4, 4), fy, R(-6, 6), R(-40, -24), R(0.45, 0.8), R(5, 8)); if (vrand() < 0.25) emit(K.dsmoke, fx, fy - 10, R(-5, 5), R(-26, -16), R(1.4, 2.2), R(4, 6)); } } }
  }
  function fauna() {
    const c = cap(), w = world, dayK = daylight();
    // birds: fly across, sometimes land and hop, flee from units
    birdT -= dt * Math.max(0.15, dayK); if (birds.length < c.birds && birdT <= 0) { birdT = R(2.5, 6); const fromL = vrand() < 0.5, n = 1 + Math.floor(R(0, 3)), y0 = view.y + R(0.1, 0.8) * view.h;
      for (let i = 0; i < n && birds.length < c.birds; i++) { const land = vrand() < 0.45 ? randTileInView() : null; const ok = land && !blocked(land.tx, land.ty) && visTile(land.tx, land.ty);
        birds.push({ x: fromL ? view.x - 30 - i * 14 : view.x + view.w + 30 + i * 14, y: y0 + i * 8, vx: (fromL ? 1 : -1) * R(70, 100), vy: R(-8, 8), t: R(0, 6), mode: 'fly',
          land: ok ? { x: (land.tx + R(0.2, 0.8)) * TILE, y: (land.ty + R(0.2, 0.8)) * TILE } : null, rest: R(3, 8), col: pick(['#3a3a44', '#5a4030', '#e8e4d8']) }); st.counts.birds++; } }
    for (let i = birds.length - 1; i >= 0; i--) { const b = birds[i]; b.t += dt;
      if (b.mode === 'fly') { if (b.land) { const dx = b.land.x - b.x, dy = b.land.y - b.y, d = Math.hypot(dx, dy); if (d < 6) { b.mode = 'ground'; b.gt = 0; } else { const sp = Math.min(110, 30 + d); b.vx += (dx / d * sp - b.vx) * dt * 2; b.vy += (dy / d * sp - b.vy) * dt * 2; } }
        b.x += b.vx * dt; b.y += b.vy * dt + Math.sin(b.t * 3) * 0.3; }
      else { b.gt += dt; if (vrand() < dt * 1.5) { b.x += R(-6, 6); b.hop = 0.25; } b.hop = Math.max(0, (b.hop || 0) - dt);
        const near = w.units.some(u => Math.abs(u.x * TILE - b.x) < 48 && Math.abs(u.y * TILE - b.y) < 48);
        if (near || b.gt > b.rest) { b.mode = 'fly'; b.land = null; b.vx = (vrand() < 0.5 ? -1 : 1) * R(80, 110); b.vy = R(-60, -30); } }
      if (!inView(b.x, b.y, 300)) birds.splice(i, 1); }
    // butterflies (not in low-power): flutter around a grass anchor in view
    if (butterflies.length < c.butterflies && dayK > 0.5 && vrand() < dt * 0.3) { const t = randTileInView(); if (!blocked(t.tx, t.ty) && visTile(t.tx, t.ty)) { butterflies.push({ ax: (t.tx + 0.5) * TILE, ay: (t.ty + 0.5) * TILE, t: R(0, 9), life: 0, max: R(10, 18), col: pick(['#f4f0f8', '#f8d040', '#f0a0c8', '#a0c8f8']) }); st.counts.butterflies++; } }
    for (let i = butterflies.length - 1; i >= 0; i--) { const b = butterflies[i]; b.t += dt; b.life += dt; if (b.life > b.max || !inView(b.ax, b.ay, 200) || butterflies.length > c.butterflies) butterflies.splice(i, 1); }
    // fish jumps in visible water
    fishT -= dt; if (fishT <= 0) { fishT = R(2.5, 6); if (fishes.length < c.fish && w.water) { // pick among visible water tiles in view (scan is ~1-2k cells, every few seconds)
        const x0 = Math.max(0, Math.floor(view.x / TILE)), y0 = Math.max(0, Math.floor(view.y / TILE)), x1 = Math.min(w.width - 1, Math.floor((view.x + view.w) / TILE)), y1 = Math.min(w.height - 1, Math.floor((view.y + view.h) / TILE));
        let n = 0, pickT = null; for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (w.water[ty * w.width + tx] && water(tx + 1, ty) && water(tx - 1, ty) && visTile(tx, ty) && vrand() < 1 / ++n) pickT = { tx, ty };
        if (pickT) { const x = (pickT.tx + 0.5) * TILE, y = (pickT.ty + 0.5) * TILE; fishes.push({ x, y, d: vrand() < 0.5 ? -1 : 1, t: 0, dur: 0.75 }); splash(x, y, 0.8); st.counts.fishJumps++; } } }
    for (let i = fishes.length - 1; i >= 0; i--) { const f = fishes[i]; f.t += dt; if (f.t >= f.dur) { splash(f.x + f.d * 18, f.y, 0.8); fishes.splice(i, 1); } }
    // critters: rabbits and deer graze away from units and flee when approached
    if (critters.length < c.critters && vrand() < dt * 0.12 * (0.4 + dayK)) { const t = randTileInView(); const x = (t.tx + 0.5) * TILE, y = (t.ty + 0.5) * TILE;
      if (!blocked(t.tx, t.ty) && visTile(t.tx, t.ty) && !w.units.some(u => Math.hypot(u.x * TILE - x, u.y * TILE - y) < 4 * TILE) && !w.buildings.some(b => Math.hypot((b.x + b.size / 2) * TILE - x, (b.y + b.size / 2) * TILE - y) < (b.size / 2 + 3) * TILE)) {
        const deer = vrand() < 0.35; critters.push({ x, y, deer, vx: 0, vy: 0, t: 0, a: 0, life: 0, max: R(35, 60), flee: 0, dir: vrand() < 0.5 ? -1 : 1, wt: R(1, 3) }); st.counts.critters++; } }
    for (let i = critters.length - 1; i >= 0; i--) { const k = critters[i]; k.life += dt; k.t += dt; k.wt -= dt;
      const th = w.units.find(u => Math.hypot(u.x * TILE - k.x, u.y * TILE - k.y) < 2.6 * TILE);
      if (th) { const dx = k.x - th.x * TILE, dy = k.y - th.y * TILE, d = Math.hypot(dx, dy) || 1, sp = k.deer ? 110 : 90; k.vx = dx / d * sp; k.vy = dy / d * sp; k.flee = 1.2; }
      else if (k.flee > 0) k.flee -= dt; else if (k.wt <= 0) { k.wt = R(1.5, 4); if (vrand() < 0.5) { k.vx = 0; k.vy = 0; } else { const a = R(0, 6.28), sp = k.deer ? 18 : 24; k.vx = Math.cos(a) * sp; k.vy = Math.sin(a) * sp; } }
      const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt; if (!blocked(Math.floor(nx / TILE), Math.floor(ny / TILE))) { k.x = nx; k.y = ny; } else { k.vx = -k.vx; k.vy = -k.vy; }
      if (k.vx) k.dir = k.vx < 0 ? -1 : 1; k.a = Math.min(1, k.life) * Math.min(1, (k.max - k.life)); if (k.life > k.max || !inView(k.x, k.y, 260)) critters.splice(i, 1); }
  }
  // decorative townsfolk + carts: count grows with population and buildings (own complete buildings only)
  function bustle() {
    const w = world, mine = w.buildings.filter(b => b.owner === me && b.complete && b.type !== 'farm'), pop = w.units.filter(u => u.owner === me).length;
    const want = Math.max(0, Math.min(cap().walkers, Math.floor((pop - 6) / 5) + Math.floor(mine.length / 3) - 1)); st.bustleTarget = want;
    if (walkers.length < want && mine.length >= 2 && vrand() < dt * 0.6) { const a = pick(mine), near = mine.filter(b => b !== a && Math.hypot(b.x - a.x, b.y - a.y) < 16), b = near.length ? pick(near) : null;
      if (b) { const door = o => ({ x: (o.x + o.size / 2) * TILE, y: (o.y + o.size) * TILE + 8 }); const s = door(a), e = door(b);
        walkers.push({ x: s.x, y: s.y, path: [{ x: e.x, y: s.y }, e], cart: vrand() < 0.3, t: R(0, 5), a: 0, done: 0, fur: pick(['#d4853a', '#ece4d4', '#4a3426', '#c9612c', '#b8743c']), id: -1 - Math.floor(vrand() * 1e9) }); st.counts.walkers++; } }
    for (let i = walkers.length - 1; i >= 0; i--) { const k = walkers[i]; k.t += dt;
      if (k.path.length) { const q = k.path[0], dx = q.x - k.x, dy = q.y - k.y, d = Math.hypot(dx, dy), sp = k.cart ? 22 : 30; if (d < 2) k.path.shift(); else { k.x += dx / d * Math.min(d, sp * dt); k.y += dy / d * Math.min(d, sp * dt); k.dir = Math.abs(dx) > 0.5 ? Math.sign(dx) : k.dir || 1; } k.a = Math.min(1, k.a + dt * 2); }
      else { k.done += dt; if (k.done > 1.5) k.a -= dt * 2; }
      if (!k.path.length && k.a <= 0 || walkers.length > want + 1 && k.a <= 0.05) walkers.splice(i, 1);
      else if (!st.low && inView(k.x, k.y, -30) && vrand() < dt * 0.03 && bubbleGate <= 0 && bubbles.length < cap().bubbles) { bubbles.push({ id: k.id, folk: k, text: pick(LINES.folk), t: 0, dur: 1.6, x: k.x / TILE, y: k.y / TILE }); bubbleGate = 1.5; } }
    for (const b of bubbles) if (b.folk) { b.x = b.folk.x / TILE; b.y = b.folk.y / TILE; }
  }
  function weather() {
    W.next -= dt; if (W.next <= 0) { if (W.rainTarget > 0) { W.rainTarget = 0; W.next = R(120, 240); } else { W.rainTarget = R(0.5, 1); W.next = R(35, 65); } }
    const tgt = st.rainOverride != null ? st.rainOverride : W.rainTarget; W.rain += (tgt - W.rain) * Math.min(1, dt * 0.4);
    W.gustT -= dt; if (W.gustT <= 0) { W.gustT = R(6, 14); W.gust = R(0.4, 1); } W.gust = Math.max(0, W.gust - dt * 0.12); W.wind = 0.25 + W.gust * 0.75 + W.rain * 0.3;
    const c = cap();
    while (clouds.length < c.clouds) clouds.push({ x: view.x + R(-200, view.w), y: view.y + R(-100, view.h), s: R(1.4, 2.4) }); if (clouds.length > c.clouds) clouds.length = c.clouds;
    for (const cl of clouds) { cl.x += (8 + W.wind * 14) * dt; cl.y += 2 * dt; const wpx = 256 * cl.s;
      if (cl.x > view.x + view.w + 40 || cl.y > view.y + view.h + 200 || cl.x + wpx < view.x - 600 || cl.y < view.y - 900) { cl.x = view.x - wpx - R(0, 120); cl.y = view.y + R(-120, view.h); } }
    const nDrops = Math.round(c.rain * W.rain); while (drops.length < nDrops) drops.push({ x: R(0, view.w), y: R(0, view.h), l: R(10, 16), v: R(380, 480) }); if (drops.length > nDrops) drops.length = nDrops;
    for (const d of drops) { d.y += d.v * dt; d.x += W.wind * 60 * dt; if (d.y > view.h) { d.y = R(-20, 0); d.x = R(-40, view.w); } }
    if (W.rain > 0.15) for (let i = 0; i < (st.low ? 1 : 2); i++) if (vrand() < W.rain) { const t = randTileInView(), x = (t.tx + vrand()) * TILE, y = (t.ty + vrand()) * TILE; if (water(t.tx, t.ty)) emit(K.ring, x, y, 0, 0, 0.6, 0.5); else if (vrand() < 0.3) emit(K.drop, x, y, R(-10, 10), R(-30, -15), 0.25, 1); }
  }
  // 0 = noon light, phase in [0,1): 0..0.55 day, ..0.65 dusk, ..0.9 night, ..1 dawn
  const phase = () => st.phaseOverride != null ? st.phaseOverride : (st.clock / DAY) % 1;
  function tint() { const p = phase(); // returns { r,g,b,a, night 0..1 }
    if (p < 0.55) return { c: [0, 0, 0], a: 0, night: 0 };
    if (p < 0.65) { const k = (p - 0.55) / 0.1; return { c: [255, 120, 50], a: 0.13 * Math.sin(k * Math.PI) + 0.0, night: Math.max(0, k - 0.5) * 2 * 0.4, dusk: k }; }
    if (p < 0.9) { const k = Math.min(1, (p - 0.65) / 0.05, (0.9 - p) / 0.05); return { c: [18, 28, 78], a: 0.28 * Math.max(0.4, k), night: Math.max(0.4, k) }; }
    const k = (p - 0.9) / 0.1; return { c: [255, 170, 120], a: 0.1 * Math.sin(k * Math.PI), night: Math.max(0, 0.4 - k) }; }
  const daylight = () => S.weather ? 1 - tint().night * 0.8 - W.rain * 0.5 : 1;
  function ambientSound() { ambT -= dt; if (ambT > 0 || !opts.sfx || !S.sound) return; ambT = R(4, 7);
    const w = world, c = [];
    if (daylight() > 0.6 && (birds.length || !st.low)) c.push('birds');
    if (S.weather && (W.wind > 0.7 || W.rain > 0.3)) c.push(W.rain > 0.3 ? 'rain' : 'wind');
    if (w.units.some(u => u.state === 'building' && inView(u.x * TILE, u.y * TILE))) c.push('hammer');
    if (w.buildings.some(b => b.type === 'market' && b.complete && inView((b.x + 2) * TILE, (b.y + 2) * TILE))) c.push('murmur');
    if (c.length && opts.sfx.ambient(pick(c))) st.counts.ambient++; }

  // ===== drawing =====
  // idle pose transform for a unit (render.js applies it around the unit's feet). null = draw normally.
  function pose(u, act) { if (!S.fx || !act || act.motion !== 'idle') return null; const v = U.get(u.id); if (!v || !v.pose) return null; const k = v.poseT / v.poseLen, e = Math.sin(Math.min(1, k) * Math.PI);
    switch (v.pose) {
      case 'look': return { sx: k > 0.3 && k < 0.75 ? -1 : 1, sy: 1, rot: 0, dy: 0 };
      case 'sit': return { sx: 1, sy: 1 - 0.14 * Math.min(1, v.poseT * 4, (v.poseLen - v.poseT) * 4), rot: 0, dy: 0 };
      case 'scratch': return { sx: 1, sy: 1, rot: Math.sin(v.poseT * 40) * 0.06 * e, dy: 0 };
      case 'wag': return { sx: 1, sy: 1, rot: Math.sin(v.poseT * 22) * 0.07, dy: 0 };
      case 'hop': return { sx: 1, sy: 1, rot: 0, dy: Math.abs(Math.sin(v.poseT * 7)) * 4 * e };
    } return null; }
  const sway = n => S.weather && n ? Math.sin(st.clock * (1.6 + W.wind) + n.x * 0.7 + n.y * 0.3) * (0.6 + W.wind * 1.8) : 0;
  function drawWorld(ctx) {
    if (!world) return;
    if (S.weather && cloudSpr) { ctx.globalAlpha = 0.11 + W.rain * 0.08; for (const cl of clouds) ctx.drawImage(cloudSpr, cl.x, cl.y, 256 * cl.s, 150 * cl.s); ctx.globalAlpha = 1; }
    if (!S.fx) return;
    if (glow && burning.length) { ctx.globalCompositeOperation = 'lighter'; const fl = 0.75 + Math.sin(st.clock * 13) * 0.12 + Math.sin(st.clock * 31) * 0.08;
      for (let i = 0; i < burning.length; i += 2) { ctx.globalAlpha = 0.5 * fl; ctx.drawImage(glow, burning[i] - 22, burning[i + 1] - 26, 44, 44); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    // critters
    for (const k of critters) { if (!inView(k.x, k.y, 20)) continue; ctx.globalAlpha = Math.max(0, k.a); const x = Math.round(k.x), moving = k.vx || k.vy, hop = moving && !k.deer ? Math.abs(Math.sin(k.t * 12)) * 3 : 0, y = Math.round(k.y - hop), d = k.dir;
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x - 5, Math.round(k.y) + 3, 10, 2);
      if (k.deer) { const leg = moving ? Math.sin(k.t * 10) * 2 : 0; ctx.fillStyle = '#8a5a30'; ctx.fillRect(x - 7, y - 10, 13, 6); ctx.fillStyle = '#6a4020'; ctx.fillRect(x - 6 + leg, y - 4, 2, 7); ctx.fillRect(x + 3 - leg, y - 4, 2, 7);
        const graze = !moving && Math.sin(k.t * 0.8 + x) > 0.3; ctx.fillStyle = '#8a5a30'; ctx.fillRect(x + d * 6 - (d < 0 ? 3 : 0), graze ? y - 6 : y - 16, 4, graze ? 4 : 7); ctx.fillStyle = '#f0e6d0'; ctx.fillRect(x - d * 7 - (d > 0 ? 2 : 0), y - 10, 2, 3);
        ctx.fillStyle = '#5a3a1a'; if (!graze) { ctx.fillRect(x + d * 7, y - 20, 1, 4); ctx.fillRect(x + d * 5, y - 20, 1, 3); } }
      else { ctx.fillStyle = '#9a8a74'; ctx.fillRect(x - 4, y - 5, 8, 5); ctx.fillRect(x + d * 3 - 1, y - 8, 3, 4); ctx.fillStyle = '#7a6a56'; ctx.fillRect(x + d * 3, y - 12, 1, 4); ctx.fillRect(x + d * 4 - (d < 0 ? 1 : 0), y - 12, 1, 4); ctx.fillStyle = '#f4f0e8'; ctx.fillRect(x - d * 4 - (d > 0 ? 2 : 0), y - 4, 2, 2); } }
    ctx.globalAlpha = 1;
    // walkers + carts (smaller, neutral colours: clearly not your units)
    for (const k of walkers) { if (!inView(k.x, k.y, 30)) continue; ctx.globalAlpha = Math.max(0, Math.min(0.92, k.a)); const x = Math.round(k.x), moving = k.path.length > 0, ph = moving ? k.t * 10 : 0, y = Math.round(k.y - (moving ? Math.abs(Math.sin(ph)) : 0)), d = k.dir || 1;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 5, Math.round(k.y) + 1, k.cart ? 22 : 10, 2);
      if (k.cart) { const cx = x - d * 14; ctx.fillStyle = '#7a5428'; ctx.fillRect(cx - 7, y - 9, 14, 6); ctx.fillStyle = '#c8a050'; ctx.fillRect(cx - 6, y - 12, 12, 3); ctx.fillStyle = '#3a2410'; ctx.beginPath(); ctx.arc(cx - 4, y - 2, 2.5, 0, 7); ctx.arc(cx + 4, y - 2, 2.5, 0, 7); ctx.fill(); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(Math.min(cx, x) + 4, y - 7, Math.abs(x - cx) - 6, 1); }
      ctx.fillStyle = k.fur; ctx.fillRect(x - 2 + Math.round(Math.sin(ph) * 1.5), y - 3, 2, 4); ctx.fillRect(x + 1 - Math.round(Math.sin(ph) * 1.5), y - 3, 2, 4); ctx.fillRect(x - 3, y - 10, 7, 7);
      ctx.fillStyle = '#8a7a5c'; ctx.fillRect(x - 3, y - 8, 7, 3); ctx.fillStyle = k.fur; ctx.fillRect(x - 2 + d, y - 15, 6, 5); ctx.fillRect(x - 1 + d, y - 17, 1, 2); ctx.fillRect(x + 2 + d, y - 17, 1, 2);
      ctx.fillStyle = '#1a1010'; ctx.fillRect(x + (d > 0 ? 4 : -2), y - 13, 1, 1); const wag = Math.sin(k.t * 14) > 0 ? 1 : 0; ctx.fillStyle = k.fur; ctx.fillRect(x - d * 5 - (d > 0 ? 0 : 1), y - 11 - wag, 2, 3); }
    ctx.globalAlpha = 1;
    // butterflies
    for (const b of butterflies) { const x = b.ax + Math.sin(b.t * 0.9) * 22 + Math.sin(b.t * 2.3) * 6, y = b.ay + Math.cos(b.t * 0.7) * 14 - 10 + Math.sin(b.t * 3.1) * 4; if (!inView(x, y, 10)) continue;
      const f = Math.abs(Math.sin(b.t * 18)) * 2.2 + 0.4; ctx.globalAlpha = Math.min(1, b.life, b.max - b.life); ctx.fillStyle = b.col; ctx.fillRect(Math.round(x - f - 1), Math.round(y - 1), Math.round(f), 2); ctx.fillRect(Math.round(x + 1), Math.round(y - 1), Math.round(f), 2); ctx.fillStyle = '#222'; ctx.fillRect(Math.round(x), Math.round(y - 1), 1, 3); }
    ctx.globalAlpha = 1;
    // jumping fish
    for (const f of fishes) { const k = f.t / f.dur, x = f.x + f.d * 18 * k, y = f.y - Math.sin(k * Math.PI) * 16; ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(f.d * (k - 0.5) * 1.6); ctx.fillStyle = '#c8d4e0'; ctx.fillRect(-5, -2, 10, 4); ctx.fillStyle = '#7f9fbf'; ctx.fillRect(-5, -2, 10, 1); ctx.fillStyle = '#e88a3a'; ctx.fillRect(-f.d * 6 - 1, -2, 2, 4); ctx.restore(); }
    // particles
    for (let i = 0; i < nP; i++) { const p = POOL[i]; if (!inView(p.x, p.y, 20)) continue; const k = p.life / p.max;
      switch (p.k) {
        case K.smoke: case K.dsmoke: { const r = p.s * (1 + k * 1.6); ctx.globalAlpha = (p.k === K.smoke ? 0.32 : 0.45) * (1 - k) * Math.min(1, k * 6); ctx.fillStyle = p.k === K.smoke ? '#d8d4cc' : '#2a2420'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); break; }
        case K.dust: ctx.globalAlpha = 0.45 * (1 - k); ctx.fillStyle = '#c8b088'; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 + k), 0, 7); ctx.fill(); break;
        case K.spark: ctx.globalAlpha = 1 - k; ctx.fillStyle = k < 0.4 ? '#fff0a0' : '#ff9030'; ctx.fillRect(p.x, p.y, p.s, p.s); break;
        case K.fire: { const r = p.s * (1 - k * 0.7); ctx.globalAlpha = 0.85 * (1 - k * 0.6); ctx.fillStyle = k < 0.3 ? '#fff2a0' : k < 0.6 ? '#ffa030' : '#e04818'; ctx.beginPath(); ctx.moveTo(p.x - r, p.y); ctx.quadraticCurveTo(p.x, p.y - r * 3, p.x + r, p.y); ctx.fill(); break; }
        case K.ring: ctx.globalAlpha = 0.7 * (1 - k); ctx.strokeStyle = '#e8f4ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, 2 + k * 9 * p.s, (2 + k * 9 * p.s) * 0.45, 0, 0, 7); ctx.stroke(); break;
        case K.drop: ctx.globalAlpha = 0.8 * (1 - k); ctx.fillStyle = '#d8ecff'; ctx.fillRect(p.x, p.y, 1.5, 1.5); break; } }
    ctx.globalAlpha = 1;
    // birds (on top: they fly over)
    for (const b of birds) { if (!inView(b.x, b.y, 10)) continue; const x = Math.round(b.x), y = Math.round(b.y - (b.hop ? 2 : 0));
      if (b.mode === 'fly') { const f = Math.sin(b.t * 14) > 0 ? -2 : 1; ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x - 2, y + 22, 4, 1); ctx.strokeStyle = b.col === '#e8e4d8' ? '#c8c4b8' : b.col; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 4, y + f); ctx.lineTo(x, y); ctx.lineTo(x + 4, y + f); ctx.stroke(); }
      else { ctx.fillStyle = b.col; ctx.fillRect(x - 2, y - 3, 4, 3); ctx.fillRect(x + (b.vx > 0 ? 2 : -3), y - 4, 2, 2); ctx.fillStyle = '#e8a030'; ctx.fillRect(x + (b.vx > 0 ? 4 : -4), y - 3, 1, 1); } }
  }
  function drawScreen(ctx, world_, c) {
    if (!world) return; const Wd = ctx.canvas.width, Hd = ctx.canvas.height;
    if (S.weather) { const t = tint();
      if (t.a > 0.003) { ctx.fillStyle = `rgba(${t.c[0]},${t.c[1]},${t.c[2]},${t.a.toFixed(3)})`; ctx.fillRect(0, 0, Wd, Hd); }
      if (W.rain > 0.02) { ctx.fillStyle = `rgba(40,50,70,${(W.rain * 0.16).toFixed(3)})`; ctx.fillRect(0, 0, Wd, Hd); }
      if (t.night > 0.05 && glow) { ctx.globalCompositeOperation = 'lighter'; let n = 0; const fl = 0.85 + Math.sin(st.clock * 9) * 0.08 + Math.sin(st.clock * 23) * 0.05;
        for (const b of world.buildings) { if (!b.complete || b.type === 'farm' || n > 30) continue; const g = roofOf(b); const x = g.left + g.s / 2 - c.x, y = g.bottom - 18 - c.y; if (x < -80 || y < -80 || x > Wd + 80 || y > Hd + 80) continue;
          if (fog && fog.sees && !fog.sees(b)) continue; n++; ctx.globalAlpha = t.night * 0.55 * (b.type === 'blacksmith' || b.type === 'town_center' ? fl : 1); const r = 26 + g.s * 0.35; ctx.drawImage(glow, x - r, y - r, r * 2, r * 2); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (drops.length) { ctx.strokeStyle = 'rgba(214,226,246,0.62)'; ctx.lineWidth = 1.2; ctx.beginPath(); const sx = W.wind * 0.12; for (const d of drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * sx, d.y - d.l); } ctx.stroke(); } }
    if (S.fx) { // forge glow (daytime too) at the Blacksmith door
      if (glow) { ctx.globalCompositeOperation = 'lighter'; for (const b of world.buildings) if (b.type === 'blacksmith' && b.complete) { const g = roofOf(b), x = g.left + g.s / 2 - c.x, y = g.bottom - 16 - c.y; if (x < -40 || y < -40 || x > Wd + 40 || y > Hd + 40 || (fog && fog.sees && !fog.sees(b))) continue;
        ctx.globalAlpha = 0.25 + Math.abs(Math.sin(st.clock * 7.3)) * 0.15 + Math.sin(st.clock * 19) * 0.05; ctx.drawImage(glow, x - 22, y - 22, 44, 44); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      // speech bubbles / emotes
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const b of bubbles) { const x = Math.round(b.x * TILE - c.x), y = Math.round(b.y * TILE - c.y - (b.folk ? 24 : 40) - Math.min(1, b.t * 6) * 4); if (x < -60 || x > Wd + 60 || y < -20 || y > Hd + 20) continue;
        const a = Math.min(1, b.t * 6, (b.dur - b.t) * 4); ctx.globalAlpha = Math.max(0, a);
        if (b.emote) { ctx.fillStyle = b.text === '!' ? '#ffd040' : '#fff'; ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 3; ctx.font = 'bold 14px sans-serif'; ctx.strokeText(b.text, x, y + 6); ctx.fillText(b.text, x, y + 6); ctx.font = 'bold 10px sans-serif'; continue; }
        const w = Math.ceil(ctx.measureText(b.text).width) + 10; ctx.fillStyle = b.folk ? 'rgba(250,244,228,0.88)' : '#fffaf0'; ctx.strokeStyle = '#5a3c18'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 8, w, 16, 6) : ctx.rect(x - w / 2, y - 8, w, 16); ctx.moveTo(x - 3, y + 8); ctx.lineTo(x, y + 12); ctx.lineTo(x + 3, y + 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3a2410'; ctx.fillText(b.text, x, y); }
      ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic'; }
  }
  // ===== settings / automation =====
  function save() { try { localStorage.setItem('inu-alive', JSON.stringify(S)); } catch {} }
  function set(o) { for (const k of ['fx', 'weather', 'sound']) if (k in o) S[k] = !!o[k]; save(); if (opts.sfx) opts.sfx.setMuted(!S.sound); if (!S.fx) { nP = 0; bubbles.length = 0; } if (!S.weather) drops.length = 0; opts.onChange?.(S); return { ...S }; }
  if (opts.sfx) opts.sfx.setMuted(!S.sound);
  function stats() { return { settings: { ...S }, low: st.low, lowWhy: st.lowWhy, frameEmaMs: +st.ema.toFixed(2), phase: +phase().toFixed(3), tint: tint(), rain: +W.rain.toFixed(2), wind: +W.wind.toFixed(2),
    particles: nP, birds: birds.length, butterflies: butterflies.length, critters: critters.length, fish: fishes.length, walkers: walkers.length, bustleTarget: st.bustleTarget || 0, clouds: clouds.length, drops: drops.length, bubbles: bubbles.map(b => b.text),
    poses: [...U.values()].filter(v => v.pose).length, caps: cap(), counts: JSON.parse(JSON.stringify(st.counts)), frames: st.frames }; }
  function debug(o = {}) { if ('phase' in o) st.phaseOverride = o.phase; if ('rain' in o) { st.rainOverride = o.rain; if (o.rain != null) W.rain = o.rain; } if ('low' in o) { st.low = !!o.low; st.lowWhy = o.low ? 'forced' : ''; }
    if (o.say && world) { const u = world.units.find(q => q.owner === me && q.type === 'villager' && inView(q.x * TILE, q.y * TILE, -20)); if (u) say(u, o.say === true ? pick(LINES.idle) : o.say, { force: true, dur: 6 }); }
    if (o.spawn && world) { for (let i = 0; i < 3; i++) { const t = randTileInView(); if (!blocked(t.tx, t.ty)) critters.push({ x: (t.tx + 0.5) * TILE, y: (t.ty + 0.5) * TILE, deer: i === 0, vx: 0, vy: 0, t: 0, a: 1, life: 1, max: 60, flee: 0, dir: 1, wt: 3 }); }
      fishT = 0; } return stats(); }
  return { update, drawWorld, drawScreen, pose, sway, set, stats, debug, settings: S, get on() { return S.fx || S.weather; } };
}
