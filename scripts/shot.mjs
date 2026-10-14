import { chromium } from 'playwright'; import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const root = '/workspace/aoe2'; const M = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const s = http.createServer(async (q, r) => { try { const f = join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); r.writeHead(200, { 'content-type': M[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f)); } catch { r.writeHead(404); r.end(); } });
await new Promise(r => s.listen(0, r)); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('ERR', e)); await p.goto(`http://localhost:${s.address().port}/?play=sp${process.argv[3] || ''}`); await p.waitForFunction(() => window.game.world); await p.waitForTimeout(800);
if (process.argv[4]) await p.evaluate(s => window.game.tick(+s), process.argv[4]);
await p.screenshot({ path: process.argv[2] }); await b.close(); s.close();
