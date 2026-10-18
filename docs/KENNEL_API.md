# Kibble Kennel API (contract shared by Inu Empires and Inu Verse)

`GET https://kibble-pay.vercel.app/api/kennel?wallet=<base58>[&refresh=1]` (rewrite of `/api/game?action=kennel`; public, read-only, CORS `*`, `cache-control: no-store`).
Code: `api/_lib/kennel.js` (cache, Streamflow read, wall) + `api/_lib/kennel-streak.js` (hold streaks). Tests: `test/kennel.test.js`, `test/kennel-streak.test.js`, `test/kennel-wall.test.js`.
The games never hold or move tokens. This endpoint only reads chain state.

**HYBRID since 18 Oct 2026.** A Streamflow lock costs about 0.168 SOL plus 0.5% of the amount in $KIBBLE, and none of it is refunded (see "What a lock costs"). So:
- **Tiers come from hold streaks.** This is the main path, it is free, and it unlocks the full cosmetic set: keep at least a tier's $KIBBLE in your wallet for that tier's number of days. No lock, no SOL.
- **A Streamflow self-lock is an optional extra.** It adds one "Locked" flair on top and is no longer required for any tier.

## Tier table (hold streaks)
| Tier | Hold at least | For | Earliest possible (launch 15 Oct 2026) |
|---|---|---|---|
| Pup | 100,000 $KIBBLE | 7 days | 22 Oct 2026 (Sydney) |
| Guard Dog | 1,000,000 | 30 days | 14 Nov 2026 |
| Alpha | 10,000,000 | 90 days | 13 Jan 2027 |
| Top Dog | 50,000,000 | 90 days | 13 Jan 2027 |

Why these numbers:
- **The amounts stay the same as the lock tiers**, so they remain the main differentiator and old copy and expectations still fit. Each step is 10× (Top Dog is 5× Alpha).
- **There are three time steps: 7, 30 and 90 days.**
  - 7 days is the shortest window that still shows a holder rather than a flipper.
  - 30 days is a month.
  - 90 days is a quarter, which is long enough to matter but reachable in the token's first season.
- **Top Dog shares Alpha's 90 days instead of the old 180.** Since $KIBBLE launched on 15 Oct 2026, 180 days would mean nobody could be Top Dog before mid-April 2027, and Top Dog would become a "who was here first" badge instead of an amount badge.
- **Nobody can have any tier before 22 Oct 2026.** The copy says so: "$KIBBLE launched 15 Oct 2026, so long streaks can't exist yet". `streaks[].earliestPossible` publishes the dates.

