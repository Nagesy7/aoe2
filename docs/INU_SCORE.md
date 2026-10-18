# One Inu Score: shared contract (formula v6)

Owner: Inu Verse keeper. Host: kibble-pay. The public formula page is https://kibble-pay.vercel.app/inu-score.
Written 18 Oct 2026 (AEDT). Formula v3: 18 Oct 2026 (AEDT). Formula v4: 18 Oct 2026 (AEDT). Formula v5: 18 Oct 2026 (AEDT). Formula v6: 18 Oct 2026 (AEDT).

## What it is
One lifetime score per wallet, shared by every Inu game. **It never resets.** It is built only from lifetime personal bests, and those only go up. It is skill only: purchases, $KIBBLE holdings, Kennel tiers, cosmetics, luck and time played never change it. Any prize tied to it is awarded by rank only under the Prize Rules (free entry, no draws, no raffles).

## Formula v6 (also `GET /api/inu-score?formula=1`)
- **Inu Score** = Σ game points + Σ raid points.
- **Game points**, per game in `config/games.json` `scoreGames` (v2: `serverOnly` games count too; their only write path is their own server hook): `floor(1000 × √(min(lifetime best, cap) ÷ cap))`, where `cap` = that game's `inuCap` if set, else its `max`. `inuCap` is the Inu Score normalisation cap only: it never changes the prize-board `max`/`perSec`/`minMs` checks. v3: Kibble Chomp `inuCap` = 50,000 (its prize-board `max` stays 500,000).
- **Raid points**, per boss: `floor(1000 × min(best raid score, boss max) ÷ boss max)`, where boss max = `hp + 1000 + 2×900 + 3×200`.
- Today's maximum is 13 games × 1000 + 4 bosses × 1000 = **17,000**. (v5 was 12 games, 16,000; v4 was 11 games, 15,000; v3 was 10 games, 14,000; v2 was 9 games, 13,000; v1 was 8 games, 12,000, before Meme Brawl joined.)
- **Games (13):** kibble-chomp (cap 50,000), bark-invaders (500,000), bone-breaker (500,000), pup-crossing (200,000), street-sniffer (50,000), paw-fu-tower (100,000), bone-digger (180,000), pips-big-bark (380,000), meme-brawl (100,000, serverOnly), inu-empires (100,000, serverOnly), pepeballz (100,000), inu-rescue (2,000,000), inu-quest (50,000).
- **v3 changes (18 Oct 2026):** Inu Arcade: Street Sniffer joins (`street-sniffer`, max 50,000, 400/s, min 5 s, game version 2; the arcade sends `kp.submitScore('street-sniffer', score, ms, { v: 2 })`) and counts for the `arcade-run` quest. Kibble Chomp's Inu Score cap drops from 500,000 to a realistic 50,000 via `inuCap`.
- **v4 changes (18 Oct 2026):** Inu Arcade: Paw-Fu Tower joins (`paw-fu-tower`, max 100,000, 400/s, min 5 s, game version 2; the arcade sends `kp.submitScore('paw-fu-tower', score, ms, { v: 2 })`) and counts for the `arcade-run` quest. Cap rationale (human-sim, 100 seeds): median 2,700 (Classic) / 4,100 (Inu), p90 4,600 / 6,500, best 9,400; the perfect-play bot reaches ~17,000–21,500 in a 6–7 min run and the tower loops, so 100,000 leaves headroom while a median run already earns ~170–200 points.
- **v5 changes (18 Oct 2026):** Inu Arcade: Bone Digger joins (`bone-digger`, max 180,000, 400/s, min 5 s, game version 2; the arcade sends `kp.submitScore('bone-digger', score, ms, { v: 2 })`) and counts for the `arcade-run` quest. Cap = about 10× the best human-sim run (100 seeds per mode: median 5,950 Classic / 8,140 Inu, p90 7,700 / 11,400, best 18,062); the perfect-play bot reaches ~40,000–68,000 in 5–7 min runs.
- **v6 changes (18 Oct 2026):** Inu Arcade: Pip's Big Bark joins (`pips-big-bark`, max 380,000, 400/s, min 5 s, game version 2; the arcade sends `kp.submitScore('pips-big-bark', score, ms, { v: 2 })`) and counts for the `arcade-run` quest. Cap = about 10× the best human-sim run (100 seeds per mode: median 12,150 Classic / 13,040 Inu, p90 26,010 / 25,950, best 37,740); the perfect-play bot clears each of the six stages (about 68,000 for one full lap with spare lives) and the run loops harder after stage 6.

