// Item 7: clan-select card A/B (default = b trait-first card since Oct 18; ?ui=a art card, ?ui=b explicit) at 844x390 and 1366x768.
// Screenshots the menu + the card grid, measures what a player can read without hovering, and that picking still works.
import { join } from 'node:path'; import { writeFileSync } from 'node:fs';
import { ROOT, base, newPage, openTitle, checker, shot, closeAll, SHOTS } from '../ctl.mjs';
export default async function (argv) {
  const srv = await base(argv); const c = checker(); const out = [];
  for (const [phone, name] of [[true, '844x390'], [false, '1366x768']]) for (const [v, q] of [['a', '?ui=a'], ['b', '?ui=b'], ['b', '']]) {
    const p = await newPage({ phone }); await openTitle(p, srv.url, q); const tag = q ? v : 'default'; await p.waitForTimeout(500);
    const m = await p.S(() => { const g = document.getElementById('civ-cards'), r = g.getBoundingClientRect(); const cards = [...g.querySelectorAll('.civ-card')];
      const vis = cards.filter(e => { const b = e.getBoundingClientRect(); return b.right <= Math.min(innerWidth, r.right) + 1 && b.left >= r.left - 1 && b.bottom <= innerHeight + 1 && b.top >= 0; }).length;
      return { ui: g.dataset.ui, cards: cards.length, fullyVisible: vis, gridW: Math.round(r.width), gridH: Math.round(r.height), hScroll: g.scrollWidth > g.clientWidth + 1,
        text: cards[0].innerText.replace(/\s+/g, ' ').trim(), minFont: Math.min(...cards.flatMap(e => [...e.querySelectorAll('*')].filter(x => x.childNodes.length && [...x.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && x.offsetParent).map(x => parseFloat(getComputedStyle(x).fontSize)))) }; });
    c(m.ui === v && m.cards === 6, `${name} ${q || '(no ?ui)'}: 6 clan cards rendered, expect variant ${v}, got ${m.ui}`);
    await p.locator('#civ-cards .civ-card[data-civ=kai]').scrollIntoViewIfNeeded(); await p.tap(await p.mid('#civ-cards .civ-card[data-civ=kai]')); c((await p.inputValue('#civ')) === 'kai', `${name} ${q || '(no ?ui)'}: ${phone ? 'tap' : 'click'} picks Kai`);
    await p.S(() => document.getElementById('menu').scrollTo(0, 0)); await p.waitForTimeout(150);
    await shot(p, join(SHOTS, `oct18-ui-${tag}-menu-${name}.png`)); await p.locator('#civ-cards').screenshot({ path: join(SHOTS, `oct18-ui-${tag}-cards-${name}.png`) });
    c(!p.errors.length, `${name} ${q || '(no ?ui)'}: no page errors ${p.errors.join(' | ')}`);
    out.push({ viewport: name, query: q || '(none)', ...m }); await p.context().close();
  }
  for (const r of out) c(true, `${r.viewport} ${r.query} -> ui=${r.ui}: grid ${r.gridW}x${r.gridH}, ${r.fullyVisible}/6 fully on screen, h-scroll ${r.hScroll}, min font ${r.minFont}px, card text: "${r.text.slice(0, 110)}"`);
  writeFileSync(join(ROOT, 'proof/ui-variants.json'), JSON.stringify(out, null, 1)); writeFileSync(join(ROOT, 'proof/ui-variants.log'), c.lines.join('\n') + '\n');
  await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
