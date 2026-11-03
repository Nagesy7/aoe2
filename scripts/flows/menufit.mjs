// Menu fit: at common viewports the title (h1 + tag) is fully on screen at load, the five main entries (Campaign · Skirmish · Multiplayer · Store · Settings)
// fit without scrolling in landscape, each mode's start button is above the fold on phone landscape (incl. 750x342 / 568x320), and every button on every
// menu page can be reached (scrolling the menu if it is taller than the screen). Default (b) + ?ui=a.
// -> proof/menufit.{json,log}, shots /workspace/inu-empires-shots/oct18-menufit-<ui>-<WxH>.png
import { join } from 'node:path'; import { writeFileSync } from 'node:fs';
import { ROOT, base, newPage, openTitle, checker, shot, closeAll, SHOTS, PHONE } from '../ctl.mjs';
const SIZES = [[1366, 768, 0], [1280, 720, 0], [1440, 900, 0], [1536, 864, 0], [1920, 1080, 0], [1024, 768, 0], [1280, 800, 0],
  [844, 390, 1], [750, 342, 1], [568, 320, 1], [863, 360, 1], [667, 375, 1], [932, 430, 1], [390, 844, 1], [768, 1024, 1]];
export default async function (argv) {
  const srv = await base(argv); const c = checker(); const out = [];
  for (const [w, h, touch] of SIZES) for (const q of ['', '?ui=a']) {
    const name = `${w}x${h}`, ui = q ? 'a' : 'default';
    const p = await newPage({ phone: !!touch, ctxOpts: { viewport: { width: w, height: h } } }); await openTitle(p, srv.url, q); await p.waitForTimeout(400);
    // reachable: scrolled into view inside the menu, its centre point hits it (not covered)
    const reach = async ids => { const miss = []; for (const id of ids) { await p.locator('#' + id).scrollIntoViewIfNeeded().catch(() => {}); const ok = await p.S(id => { const b = document.getElementById(id), r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 && (e === b || b.contains(e)); }, id); if (!ok) miss.push(id); } await p.S(() => document.getElementById('menu').scrollTo(0, 0)); return miss; };
    const vis = () => p.S(() => [...document.querySelectorAll('#menu button[id]')].filter(b => b.offsetParent && !b.closest('[hidden]')).map(b => b.id));
    const m = await p.S(() => { const menu = document.getElementById('menu'), r = e => e.getBoundingClientRect(), h1 = r(menu.querySelector('h1')), tag = r(menu.querySelector('.tag')), pan = r(document.getElementById('pg-home'));
      const navs = [...menu.querySelectorAll('.mnav')].map(b => ({ id: b.id, label: b.querySelector('b').textContent, bottom: Math.round(r(b).bottom), right: Math.round(r(b).right) }));
      return { scrollTop: Math.round(menu.scrollTop), h1Top: Math.round(h1.top), h1Bottom: Math.round(h1.bottom), tagBottom: Math.round(tag.bottom), panelTop: Math.round(pan.top), panelH: Math.round(pan.height), panelRight: Math.round(pan.right),
        navs, scrollable: menu.scrollHeight > menu.clientHeight + 1, overflowY: getComputedStyle(menu).overflowY }; });
    c(m.h1Top >= 0 && m.tagBottom <= h && m.panelTop >= 0, `${name} ${ui}: title on screen at load (h1 top ${m.h1Top}, tag bottom ${m.tagBottom}, panel top ${m.panelTop}, panel h ${m.panelH}, menu scrollTop ${m.scrollTop})`);
    c(m.navs.map(n => n.label).join(',') === 'Campaign,Skirmish,Multiplayer,Store,Settings', `${name} ${ui}: main menu = ${m.navs.map(n => n.label).join(' · ')}`);
    if (w > h) c(m.navs.every(n => n.bottom <= h && n.right <= w) && m.panelRight <= w, `${name} ${ui}: all five entries on screen without scrolling (lowest ${Math.max(...m.navs.map(n => n.bottom))} <= ${h})`);
    const pages = {}; let miss = await reach(await vis()); pages.home = { ids: await vis(), miss };
    for (const [entry, main] of [['campaign', 'btn-sp'], ['skirmish', 'btn-ai'], ['multiplayer', 'btn-host'], ['store', null], ['settings', null]]) {
      await p.S(() => window.game.menu.show('home')); await p.waitForTimeout(80); await p.press('#m-' + entry); await p.waitForTimeout(250);
      if (main && touch && w > h) { await p.selectOption('#civ', 'shikoku'); const b = await p.S(id => Math.round(document.getElementById(id).getBoundingClientRect().bottom), main); await p.selectOption('#civ', 'shiba');
        c(b <= h, `${name} ${ui}: ${entry} start button #${main} above the fold (bottom ${b} <= ${h}, longest clan line)`); }
      const ids = await vis(); miss = await reach(ids); pages[entry] = { ids, miss };
      if (['844x390', '750x342', '1366x768', '390x844'].includes(name) && ui === 'default') await shot(p, join(SHOTS, `menufit-${entry}-${name}.png`)); }
    const allMiss = Object.entries(pages).flatMap(([k, v]) => v.miss.map(id => k + ':' + id)), n = Object.values(pages).reduce((a, v) => a + v.ids.length, 0);
    c(!allMiss.length, `${name} ${ui}: all ${n} buttons on 6 menu pages reachable${allMiss.length ? ' MISSING ' + allMiss.join(',') : ''}`);
    await p.S(() => window.game.menu.show('home')); await p.waitForTimeout(100);
    c(!p.errors.length, `${name} ${ui}: no page errors ${p.errors.join(' | ')}`);
    if (['1366x768', '844x390', '1280x720', '390x844'].includes(name)) await shot(p, join(SHOTS, `oct18-menufit-${ui}-${name}.png`));
    out.push({ viewport: name, ui, ...m, pages }); await p.context().close();
  }
  writeFileSync(join(ROOT, `proof/menufit${argv.includes('--tag') ? '-' + argv[argv.indexOf('--tag') + 1] : ''}.json`), JSON.stringify(out, null, 1));
  writeFileSync(join(ROOT, `proof/menufit${argv.includes('--tag') ? '-' + argv[argv.indexOf('--tag') + 1] : ''}.log`), c.lines.join('\n') + '\n');
  await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