## Where it is stored (the wallet cloud save)
`save:inu-score:<wallet>` in the kibble-pay Upstash store, the same store and namespace as the per-game cloud saves (`save:<game>:<wallet>`). It holds `{ pb: {gameId: best}, raid: {bossId: best}, score, formula, updatedAt }`. `inu-score` is **not** a `SAVE_GAMES` slot, so `PUT /api/save` refuses it: only the server writes it. The lifetime board is the hash `inuscore:board:v1`.

## API
| | |
|---|---|
| `GET /api/inu-score?wallet=<base58>` | `{ wallet, formula, exists, score, parts: { games: {id:{best,cap,points}}, raids: {id:{best,max,points}} }, updatedAt }` |
| `GET /api/inu-score?board=1` | Top 20 lifetime `{ entries:[{rank,wallet,score}], players }` |
| `GET /api/inu-score?formula=1` | Formula text, caps, raid maxes, max total |

## Write path (cheat-resistant)
There is **no client write endpoint.** The score changes only on server events:
1. **Arcade/game scores.** On `POST /api/game?action=score`, which needs a Bearer SIWS session and already enforces per-game `max`, the `perSec` rate cap, `minMs`, one score per 15 s per game and the daily limit, the accepted run (current game version only) raises that game's lifetime best. The response now also carries `inuScore`.
2. **Boss Raids.** On `POST /api/raid {op:"submit"}`, the server re-simulates the replay (`boss-raid.js`) with a signed, single-use, real-time-checked start ticket. See `boss-raids.md`.

## What other keepers need to do
- **Every game that already posts scores** (Inu Arcade, Inu Rescue, Inu Quest, PepeNugs): nothing to wire. (Inu Empires no longer posts scores: it is replay-verified, see below.) Accepted runs count automatically. Optionally show `inuScore` from the score response, or `GET /api/inu-score?wallet=`, with a link to `/inu-score`.
- **Meme Brawl (serverOnly): done in v2 (18 Oct 2026).** `api/_lib/pvp.js` `reportResult` calls `recordGameScore({ store, games, wallet, accepted: { ok: true, game: "meme-brawl", score, counted: true } })` from `api/_lib/inuscore.js` only after both clients' reports agree, the match ran in real time, both wallets are distinct SIWS-signed wallets, the pair cap allows it and `submitScore` accepted it. It runs once per room (`pvp:done:<code>`), is wrapped in try/catch so an error never changes the match result, and casual, disputed and CPU matches never reach it (`/api/game` still refuses client meme-brawl scores via `serverOnly`). The `serverOnly` filter in `countedGames` is gone. Points use the lifetime best single verified win score (`matchScore`, 1000–2500).
- **Inu Empires:** mirror Boss Raids (see `boss-raids.md`). Raid bests feed the score.
- **Changing the formula:** bump `FORMULA_VERSION` and recompute from the stored bests (they are never deleted). Never lower a stored best.

## Test wallets (18 Oct 2026)
`api/_lib/testwallets.js` holds the built-in `TEST_WALLETS` (the two e2e proof wallets) and also reads `TEST_WALLETS` (comma-separated public addresses) from the env. Those wallets are never written to any score board, raid board or the Inu Score, and they're filtered out of every board read, `GET /api/inu-score?wallet=` (reported as not existing, score 0) and the payout report (including admin leaderboard overrides).

## Board reply parsing
Upstash REST with `automaticDeserialization:false` returns HGETALL (and ZRANGE … WITHSCORES) as a flat `[k1, v1, k2, v2…]` array. `parsePairs` / `parseHashReply` in `api/_lib/store.js` is the one parser for every shape (flat, `[k,v]` tuples, `{member,score}` objects, plain object). The store driver and every board reader (game boards, combined/payout, Inu Score board, raid boards) use it. Regression: `test/boards.test.js`.