## Response (v2)
```json
{
  "wallet": "7xKX...",
  "tier": "guard",                 // null | "pup" | "guard" | "alpha" | "top"  (from hold streaks)
  "tierName": "Guard Dog",
  "tierSource": "hold-streak",     // NEW
  "held": 1195500,                 // NEW: whole $KIBBLE held now (all token accounts + own self-lock escrows, capped at the locked amount)
  "streaks": [                     // NEW: one per tier, ascending
    { "id": "pup", "name": "Pup", "amount": 100000, "days": 7, "holding": true, "start": "2026-10-15T21:20:50.000Z", "daysHeld": 31,
      "earned": true, "earnedAt": "2026-10-22T21:20:50.000Z", "reachDate": "2026-10-22T21:20:50.000Z", "needAmount": 0, "needDays": 0,
      "earliestPossible": "2026-10-21T13:00:00.000Z", "progress": 1 },
    { "id": "alpha", "name": "Alpha", "amount": 10000000, "days": 90, "holding": false, "start": null, "daysHeld": 0, "earned": false,
      "earnedAt": null, "reachDate": null, "needAmount": 8804500, "needDays": 90, "earliestPossible": "2027-01-12T13:00:00.000Z", "progress": 0 }
  ],
  "nextStep": { "id": "alpha", "name": "Alpha", "amount": 10000000, "days": 90, "holding": false, "needAmount": 8804500, "needDays": 90,
                "reachDate": null, "reachDateIfHeldFromNow": "2027-02-14T06:00:00.000Z" },   // NEW; null at Top Dog
  "nextTier": { "id": "alpha", "name": "Alpha", "amount": 10000000, "minDays": 90, "need": 8804500, "days": 90, "needDays": 90, "reachDate": null }, // v1 shape kept
  "tierUntil": null,               // v1 field kept: always null now (a streak has no end date; it ends when you dip)
  "lockedAmount": 900000,          // v1 field kept: $KIBBLE in live self-locks (unlock date in the future)
  "unlockDate": "2027-01-01T00:00:00.000Z", // v1 field kept: earliest unlock among live self-locks
  "locks": [{ "id": "<stream id>", "amount": 900000, "unlockDate": "...", "daysLeft": 75 }],
  "locked": { "flair": true, "amount": 900000, "minAmount": 100000, "unlockDate": "...", "count": 1 },  // NEW: optional Locked flair
  "history": { "complete": true, "from": "2026-10-14T13:00:00.000Z", "reason": null, "txs": 13, "accounts": 2,
               "lastTxAt": "2026-10-17T02:11:00.000Z", "resets": { "pup": 0, "guard": 1, "alpha": 0, "top": 0 } },          // NEW
  "launchDate": "2026-10-14T13:00:00.000Z",   // NEW (= 15 Oct 2026 00:00 Sydney)
  "rules": { "held": "...", "reset": "...", "flair": "..." },                                                         // NEW (plain text)
  "source": "chain",               // chain | cache | cache-fallback | holder-only
  "stale": false, "reason": "chain read failed",   // reason only when stale
  "fetchedAt": "2026-10-18T06:00:00.000Z",
  "mint": "4VE9sy4fEMJdZ6i7MkYPbnqDJd2oqzJQmg44WJ3opump",
  "program": "strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m",
  "tiers": [{ "id": "pup", "name": "Pup", "amount": 100000, "days": 7, "minDays": 7 }, { "id": "guard", "name": "Guard Dog", "amount": 1000000, "days": 30, "minDays": 30 },
            { "id": "alpha", "name": "Alpha", "amount": 10000000, "days": 90, "minDays": 90 }, { "id": "top", "name": "Top Dog", "amount": 50000000, "days": 90, "minDays": 90 }]
}
```
Errors: `400 { "error": "wallet required" }` for a missing or invalid wallet. `tier: null` with `source: "holder-only"` means "no chain data right now".

### API diff, v1 (lock tiers) to v2 (hold streaks), for other keepers
| Field | v1 | v2 |
|---|---|---|
| `tier`, `tierName` | from self-locks (per-lock minimum days left) | from **hold streaks**; a lock alone never gives a tier |
| `lockedAmount`, `unlockDate`, `locks[]` | counted locks (>= 7 days left) | live self-locks (unlock date in the future); they only drive the flair |
| `tierUntil` | date the tier stops qualifying | always `null` |
| `nextTier` | `{id,name,amount,minDays,need}` | same keys (`minDays` = streak days, `need` = $KIBBLE missing) + `days`, `needDays`, `reachDate` |
| `tiers[]` | `{id,name,amount,minDays}` (Top Dog 180) | + `days` (`minDays` = `days`; Top Dog 90) |
| new | | `tierSource`, `held`, `streaks[]`, `nextStep`, `locked`, `history`, `launchDate`, `rules` |
| wall entries | `lockedAmount` | + `held` (sort key), `lockedFlair`; `topDogs[]` + `held` |

A v1 client keeps working: it shows the tier and uses `nextTier.need` and `minDays`. Its copy will talk about locking, so update the copy.

