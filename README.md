# Inu Empires

A classic-style browser RTS where every unit is a Japanese spitz-type dog (Shiba, Kai, Kishu, Shikoku, Hokkaido, Akita, Japanese Spitz). Same classic RTS roles, stats and mechanics; original procedural canvas art (`src/inu.js`, title screen `src/title.js`).

Plain HTML5 canvas + vanilla ES modules. No build step.

## Run
```
cd <repo>
python3 -m http.server 8000   # or: npx serve .
```
Open http://localhost:8000/

## Starting state
3 worker pups, a Den Hall, and a stockpile of **200 food, 200 wood, 100 gold, 100 stone**
(the request "200 food/wood/100 gold/stone" is read as 200 food + 200 wood, 100 gold + 100 stone).
Population is shown in the HUD (`Pop 3/5`). The Den Hall gives 5 pop, each completed Kennel Hut gives +5 (max 200).

## Controls
- **Camera**: WASD / arrow keys, mouse at screen edge, or middle-mouse drag. Clamped to the map edges (no black bands); a viewport larger than the map centers it.
- **Left click**: select whatever is under the cursor (priority worker pup > building > resource > tile). The info panel (bottom-left) shows tile (x,y), resource type + remaining amount (live), building name + HP (+ queue/progress), or worker pup task + carried amount.
- **Left drag**: box-select worker pups. With several selected the panel shows the count and a task summary.
- **Right click** (worker pups selected):
  - resource: gather. Worker Pups stand on walkable tiles adjacent to the node (spread over different tiles), carry up to 10, walk to a tile adjacent to the Den Hall, deposit, repeat. Retasking to a different resource type while carrying first drops the load at the Den Hall (nothing is ever lost); same-type retask keeps the load.
  - house foundation: help build it (each builder adds its own work, so n builders build n× faster).
  - ground: move (a group spreads across nearby tiles).
- **Right click** (Den Hall selected): set the rally point. New worker pups walk there (or gather, if it is on a resource).
- **Train Worker Pup** button (Den Hall selected): 50 food, 25 s, queue up to 5, with a progress bar and queue icons. Blocked at the population cap with a red HUD message.
- **Build Kennel Hut** button (worker pup(s) selected): 25 wood, 2×2 ghost follows the cursor, green = valid, red = invalid (obstacles, off-map, overlap). Left click places the foundation and the selected worker pups walk over and build it (25 s for one builder). Right click / Esc cancels placement.

**Building placement rule: units are ignored (classic-RTS-style eviction).** The ghost's validity depends only on terrain/resources/buildings/foundations and the map bounds, never on units; tiles inside the ghost that hold worker pups get an orange outline as a hint. When a foundation is placed (and again, as a safety pass, at construction start and at completion) every unit standing in the footprint, builders included, is moved to the nearest free walkable tile outside, and resumes its task from there. Builders always work from tiles adjacent to the footprint. Any unit whose current path crosses the new footprint, or whose destination/reserved tile is inside it, repaths immediately.

Movement uses A* on the tile grid (8-way, no corner cutting). Trees, mines, bushes, buildings and foundations block. Unreachable targets are handled gracefully: a move goes to the nearest reachable tile; an unreachable resource falls back to the nearest reachable node of the same type, otherwise the worker pup goes idle with note "unreachable".

## Buildings, economy and units (round 6)
| Building | Cost | Size | Build time (1 builder) | Role |
|---|---|---|---|---|
| Kennel Hut | 25 wood | 2x2 | 25 s | +5 pop |
| Timber Lodge | 100 wood | 2x2 | 35 s | drop-off: wood |
| Dig Site | 100 wood | 2x2 | 35 s | drop-off: gold, stone |
| Granary | 100 wood | 2x2 | 35 s | drop-off: food |
| Rice Paddy | 60 wood | 3x3 | 15 s | 175 food, must touch a Granary or Den Hall |
| Dojo | 175 wood | 3x3 | 50 s | trains Footpaw |

