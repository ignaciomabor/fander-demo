// Autoridad de la sala. Corre en el dispositivo del admin: guarda el estado completo,
// valida todas las jugadas y envía a cada jugador SOLO lo que puede ver (cifrado).
// Todo se guarda en el navegador del admin: si recarga o se le bloquea el móvil, la
// partida continúa exactamente donde estaba.

import { Bus, TOPIC_ROOT } from './bus.js';
import { newKeyPair, sharedKey, seal, open, keyId } from './crypto.js';
import { GAMES } from './games/index.js';
import { GameError, rid, store, clone } from './util.js';

const ONLINE_MS = 15000;
const hostKey = (code) => `mj-host-${code}`;

export function savedHost(code) {
  return store.get(hostKey(code));
}

export class Host {
  static async create(code, adminName, brokers) {
    const keys = await newKeyPair();
    const adminPid = 'p' + rid(10);
    const data = {
      code,
      keys,
      adminPid,
      players: [{ pid: adminPid, name: adminName, pub: null, plays: true }],
      selected: 'palabras',
      opts: {},
      game: null,
      v: 0,
      acks: {},
      errs: {},
      created: Date.now(),
    };
    store.set(hostKey(code), data);
    return new Host(data, brokers);
  }

  static load(code, brokers) {
    const data = store.get(hostKey(code));
    return data ? new Host(data, brokers) : null;
  }

  constructor(data, brokers) {
    this.d = data;
    this.brokers = brokers;
    this.keys = new Map();
    this.lastSeen = new Map();
    this.online = new Set();
    this.q = Promise.resolve();
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.status = { up: 0, total: brokers.length };
    this.topic = `${TOPIC_ROOT}/${data.code}`;
  }

  get code() {
    return this.d.code;
  }
  get adminPid() {
    return this.d.adminPid;
  }

  async start() {
    for (const p of this.d.players) {
      if (p.pub) this.keys.set(p.pid, await sharedKey(this.d.keys.priv, p.pub));
    }
    this.bus = new Bus({
      brokers: this.brokers,
      onMessage: (t, m) => this._enqueue(() => this._onMessage(t, m)),
      onStatus: (up, total) => {
        this.status = { up, total };
        for (const f of this.statusListeners) f(this.status);
      },
    });
    this.bus.subscribe(`${this.topic}/up`);
    this._publishPub();
    this.broadcast();
    this._pubTimer = setInterval(() => this._publishPub(), 8000);
    this._presenceTimer = setInterval(() => this._checkPresence(), 2500);
  }

  stop() {
    clearInterval(this._pubTimer);
    clearInterval(this._presenceTimer);
    this.bus?.close();
  }

  onView(f) {
    this.listeners.add(f);
    if (this._lastLocal) f(this._lastLocal);
    return () => this.listeners.delete(f);
  }
  onStatus(f) {
    this.statusListeners.add(f);
    f(this.status);
    return () => this.statusListeners.delete(f);
  }

  _enqueue(fn) {
    this.q = this.q.then(fn).catch((e) => console.error(e));
    return this.q;
  }

  // ---------- red ----------

  _publishPub() {
    this.bus.publish(
      `${this.topic}/pub`,
      {
        k: 'pub',
        hostPub: this.d.keys.pub,
        ts: Date.now(),
        players: this.d.players.map((p) => ({ pid: p.pid, name: p.name, on: this.isOnline(p.pid) })),
        adminPid: this.d.adminPid,
      },
      { retain: true },
    );
  }

  async _onMessage(topic, m) {
    if (topic !== `${this.topic}/up`) return;
    if (m.k === 'join') return this._onJoin(m);
    if (m.k === 'msg') {
      const key = this.keys.get(m.pid);
      if (!key) return;
      const body = await open(key, m);
      if (!body) return;
      this._touch(m.pid);
      if (body.t === 'act') this._handleAction(m.pid, body.id, body.a);
    }
  }