## Inu Empires: replay-verified (18 Oct 2026)
Inu Empires no longer posts a score. `config/games.json` marks `inu-empires` `serverOnly`, so `POST /api/game?action=score` refuses it (403). Its only write path is `POST /api/empires` (rewrite of `/api/game?action=empires`, no new function; code `api/_lib/empires.js`). The client sends the match's **recorded inputs**. The server replays them with **byte-identical copies of the game's deterministic sim** (`public/lib/empires/{sim,ai,combat,techtree,civs}.js`, copied by the game's `node scripts/sim-id.mjs --copy …`). It scores only what the replay proves. Anything it cannot verify is not scored.
- **Sim id.** `SIM_ID` = first 16 hex of sha256 over the five files (the game's `src/sim-id.js`, same algorithm). A start ticket is only issued when the client's id equals the server's. Any rule change in the game needs a re-copy, or its matches answer 409 "rules differ" and are not scored.
- **Start** (signed-in only): `{op:"start", mode:"ai", seed, civ, enemy, simId}` or `{op:"start", mode:"mp", seed, civs:[c0,c1], me, simId}`. Returns an HMAC ticket `{typ:"emp", w, m, s, c|cs, e|me, sim, t0}` that expires after 3 h. `t0` is the server's clock.
- **Submit**: `{op:"submit", ticket, endTick, hash, log}`.
  - `endTick` = the number of ticks up to and including the step on which the winner was decided.
  - `hash` = the game's `stateHash` right after that step.
  - vs computer: `log` = the player's commands `[[tick, type, args], …]`, applied at the start of their tick, as single player does.
  - online 1v1: `log` = the lockstep input log `[[tick, player, seq, type, args], …]` both peers executed.
- **vs computer verdict.** The server builds `createMpWorld(seed)` plus the normal computer opponent, with clans set exactly as the game's `startGame` sets them, and steps `endTick` ticks. Scored only if all of these hold:
  - the replay's state hash equals the client's;
  - the player won on exactly the final step;
  - `now − t0 + 5 s ≥ endTick / 20 s`, so the match was no faster than real time;
  - the ticket is unused (one score per ticket);
  - the wallet is not rate-limited (one result per 30 s);
  - `submitScore` accepts it (the usual caps, daily limits and test-wallet exclusion).

  Score = `20,000 + 30,000 × max(0, 1 − replayMinutes/45)`, capped at 100,000 and at 50 points per second of **server-measured** time since `t0`. Losses are verified and score 0. A claimed `score`/`durationMs` in the body is ignored.
- **Online 1v1 verdict.** Each peer submits its own copy. The first copy waits, keyed by seed plus sha256(endTick, hash, log), for up to 30 min. The server replays once, and scores the winner's wallet (30,000 base plus the speed bonus, same caps), only if all of these hold:
  - a second copy arrives from a **different wallet**, in the **other seat**, with the **same clans**;
  - the replay reproduces the agreed hash and win step.

  One copy alone, disagreeing copies, one wallet in both seats, a desynced match (the client doesn't send) or a forged agreeing hash score nobody. Online 1v1 now ends by conquest (Den Halls and Fortresses destroyed), the same rule as vs computer, so there is a result to verify.
- **Replay cost vs Vercel limits (Hobby, Fluid compute: 300 s max duration, 2 GB / 1 vCPU, 4.5 MB request body).**
  - Limits: `maxTicks` 72,000 (60 sim minutes; longer matches are not replayed or scored), 40,000 commands, 3 MB body.
  - Measured on the box (Node 20): about 0.43 ms per tick for a busy AI-vs-AI game over its first 20 min, 0.62 ms per tick averaged over 45 min, and 4.1 s for the real 19.8-min fixture verification. The worst case is about 50 s for 60 min.
  - Real time already bounds abuse: a 60-min replay needs a ticket at least 60 min old, plus one result per 30 s per wallet.
  - `GET /api/empires?bench=1` (one run per 2 min, globally) times the exact verification path plus 20 busy minutes on the live deployment and returns `projectedWorstMsAt60Min`.
  - **Live, measured 18 Oct 2026 19:47 AEDT** on kibble-pay production (`GET /api/empires?bench=1`): the real 19.8-min fixture (23,762 ticks, 316 commands) was verified in 7.1 s with the hash matching. 20 busy AI-vs-AI minutes took 16.6 s (0.69 ms per tick). The projected worst case for a 60-min match is 79.5 s, about 27% of the 300 s limit. Memory is one small world, far under 2 GB. The largest allowed body (3 MB) is under 4.5 MB.
- **Not provable (stated plainly).** A replay proves the inputs produce the win in real time. It cannot prove a human typed them: a bot that plays in real time is indistinguishable, the same as for Boss Raids. The vs-computer seed and clans come from the client, so a player can replay a known map.
- Tests: kibble-pay `test/empires.test.js`. Covered:
  - vendored files byte-identical;
  - a real lost match verified and not scored;
  - tampered hash;
  - the real winning online log scored once both copies agree;
  - tampered logs, lone copies, the same wallet twice, a forged agreeing hash and an early win step all score nobody;
  - real-time, ticket-reuse, other-wallet, length and body-size limits;
  - client score posts refused.

  Game side: `tests/score.test.mjs`, plus the `score` flow, which replays real browser-recorded logs in Node.

## Inu Empires: replay-verified (18 Oct 2026)
Inu Empires no longer posts a score. `config/games.json` marks `inu-empires` `serverOnly`, so `POST /api/game?action=score` refuses it (403). Its only write path is `POST /api/empires` (rewrite of `/api/game?action=empires`, no new function; code `api/_lib/empires.js`). The client sends the match's **recorded inputs**. The server replays them with **byte-identical copies of the game's deterministic sim** (`public/lib/empires/{sim,ai,combat,techtree,civs}.js`, copied by the game's `node scripts/sim-id.mjs --copy …`). It scores only what the replay proves. Anything it cannot verify is not scored.
- **Sim id.** `SIM_ID` = first 16 hex of sha256 over the five files (the game's `src/sim-id.js`, same algorithm). A start ticket is only issued when the client's id equals the server's. Any rule change in the game needs a re-copy, or its matches answer 409 "rules differ" and are not scored.
- **Start** (signed-in only): `{op:"start", mode:"ai", seed, civ, enemy, simId}` or `{op:"start", mode:"mp", seed, civs:[c0,c1], me, simId}`. Returns an HMAC ticket `{typ:"emp", w, m, s, c|cs, e|me, sim, t0}` that expires after 3 h. `t0` is the server's clock.
- **Submit**: `{op:"submit", ticket, endTick, hash, log}`.
  - `endTick` = the number of ticks up to and including the step on which the winner was decided.
  - `hash` = the game's `stateHash` right after that step.
  - vs computer: `log` = the player's commands `[[tick, type, args], …]`, applied at the start of their tick, as single player does.
  - online 1v1: `log` = the lockstep input log `[[tick, player, seq, type, args], …]` both peers executed.
- **vs computer verdict.** The server builds `createMpWorld(seed)` plus the normal computer opponent, with clans set exactly as the game's `startGame` sets them, and steps `endTick` ticks. Scored only if all of these hold:
  - the replay's state hash equals the client's;
  - the player won on exactly the final step;
  - `now − t0 + 5 s ≥ endTick / 20 s`, so the match was no faster than real time;
  - the ticket is unused (one score per ticket);
  - the wallet is not rate-limited (one result per 30 s);
  - `submitScore` accepts it (the usual caps, daily limits and test-wallet exclusion).

  Score = `20,000 + 30,000 × max(0, 1 − replayMinutes/45)`, capped at 100,000 and at 50 points per second of **server-measured** time since `t0`. Losses are verified and score 0. A claimed `score`/`durationMs` in the body is ignored.
- **Online 1v1 verdict.** Each peer submits its own copy. The first copy waits, keyed by seed plus sha256(endTick, hash, log), for up to 30 min. The server replays once, and scores the winner's wallet (30,000 base plus the speed bonus, same caps), only if all of these hold:
  - a second copy arrives from a **different wallet**, in the **other seat**, with the **same clans**;
  - the replay reproduces the agreed hash and win step.

  One copy alone, disagreeing copies, one wallet in both seats, a desynced match (the client doesn't send) or a forged agreeing hash score nobody. Online 1v1 now ends by conquest (Den Halls and Fortresses destroyed), the same rule as vs computer, so there is a result to verify.
- **Replay cost vs Vercel limits (Hobby, Fluid compute: 300 s max duration, 2 GB / 1 vCPU, 4.5 MB request body).**
  - Limits: `maxTicks` 72,000 (60 sim minutes; longer matches are not replayed or scored), 40,000 commands, 3 MB body.
  - Measured on the box (Node 20): about 0.43 ms per tick for a busy AI-vs-AI game over its first 20 min, 0.62 ms per tick averaged over 45 min, and 4.1 s for the real 19.8-min fixture verification. The worst case is about 50 s for 60 min.
  - Real time already bounds abuse: a 60-min replay needs a ticket at least 60 min old, plus one result per 30 s per wallet.
  - `GET /api/empires?bench=1` (one run per 2 min, globally) times the exact verification path plus 20 busy minutes on the live deployment and returns `projectedWorstMsAt60Min`.
  - **Live, measured 18 Oct 2026 19:47 AEDT** on kibble-pay production (`GET /api/empires?bench=1`): the real 19.8-min fixture (23,762 ticks, 316 commands) was verified in 7.1 s with the hash matching. 20 busy AI-vs-AI minutes took 16.6 s (0.69 ms per tick). The projected worst case for a 60-min match is 79.5 s, about 27% of the 300 s limit. Memory is one small world, far under 2 GB. The largest allowed body (3 MB) is under 4.5 MB.
- **Not provable (stated plainly).** A replay proves the inputs produce the win in real time. It cannot prove a human typed them: a bot that plays in real time is indistinguishable, the same as for Boss Raids. The vs-computer seed and clans come from the client, so a player can replay a known map.
- Tests: kibble-pay `test/empires.test.js`. Covered:
  - vendored files byte-identical;
  - a real lost match verified and not scored;
  - tampered hash;
  - the real winning online log scored once both copies agree;
  - tampered logs, lone copies, the same wallet twice, a forged agreeing hash and an early win step all score nobody;
  - real-time, ticket-reuse, other-wallet, length and body-size limits;
  - client score posts refused.

  Game side: `tests/score.test.mjs`, plus the `score` flow, which replays real browser-recorded logs in Node.
