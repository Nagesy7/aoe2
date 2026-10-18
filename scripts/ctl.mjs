#!/usr/bin/env node
// Inu Empires control tool: one place for browser automation, screenshots, video, balance and live verification.
//   node scripts/ctl.mjs start sp|ai|watch [--url U]     open the game (headed if DISPLAY is set) and keep it running
//   node scripts/ctl.mjs shot <scene> [--phone|--desktop] [--out file.png] [--url U]   scenes: title skirmish sandbox buildmenu kibble lobby
//   node scripts/ctl.mjs run <flow> [args]               flows: scripts/flows/<flow>.mjs (list with `ctl run`)
//   node scripts/ctl.mjs balance [--seeds 16 --minutes 30] sim/balance.mjs in the background-friendly form (log to proof/balance.txt)
//   node scripts/ctl.mjs verify [--url U]                smoke: title buttons match index.html, skirmish starts, no page errors (phone + desktop)
//   node scripts/ctl.mjs deploy [--prod] [--ref main]    clean export of the commit (git worktree), stamp <meta name=build-id>, vercel deploy
//   node scripts/ctl.mjs build-id [--url U]              live build id vs origin/main (exit 1 if live lags main)
// Shared helpers are exported so flows import them instead of copying a static server / launch / tap boilerplate.
// Video: pass --video <dir> (or RECORD=dir) and every context records .webm into it (Playwright recordVideo).
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync, readdirSync, renameSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
export const DESKTOP = { viewport: { width: 1366, height: 768 } };
export { devices };
export const argOf = (k, d, argv = process.argv) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
export const flag = (k, argv = process.argv) => argv.includes('--' + k);

