// Inu Boss Raids: shared deterministic raid simulation (pure ES module, no DOM, no randomness, no clock).
// The SAME file ships in Inu Verse (src/bossraid.js) and kibble-pay (public/lib/boss-raid.js). kibble-pay re-runs every
// submitted replay with it, so the server, not the client, decides the score. Contract: /workspace/inu-shared/boss-raids.md.
// Rules: free entry, skill-only. Boss attacks follow a fixed published script, so the same inputs always give the same score.
// Nothing here involves tokens, bets, raffles or chance.
export const RAID_VERSION = 1;
export const TICK_HZ = 10, MAX_TICKS = 900, LANES = 5;                 // 90 s max fight, 5 lanes
export const BITE = { cooldown: 6, base: 8, open: 20, comboStep: 2, comboMax: 16 };
export const PUP = { hp: 3, invuln: 10, start: 2 };
export const OPEN_TICKS = 12;                                         // boss is open (bites hit harder) right after each slam
export const MAX_INPUTS = 1500, MAX_PER_TICK = 3;
// Patterns map attack number k to the lanes it hits. Fixed formulas, the same for everybody: learnable, never random.
export const PATTERNS = {
  sweep: (k) => [k % LANES, (k + 1) % LANES],
  split: (k) => [0, 1, 2, 3, 4].filter((l) => l !== (k * 2) % LANES && l !== (k * 2 + 1) % LANES),
  pounce: (k) => { const c = (k * 3) % LANES; return [c - 1, c, c + 1].filter((l) => l >= 0 && l < LANES); },
  rain: (k) => [(k * 2 + 1) % LANES, (k * 2 + 3) % LANES, k % 2 ? 0 : 4].filter((l, i, a) => a.indexOf(l) === i),
};
// The boss stands over one lane and moves after every slam: bites only land from the lane under the boss.
export const bossLaneAt = (boss, k) => (k * boss.step + boss.offset) % LANES;
export const BOSSES = [
  { id: 'gutter-gator', name: 'Gutter Gator', hp: 1400, step: 2, offset: 2, pattern: 'sweep', period: 16, warn: 9, color: '#5fae5a', dark: '#2f6b33', accent: '#f2cc68' },
  { id: 'storm-crow', name: 'Storm Crow', hp: 1300, step: 3, offset: 1, pattern: 'rain', period: 15, warn: 8, color: '#5a6a9a', dark: '#2a3358', accent: '#cfe8ff' },
  { id: 'iron-tomcat', name: 'Iron Tomcat', hp: 1500, step: 1, offset: 4, pattern: 'pounce', period: 14, warn: 8, color: '#9a8f86', dark: '#5e5870', accent: '#d8425a' },
  { id: 'fog-badger', name: 'Fog Badger', hp: 1400, step: 4, offset: 0, pattern: 'split', period: 18, warn: 10, color: '#6b5a48', dark: '#3a2a1e', accent: '#fff6e0' },
];
export const bossById = (id) => BOSSES.find((b) => b.id === id) || null;
export const EVENT_MS = 3600_000;                                      // a new boss every hour (UTC), always on
export function eventAt(ms) { const h = Math.floor(ms / EVENT_MS), boss = BOSSES[((h % BOSSES.length) + BOSSES.length) % BOSSES.length];
  return { eventId: new Date(h * EVENT_MS).toISOString().slice(0, 13), boss: boss.id, bossName: boss.name, startMs: h * EVENT_MS, endMs: (h + 1) * EVENT_MS }; }
export const schedule = (ms, n = 6) => Array.from({ length: n }, (_, i) => eventAt(ms + i * EVENT_MS));
export const eventById = (id) => { const t = Date.parse(String(id) + ':00:00Z'); return Number.isFinite(t) && /^\d{4}-\d\d-\d\dT\d\d$/.test(id) ? eventAt(t) : null; };
// Attack k lands at tick attackTick(k); the boss speeds up (period - 3) once it is below half HP.
export const firstAttack = 20;
export const maxScore = (boss) => boss.hp + 1000 + MAX_TICKS * 2 + PUP.hp * 200;

