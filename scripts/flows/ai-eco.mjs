// AI economy probe: AI-vs-AI mirror games, reports villager counts and age-up times per player (used to tune src/ai.js).
// Usage: node scripts/ai-eco.mjs [seeds=3] [minutes=25]
import { createMpWorld, stepTick } from '../../src/sim.js';
import { setupComputers } from '../../src/ai.js';
const seeds = +(process.argv[2] || 3), minutes = +(process.argv[3] || 25);
const agg = {};
for (let s = 1; s <= seeds; s++) {
  const w = createMpWorld({ seed: s }); setupComputers(w, { player: 'shiba', enemy: 'akita' });
  const ageAt = { player: {}, enemy: {} }, vAt = {};
  for (let i = 0; i < minutes * 1200 && !w.winner; i++) { stepTick(w);
    for (const o of ['player', 'enemy']) { const a = w.players[o].age; if (!(a in ageAt[o])) ageAt[o][a] = +(w.time / 60).toFixed(1); }
    if (i % 6000 === 0) vAt[i / 1200] = ['player', 'enemy'].map(o => w.units.filter(u => u.owner === o && u.type === 'villager').length);
  }
  const fish = w.resources.filter(n => n.kind === 'fish').reduce((t, n) => t + 200 - n.amount, 0);
  console.log(`seed ${s}: vills@min ${JSON.stringify(vAt)} ages ${JSON.stringify(ageAt)} fishEaten ${fish} winner ${w.winner || '-'}`);
}
