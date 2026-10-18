// Bug amove-own-building: attack-move (Q / A-move button) onto a point over an OWN building or resource turned into a
// garrison / gather order instead of an attack-move to that point; a Shift-queued waypoint was then dropped too
// (units were not "moving"). Real input: desktop Q + left click, Shift + right click; phone A-move button + tap.
//   node scripts/ctl.mjs run amove [--root <dir>] [--video proof/amove-<tag>]   (--root: serve another tree, e.g. a worktree of the old commit)
import { startServer, newPage, closeAll, checker, argOf, shot } from '../ctl.mjs';
import { join } from 'node:path';
import { renameSync, readdirSync, mkdirSync } from 'node:fs';
const root = argOf('root', undefined), video = argOf('video', undefined), c = checker();
const s = await startServer(root ? { root } : {});
const mil = p => p.S(() => window.game.world.units.filter(u => u.owner === 'player' && u.type !== 'villager').map(u => ({ id: u.id, state: u.state, amove: !!u.amove, wp: (u.waypoints || []).length })));
for (const phone of [false, true]) {
  const p = await newPage({ phone, video });
  await p.goto(s.url + '?scenario=skirmish'); await p.waitForFunction(() => window.game.world); await p.waitForTimeout(800);
  const tag = phone ? 'phone' : 'desktop';
  const hall = await p.S(() => { const b = window.game.world.buildings.find(b => b.owner === 'player' && b.type === 'town_center'); return { x: b.x + b.size / 2, y: b.y + b.size / 2 }; });
  const q = await p.scr(hall.x, hall.y);
  await p.tap(await p.mid('#quickbar [data-q=army]'));
  if (phone) await p.tap(await p.mid('#quickbar [data-q=amove]')); else await p.keyboard.press('q');
  c(await p.S(() => window.game.qb.amove), `${tag}: attack-move armed`);
  await p.tap(q); await p.waitForTimeout(150);
  let m = await mil(p);
  c(m.length > 0 && m.every(u => u.amove && u.state === 'moving'), `${tag}: attack-move on own Den Hall = attack-move to that point (${m.map(u => u.state + (u.amove ? '+a' : '')).join(',')})`);
  c(!m.some(u => u.state === 'to_garrison'), `${tag}: attack-move never garrisons`);
  if (!phone) {
    const t = await p.scr(hall.x - 6, hall.y + 4); await p.keyboard.down('Shift'); await p.mouse.click(t.x, t.y, { button: 'right' }); await p.keyboard.up('Shift'); await p.waitForTimeout(100);
    m = await mil(p); c(m.every(u => u.wp === 1), `${tag}: Shift+right-click queues a waypoint behind the attack-move (${m.map(u => u.wp).join(',')})`);
    // plain right-click on own Den Hall still garrisons (unchanged)
    await p.mouse.click(q.x, q.y, { button: 'right' }); await p.waitForTimeout(100); m = await mil(p);
    c(m.some(u => u.state === 'to_garrison'), `${tag}: plain right-click on own Den Hall still garrisons`);
  }
  await p.S(() => window.game.tick(3)); await shot(p, join('proof', `amove-${tag}${root ? '-before' : ''}.png`));
  c(!p.errors.length, `${tag}: no page errors`);
  if (video) await p.saveVideo(join(video, `${tag}.webm`)); else await p.context().close();
}
await closeAll(); s.close(); console.log(c.fails ? `RESULT: ${c.fails} FAILED` : 'RESULT: ALL PASSED'); process.exit(c.fails ? 1 : 0);
