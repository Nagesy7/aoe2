# Inu Empires feature map

Each row: where the feature lives, which headless test covers it, and which browser proof flow shows it
(`node scripts/ctl.mjs run <flow>`; flows live in `scripts/flows/`). `npm test` runs every test listed here.
`node scripts/ctl.mjs verify [--url U]` is the smoke check (title buttons, skirmish start, tap/click select, order) at 844x390 and 1366x768.

| Feature | Source | Test (section) | Proof flow -> output |
|---|---|---|---|
| Title menu, clan pick, skirmish / sandbox / 1v1 entry | `index.html`, `src/main.js`, `src/title.js` | `tests/ip.test.mjs` (names) | `ctl verify`, `ctl shot title`, `run live-title` -> proof/live-lag-*.{log,webm} |
| Clan cards (hover cinematic, rarity glow) | `src/civcards.js` | `tests/full.test.mjs` §5 | `run lobby` -> proof/full-lobby-* |
| Camera pan (WASD, edge, middle-drag, touch drag, pinch) + clamp | `src/main.js`, `src/sim.js` (clamp) | `tests/gather.test.mjs` camera clamp | `run camera` -> proof/camera-*; `run landscape` |
| Selection (click, box, tap, long-press) + hit-testing | `src/sim.js`, `src/ui-state.js`, `src/main.js` | `tests/gather.test.mjs` hit-testing, multi-select | `run screenshot` -> proof/01..11-*; `run efficiency` |
| Gathering, drop-off, retask, conservation | `src/sim.js` | `tests/gather.test.mjs` gathering, retask, round 6 | `run gather-verify` -> proof/gather-verify-* |
| Water ponds + shore fishing | `src/terrain.js`, `src/sim.js`, `src/render.js` | `tests/gather.test.mjs` water & fishing | `run shots-v2` -> /workspace/inu-empires-shots/v2-* |
| Training, pop cap, houses, rally points | `src/sim.js`, `src/techtree.js` | `tests/gather.test.mjs` round 4 | `run round4` -> proof/round4-* |
| Placement + unit eviction | `src/sim.js`, `src/ui-state.js` | `tests/gather.test.mjs` round 5 | `run round5` -> proof/round5-* |
| Camps, farms, sheep, Dojo, build menu | `src/sim.js`, `src/main.js` | `tests/gather.test.mjs` round 6 | `run round6`, `run buildmenu` -> proof/full-buildmenu-* |
| Ages + tech tree | `src/techtree.js`, `src/sim.js` | `tests/ages.test.mjs`, `tests/full.test.mjs` §4 | `run ages` -> proof/ages-* |
| Combat, aggro, formations, building damage | `src/combat.js`, `src/sim.js` | `tests/combat.test.mjs`, `tests/full.test.mjs` §1-3 | `run combat` -> proof/combat-* |
| Unit handling: attack-move, queues, groups, idle/army buttons | `src/main.js` | `tests/efficiency.test.mjs` | `run efficiency` -> proof/efficiency-* |
| Clans: traits, unique units | `src/civs.js` | `tests/full.test.mjs` §5 | `run full` -> proof/full-* |
| Clan balance (45-55% each) | `src/civs.js`, `src/ai.js`, `sim/balance.mjs` | `tests/full.test.mjs` §8 reads proof/balance.json | `ctl balance` -> proof/balance.{json,txt}; `sim/compare.mjs` |
| Computer opponent + economy | `src/ai.js` | `tests/full.test.mjs` §6, §7b | `run full`, `run ai-eco` (headless probe) |
| Deterministic lockstep 1v1 (relay / tabs / HTTP) | `src/lockstep.js`, `src/net.js`, `server/relay.mjs`, `api/relay.js` | `tests/determinism.test.mjs`, `tests/full.test.mjs` §7 | `run lockstep [--tabs URL]` -> proof/lockstep-* |
| Inu Verse art: unit sprites, villager tool sheets, animation | `src/art.js`, `src/inu.js`, `src/anim.js`, `art/` | `tests/anim.test.mjs` | `run art`, `run inu` -> proof/art-*, proof/inu-* |
| Render-only unit interpolation (no jitter) | `src/main.js`, `src/render.js` | (render only; sim untouched -> `tests/determinism.test.mjs`) | proof/jitter-units-*.json |
| Phone landscape layout (844x390), touch controls | `index.html` CSS, `src/main.js` | - | `run landscape` -> proof/landscape-*, proof/ctl-landscape.log; `ctl verify` |
| $KIBBLE: wallet (Phantom), shop x10000 prices, tiers, cosmetics only, ?demo=1 | `src/kibble.js`, `src/kibble-ui.js` | `tests/kibble.test.mjs` | `run kibble` -> proof/kibble-*, proof/ctl-kibble.log |
| Back to Inu Verse button | `src/kibble-ui.js` (mountHome), `src/main.js` | - | `ctl shot skirmish` |
| IP guard (no franchise names) | whole repo | `tests/ip.test.mjs` | docs/IP_AUDIT.md |