- **Build menu**: selecting worker pup(s) shows all six buttons with costs (tooltips give size/rules). Unaffordable ones are greyed out and show what is missing, e.g. `need 75 wood`.
- **Build mode**: a click (press+release within 5 px) attempts placement and always leaves build mode, whether it worked or was refused (red HUD message). A left-drag in build mode is a drag-box selection and never places. Esc or right-click cancels.
- **Drop-off**: worker pups return to the nearest valid drop-off for what they carry, by A* path distance (unreachable sites are skipped). The Den Hall accepts everything.
- **Rice Paddies**: the ghost is red unless the 3x3 footprint touches a Granary or Den Hall (foundations count). A farm foundation blocks movement like any building (the eviction rule applies); once complete it is walkable and its first builder starts farming it automatically, standing on the field. When its 175 food runs out it disappears.
- **Gather rates** (per worker pup per second; scaffold speeds about 2.5x the classic reference rates, keeping their ordering): berries (forage) 0.75 < farm 0.9 < butchering a carcass 1.2; wood, gold and stone 1.0. Carry limit 10.
- **Sheep**: 7 neutral sheep (4 near the Den Hall, 3 scattered). A worker pup touching a neutral sheep, or ordered onto it (right-click), converts it to you. Owned sheep can be selected (click or drag-box; a box that also holds worker pups or Footpaws selects only those) and moved with right-click. Right-click your own sheep with worker pups: the first to arrive kills it where it stands, leaving a carcass with 100 food that they then gather from adjacent tiles. Sheep do not count towards population.
- **Dojo / Footpaw**: Train Footpaw (60 food, 20 gold, 21 s), with the same queue (5 per building), progress bar, rally point (right-click with the Dojo selected) and population rules as worker pups. The pop check counts living units plus everything queued in every building, so the Den Hall and Dojo share the cap. Footpaw are drawn as red units with a spear and can be selected and moved. **There is no combat in this scaffold.**

## Ages and tech tree
All data lives in `src/techtree.js` (ages, buildings, units, techs) so it is easy to extend. The HUD shows the current age at the right; reaching a new age shows a banner.

**Age advancement** is researched at the Den Hall (the button shows cost, time and any missing requirement, with a progress bar while researching):

| Age | Cost | Time | Requires (2 different completed buildings) |
|---|---|---|---|
| Pack | 500 food | 130 s | Kennel Hut, Granary, Timber Lodge, Dig Site, Dojo (Dock if present) |
| Fortress | 800 food, 200 gold | 160 s | Bow Yard, Paddock, Forge, Bazaar |
| Shogun | 1000 food, 800 gold | 190 s | Shrine, Academy, Fortress (or a Fortress on its own) |

A building works through its queue one item at a time. So, as in classic RTS games, a Den Hall researching an age (or Thick Coat/Carry Sling) trains no worker pups until the research ends; queued worker pups wait. The same age or tech cannot be queued twice, and researched techs disappear from the panel.

**Locked content** shows greyed out with `Requires Pack Age` (etc.) in the build menu and building panels, and is refused by the sim before its age.

| Age | Buildings | Units (at) | Techs (at) |
|---|---|---|---|
| Puppy | Kennel Hut, Granary, Timber Lodge, Dig Site, Rice Paddy, Dojo | Worker Pup (Den Hall), Footpaw (Dojo) | Thick Coat, Carry Sling (Den Hall) |
| Pack | Bow Yard 175w, Paddock 175w, Forge 150w, Bazaar 175w, Lookout Tower 25w+125s | Bow Pup 25w 45g (Range), Scout Rider 80f (Paddock), Pike Pup 35f 25w (Dojo) | Keen Axe (Timber Lodge), Paddy Terraces (Granary), Gold Sniffing (Dig Site), Tempered Claws (Forge) |
| Fortress | Fortress 650s, Shrine 175w, Academy 200w | Armored Rider (Paddock), Shrine Keeper (Shrine), Longbow Pup upgrade (Range) | Crosscut Saw, Iron Hoe, Deep Dig, Steel Claws, Pack Cart (Den Hall) |
| Shogun | Grand Torii 1000w 1000s 1000g | Boulder Thrower (Fortress) | Twin Saw, Season Planting, Dragon Forge |

