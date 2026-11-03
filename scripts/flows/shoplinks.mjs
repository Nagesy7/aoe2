// Shop / For devs links + results nudge, in a real browser. Usage: ctl run shoplinks [--url U] [--shots DIR]
// Menu: both links under the buttons, new tab + noopener, on screen at 844x390 / 750x342 / 1366x768 (art and ?art=0), click fires a
// wallet-free paid_link_click. Nudge: never on the title, a lobby or mid-match; shows on the victory/defeat overlay once per session.
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
import { ROOT, base, newPage, openTitle, startSkirmish, checker, closeAll, argOf, SHOTS } from '../ctl.mjs';
export default async function (argv) {
  const srv = await base(argv), c = checker(), out = argOf('shots', SHOTS, argv); mkdirSync(out, { recursive: true });
  const SIZES = [['844x390', { phone: true }], ['750x342', { phone: true, ctxOpts: { viewport: { width: 750, height: 342 } } }], ['1366x768', {}]];
  const nudge = p => p.S(() => { const e = document.getElementById('shop-nudge'); return e && !e.hidden ? { text: e.querySelector('p').textContent, go: e.querySelector('.sn-go').href, goT: e.querySelector('.sn-go').textContent, no: e.querySelector('.sn-no').textContent, devs: /for-devs/i.test(e.innerHTML) } : null; });
  for (const [n, o] of SIZES) for (const q of ['', '?art=0']) {
    const p = await newPage(o); await openTitle(p, srv.url, q); await p.waitForTimeout(q ? 800 : 2500); const tag = `${n}${q ? ' art=0' : ''}`;
    const m = await p.S(() => { const r = id => { const e = document.getElementById(id), b = e.getBoundingClientRect(); return { href: e.href, t: e.target, rel: e.rel, txt: e.textContent, title: e.title, b: [b.left, b.top, b.right, b.bottom].map(Math.round) }; };
      const s = r('m-shop'), d = r('m-devs'), set = document.getElementById('m-settings').getBoundingClientRect(), foot = [...document.querySelectorAll('body > *')].find(e => /Terms/.test(e.textContent || '') && getComputedStyle(e).position === 'fixed');
      const fb = foot?.getBoundingClientRect(); return { s, d, setBottom: Math.round(set.bottom), W: innerWidth, H: innerHeight, scroll: document.getElementById('menu').scrollHeight - document.getElementById('menu').clientHeight, foot: fb ? [fb.left, fb.top, fb.right, fb.bottom].map(Math.round) : null }; });
    const on = b => b[0] >= 0 && b[1] >= 0 && b[2] <= m.W && b[3] <= m.H, hit = (a, b) => b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    c(m.s.txt === '🛍️ Shop' && m.d.txt === '🛠️ For devs' && m.s.title === 'Optional cosmetics. $KIBBLE is never needed to play.' && m.s.t === '_blank' && m.d.t === '_blank' && m.s.rel === 'noopener' && m.d.rel === 'noopener'
      && m.s.href === 'https://kibbleinu.com/pay?utm_source=inu-empires&utm_medium=menu#shop-h' && m.d.href === 'https://kibbleinu.com/for-devs.html?utm_source=inu-empires&utm_medium=menu', `${tag}: Shop + For devs links (copy, URLs, new tab, noopener)`);
    c(on(m.s.b) && on(m.d.b) && m.s.b[1] >= m.setBottom - 1 && m.s.b[1] === m.d.b[1] && !hit(m.s.b, m.foot) && !hit(m.d.b, m.foot) && m.scroll <= 2, `${tag}: links on screen, one row under Settings, clear of the footer, no scroll (shop ${m.s.b}, devs ${m.d.b}, settings bottom ${m.setBottom}, footer ${m.foot})`);
    if (n !== '750x342') await p.screenshot({ path: join(out, `shoplinks-menu${q ? '-art0' : ''}-${n}.png`) });
    if (!q && n === '844x390') { // click: analytics props + new tab
      await p.S(() => { window.__va = []; window.va = (...a) => window.__va.push(JSON.parse(JSON.stringify(a))); });
      const [tab] = await Promise.all([p.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), p.click('#m-shop')]); if (tab) await tab.close().catch(() => {});
      await p.click('#m-devs').catch(() => {}); await p.waitForTimeout(400); for (const t of p.context().pages()) if (t !== p) await t.close().catch(() => {});
      const ev = await p.S(() => window.__va);
      c(ev.length === 2 && ev[0][0] === 'event' && JSON.stringify(ev[0][1]) === JSON.stringify({ name: 'paid_link_click', data: { product: 'shop', from: 'inu-empires-menu', site: 'inu-empires' } }) && ev[1][1].data.product === 'for-devs' && !!tab,
        `${tag}: clicks open a new tab and send paid_link_click {product, from, site} only (${JSON.stringify(ev.map(e => e[1].data))})`);
      await p.S(() => { delete window.va; }); await p.click('#m-devs').catch(() => {}); await p.waitForTimeout(300); for (const t of p.context().pages()) if (t !== p) await t.close().catch(() => {});
      c(!p.errors.length, `${tag}: va missing -> click still works, no errors`);
    }
    if (!q && n !== '750x342') {
      c(!(await nudge(p)), `${n}: no nudge on the title`);
      await startSkirmish(p); await p.waitForTimeout(800); c(!(await nudge(p)), `${n}: no nudge mid-match`);
      await p.S(() => { window.game.world.winner = 'player'; window.game.world.banner = { text: 'Victory!', until: 1e9 }; window.game.tick(0.05); }); await p.waitForTimeout(600);
      const g = await nudge(p), seen = await p.S(() => sessionStorage.getItem('inu.shopNudge'));
      c(g && g.text === 'Like your look? Outfits, pets and cars for every Inu game are in the Kibble Pay shop. Optional, and never needed to play.' && g.goT === 'Visit the shop →' && g.no === 'Not now'
        && g.go === 'https://kibbleinu.com/pay?utm_source=inu-empires&utm_medium=results#shop-h' && !g.devs && seen === '1', `${n}: victory overlay shows the nudge (results URL, no dev products, session flag set)`);
      await p.screenshot({ path: join(out, `shoplinks-results-${n}.png`) });
      await p.click('#shop-nudge .sn-no'); await p.waitForTimeout(200); c(!(await nudge(p)), `${n}: Not now closes it`);
      await p.S(() => { window.game.world.winner = null; window.game.world.banner = null; window.game.tick(0.05); }); await p.waitForTimeout(200);
      await p.S(() => { window.game.world.winner = 'ai'; window.game.world.banner = { text: 'Defeat! Your Den Hall has fallen.', until: 1e9 }; window.game.tick(0.05); }); await p.waitForTimeout(400);
      c(!(await nudge(p)), `${n}: once per session (second result screen: no nudge)`);
      c(!p.errors.length, `${n}: no page errors ${p.errors.join(' | ')}`);
    }
    await p.context().close();
  }
  writeFileSync(join(ROOT, 'proof/shoplinks.log'), c.lines.join('\n') + '\n'); await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