## Kennel wall: GET /api/kennel?wall=1[&limit=20]
Same rewrite (`/api/game?action=kennel&wall=1`, no new function). Public, CORS `*`, `cache-control: public, s-maxage=60`.
```json
{ "wall": [{ "wallet": "7xKX…", "short": "7xKX…AsU", "name": "Shiba Queen" | null, "tier": "top", "tierName": "Top Dog", "held": 60000000,
             "lockedAmount": 0, "lockedFlair": false, "since": "2026-10-18T06:00:00.000Z", "verifiedAt": "2026-10-18T06:00:00.000Z" }],
  "topDogs": [{ "wallet": "…", "short": "…", "name": null, "since": "…", "held": 50000000, "lockedAmount": 0 }],
  "count": 1, "empty": "No Top Dogs yet" | null, "source": "verified hold-streak lookups (not a chain-wide scan)", "updatedAt": "…" }
```
- **Real data only.** A wallet is added only after a successful chain read (`source: "chain"` in a `?wallet=` lookup). It goes into the Upstash sorted set `kennel:wall`, with score = tier rank × 1e11 + $KIBBLE held (Top Dogs first, then by amount).
  - A read that finds no tier removes the wallet.
  - Failed, cached-fallback or unconfigured reads never add anyone.
  - `kennel:wall:since` = `<tier>|<iso>`, the time the wallet reached its current tier.
- Every wall read recomputes each tier from the cached streak against the clock. A wallet whose last chain read is older than 24 h leaves the wall.
- `wall` = every listed tier (top N, default 20, max 50); `topDogs` = only `top`. `empty` is `"No Top Dogs yet"` when there are no Top Dogs.
- `name` = the wallet's kibble-pay profile name when it is 2-16 plain characters, else `null` (show `short`). Games should still run their own name filter.
- Lookups come from players' own `?wallet=` calls and from the Inu Verse realtime server (which looks up each verified wallet at most once per 10 min).

## Rules: hold streaks (how the brief is interpreted)
- **Held** = the sum over **all** of the wallet's token accounts for mint `4VE9sy4fEMJdZ6i7MkYPbnqDJd2oqzJQmg44WJ3opump` (Token-2022, 6 decimals; legacy-program accounts would count too), plus $KIBBLE in the wallet's **own** Streamflow self-locks (sender = recipient = wallet, any state). Locked tokens count only up to the locked amount. The 0.5% Streamflow fee is gone, so it does not count.
  - **Decision:** locked tokens count as held, so locking never breaks a streak. Lock with a margin of at least 0.5% above a tier's amount, because the fee leaves your wallet.
- **Streak** = for each tier separately, the time since the total last went from below the tier's amount to at least the amount.
  - Any moment the total dips below a tier's amount resets that tier's streak only. Selling 1M to 900K resets Guard Dog, but Pup keeps counting.
  - "Moments" are transactions in chain order (slot, then transaction index). Without transaction indexes, a whole slot counts as one moment.
  - A transaction that moves tokens between your own accounts is not a dip.
- **Tier** = the highest tier whose streak is at least its days. `nextStep` = the first tier above it.
  - `needAmount` = $KIBBLE missing now.
  - `needDays` = days left if you keep holding.
  - `reachDate` = the date you reach it if you keep holding, or `null` when you don't hold enough yet. `reachDateIfHeldFromNow` = now + days.
- **How the history is read** (standard JSON-RPC via the server RPC, which is Helius with `HELIUS_API_KEY` server-only):
  - `getTokenAccountsByOwner(wallet, {mint})` returns the current accounts and balances.
  - `getMultipleAccounts` returns the self-lock escrow balances.
  - `getSignaturesForAddress` runs per account, 1000 per page, paginated with `before`, and stops at the launch date.
  - `getTransaction` (`jsonParsed`, `maxSupportedTransactionVersion: 1`, because $KIBBLE history already contains v1 transactions) supplies the `pre/postTokenBalances` of this mint for those accounts.
  - Failed transactions are ignored. A missing pre balance means the account was created in that transaction (0), and a missing post balance means it was closed (0).