**Live tech effects** (integrated with gathering):
- Thick Coat: worker pups +15 HP (25 → 40), existing and new.
- Carry Sling / Pack Cart: carry capacity +25% each (10 → 13 → 15), worker pup speed +10% each.
- Keen Axe / Crosscut Saw / Twin Saw: wood rate +20% / +20% / +10% (additive, 1.5× total).
- Gold Sniffing / Deep Dig: gold rate +15% each.
- Paddy Terraces / Iron Hoe / Season Planting: new farms hold +75 / +125 / +175 food (175 → 550).
- Tempered Claws / Steel Claws / Dragon Forge: +1 / +1 / +2 shown attack for infantry and cavalry.
- Longbow Pup: existing Bow Pups are upgraded, and the Bow Pup button trains Crossbowmen.

Military units train, move and show their stats (HP, attack, armor, range, speed). **There is no combat yet.** Building/research times are classic-RTS reference values. Gather rates are scaled (see above), so economy timings run faster than real classic RTS.

## Online 1v1 (deterministic lockstep)
The main menu (plain URL) offers **Single Player**, **Host 1v1** and **Join 1v1** (room code). Old single-player URLs
(`?enemy=0`, `?scenario=skirmish`, `?raids=1`, or `?play=sp`) skip the menu.

**How to play online**
- *Two tabs, same browser (no server, works on the live site):* open https://inu-empires.vercel.app/ in two tabs.
  Tab 1: "Online via: Same browser (two tabs)" → **Host 1v1** → note the 4-letter code. Tab 2: same transport, type the
  code → **Join 1v1**. Both click **Ready**; the game starts. (Shortcut for tab 2: `https://inu-empires.vercel.app/?net=tabs&join=CODE`.)
- *Two machines (relay):* Vercel's static hosting cannot run WebSockets, so run the relay somewhere both players can reach:
  `npm install && node server/relay.mjs --port 8787` (add `--static .` to also serve the game from it). Expose it with
  any TLS front (e.g. `cloudflared tunnel --url http://localhost:8787` gives a free `https://….trycloudflare.com`
  URL without an account, or any Node host such as Render/Fly/Railway free tiers). Both players then open
  `https://inu-empires.vercel.app/?relay=wss://YOUR-RELAY-HOST/ws`, pick **Relay server**, one hosts and one joins
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

## Full RTS layer (clans, computer opponent, construction, Forge, online over HTTP)
Names, art labels and techs are original (no third-party RTS franchise names or assets). Internal ids (`town_center`, `militia`…) are unchanged so saves/tests stay stable; everything the player sees uses the Inu names below.

| Ages | Puppy → Pack → Fortress → Shogun (costs/requirements as in the table above) |
|---|---|
| Buildings | Den Hall, Kennel Hut, Timber Lodge, Dig Site, Granary, Rice Paddy, Dojo, Bow Yard, Paddock, Forge, Bazaar, Lookout Tower, Fortress, Shrine, Academy, Grand Torii |
| Units | Worker Pup, Footpaw → Blade Paw, Pike Pup → Halberd Pup, Bow Pup → Longbow Pup, Scout Rider → Swift Rider, Armored Rider, Shrine Keeper, Boulder Thrower + 6 clan uniques |

