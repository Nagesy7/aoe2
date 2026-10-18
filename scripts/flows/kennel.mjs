// Kibble Kennel proof (phone landscape 844x390 + 750x342): the tab with no tier / each tier (?kennel= dev override), "Relock to keep"
// after a tier drop, equip/unequip saved in the cloud-saved kibble state, each tier's cosmetics in game with an identical sim hash,
// the lock flow end to end against a stubbed kibble-pay (real /api/kennel-lock transaction fixture, fake Phantom: nothing is sent),
// and multiplayer sync of cosmetic ids (two tabs, BroadcastChannel). Usage: ctl run kennel [--url U] [--shots DIR]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
import { ROOT, base, newPage, openTitle, startSkirmish, checker, closeAll, argOf, SHOTS } from '../ctl.mjs';
const KEY = 'inu-empires-kibble', BANNED = [/\bbuy\b/i, /\bsell\b/i, /pump it/i, /\bmoon\b/i, /\bdump\b/i];
export default async function (argv) {
  const srv = await base(argv), c = checker(), out = argOf('shots', SHOTS, argv); mkdirSync(out, { recursive: true });
  const N = await import('../../src/kennel.js');
  const openTab = async p => { await p.S(() => document.getElementById('btn-kibble').click()); await p.waitForTimeout(150); await p.S(() => document.querySelector('#kb [data-tab=kennel]').click()); await p.waitForTimeout(250); };
  const tabInfo = p => p.S(() => { const q = s => [...document.querySelectorAll(s)]; return { tier: document.getElementById('kn-tier')?.textContent, text: document.getElementById('kb-body').innerText,
    on: q('.kn-item.on').map(e => e.dataset.id), avail: q('.kn-item.available').map(e => e.dataset.id), relock: q('.kn-item.relock').map(e => e.dataset.id), locked: q('.kn-item.locked').map(e => e.dataset.id),
    relockBtn: q('.kn-item.relock button').every(b => b.disabled && b.textContent === 'Relock to keep'), warn: !!document.getElementById('kn-warn'),
    fits: (() => { const r = document.querySelector('#kb .kpanel').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; })() }; });
  const copyOk = t => !BANNED.some(r => r.test(t.replace("Locked tokens can't be sold until the unlock date.", '')));
  // ---- A: the tab, no tier + each tier ----
  for (const [vw, vh] of [[844, 390], [750, 342]]) {
    const p = await newPage({ phone: true, ctxOpts: { viewport: { width: vw, height: vh } } });
    for (const t of ['none', ...N.TIER_IDS]) {
      await openTitle(p, srv.url, `?kennel=${t}&mood=chill`); await openTab(p); const i = await tabInfo(p), tier = t === 'none' ? null : t, want = N.unlockedBy(tier);
      c(i.tier === (tier ? N.tierById(tier).name : 'No tier yet') && i.warn && /Locked tokens can't be sold until the unlock date\./.test(i.text), `${vw}x${vh} ${t}: tier "${i.tier}", can't-sell warning shown`);
      c(/Locked: /.test(i.text) && /Unlock date: /.test(i.text) && /Next tier: /.test(i.text), `${vw}x${vh} ${t}: locked amount, unlock date, next tier shown`);
      c(i.on.length + i.avail.length === want.length && i.locked.length === N.IDS.length - want.length && i.relock.length === 0, `${vw}x${vh} ${t}: ${want.length} unlocked, ${i.locked.length} locked`);
      c(copyOk(i.text) && /no yield, no rewards, no draws/.test(i.text), `${vw}x${vh} ${t}: copy has no banned words, says no yield/rewards/draws`);
      c(i.fits, `${vw}x${vh} ${t}: panel fits the screen (scrolls inside)`);
      if (vw === 844) await p.screenshot({ path: join(out, `kennel-tab-${t}.png`) });
    }
    await p.context().close();
  }
  // ---- B: relock after expiry + C: equip/unequip saved ----
  { const p = await newPage({ phone: true }); await openTitle(p, srv.url, '?kennel=none');
    await p.evaluate(async ([KEY, eq]) => { const K = await import('/src/kibble.js'); const s = { ...K.newState(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; s.kennel = { everTier: 'top', equipped: eq }; localStorage.setItem(KEY, JSON.stringify(s)); }, [KEY, N.defaultEquip('top')]);
    await openTitle(p, srv.url, '?kennel=guard'); await openTab(p); const i = await tabInfo(p);
    c(i.relock.length === 6 && i.relockBtn && i.relock.every(id => ['alpha', 'top'].includes(N.COSMETICS[id].tier)), `expired Alpha/Top items greyed with "Relock to keep" (${i.relock.length})`);
    await p.screenshot({ path: join(out, 'kennel-tab-relock.png') });
    await p.S(() => document.querySelector('[data-kn-off=collar]').click()); await p.waitForTimeout(150);
    const saved = await p.S(KEY => JSON.parse(localStorage.getItem(KEY)).kennel.equipped.collar, KEY);
    c(saved === null, 'unequip collars: saved to the cloud-saved kibble state (localStorage key synced by kibble-pay)');
    await openTitle(p, srv.url, '?kennel=guard'); await openTab(p); const j = await tabInfo(p);
    c(!j.on.includes('kn_collar') && j.avail.includes('kn_collar'), 'after reload collars stay unequipped');
    await p.S(() => document.querySelector('[data-kn-eq=kn_collar]').click()); await p.waitForTimeout(150);
    c(await p.S(KEY => JSON.parse(localStorage.getItem(KEY)).kennel.equipped.collar, KEY) === 'kn_collar', 'equip collars: saved'); await p.context().close(); }
  // ---- D: in game, each tier: cosmetics drawn, sim identical ----
  const hashes = {};
  for (const t of ['none', ...N.TIER_IDS]) { const p = await newPage({ phone: true }); await openTitle(p, srv.url, `?kennel=${t}`);
    await p.S(KEY => localStorage.removeItem(KEY), KEY); await openTitle(p, srv.url, `?kennel=${t}`); await startSkirmish(p); await p.waitForTimeout(400);
    const r = await p.S(() => { const g = window.game, w = g.world; g.tick(20); const tc = w.buildings.find(b => b.type === 'town_center' && b.owner === 'player'), Z = g.zoom();
      w.units.filter(u => u.owner === 'player').forEach((u, i) => { u.x = tc.x + 3.6 + (i % 3) * 1.3; u.y = tc.y + 1.2 + Math.floor(i / 3) * 1.2; u.path = []; u.state = 'idle'; u.task = null; });
      g.cam.x = (tc.x + 2.4) * 32 - innerWidth / 2 / Z; g.cam.y = (tc.y + 1.8) * 32 - innerHeight / 2 / Z; g.tick(0.05); const L = g.ui.cosmetics?.player;
      return { ids: L ? [...L.ids].sort() : [], tick: w.tick }; });
    // hash on a fresh run without the camera/unit staging: same commands, so the sim must match exactly across tiers
    hashes[t] = await p.S(() => { const g = window.game, S = g.sim, w2 = S.createWorld({ enemy: true }); for (let i = 0; i < 600; i++) S.stepTick(w2); return S.stateHash(w2); });
    const want = N.activeIds(N.defaultEquip(t === 'none' ? null : t), t === 'none' ? null : t).sort();
    c(JSON.stringify(r.ids) === JSON.stringify(want), `in game ${t}: render loadout = ${want.length} cosmetic ids`);
    await p.waitForTimeout(300); await p.screenshot({ path: join(out, `kennel-game-${t}.png`) }); c(!p.errors.length, `in game ${t}: no page errors ${p.errors.join(' | ')}`); await p.context().close(); }
  c(new Set(Object.values(hashes)).size === 1, `same 600-tick sim hash in every tier's page (${Object.values(hashes)[0]}; the full render-vs-sim proof is tests/kennel.test.mjs)`);
  // ---- E: lock flow against a stubbed kibble-pay (real lock tx fixture), fake Phantom ----
  { const fx = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/kennel-lock-tx.json'), 'utf8')), W = fx.sender;
    const p = await newPage({ phone: true }); let kennelCalls = 0;
    await p.route('https://kibble-pay.vercel.app/inu-games.js', r => r.fulfill({ contentType: 'text/javascript', body: `
      const kp = { session: 'test', address: '${W}', live: true, sent: null, reqs: [],
        async _req(path, body) { kp.reqs.push([path, body]); if (path === '/api/kennel-lock') { const fx = ${JSON.stringify(fx)}, raw = BigInt(body.amount) * 1000000n, fee = raw * 5000n / 1000000n;
          // the real response for the real tx, with the token lines for the amount asked and a funded wallet (the real fixture wallet has 0.0079 SOL; tests/kennel.test.mjs covers that case)
          const unlockAt = Math.floor(Date.now() / 1000) + body.days * 86400 + 600; return { ...fx, amount: body.amount, days: body.days, unlockAt, unlockDate: new Date(unlockAt * 1000).toISOString(), costs: { ...fx.costs, token: { ...fx.costs.token, lockedRaw: String(raw), feeRaw: String(fee), totalDebitRaw: String(raw + fee), returnedAtUnlockRaw: String(raw) }, balances: { lamports: 250000000, tokenRaw: '5000000000000', enoughSol: true, enoughToken: true } } }; } throw new Error('unexpected ' + path); },
        wallet: { async signAndSend(tx) { kp.sent = { sig0: [...tx.signatures[0]].some(b => b), sig1: [...tx.signatures[1]].some(b => b), payer: tx.message.staticAccountKeys[0].toBase58() }; return '5igTEST'; } },
        async inventory() { return {}; }, async balance() { return { units: 5000000000000n }; }, async pools() { return { pools: null }; }, async disconnect() {} };
      globalThis.__kp = kp;
      export async function initKibble() { return { mode: 'live', kp }; } export function mountFooter() {} export function mountHome() {}
      export function mountWallet(R, o) { setTimeout(() => o.onWallet({ address: '${W}', units: 5000000000000n }), 50); return { connect() {} }; }` }));
    await p.route(/kibble-pay\.vercel\.app\/api\/kennel\?/, r => { kennelCalls++; const after = !!(kennelCalls > 1 && r.request().url().includes('refresh=1'));
      r.fulfill({ contentType: 'application/json', body: JSON.stringify(after ? { tier: 'guard', lockedAmount: 1000000, unlockDate: fx.unlockDate, tierUntil: '2026-11-17T07:00:00Z', nextTier: { id: 'alpha', need: 9000000 }, locks: [], source: 'chain' } : { tier: null, lockedAmount: 0, nextTier: { id: 'pup', need: 100000 }, locks: [], source: 'chain' }) }); });
    await openTitle(p, srv.url, ''); await p.waitForTimeout(600); await openTab(p);
    c((await tabInfo(p)).tier === 'No tier yet', 'lock flow: connected wallet starts with no tier (from /api/kennel)');
    await p.fill('#kn-amt', '1000000'); await p.S(() => document.querySelector('[data-kn-days="60"]').click()); await p.waitForTimeout(100);
    c(/Guard Dog for 30 days, then Pup for 53 days/.test(await p.S(() => document.querySelector('.kn-plan').textContent)), 'lock form explains the tier timeline (1M for 60 days)');
    await p.S(() => document.querySelector('[data-kn-lock]').click());
    // review card first: every fee before Phantom opens
    await p.waitForSelector('#kn-review', { timeout: 15000 }).catch(async () => console.log('lock note:', await p.S(() => document.getElementById('kn-note')?.textContent), p.errors));
    const rv = await p.S(() => { const q = s => document.querySelector(s); return { sent: !!globalThis.__kp.sent, sign: q('#kn-sign')?.disabled, sol: q('#kn-total-sol')?.textContent, kib: q('#kn-total-kib')?.textContent,
      rows: [...document.querySelectorAll('.kn-fees tr[data-fee]')].map(r => [r.dataset.fee, r.children[1].textContent, r.children[2].textContent]), text: q('#kn-review').textContent }; });
    c(!rv.sent && rv.sign === true, 'review card shows before Phantom: nothing sent, Sign disabled until the box is ticked');
    c(rv.sol === '0.16927084 SOL' && rv.kib === '1,005,000 $KIBBLE', `review card totals from the built tx + live fee read: ${rv.sol}, ${rv.kib} (1,000,000 locked + 0.5%)`);
    const fr = Object.fromEntries(rv.rows.map(r => [r[0], r[1]]));
    c(fr.protocol === '0.16 SOL' && fr.token === '5,000 $KIBBLE' && fr['rent-meta'] === '0.00625856 SOL' && fr['rent-escrow'] === '0.00148844 SOL' && fr['rent-treasury'] === '0.00151384 SOL' && fr.network === '0.00001 SOL' && rv.rows.every(r => /^no/.test(r[2])),
      'review card rows: creation fee, 0.5% lock fee, rent x3, network fee, each marked "no" for coming back');
    c(/1,000,000 \$KIBBLE/.test(rv.text) && /can't be cancelled/.test(rv.text) && /can't be sold until the unlock date/.test(rv.text), 'review card: amount, unlock date, cannot cancel, required warning');
    const vp = p.viewportSize(); await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(200);
    await p.S(() => document.getElementById('kn-review').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); await p.screenshot({ path: join(out, 'kennel-fee-card.png') });
    await p.setViewportSize(vp); await p.waitForTimeout(200);
    const fit = await p.S(() => { const r = document.getElementById('kn-review').getBoundingClientRect(), b = document.getElementById('kn-sign'); b.scrollIntoView({ block: 'end' }); const q = b.getBoundingClientRect(); return { w: r.width, vw: innerWidth, sb: q.bottom <= innerHeight && q.top >= 0 }; });
    c(fit.w <= fit.vw && fit.sb, `phone landscape ${vp.width}x${vp.height}: review card fits the width and Sign in Phantom scrolls into view`);
    await p.waitForTimeout(150); await p.screenshot({ path: join(out, 'kennel-fee-card-phone.png') });
    await p.S(() => { const b = document.getElementById('kn-ack'); b.click(); });
    c(await p.S(() => !document.getElementById('kn-sign').disabled && !globalThis.__kp.sent), 'ticking the box enables Sign in Phantom (still nothing sent)');
    await p.S(() => document.getElementById('kn-sign').click());
    await p.waitForFunction(() => globalThis.__kp?.sent, null, { timeout: 15000 }).catch(async () => console.log('lock note:', await p.S(() => document.getElementById('kn-note')?.textContent + ' | kp ' + !!globalThis.__kp), p.errors));
    const sent = await p.S(() => ({ ...globalThis.__kp.sent, reqs: globalThis.__kp.reqs }));
    const lk = sent.reqs.filter(r => r[0] === '/api/kennel-lock');
    c(lk.length === 1 && lk[0][1].amount === 1000000 && lk[0][1].days === 60 && Object.keys(lk[0][1]).length === 2, 'asks kibble-pay to build the lock (amount + days only)');
    c(sent.payer === W && !sent.sig0 && sent.sig1, 'Phantom gets the real self-lock tx: fee payer = player, player signature empty (signed in Phantom), metadata pre-signed');
    await p.waitForFunction(() => /Lock confirmed/.test(document.getElementById('kn-note')?.textContent || ''), null, { timeout: 40000 }).catch(() => {});
    const done = await tabInfo(p); c(done.tier === 'Guard Dog' && /Lock confirmed: Guard Dog/.test(done.text), 'server confirms: tier refreshes to Guard Dog');
    await p.screenshot({ path: join(out, 'kennel-tab-after-lock.png') });
    // a tampered response is refused before Phantom
    const bad = await p.evaluate(async fx => { const KU = await import('/src/kennel-ui.js'), web3 = await import('@solana/web3.js');
      const tries = [{ ...fx, recipient: '11111111111111111111111111111111' }, { ...fx, cancelable: true }, { ...fx, feePayer: 'x' }, { ok: false, reason: 'nope' }];
      return tries.map(r => { try { KU.checkLockTx(r, fx.sender, web3); return 'accepted'; } catch (e) { return 'refused'; } }); }, fx);
    c(bad.every(x => x === 'refused'), 'tampered lock responses (other recipient, cancelable, other payer, error) refused before Phantom');
    c(!p.errors.length, `lock flow: no page errors ${p.errors.join(' | ')}`); await p.context().close(); }
  // ---- F: multiplayer: only cosmetic ids + name cross the wire, opponent sees them ----
  { const ctx = await (await import('playwright')).chromium.launch().then(b => b.newContext({ viewport: { width: 1280, height: 720 } }));
    const host = await ctx.newPage(), guest = await ctx.newPage(); const errs = []; for (const x of [host, guest]) x.on('pageerror', e => errs.push(e.message));
    await host.goto(srv.url + '?net=tabs&kennel=top'); await guest.goto(srv.url + '?net=tabs&kennel=pup'); await host.waitForTimeout(700);
    await host.click('#btn-host'); await host.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('lobby-code').textContent)); const code = await host.locator('#lobby-code').innerText();
    await guest.fill('#join-code', code); await guest.click('#btn-join');
    await host.waitForFunction(() => !document.getElementById('btn-ready').disabled, null, { timeout: 15000 }); await guest.waitForFunction(() => !document.getElementById('btn-ready').disabled, null, { timeout: 15000 });
    await host.waitForTimeout(700); const lobbyMood = await host.evaluate(() => document.getElementById('mood-line').dataset.screen);
    await host.click('#btn-ready'); await guest.click('#btn-ready');
    await host.waitForFunction(() => window.game.world && window.game.net, null, { timeout: 15000 }); await guest.waitForFunction(() => window.game.world && window.game.net, null, { timeout: 15000 }); await host.waitForTimeout(3000);
    const H = await host.evaluate(() => ({ me: [...(window.game.ui.cosmetics.player?.ids || [])].sort(), them: [...(window.game.ui.cosmetics.enemy?.ids || [])].sort(), name: window.game.ui.cosmetics.enemy?.name, peerKeys: Object.keys(window.game.session.peer.cos || {}), hash: window.game.sim.stateHash(window.game.world), tick: window.game.world.tick, desync: !!window.game.net.ls.desync }));
    const G = await guest.evaluate(() => ({ me: [...(window.game.ui.cosmetics.enemy?.ids || [])].sort(), them: [...(window.game.ui.cosmetics.player?.ids || [])].sort(), desync: !!window.game.net.ls.desync }));
    const top = N.activeIds(N.defaultEquip('top'), 'top').sort(), pup = N.activeIds(N.defaultEquip('pup'), 'pup').sort();
    c(JSON.stringify(H.them) === JSON.stringify(pup) && JSON.stringify(G.them) === JSON.stringify(top), `MP: host sees the guest's Pup cosmetics (${H.them.length}), guest sees the host's Top Dog cosmetics (${G.them.length})`);
    c(JSON.stringify(H.peerKeys.sort()) === '["ids","name"]', 'MP: lobby carries only cosmetic ids + name');
    c(!H.desync && !G.desync && H.tick > 20, `MP: lockstep in sync with different cosmetics on each side (tick ${H.tick})`);
    c(lobbyMood === 'lobby', 'mood line shows in the lobby');
    await host.screenshot({ path: join(out, 'kennel-mp-host.png') }); c(!errs.length, `MP: no page errors ${errs.join(' | ')}`); await ctx.browser().close(); }
  writeFileSync(join(ROOT, 'proof/kennel-flow.log'), c.lines.join('\n') + '\n'); await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
