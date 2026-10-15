// HTTP polling relay for online 1v1 on Vercel (serverless functions cannot hold WebSockets).
// Storage: Upstash Redis REST (env UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL/TOKEN).
// Without those env vars the endpoint answers 503 {configured:false}; the game then hides/greys the option.
//   GET  /api/relay?health=1                      -> {configured}
//   POST /api/relay  {room, msgs:[...]}            -> append messages to the room log (max 64 per call), {n}
//   GET  /api/relay?room=ABCD&after=N              -> {msgs:[...], next} messages with index >= N
// Rooms expire 2 hours after their last write. Clients ignore their own messages by `from`.
const URL_ = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export function upstashStore() {
  const call = async cmds => { const r = await fetch(`${URL_()}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN()}`, 'content-type': 'application/json' }, body: JSON.stringify(cmds) });
    if (!r.ok) throw new Error('upstash ' + r.status); return (await r.json()).map(x => x.result); };
  return { async push(key, items) { const [n] = await call([['RPUSH', key, ...items], ['EXPIRE', key, 7200]]); return n; },
    async range(key, from) { const [items] = await call([['LRANGE', key, from, from + 255]]); return items || []; } };
}
export function memoryStore() { const m = new Map();
  return { async push(key, items) { const a = m.get(key) || []; a.push(...items); m.set(key, a); return a.length; }, async range(key, from) { return (m.get(key) || []).slice(from, from + 256); } }; }
export function makeHandler(store) {
  return async function handler(req, res) {
    res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', 'content-type'); res.setHeader('cache-control', 'no-store');
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    const send = (code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
    const q = new URL(req.url, 'http://x').searchParams;
    if (!store) return send(503, { configured: false, error: 'relay storage not configured (set UPSTASH_REDIS_REST_URL/TOKEN)' });
    if (q.get('health')) return send(200, { configured: true });
    const room = String((req.method === 'POST' ? (await body(req)).room : q.get('room')) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    try {
      if (req.method === 'POST') { const b = await body(req); if (!room || !Array.isArray(b.msgs) || !b.msgs.length) return send(400, { error: 'bad request' });
        const items = b.msgs.slice(0, 64).map(m => JSON.stringify(m)).filter(s => s.length < 4096); const n = await store.push('room:' + room, items); return send(200, { n }); }
      if (!room) return send(400, { error: 'room required' });
      const after = Math.max(0, parseInt(q.get('after') || '0', 10) || 0); const items = await store.range('room:' + room, after);
      return send(200, { msgs: items.map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean), next: after + items.length });
    } catch (e) { return send(502, { error: String(e.message || e) }); }
  };
}
async function body(req) {
  if (req._parsed) return req._parsed; if (req.body && typeof req.body === 'object') return (req._parsed = req.body);
  const chunks = []; for await (const c of req) chunks.push(c); try { req._parsed = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { req._parsed = {}; } return req._parsed;
}
export default makeHandler(URL_() && TOKEN() ? upstashStore() : null);
