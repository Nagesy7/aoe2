// Phase 3 proof: corner minimap in phone landscape. Real tap on the minimap moves the camera; layout does not collide.
import { join } from 'node:path'; import { writeFileSync } from 'node:fs';
import { ROOT, base, newPage, openTitle, startSkirmish, select, checker, shot, closeAll, SHOTS } from '../ctl.mjs';
const over = (a, b) => a && b && a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
export default async function (argv) {
  const srv = await base(argv); const c = checker();
  for (const [phone, name] of [[true, '844x390'], [false, '1366x768']]) {
    const p = await newPage({ phone }); await openTitle(p, srv.url); await startSkirmish(p); await select(p, 'villager');
    if (phone) await p.press('#cmdtab'); await p.waitForTimeout(300);
    const vp = p.viewportSize(); const bb = async s => (await p.locator(s).isVisible()) ? p.locator(s).boundingBox() : null;
    const mm = await bb('#minimap'); c(mm && mm.x >= 0 && mm.y >= 0 && mm.x + mm.width <= vp.width && mm.y + mm.height <= vp.height, `${name}: minimap visible in the corner (${mm && `${Math.round(mm.x)},${Math.round(mm.y)} ${Math.round(mm.width)}x${Math.round(mm.height)}`})`);
    for (const s of ['#hud', '#quickbar', '#info', '#commands', '#cmdtab', '#touchbar']) { const b = await bb(s); if (b) c(!over(mm, b), `${name}: minimap does not overlap ${s}`); }
    const painted = await p.S(() => { const d = document.getElementById('minimap').getContext('2d').getImageData(0, 0, 208, 208).data; let blue = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i] < 120) blue++; return blue; });
    c(painted > 4, `${name}: own Den Hall / Worker Pups drawn in team blue (${painted} px)`);
    const cam0 = await p.S(() => ({ ...window.game.cam })); await p.tap({ x: mm.x + mm.width * 0.8, y: mm.y + mm.height * 0.8 }); await p.waitForTimeout(150);
    const cam1 = await p.S(() => ({ ...window.game.cam })); c(cam1.x > cam0.x + 50 && cam1.y > cam0.y + 50, `${name}: ${phone ? 'tap' : 'click'} on the minimap moves the camera (${Math.round(cam0.x)},${Math.round(cam0.y)} -> ${Math.round(cam1.x)},${Math.round(cam1.y)})`);
    c((await p.S(() => window.game.world.selection)) !== null, `${name}: minimap tap keeps the selection (does not reach the map)`);
    await shot(p, join(SHOTS, `oct18-phase3-minimap-${name}.png`)); c(!p.errors.length, `${name}: no page errors ${p.errors.join(' | ')}`); await p.context().close();
  }
  writeFileSync(join(ROOT, 'proof/phase3-minimap.log'), c.lines.join('\n') + '\n'); await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
