// Inu reskin: every unit is drawn procedurally as an original anthropomorphic Japanese spitz-type dog.
// Purely presentational. Reads unit state, never writes it, and is not used by the simulation.
export const BREEDS = {
  villager:      { breed: 'Shiba', label: 'Shiba Villager', fur: '#d4853a', belly: '#f6e6c8', dark: '#9a5420', size: 0.9 },
  militia:       { breed: 'Kai', label: 'Kai Militia', fur: '#4a3426', belly: '#6e5440', dark: '#1c120c', brindle: true, size: 1 },
  spearman:      { breed: 'Kishu', label: 'Kishu Spearman', fur: '#f4f1ea', belly: '#ffffff', dark: '#b8b0a0', size: 1 },
  archer:        { breed: 'Shikoku', label: 'Shikoku Archer', fur: '#b8743c', belly: '#ecd9b8', dark: '#3a2618', sesame: true, size: 0.95 },
  crossbowman:   { breed: 'Shikoku', label: 'Shikoku Crossbowman', fur: '#8e5a30', belly: '#e6d0a8', dark: '#2a1a10', sesame: true, size: 1 },
  scout_cavalry: { breed: 'Hokkaido', label: 'Hokkaido Scout', fur: '#ece4d4', belly: '#ffffff', dark: '#a89c88', size: 0.85, mount: '#8a6a3a' },
  knight:        { breed: 'Akita', label: 'Akita Knight', fur: '#c9612c', belly: '#fbf3e4', dark: '#7a3414', size: 1.0, mount: '#4a3a30', armored: true },
  monk:          { breed: 'Japanese Spitz', label: 'Spitz Monk', fur: '#ffffff', belly: '#ffffff', dark: '#d8d8e0', fluffy: true, size: 0.95 },
  trebuchet:     { breed: 'Shiba crew', label: 'Shiba Trebuchet', fur: '#2a2420', belly: '#d8b080', dark: '#000', size: 0.75 },
};
export const unitLabel = (type, fallback) => BREEDS[type]?.label || fallback;
export const TEAM = { player: '#2a50c8', enemy: '#c02020' };

