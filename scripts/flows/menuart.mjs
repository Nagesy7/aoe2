// Pixel-art menu proof (src/menuart.js, art/menu/*): first screen = one flattened WebP, parallax layers load after idle and
// move (clouds drift in 4 art-px steps), reduced motion stays static on the flat picture, ?art=0 = old procedural title,
// logo/buttons/icons/panels/cards drawn nearest-neighbour, home column clear of the footer / wallet / mood banner at 3 sizes.
//   ctl run menuart [--url <preview>]   -> proof/menuart.log
import { join } from 'node:path'; import { writeFileSync } from 'node:fs';
import { ROOT, base, argOf, newPage, openTitle, menuTo, checker, closeAll } from '../ctl.mjs';
const SIZES = [['844x390', { phone: true }], ['750x342', { phone: true, ctxOpts: { viewport: { width: 750, height: 342 } } }], ['1366x768', {}]];
export default async function (argv) {
  const srv = await base(argv), c = checker(), tag = argOf('tag', '', argv);
  const art = p => p.S(() => { const r = document.getElementById('title-art'); return { mode: r.dataset.art, shown: r.style.display, body: document.body.classList.contains('menu-art'),
    tf: [...r.querySelectorAll('.lyr')].map(l => l.style.transform).join(';'), drift: window.game.titleArt && window.game.titleArt.drift, cloudX: (r.querySelector('[data-l=clouds]') || {}).style?.backgroundPositionX }; });
  for (const [n, o] of SIZES) {
    const p = await newPage(o); 
    await openTitle(p, srv.url); await p.waitForFunction(() => document.readyState === 'complete' && performance.getEntriesByType('navigation')[0].loadEventEnd > 0);
    // resource timing: what was requested before the window load event (the first screen)
    const early = await p.S(() => { const L = performance.getEntriesByType('navigation')[0].loadEventEnd; return performance.getEntriesByType('resource').filter(r => r.name.includes('/art/menu/') && r.startTime <= L).map(r => r.name.split('/').pop()); });
    c(early.some(f => /^title-bg-/.test(f)) && !early.some(f => /^title-(sky|clouds|far|mid|front)-/.test(f)) && !early.some(f => /^(portrait|crest|card-frame|panel)-/.test(f)),
      `${n}: first screen loads the flattened title only (${early.filter(f => /^title-/.test(f)).join(', ')}), no layers / portraits / crests / panels before load`);
    if (o.phone) c(early.includes('title-bg-844x390.webp'), `${n}: phones get the 844x390 flattened picture first`);
    await p.waitForFunction(() => document.getElementById('title-art').dataset.art === 'layers', null, { timeout: 15000 }).catch(() => {});
    const a = await art(p); await p.waitForTimeout(1600); const b = await art(p);
    c(a.body && a.shown === 'block' && a.mode === 'layers', `${n}: 5 parallax layers loaded after idle (sky, clouds, far, mid, front)`);
    c(a.tf !== b.tf && b.drift > a.drift && b.drift % 4 === 0, `${n}: layers move (parallax) and the clouds drift in 4 px steps (${a.drift} -> ${b.drift})`);
    const ui = await p.S(() => { const box = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
      const ov = (x, y) => x && y && x.l < y.r && y.l < x.r && x.t < y.b && y.t < x.b;
      const col = ['#pg-home .logo', '#pg-home .tag', '#btn-raid', '#btn-kibble', ...['campaign', 'skirmish', 'multiplayer', 'store', 'settings'].map(k => '#m-' + k)].map(box);
      const others = [...document.querySelectorAll('body > *')].filter(e => e.id !== 'menu' && !e.contains(document.getElementById('menu')) && getComputedStyle(e).position === 'fixed' && !['title-bg', 'title-art', 'game', 'minimap', 'hud', 'msg', 'banner', 'info', 'commands', 'net', 'stall', 'desync'].includes(e.id) && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none');
      const hits = []; for (const o of others) { const r = o.getBoundingClientRect(), ob = { l: r.left, t: r.top, r: r.right, b: r.bottom }; if (col.some(x => ov(x, ob))) hits.push(o.id || o.tagName.toLowerCase()); }
      const pix = [...document.querySelectorAll('#pg-home .logo, .mi img')].map(e => getComputedStyle(e).imageRendering);
      return { inside: col.every(x => x && x.l >= 0 && x.t >= 0 && x.r <= innerWidth && x.b <= innerHeight), hits, pix: [...new Set(pix)], logo: document.querySelector('#pg-home .logo').currentSrc.split('/').pop(),
        btn: getComputedStyle(document.getElementById('m-campaign')).borderImageSource, icons: [...document.querySelectorAll('.mi img')].filter(i => i.naturalWidth === 96 && getComputedStyle(i).display !== 'none').length }; });
    c(ui.inside && !ui.hits.length, `${n}: logo + 5 buttons + chips on screen, clear of the footer / wallet / mood banner${ui.hits.length ? ' (hits ' + ui.hits.join(',') + ')' : ''}`);
    c(ui.pix.length === 1 && ui.pix[0] === 'pixelated' && /button-normal/.test(ui.btn) && ui.icons === 5, `${n}: logo ${ui.logo}, 9-slice buttons, 5 menu icons, all pixelated`);
    // hover / focus state + pressed
    await p.focus('#m-skirmish'); const hov = await p.S(() => getComputedStyle(document.getElementById('m-skirmish')).borderImageSource); c(/button-hover/.test(hov), `${n}: focused button uses the hover/focus 9-slice`);
    // setup cards, store + settings panels
    await menuTo(p, 'skirmish'); await p.waitForTimeout(800);
    const cards = await p.S(() => [...document.querySelectorAll('#civ-cards .civ-card')].map(e => ({ id: e.dataset.civ, frame: getComputedStyle(e).borderImageSource, img: (e.querySelector('.pt img') || {}).naturalWidth || 0, sel: e.classList.contains('sel') })));
    c(cards.length === 6 && cards.every(k => k.img === 256 && (k.sel ? /card-frame-selected/ : /card-frame-256/).test(k.frame)), `${n}: 6 clan cards with portraits + card frames (selected frame on the pick)`);
    const crest = await p.S(() => getComputedStyle(document.getElementById('civ-info'), '::before').backgroundImage); c(/crest-/.test(crest), `${n}: picked clan's crest beside its traits`);
    await menuTo(p, 'store'); await p.press('[data-stab=shop]'); await p.waitForTimeout(500);
    const st = await p.S(() => { const pg = getComputedStyle(document.getElementById('pg-store')), n = document.querySelector('#store-foot .kshop-note'), r = n.getBoundingClientRect();
      return { src: pg.borderImageSource, rep: pg.borderImageRepeat, note: r.width > 0 && r.bottom <= innerHeight && getComputedStyle(n).color }; });
    c(/panel-parchment/.test(st.src) && st.rep === 'repeat' && st.note, `${n}: Store = parchment 9-slice (centre repeats), risk note on screen (${st.note})`);
    await menuTo(p, 'settings'); await p.waitForTimeout(300);
    const se = await p.S(() => { const pg = getComputedStyle(document.getElementById('pg-settings')); return { src: pg.borderImageSource, rep: pg.borderImageRepeat, icons: [...document.querySelectorAll('.msets h3 .si')].filter(i => i.naturalWidth === 64).length }; });
    c(/panel-wood/.test(se.src) && se.rep === 'repeat' && se.icons === 3, `${n}: Settings = wood 9-slice (centre repeats), 3 section icons`);
    c(!p.errors.length, `${n}: no page errors ${p.errors.join(' | ')}`); await p.context().close();
  }
  { const p = await newPage({ phone: true, ctxOpts: { reducedMotion: 'reduce' } }), got = []; p.on('request', r => { if (/\/art\/menu\/title-/.test(r.url())) got.push(r.url().split('/').pop()); });
    await openTitle(p, srv.url); await p.waitForTimeout(3500); const a = await art(p);
    c(a.mode === 'flat' && !got.some(f => /^title-(sky|clouds|far|mid|front)-/.test(f)) && !a.tf.replace(/;/g, ''), `reduced motion: static flattened picture, no parallax layers fetched (${got.join(', ')})`);
    await p.context().close(); }
  { const p = await newPage({ phone: true }); await openTitle(p, srv.url, '?art=0'); await p.waitForTimeout(800); const a = await art(p);
    const wm = await p.S(() => getComputedStyle(document.querySelector('#pg-home .wm')).display);
    c(!a.body && a.shown !== 'block' && wm !== 'none', '?art=0: old procedural title + text heading'); await p.context().close(); }
  await closeAll(); srv.close(); console.log(c.fails ? `MENUART: ${c.fails} FAILED` : 'MENUART: ALL PASSED');
  writeFileSync(join(ROOT, `proof/menuart${tag ? '-' + tag : ''}.log`), c.lines.join('\n') + '\n'); return c.fails ? 1 : 0;
}