- **Gaps are handled conservatively.** A gap can only make a streak shorter, never longer. The reason is shown in `history.reason`.
  - If history is complete back to launch, the balance before it is 0 and no streak can start before **15 Oct 2026 00:00 Sydney**.
  - If the wallet held $KIBBLE before the oldest transaction found, streaks are counted from that transaction.
  - If the replayed history does not end at today's on-chain balance of every account, streaks are counted from the last transaction.
  - If the wallet holds $KIBBLE but has no history, streaks start now.
  - If the history is longer than the read cap (3,000 signatures per account, 1,500 transactions), streaks are counted from the oldest transaction read.
  - Today's on-chain balance is always the authority for "held now".
  - Known limit: accounts the wallet has since **closed** are only seen through transactions of its current accounts. Tokens that sat only in an account that is now closed may be missed. That can only shorten a streak.
- **Locked flair (optional):** `locked.flair` is true when the wallet has live self-locks (unlock date in the future) totalling at least 100,000 $KIBBLE.
  - A self-lock is counted with the same Streamflow rules as before: sender = recipient = wallet, not cancelable, not closed, one cliff.
  - The flair is one cosmetic badge. It never sets or raises a tier.
- **Cache:** Upstash `kennel:<wallet>` = `{ v: 2, fetchedAt, locks, streak }` with a 7-day TTL. `streak` holds the per-tier start times, the amount held and the history facts, not the raw transactions.
  - Responses are served from the cache for 10 min. `refresh=1` forces a read, at most once per 15 s per wallet.
  - If the chain read fails, the cached streak is used for up to 24 h (`source: "cache-fallback"`) and **recomputed against the clock**. Days held keep counting, a streak that reaches its days in that window earns the tier, and a lock past its unlock date loses the flair.
  - Past 24 h with no successful read the response is `holder-only` with no tier. v1 cache entries (locks only) are read as "no streak".
- **Cost:** one refresh is about 2 + (accounts × pages) + transactions RPC calls. Real holders on 18 Oct 2026 had 2-37 transactions; the proof run took 0.2-8.3 s on the public RPC (`proof/kennel-streak-proof.log`).
- Cosmetics only: there is no yield, reward, interest or draw for holding or locking, and nothing changes stats. Lock copy must still include "locked tokens can't be sold until the unlock date".

### Streamflow read (for the Locked flair and the escrow accounts)
- The server reads Streamflow program `strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m` accounts with `getProgramAccounts`, filtered by recipient (offset 113) = wallet and mint (offset 177) = $KIBBLE. The escrow token account is at offset 209 and created_at at offset 9. Offsets = `@streamflow/stream` v13 `streamLayout`, cross-checked in proof/kennel-layout-xcheck.log.
- A stream counts as a live lock only if:
  - mint = $KIBBLE and sender = recipient = wallet;
  - it is not closed or cancelled;
  - it is not cancelable by sender or recipient, and not transferable by sender;
  - cliff amount >= deposit - 1 (one unlock point).

  Amount = deposited - withdrawn. Unlock date = the cliff time.

