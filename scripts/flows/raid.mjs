// Boss Raid proof (phone 844x390 + 750x342): entry card (guest "Enter free" / signed-in "Auto-entered"), a real fight played by a
// simple bot through the real input path, submit of inputs only, the skill-only leaderboard and the replay viewer.
// kibble-pay is stubbed for the signed-in part (fake session; the board/replay come from a genuine sim run); the live GET /api/raid
// is checked against the shared schedule. Usage: ctl run raid [--url U] [--shots DIR]
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
import { ROOT, base, newPage, openTitle, checker, closeAll, argOf, SHOTS } from '../ctl.mjs';
export default async function (argv) {
  const srv = await base(argv), c = checker(), out = argOf('shots', SHOTS, argv); mkdirSync(out, { recursive: true });
  const R = await import('../../src/raid.js'), BR = R.BR, ev = BR.eventAt(Date.now()), boss = BR.bossById(ev.boss);
  const BOT = `(() => { const S = window.__raidS; const f = S.fight; if (!f || f.s.over) return; const r = f.raid, s = r.s, tele = r.telegraph(), bl = r.bossLane(), safe = l => !tele.includes(l);
    let g = bl; if (!safe(g)) { const cs = [0,1,2,3,4].filter(safe).sort((a, b) => Math.abs(a - s.lane) - Math.abs(b - s.lane)); g = cs[0] ?? s.lane; }
    const key = g < s.lane ? 'ArrowLeft' : g > s.lane ? 'ArrowRight' : s.lane === bl && s.cd === 0 ? ' ' : null; if (key && !S.sentAt?.[s.tick]) { (S.sentAt ||= {})[s.tick] = 1; dispatchEvent(new KeyboardEvent('keydown', { key })); } })()`;
  // a genuine run for the stubbed board + replay
  const fx = R.createFight(ev.boss); const bot = f => { const r = f.raid, s = r.s, tele = r.telegraph(), bl = r.bossLane(), safe = l => !tele.includes(l); let g = bl; if (!safe(g)) g = [0, 1, 2, 3, 4].filter(safe).sort((a, b) => Math.abs(a - s.lane) - Math.abs(b - s.lane))[0] ?? s.lane; if (g < s.lane) f.press('L'); else if (g > s.lane) f.press('R'); else if (s.lane === bl && s.cd === 0) f.press('B'); };
  while (!fx.s.over) { bot(fx); fx.tick(); } const best = fx.result(), W = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  // live server agrees with the shared schedule
  { const live = await fetch('https://kibble-pay.vercel.app/api/raid').then(r => r.json()).catch(() => null);
    c(!live || (live.event.boss === ev.boss && live.event.eventId === ev.eventId && live.version === BR.RAID_VERSION), `live /api/raid event ${live?.event?.eventId} ${live?.event?.boss} = shared schedule (${ev.eventId} ${ev.boss})${live ? '' : ' (offline: skipped)'}`); }
  // ---- guest ----
  for (const [vw, vh] of [[844, 390], [750, 342]]) { const p = await newPage({ phone: true, ctxOpts: { viewport: { width: vw, height: vh } } }); await openTitle(p, srv.url, '?raid=1&mood=chill'); await p.waitForTimeout(1200);
    const g = await p.S(() => ({ boss: document.getElementById('raid-boss')?.textContent, entry: document.getElementById('raid-entry')?.textContent, fit: (() => { const r = document.getElementById('raid-card').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; })(), fight: !!document.getElementById('raid-fight') }));
    c(g.boss === boss.name && /^Enter free \(guest/.test(g.entry) && g.fight && g.fit, `${vw}x${vh} guest: ${g.boss}, "${g.entry}", card fits`);
    if (vw === 844) await p.screenshot({ path: join(out, 'raid-entry-guest.png') }); c(!p.errors.length, `${vw}x${vh} guest: no page errors ${p.errors.join(' | ')}`); await p.context().close(); }
  // ---- signed in (stubbed kibble-pay) with a Kennel tier: auto-entered, fight, submit inputs, board, replay ----
  const p = await newPage({ phone: true }); const posted = [];
  await p.route('https://kibble-pay.vercel.app/inu-games.js', r => r.fulfill({ contentType: 'text/javascript', body: `
    const kp = { session: 'test', address: '${W}', live: true, reqs: [],
      async _req(path, body) { kp.reqs.push([path, body]); if (path === '/api/raid' && body.op === 'join') return { ok: true, entry: 'auto:kennel', auto: true };
        if (path === '/api/raid' && body.op === 'start') return { ok: true, ticket: 'TICKET' };
        if (path === '/api/raid' && body.op === 'submit') { const m = await import('${srv.url}src/vendor/boss-raid.js'); const sim = m.simulate('${ev.boss}', body.inputs); return { ok: true, result: sim, best: true, eventBest: sim.score, inuScore: 1234 }; }
        if (path === '/api/kennel-lock') throw new Error('no'); return {}; },
      wallet: {}, async inventory() { return {}; }, async balance() { return { units: 0n }; }, async pools() { return { pools: null }; }, async disconnect() {} };
    globalThis.__kp = kp; export async function initKibble() { return { mode: 'live', kp }; } export function mountFooter() {} export function mountHome() {}
    export function mountWallet(R, o) { setTimeout(() => o.onWallet({ address: '${W}', units: 0n }), 50); return { connect() {} }; }` }));
  await p.route(/kibble-pay\.vercel\.app\/api\/raid\?replay=/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ v: 1, eventId: ev.eventId, boss: ev.boss, wallet: W, inputs: best.inputs, score: best.score }) }));
  await p.route(/kibble-pay\.vercel\.app\/api\/raid$/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ now: Date.now(), version: 1, event: { ...ev, live: true, board: [{ rank: 1, wallet: W, score: best.score, cleared: best.cleared, seconds: best.seconds }, { rank: 2, wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', score: 980, cleared: false, seconds: 90 }], roster: { total: 2, auto: 1 } }, schedule: BR.schedule(Date.now(), 6) }) }));
  await p.route(/kibble-pay\.vercel\.app\/api\/kennel\?/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ tier: 'guard', lockedAmount: 2000000, unlockDate: '2027-01-01T00:00:00Z', nextTier: { id: 'alpha', need: 8000000 }, locks: [], source: 'chain' }) }));
  await openTitle(p, srv.url, '?mood=chill'); await p.waitForTimeout(800);
  await p.S(() => document.getElementById('btn-raid').click()); await p.waitForTimeout(1200);
  const e = await p.S(() => document.getElementById('raid-entry').textContent);
  c(e === 'Auto-entered (Kibble Kennel)', `signed in with a Kennel tier: "${e}" (POST join -> auto:kennel)`);
  await p.screenshot({ path: join(out, 'raid-entry.png') }); await p.screenshot({ path: join(out, 'raid-leaderboard.png') });
  c(await p.S(() => document.querySelectorAll('#raid-board tr').length) === 3, 'leaderboard rows from GET /api/raid (skill only)');
  await p.evaluate(async () => { const m = await import('/src/raid-ui.js'); window.__raidS = m.raidState(); });
  await p.S(() => document.getElementById('raid-fight').click()); await p.waitForFunction(() => window.__raidS.mode === 'fight');
  const iv = await p.evaluate(BOT => { window.__bot = setInterval(() => eval(BOT), 25); return true; }, BOT);
  await p.waitForTimeout(6000); await p.screenshot({ path: join(out, 'raid-fight.png') });
  const mid = await p.S(() => ({ tick: window.__raidS.fight?.s.tick, pads: getComputedStyle(document.getElementById('raid-pads')).display, red: window.__raidS.fight?.raid.telegraph().length }));
  c(mid.tick > 40 && mid.pads === 'flex', `fight running at 10 Hz (tick ${mid.tick}), touch pads shown`);
  await p.waitForFunction(() => window.__raidS.mode === 'card' && window.__raidS.result, null, { timeout: 100000 });
  await p.evaluate(() => clearInterval(window.__bot)); await p.waitForTimeout(500);
  const sub = await p.S(() => ({ reqs: globalThis.__kp.reqs.filter(r => r[0] === '/api/raid').map(r => r[1]), res: window.__raidS.result, server: window.__raidS.server, text: document.getElementById('raid-card').innerText }));
  const subm = sub.reqs.find(r => r.op === 'submit');
  c(sub.reqs.map(r => r.op).includes('start') && subm && JSON.stringify(Object.keys(subm).sort()) === '["inputs","op","ticket"]' && subm.ticket === 'TICKET', 'start ticket before the fight; submit sends ticket + recorded inputs only');
  c(BR.simulate(ev.boss, subm.inputs).score === sub.res.score && sub.server.result.score === sub.res.score, `server re-play of the recorded inputs = the score shown (${sub.res.score}, ${sub.res.cleared ? 'cleared' : 'not cleared'})`);
  c(/checked by the server/.test(sub.text) && /Inu Score 1234/.test(sub.text), 'result card shows the server-checked score + Inu Score');
  await p.screenshot({ path: join(out, 'raid-result.png') });
  await p.S(() => document.querySelector('#raid-board button[data-raid=replay]').click()); await p.waitForFunction(() => window.__raidS.mode === 'replay'); await p.waitForTimeout(4000);
  await p.screenshot({ path: join(out, 'raid-replay.png') });
  await p.S(() => document.querySelector('#raid-hud [data-raid=speed]')?.click());
  await p.waitForFunction(() => window.__raidS.replay?.s.over, null, { timeout: 60000 });
  const rs = await p.S(() => window.__raidS.replay.s); c(rs.dmg + (rs.cleared ? 1000 + (900 - rs.clearTick) * 2 + rs.hp * 200 : 0) === best.score, `replay viewer reproduces the board run (${best.score})`);
  c(!p.errors.length, `no page errors ${p.errors.join(' | ')}`);
  writeFileSync(join(ROOT, 'proof/raid-flow.log'), c.lines.join('\n') + '\n'); await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