  async _onJoin(m) {
    if (typeof m.pid !== 'string' || !m.pub || m.pid === this.d.adminPid) return;
    let p = this.d.players.find((x) => x.pid === m.pid);
    if (p) {
      if (keyId(p.pub) !== keyId(m.pub)) {
        // Este hueco lo ha recuperado otro dispositivo: avisamos al antiguo.
        const key = await sharedKey(this.d.keys.priv, m.pub);
        const msg = await seal(key, { v: Date.now(), replaced: true });
        this.bus.publish(`${this.topic}/v/${m.pid}`, { ...msg }, { retain: false });
        return;
      }
      this._touch(m.pid);
      this.broadcast();
      return;
    }
    const key = await sharedKey(this.d.keys.priv, m.pub);
    // Recuperar un jugador existente desde otro dispositivo (móvil sin batería, etc.)
    if (m.claim) {
      const target = this.d.players.find((x) => x.pid === m.claim);
      if (target && target.pid !== this.d.adminPid && !this.isOnline(target.pid)) {
        target.pub = m.pub;
        this.keys.set(target.pid, key);
        const msg = await seal(key, { v: Date.now(), adopt: target.pid });
        this.bus.publish(`${this.topic}/v/${m.pid}`, msg, { retain: false });
        this._touch(target.pid);
        this.save();
        this.broadcast();
        return;
      }
    }
    let name = String(m.name || '').trim().slice(0, 18) || 'Jugador';
    const taken = (n) => this.d.players.some((x) => x.name.toLowerCase() === n.toLowerCase());
    if (taken(name)) {
      let i = 2;
      while (taken(`${name} ${i}`)) i++;
      name = `${name} ${i}`;
    }
    p = { pid: m.pid, name, pub: m.pub, plays: true };
    this.d.players.push(p);
    this.keys.set(p.pid, key);
    this._touch(p.pid);
    if (this.d.game) {
      const eng = GAMES[this.d.game.kind];
      eng.addPlayer?.(this.d.game.state, p.pid);
    }
    this.save();
    this.broadcast();
    this._publishPub();
  }

  _touch(pid) {
    this.lastSeen.set(pid, Date.now());
    if (!this.online.has(pid)) {
      this.online.add(pid);
      this.broadcast();
      this._publishPub();
    }
  }

  isOnline(pid) {
    if (pid === this.d.adminPid) return true;
    const t = this.lastSeen.get(pid);
    return !!t && Date.now() - t < ONLINE_MS;
  }

  _checkPresence() {
    let changed = false;
    for (const pid of [...this.online]) {
      if (!this.isOnline(pid)) {
        this.online.delete(pid);
        changed = true;
      }
    }
    if (changed) {
      this.broadcast();
      this._publishPub();
    }
  }

  // ---------- acciones ----------

  /** Acción del propio admin (sin pasar por la red). */
  localAct(a) {
    const id = rid(8);
    this._enqueue(() => this._handleAction(this.d.adminPid, id, a));
    return id;
  }

  _handleAction(pid, id, a) {
    if (!this.d.players.some((p) => p.pid === pid)) return;
    const acks = (this.d.acks[pid] ||= []);
    if (id && acks.includes(id)) {
      this.broadcast(); // ya procesada: re-enviamos la vista por si se perdió
      return;
    }
    try {
      if (a && a.r) this._roomAction(pid, a);
      else if (a && a.g) this._gameAction(pid, a.g);
    } catch (e) {
      if (e instanceof GameError) this.d.errs[pid] = { id, msg: e.message };
      else {
        console.error(e);
        this.d.errs[pid] = { id, msg: 'Error inesperado' };
      }
    }
    if (id) {
      acks.push(id);
      if (acks.length > 40) acks.splice(0, acks.length - 40);
    }
    this.save();
    this.broadcast();
  }

  _gameAction(pid, a) {
    const g = this.d.game;
    if (!g) throw new GameError('No hay partida en marcha');
    const eng = GAMES[g.kind];
    eng.act(g.state, { pid, admin: pid === this.d.adminPid }, a);
  }

