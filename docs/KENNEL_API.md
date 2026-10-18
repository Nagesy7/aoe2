# Kibble Kennel API (contract shared by Inu Empires and Inu Verse)

`GET https://kibble-pay.vercel.app/api/kennel?wallet=<base58>[&refresh=1]` (rewrite of `/api/game?action=kennel`; public, read-only, CORS `*`, `cache-control: no-store`).
Code: `api/_lib/kennel.js`, tests `test/kennel.test.js`. The games never hold or move tokens; this endpoint only reads chain state.

## Response
```json
{
  "wallet": "7xKX...",
  "tier": "guard",              // null | "pup" | "guard" | "alpha" | "top"
  "tierName": "Guard Dog",      // null when no tier
  "lockedAmount": 2000000,      // whole $KIBBLE in counted locks (>= 7 days left), 6-decimal precision
  "unlockDate": "2026-12-02T06:00:00.000Z", // earliest unlock among counted locks (null if none)
  "tierUntil": "2026-11-02T06:00:00.000Z",  // when the CURRENT tier stops qualifying if nothing changes (null if no tier)
  "nextTier": { "id": "alpha", "name": "Alpha", "amount": 10000000, "minDays": 90, "need": 10000000 }, // null at Top Dog
  "locks": [{ "id": "<stream id>", "amount": 2000000, "unlockDate": "...", "daysLeft": 45 }],
  "source": "chain",            // chain | cache | cache-fallback | holder-only
  "stale": false,               // true for cache-fallback / holder-only
  "reason": "lock read failed", // only when stale
  "fetchedAt": "2026-10-18T06:00:00.000Z",
  "mint": "4VE9sy4fEMJdZ6i7MkYPbnqDJd2oqzJQmg44WJ3opump",
  "program": "strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m",
  "tiers": [{ "id": "pup", "name": "Pup", "amount": 100000, "minDays": 7 }, { "id": "guard", "name": "Guard Dog", "amount": 1000000, "minDays": 30 },
            { "id": "alpha", "name": "Alpha", "amount": 10000000, "minDays": 90 }, { "id": "top", "name": "Top Dog", "amount": 50000000, "minDays": 180 }]
}
```
Errors: `400 { "error": "wallet required" }` for a missing/invalid wallet. `tier: null` + `source: "holder-only"` means "no lock data": games fall back to the existing holder tier.

## Kennel wall: GET /api/kennel?wall=1[&limit=20]
Same rewrite (`/api/game?action=kennel&wall=1`, no new function). Public, CORS `*`, `cache-control: public, s-maxage=60`.
```json
{ "wall": [{ "wallet": "7xKX…", "short": "7xKX…AsU", "name": "Shiba Queen" | null, "tier": "top", "tierName": "Top Dog",
             "lockedAmount": 60000000, "since": "2026-10-18T06:00:00.000Z", "verifiedAt": "2026-10-18T06:00:00.000Z" }],
  "topDogs": [{ "wallet": "…", "short": "…", "name": null, "since": "…", "lockedAmount": 50000000 }],
  "count": 1, "empty": "No Top Dogs yet" | null, "source": "verified tier lookups (not a chain-wide scan)", "updatedAt": "…" }
```
- **Real data only.** A wallet is added only after a successful chain read of its locks (`source: "chain"` in a `?wallet=` lookup),
  into the Upstash sorted set `kennel:wall` (score = tier rank × 1e11 + locked amount: Top Dogs first, then by lock size). A read that
  finds no tier removes it. Failed, cached-fallback or unconfigured reads never add anyone. `kennel:wall:since` = `<tier>|<iso>` when the wallet reached its current tier.
- Every wall read recomputes each tier from the cached locks against the clock, so a lock that drops under a tier's minimum days leaves (or moves down) without a new read.
- `wall` = every listed tier (top N, default 20, max 50); `topDogs` = only `top`. `empty` is `"No Top Dogs yet"` when there are no Top Dogs.
- `name` = the wallet's kibble-pay profile name when it is 2-16 plain characters, else `null` (show `short`). Games should still run their own name filter.
- Lookups come from players' own `?wallet=` calls and from the Inu Verse realtime server (which looks up each verified wallet at most once per 10 min).

## Rules (how the brief is interpreted)
- Reads Streamflow program `strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m` accounts via the server RPC (Helius, `HELIUS_API_KEY` server-only),
  `getProgramAccounts` filtered by recipient (offset 113) = wallet and mint (offset 177) = $KIBBLE. Offsets = `@streamflow/stream` v13 `streamLayout`
  (cross-checked against the SDK's `decodeStream`: proof/kennel-layout-xcheck.log).
- A stream counts as a lock only if: mint = $KIBBLE (Token-2022, 6 decimals); sender = recipient = wallet (a self-lock); not closed and not cancelled;
  not cancelable by sender or recipient and not transferable by sender (Streamflow's token-lock rule); cliff amount >= deposit - 1 (one unlock point, not a vesting stream).
  Amount = deposited - withdrawn. Unlock date = the cliff time.
- Only locks with >= 7 days remaining count at all. Locks are summed, but **per tier**: a lock counts toward tier T only if its own remaining time >= T's minimum
  (Pup 100K/7d, Guard Dog 1M/30d, Alpha 10M/90d, Top Dog 50M/180d). Tier = highest T whose qualifying sum >= T's amount.
  Example: 600K with 40 days + 500K with 20 days = 1.1M locked, but only 600K has 30+ days -> Pup (Guard Dog needs 400K more at 30+ days).
- `nextTier.need` = amount still missing for the next tier, counting only locks that already meet that tier's minimum days.
- Cache: Upstash `kennel:<wallet>` holds the raw locks + fetchedAt (7-day TTL). Served from cache for 10 min; `refresh=1` (after a new lock) forces a read,
  rate-limited to one per 15 s per wallet. If the read fails, cached locks are used for up to 24 h (`source: "cache-fallback"`); the tier is always
  recomputed against the current clock, so an expired lock never keeps its tier. Past 24 h with no read: `holder-only`.
- Cosmetics only: no yield, rewards, interest or draws for locking. Copy must include "locked tokens can't be sold until the unlock date".

## Creating a lock: POST /api/kennel-lock (builds, never sends)
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
