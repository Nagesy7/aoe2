// Pure (DOM-free) pointer / build-mode state machine, shared by the browser UI and headless tests.
// Rules: a left press+release without dragging (<= 5px) is a click; more is a drag-box.
// In build mode, a click attempts placement and ALWAYS exits build mode (success or refusal);
// a drag-box never places (it box-selects and stays in build mode); Esc / right-click cancel.
import { BUILDING_DEFS, canPlace, placeBuilding, unitsInFootprint, selectedUnits, boxSelect, selectAt } from './sim.js';
export const DRAG_PX = 5;
export function createUi() { return { placing: null, ghost: null, box: null, press: null, lastPlacement: null }; }
export function ghostAt(world, type, wx, wy) {
  const size = BUILDING_DEFS[type].size, tx = Math.round(wx - size / 2), ty = Math.round(wy - size / 2);
  return { type, tx, ty, size, valid: canPlace(world, type, tx, ty), units: unitsInFootprint(world, tx, ty, size).map(u => [Math.floor(u.x), Math.floor(u.y)]) };
}
export function startPlacing(ui, type) { ui.placing = type; ui.ghost = null; }
export function cancelPlacing(ui) { ui.placing = null; ui.ghost = null; }
export function updateGhost(ui, world, wx, wy) { ui.ghost = ui.placing ? ghostAt(world, ui.placing, wx, wy) : null; }
export function pointerDown(ui, sx, sy) { ui.press = { x: sx, y: sy }; ui.box = null; }
export function pointerMove(ui, sx, sy) { if (ui.press && Math.hypot(sx - ui.press.x, sy - ui.press.y) > DRAG_PX) ui.box = { x0: ui.press.x, y0: ui.press.y, x1: sx, y1: sy }; }
// toWorld: (sx,sy) => {x,y}. Returns what happened.
// issue(type, args): optional command sink (lockstep). Without it placement is applied directly (headless tests).
export function pointerUp(ui, world, toWorld, issue = null) {
  if (!ui.press) return null;
  const press = ui.press, box = ui.box; ui.press = null; ui.box = null;
  if (box) { const a = toWorld(box.x0, box.y0), b = toWorld(box.x1, box.y1); boxSelect(world, a.x, a.y, b.x, b.y); return { kind: 'box' }; }
  const p = toWorld(press.x, press.y);
  if (ui.placing) {
    const g = ghostAt(world, ui.placing, p.x, p.y);
    let b, ok;
    if (issue) { const ids = selectedUnits(world).map(u => u.id);
      const r = issue('build', { type: ui.placing, tx: g.tx, ty: g.ty, ids: g.valid ? ids : [] }, g.valid);
      b = r && r.id ? r : null; ok = r === undefined ? g.valid : !!b; }   // undefined: queued for a later lockstep tick
    else { b = g.valid ? placeBuilding(world, ui.placing, g.tx, g.ty, selectedUnits(world)) : (placeBuilding(world, ui.placing, g.tx, g.ty, []), null); ok = !!b; }
    ui.lastPlacement = { type: ui.placing, tx: g.tx, ty: g.ty, ok };
    cancelPlacing(ui);
    return { kind: 'place', ok, building: b };
  }
  selectAt(world, p.x, p.y); return { kind: 'select' };
}
