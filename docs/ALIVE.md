# Making Inu Empires feel alive (Nov 3 2026)

Goal (Zachary): "make Inu Empires feel more alive" with a tasteful, light layer of life on top of the game.
Everything here is **presentation only**: it lives in `src/alive.js` (lazy-loaded when a match starts), reads the world, and
never writes it. The deterministic sim, AI, lockstep and Inu Score replay are untouched.

## Hard rules
- **Outside the sim.** `src/alive.js` never imports anything that mutates and never stores data on sim objects (per-unit
  visual state is a `Map` keyed by id). It draws from its own PRNG (`vrand`, seeded from `Math.random`), never `sim.rng`.
- **Proof of determinism**: `npm test` (determinism.test), `ctl run lockstep` (two browsers, effects on), `sim/compare.mjs`
  (HEAD~ vs HEAD, identical win rates), and the `alive` flow: the browser's state hash at tick T with effects on and with
  effects off both equal a headless Node replay of the same match.
- **Phone first.** Pooled particles with hard caps, off-screen culling, a low-power mode (auto on phone landscape and when the
  smoothed frame time is over budget), and the existing render pause on hidden tabs (alive only updates inside `frame`).
- **Readable.** Day/night is a tint, never darker than ~28% overlay; rain is thin; every layer can be switched off.
- **Original.** All chatter lines are original Inu flavour (no franchise lines); all sound is synthesized WebAudio.

## What is built
| Layer | What you see/hear | Caps (full / low-power) |
|---|---|---|
| Chatter | Speech bubbles and emotes on your own pups: idle ("Need a job…"), under attack ("!"/"Grr!"), new age (cheers), building finished, unit trained | 3 / 2 bubbles on screen, 1 new per 1.5 s, 14 s per pup |
| Idle life | Idle units fidget, look around (flip), sit, scratch, hop; tails wag (body wiggle) | per-unit timers, on-screen only |
| Fauna | Birds fly over and land/hop on grass, butterflies near flowers, fish jump in water, rabbits/deer wander and flee from units. Not sim entities, not gatherable | birds 7/4, butterflies 5/0, critters 4/2, fish jumps 2/1 |
| Particles | Chimney smoke from working buildings, forge glow + sparks at the Blacksmith, Den Hall hearth flicker, dust when walking/building, splashes, fire + dark smoke on damaged buildings | 240 / 110 particles, pooled |
| Weather | Drifting cloud shadows, occasional light rain (splash rings on water), wind gusts that sway trees; day/night tint cycle (8 min) with warm window glow at night | rain drops 110 / 45 |
| Sound | Quiet ambient birds, wind, hammering, market murmur (only when relevant things are on screen), cooldowned; voice barks on select/order (pitch per unit type) | 1 ambient per 5 s, each 12-25 s |
| Bustle | Decorative townsfolk and little carts walking between your buildings; count grows with population and buildings | 0..8 / 0..4 |

## Toggles
In-game ✨ button (quick bar) opens a small panel: **Sound**, **Life & effects**, **Weather & day/night**. Remembered in
localStorage (`inu-alive`). URL overrides for tests: `?alive=0` (all visuals off), `?weather=0`, `?lowfx=1`.
Automation hook (read-only + presentation controls): `window.game.alive.stats()`, `.set({fx, weather, sound})`,
`.debug({ phase, rain })` for screenshots.

## Proof
- `ctl run alive` -> proof/alive.log (effects appear, toggles work, no console errors, sim hash identical on vs off).
- `ctl run alive-perf --tag before|after` -> proof/alive-perf.json (844x390 with 4x CPU throttle, and 1366x768).
- Screenshots /workspace/inu-empires-shots/alive-*.png, video proof/alive-*.webm (from the preview deploy).
