// Controller proof (src/gamepad.js): navigator.getGamepads is mocked (window.__pad) and driven frame by frame, phone landscape.
// The pad only emits the same commands as the mouse: every command lands in world.commandLog through issue(), and the browser hash
// equals a headless Node replay of that log. Mouse + touch still work afterwards; PS and Xbox ids get their own glyphs.
//   ctl run gamepad [--url <preview>] [--shots]
import { join } from 'node:path'; import { writeFileSync, mkdirSync } from 'node:fs';
import { ROOT, base, argOf, flag, newPage, openTitle, startSandbox, checker, shot, closeAll, SHOTS } from '../ctl.mjs';
import * as S from '../../src/sim.js';
const PS_ID = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const XB_ID = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
// mock: one standard-mapping pad whose buttons/axes the test sets; getGamepads returns it once "connected"
const MOCK = () => {
  const pad = { id: '', index: 0, connected: false, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  const P = window.__pad = { pad,
    connect(id) { pad.id = id; pad.connected = true; const e = new Event('gamepadconnected'); e.gamepad = pad; dispatchEvent(e); },
    disconnect() { pad.connected = false; const e = new Event('gamepaddisconnected'); e.gamepad = pad; dispatchEvent(e); },
    set(i, on) { pad.buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; pad.timestamp++; },
    axes(a) { for (let i = 0; i < 4; i++) pad.axes[i] = a[i] || 0; pad.timestamp++; },
    frames: n => new Promise(r => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }),
    async tap(i, hold = 4) { P.set(i, true); await P.frames(hold); P.set(i, false); await P.frames(3); },
    async hold(a, ms) { P.axes(a); await new Promise(r => setTimeout(r, ms)); P.axes([0, 0, 0, 0]); await P.frames(2); },
    // steer the cursor with the left stick (proportional, like a player) until it is on the target
    async driveTo(x, y) { for (let k = 0; k < 400; k++) { const c = window.game.pad.cursor, dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy); if (d < 3) break;
      const m = Math.min(1, 0.2 + d / 250); P.axes([dx / d * m, dy / d * m, 0, 0]); await P.frames(1); } P.axes([0, 0, 0, 0]); await P.frames(2); return { ...window.game.pad.cursor }; } };
  navigator.getGamepads = () => [pad.connected ? pad : null, null, null, null];
};
const replay = log => { const w = S.createWorld({ enemy: true, raids: false, scenario: null }); let i = 0; const end = log.end;
  for (;;) { while (i < log.cmds.length && log.cmds[i].tick === w.tick) S.applyCommand(w, log.cmds[i++]); if (w.tick >= end) break; S.stepTick(w); } return S.stateHash(w); };
