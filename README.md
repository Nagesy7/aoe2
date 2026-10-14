# Inu Empires

An AoE2-style browser RTS where every unit is a Japanese spitz-type dog (Shiba, Kai, Kishu, Shikoku, Hokkaido, Akita, Japanese Spitz). Same AoE2 roles, stats and mechanics; original procedural canvas art (`src/inu.js`, title screen `src/title.js`).

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

## Ages and tech tree
All data lives in `src/techtree.js` (ages, buildings, units, techs) so it is easy to extend. The HUD shows the current age at the right; reaching a new age shows a banner.

**Age advancement** is researched at the Town Center (the button shows cost, time and any missing requirement, with a progress bar while researching):

| Age | Cost | Time | Requires (2 different completed buildings) |
|---|---|---|---|
| Feudal | 500 food | 130 s | House, Mill, Lumber Camp, Mining Camp, Barracks (Dock if present) |
| Castle | 800 food, 200 gold | 160 s | Archery Range, Stable, Blacksmith, Market |
| Imperial | 1000 food, 800 gold | 190 s | Monastery, University, Castle (or a Castle on its own) |

A building works through its queue one item at a time. So, as in AoE2, a Town Center researching an age (or Loom/Wheelbarrow) trains no villagers until the research ends; queued villagers wait. The same age or tech cannot be queued twice, and researched techs disappear from the panel.

**Locked content** shows greyed out with `Requires Feudal Age` (etc.) in the build menu and building panels, and is refused by the sim before its age.

| Age | Buildings | Units (at) | Techs (at) |
|---|---|---|---|
| Dark | House, Mill, Lumber Camp, Mining Camp, Farm, Barracks | Villager (TC), Militia (Barracks) | Loom, Wheelbarrow (TC) |
| Feudal | Archery Range 175w, Stable 175w, Blacksmith 150w, Market 175w, Watch Tower 25w+125s | Archer 25w 45g (Range), Scout Cavalry 80f (Stable), Spearman 35f 25w (Barracks) | Double-Bit Axe (Lumber Camp), Horse Collar (Mill), Gold Mining (Mining Camp), Forging (Blacksmith) |
| Castle | Castle 650s, Monastery 175w, University 200w | Knight (Stable), Monk (Monastery), Crossbowman upgrade (Range) | Bow Saw, Heavy Plow, Gold Shaft Mining, Iron Casting, Hand Cart (TC) |
| Imperial | Wonder 1000w 1000s 1000g | Trebuchet (Castle) | Two-Man Saw, Crop Rotation, Blast Furnace |

**Live tech effects** (integrated with gathering):
- Loom: villagers +15 HP (25 → 40), existing and new.
- Wheelbarrow / Hand Cart: carry capacity +25% each (10 → 13 → 15), villager speed +10% each.
- Double-Bit Axe / Bow Saw / Two-Man Saw: wood rate +20% / +20% / +10% (additive, 1.5× total).
- Gold Mining / Gold Shaft Mining: gold rate +15% each.
- Horse Collar / Heavy Plow / Crop Rotation: new farms hold +75 / +125 / +175 food (175 → 550).
- Forging / Iron Casting / Blast Furnace: +1 / +1 / +2 shown attack for infantry and cavalry.
- Crossbowman: existing Archers are upgraded, and the Archer button trains Crossbowmen.

Military units train, move and show their stats (HP, attack, armor, range, speed). **There is no combat yet.** Building/research times are AoE2 values. Gather rates are scaled (see above), so economy timings run faster than real AoE2.

## Online 1v1 (deterministic lockstep)
The main menu (plain URL) offers **Single Player**, **Host 1v1** and **Join 1v1** (room code). Old single-player URLs
(`?enemy=0`, `?scenario=skirmish`, `?raids=1`, or `?play=sp`) skip the menu.

**How to play online**
- *Two tabs, same browser (no server, works on the live site):* open https://aoe2-ashen.vercel.app/ in two tabs.
  Tab 1: "Online via: Same browser (two tabs)" → **Host 1v1** → note the 4-letter code. Tab 2: same transport, type the
  code → **Join 1v1**. Both click **Ready**; the game starts. (Shortcut for tab 2: `https://aoe2-ashen.vercel.app/?net=tabs&join=CODE`.)
- *Two machines (relay):* Vercel's static hosting cannot run WebSockets, so run the relay somewhere both players can reach:
  `npm install && node server/relay.mjs --port 8787` (add `--static .` to also serve the game from it). Expose it with
  any TLS front (e.g. `cloudflared tunnel --url http://localhost:8787` gives a free `https://….trycloudflare.com`
  URL without an account, or any Node host such as Render/Fly/Railway free tiers). Both players then open
  `https://aoe2-ashen.vercel.app/?relay=wss://YOUR-RELAY-HOST/ws`, pick **Relay server**, one hosts and one joins
  with the code. Locally: `node server/relay.mjs --static .` and open `http://localhost:8787/` in two browsers
  (the relay URL defaults to the same origin `/ws`).
