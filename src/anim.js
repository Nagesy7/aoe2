// Action -> animation/tool mapping (visual only; never read by the sim). One source of truth used by the renderer and tests.
// Villager tools: build/repair = hammer, wood = axe, gold/stone = pickaxe, forage = basket, farm = hoe,
// hunt/sheep = spear stab to kill, then knife stab + grab/carry meat. Never a hammer outside build/repair.
export const GATHER_TOOL = { tree: 'axe', gold_mine: 'pick', stone_mine: 'pick', berries: 'basket', farm: 'hoe', carcass: 'knife', fish: 'net' };
export const GATHER_ACTION = { tree: 'chop', gold_mine: 'mine', stone_mine: 'mine', berries: 'forage', farm: 'farm', carcass: 'butcher', fish: 'fish' };
export const ATTACK_TOOL = { villager: 'knife', militia: 'sword', blade_paw: 'sword', red_fang: 'sword', akita_guardian: 'sword', brindle_striker: 'sword',
  spearman: 'spear', halberd_pup: 'spear', frost_guard: 'spear', archer: 'bow', kishu_longbow: 'crossbow', crossbowman: 'crossbow',
  scout_cavalry: 'lance', swift_rider: 'lance', knight: 'sword', boar_rider: 'sword', monk: 'staff', trebuchet: 'sling' };
export const ATTACK_MOTION = { sword: 'slash', spear: 'thrust', lance: 'thrust', bow: 'draw', crossbow: 'draw', staff: 'chant', sling: 'fling', knife: 'stab' };
const BUTCHER_CYCLE = 1.2; // s: 0..0.5 knife stab, rest = grab meat
export function unitAction(u, world, t = 0) {
  if (u.dying != null) return { action: 'death', tool: null, motion: 'death' };
  const attacking = u.state === 'attacking' || (u.lastAttackAt != null && world && world.time - u.lastAttackAt < 0.6);
  if (u.type !== 'villager') {
    if (attacking) { const tool = ATTACK_TOOL[u.type] || 'sword'; return { action: 'attack', tool, motion: ATTACK_MOTION[tool] }; }
    return u.path?.length || u.state === 'moving' || (u.state || '').startsWith('to_') ? { action: 'move', tool: ATTACK_TOOL[u.type] || null, motion: 'walk' } : { action: 'idle', tool: ATTACK_TOOL[u.type] || null, motion: 'idle' };
  }
  if (u.state === 'building' || u.state === 'to_build') {
    const b = world?.buildings?.find(o => o.id === u.build); const repair = b && b.complete;
    return { action: repair ? 'repair' : 'build', tool: 'hammer', motion: u.state === 'building' ? 'swing' : 'walk' };
  }
  if (u.state === 'to_hunt') { const sh = world?.animals?.find(a => a.id === u.hunt); const near = sh && Math.hypot(sh.x - u.x, sh.y - u.y) < 2.2;
    return { action: u.huntMode === 'convert' ? 'herd' : 'hunt', tool: u.huntMode === 'convert' ? null : 'spear', motion: near && u.huntMode !== 'convert' ? 'stab' : 'walk' }; }
  if (u.carry?.amount && (u.state === 'to_drop' || u.path?.length)) return { action: 'carry', tool: null, motion: 'walk', carry: u.carry.res, meat: u.carry.kind === 'carcass', carryKind: u.carry.kind || null };
  if (u.state === 'gathering' || u.state === 'to_resource') { const n = world?.resources?.find(r => r.id === u.target); const k = n?.kind || (n?.farm ? 'farm' : null);
    if (!k) return { action: 'gather', tool: null, motion: 'idle' };
    let motion = u.state === 'gathering' ? (k === 'carcass' ? ((t + (u.id || 0) * 0.37) % BUTCHER_CYCLE < 0.5 ? 'stab' : 'grab') : k === 'berries' ? 'pick' : 'swing') : 'walk';
    return { action: GATHER_ACTION[k] || 'gather', tool: GATHER_TOOL[k] || null, motion }; }
  if (attacking) return { action: 'attack', tool: 'knife', motion: 'stab' };
  if (u.state === 'garrisoned') return { action: 'garrisoned', tool: null, motion: 'hidden' };
  return u.path?.length || u.state === 'moving' || (u.state || '').startsWith('to_') ? { action: 'move', tool: null, motion: 'walk', carry: u.carry?.amount ? u.carry.res : null } : { action: 'idle', tool: null, motion: 'idle', carry: u.carry?.amount ? u.carry.res : null };
}
