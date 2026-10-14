// Lockstep scheduler (pure, no DOM / no timers: the caller drives it, so it runs the same in Node tests and the browser).
// Each client simulates tick T only once it holds every player's command set for T. Local commands issued while at
// tick T are scheduled for T + delay and sent immediately (an empty set is sent too, so the peer never waits on silence).
// Every hashEvery ticks both clients exchange a state hash; the first mismatch is reported as a desync.
export class Lockstep {
  constructor({ players = 2, me = 0, delay = 3, hashEvery = 20, send = () => {}, onDesync = () => {} } = {}) {
    Object.assign(this, { players, me, delay, hashEvery, send, onDesync });
    this.tick = 0;                 // next tick to simulate
    this.inputs = new Map();       // tick -> Array(players) of command arrays (undefined = not received yet)
    this.sent = new Map();         // tick -> our command set (kept for resend requests)
    this.outbox = []; this.seq = 0; this.sentUpTo = delay - 1;
    this.localHashes = new Map(); this.remoteHashes = new Map(); this.checked = 0; this.desync = null;
    for (let t = 0; t < delay; t++) this.inputs.set(t, Array.from({ length: players }, () => []));
    this.stalledTicks = 0;
  }
  // Queue a local command (type/args); it is stamped with the tick it will execute on when flushed.
  queue(type, args) { this.outbox.push({ player: this.me, type, args, seq: this.seq++ }); }
  // Send our set for every tick up to tick + delay (normally exactly one new tick per simulated tick).
  pump() {
    while (this.sentUpTo < this.tick + this.delay) {
      const t = ++this.sentUpTo, cmds = (t === this.tick + this.delay ? this.outbox.splice(0) : []).map(c => ({ ...c, tick: t }));
      this.sent.set(t, cmds); this.sent.delete(t - 400);
      this.setInput(t, this.me, cmds); this.send({ t: 'in', tick: t, p: this.me, cmds });
    }
  }
  setInput(tick, player, cmds) {
    if (tick < this.tick) return;  // duplicate of an already simulated tick
    let row = this.inputs.get(tick); if (!row) this.inputs.set(tick, row = Array(this.players).fill(undefined));
    if (row[player] === undefined) row[player] = cmds;
  }
  missing(tick = this.tick) { const row = this.inputs.get(tick); return Array.from({ length: this.players }, (_, p) => p).filter(p => !row || row[p] === undefined); }
  ready() { return this.missing().length === 0; }
  // Take the command list for the current tick (canonical order) and advance; null if still waiting.
  next() {
    this.pump();
    if (!this.ready()) { this.stalledTicks++; return null; }
    const row = this.inputs.get(this.tick); this.inputs.delete(this.tick); this.tick++;
    return row.flat().sort((a, b) => a.player - b.player || a.seq - b.seq);
  }
  // Network input. Returns true if the message was a lockstep message.
  receive(msg) {
    if (msg.t === 'in') { this.setInput(msg.tick, msg.p, msg.cmds); return true; }
    if (msg.t === 'h') { this.remoteHashes.set(msg.tick, msg.h); this.compare(msg.tick); return true; }
    if (msg.t === 'need') { for (let t = msg.from; t <= Math.min(msg.to, this.sentUpTo); t++) if (this.sent.has(t)) this.send({ t: 'in', tick: t, p: this.me, cmds: this.sent.get(t) }); return true; }
    return false;
  }
  // Ask peers to resend what we are missing (used after a stall, in case a message was lost).
  requestMissing() { if (!this.ready()) this.send({ t: 'need', from: this.tick, to: this.tick + this.delay }); }
  // Record the local hash after simulating `tick` ticks.
  hash(tick, h) {
    if (tick % this.hashEvery) return;
    this.localHashes.set(tick, h); this.send({ t: 'h', tick, h }); this.compare(tick);
  }
  compare(tick) {
    const a = this.localHashes.get(tick), b = this.remoteHashes.get(tick); if (a === undefined || b === undefined) return;
    this.localHashes.delete(tick); this.remoteHashes.delete(tick);
    if (a === b) { this.checked++; this.lastChecked = tick; return; }
    if (!this.desync) { this.desync = { tick, local: a, remote: b }; this.onDesync(this.desync); }
  }
}
