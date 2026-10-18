// Phase 4 proof (phone landscape, real CDP touch): long-press tooltips, collapsible quick bar, compact info panel (<420px tall).
import { join } from 'node:path'; import { writeFileSync } from 'node:fs';
import { ROOT, base, newPage, openTitle, startSkirmish, select, checker, shot, closeAll, SHOTS } from '../ctl.mjs';
export default async function (argv) {
  const srv = await base(argv); const c = checker(); const p = await newPage({ phone: true });
  await p.goto(srv.url); await p.evaluate(() => localStorage.removeItem('inu-qb-collapsed')); await openTitle(p, srv.url); await startSkirmish(p);
  const tipState = () => p.S(() => window.game.touchTips.state());
  // long-press a touchbar button: tooltip, and the button does NOT fire
  const boxBtn = await p.mid('#touchbar [data-t=box]'); const before = await p.S(() => window.game.touch.box);
  await p.touch('touchStart', [boxBtn]); await p.waitForTimeout(650); let t = await tipState(); await shot(p, join(SHOTS, 'oct18-phase4-longpress-tip-844x390.png'));
  await p.touch('touchEnd', []); await p.waitForTimeout(150);
  c(t.visible && /Box select/.test(t.text), `long-press "Box select" shows its tooltip ("${t.text}")`);
  c((await p.S(() => window.game.touch.box)) === before, 'the long-press does not toggle Box select (peek only)');
  await p.tap(boxBtn); c((await p.S(() => window.game.touch.box)) !== before, 'a normal tap still toggles Box select'); await p.tap(boxBtn);
  // control-group buttons keep their own long-press (save group), no tooltip
  await select(p, 'villager'); const g1 = await p.mid('#quickbar [data-g="1"]'); await p.touch('touchStart', [g1]); await p.waitForTimeout(650); t = await tipState(); await p.touch('touchEnd', []); await p.waitForTimeout(100);
  c(!t.visible && ((await p.S(() => window.game.qb.groups[1])) || []).length === 1, 'long-press on group 1 still saves the group, no tooltip');
  // collapsible quick bar
  const w0 = (await p.locator('#quickbar').boundingBox()).width; await p.tap(await p.mid('#qb-toggle')); await p.waitForTimeout(100);
  const vis = await p.S(() => [...document.querySelectorAll('#quickbar button')].filter(b => b.offsetWidth > 0).map(b => b.id || b.dataset.q || b.dataset.g));
  const w1 = (await p.locator('#quickbar').boundingBox()).width; c(vis.join() === 'qb-toggle,idle' && w1 < w0 / 2, `quick bar collapses to toggle + Idle (${Math.round(w0)}px -> ${Math.round(w1)}px; visible: ${vis})`);
  await shot(p, join(SHOTS, 'oct18-phase4-quickbar-collapsed-844x390.png'));
  await p.reload(); await p.waitForFunction(() => window.game); await startSkirmish(p); c(await p.S(() => document.getElementById('quickbar').classList.contains('collapsed')), 'collapsed state remembered after reload');
  await p.tap(await p.mid('#qb-toggle')); c(!(await p.S(() => document.getElementById('quickbar').classList.contains('collapsed'))), 'tap again expands');
  // compact info panel below 420 px height
  await select(p, 'villager'); await p.waitForTimeout(150);
  const info = await p.S(() => { const e = document.getElementById('info'), r = e.getBoundingClientRect(); return { fs: getComputedStyle(e).fontSize, h: r.height, w: r.width }; });
  c(info.fs === '11px' && info.h <= 120, `info panel compact at 390px tall (font ${info.fs}, ${Math.round(info.w)}x${Math.round(info.h)})`);
  await shot(p, join(SHOTS, 'oct18-phase4-compact-info-844x390.png'));
  const p2 = await newPage({ phone: true, ctxOpts: { viewport: { width: 932, height: 430 } } }); await openTitle(p2, srv.url); await startSkirmish(p2); await select(p2, 'villager'); await p2.waitForTimeout(150);
  const fs2 = await p2.S(() => getComputedStyle(document.getElementById('info')).fontSize); c(fs2 === '12px', `taller phone (932x430) keeps the regular landscape info (font ${fs2})`);
  c(!p.errors.length && !p2.errors.length, `no page errors ${[...p.errors, ...p2.errors].join(' | ')}`);
  writeFileSync(join(ROOT, 'proof/phase4-touchui.log'), c.lines.join('\n') + '\n'); await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
