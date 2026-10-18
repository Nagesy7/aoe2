# Inu Boss Raids: shared contract (v1)

Owner: Inu Verse keeper. Server: kibble-pay (`/api/raid`). The Inu Empires keeper mirrors it in their own repo; nobody else edits it.
Written 18 Oct 2026 (AEDT).

## Rules (all games)
- **Always on.** A new boss arrives every hour on the UTC hour. The rotation is `BOSSES[hoursSinceEpoch % 4]`: Gutter Gator, Storm Crow, Iron Tomcat, Fog Badger. The schedule is fixed in advance (`schedule(now, n)`).
- **Free entry.** Anyone can fight, signed in or not. A guest's results stay on their device. Posting to the board needs a SIWS session (`kibblePay.signIn()`).
- **Auto-entry.** If a wallet holds a Kibble Kennel tier (`/api/kennel?wallet=`) or any Inu cosmetic, it is auto-entered into each hour's event. The cosmetic can be in the profile `cosmetics` (except the free `verse-tour-v1` tour badge), or be any inventory item that isn't a `seed-` consumable. The server checks this on `POST /api/raid {op:"join"}`. Auto-entry only puts the pup on the roster. It never changes damage, score, rank or prizes.
- **Skill only.** The server re-plays every replay with the shared deterministic sim and ignores any score the client sends. There are no bets, no raffles, no paid entry and no chance: the boss follows a fixed, published script.
- **Copy.** Never use buy, sell, pump it, moon, dump or price targets. Use no trademarked names.

## Shared sim: `boss-raid.js` (pure ES module, no DOM, no clock, no randomness)
Canonical file: kibble-pay `public/lib/boss-raid.js`, served at `https://kibble-pay.vercel.app/lib/boss-raid.js`. It is byte-identical to Inu Verse `src/bossraid.js`, and both repos have a test that checks this. **Import it or vendor it unchanged**: if your copy differs, your scores won't match the server's.
```js
import { eventAt, schedule, createRaid, simulate, scoreOf, BOSSES, TICK_HZ, MAX_TICKS, LANES } from "https://kibble-pay.vercel.app/lib/boss-raid.js";
const raid = createRaid(eventAt(Date.now()).boss);   // live fight
raid.step(["L"|"R"|"B", ...]);  // once per tick (10 Hz), max 3 inputs per tick
raid.telegraph();               // lanes that are about to be hit (draw them red)
raid.bossLane();                // the lane the boss stands over: bites only land from here
raid.s                          // { tick, lane, hp, dmg, combo, openUntil, over, cleared, ... }
simulate(bossId, inputs)        // inputs = [[tick, "L"|"R"|"B"], ...] in tick order -> { score, damage, cleared, seconds, ... }
```
Mechanics:
- 5 lanes, 10 ticks/s, 90 s maximum. The pup has 3 hearts.
- Slam k lands at tick 20 + Σ period, and the period drops by 3 once the boss is below half HP. The lanes it hits are `PATTERNS[boss.pattern](k)`, telegraphed `warn` ticks ahead.
- A bite has a 6-tick cooldown and only lands when you are in `bossLane`. It does 8 damage, or 20 + combo in the 12 ticks after a slam ("OPEN!"). Combo grows by 2 (max 16) and resets when you get hit or miss.
- Score = damage, plus on a clear: 1000 + 2 × ticks left + 200 × hearts left.

## Server API (kibble-pay)
| | |
|---|---|
| `GET /api/raid` | Current event `{eventId, boss, startMs, endMs, live, board[≤20], roster{total,auto}}`, `schedule` (next 6), rules text. |
| `GET /api/raid?event=2026-10-18T07` | That event's board. |
| `GET /api/raid?replay=<eventId>&wallet=<w>` | The best replay stored for that wallet `{boss, inputs, score, ...}` (kept 90 days). |
| `POST /api/raid {op:"join"}` (Bearer session) | `{entry: "auto:kennel" \| "auto:cosmetic" \| "free"}` |
| `POST /api/raid {op:"start"}` (Bearer session) | `{ticket}`: an HMAC-signed start ticket for the current event, bound to the wallet. |
| `POST /api/raid {op:"submit", ticket, inputs}` (Bearer session) | Re-simulates and returns `{result, best, eventBest, inuScore}`. |

Anti-cheat on submit:
- The ticket must be for this wallet and used only once.
- The submit must arrive while the event is open or within 10 minutes after it ends.
- Real time since the ticket ≥ fight length − 3 s.
- Inputs must be valid.
- One result per 10 s per wallet.
- The best score per event is stored with its replay, and the raid best feeds the One Inu Score (see `inu-score.md`).

Limitation: a bot that plays well in real time is indistinguishable from a skilled human. Boards can be reviewed under the Prize Rules.

## What the Inu Empires keeper needs to do
1. Add a "Boss Raid" entry point, for example a war-camp gate, that runs `createRaid(eventAt(now).boss)` with their own art. Keep the lane/telegraph/boss-lane readability: red lanes, boss marker, hearts, timer.
2. Before the fight, call `POST /api/raid {op:"start"}` if signed in. After it, call `{op:"submit", ticket, inputs}` with the recorded inputs. Never send a score.
3. On sign-in and every hour, if the wallet has a Kennel tier (they already show it) or a cosmetic, call `{op:"join"}` and show "Auto-entered". Otherwise show "Enter free". Guests can always play.
4. Show `GET /api/raid` boards plus a replay viewer (feed the stored `inputs` through `createRaid().step`).
5. Don't add stat boosts from civs, tiers or cosmetics to the raid. Don't change `boss-raid.js` locally. Propose changes to the Inu Verse keeper, who bumps `RAID_VERSION` in both copies.
