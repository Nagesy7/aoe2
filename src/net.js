// Online 1v1 transport + lobby. Two interchangeable "buses" carry JSON messages to the other player in a room:
//   RelayBus: WebSocket to server/relay.mjs (?relay=wss://host/ws), works across machines.
//   TabsBus:  BroadcastChannel between two tabs of the same browser (no server; works on the static Vercel site).
// NetSession runs the lobby (hello / ready / start), heartbeats (ping, disconnect detection) and forwards lockstep traffic.
export const PEER_TIMEOUT_MS = 6000;
const rid = () => Math.random().toString(36).slice(2, 10);   // UI/network only, never used by the simulation
export const newRoomCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

class Bus {
  constructor() { this.handlers = []; this.statusHandlers = []; }
  onMessage(f) { this.handlers.push(f); } onStatus(f) { this.statusHandlers.push(f); }
  emit(m) { for (const f of this.handlers) f(m); } status(s, extra) { for (const f of this.statusHandlers) f(s, extra); }
}
export class TabsBus extends Bus {
  constructor(code) { super(); this.kind = 'tabs'; this.ch = new BroadcastChannel('aoe2-room-' + code);
    this.ch.onmessage = e => this.emit(e.data); setTimeout(() => this.status('open'), 0); }
  send(m) { this.ch.postMessage(m); } close() { this.ch.close(); }
}
export class RelayBus extends Bus {
  constructor(url, code) { super(); this.kind = 'relay'; this.url = url;
    let ws; try { ws = this.ws = new WebSocket(url); } catch (e) { setTimeout(() => this.status('error', String(e.message || e)), 0); return; }
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room: code }));
    ws.onerror = () => this.status('error', `cannot reach relay ${url}`);
    ws.onclose = () => this.status('closed');
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'joined') this.status('open'); else if (m.t === 'full') this.status('error', 'room is full'); else if (m.t === 'peer-left') this.status('peer-left');
      else if (m.t !== 'peer-joined') this.emit(m); };
  }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); } close() { this.ws && this.ws.close(); }
}
export function defaultRelayUrl() {
  const p = new URLSearchParams(location.search).get('relay'); if (p) return p;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

// Lobby + heartbeat. host = player 1, guest = player 2.
export class NetSession {
  constructor({ bus, role, code, onChange = () => {}, onStart = () => {}, onGame = () => {} }) {
    Object.assign(this, { bus, role, code, onChange, onStart, onGame });
    this.id = rid(); this.state = 'connecting'; this.peer = null; this.ready = false; this.rtt = null; this.error = null; this.peerLost = false;
    bus.onStatus((s, extra) => {
      if (s === 'open') { this.state = 'lobby'; this.hello(); }
      else if (s === 'error') { this.error = extra; this.state = 'error'; }
      else if (s === 'closed' && this.state !== 'left') { this.error = this.error || 'connection to relay closed'; if (this.state !== 'playing') this.state = 'error'; else this.lost(); }
      else if (s === 'peer-left') this.lost();
      this.onChange(this);
    });
    bus.onMessage(m => this.receive(m));
    this.timer = setInterval(() => this.heartbeat(), 1000);
    this.bye = () => this.send({ t: 'bye' }); addEventListener('pagehide', this.bye);
  }
  get me() { return this.role === 'host' ? 0 : 1; }
  send(m) { this.bus.send({ ...m, from: this.id }); }
  hello() { this.send({ t: 'hello', role: this.role }); }
  lost() { if (!this.peer) return; this.peerLost = true; this.onChange(this); }
  heartbeat() {
    if (this.state === 'lobby' && !this.peer) this.hello();
    if (this.peer) { this.send({ t: 'ping', ts: performance.now() });
      if (!this.peerLost && performance.now() - this.peer.seen > PEER_TIMEOUT_MS) this.lost(); }
    this.onChange(this);
  }
  receive(m) {
    if (!m || m.from === this.id || (m.to && m.to !== this.id)) return;
    if (this.peer && m.from === this.peer.id) { this.peer.seen = performance.now(); if (this.peerLost && m.t !== 'bye') { this.peerLost = false; this.onChange(this); } }
    switch (m.t) {
      case 'hello':
        if (m.role === this.role) { if (!this.peer) { this.error = `this room already has a ${this.role}`; this.onChange(this); } return; }
        if (!this.peer) { this.peer = { id: m.from, ready: false, seen: performance.now() }; this.error = null; this.hello(); this.onChange(this); }
        else if (m.from !== this.peer.id && this.role === 'host') this.bus.send({ t: 'full', to: m.from, from: this.id });
        return;
      case 'full': this.error = 'room is full'; this.state = 'error'; this.onChange(this); return;
      case 'bye': if (this.peer && m.from === this.peer.id) { if (this.state === 'lobby') { this.peer = null; this.onChange(this); } else this.lost(); } return;
    }
    if (!this.peer || m.from !== this.peer.id) return;
    switch (m.t) {
      case 'ping': this.send({ t: 'pong', ts: m.ts }); return;
      case 'pong': { const r = performance.now() - m.ts; this.rtt = this.rtt == null ? r : this.rtt * 0.7 + r * 0.3; return; }
      case 'ready': this.peer.ready = !!m.v; this.onChange(this); this.maybeStart(); return;
      case 'start': if (this.role === 'guest' && this.state === 'lobby') { this.state = 'playing'; this.onStart(m.cfg); this.onChange(this); } return;
      default: if (this.state === 'playing') this.onGame(m);
    }
  }
  setReady(v) { this.ready = v; this.send({ t: 'ready', v }); this.onChange(this); this.maybeStart(); }
  maybeStart(cfgExtra = {}) {
    if (this.role !== 'host' || this.state !== 'lobby' || !this.ready || !this.peer?.ready) return;
    const cfg = { seed: (Math.random() * 2 ** 31) | 0, delay: 3, hashEvery: 20, speed: 1, ...this.startCfg, ...cfgExtra };
    this.send({ t: 'start', cfg }); this.state = 'playing'; this.onStart(cfg); this.onChange(this);
  }
  leave() { this.state = 'left'; this.bye(); clearInterval(this.timer); removeEventListener('pagehide', this.bye); this.bus.close(); }
}
