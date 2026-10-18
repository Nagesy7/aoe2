import { newPage, openTitle, shot, closeAll } from '/workspace/aoe2/scripts/ctl.mjs';
const URL = 'https://inu-empires.vercel.app/'; let fails = 0; const L = s => { console.log(s); if (s.startsWith('FAIL')) fails++; };
for (const [phone, name] of [[true, '844x390'], [false, '1366x768']]) {
  const p = await newPage({ phone }); await openTitle(p, URL, ''); await p.waitForTimeout(800);
  await p.S(() => document.getElementById('menu').scrollTo(0, 0)); const m = await p.evaluate(() => { const g = document.getElementById('civ-cards'), r = g.getBoundingClientRect(); const cards = [...g.querySelectorAll('.civ-card')];
    const h1 = document.querySelector('#menu h1').getBoundingClientRect(), tag = document.querySelector('#menu .tag').getBoundingClientRect(), ai = document.getElementById('btn-ai').getBoundingClientRect();
    return { h1Top: Math.round(h1.top), tagBottom: Math.round(tag.bottom), aiBottom: Math.round(ai.bottom), build: window.BUILD_ID, vw: innerWidth, vh: innerHeight, ui: g.dataset.ui, cards: cards.length, shields: g.querySelectorAll('canvas.shield').length,
      onScreen: cards.filter(e => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1; }).length, text: cards[0]?.innerText.replace(/\s+/g, ' ').trim() }; });
  L(`${m.ui === 'b' && m.cards === 6 && m.shields === 6 && m.h1Top >= 0 && m.tagBottom <= m.vh ? 'PASS' : 'FAIL'}: live ${name} (viewport ${m.vw}x${m.vh}) title h1 top ${m.h1Top}, tag bottom ${m.tagBottom}, Skirmish bottom ${m.aiBottom}; no ?ui -> data-ui=${m.ui}, ${m.cards} cards, ${m.shields} shield canvases, ${m.onScreen}/6 fully on screen, build ${m.build}; card 1: "${m.text}"`);
  const f = `/workspace/inu-empires-shots/oct18-cleanup-live-${name}.png`; await shot(p, f); L(`shot ${f}`);
  if (p.errors?.length) L(`FAIL: page errors ${p.errors.join(' | ')}`); await p.context().close();
}
{ const p = await newPage({ phone: false }); await openTitle(p, URL, '?ui=a'); const ui = await p.evaluate(() => document.getElementById('civ-cards').dataset.ui); L(`${ui === 'a' ? 'PASS' : 'FAIL'}: live ?ui=a still renders layout a (data-ui=${ui})`); await p.context().close(); }
await closeAll(); L(fails ? `RESULT: ${fails} FAILED` : 'RESULT: ALL PASSED'); process.exit(fails ? 1 : 0);