const B = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
export default async function (argv) {
  const srv = await base(argv); const url = srv.url; const c = checker(); const shots = flag('shots', argv) || !argOf('url', '', argv);
  const p = await newPage({ phone: true }); const cons = []; p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) cons.push(m.text()); });
  await p.addInitScript(MOCK);
  await openTitle(p, url); await startSandbox(p);
  const pad = (f, a) => p.S(f, a), st = () => p.S(() => window.game.pad.stats()), W = () => p.S(() => { const w = window.game.world; return { sel: w.selection, log: (w.commandLog || []).length, tick: w.tick, cam: { ...window.game.cam } }; });
  c(await p.S(() => !window.game.pad), 'no controller: gamepad module not loaded (lazy, zero cost for mouse/touch players)');
  // ---- connect a DualSense: toast with PS glyphs + button hints ----
  await pad(id => window.__pad.connect(id), PS_ID); await p.waitForFunction(() => window.game.pad); await p.waitForTimeout(200);
  let s = await st(); c(s.kind === 'ps' && /PlayStation controller connected/.test(s.toast) && /✕.*select/.test(s.toast) && /L1\/R1/.test(s.toast) && /Options/.test(s.toast), `PS toast: "${s.toast.slice(0, 120)}…"`);
  const tb = await p.locator('#pad-toast').boundingBox(); c(tb && tb.x >= 0 && tb.x + tb.width <= 844 && tb.y + tb.height <= 390, `toast fits 844x390 (${tb && Math.round(tb.width)}x${tb && Math.round(tb.height)})`);
  if (shots) await shot(p, join(SHOTS, 'gamepad-toast-ps-844x390.png'));
  // ---- deadzone: a 0.12 stick drift does not move the cursor; full tilt does ----
  const c0 = (await st()).cursor; await pad(() => window.__pad.hold([0.12, -0.1, 0.1, 0], 300)); let c1 = (await st()).cursor;
  c(c1.x === c0.x && c1.y === c0.y && s.deadzone === 0.18, `stick drift inside deadzone ${s.deadzone} ignored (cursor ${c0.x},${c0.y} -> ${c1.x},${c1.y})`);
  await pad(() => window.__pad.hold([0.8, 0, 0, 0], 150)); c1 = (await st()).cursor; c(c1.x > c0.x + 30, `left stick moves the cursor (${c0.x} -> ${c1.x})`);
  // ---- A on a villager selects it (same pointerDown/pointerUp as a click) ----
  const v = await p.S(() => { const w = window.game.world, g = window.game; const vs = w.units.filter(u => u.owner === 'player' && u.type === 'villager');
    for (const u of vs) { const q = g.toScreen(u.x, u.y); if (q.x > 80 && q.x < innerWidth - 80 && q.y > 70 && q.y < innerHeight - 80) return { id: u.id, q }; } return null; });
  await pad(([x, y]) => window.__pad.driveTo(x, y), [v.q.x, v.q.y]); await pad(B => window.__pad.tap(B.a), B);
  let w = await W(); c(w.sel && (w.sel.id === v.id || (w.sel.ids || []).includes(v.id)), `${'✕'} on a villager selects it (${JSON.stringify(w.sel)})`);
  if (shots) await shot(p, join(SHOTS, 'gamepad-select-844x390.png'));
  // ---- A on a berry bush = context command (gather) through issue() ----
  const bush = await p.S(id => { const w = window.game.world, u = w.units.find(o => o.id === id); const r = w.resources.filter(n => n.kind === 'food' || n.kind === 'berries').sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
    const g = window.game, c = document.querySelector('canvas'); g.cam.x = r.x * 32 - c.width / 2; g.cam.y = r.y * 32 - c.height / 2; g.sim.clampCamera(g.cam, c.width, c.height, w); return { ...g.toScreen(r.x, r.y), kind: r.kind }; }, v.id);
  await p.waitForTimeout(100); const n0 = (await W()).log;
  await pad(([x, y]) => window.__pad.driveTo(x, y), [bush.x, bush.y]); await pad(B => window.__pad.tap(B.a), B);
  let last = await p.S(() => (window.game.world.commandLog || []).slice(-1)[0]); w = await W();
  c(w.log === n0 + 1 && last && (last.args.ids || []).includes(v.id), `✕ on ${bush.kind} with a villager selected -> one lockstep command (${last && last.type} ${JSON.stringify(last && last.args)})`);
  c(w.sel && (w.sel.id === v.id || (w.sel.ids || []).includes(v.id)), 'selection kept after the command (A commands, it did not reselect)');
  // ---- □ = explicit context command on open ground (move) ----
  const gq = { x: bush.x + 60, y: bush.y + 30 }; await pad(([x, y]) => window.__pad.driveTo(x, y), [gq.x, gq.y]); await pad(B => window.__pad.tap(B.x), B);
  last = await p.S(() => (window.game.world.commandLog || []).slice(-1)[0]); c((await W()).log === n0 + 2 && last.type === 'order' && !last.args.amove, `□ issues the right-click command (${last.type})`);
  // ---- △ toggles attack-move; ✕ then issues an amove (same as the quick-bar ⚔ + click) ----
  await pad(B => window.__pad.tap(B.y), B); await pad(B => window.__pad.tap(B.a), B); last = await p.S(() => (window.game.world.commandLog || []).slice(-1)[0]);
  c((await W()).log === n0 + 3, `△ + ✕ = attack-move command (${last.type} ${JSON.stringify(last.args).slice(0, 60)})`);
  // ---- ○ deselects ----
  await pad(B => window.__pad.tap(B.b), B); w = await W(); c(!w.sel, '○ cancels / deselects');
  // ---- L1 cycles idle villagers (selects + centres) ----
  await pad(B => window.__pad.tap(B.lb), B); w = await W(); const vSel = await p.S(() => window.game.sim.selectedUnits(window.game.world).map(u => u.type));
  c(vSel.length === 1 && vSel[0] === 'villager', `L1 selects an idle villager (${vSel})`);
  // ---- Den Hall: ✕ selects it, R2 steps focus through train buttons, ✕ presses -> train command ----
  await pad(B => window.__pad.tap(B.b), B);
  const tc = await p.S(() => { const w = window.game.world, b = w.buildings.find(o => o.owner === 'player' && o.type === 'town_center') || w.buildings.find(o => o.owner === 'player'); const g = window.game, c = document.querySelector('canvas');
    g.cam.x = (b.x + b.size / 2) * 32 - c.width / 2; g.cam.y = (b.y + b.size / 2) * 32 - c.height / 2; g.sim.clampCamera(g.cam, c.width, c.height, w); return { id: b.id, type: b.type, q: g.toScreen(b.x + b.size / 2, b.y + b.size / 2) }; });
  await p.waitForTimeout(100); await pad(([x, y]) => window.__pad.driveTo(x, y), [tc.q.x, tc.q.y]); await pad(B => window.__pad.tap(B.a), B);
  w = await W(); c(w.sel && w.sel.kind === 'building' && w.sel.id === tc.id, `✕ selects the ${tc.type}`);
  await pad(B => window.__pad.tap(B.rt), B); s = await st(); let fb = await p.S(() => document.querySelector('.pad-focus')?.textContent.trim());
  c(s.focus >= 0 && fb, `R2 opens the command buttons and highlights one ("${fb}")`);
  if (shots) await shot(p, join(SHOTS, 'gamepad-build-focus-844x390.png'));
  let tries = 0; while (!/pup|villager|worker/i.test(fb || '') && tries++ < 12) { await pad(B => window.__pad.tap(B.rt), B); fb = await p.S(() => document.querySelector('.pad-focus')?.textContent.trim()); }
  await pad(B => window.__pad.tap(B.lt), B); await pad(B => window.__pad.tap(B.rt), B); // L2 steps back, R2 forward again
  const n1 = (await W()).log; await pad(B => window.__pad.tap(B.a), B); last = await p.S(() => (window.game.world.commandLog || []).slice(-1)[0]);
  c((await W()).log === n1 + 1 && /train|queue/.test(last.type), `✕ on the highlighted "${fb}" button -> ${last.type} command`);
  await pad(B => window.__pad.tap(B.b), B); c((await st()).focus === -1, '○ drops the button highlight first');
  // ---- camera: D-pad, right stick, and left-stick edge pan ----
  let cam0 = (await W()).cam; await pad(B => { window.__pad.set(B.right, true); return window.__pad.frames(15).then(() => window.__pad.set(B.right, false)); }, B); let cam1 = (await W()).cam;
  const cl = await p.S(() => { const g = window.game, c = document.querySelector('canvas'); g.cam.x = 600; g.cam.y = 600; g.sim.clampCamera(g.cam, c.width, c.height, g.world); return { ...g.cam }; });
  c(cam1.x > cam0.x || cam0.x >= cl.x, `D-pad → scrolls the camera (${Math.round(cam0.x)} -> ${Math.round(cam1.x)})`);
  cam0 = (await W()).cam; await pad(() => window.__pad.hold([0, 0, 0, 1], 250)); cam1 = (await W()).cam; c(cam1.y > cam0.y, `right stick pans the camera (y ${Math.round(cam0.y)} -> ${Math.round(cam1.y)})`);
  await pad(() => window.__pad.hold([-1, 0, 0, 0], 1000)); await p.S(() => { const g = window.game, c = document.querySelector('canvas'); g.cam.x = 600; g.sim.clampCamera(g.cam, c.width, c.height, g.world); }); cam0 = (await W()).cam; await pad(() => window.__pad.hold([-1, 0, 0, 0], 300)); cam1 = (await W()).cam;
  c((await st()).cursor.x === 0 && cam1.x < cam0.x, `left stick at the screen edge pans (cursor x=0, cam ${Math.round(cam0.x)} -> ${Math.round(cam1.x)})`);
  // ---- Options: game menu, D-pad navigation, deadzone ◀▶ remembered ----
  await pad(B => window.__pad.tap(B.start), B); c(await p.locator('#pad-menu').isVisible(), 'Options opens the game menu');
  const mb = await p.locator('#pad-menu').boundingBox(); c(mb.y >= 0 && mb.y + mb.height <= 390, `menu fits 844x390 (${Math.round(mb.width)}x${Math.round(mb.height)})`);
  await pad(B => window.__pad.tap(B.down), B); await pad(B => window.__pad.tap(B.down), B); await pad(B => window.__pad.tap(B.right), B);
  if (shots) await shot(p, join(SHOTS, 'gamepad-menu-844x390.png'));
  s = await st(); const ls = await p.S(() => JSON.parse(localStorage.getItem('inu-pad'))); c(s.deadzone === 0.2 && ls.deadzone === 0.2, `deadzone ▶ 0.18 -> ${s.deadzone}, remembered (${JSON.stringify(ls)})`);
  const tk = (await W()).tick; await p.waitForTimeout(300); c((await W()).tick > tk, 'menu does not pause the sim (lockstep keeps running)');
  await pad(B => window.__pad.tap(B.b), B); c(!(await p.locator('#pad-menu').isVisible()), '○ closes the menu');
  await pad(B => window.__pad.tap(B.start), B); await pad(B => window.__pad.tap(B.down), B); await pad(B => window.__pad.tap(B.a), B);
  c(await p.locator('#alive-panel').isVisible(), 'menu "✨ Sound & effects" opens the same panel as the quick-bar ✨'); await p.S(() => document.getElementById('alive-panel').hidden = true);
  // ---- Share/View selects the army; R1 cycles military (sandbox may have none: skipped if so) ----
  const mil = await p.S(() => window.game.world.units.filter(u => u.owner === 'player' && !['villager', 'sheep'].includes(u.type) && u.state !== 'garrisoned').length);
  await pad(B => window.__pad.tap(B.rb), B); const rsel = await p.S(() => window.game.sim.selectedUnits(window.game.world).map(u => u.type));
  c(mil ? rsel.length === 1 && rsel[0] !== 'villager' : true, mil ? `R1 selects the next military unit (${rsel})` : 'R1: no military in sandbox (nothing to cycle)');
  // ---- mouse & touch still work: a real tap selects, and the pad cursor hides ----
  await pad(B => window.__pad.tap(B.b), B);
  const v2 = await p.S(() => { const w = window.game.world, g = window.game, c = document.querySelector('canvas'), u = w.units.find(o => o.owner === 'player' && o.type === 'villager');
    g.cam.x = u.x * 32 - c.width / 2; g.cam.y = u.y * 32 - c.height / 2; g.sim.clampCamera(g.cam, c.width, c.height, w); return { id: u.id }; });
  await p.waitForTimeout(150); const q2 = await p.S(id => { const u = window.game.world.units.find(o => o.id === id); return window.game.toScreen(u.x, u.y); }, v2.id);
  await p.tap(q2); w = await W(); c(w.sel && (w.sel.id === v2.id || (w.sel.ids || []).includes(v2.id)), 'touch tap still selects a villager with a controller connected');
  c(!(await st()).active, 'touch input hides the controller cursor');
  // ---- disconnect + Xbox: its own glyphs ----
  await pad(() => window.__pad.disconnect()); await p.waitForTimeout(100); s = await st(); c(/disconnected/.test(s.toast) && !s.active, 'disconnect toast; cursor hidden');
  await pad(id => window.__pad.connect(id), XB_ID); await p.waitForTimeout(150); s = await st();
  c(s.kind === 'xbox' && /Xbox controller connected/.test(s.toast) && /LB\/RB/.test(s.toast) && /A.*select/.test(s.toast) && /Menu/.test(s.toast), `Xbox toast: "${s.toast.slice(0, 120)}…"`);
  if (shots) await shot(p, join(SHOTS, 'gamepad-toast-xbox-844x390.png'));
  // ---- determinism: everything the pad did is in commandLog; the Node replay of that log reaches the browser hash ----
  const run = await p.S(() => { const w = window.game.world; window.game.paused = true; return { cmds: (w.commandLog || []).map(c => ({ ...c })), end: w.tick, hash: window.game.stateHash() }; });
  const rh = replay(run); c(rh === run.hash, `browser hash at tick ${run.end} == Node replay of its ${run.cmds.length} commands (${run.hash})`);
  c(p.errors.length === 0 && cons.length === 0, `no page/console errors (${[...p.errors, ...cons].slice(0, 3).join(' | ')})`);
  // ---- desktop mouse untouched: real right-click order still recorded the same way ----
  const d = await newPage({}); await d.addInitScript(MOCK); await openTitle(d, url); await startSandbox(d);
  const dv = await d.S(() => { const w = window.game.world, g = window.game, u = w.units.find(o => o.owner === 'player' && o.type === 'villager'); return { id: u.id, q: g.toScreen(u.x, u.y) }; });
  await d.mouse.click(dv.q.x, dv.q.y); await d.waitForTimeout(80); await d.mouse.click(dv.q.x + 90, dv.q.y + 40, { button: 'right' }); await d.waitForTimeout(80);
  const dl = await d.S(() => (window.game.world.commandLog || []).slice(-1)[0]); c(dl && dl.type === 'order' && !dl.args.amove && dl.args.ids.includes(dv.id), `desktop mouse: click select + right-click move still work (${dl && dl.type})`);
  c(await d.S(() => !window.game.pad), 'desktop without a controller never loads gamepad.js');
  // ---- 750x342 fit ----
  const sm = await newPage({ phone: true, ctxOpts: { viewport: { width: 750, height: 342 } } }); await sm.addInitScript(MOCK); await openTitle(sm, url); await startSandbox(sm);
  await sm.S(id => window.__pad.connect(id), PS_ID); await sm.waitForFunction(() => window.game.pad); await sm.waitForTimeout(200);
  const t2 = await sm.locator('#pad-toast').boundingBox(); await sm.S(() => window.__pad.tap(9)); const m2 = await sm.locator('#pad-menu').boundingBox();
  c(t2.x >= 0 && t2.x + t2.width <= 750 && t2.y + t2.height <= 342 && m2.y >= 0 && m2.y + m2.height <= 342, `750x342: toast ${Math.round(t2.width)}x${Math.round(t2.height)} and menu ${Math.round(m2.width)}x${Math.round(m2.height)} fit`);
  if (shots) await shot(sm, join(SHOTS, 'gamepad-menu-750x342.png'));
  await closeAll(); srv.close();
  mkdirSync(join(ROOT, 'proof'), { recursive: true }); writeFileSync(join(ROOT, 'proof/gamepad.log'), c.lines.join('\n') + `\n${c.fails ? 'SOME FAILED' : 'ALL PASS'}\n`);
  console.log(c.fails ? `RESULT: ${c.fails} FAILED` : 'RESULT: ALL PASS'); return c.fails ? 1 : 0;
}
