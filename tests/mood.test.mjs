// Light Kibble Mood: fallback to Chill, ?mood= override, 60 s poll paused while hidden and NEVER during a match. Run: node tests/mood.test.mjs
import fs from 'fs';
import * as M from '../src/mood.js';
import { paintTitle } from '../src/title.js';
const log = []; let pass = 0, fail = 0;
const out = s => { console.log(s); log.push(s); };
const assert = (c, m) => { if (c) { pass++; out('PASS: ' + m); } else { fail++; out('FAIL: ' + m); } };
out('mood test ' + new Date().toISOString());
const flush = () => new Promise(r => setTimeout(r, 0));
// manual timers so we can step "60 s" instantly
function clock() { const q = []; return { q, setT: (fn, ms) => { const t = { fn, ms }; q.push(t); return t; }, clearT: t => { const i = q.indexOf(t); if (i >= 0) q.splice(i, 1); },
  async step() { const t = q.shift(); if (t) { await t.fn(); await flush(); } return t; } }; }
const okFetch = (mood, calls) => async u => { calls.push(u); return { ok: true, json: async () => ({ price: 0.0001, change1h: 1, change24h: 2, mood, updatedAt: '2026-10-18T00:00:00Z' }) }; };
// fallback
assert((await M.fetchMood({ f: async () => { throw new Error('offline'); } })).mood === 'chill', 'network error -> Chill');
assert((await M.fetchMood({ f: async () => ({ ok: false, status: 404 }) })).mood === 'chill', 'HTTP 404 on every base -> Chill');
assert((await M.fetchMood({ f: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } }) })).mood === 'chill', 'bad JSON -> Chill');
assert((await M.fetchMood({ f: async () => ({ ok: true, json: async () => ({ mood: 'rocket' }) }) })).mood === 'chill', 'unknown mood value -> Chill');
assert((await M.fetchMood({ f: async () => ({ ok: true, json: async () => ({ mood: null, price: null }) }) })).stale, 'flat/no data marked stale');
let calls = []; const r = await M.fetchMood({ f: async u => { calls.push(u); return u.includes('inu-verse') ? { ok: false, status: 404 } : { ok: true, json: async () => ({ mood: 'happy', change1h: 4 }) }; } });
assert(r.mood === 'happy' && calls.length === 2 && calls[0].endsWith('/api/kibble-mood'), 'second base used when the first is down');
assert(M.normalize({ mood: 'grumpy', price: '0.5', change1h: 'x' }).change1h === null && M.normalize({ mood: 'grumpy', price: '0.5' }).price === 0.5, 'numbers normalised');
// override
assert(M.overrideMood('?mood=doghouse') === 'doghouse' && M.overrideMood('?mood=MOON') === null && M.overrideMood('') === null, '?mood= override parsing');
calls = []; let got = null; const c0 = clock(); const o = M.startMood({ search: '?mood=zoomies', f: okFetch('chill', calls), onMood: m => got = m, setT: c0.setT, clearT: c0.clearT, doc: {} });
await flush(); assert(got.mood === 'zoomies' && calls.length === 0 && c0.q.length === 0, '?mood= override: no network, no polling');
// poll + hidden pause
calls = []; const doc = { hidden: false, addEventListener: (e, f) => { doc.cb = f; }, removeEventListener() {} }, c1 = clock(); const seenM = [];
const P = M.startMood({ f: okFetch('happy', calls), onMood: m => seenM.push(m.mood), setT: c1.setT, clearT: c1.clearT, doc, search: '' });
await flush(); await flush();
assert(seenM[0] === 'chill' && seenM.includes('happy') && calls.length === 1, 'starts on Chill, first poll immediately');
assert(c1.q.length === 1 && c1.q[0].ms === 60_000, 'next poll scheduled in 60 s');
doc.hidden = true; await c1.step(); assert(calls.length === 1 && P.skipped === 1, 'tab hidden: poll skipped (no fetch)');
doc.hidden = false; doc.cb(); await flush(); await flush(); assert(calls.length === 2, 'tab visible again: refreshes at once');
// never mid-match
calls = []; let inMatch = true; const got2 = []; const c2 = clock();
const Q = M.startMood({ f: okFetch('doghouse', calls), inMatch: () => inMatch, onMood: m => got2.push(m.mood), setT: c2.setT, clearT: c2.clearT, doc: { hidden: false }, search: '' });
await flush(); for (let i = 0; i < 5; i++) await c2.step();
assert(calls.length === 0 && got2.length === 1 && got2[0] === 'chill', 'during a match: 5 poll slots, 0 fetches, mood never changes');
Q.resume(); await flush(); assert(calls.length === 0, 'resume() refused while the match runs');
inMatch = false; Q.resume(); await flush(); await flush(); assert(calls.length === 1 && got2.at(-1) === 'doghouse', 'match over (between matches): mood refreshes');
P.stop(); Q.stop();
// shared kibble-mood.js
const sh = await M.loadShared('x', async () => ({ fetchMood: async () => ({ mood: 'grumpy', change1h: -5 }) }));
assert(sh && (await sh()).mood === 'grumpy' && (await sh()).source === 'kibble-mood.js', 'shared kibble-mood.js used for the fetch when it loads');
assert(await M.loadShared('x', async () => { throw new Error('blocked'); }) === null, 'shared module unavailable -> local thin client');
calls = []; const c3 = clock(), g3 = []; const R3 = M.startMood({ fetcher: async () => { throw new Error('x'); }, onMood: m => g3.push(m.mood), setT: c3.setT, clearT: c3.clearT, doc: { hidden: false }, search: '' });
await flush(); await flush(); assert(g3.at(-1) === 'chill', 'shared fetcher throwing -> Chill'); R3.stop();
// lines only on title / lobby / between, never in a match
assert(M.lineFor('happy', 'title') && M.lineFor('happy', 'lobby') && M.lineFor('happy', 'between'), 'banner line on title, lobby and between matches');
assert(M.lineFor('happy', null) === null && M.lineFor('happy', 'match') === null, 'no banner line mid-match');
assert(M.lineFor('rocket', 'title') === M.LINES.chill[0], 'unknown mood line -> Chill');
const allLines = Object.values(M.LINES).flat();
assert(allLines.length === 15 && !allLines.some(l => M.BANNED.some(b => b.test(l))), "15 brief lines, none with buy/sell/pump it/moon/dump/prices");
// title backdrop paints every mood (presentation only)
const noop = () => {}, grad = { addColorStop: noop }; const ctx = new Proxy({ measureText: s => ({ width: String(s).length * 6 }), createRadialGradient: () => grad, createLinearGradient: () => grad }, { get: (o, k) => k in o ? o[k] : noop, set: () => true });
let painted = 0; for (const m of M.MOOD_IDS) { try { paintTitle(ctx, 844, 390, 3.3, m); painted++; } catch (e) { out('paint ' + m + ' threw ' + e.message); } }
assert(painted === 5, 'title backdrop paints all 5 moods');
// main.js wiring: the poller is told about matches, the line is hidden while one runs
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
assert(/const inMatch = \(\) => !!world && !world\.winner/.test(main) && /startMood\(\{ inMatch/.test(main) && /if \(inMatch\(\)\) return; moodState\.mood/.test(main), 'main.js: inMatch gate on the poller and on every mood update');
assert(!/mood/i.test(['sim.js', 'ai.js', 'lockstep.js', 'render.js'].map(f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')).join('\n')), 'sim / AI / lockstep / in-match render never read the mood');
out(`\n${pass} passed, ${fail} failed`);
fs.mkdirSync(new URL('../proof/', import.meta.url), { recursive: true }); fs.writeFileSync(new URL('../proof/mood-test.log', import.meta.url), log.join('\n') + '\n');
process.exit(fail ? 1 : 0);