// ---- static server (any directory: repo, a git worktree, an exported commit) ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
export async function startServer({ root = ROOT, relay = false } = {}) {
  if (relay) { const { startRelay } = await import(pathToFileURL(join(ROOT, 'server/relay.mjs')).href); const { server } = await startRelay({ port: 0, staticDir: root, log: () => {} });
    return { url: `http://localhost:${server.address().port}/`, close: () => server.close(), server }; }
  const server = http.createServer(async (q, r) => {
    const p = decodeURIComponent(q.url.split('?')[0]).replace(/\.\.+[/\\]/g, ''); const f = join(root, p === '/' ? 'index.html' : p);
    try { const ext = f.slice(f.lastIndexOf('.')); r.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' }); r.end(await readFile(f)); } catch { r.writeHead(404); r.end('not found'); } });
  await new Promise(ok => server.listen(0, ok));
  return { url: `http://localhost:${server.address().port}/`, close: () => server.close(), server };
}
// base URL: --url / URL env, else a local server of the working tree
export async function base(argv = process.argv) { const u = argOf('url', process.env.URL, argv); if (u) return { url: u.endsWith('/') || u.includes('?') ? u : u + '/', close: () => {} }; return startServer({ relay: flag('relay', argv) }); }

// ---- browser / pages ----
let _browser;
export async function browser() { return _browser ||= await chromium.launch({ headless: !process.env.HEADED }); }
export async function closeAll() { if (_browser) await _browser.close(); _browser = null; }
// newPage({ phone, video }) -> page with helpers attached: p.errors[], p.tap(), p.mid(sel), p.S(fn), p.scr(x,y)
export async function newPage({ phone = false, video = process.env.RECORD, ctxOpts = {} } = {}) {
  const b = await browser(); const opts = { ...(phone ? PHONE : DESKTOP), ...ctxOpts };
  if (video) { mkdirSync(video, { recursive: true }); opts.recordVideo = { dir: video, size: opts.viewport }; }
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.errors = []; p.phone = phone;
  p.on('pageerror', e => p.errors.push(String(e)));
  const cdp = phone ? await ctx.newCDPSession(p) : null;
  p.touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: q.id ?? i })) });
  p.tap = async (q, ms = 60) => { if (!phone) { await p.mouse.click(q.x, q.y); return p.waitForTimeout(60); } await p.touch('touchStart', [q]); await p.waitForTimeout(ms); await p.touch('touchEnd', []); await p.waitForTimeout(80); };
  p.longPress = q => p.tap(q, 650);
  p.mid = async sel => { const r = await p.locator(sel).first().boundingBox(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  p.press = async sel => { const q = await p.mid(sel); if (!q) throw new Error('not visible: ' + sel); await p.tap(q); };
  p.S = (f, a) => p.evaluate(f, a); p.scr = (x, y) => p.evaluate(([x, y]) => window.game.toScreen(x, y), [x, y]);
  p.saveVideo = async to => { const v = p.video(); await ctx.close(); if (v && to) { mkdirSync(dirname(to), { recursive: true }); renameSync(await v.path(), to); } return to; };
  return p;
}
export async function openTitle(p, url, query = '') { await p.goto(url + query); await p.waitForFunction(() => window.game && document.querySelector('#menu')); await p.waitForTimeout(300); return p; }
export async function titleButtons(p) { return p.$$eval('#menu button[id^=btn-]', bs => bs.map(b => ({ id: b.id, text: b.textContent.trim() }))); }
export async function startSkirmish(p, { civ, aiCiv } = {}) {
  if (civ) await p.selectOption('#civ', civ); if (aiCiv) await p.selectOption('#ai-civ', aiCiv);
  await p.locator('#btn-ai').scrollIntoViewIfNeeded(); await p.press('#btn-ai'); await p.waitForFunction(() => window.game.world); await p.waitForTimeout(500); return p;
}
export async function startSandbox(p) { await p.locator('#btn-sp').scrollIntoViewIfNeeded(); await p.press('#btn-sp'); await p.waitForFunction(() => window.game.world); await p.waitForTimeout(500); return p; }
// select: real tap/click on the first own unit of `type` that is on screen (pans camera there first if needed)
export async function select(p, type = 'villager') {
  const vp = p.viewportSize();
  const us = await p.S(t => window.game.world.units.filter(u => u.owner === 'player' && u.type === t).map(u => ({ id: u.id, x: u.x, y: u.y })), type);
  for (const u of us) { const q = await p.scr(u.x, u.y); if (q.x > 60 && q.x < vp.width - 60 && q.y > 50 && q.y < vp.height - 60) { await p.tap(q); return { ...u, q, sel: await p.S(() => window.game.world.selection) }; } }
  return null;
}
// order: right-click (desktop) or Command-mode tap (touch) at a world point or { kind } resource
export async function order(p, target) {
  let t = target; if (target && target.kind) t = await p.S(k => { const w = window.game.world, s = w.units.find(u => u.id === (w.selection?.id ?? w.selection?.ids?.[0])) || w.units[0];
    return w.resources.filter(n => n.kind === k).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0]; }, target.kind);
  const q = await p.scr(t.x, t.y);
  if (p.phone) { await p.press('#touchbar [data-t=command]'); await p.tap(q); await p.press('#touchbar [data-t=command]'); } else { await p.mouse.click(q.x, q.y, { button: 'right' }); await p.waitForTimeout(60); }
  return p.S(() => window.game.world.lastOrder);
}
export async function shot(p, file) { mkdirSync(dirname(file), { recursive: true }); await p.screenshot({ path: file }); return file; }
export function checker(lines = []) { const c = (ok, m) => { const s = `${ok ? 'PASS' : 'FAIL'}: ${m}`; console.log(s); lines.push(s); if (!ok) c.fails++; return ok; }; c.fails = 0; c.lines = lines; return c; }
export const SHOTS = '/workspace/inu-empires-shots';
export function indexButtons(root = ROOT, ref = '') { const h = ref ? execSync(`git show ${ref}:index.html`, { cwd: ROOT }).toString() : readFileSync(join(root, 'index.html'), 'utf8'); return [...h.matchAll(/<button id="(btn-[a-z]+)"[^>]*>([^<]*)</g)].map(m => ({ id: m[1], text: m[2].trim() })).filter(b => !['btn-ready', 'btn-leave'].includes(b.id)); }

// ---- scenes for `ctl shot` ----
export const SCENES = {
  title: async p => p,
  skirmish: async p => startSkirmish(p),
  sandbox: async p => startSandbox(p),
  buildmenu: async p => { await startSandbox(p); await select(p, 'villager'); if (await p.locator('#cmdtab').isVisible()) await p.press('#cmdtab'); await p.waitForTimeout(200); return p; },
  kibble: async p => { await p.press('#btn-kibble'); await p.waitForTimeout(400); return p; },
  battle: async p => { await p.goto(p.url().split('?')[0] + '?play=watch&seed=7'); await p.waitForFunction(() => window.game.world); await p.S(() => window.game.tick(600)); return p; },
};

