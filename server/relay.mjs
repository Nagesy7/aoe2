// Lockstep relay + lobby rooms for online 1v1.
//   node server/relay.mjs [--port 8787] [--static .]
// WebSocket at ws://host:port/ws. Protocol (JSON text frames):
//   client -> {t:'join', room:'ABCD'}                 server -> {t:'joined', room, n, slot}  or {t:'full'} / {t:'error'}
//   any other message is forwarded verbatim to the other member of the room (the game's lobby/lockstep messages)
//   server -> {t:'peer-joined'} / {t:'peer-left'} when the other member connects / disconnects
// Two members max per room; rooms vanish when empty. With --static, the game itself is served over HTTP on the same port.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = +(process.env.PORT || arg('--port', 8787));
const STATIC = arg('--static', null);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

export function startRelay({ port = PORT, staticDir = STATIC, log = console.log } = {}) {
  const rooms = new Map();   // code -> Set<ws>
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size })); return; }
    if (!staticDir) { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('aoe2 lockstep relay: connect a WebSocket to /ws\n'); return; }
    const root = path.resolve(staticDir), f = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('not found'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
  });
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', ws => {
    ws.room = null; ws.alive = true; ws.on('pong', () => ws.alive = true);
    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.t === 'join') {
        const code = String(m.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        if (!code || ws.room) { ws.send(JSON.stringify({ t: 'error', msg: 'bad room' })); return; }
        const set = rooms.get(code) || new Set();
        if (set.size >= 2) { ws.send(JSON.stringify({ t: 'full', room: code })); log(`room ${code}: full, refused`); return; }
        set.add(ws); rooms.set(code, set); ws.room = code;
        ws.send(JSON.stringify({ t: 'joined', room: code, n: set.size, slot: set.size - 1 }));
        for (const o of set) if (o !== ws) o.send(JSON.stringify({ t: 'peer-joined' }));
        log(`room ${code}: ${set.size} member(s)`); return;
      }
      if (!ws.room) return;
      for (const o of rooms.get(ws.room) || []) if (o !== ws && o.readyState === 1) o.send(raw.toString());
    });
    ws.on('close', () => {
      const set = ws.room && rooms.get(ws.room); if (!set) return;
      set.delete(ws); for (const o of set) if (o.readyState === 1) o.send(JSON.stringify({ t: 'peer-left' }));
      if (!set.size) rooms.delete(ws.room); log(`room ${ws.room}: member left (${set.size} left)`);
    });
  });
  const iv = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } } }, 15000);
  server.on('close', () => clearInterval(iv));
  return new Promise(r => server.listen(port, () => { log(`relay listening on :${server.address().port} (ws path /ws${staticDir ? `, serving ${path.resolve(staticDir)}` : ''})`); r({ server, wss, rooms, port: server.address().port }); }));
}
if (import.meta.url === `file://${process.argv[1]}`) startRelay();