// Step-by-step fight (used live by the game and in replays/verification). inputs per tick: 'L' | 'R' | 'B'.
export function createRaid(bossId) {
  const boss = bossById(bossId); if (!boss) throw new Error('unknown boss');
  const s = { boss, tick: 0, lane: PUP.start, hp: PUP.hp, dmg: 0, combo: 0, cd: 0, inv: 0, hits: 0, bites: 0, k: 0, next: firstAttack, openUntil: -1, over: false, cleared: false, clearTick: null, events: [] };
  const period = () => (s.dmg * 2 < boss.hp ? boss.period : Math.max(8, boss.period - 3));
  function step(inputs = []) {
    if (s.over) return s;
    for (const a of inputs.slice(0, MAX_PER_TICK)) {
      if (a === 'L') s.lane = Math.max(0, s.lane - 1); else if (a === 'R') s.lane = Math.min(LANES - 1, s.lane + 1);
      else if (a === 'B' && s.cd === 0) { s.cd = BITE.cooldown; s.bites++;
        if (s.lane !== bossLaneAt(boss, s.k)) { s.combo = 0; s.events.push({ t: s.tick, e: 'miss' }); continue; }
        const open = s.tick <= s.openUntil, d = (open ? BITE.open + s.combo : BITE.base);
        s.dmg = Math.min(boss.hp, s.dmg + d); s.combo = open ? Math.min(BITE.comboMax, s.combo + BITE.comboStep) : s.combo; s.events.push({ t: s.tick, e: 'bite', d, open });
        if (s.dmg >= boss.hp) { s.over = true; s.cleared = true; s.clearTick = s.tick; return s; } }
    }
    if (s.tick === s.next) { const lanes = PATTERNS[boss.pattern](s.k);
      if (lanes.includes(s.lane) && s.inv === 0) { s.hp--; s.hits++; s.combo = 0; s.inv = PUP.invuln; s.events.push({ t: s.tick, e: 'hit' }); }
      s.openUntil = s.tick + OPEN_TICKS; s.k++; s.next = s.tick + period(); }
    if (s.cd > 0) s.cd--; if (s.inv > 0) s.inv--;
    s.tick++;
    if (s.hp <= 0 || s.tick >= MAX_TICKS) s.over = true;
    return s;
  }
  // What the player sees: lanes about to be hit (telegraphed `warn` ticks before the slam).
  const telegraph = () => (s.next - s.tick <= boss.warn ? PATTERNS[boss.pattern](s.k) : []);
  const bossLane = () => bossLaneAt(boss, s.k);
  return { s, step, telegraph, period, bossLane };
}
export function scoreOf(s) { return s.dmg + (s.cleared ? 1000 + (MAX_TICKS - s.clearTick) * 2 + s.hp * 200 : 0); }

// Replays: [[tick, 'L'|'R'|'B'], ...] in tick order. Validation never trusts a claimed score.
export function checkInputs(inputs) {
  if (!Array.isArray(inputs) || inputs.length > MAX_INPUTS) return 'inputs must be an array of at most ' + MAX_INPUTS;
  let last = -1, per = 0;
  for (const it of inputs) { if (!Array.isArray(it) || it.length !== 2) return 'each input is [tick, action]';
    const [t, a] = it; if (!Number.isInteger(t) || t < 0 || t >= MAX_TICKS) return 'tick out of range'; if (!['L', 'R', 'B'].includes(a)) return 'unknown action';
    if (t < last) return 'inputs must be in tick order'; per = t === last ? per + 1 : 1; if (per > MAX_PER_TICK) return 'too many inputs in one tick'; last = t; }
  return null;
}
export function simulate(bossId, inputs) {
  const bad = checkInputs(inputs); if (bad) return { ok: false, reason: bad };
  if (!bossById(bossId)) return { ok: false, reason: 'unknown boss' };
  const r = createRaid(bossId); let i = 0;
  while (!r.s.over) { const now = []; while (i < inputs.length && inputs[i][0] === r.s.tick) now.push(inputs[i++][1]); r.step(now); }
  const s = r.s; return { ok: true, boss: bossId, version: RAID_VERSION, score: scoreOf(s), damage: s.dmg, cleared: s.cleared, clearTick: s.clearTick, ticks: s.tick, hpLeft: Math.max(0, s.hp), hits: s.hits, bites: s.bites, seconds: s.tick / TICK_HZ };
}
