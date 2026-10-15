# Inu Empires — Polish Notes (phone landscape playtest, 2026-10-15)

Tested live https://aoe2-ashen.vercel.app with Playwright (Chromium, touch + mobile, DPR 2) at 844x390 and 932x430.
Screenshots: /workspace/inu-empires-shots/. Load ~1.3–2.0 s, 60 fps idle, no console errors.

Legend: **[REBUILD]** = belongs to the rebuild worker (pathfinding, unit AI, ages/tech, 1v1, civs, lobby cards, animations, tabbed build menu, IP/naming). Don't touch here.

## P0
- **Live build lags `main`.** Live title shows "Single Player"; repo HEAD (6d8aef6) has "Skirmish vs Computer" + "Sandbox". Repro: open live title vs `index.html`. Fix: confirm Vercel auto-deploy from git for project `aoe2` / redeploy after rebuild lands. Also large uncommitted WIP sits in the working tree (sim/combat/net/techtree…) — the rebuild worker should commit it. **[REBUILD]** for the WIP.

## P1
- **No audio at all.** No AudioContext / Audio usage in src. Repro: play a match, silence. Fix: tiny `src/sfx.js` WebAudio blips (select, order ack, build complete, train done) unlocked on first touch; hook points live in main.js/sim events, so coordinate after rebuild merge.
- **No minimap in landscape.** Hard to navigate on phone. Fix: small corner minimap canvas (bottom-right above Train button). Touches render.js — wait for rebuild.
- **Resource bar has no icons and clips at 844px.** Text-only "Food: 200 Wood: 200…", `overflow:hidden` at narrow width can cut Age label. Fix: emoji/icon + number only (🍖 200 🪵 200 🪙 100 🪨 100), saves ~40% width.
- **Tooltips useless on touch.** `title=` never shows on phones. Fix: long-press (~400 ms) tooltip popover reusing button titles (groups already use long-press to save — needs a different gesture or only on non-group buttons).
- **Quickbar overlaps sheep/top of map** (row of 9 buttons under HUD covers ~15% of a 390px viewport). Fix: collapse group buttons 1–5 into one "Groups ▾" button on short screens.

## P2
- Selected-building info panel is big (≈24% width) and covers bottom-left playfield; make it compact at height < 420px.
- Elo/player strip ("[SHIB] You · 1200 Elo · 🦴 0") floats over the playfield mid-bottom; move into HUD or fade when not hovered.
- Pause the rAF render loop on `visibilitychange` (battery). Touches main.js loop — after rebuild.
- Berry bushes read as red "no" symbols at phone size; slightly larger/rounder berry sprite. **[REBUILD]**-adjacent (art/animations).
- Unit pathing / AI / tech / lobby observations deferred entirely to **[REBUILD]**.

## Shipped in this pass (index.html only)
- Tooltips (title) on Command / Box select / Clear / Menu buttons.
- Text-shadow on top HUD and info panel for readability over bright grass.
