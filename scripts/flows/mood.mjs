// Light Kibble Mood proof: 5 title moods at 844x390 (?mood=), banner line on title / lobby / between matches, nothing mid-match,
// fallback to Chill when the mood API is unreachable. Usage: ctl run mood [--url U] [--shots DIR]
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
import { ROOT, base, newPage, openTitle, startSkirmish, checker, closeAll, argOf, SHOTS } from '../ctl.mjs';
export default async function (argv) {
  const srv = await base(argv), c = checker(), out = argOf('shots', SHOTS, argv); mkdirSync(out, { recursive: true });
  const M = await import('../../src/mood.js');
  const line = p => p.S(() => { const e = document.getElementById('mood-line'); return { shown: getComputedStyle(e).display !== 'none', text: e.textContent, mood: e.dataset.mood, screen: e.dataset.screen }; });
  const px = p => p.S(() => { const c = document.getElementById('title-bg'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) % 1e9; return h; });
  const looks = {};
  for (const m of M.MOOD_IDS) { const p = await newPage({ phone: true }); await openTitle(p, srv.url, `?mood=${m}`); await p.waitForTimeout(700);
    const l = await line(p); c(l.shown && l.mood === m && l.screen === 'title' && M.LINES[m].some(x => l.text.includes(x)), `title ${m}: banner line "${l.text}"`);
    looks[m] = await px(p); await p.screenshot({ path: join(out, `kennel-mood-${m}.png`) }); c(!p.errors.length, `title ${m}: no page errors ${p.errors.join(' | ')}`); await p.context().close(); }
  c(new Set(Object.values(looks)).size === 5, 'the 5 moods paint 5 different title scenes');
  // fallback: block the mood API + shared module -> Chill
  { const p = await newPage({ phone: true }); let hits = 0;
    await p.route(/kibble-mood/, r => { hits++; r.abort(); }); await openTitle(p, srv.url, ''); await p.waitForTimeout(1500);
    const l = await line(p); c(l.mood === 'chill' && l.shown && M.LINES.chill.some(x => l.text.includes(x)) && hits >= 1, `mood API unreachable (${hits} blocked): falls back to Chill`);
    // in a match: no line, no title paint, no polls
    await startSkirmish(p); await p.waitForTimeout(800); const polls0 = await p.S(() => window.game.mood.client.polls), hits0 = hits;
    await p.S(() => window.game.mood.client.resume()); await p.waitForTimeout(600);
    const mid = await line(p), polls1 = await p.S(() => window.game.mood.client.polls), tb = await p.S(() => document.getElementById('title-bg').style.display);
    c(!mid.shown && polls1 === polls0 && hits === hits0 && tb === 'none', `mid-match: no mood line, no poll (polls ${polls0} -> ${polls1}), title backdrop off`);
    // between matches (match over): line back, mood refreshes
    await p.S(() => { window.game.world.winner = 'player'; window.game.world.banner = { text: 'Victory!' }; window.game.tick(0.05); }); await p.waitForTimeout(1200);
    const end = await line(p); c(end.shown && end.screen === 'between', `match over: mood line on the between-match screen ("${end.text}")`);
    await p.screenshot({ path: join(out, 'kennel-mood-between.png') }); c(!p.errors.length, `no page errors ${p.errors.join(' | ')}`); await p.context().close(); }
  // live API reachable: whatever it says is one of the 5 moods
  { const p = await newPage({ phone: true }); await openTitle(p, srv.url, ''); await p.waitForTimeout(2500);
    const st = await p.S(() => ({ mood: window.game.mood.get(), shared: !!window.game.mood.state.shared, data: window.game.mood.state.data }));
    c(M.MOOD_IDS.includes(st.mood), `live mood: ${st.mood} (shared kibble-mood.js ${st.shared ? 'loaded' : 'not loaded'}, source ${st.data?.source || '-'}, stale ${st.data?.stale})`); await p.context().close(); }
  writeFileSync(join(ROOT, 'proof/mood-flow.log'), c.lines.join('\n') + '\n'); await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
