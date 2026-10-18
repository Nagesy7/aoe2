// Phase 2 proof: icon resource bar fits at 844x390 (no clipping, nothing under the wallet/home widgets), worst-case values.
import { join } from 'node:path'; import { writeFileSync } from 'node:fs';
import { ROOT, base, newPage, openTitle, startSkirmish, checker, shot, closeAll, SHOTS } from '../ctl.mjs';
export default async function (argv) {
  const srv = await base(argv); const c = checker();
  for (const [phone, name] of [[true, '844x390'], [false, '1366x768']]) {
    const p = await newPage({ phone }); await openTitle(p, srv.url); await startSkirmish(p);
    // worst case (setup only): 5-digit stockpile, full pop text, last age
    await p.S(() => { const w = window.game.world; for (const r of Object.keys(w.stockpile)) w.stockpile[r] = 99999; const ages = window.game.sim.AGES; w.age = ages[ages.length - 1]; window.game.tick(0.05); });
    await p.waitForTimeout(200);
    const m = await p.S(() => { const hud = document.getElementById('hud'), hr = hud.getBoundingClientRect(), cs = getComputedStyle(hud);
      const limit = hr.right - parseFloat(cs.paddingRight) + 1; const spans = [...hud.children].filter(e => getComputedStyle(e).display !== 'none').map(e => { const r = e.getBoundingClientRect(); return { id: e.id, right: r.right, w: r.width, text: e.innerText }; });
      const widgets = [...document.querySelectorAll('body > *')].filter(e => !['hud', 'game', 'title-bg'].includes(e.id) && getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().top < hr.bottom && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().left > innerWidth / 2).map(e => e.getBoundingClientRect().left);
      return { limit, spans, widgetLeft: widgets.length ? Math.min(...widgets) : innerWidth, scroll: hud.scrollWidth > hud.clientWidth + 1 }; });
    const last = m.spans[m.spans.length - 1];
    c(!m.scroll, `${name}: resource bar content fits (no overflow clipping)`);
    c(m.spans.every(s => s.right <= m.limit), `${name}: every item inside the bar (${m.spans.map(s => `${s.id}:${s.text.replace(/\s+/g, ' ')}`).join(' | ')})`);
    c(last.right <= m.widgetLeft, `${name}: last item ends at ${Math.round(last.right)}px, left of the wallet/home widgets at ${Math.round(m.widgetLeft)}px`);
    c(await p.S(() => /Food: 99999/.test(document.getElementById('hud').innerText) || !!document.querySelector('#res-food[title=Food]')), `${name}: icons keep an accessible label (title / screen-reader text)`);
    await shot(p, join(SHOTS, `oct18-phase2-hud-${name}.png`)); c(!p.errors.length, `${name}: no page errors ${p.errors.join(' | ')}`); await p.context().close();
  }
  writeFileSync(join(ROOT, 'proof/phase2-hud.log'), c.lines.join('\n') + '\n'); await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
