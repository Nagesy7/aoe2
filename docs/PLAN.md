# Polish plan (phone landscape first)

One small commit + proof per phase. Every proof is a `scripts/ctl.mjs run <flow>` flow with real touch/mouse input at
844x390 (and 1366x768 where layout matters); screenshots land in /workspace/inu-empires-shots/oct18-phaseN-*.png and
logs in proof/phaseN-*.log. Ship each phase with `node scripts/ctl.mjs ship` (docs/SHIPPING.md).

| Phase | Scope | Files | Proof |
|---|---|---|---|
| 0 | WIP + live sync: commit the interrupted clan WIP, merge reprice-kibble-x10000 into main, rebalance (all clans 45-55%, Kishu <= 53%), deploy main, live == main | `src/civs.js`, `tests/full.test.mjs`, `proof/balance.*` | `npm test`, proof/balance.txt, proof/compare-hokkaido.log, proof/live-lag-{before,after}.*, proof/phase0-verify-live.log |
| 1 | `src/sfx.js` WebAudio blips (select, order ack, build done, train done); one AudioContext unlocked on first touch, per-sound cooldown, suspended on visibilitychange | `src/sfx.js`, `src/main.js` | `ctl run sfx` -> proof/phase1-sfx.log |
| 2 | Icon resource bar (🍖 🪵 🪙 🪨 🐾) that never clips at 844px and stays clear of the wallet/home widgets; labels kept for screen readers | `src/main.js` (updateHud), `index.html` CSS | `ctl run hud` -> proof/phase2-hud.log |
| 3 | Corner minimap (bottom-left in phone landscape, bottom-right on desktop): terrain, water, resources, units, fog, camera box; tap/drag to move the camera | `src/minimap.js`, `src/main.js`, `index.html` | `ctl run minimap` -> proof/phase3-minimap.log |
| 4 | Long-press tooltips on touch (peek never fires the button; group buttons keep long-press = save), collapsible quick bar (remembered), compact info panel under 420px height | `src/touchtips.js`, `src/main.js`, `index.html` | `ctl run touchui` -> proof/phase4-touchui.log |
| 5 | Pause the render loop on visibilitychange (single player / vs computer; online keeps ticking so lockstep peers never stall), no catch-up burst on return | `src/main.js` | `ctl run visibility` -> proof/phase5-visibility.log |

Out of scope here: sim/AI changes (balance is Phase 0 only), online relay (Upstash) untouched.
