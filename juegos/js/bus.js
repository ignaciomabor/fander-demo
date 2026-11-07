// Transporte en tiempo real: varios servidores MQTT públicos a la vez (redundancia).
// Cada mensaje se publica en todos los servidores conectados y se descarta el duplicado
// al recibirlo. Si un servidor cae, la partida sigue por los demás sin que nadie lo note.

import { rid } from './util.js';

export const DEFAULT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
  'wss://mqtt.eclipseprojects.io:443/mqtt',
];

export const TOPIC_ROOT = 'mesajuegos-v1';

export function brokersFromUrl() {
  const p = new URLSearchParams(location.search).get('brokers');
  return p ? p.split(',').filter(Boolean) : DEFAULT_BROKERS;
}

export class Bus {
  constructor({ brokers = DEFAULT_BROKERS, onMessage, onStatus, mqttLib = globalThis.mqtt }) {
    this.onMessage = onMessage;
    this.onStatus = onStatus || (() => {});
    this.topics = new Set();
    this.retained = new Map(); // topic -> payload (para re-publicar al reconectar)
    this.seen = new Map(); // id de mensaje -> instante (deduplicación)
    this.clients = brokers.map((url) => this._connect(mqttLib, url));
    this._gc = setInterval(() => this._cleanSeen(), 30000);
  }

  _connect(mqttLib, url) {
    const c = mqttLib.connect(url, {
      clientId: 'mj_' + rid(12),
      clean: true,
      keepalive: 20,
      reconnectPeriod: 2000,
      connectTimeout: 8000,
      queueQoSZero: false,
      resubscribe: false,
      protocolVersion: 4,
    });
    c.on('connect', () => {
      if (this.topics.size) c.subscribe([...this.topics], { qos: 1 });
      // Re-publica lo retenido: el servidor pudo perderlo o tener una versión vieja.
      for (const [topic, payload] of this.retained) c.publish(topic, payload, { qos: 1, retain: true });
      this._status();
    });
    c.on('close', () => this._status());
    c.on('offline', () => this._status());
    c.on('error', () => {
      /* el reintento es automático */
    });
    c.on('message', (topic, buf) => this._onMessage(topic, buf));
    return c;
  }

  _onMessage(topic, buf) {
    if (!buf || !buf.length) return;
    let obj;
    try {
      obj = JSON.parse(typeof buf === 'string' ? buf : new TextDecoder().decode(buf));
    } catch {
      return;
    }
    if (!obj || typeof obj !== 'object') return;
    if (obj._m) {
      if (this.seen.has(obj._m)) return;
      this.seen.set(obj._m, Date.now());
    }
    try {
      this.onMessage(topic, obj);
    } catch (e) {
      console.error(e);
    }
  }

  _cleanSeen() {
    const limit = Date.now() - 5 * 60000;
    for (const [k, t] of this.seen) if (t < limit) this.seen.delete(k);
  }

  _status() {
    this.onStatus(this.connectedCount, this.clients.length);
  }

  get connectedCount() {
    return this.clients.filter((c) => c.connected).length;
  }

  subscribe(topic) {
    if (this.topics.has(topic)) return;
    this.topics.add(topic);
    for (const c of this.clients) if (c.connected) c.subscribe(topic, { qos: 1 });
  }

  publish(topic, obj, { retain = false } = {}) {
    const payload = JSON.stringify({ ...obj, _m: rid(10) });
    if (retain) this.retained.set(topic, payload);
    let sent = 0;
    for (const c of this.clients) {
      if (!c.connected) continue;
      c.publish(topic, payload, { qos: retain ? 1 : 0, retain });
      sent++;
    }
    return sent;
  }

  /** Borra un mensaje retenido de los servidores. */
  clearRetained(topic) {
    this.retained.delete(topic);
    for (const c of this.clients) if (c.connected) c.publish(topic, '', { qos: 1, retain: true });
  }

  /** Al volver a primer plano: fuerza la reconexión inmediata de lo caído. */
  wake() {
    for (const c of this.clients) {
      if (!c.connected && !c.disconnecting && !c.reconnecting) {
        try {
          c.reconnect();
        } catch {
          /* nada */
        }
      }
    }
  }

  close() {
    clearInterval(this._gc);
    for (const c of this.clients) c.end(true);
  }
}
