# Bug log (repro-with-video rule)

Rule: reproduce on live (or main) first, fix, then save `proof/<bug>-before.webm` and `proof/<bug>-after.webm`
(Playwright recordVideo through `scripts/ctl.mjs`: `newPage({ video })` / `p.saveVideo(path)`, or `--video <dir>` on `ctl shot`).
Every bug gets a ctl flow that fails before the fix and passes after.

| Bug | Repro / check | Before | After | Fix |
|---|---|---|---|---|
| live-lag: the live site lags the code | `node scripts/ctl.mjs run live-title [--ref origin/main]`: live title buttons vs index.html, and every `src/*.js` + `index.html` on live byte-compared to the ref; `ctl build-id` compares `<meta name=build-id>` to origin/main | proof/live-lag-before.{webm,log}: titles matched, but 6 files differed (ai, art, civs, render, sim, terrain): live was deployed from branch reprice-kibble-x10000 (82b2c3b), main had the water/fishing/AI work | proof/live-lag-after.{webm,log}: 19/19 files identical to origin/main, build id 6a1beded25c5 | merge the branch into main, deploy main only, from a clean export (`ctl deploy`), stamp + check the build id |
| amove-own-building: attack-move / Shift-queue clicks "don't register" (`ctl run efficiency` 3 FAILs since 555dcc2) | `node scripts/ctl.mjs run amove [--root <old tree>] [--video dir]` (desktop Q + click and Shift+right-click, phone A-move + tap, all on the own Den Hall); `tests/efficiency.test.mjs` | proof/amove-before-{desktop,phone}.webm, proof/amove-before.log (5 FAIL): attack-move over an own building/resource fell through the smart-command chain -> every unit `to_garrison` into the Den Hall, so no `amove` and no `moving` units for Shift to queue behind | proof/amove-after-{desktop,phone}.webm, proof/amove-after.log 10/10, `ctl run efficiency` 18/18 (proof/efficiency-after-amove.log) | `commandAt(world, x, y, { amove })`: attack-move = attack an enemy at the point, else a plain move to the ground point (never garrison/gather/build/drop). AI balance unchanged: sim/compare HEAD vs fix identical win rates (proof/compare-amove-fix.log) |

Note: the reported symptom ("title shows 'Single Player' while the repo has 'Skirmish vs Computer'") did not reproduce on
Oct 18 2026: live already showed "⚔ Skirmish vs Computer". The lag was in the game code, not the title.
A cached old page in a phone browser is the likely source of that report (unverified).
