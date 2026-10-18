# Kibble Kennel API (contract shared by Inu Empires and Inu Verse)

> Mirror of kibble-pay `docs/KENNEL_API.md` (canonical). Shared contract with the Inu Verse Keeper agent. Inu Empires uses `GET /api/kennel` (tier), `POST /api/kennel-lock` (lock tx for Phantom) and the shared `/kibble-mood.js`.

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
- Streamflow charges its own fees on create (SOL plus a small token fee, read from its on-chain fee config). Phantom shows the
  exact cost before the player signs; the wallet needs some SOL. Proof: `proof/kennel-lock-simulate.log` (real build, mainnet
  simulate: passes Streamflow's account checks, stops only on the test wallet's SOL balance).
- Why server-side: the Streamflow SDK is GPL-3 and its browser CDN bundles currently break (duplicate buffer-layout on
  jsDelivr, esm.sh build errors). Building here keeps the games free of it and the player still signs every token movement.
- The server never signs for, holds or moves the player's tokens; the lock is the player's own tokens into their own
  Streamflow escrow, released only to them at the unlock date.