function line(ctx, x0, y0, x1, y1, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function circ(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function ell(ctx, x, y, rx, ry, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

// Dog head facing +x, centred at (0,0).
function head(ctx, b, opts = {}) {
  const ear = x => { ctx.fillStyle = b.fur; ctx.beginPath(); ctx.moveTo(x - 2.6, -3); ctx.lineTo(x, -9.5); ctx.lineTo(x + 2.6, -3); ctx.fill();
    ctx.fillStyle = '#f0b8a0'; ctx.beginPath(); ctx.moveTo(x - 1.2, -3.6); ctx.lineTo(x, -7.6); ctx.lineTo(x + 1.2, -3.6); ctx.fill(); };
  if (!opts.helmet) { ear(-2.5); ear(2.6); }
  if (b.fluffy) circ(ctx, -0.5, 1.5, 6.2, b.fur);
  circ(ctx, 0, 0, 5, b.fur);
  if (b.sesame) { ctx.fillStyle = b.dark + 'aa'; for (const [x, y] of [[-3, -2], [-1, -3.5], [1.5, -3], [-3.5, 0.5]]) ctx.fillRect(x, y, 1.2, 1.2); }
  if (b.brindle) { ctx.strokeStyle = b.dark; ctx.lineWidth = 0.9; for (let i = -3; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(i, -4.5); ctx.lineTo(i - 1, -1); ctx.stroke(); } }
  ell(ctx, 4.2, 1.6, 3.6, 2.4, b.belly); ell(ctx, 1.2, 2.8, 2.6, 1.8, b.belly); // urajiro cheeks/muzzle
  circ(ctx, 7.4, 0.9, 1.2, '#1a1010'); circ(ctx, 2.6, -1.2, 1, '#1a1010'); circ(ctx, 3.0, -1.5, 0.35, '#fff');
  if (opts.helmet) { ctx.fillStyle = '#9aa4b0'; ctx.beginPath(); ctx.arc(0, -0.5, 5.6, Math.PI, 0); ctx.fill(); ctx.fillRect(-5.6, -1, 11.2, 1.6);
    for (const x of [-2.5, 2.6]) { ctx.beginPath(); ctx.moveTo(x - 2, -5); ctx.lineTo(x, -9.5); ctx.lineTo(x + 2, -5); ctx.fill(); } line(ctx, 0, -6, 0, -10, opts.team, 2); }
}
function tail(ctx, b, x, y) { ctx.strokeStyle = b.fur; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(x, y - 3, 3.2, Math.PI * 0.5, Math.PI * 1.9); ctx.stroke();
  ctx.strokeStyle = b.belly; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y - 3, 3.2, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke(); }

// Bipedal dog: feet at y=0, facing +x.
function biped(ctx, b, team, phase, swing, opts) {
  const legA = Math.sin(phase) * 3;
  line(ctx, -2, -7, -2 + legA, 0, b.dark, 2.6); line(ctx, 2, -7, 2 - legA, 0, b.dark, 2.6);
  tail(ctx, b, -5, -9);
  ell(ctx, 0, -11, 5, 6, b.fur);
  if (opts.robe) { ctx.fillStyle = opts.robe; ctx.beginPath(); ctx.moveTo(-5.5, -15); ctx.lineTo(5.5, -15); ctx.lineTo(6.5, 0); ctx.lineTo(-6.5, 0); ctx.fill(); ctx.fillStyle = team; ctx.fillRect(-5.5, -10, 11, 2.2); }
  else if (opts.armor) { ctx.fillStyle = '#9aa4b0'; ctx.fillRect(-5, -16, 10, 9); ctx.fillStyle = team; ctx.fillRect(-2, -16, 4, 9); }
  else { ell(ctx, 1.5, -11, 3, 4.2, b.belly); ctx.fillStyle = team; ctx.fillRect(-4.5, -13, 9, 6.5); }
  if (b.brindle && !opts.robe) { ctx.strokeStyle = b.dark; ctx.lineWidth = 0.9; for (let i = -4; i <= 4; i += 2.5) { ctx.beginPath(); ctx.moveTo(i, -16.5); ctx.lineTo(i - 1, -13.5); ctx.stroke(); } }
  ctx.fillStyle = team; ctx.fillRect(-3.5, -17.6, 8, 2); circ(ctx, 4, -16, 1, '#f0d040'); // collar + tag
  ctx.save(); ctx.translate(1.5, -22); head(ctx, b, { team, helmet: opts.helmet }); ctx.restore();
  ctx.save(); ctx.translate(2, -14); ctx.rotate(swing); line(ctx, 0, 0, 5, 2, b.fur, 2.4); ctx.translate(5, 2); opts.weapon && opts.weapon(ctx); ctx.restore();
  if (opts.offhand) { ctx.save(); ctx.translate(-1, -12); opts.offhand(ctx); ctx.restore(); }
}
const W = {
  sword: ctx => { line(ctx, 0, 0, 0, -11, '#dfe4ea', 2); line(ctx, -2.5, -1, 2.5, -1, '#7a5a20', 1.6); },
  spear: ctx => { line(ctx, -1, 8, 0, -17, '#7a5a30', 1.5); ctx.fillStyle = '#dfe4ea'; ctx.beginPath(); ctx.moveTo(-2, -16); ctx.lineTo(0, -22); ctx.lineTo(2, -16); ctx.fill(); },
  bow: ctx => { ctx.strokeStyle = '#6a4220'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(-2, -2, 8, -1.2, 1.2); ctx.stroke(); line(ctx, 1, -9.5, 1, 5.5, '#eee', 0.6); },
  crossbow: ctx => { line(ctx, -3, 0, 8, 0, '#5a3a1a', 2.2); line(ctx, 6, -5, 6, 5, '#3a3a3a', 1.8); },
  axe: ctx => { line(ctx, 0, 4, 0, -9, '#7a5a30', 1.6); ctx.fillStyle = '#c8ccd0'; ctx.fillRect(0, -9, 4, 4); },
  pick: ctx => { line(ctx, 0, 4, 0, -9, '#7a5a30', 1.6); line(ctx, -4, -8, 5, -9, '#9aa0a8', 1.8); },
  hammer: ctx => { line(ctx, 0, 4, 0, -8, '#7a5a30', 1.6); ctx.fillStyle = '#777'; ctx.fillRect(-2.5, -10, 6, 3.5); },
  basket: ctx => { ctx.fillStyle = '#b08a4a'; ctx.fillRect(-2, -2, 6, 5); circ(ctx, 0, -2, 1.3, '#c0203a'); circ(ctx, 2.5, -2.3, 1.3, '#c0203a'); },
  hoe: ctx => { line(ctx, 0, 4, 0, -10, '#7a5a30', 1.6); line(ctx, 0, -10, 4, -10, '#999', 1.8); },
  knife: ctx => { line(ctx, 0, 0, 0, -6, '#ddd', 1.6); },
  staff: ctx => { line(ctx, 0, 9, 0, -15, '#8a6a3a', 1.6); circ(ctx, 0, -16, 2, '#f0d040'); },
  lance: ctx => { line(ctx, -6, 2, 16, -4, '#8a7050', 1.8); ctx.fillStyle = '#dfe4ea'; ctx.beginPath(); ctx.moveTo(15, -6); ctx.lineTo(20, -5); ctx.lineTo(16, -2); ctx.fill(); },
};
const shield = team => ctx => { circ(ctx, 0, 0, 4.6, '#6a4a2a'); circ(ctx, 0, 0, 3.4, team); circ(ctx, 0, 0, 1, '#f0d040'); };
const RES_COL = { food: '#c0203a', wood: '#7a4a1a', gold: '#e0b83a', stone: '#9a9a9a' };

function horse(ctx, col, team, phase, armored) {
  const a = Math.sin(phase) * 3;
  for (const [x, s] of [[-7, a], [-4, -a], [5, -a], [8, a]]) line(ctx, x, -6, x + s, 0, col, 2.4);
  ell(ctx, 0, -9, 10, 5, col);
  ctx.save(); ctx.translate(9, -13); ctx.rotate(-0.6); ell(ctx, 2, 0, 5, 2.6, col); ctx.restore();
  ell(ctx, 13.5, -15, 3.4, 2.2, col); circ(ctx, 13, -16.5, 0.7, '#000');
  line(ctx, -10, -10, -13, -3, '#2a1a10', 2);
  if (armored) { ctx.fillStyle = '#8a94a0'; ctx.fillRect(-9, -13, 18, 5); }
  ctx.fillStyle = team; ctx.fillRect(-6, -14, 10, 7); ctx.fillStyle = '#f0d040'; ctx.fillRect(-6, -8, 10, 1.2);
}

// Draw one unit with its foot point at (px,py+6). t = render time in seconds.
export function drawInu(ctx, u, px, py, t, extra = {}) {
  const b = BREEDS[u.type]; if (!b) return false;
  const team = TEAM[u.owner] || TEAM.player, id = u.id || 0;
  const moving = u.state === 'moving' || (u.state || '').startsWith('to_') || (u.path && u.path.length > 0) || extra.moving;
  const working = u.state === 'gathering' || u.state === 'building' || extra.working;
  const attacking = u.state === 'attacking' || extra.attacking;
  const phase = moving ? (t + id * 0.37) * 12 : 0;
  const bob = moving ? -Math.abs(Math.sin(phase)) * 1.5 : Math.sin(t * 2 + id) * 0.4;
  let swing = 0.2;
  if (working) swing = -0.6 + Math.abs(Math.sin(t * 5 + id)) * 1.6;
  if (attacking) swing = -1 + Math.abs(Math.sin(t * 7 + id)) * 2.2;
  const dir = u.face ? (u.face[0] < -0.05 ? -1 : 1) : (extra.dir || 1);
  ctx.save(); ctx.translate(px, py + 6 + bob); ctx.scale(dir * b.size * (extra.scale || 1), b.size * (extra.scale || 1)); ctx.lineCap = 'round';
  const wide = u.type === 'knight' || u.type === 'scout_cavalry' || u.type === 'trebuchet';
  ell(ctx, 0, 0.5, wide ? 14 : 7, 2.4, '#00000040');
  switch (u.type) {
    case 'villager': {
      const res = u.carry?.amount ? u.carry.res : extra.res;
      const tool = u.state === 'building' || u.state === 'to_build' ? W.hammer : res === 'wood' ? W.axe : res === 'gold' || res === 'stone' ? W.pick : res === 'food' ? (extra.kind === 'farm' ? W.hoe : extra.kind === 'carcass' ? W.knife : W.basket) : null;
      biped(ctx, b, team, phase, swing, { weapon: tool });
      if (u.carry?.amount) { const c = RES_COL[u.carry.res];
        if (u.carry.res === 'wood') for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#8a5a2a' : '#6a3a14'; ctx.fillRect(-10, -18 + i * 2.4, 8, 2.2); }
        else { ctx.fillStyle = '#a07a40'; ctx.fillRect(-10, -16, 6, 7); circ(ctx, -7, -16, 2.8, c); } }
      break; }
    case 'militia': biped(ctx, b, team, phase, swing, { weapon: W.sword, offhand: shield(team) }); break;
    case 'spearman': biped(ctx, b, team, phase, attacking ? swing * 0.4 + 0.6 : 0, { weapon: W.spear, offhand: shield(team) }); break;
    case 'archer': biped(ctx, b, team, phase, attacking ? -0.25 : -0.1, { weapon: W.bow }); break;
    case 'crossbowman': biped(ctx, b, team, phase, attacking ? -0.15 : 0, { weapon: W.crossbow, helmet: true }); break;
    case 'monk': biped(ctx, b, team, phase, 0.1 + (working || attacking ? Math.sin(t * 3) * 0.3 : 0), { weapon: W.staff, robe: '#b07a30' }); break;
    case 'scout_cavalry': case 'knight': {
      horse(ctx, b.mount, team, phase, b.armored);
      ctx.save(); ctx.translate(0, -10); ctx.scale(0.85, 0.85);
      biped(ctx, b, team, 0, attacking ? swing : 0.1, { weapon: u.type === 'knight' ? W.sword : W.lance, armor: b.armored, helmet: b.armored, offhand: u.type === 'knight' ? shield(team) : null });
      ctx.restore(); break; }
    case 'trebuchet': {
      const arm = attacking ? -0.9 + Math.abs(Math.sin(t * 1.5)) * 1.8 : -0.9;
      line(ctx, -12, -2, 12, -2, '#6a4a24', 3); for (const x of [-9, 9]) circ(ctx, x, 0, 2.6, '#3a2a14');
      line(ctx, -6, -2, 0, -20, '#6a4a24', 2.4); line(ctx, 6, -2, 0, -20, '#6a4a24', 2.4);
      ctx.save(); ctx.translate(0, -20); ctx.rotate(arm); line(ctx, -8, 0, 18, 0, '#8a6a34', 2.2); ctx.fillStyle = '#555'; ctx.fillRect(-11, -1, 5, 6); ctx.restore();
      ctx.fillStyle = team; ctx.fillRect(-1, -32, 1.4, 12); ctx.fillRect(0.4, -32, 7, 4.5);
      ctx.save(); ctx.translate(-14, 0); ctx.scale(0.7, 0.7); biped(ctx, b, team, phase, 0.3, { weapon: W.hammer }); ctx.restore();
      ctx.save(); ctx.translate(15, 0); ctx.scale(0.7, 0.7); biped(ctx, BREEDS.villager, team, phase + 1, -0.3, {}); ctx.restore();
      break; }
  }
  ctx.restore(); return true;
}

export function paw(ctx, x, y, r, col) {
  circ(ctx, x, y + r * 0.35, r * 0.55, col);
  for (const [dx, dy] of [[-0.6, -0.35], [-0.2, -0.65], [0.2, -0.65], [0.6, -0.35]]) circ(ctx, x + dx * r, y + dy * r, r * 0.22, col);
}
