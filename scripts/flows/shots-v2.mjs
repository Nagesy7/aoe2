// Phone-landscape screenshots of water/fishing, the new unit sprites and villager work poses (ctl flow).
// Usage: node scripts/ctl.mjs run shots-v2 [--url U] [--prefix /workspace/inu-empires-shots/v2]
import { existsSync, statSync } from 'node:fs';
import { base, newPage, openTitle, checker, closeAll, argOf } from '../ctl.mjs';
export default async function (argv) {
  const srv = await base(argv), c = checker(), pre = argOf('prefix', '/workspace/inu-empires-shots/v2', argv);
  const p = await newPage({ phone: true }); await openTitle(p, srv.url, '?enemy=0');
  await p.evaluate(() => document.getElementById('btn-sp').click()); await p.waitForTimeout(2500);
  const look = (tx, ty) => p.evaluate(([tx, ty]) => { const g = window.game, Z = g.zoom(); g.cam.x = tx * 32 - innerWidth / 2 / Z; g.cam.y = ty * 32 - innerHeight / 2 / Z; g.tick(0.05); }, [tx, ty]);
  await p.evaluate(() => { const g = window.game, S = g.sim, w = g.world, vs = w.units.filter(u => u.type === 'villager');
    S.addBuilding(w, 'mill', 20, 50, true, 'player'); const fish = w.resources.filter(n => n.kind === 'fish'); for (let i = 0; i < 4; i++) { const v = S.spawnEnemy(w, 'villager', 19.5 + i, 48.5); v.owner = 'player'; S.orderGather(w, v, fish[i % fish.length]); }
    const kinds = ['tree', 'gold_mine', 'berries', 'stone_mine']; vs.forEach((v, i) => { const n = w.resources.find(r => r.kind === kinds[i % 4]); S.orderGather(w, v, n); });
    for (let i = 0; i < 3; i++) { const v = S.spawnEnemy(w, 'villager', 30.5 + i, 37.5); v.owner = 'player'; S.orderGather(w, v, w.resources.find(r => r.kind === kinds[(i + 1) % 4])); }
    const types = ['halberd_pup', 'swift_rider', 'blade_paw', 'crossbowman', 'kishu_longbow', 'red_fang', 'akita_guardian', 'boar_rider', 'frost_guard', 'brindle_striker'];
    types.forEach((t, i) => { const u = S.spawnEnemy(w, t, 26.5 + (i % 5) * 1.6, 27.5 + Math.floor(i / 5) * 1.8); u.owner = 'player'; u.face = [0, 1]; });
    g.tick(30); });
  await p.evaluate(() => window.game.tick(-20 + 20)); await look(18, 51); await p.waitForTimeout(400); await p.screenshot({ path: pre + '-01-water-fishing.png' });
  await p.evaluate(() => window.game.tick(7)); await look(18, 51); await p.screenshot({ path: pre + '-02-fishing-carry.png' });
  await p.evaluate(() => { const w = window.game.world; for (const u of w.units) if (u.type !== 'villager') { u.path = []; u.state = 'idle'; u.face = [0, 1]; } });
  await look(30, 29); await p.waitForTimeout(400); await p.screenshot({ path: pre + '-03-new-units.png' });
  await p.evaluate(() => { const g = window.game; g.toScreen; const Z = g.zoom(); g.cam.x = 30 * 32 - innerWidth / 2 / (Z * 1.6); }); 
  await look(33, 36); await p.screenshot({ path: pre + '-04-villagers-working.png' });
  await look(30, 29); await p.evaluate(() => { const g = window.game, w = g.world; const us = w.units.filter(u => u.type !== 'villager'); g.sim.orderMoveGroup(w, us, 38, 24); g.tick(1.2); });
  await look(32, 27); await p.screenshot({ path: pre + '-05-new-units-walking.png' });
  for (const f of ['01-water-fishing', '02-fishing-carry', '03-new-units', '04-villagers-working', '05-new-units-walking']) c(existsSync(`${pre}-${f}.png`) && statSync(`${pre}-${f}.png`).size > 20000, `screenshot ${f} written`);
  c(!p.errors.length, `no page errors ${p.errors.join(' | ')}`);
  await closeAll(); srv.close(); return c.fails ? 1 : 0;
}
