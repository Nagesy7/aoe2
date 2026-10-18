// Menu fit: at common viewports the title (h1 + tag) is fully on screen at load, the panel is not clipped above the
// viewport, and every menu control can be reached (scrolling the menu if it is taller than the screen). Default (b) + ?ui=a.
// -> proof/menufit.{json,log}, shots /workspace/inu-empires-shots/oct18-menufit-<ui>-<WxH>.png
import { join } from 'node:path'; import { writeFileSync } from 'node:fs';
import { ROOT, base, newPage, openTitle, checker, shot, closeAll, SHOTS, PHONE } from '../ctl.mjs';
const SIZES = [[1366, 768, 0], [1280, 720, 0], [1440, 900, 0], [1536, 864, 0], [1920, 1080, 0], [1024, 768, 0], [1280, 800, 0],
  [844, 390, 1], [667, 375, 1], [932, 430, 1], [390, 844, 1], [768, 1024, 1]];
export default async function (argv) {
  const srv = await base(argv); const c = checker(); const out = [];
  for (const [w, h, touch] of SIZES) for (const q of ['', '?ui=a']) {
    const name = `${w}x${h}`, ui = q ? 'a' : 'default';
    const p = await newPage({ phone: !!touch, ctxOpts: { viewport: { width: w, height: h } } }); await openTitle(p, srv.url, q); await p.waitForTimeout(400);
    const m = await p.S(() => { const menu = document.getElementById('menu'), r = e => e.getBoundingClientRect(), h1 = r(menu.querySelector('h1')), tag = r(menu.querySelector('.tag')), pan = r(menu.querySelector('.panel'));
      const btns = [...menu.querySelectorAll('button[id^=btn-]')].filter(b => b.offsetParent);
      return { scrollTop: Math.round(menu.scrollTop), h1Top: Math.round(h1.top), h1Bottom: Math.round(h1.bottom), tagBottom: Math.round(tag.bottom), panelTop: Math.round(pan.top), panelH: Math.round(pan.height),
        scrollable: menu.scrollHeight > menu.clientHeight + 1, overflowY: getComputedStyle(menu).overflowY, ids: btns.map(b => b.id) }; });
    c(m.h1Top >= 0 && m.tagBottom <= h && m.panelTop >= 0, `${name} ${ui}: title on screen at load (h1 top ${m.h1Top}, tag bottom ${m.tagBottom}, panel top ${m.panelTop}, panel h ${m.panelH}, menu scrollTop ${m.scrollTop})`);
    // every visible menu button reachable: scroll it into view inside the menu, centre point hits the button
    const miss = []; for (const id of m.ids) { await p.locator('#' + id).scrollIntoViewIfNeeded().catch(() => {}); const ok = await p.S(id => { const b = document.getElementById(id), r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return r.top >= -1 && r.bottom <= innerHeight + 1 && (e === b || b.contains(e)); }, id); if (!ok) miss.push(id); }
    c(!miss.length, `${name} ${ui}: all ${m.ids.length} menu buttons reachable${m.scrollable ? ' (menu scrolls)' : ' (fits, no scroll)'}${miss.length ? ' MISSING ' + miss.join(',') : ''}`);
    await p.S(() => document.getElementById('menu').scrollTo(0, 0)); await p.waitForTimeout(100);
    c(!p.errors.length, `${name} ${ui}: no page errors ${p.errors.join(' | ')}`);
    if (['1366x768', '844x390', '1280x720', '390x844'].includes(name)) await shot(p, join(SHOTS, `oct18-menufit-${ui}-${name}.png`));
    out.push({ viewport: name, ui, ...m, unreachable: miss }); await p.context().close();
  }
  writeFileSync(join(ROOT, `proof/menufit${argv.includes('--tag') ? '-' + argv[argv.indexOf('--tag') + 1] : ''}.json`), JSON.stringify(out, null, 1));
  writeFileSync(join(ROOT, `proof/menufit${argv.includes('--tag') ? '-' + argv[argv.indexOf('--tag') + 1] : ''}.log`), c.lines.join('\n') + '\n');
  await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