// ---- subcommands ----
async function cmdShot(argv) {
  const scene = argv[0] || 'title'; if (!SCENES[scene]) throw new Error(`unknown scene ${scene}; scenes: ${Object.keys(SCENES).join(' ')}`);
  const srv = await base(argv); const phone = !flag('desktop', argv); const p = await newPage({ phone, video: argOf('video', process.env.RECORD, argv) });
  await openTitle(p, srv.url, argOf('query', '', argv)); await SCENES[scene](p);
  const out = argOf('out', join(SHOTS, `${new Date().toISOString().slice(0, 10)}-${scene}-${phone ? '844x390' : '1366x768'}.png`), argv);
  await shot(p, out); console.log(out, p.errors.length ? 'ERRORS: ' + p.errors.join(' | ') : ''); await closeAll(); srv.close(); return p.errors.length ? 1 : 0;
}
async function cmdStart(argv) {
  const mode = argv[0] || 'sp'; const srv = await base(argv); const p = await newPage({ phone: flag('phone', argv) });
  await p.goto(srv.url + `?play=${mode}`); await p.waitForFunction(() => window.game.world); console.log(`running ${mode} at ${srv.url}?play=${mode} (Ctrl+C to stop)`);
  if (flag('once', argv)) { await closeAll(); srv.close(); return 0; } await new Promise(() => {});
}
async function cmdRun(argv) {
  const dir = join(ROOT, 'scripts/flows'); const all = readdirSync(dir).filter(f => f.endsWith('.mjs')).map(f => f.slice(0, -4));
  if (!argv[0]) { console.log('flows:', all.join(' ')); return 0; }
  if (!all.includes(argv[0])) throw new Error(`unknown flow ${argv[0]}; flows: ${all.join(' ')}`);
  const file = join(dir, argv[0] + '.mjs'); process.argv = [process.argv[0], file, ...argv.slice(1)]; // legacy flows read process.argv[2..]
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.default === 'function') { const r = await mod.default(argv.slice(1)); await closeAll(); return r || 0; }
  return 0; // legacy flow ran on import
}
async function cmdBalance(argv) {
  const seeds = argOf('seeds', '16', argv), minutes = argOf('minutes', '30', argv), out = argOf('out', 'proof/balance.json', argv), log = argOf('log', 'proof/balance.txt', argv);
  console.log(`node sim/balance.mjs --seeds ${seeds} --minutes ${minutes} --out ${out}  (log ${log}); 16 seeds x 30 min takes ~15-45 min: run with & and poll the log`);
  return new Promise(ok => { const c = spawn(process.execPath, ['sim/balance.mjs', '--seeds', seeds, '--minutes', minutes, '--out', out], { cwd: ROOT });
    let txt = ''; c.stdout.on('data', d => { txt += d; process.stdout.write(d); }); c.stderr.on('data', d => process.stderr.write(d));
    c.on('close', code => { writeFileSync(join(ROOT, log), txt); ok(code); }); });
}
// verify: title buttons on the target equal index.html of the checked-out tree, skirmish starts, no errors, phone + desktop
export async function verify(argv = []) {
  const srv = await base(argv); const c = checker(); const remote = !!argOf('url', process.env.URL, argv); const want = indexButtons(ROOT, argOf('ref', remote ? 'origin/main' : '', argv)); const tag = argOf('tag', 'verify', argv); // remote targets compare to origin/main, local to the working tree const tag = argOf('tag', 'verify', argv);
  for (const phone of [true, false]) {
    const p = await newPage({ phone }); const name = phone ? '844x390' : '1366x768';
    await openTitle(p, srv.url); const got = (await titleButtons(p)).filter(b => want.some(w => w.id === b.id) || true).filter(b => !['btn-ready', 'btn-leave'].includes(b.id));
    c(JSON.stringify(got) === JSON.stringify(want), `${name}: title buttons match index.html (${got.map(b => b.text).join(' | ')})`);
    if (flag('shots', argv)) await shot(p, join(SHOTS, `oct18-${tag}-title-${name}.png`));
    await startSkirmish(p); const n = await p.S(() => window.game.world.units.filter(u => u.owner === 'player').length); c(n > 0, `${name}: skirmish started (${n} own units)`);
    const vp = p.viewportSize(); const cv = await p.locator('#game').boundingBox(); c(Math.abs(cv.width - vp.width) < 1 && Math.abs(cv.height - vp.height) < 1, `${name}: canvas fills viewport`);
    const v = await select(p, 'villager'); c(v && v.sel && (v.sel.id === v.id || v.sel.ids?.includes(v.id)), `${name}: real ${phone ? 'tap' : 'click'} selects a Worker Pup (${JSON.stringify(v && v.sel)})`);
    const lo = v && await order(p, { kind: 'berries' }); c(lo && ['gather', 'move', 'attack'].includes(lo.kind), `${name}: ${phone ? 'Command tap' : 'right-click'} on berries issues an order (${lo && lo.kind})`);
    if (flag('shots', argv)) await shot(p, join(SHOTS, `oct18-${tag}-skirmish-${name}.png`));
    c(!p.errors.length, `${name}: no page errors ${p.errors.join(' | ')}`); await p.context().close();
  }
  if (flag('build', argv) || argOf('url', '', argv)) { const r = await buildCheck(srv.url, argOf('expect', '', argv)); if (r !== null) c(r.ok, r.msg); }
  await closeAll(); srv.close(); console.log(c.fails ? `VERIFY: ${c.fails} FAILED` : 'VERIFY: ALL PASSED'); return c.fails ? 1 : 0;
}
// build id check: <meta name=build-id> on the page vs expected commit (default origin/main). Returns null if the page has no build id.
export async function buildCheck(url, expect = '') {
  const html = await (await fetch(url, { cache: 'no-store' })).text(); const m = html.match(/<meta name="build-id" content="([^"]*)"/);
  if (!m) return { ok: false, msg: `build id: page at ${url} has no <meta name="build-id">` };
  if (!expect) { try { execSync('git fetch -q origin main', { cwd: ROOT, stdio: 'ignore', timeout: 30000 }); } catch {} expect = execSync('git rev-parse origin/main', { cwd: ROOT }).toString().trim(); }
  const ok = m[1] && expect.startsWith(m[1].slice(0, 7)) && m[1].length >= 7; return { ok, msg: `build id: live ${m[1] || '(dev)'} vs expected ${expect.slice(0, 12)}` };
}