**Menu**: pick *Your clan*, then **⚔ Skirmish vs Computer** (choose the computer's clan next to it). *Sandbox* is the old practice camp. URL shortcuts: `?play=ai&civ=kishu&aiciv=akita&seed=7`, AI-vs-AI spectator `?play=watch&civ=kai&aiciv=hokkaido`.

**Pathfinding** (`src/sim.js`): A* on the 8-connected tile grid, no corner cutting, trees/mines/buildings/foundations block. Orders to 6+ units build one shared **flow field** (`flowField`, multi-source Dijkstra with deterministic tie-breaks) over the formation box; each unit descends it, then a short A* to its own formation slot (`orderMoveFlow`). Formation slots are distinct tiles, groups move at the slowest member's speed, stationary units are separated onto distinct tiles, units re-plan when a path gets blocked or they stop making progress.

**Unit AI**: worker pups auto-return/re-target the nearest node of the same kind; idle-worker pup button; attack-move; auto-retaliate; **stances** (Aggressive / Defensive / Stand Ground / No Attack, buttons when soldiers are selected; `stance` command).

**Computer opponent** (`src/ai.js`): plays only through `applyCommand` (same commands as a human, so it is deterministic and lockstep-safe). Trains Worker Pups to an age-dependent target, balances gatherers by ratio and stockpile, builds Kennel Huts ahead of the cap, drop sites next to the resource being worked, farms when wild food is gone, Dojo/Bow Yard/Forge/Paddock/Academy/Fortress, ages up, researches economy and Forge techs, trains a clan-flavoured army, garrisons worker pups when raided, defends, and attacks in waves at the side of your Den Hall that faces its base. Conquest victory: a player whose Den Halls and Fortresses are all destroyed loses.

**Construction**: foundations evict units; every builder adds its own work (n builders = n× speed); right-click a damaged own building with Worker Pups to **repair** (50% of the cost spread over the HP, stops when you run out); right-click a Den Hall / Lookout Tower / Fortress to **garrison** (15 / 5 / 20), *Ungarrison* button; garrisoned units heal, cannot be targeted, and each adds an arrow (base arrows 1 / 1 / 4, 5 pierce, range 7).

**Tech tree additions**: Forge armor line (Lacquer → Lamellar → Kabuto Plates), archery line (Fletched / Barbed Arrows, Quilted Vests), Stone Sniffing, Academy (Stone Joinery, Wind Reading), unit-line upgrades (Blade Paw, Halberd Pup, Swift Rider, Longbow Training). Existing units are upgraded in place.

### Clans (`src/civs.js`)
Every clan is free. Traits change how a clan plays, not raw power; $KIBBLE only unlocks cosmetic banners/coats (`COSMETICS`, no gameplay keys; verified by tests).

| Clan | Style | Traits | Unique (Fortress) |
|---|---|---|---|
| Shiba Clan | Economy | berry foraging +15%, lumber +10% | Red Fang (fast cheap raider) |
| Akita Dominion | Fast ages | age-ups research 6% faster | Akita Guardian (armored infantry) |
| Kishu Archers | Archers | archers +1 range, Bow Yard units cost 10% more | Kishu Longbow (range 7) |
| Shikoku Riders | Cavalry | cavalry 20% faster, Paddock units 50% cheaper | Boar Rider (building breaker) |
| Hokkaido Wardens | Defense | buildings +5% HP, build 8% faster, Den Hall +1 arrow | Frost Guard (anti-archer) |
| Kai Brindles | Infantry | Dojo trains 30% faster, infantry +35% HP | Brindle Striker (anti-cavalry) |

**Water & fishing**: maps have ponds (one by each base plus a central lake on 1v1 maps). Water is impassable and unbuildable; Worker Pups fish from the shore with the net (fish 200 food, 0.42/s), dropping at a Granary or Den Hall. The computer builds a Granary next to its fishing spot.

**Balance sim**: `node sim/balance.mjs --seeds 8 --minutes 30` plays every pair of clans from both map sides on mirrored maps (AI vs AI, worker threads) and writes `proof/balance.json`. A game ends by conquest or, at the time limit, by score (value of living units + buildings + stockpile + age). Win rates and their sample sizes are reported; see the report for the exact numbers and the limits (most games end on score, not conquest).

### Online over Vercel (HTTP relay)
Vercel functions cannot hold WebSockets, so `api/relay.js` is an HTTP polling relay (POST batches, GET `?room=&after=`) backed by **Upstash Redis REST** (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, or Vercel KV's `KV_REST_API_URL/TOKEN`). Pick *Online via → Vercel relay (HTTP polling)*. Without those env vars the endpoint answers 503 and the lobby shows "HTTP relay unavailable" — **the live deployment currently has no Upstash store configured**, so on the live site use *Same browser (two tabs)* or a WebSocket relay. `server/relay.mjs` serves the same `/api/relay` protocol from memory for local tests. Limits: polling adds ~100-300 ms, so HTTP games use an input delay of 8 ticks (400 ms); rooms expire 2 h after the last message; no NAT traversal/WebRTC; no reconnection of a closed tab into a running game.

Tests: `node tests/full.test.mjs` (pathfinding, AI, construction, tech tree, clans, AI-vs-AI lockstep determinism, balance report) and `node scripts/ctl.mjs run full` (Playwright, real mouse/keyboard + iPhone landscape touch → `proof/full-*.png`).

## Layout
- `src/techtree.js`: tech tree data tables (ages, age-up requirements, buildings, units, technologies)
- `src/sim.js`: pure simulation (world, A* pathfinding, worker pup state machine, training, houses, population, selection/hit-testing, right-click command semantics, camera clamp, screen<->world transform); no DOM, runs in Node
- `src/ui-state.js`: pure pointer/build-mode state machine (click vs drag, placement attempt, build-mode exit), used by the browser UI and by headless tests
- `src/render.js`: canvas rendering (paths of selected units, ghost, drag box, progress bars, rally flag)
- `src/lockstep.js`, `src/net.js`, `server/relay.mjs`: lockstep scheduler, transports + lobby, relay server
- `src/main.js`: menu/lobby, input (all actions issued as commands), camera, HUD/panels/buttons, fixed-tick loop. Exposes `window.game` for automation (read state + `tick(seconds)` time advance)

## Tests / proof
```
node tests/gather.test.mjs      # headless: gathering + conservation, retask, hit-testing, camera clamp,
                                #   training/pop cap/houses, A* pathfinding, multi-select + parallel gather,
                                #   placement eviction + repath, camps/drop-off, farms, sheep,
                                #   Footpaws/pop, build-mode exit, mixed-task resource balance
                                #   -> proof/gather-test.log
npm install && npx playwright install chromium
node scripts/ctl.mjs run screenshot  # rounds 1-3 browser proof -> proof/01..11-*.png, proof/screenshot.log
node scripts/ctl.mjs run round4  # round 4 browser proof (real mouse/keyboard only) -> proof/round4-*.png, proof/round4.log
node scripts/ctl.mjs run round5  # round 5 eviction proof (real mouse/keyboard only) -> proof/round5-*.png, proof/round5.log
node scripts/ctl.mjs run gather-verify  # all gather paths via real clicks (4 types, mill/camps, farm, carcass) -> proof/gather-verify-*.png, proof/gather-verify.log
node tests/ages.test.mjs         # ages/tech tree headless tests -> proof/ages-test.log
node scripts/ctl.mjs run ages  # ages browser proof (real clicks, fast-forward) -> proof/ages-*.png, proof/ages.log
node scripts/ctl.mjs run round6  # round 6: camps, farms, sheep, barracks, build menu -> proof/round6-*.png, proof/round6.log
node tests/determinism.test.mjs # determinism + lockstep scheduler -> proof/determinism.log
node scripts/ctl.mjs run lockstep  # 1v1 over the local relay, two browser contexts, real input -> proof/lockstep-*.png, proof/lockstep.log
node scripts/ctl.mjs run lockstep  --tabs [URL]  # BroadcastChannel two-tab mode against the live site -> proof/lockstep-tabs-*.png/.log
```
Legacy (round 1-3) headless tests use a fixture with a zeroed stockpile and one worker pup so their absolute stockpile assertions stay meaningful; round-4 tests use the real default start.