  _roomAction(pid, a) {
    const admin = pid === this.d.adminPid;
    const need = () => {
      if (!admin) throw new GameError('Solo el admin puede hacer eso');
    };
    const target = this.d.players.find((p) => p.pid === a.target);
    switch (a.r) {
      case 'rename': {
        const p = admin && target ? target : this.d.players.find((x) => x.pid === pid);
        const name = String(a.name || '').trim().slice(0, 18);
        if (!name) throw new GameError('Nombre vacío');
        if (this.d.players.some((x) => x !== p && x.name.toLowerCase() === name.toLowerCase()))
          throw new GameError('Ese nombre ya está cogido');
        p.name = name;
        this._publishPub();
        return;
      }
      case 'kick': {
        need();
        if (!target || target.pid === this.d.adminPid) throw new GameError('No se puede expulsar');
        this.d.players = this.d.players.filter((p) => p !== target);
        if (this.d.game) GAMES[this.d.game.kind].removePlayer?.(this.d.game.state, target.pid);
        const key = this.keys.get(target.pid);
        if (key) seal(key, { v: Date.now(), kicked: true }).then((m) => this.bus.publish(`${this.topic}/v/${target.pid}`, m, { retain: true }));
        this.keys.delete(target.pid);
        this.online.delete(target.pid);
        this._publishPub();
        return;
      }
      case 'move': {
        need();
        const i = this.d.players.indexOf(target);
        const j = i + (a.dir < 0 ? -1 : 1);
        if (i < 0 || j < 0 || j >= this.d.players.length) return;
        [this.d.players[i], this.d.players[j]] = [this.d.players[j], this.d.players[i]];
        return;
      }
      case 'plays': {
        need();
        if (!target) return;
        target.plays = !!a.value;
        return;
      }
      case 'select': {
        need();
        if (!GAMES[a.kind]) throw new GameError('Juego desconocido');
        this.d.selected = a.kind;
        return;
      }
      case 'opt': {
        need();
        const eng = GAMES[a.kind];
        const o = eng?.options.find((x) => x.key === a.key);
        if (!o || !o.choices.map(String).includes(String(a.value))) throw new GameError('Opción no válida');
        (this.d.opts[a.kind] ||= {})[a.key] = typeof o.def === 'number' ? Number(a.value) : a.value;
        return;
      }
      case 'start': {
        need();
        const eng = GAMES[this.d.selected];
        const players = this.d.players.filter((p) => p.plays).map((p) => p.pid);
        if (players.length < eng.min) throw new GameError(`${eng.name} necesita al menos ${eng.min} jugadores`);
        if (players.length > eng.max) throw new GameError(`${eng.name} admite como máximo ${eng.max} jugadores`);
        const opts = { ...Object.fromEntries(eng.options.map((o) => [o.key, o.def])), ...(this.d.opts[eng.id] || {}) };
        this.d.game = { kind: eng.id, state: eng.setup(players, opts), opts, started: Date.now() };
        return;
      }
      case 'restart': {
        need();
        if (!this.d.game) return;
        const eng = GAMES[this.d.game.kind];
        const players = this.d.players.filter((p) => p.plays).map((p) => p.pid);
        if (players.length < eng.min || players.length > eng.max) throw new GameError('Número de jugadores no válido');
        this.d.game = { ...this.d.game, state: eng.setup(players, this.d.game.opts), started: Date.now() };
        return;
      }
      case 'lobby': {
        need();
        this.d.game = null;
        return;
      }
      default:
        throw new GameError('Acción desconocida');
    }
  }

  // ---------- vistas ----------

  viewFor(pid) {
    const g = this.d.game;
    return {
      v: this.d.v,
      code: this.d.code,
      you: pid,
      admin: pid === this.d.adminPid,
      adminPid: this.d.adminPid,
      ack: this.d.acks[pid] || [],
      err: this.d.errs[pid] || null,
      players: this.d.players.map((p) => ({ pid: p.pid, name: p.name, plays: p.plays, on: this.isOnline(p.pid) })),
      selected: this.d.selected,
      opts: this.d.opts,
      game: g ? { kind: g.kind, opts: g.opts, started: g.started, view: GAMES[g.kind].view(g.state, pid) } : null,
    };
  }

  broadcast() {
    if (this._bcPending) return;
    this._bcPending = true;
    setTimeout(() => {
      this._bcPending = false;
      this._enqueue(() => this._doBroadcast());
    }, 20);
  }

  async _doBroadcast() {
    this.d.v = Math.max(this.d.v + 1, Date.now());
    const local = this.viewFor(this.d.adminPid);
    this._lastLocal = local;
    for (const f of this.listeners) f(local);
    if (!this.bus) return;
    for (const p of this.d.players) {
      if (p.pid === this.d.adminPid) continue;
      const key = this.keys.get(p.pid);
      if (!key) continue;
      const msg = await seal(key, this.viewFor(p.pid));
      this.bus.publish(`${this.topic}/v/${p.pid}`, { v: this.d.v, ...msg }, { retain: true });
    }
  }

  save() {
    if (this._saveT) return;
    this._saveT = setTimeout(() => {
      this._saveT = null;
      store.set(hostKey(this.d.code), this.d);
    }, 100);
  }

  saveNow() {
    clearTimeout(this._saveT);
    this._saveT = null;
    store.set(hostKey(this.d.code), this.d);
  }

  /** Cierra la sala: borra todo de los servidores y del navegador. */
  close() {
    for (const p of this.d.players) if (p.pid !== this.d.adminPid) this.bus.clearRetained(`${this.topic}/v/${p.pid}`);
    this.bus.clearRetained(`${this.topic}/pub`);
    store.del(hostKey(this.d.code));
    setTimeout(() => this.stop(), 800);
  }

  // ---------- altavoz (Cronohits) ----------
  nowPlaying() {
    const g = this.d.game;
    if (!g || g.kind !== 'cronohits') return null;
    return GAMES.cronohits.nowPlaying(g.state);
  }

  debugState() {
    return clone(this.d);
  }
}