// deploy: never from the working tree. Export the commit with git worktree, stamp the build id, deploy that directory.
async function cmdDeploy(argv) {
  const ref = argOf('ref', 'HEAD', argv), sha = execSync(`git rev-parse ${ref}`, { cwd: ROOT }).toString().trim(), dir = `/tmp/inu-deploy-${sha.slice(0, 12)}`;
  if (existsSync(dir)) execSync(`git worktree remove --force ${dir}`, { cwd: ROOT, stdio: 'ignore' });
  execSync(`git worktree add --detach ${dir} ${sha}`, { cwd: ROOT, stdio: 'ignore' });
  try {
    mkdirSync(join(dir, '.vercel'), { recursive: true }); writeFileSync(join(dir, '.vercel/project.json'), readFileSync(join(ROOT, '.vercel/project.json')));
    const f = join(dir, 'index.html'); const h = readFileSync(f, 'utf8'); if (!h.includes('<meta name="build-id" content="dev">')) throw new Error('index.html has no build-id meta');
    writeFileSync(f, h.replace('<meta name="build-id" content="dev">', `<meta name="build-id" content="${sha.slice(0, 12)}">`));
    const args = ['deploy', ...(flag('prod', argv) ? ['--prod'] : []), '--yes'];
    console.log(`deploying ${sha.slice(0, 12)} from clean export ${dir}: vercel ${args.join(' ')}`);
    const res = await new Promise(ok => { const c = spawn('vercel', args, { cwd: dir, env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` } });
      let o = ''; c.stdout.on('data', d => { o += d; }); c.stderr.on('data', d => { o += d; }); c.on('close', code => ok({ code, o })); });
    const url = (res.o.match(/(?:Production|Preview)\s+(https:\/\/[a-z0-9-]+\.vercel\.app)/) || res.o.match(/"url": "(https:[^"]+)"/) || [])[1];
    console.log(res.o.split('\n').filter(l => /https:|Error|Production|Preview|Inspect/i.test(l)).join('\n'));
    console.log(`DEPLOY ${res.code ? 'FAILED' : 'OK'} ${sha.slice(0, 12)} ${url || ''}`); return res.code;
  } finally { execSync(`git worktree remove --force ${dir}`, { cwd: ROOT, stdio: 'ignore' }); }
}
async function cmdBuildId(argv) { const url = argOf('url', 'https://inu-empires.vercel.app/', argv); const r = await buildCheck(url, argOf('expect', '', argv)); console.log(`${r.ok ? 'PASS' : 'FAIL'}: ${r.msg}`); return r.ok ? 0 : 1; }
const CMDS = { deploy: cmdDeploy, 'build-id': cmdBuildId, shot: cmdShot, start: cmdStart, run: cmdRun, balance: cmdBalance, verify };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!CMDS[cmd]) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n')); process.exit(cmd ? 1 : 0); }
  process.argv = [process.argv[0], process.argv[1], ...rest];
  CMDS[cmd](rest).then(code => process.exit(code || 0), e => { console.error(e); process.exit(1); });
}
