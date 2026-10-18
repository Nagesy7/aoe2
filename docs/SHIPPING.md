# Shipping Inu Empires

Live (https://inu-empires.vercel.app, Vercel project `aoe2`) must always equal `origin/main`. One path to production:

1. Commit on `main`, `npm test` green (all clans 45-55%, Kishu <= 53% from `proof/balance.json`), push `main`.
2. `node scripts/ctl.mjs ship`
   - refuses unless the ref (default `main`) == `origin/main`;
   - exports the commit with `git worktree` into `/tmp/inu-deploy-<sha>` (never the working tree, so uncommitted files cannot ship),
     stamps `<meta name="build-id" content="<sha12>">` into the exported `index.html` (exposed as `window.BUILD_ID`);
   - **preview**: `vercel deploy --yes` from the export;
   - `ctl verify --url <preview> --expect <sha>`: title buttons == index.html at origin/main, skirmish starts, real tap/click select +
     order at 844x390 and 1366x768, no page errors, build id on the page == the commit. A failing preview is never promoted;
   - **production**: `vercel deploy --prod --yes` from the same export (same commit, same build id);
   - `ctl verify` against https://inu-empires.vercel.app with screenshots to /workspace/inu-empires-shots/oct18-ship-live-*.png.
3. Check any time: `node scripts/ctl.mjs build-id` (live build id vs `origin/main`, exit 1 if live lags) and
   `node scripts/ctl.mjs run live-title` (live title buttons + every `src/*.js` byte-compared to `origin/main`).

Previews are behind Vercel Authentication. `ship` stops after the preview deploy (exit 2) and prints the preview URL.
Get a temporary share link for it (Vercel MCP `get_access_to_vercel_url`), write it to a private file (`umask 077`), then continue:

    CTL_SHARE_FILE=/tmp/share.txt node scripts/ctl.mjs ship --preview-url https://aoe2-xxxx-prosper33.vercel.app

The share link is a credential: never commit or print it (ctl only reads it from the file). Do not change the project's
deployment protection to make this easier.

Rules: deploy only into the existing `aoe2` project; never from a dirty tree; never touch the online relay (Upstash) env;
no franchise names (tests/ip.test.mjs).
