# AoE2-style browser scaffold

Plain HTML5 canvas + vanilla ES modules. No build step.

## Run
```
cd /workspace/aoe2
python3 -m http.server 8000   # or: npx serve .
```
Open http://localhost:8000/

## Starting state
3 villagers, a Town Center, and a stockpile of **200 food, 200 wood, 100 gold, 100 stone**
(the request "200 food/wood/100 gold/stone" is read as 200 food + 200 wood, 100 gold + 100 stone).
Population is shown in the HUD (`Pop 3/5`). The Town Center gives 5 pop, each completed House gives +5 (max 200).

## Controls
- **Camera**: WASD / arrow keys, mouse at screen edge, or middle-mouse drag. Clamped to the map edges (no black bands); a viewport larger than the map centers it.
- **Left click**: select whatever is under the cursor (priority villager > building > resource > tile). The info panel (bottom-left) shows tile (x,y), resource type + remaining amount (live), building name + HP (+ queue/progress), or villager task + carried amount.
- **Left drag**: box-select villagers. With several selected the panel shows the count and a task summary.
- **Right click** (villagers selected):
  - resource: gather. Villagers stand on walkable tiles adjacent to the node (spread over different tiles), carry up to 10, walk to a tile adjacent to the Town Center, deposit, repeat. Retasking to a different resource type while carrying first drops the load at the Town Center (nothing is ever lost); same-type retask keeps the load.
  - house foundation: help build it (each builder adds its own work, so n builders build n× faster).
  - ground: move (a group spreads across nearby tiles).
- **Right click** (Town Center selected): set the rally point. New villagers walk there (or gather, if it is on a resource).
- **Train Villager** button (Town Center selected): 50 food, 25 s, queue up to 5, with a progress bar and queue icons. Blocked at the population cap with a red HUD message.
- **Build House** button (villager(s) selected): 25 wood, 2×2 ghost follows the cursor, green = valid, red = invalid (obstacles, off-map, overlap). Left click places the foundation and the selected villagers walk over and build it (25 s for one builder). Right click / Esc cancels placement.

**Building placement rule: units are ignored (AoE2-style eviction).** The ghost's validity depends only on terrain/resources/buildings/foundations and the map bounds, never on units; tiles inside the ghost that hold villagers get an orange outline as a hint. When a foundation is placed (and again, as a safety pass, at construction start and at completion) every unit standing in the footprint, builders included, is moved to the nearest free walkable tile outside, and resumes its task from there. Builders always work from tiles adjacent to the footprint. Any unit whose current path crosses the new footprint, or whose destination/reserved tile is inside it, repaths immediately.

Movement uses A* on the tile grid (8-way, no corner cutting). Trees, mines, bushes, buildings and foundations block. Unreachable targets are handled gracefully: a move goes to the nearest reachable tile; an unreachable resource falls back to the nearest reachable node of the same type, otherwise the villager goes idle with note "unreachable".

## Buildings, economy and units (round 6)
| Building | Cost | Size | Build time (1 builder) | Role |
|---|---|---|---|---|
| House | 25 wood | 2x2 | 25 s | +5 pop |
| Lumber Camp | 100 wood | 2x2 | 35 s | drop-off: wood |
| Mining Camp | 100 wood | 2x2 | 35 s | drop-off: gold, stone |
| Mill | 100 wood | 2x2 | 35 s | drop-off: food |
| Farm | 60 wood | 3x3 | 15 s | 175 food, must touch a Mill or Town Center |
| Barracks | 175 wood | 3x3 | 50 s | trains Militia |

- **Build menu**: selecting villager(s) shows all six buttons with costs (tooltips give size/rules). Unaffordable ones are greyed out and show what is missing, e.g. `need 75 wood`.
- **Build mode**: a click (press+release within 5 px) attempts placement and always leaves build mode, whether it worked or was refused (red HUD message). A left-drag in build mode is a drag-box selection and never places. Esc or right-click cancels.
- **Drop-off**: villagers return to the nearest valid drop-off for what they carry, by A* path distance (unreachable sites are skipped). The Town Center accepts everything.
- **Farms**: the ghost is red unless the 3x3 footprint touches a Mill or Town Center (foundations count). A farm foundation blocks movement like any building (the eviction rule applies); once complete it is walkable and its first builder starts farming it automatically, standing on the field. When its 175 food runs out it disappears.
- **Gather rates** (per villager per second; scaffold speeds about 2.5x AoE2, keeping AoE2's ordering): berries (forage) 0.75 < farm 0.9 < butchering a carcass 1.2; wood, gold and stone 1.0. Carry limit 10.
- **Sheep**: 7 neutral sheep (4 near the Town Center, 3 scattered). A villager touching a neutral sheep, or ordered onto it (right-click), converts it to you. Owned sheep can be selected (click or drag-box; a box that also holds villagers or militia selects only those) and moved with right-click. Right-click your own sheep with villagers: the first to arrive kills it where it stands, leaving a carcass with 100 food that they then gather from adjacent tiles. Sheep do not count towards population.
- **Barracks / Militia**: Train Militia (60 food, 20 gold, 21 s), with the same queue (5 per building), progress bar, rally point (right-click with the Barracks selected) and population rules as villagers. The pop check counts living units plus everything queued in every building, so the TC and Barracks share the cap. Militia are drawn as red units with a spear and can be selected and moved. **There is no combat in this scaffold.**

## Layout
- `src/sim.js`: pure simulation (world, A* pathfinding, villager state machine, training, houses, population, selection/hit-testing, right-click command semantics, camera clamp, screen<->world transform); no DOM, runs in Node
- `src/ui-state.js`: pure pointer/build-mode state machine (click vs drag, placement attempt, build-mode exit), used by the browser UI and by headless tests
- `src/render.js`: canvas rendering (paths of selected units, ghost, drag box, progress bars, rally flag)
- `src/main.js`: input, camera, HUD/panels/buttons, loop. Exposes `window.game` for automation (read state + `tick(seconds)` time advance)

## Tests / proof
```
node tests/gather.test.mjs      # headless: gathering + conservation, retask, hit-testing, camera clamp,
                                #   training/pop cap/houses, A* pathfinding, multi-select + parallel gather,
                                #   placement eviction + repath, camps/drop-off, farms, sheep,
                                #   militia/pop, build-mode exit, mixed-task resource balance
                                #   -> proof/gather-test.log
npm install && npx playwright install chromium
node scripts/screenshot.mjs     # rounds 1-3 browser proof -> proof/01..11-*.png, proof/screenshot.log
node scripts/round4.mjs         # round 4 browser proof (real mouse/keyboard only) -> proof/round4-*.png, proof/round4.log
node scripts/round5.mjs         # round 5 eviction proof (real mouse/keyboard only) -> proof/round5-*.png, proof/round5.log
node scripts/gather-verify.mjs  # all gather paths via real clicks (4 types, mill/camps, farm, carcass) -> proof/gather-verify-*.png, proof/gather-verify.log
node scripts/round6.mjs         # round 6: camps, farms, sheep, barracks, build menu -> proof/round6-*.png, proof/round6.log
```
Legacy (round 1-3) headless tests use a fixture with a zeroed stockpile and one villager so their absolute stockpile assertions stay meaningful; round-4 tests use the real default start.
