// Light Kibble Mood for Inu Empires: title, lobby and between-match screens only, NEVER mid-match.
// Uses the shared kibble-mood.js (served by kibble-pay, canonical copy in Inu Verse) for the fetch when it loads; otherwise this
// thin client for GET /api/kibble-mood -> { price, change1h, change24h, mood, updatedAt } (Inu Verse endpoint, cached 60 s). Polls every 60 s, pauses while the tab is hidden AND while a match is running, falls back to
// "chill" whenever the data is missing. Dev override: ?mood=zoomies|happy|chill|grumpy|doghouse. Presentation only: no sim access.
// NPCs react to the mood; they never tell anyone what to do (no price talk, no advice).
export const MOOD_IDS = ['zoomies', 'happy', 'chill', 'grumpy', 'doghouse'];
export const FALLBACK = 'chill', POLL_MS = 60_000;
// first base that answers wins; kibble-pay first (shared), then Inu Verse
export const BASES = ['https://inu-verse-tawny.vercel.app', 'https://kibble-pay.vercel.app'];
export const SHARED_URL = 'https://kibble-pay.vercel.app/kibble-mood.js';
// shared module -> a fetcher with the same result shape; null when it cannot load (we then use fetchMood below)
export async function loadShared(url = SHARED_URL, imp = u => import(u)) { try { const m = await imp(url); return typeof m.fetchMood === 'function' ? async () => { const r = await m.fetchMood(); return { ...normalize(r), source: 'kibble-mood.js' }; } : null; } catch { return null; } }
export const MOODS = { zoomies: { name: 'Zoomies', color: '#ffd84a' }, happy: { name: 'Happy', color: '#7ed957' }, chill: { name: 'Chill', color: '#9fd8ff' },
  grumpy: { name: 'Grumpy', color: '#8aa0c8' }, doghouse: { name: 'Doghouse', color: '#c8323c' } };
export const LINES = { // the brief's lines
  zoomies: ["The whole town's got the zoomies today!", "I haven't wagged this hard since puppy school.", 'Someone fetch me a bigger bone bowl!'],
  happy: ["Sun's out, tails up.", 'Good vibes at the Kibble statue today.', "President Inu's in a great mood."],
  chill: ['Quiet day in the Verse. Perfect for a nap.', 'Just sniffing around, nothing to report.', 'Steady paws, steady pup.'],
  grumpy: ["Bit drizzly today. I'll keep my bone close.", "Ears down, but I'm not going anywhere.", 'Rain never stopped a good walk.'],
  doghouse: ['Stormy one. We huddle, we hold, we play.', 'Diamond paws, pup.', "Even the President's in the doghouse. He'll be back."],
};
export const BANNED = [/\bbuy(s|ing)?\b/i, /\bsell(s|ing)?\b/i, /pump\s*it/i, /\bmoon(ing|s)?\b/i, /\bdump(s|ing|ed)?\b/i, /\$\s?\d/, /\btarget/i];
export const SCREENS = ['title', 'lobby', 'between'];      // where the mood may show; anything else (a running match) shows nothing
const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
export const flat = (reason = 'no data') => ({ price: null, change1h: null, change24h: null, mood: FALLBACK, updatedAt: null, stale: true, reason });
export function normalize(j) { if (!j || typeof j !== 'object') return flat('bad response');
  return { price: num(j.price), change1h: num(j.change1h), change24h: num(j.change24h), mood: MOOD_IDS.includes(j.mood) ? j.mood : FALLBACK, updatedAt: j.updatedAt || null, stale: !!j.stale || !MOOD_IDS.includes(j.mood) }; }
export function overrideMood(search = (typeof location !== 'undefined' ? location.search : '')) { try { const m = (new URLSearchParams(search).get('mood') || '').toLowerCase(); return MOOD_IDS.includes(m) ? m : null; } catch { return null; } }
export async function fetchMood({ bases = BASES, f = globalThis.fetch } = {}) {
  for (const b of bases) { try { const r = await f(b + '/api/kibble-mood', { cache: 'no-store' }); if (!r.ok) continue; const j = await r.json(); if (j && typeof j === 'object') return { ...normalize(j), source: b }; } catch { } }
  return flat('unavailable'); }
// one line per screen visit (stable while the mood holds), never during a match
export function lineFor(mood, screen, seed = 0) { if (!SCREENS.includes(screen)) return null; const L = LINES[MOOD_IDS.includes(mood) ? mood : FALLBACK]; return L[Math.abs(Math.floor(seed)) % L.length]; }
// Poller. inMatch() true -> no fetch, no callback (resumes with an immediate refresh once the match is over / the menu is back).
export function startMood({ onMood = () => {}, inMatch = () => false, fetcher = null, f = globalThis.fetch, doc = globalThis.document, search, bases = BASES, interval = POLL_MS,
  setT = globalThis.setTimeout?.bind(globalThis), clearT = globalThis.clearTimeout?.bind(globalThis) } = {}) {
  const forced = overrideMood(search);
  const M = { current: forced ? { ...flat('override'), mood: forced, stale: false, override: true } : flat('loading'), forced, polls: 0, skipped: 0, stopped: false };
  M.fetcher = fetcher; M.useShared = fn => { if (fn) M.fetcher = fn; };
  let timer = null;
  const paused = () => !!doc?.hidden || !!inMatch();
  const emit = m => { M.current = m; try { onMood(m); } catch { } };
  async function tick() { timer = null; if (M.stopped) return; if (paused()) { M.skipped++; schedule(); return; } M.polls++; let m; try { m = await (M.fetcher ? M.fetcher() : fetchMood({ bases, f })); } catch { m = flat('offline'); } emit(m && MOOD_IDS.includes(m.mood) ? m : flat('bad response')); schedule(); }
  function schedule() { if (!M.stopped && !timer && setT) timer = setT(tick, interval); }
  M.stop = () => { M.stopped = true; if (timer) clearT?.(timer); timer = null; try { doc?.removeEventListener?.('visibilitychange', onVis); } catch { } };
  M.resume = () => { if (M.stopped || paused()) return; if (timer) { clearT?.(timer); timer = null; } tick(); };
  const onVis = () => { if (!doc?.hidden) M.resume(); };
  if (forced) { emit(M.current); return M; }
  try { doc?.addEventListener?.('visibilitychange', onVis); } catch { }
  emit(M.current); tick(); return M;
}