## Creating a lock: POST /api/kennel-lock (builds, never sends). Optional: only adds the Locked flair
`POST https://kibble-pay.vercel.app/api/kennel-lock` (rewrite of `/api/game?action=kennel-lock`, no new function), `authorization: Bearer <SIWS session>`
(the kibble-pay session from `kibblePay.signIn()`; the wallet is always the session's wallet), body `{ "amount": 1000000, "days": 60 }`.
- `amount`: whole $KIBBLE, 1 .. 1,000,000,000. `days`: one of 14, 30, 60, 120, 210, 365. Unlock = now + days + 10 min.
- 200 -> `{ ok, tx, feePayer, metadataId, unlockAt, unlockDate, amount, days, mint, program, sender, recipient, cancelable:false }`.
  `tx` is a base64 **v0** transaction built with `@streamflow/stream@13.4.0` `createLock` + `buildTransaction` (mainnet program
  `strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m`, Token-2022), sender = recipient = the wallet, fee payer = the wallet.
  It needs 2 signatures: the server has already signed for the one-off Streamflow metadata (stream) account the SDK generates;
  **the player's signature is empty** and is added in Phantom.
- Client: `VersionedTransaction.deserialize(base64)` -> `provider.signAndSendTransaction(tx)` (injected Phantom) -> poll
  `GET /api/kennel?wallet=..&refresh=1` (>= 15 s apart) until `lockedAmount` grows.
- 400 bad input / not mainnet, 401 not signed in, 429 more than one build per 5 s per wallet.
- **What a lock costs** (`costs` in the 200 response; the game shows it on its review card *before* Phantom opens).
  Computed per request from Streamflow's on-chain fee oracle `B743wFVk2pCYhV91cn287e1xY7f1vt4gdY48hhNiuQmT` (the program reads
  the same account when the Create runs; the wallet's own partner entry if it has one, else the default entry keyed by
  Streamflow's withdrawor `wdrwhnCv4pzW8beKsbPa4S2UDZrXenjg16KJdKSpb5u`), live rent from the RPC and the built transaction
  (signatures, priority fee). Measured 18 Oct 2026 (`proof/kennel-fee-proof.log`: mainnet simulate + LiteSVM fork of the
  touched mainnet accounts running the real Streamflow, Token-2022 and ATA program bytes, then a withdraw after the unlock):

  | Part | Amount (lock of 100,000 $KIBBLE) | Paid in | Comes back? |
  |---|---|---|---|
  | Streamflow creation fee (protocol) | 0.16 SOL (160,000,000 lamports) | SOL | No (held in the stream account for Streamflow) |
  | Streamflow token-lock fee | 0.5% **on top**: 500 $KIBBLE (100,500 leave the wallet) | $KIBBLE | No (stays in escrow for Streamflow's treasury) |
  | Rent: stream metadata account (1104 B) | 0.00625856 SOL | SOL | No (withdraw does not close it) |
  | Rent: escrow token account (165 B) | 0.00148844 SOL | SOL | No (withdraw does not close it) |
  | Rent: Streamflow treasury's $KIBBLE ATA (170 B) | 0.00151384 SOL, **only for the first lock ever** (paid once) | SOL | No |
  | Network fee | 0.00001 SOL (2 signatures x 5,000 lamports, no priority fee) | SOL | No |
  | Auto-claim fee | 0 (0.25 SOL applies only to auto-withdraw vesting; locks don't use it) | - | - |
  | **Total** | **0.16927084 SOL** first lock (0.167757 SOL after) **+ 0.5% $KIBBLE** | | Locked amount: yes, at the unlock date |

  Shape: `costs = { v:1, unit:{sol:"lamports", token:"raw (6 decimals)"}, sol:{ protocolFee, autoClaimFee, rent:{ metadata,
  escrow, treasuryAta, playerAta }, network, total }, token:{ mint, feePercent, lockedRaw, feeRaw, totalDebitRaw,
  returnedAtUnlockRaw }, refundable:{ rent:false, protocolFee:false, tokenFee:false, lockedTokens:true, note },
  tx:{ signatures, priorityMicroLamports, metadataFromTx }, balances:{ lamports, tokenRaw, enoughSol, enoughToken },
  source:{ feeOracle, fees: "fee-oracle:default"|"fee-oracle:partner"|"sdk-default", treasuryAta, treasuryAtaKnown, proof } }`.
  `costs` is `{ error }` if the RPC reads fail; clients must then not show a made-up number. Sources: on-chain oracle (above),
  `@streamflow/stream@13.4.0` (`getFees`/`getDefaultFees`, `calculateTotalAmountToDeposit`), Streamflow's published fees
  (docs.streamflow.finance "Costs of using Streamflow": token lock 0.16 SOL + 0.5% token fee, added on top, network fees
  non-retrievable).
- Why server-side: the Streamflow SDK is GPL-3 and its browser CDN bundles currently break (duplicate buffer-layout on
  jsDelivr, esm.sh build errors). Building here keeps the games free of it and the player still signs every token movement.
- The server never signs for, holds or moves the player's tokens; the lock is the player's own tokens into their own
  Streamflow escrow, released only to them at the unlock date.
