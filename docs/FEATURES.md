# Inu Empires feature map

Each row: where the feature lives, which headless test covers it, and which browser proof flow shows it
(`node scripts/ctl.mjs run <flow>`; flows live in `scripts/flows/`). `npm test` runs every test listed here.
`node scripts/ctl.mjs verify [--url U]` is the smoke check (title buttons, skirmish start, tap/click select, order) at 844x390 and 1366x768.

| Feature | Source | Test (section) | Proof flow -> output |
|---|---|---|---|
| Title menu, clan pick, skirmish / sandbox / 1v1 entry | `index.html`, `src/main.js`, `src/title.js` | `tests/ip.test.mjs` (names) | `ctl verify`, `ctl shot title`, `run live-title` -> proof/live-lag-*.{log,webm} |
| Menu fits any screen (title never above the viewport; scrolls when taller; compact at 521-900px tall) | `index.html` (`.screen`, `.screen>.panel`) | - | `run menufit` (12 viewports x default/?ui=a) -> proof/menufit.{json,log} |
| Clan cards (hover cinematic, rarity glow; owned finishes: card glow + coloured label in A and B, pulsing shield halo in B, common B shield static by design) | `src/civcards.js`, `index.html` | `tests/full.test.mjs` §5 | `run lobby` (cosmetics via ?demo=1; default B + ?ui=a) -> proof/full-lobby-* |
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
| Sound blips (select, order, build, train) | `src/sfx.js`, `src/main.js` | - | `run sfx` -> proof/phase1-sfx.log |
| Icon resource bar (no clipping at 844px) | `src/main.js` (updateHud), `index.html` | - | `run hud` -> proof/phase2-hud.log |
| Corner minimap (tap/drag to jump, fog-aware) | `src/minimap.js` | - | `run minimap` -> proof/phase3-minimap.log |
| Long-press tooltips, collapsible quick bar, compact info (<420px) | `src/touchtips.js`, `src/main.js`, `index.html` | - | `run touchui` -> proof/phase4-touchui.log |
| Render loop pauses when the tab is hidden | `src/main.js` (frame/loop) | - | `run visibility` -> proof/phase5-visibility.log |
| Clan cards: layout B (trait-first) is the default; `?ui=a` = old art card for comparison | `src/civcards.js`, `src/main.js`, `index.html` | - | `run uivariants` (checks default = b, ?ui=a, ?ui=b) -> proof/ui-variants.{json,log} |
| Build id (`<meta name=build-id>`, `window.BUILD_ID`) + shipping | `index.html`, `src/main.js`, `scripts/ctl.mjs` (deploy/ship/build-id) | - | `ctl ship`, `ctl build-id`, `run live-title` -> proof/ship-*.log, proof/live-lag-*; docs/SHIPPING.md |
| Module preload (load time) | `index.html` `<link rel=modulepreload>` | `tests/preload.test.mjs` | `run load` -> proof/load-{baseline,after}.json |
| Balance A/B between refs | `sim/compare.mjs` | - | proof/compare-hokkaido.{log,json} |
| IP guard (no franchise names) | whole repo | `tests/ip.test.mjs` | docs/IP_AUDIT.md |
| Kibble Kennel tab, HYBRID: tiers from $KIBBLE hold streaks (Pup 100K/7d, Guard Dog 1M/30d, Alpha 10M/90d, Top Dog 50M/90d; free, no lock), progress bar, next step, 'Selling below X resets your streak', launch note; optional Streamflow self-lock = Locked flair only; equip/unequip (cloud save), `?kennel=none\|progress\|pup\|guard\|alpha\|top[&kflair=1]` | `src/kennel.js`, `src/kennel-ui.js`, `src/kibble-ui.js`; API: kibble-pay `/api/kennel` v2 (hold streaks), `/api/kennel-lock` (docs/KENNEL_API.md) | `tests/kennel.test.mjs` | `run kennel` -> proof/kennel-flow.log, kennel-streak-*.png |
| Kennel lock review card: every Streamflow cost (0.16 SOL creation fee, 0.5% $KIBBLE lock fee on top, rent, network fee, totals, what comes back) before Phantom opens; numbers from kibble-pay's live fee-oracle read, checked against the built tx; ack box gates signing | `src/kennel.js` (feeCard), `src/kennel-ui.js` (reviewCard); kibble-pay `api/_lib/kennel-lock.js` (lockCosts) | `tests/kennel.test.mjs` | `run kennel` -> kennel-fee-card.png |
| Kennel cosmetics in game incl. the Locked flair padlock (render only, never stats; opponents see them via lobby ids) | `src/kennel-draw.js`, `src/render.js` (ui.cosmetics), `src/net.js` (ready.cos), `src/main.js` | `tests/kennel.test.mjs` (sim hash identical with/without) | `run kennel`, proof/compare-kennel.log |
| Light Kibble Mood (title / lobby / between matches only; never mid-match): villager idles + banner line, Chill fallback, `?mood=` | `src/mood.js` (+ shared kibble-pay `/kibble-mood.js`), `src/title.js`, `src/main.js` | `tests/mood.test.mjs` | `run mood` -> proof/mood-flow.log |
| Boss Raids (menu "Boss Raid", `?raid=1`): hourly always-on boss, free entry, auto-entry by Kennel tier / cosmetic, inputs-only submit, skill-only board, replays, guest bests on device | `src/raid.js`, `src/raid-ui.js`, `src/vendor/boss-raid.js` (shared, unchanged); API kibble-pay `/api/raid` (docs/BOSS_RAIDS.md) | `tests/raid.test.mjs` | `run raid` -> proof/raid-flow.log |
| One Inu Score, server-verified: start ticket at match start (signed in), recorded inputs + win tick + state hash sent at the end; kibble-pay `/api/empires` replays them with byte-identical sim files (SIM_ID) and scores only a reproduced win in real time; online 1v1 only when both peers' copies agree (conquest now ends online matches) | `src/score.js`, `src/sim-id.js` (`scripts/sim-id.mjs --write / --copy`), `src/main.js` (noteWin, lockstep log, maybeReport); server kibble-pay `api/_lib/empires.js` | `tests/score.test.mjs` (tamper cases), fixture `tests/fixtures/empires-mp-win.json` (`scripts/make-empires-fixture.mjs`) | `run score` -> proof/score-flow.log; docs/INU_SCORE.md |
