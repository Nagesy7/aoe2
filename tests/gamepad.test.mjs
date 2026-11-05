// Controller helpers (headless): pad kind from gamepad.id, glyph sets, radial deadzone, settings clamp. Run: node tests/gamepad.test.mjs
// The browser behaviour (cursor, A/X/B/LB/RB/LT/RT/D-pad/Start, same commandLog as the mouse, replay hash) is `ctl run gamepad`.
import { padKind, GLYPHS, stick, hints, loadSettings, PAD_DEFAULTS, BUTTONS, nextMilitary } from '../src/gamepad.js';
let pass = 0, fail = 0; const assert = (c, m) => { if (c) { pass++; console.log('PASS: ' + m); } else { fail++; console.log('FAIL: ' + m); } };
const ids = { ps: ['DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', '054c-09cc-Wireless Controller', 'Sony PLAYSTATION(R)3 Controller', 'DUALSHOCK 4'],
  xbox: ['Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', '045e-0b12-Xbox Wireless Controller', 'xinput', 'X-Box One pad (Vendor: 045e)'],
  generic: ['8BitDo Pro 2 (Vendor: 2dc8)', '', 'USB Gamepad'] };
for (const [k, list] of Object.entries(ids)) for (const id of list) assert(padKind(id) === k, `padKind("${id}") = ${k}`);
assert(GLYPHS.ps.a === '✕' && GLYPHS.ps.b === '○' && GLYPHS.ps.x === '□' && GLYPHS.ps.y === '△' && GLYPHS.ps.lb === 'L1' && GLYPHS.ps.start === 'Options', 'PS glyphs ✕○□△ L1 Options');
assert(GLYPHS.xbox.a === 'A' && GLYPHS.xbox.b === 'B' && GLYPHS.xbox.lb === 'LB' && GLYPHS.xbox.rt === 'RT' && GLYPHS.xbox.start === 'Menu', 'Xbox glyphs A B LB RT Menu');
assert(hints(GLYPHS.ps).length === 7 && hints(GLYPHS.ps)[0][0] === '✕', 'toast hints use the pad glyphs');
const dz = PAD_DEFAULTS.deadzone; assert(dz >= 0.15 && dz <= 0.2, `default deadzone ${dz} in 0.15-0.2`);
let v = stick(0.1, 0.1, dz); assert(v.x === 0 && v.y === 0, 'drift inside the deadzone -> 0');
v = stick(0.19, 0, dz); assert(v.x > 0 && v.x < 0.02, `just past the deadzone ramps from ~0 (${v.x.toFixed(4)}), no jump`);
v = stick(1, 0, dz); assert(Math.abs(v.x - 1) < 1e-9, 'full tilt -> 1');
v = stick(0.8, 0.8, dz); assert(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9 && Math.abs(v.x - v.y) < 1e-9, 'diagonal clamps to 1, direction kept');
assert(BUTTONS.a === 0 && BUTTONS.b === 1 && BUTTONS.lb === 4 && BUTTONS.rt === 7 && BUTTONS.start === 9 && BUTTONS.up === 12, 'standard mapping indices');
globalThis.localStorage = { v: {}, getItem(k) { return this.v[k] ?? null; }, setItem(k, x) { this.v[k] = x; } };
assert(loadSettings(new URLSearchParams('')).deadzone === dz, 'no setting -> default');
localStorage.setItem('inu-pad', JSON.stringify({ deadzone: 0.25 })); assert(loadSettings(new URLSearchParams('')).deadzone === 0.25, 'stored deadzone used');
assert(loadSettings(new URLSearchParams('padDeadzone=0.15')).deadzone === 0.15, '?padDeadzone= overrides');
assert(loadSettings(new URLSearchParams('padDeadzone=0.9')).deadzone === 0.45 && loadSettings(new URLSearchParams('padDeadzone=0')).deadzone === 0.05, 'deadzone clamped to 0.05-0.45');
// RB 'next military unit' (pure helper behind api.nextUnit)
{ const U = [{ id: 1, owner: 'player', type: 'villager' }, { id: 2, owner: 'player', type: 'militia' }, { id: 3, owner: 'enemy', type: 'militia' }, { id: 4, owner: 'player', type: 'sheep' },
    { id: 5, owner: 'player', type: 'archer', state: 'garrisoned' }, { id: 6, owner: 'player', type: 'archer' }, { id: 7, owner: 'player', type: 'knight', hp: 0 }, { id: 8, owner: 'player', type: 'monk' }];
  const seq = []; let sel = []; for (let i = 0; i < 4; i++) { const u = nextMilitary(U, 'player', sel); seq.push(u.id); sel = [u.id]; }
  assert(seq.join() === '2,6,8,2', `RB cycles own military only, skipping villagers, sheep, garrisoned, dead and enemy units (${seq})`);
  assert(nextMilitary(U, 'player', [1]).id === 2 && nextMilitary(U, 'player', [2, 6]).id === 2, 'RB from a villager or a group selection starts at the first military unit');
  assert(nextMilitary(U, 'enemy', []).id === 3, 'RB uses the viewer (guest = enemy side)');
  assert(nextMilitary(U.filter(u => u.type === 'villager'), 'player', []) === null, 'RB with no military units -> null (selection kept)');
  assert(nextMilitary([{ id: 9, owner: 'player', type: 'militia' }], 'player', [9]).id === 9, 'RB with one military unit keeps it selected'); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
