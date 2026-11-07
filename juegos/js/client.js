// Cliente de jugador. Se reconecta solo, reenvía cada jugada hasta que el admin la
// confirma y recupera su sitio al recargar (identidad guardada en el navegador).

import { Bus, TOPIC_ROOT } from './bus.js';
import { newKeyPair, sharedKey, seal, open, keyId } from './crypto.js';
import { rid, store } from './util.js';

const idKey = (code) => `mj-p-${code}`;

export function savedIdentity(code) {
  return store.get(idKey(code));
}
export function forgetIdentity(code) {
  store.del(idKey(code));
}

export class RemoteClient {
  constructor(code, brokers) {
    this.code = code;
    this.topic = `${TOPIC_ROOT}/${code}`;
    this.brokers = brokers;
    this.id = savedIdentity(code);
    this.pending = [];
    this.view = null;
    this.room = null; // último mensaje público de la sala
    this.lastViewAt = 0;
    this.lastPubAt = 0;
    this.listeners = new Set();
    this.status = { up: 0, total: brokers.length, host: false, joined: false };
    this.flags = {};
  }

  on(f) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }
  _emit() {
    for (const f of this.listeners) f(this);
  }

  /** Conecta y escucha la sala (sin unirse todavía si no hay identidad). */
  connect() {
    this.bus = new Bus({
      brokers: this.brokers,
      onMessage: (t, m) => this._onMessage(t, m),
      onStatus: (up, total) => {
        this.status.up = up;
        this.status.total = total;
        if (up) this._sendJoin();
        this._emit();
      },
    });
    this.bus.subscribe(`${this.topic}/pub`);
    if (this.id) this.bus.subscribe(`${this.topic}/v/${this.id.pid}`);
    this._timer = setInterval(() => this._tick(), 1500);
    this._hbTimer = setInterval(() => this._heartbeat(), 4000);
  }

  async join(name, claim) {
    const kp = await newKeyPair();
    this.id = { pid: 'p' + rid(10), name: String(name).trim().slice(0, 18), pub: kp.pub, priv: kp.priv, at: Date.now() };
    this.claim = claim || null;
    store.set(idKey(this.code), this.id);
    this.key = null;
    this.keyFor = null;
    this.bus.subscribe(`${this.topic}/v/${this.id.pid}`);
    await this._ensureKey();
    this._sendJoin(true);
    this._emit();
  }

  leave() {
    forgetIdentity(this.code);
    this.id = null;
    this.view = null;
    this.pending = [];
    this._emit();
  }

  async _ensureKey() {
    if (!this.id || !this.room?.hostPub) return null;
    const kid = keyId(this.room.hostPub);
    if (this.keyFor !== kid) {
      this.keyFor = kid;
      this.key = await sharedKey(this.id.priv, this.room.hostPub);
    }
    return this.key;
  }

  async _onMessage(topic, m) {
    if (topic === `${this.topic}/pub` && m.k === 'pub') {
      const changed = !this.room || keyId(this.room.hostPub) !== keyId(m.hostPub);
      if (this.room && m.ts < this.room.ts) return;
      this.room = m;
      this.lastPubAt = Date.now();
      if (changed && this.id) {
        await this._ensureKey();
        this._sendJoin(true);
      }
      this._emit();
      return;
    }
    if (this.id && topic === `${this.topic}/v/${this.id.pid}`) {
      const key = await this._ensureKey();
      if (!key) return;
      const view = await open(key, m);
      if (!view) return;
      if (view.replaced) {
        this.flags.replaced = true;
        this._emit();
        return;
      }
      if (view.kicked) {
        this.flags.kicked = true;
        this.leave();
        return;
      }
      if (view.adopt) return this._adopt(view.adopt);
      if (this.view && view.v <= this.view.v) return;
      this.view = view;
      this.lastViewAt = Date.now();
      this.status.joined = true;
      const acked = new Set(view.ack || []);
      this.pending = this.pending.filter((p) => !acked.has(p.id));
      this._emit();
    }
  }

  _adopt(pid) {
    // Recuperamos el sitio de un jugador que estaba desconectado.
    this.id = { ...this.id, pid };
    this.claim = null;
    store.set(idKey(this.code), this.id);
    this.view = null;
    this.bus.subscribe(`${this.topic}/v/${pid}`);
    this._sendJoin(true);
    this._emit();
  }

  _sendJoin(force) {
    if (!this.id || !this.bus) return;
    const now = Date.now();
    if (!force && now - (this._lastJoin || 0) < 2500) return;
    this._lastJoin = now;
    this.bus.publish(`${this.topic}/up`, {
      k: 'join',
      pid: this.id.pid,
      name: this.id.name,
      pub: this.id.pub,
      claim: this.claim || undefined,
    });
  }

  async _send(body) {
    const key = await this._ensureKey();
    if (!key) return false;
    const msg = await seal(key, body);
    return this.bus.publish(`${this.topic}/up`, { k: 'msg', pid: this.id.pid, ...msg }) > 0;
  }

  /** Envía una jugada. Se reintenta hasta que el admin la confirma. */
  send(a) {
    const p = { id: rid(10), a, at: 0, tries: 0 };
    this.pending.push(p);
    this._flush();
    this._emit();
    return p.id;
  }

  async _flush() {
    const now = Date.now();
    for (const p of this.pending) {
      if (now - p.at < 1400) continue;
      p.at = now;
      p.tries++;
      await this._send({ t: 'act', id: p.id, a: p.a });
    }
    // Una jugada que no se confirma en 60 s se abandona (el estado ya habrá cambiado).
    this.pending = this.pending.filter((p) => p.tries < 40);
  }

  _tick() {
    if (!this.id) return;
    const now = Date.now();
    this.status.host = !!this.room && now - this.lastPubAt < 25000;
    // Si hace rato que no llega nada nuestro, volvemos a presentarnos.
    if (!this.view || now - this.lastViewAt > 20000) this._sendJoin();
    this._flush();
    this._emit();
  }

  _heartbeat() {
    if (this.id && this.view) this._send({ t: 'hb' });
  }

  /** Al volver a primer plano (móvil desbloqueado). */
  wake() {
    this.bus?.wake();
    if (this.id) {
      this._sendJoin(true);
      this._heartbeat();
    }
  }

  get myName() {
    return this.view?.players.find((p) => p.pid === this.view.you)?.name || this.id?.name;
  }
}

/** Cliente local del admin: mismas funciones, sin red. */
export class LocalClient {
  constructor(host) {
    this.host = host;
    this.code = host.code;
    this.view = null;
    this.listeners = new Set();
    this.status = { up: 0, total: 0, host: true, joined: true };
    this.pending = [];
    this.flags = {};
    host.onView((v) => {
      this.view = v;
      this._emit();
    });
    host.onStatus((s) => {
      this.status = { ...this.status, ...s };
      this._emit();
    });
  }
  on(f) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }
  _emit() {
    for (const f of this.listeners) f(this);
  }
  send(a) {
    return this.host.localAct(a);
  }
  wake() {
    this.host.bus?.wake();
  }
}