- Optional: `&speed=N` on the host's URL runs game time N× faster (used by tests); `&delay=N` changes the input delay.

**How it works**
- `src/sim.js`: the simulation only advances in fixed 20 Hz ticks (`stepTick`, `TICK_DT = 0.05`). Randomness is the
  seeded LCG `rng(seed)` (map generation only); there is no `Math.random`/`Date` in sim/combat/techtree. Distances
  use `hyp()` (sqrt is correctly rounded by IEEE-754, `Math.hypot` is not guaranteed); trig was removed from the sim.
  Iteration is over arrays in creation order; sorts are stable.
- Every action is a command `{tick, player, type, args}` (`order` = right-click move/gather/build/attack/hunt,
  `rally`, `build`, `train`, `research`, `ageup`, `cancel`, `stop`) applied by `applyCommand()`. Single player applies
  them at the current tick boundary (logged in `world.commandLog`); multiplayer through the lockstep scheduler.
  `encodeCommand`/`decodeCommand` serialize them; coordinates are quantized to 1/64 tile.
- Two players share one world: `world.players.{player,enemy}` hold stockpile/age/techs, and `world.cur` says whose
  command/unit is being processed (`world.stockpile` etc. are views onto it). Player 2 plays the `enemy` side.
  The 1v1 map (88×88) is point-mirrored: P1 (blue) top-left, P2 (red) bottom-right, identical resources.
- `src/lockstep.js`: commands issued at tick T run at T+3 (input delay 150 ms). Each tick both clients send their
  set (empty sets too); a tick is simulated only when both sets are present, otherwise the client stalls and shows
  "Waiting for opponent…" (after 1 s it asks the peer to resend). Every 20 ticks each client sends `stateHash()`
  (FNV-1a over bit-exact positions, HP, states, carry, stockpiles, ages, techs, buildings, queues, resources,
  projectiles); a mismatch shows a red **DESYNC** banner with the tick and logs it to the console.
- `src/net.js`: transports (`RelayBus` WebSocket, `TabsBus` BroadcastChannel) and the lobby (hello / ready / start
  with seed, ping every second, disconnect after 6 s silence or relay `peer-left`). HUD shows ping, delay, tick and
  the number of matched hash checks.
- `server/relay.mjs`: rooms by code, max 2 members, forwards messages, notifies `peer-left`, optional static serving.
- Fog of war in multiplayer (`computeFog` in `src/render.js`): each client sees only what its own units/buildings
  see (black = unexplored, dimmed = explored), enemy units outside vision are not drawn or selectable, enemy
  buildings are remembered once seen.

## Layout
- `src/techtree.js`: tech tree data tables (ages, age-up requirements, buildings, units, technologies)
- `src/sim.js`: pure simulation (world, A* pathfinding, villager state machine, training, houses, population, selection/hit-testing, right-click command semantics, camera clamp, screen<->world transform); no DOM, runs in Node
- `src/ui-state.js`: pure pointer/build-mode state machine (click vs drag, placement attempt, build-mode exit), used by the browser UI and by headless tests
- `src/render.js`: canvas rendering (paths of selected units, ghost, drag box, progress bars, rally flag)
- `src/lockstep.js`, `src/net.js`, `server/relay.mjs`: lockstep scheduler, transports + lobby, relay server
- `src/main.js`: menu/lobby, input (all actions issued as commands), camera, HUD/panels/buttons, fixed-tick loop. Exposes `window.game` for automation (read state + `tick(seconds)` time advance)

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
node tests/ages.test.mjs         # ages/tech tree headless tests -> proof/ages-test.log
node scripts/ages.mjs           # ages browser proof (real clicks, fast-forward) -> proof/ages-*.png, proof/ages.log
node scripts/round6.mjs         # round 6: camps, farms, sheep, barracks, build menu -> proof/round6-*.png, proof/round6.log
node tests/determinism.test.mjs # determinism + lockstep scheduler -> proof/determinism.log
node scripts/lockstep.mjs       # 1v1 over the local relay, two browser contexts, real input -> proof/lockstep-*.png, proof/lockstep.log
node scripts/lockstep.mjs --tabs [URL]  # BroadcastChannel two-tab mode against the live site -> proof/lockstep-tabs-*.png/.log
```
Legacy (round 1-3) headless tests use a fixture with a zeroed stockpile and one villager so their absolute stockpile assertions stay meaningful; round-4 tests use the real default start.
