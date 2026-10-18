# Bug log (repro-with-video rule)

Rule: reproduce on live (or main) first, fix, then save `proof/<bug>-before.webm` and `proof/<bug>-after.webm`
(Playwright recordVideo through `scripts/ctl.mjs`: `newPage({ video })` / `p.saveVideo(path)`, or `--video <dir>` on `ctl shot`).
Every bug gets a ctl flow that fails before the fix and passes after.

| Bug | Repro / check | Before | After | Fix |
|---|---|---|---|---|
| live-lag: the live site lags the code | `node scripts/ctl.mjs run live-title [--ref origin/main]`: live title buttons vs index.html, and every `src/*.js` + `index.html` on live byte-compared to the ref; `ctl build-id` compares `<meta name=build-id>` to origin/main | proof/live-lag-before.{webm,log}: titles matched, but 6 files differed (ai, art, civs, render, sim, terrain): live was deployed from branch reprice-kibble-x10000 (82b2c3b), main had the water/fishing/AI work | proof/live-lag-after.{webm,log}: 19/19 files identical to origin/main, build id 6a1beded25c5 | merge the branch into main, deploy main only, from a clean export (`ctl deploy`), stamp + check the build id |

Note: the reported symptom ("title shows 'Single Player' while the repo has 'Skirmish vs Computer'") did not reproduce on
Oct 18 2026: live already showed "⚔ Skirmish vs Computer". The lag was in the game code, not the title.
A cached old page in a phone browser is the likely source of that report (unverified).
