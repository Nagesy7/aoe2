# One Inu Score: shared contract (formula v2)

Owner: Inu Verse keeper. Host: kibble-pay. The public formula page is https://kibble-pay.vercel.app/inu-score.
Written 18 Oct 2026 (AEDT).

## What it is
One lifetime score per wallet, shared by every Inu game. **It never resets.** It is built only from lifetime personal bests, and those only go up. It is skill only: purchases, $KIBBLE holdings, Kennel tiers, cosmetics, luck and time played never change it. Any prize tied to it is awarded by rank only under the Prize Rules (free entry, no draws, no raffles).

## Formula v2 (also `GET /api/inu-score?formula=1`)
- **Inu Score** = Σ game points + Σ raid points.
- **Game points**, per game in `config/games.json` `scoreGames` (v2: `serverOnly` games count too; their only write path is their own server hook): `floor(1000 × √(min(lifetime best, cap) ÷ cap))`, where `cap` = that game's `max`.
- **Raid points**, per boss: `floor(1000 × min(best raid score, boss max) ÷ boss max)`, where boss max = `hp + 1000 + 2×900 + 3×200`.
- Today's maximum is 9 games × 1000 + 4 bosses × 1000 = 13,000. (v1 was 8 games, 12,000, before Meme Brawl joined.)

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
- **Every game that already posts scores** (Inu Arcade, Inu Rescue, Inu Quest, PepeNugs, Inu Empires): nothing to wire. Accepted runs count automatically. Optionally show `inuScore` from the score response, or `GET /api/inu-score?wallet=`, with a link to `/inu-score`.
- **Meme Brawl (serverOnly): done in v2 (18 Oct 2026).** `api/_lib/pvp.js` `reportResult` calls `recordGameScore({ store, games, wallet, accepted: { ok: true, game: "meme-brawl", score, counted: true } })` from `api/_lib/inuscore.js` only after both clients' reports agree, the match ran in real time, both wallets are distinct SIWS-signed wallets, the pair cap allows it and `submitScore` accepted it. It runs once per room (`pvp:done:<code>`), is wrapped in try/catch so an error never changes the match result, and casual, disputed and CPU matches never reach it (`/api/game` still refuses client meme-brawl scores via `serverOnly`). The `serverOnly` filter in `countedGames` is gone. Points use the lifetime best single verified win score (`matchScore`, 1000–2500).
- **Inu Empires:** mirror Boss Raids (see `boss-raids.md`). Raid bests feed the score.
- **Changing the formula:** bump `FORMULA_VERSION` and recompute from the stored bests (they are never deleted). Never lower a stored best.
