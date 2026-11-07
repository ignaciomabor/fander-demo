import { html, render, useState, useEffect, useRef } from '../vendor/standalone.module.js';
import { brokersFromUrl } from './bus.js';
import { Host, savedHost } from './host.js';
import { RemoteClient, LocalClient } from './client.js';
import { roomCode, normCode, store } from './util.js';
import { GAMES } from './games/index.js';
import { Sheet, Confirm, Toasts, Rules, Dot, cls } from './ui/common.js';
import { Lobby, Invite } from './ui/lobby.js';
import { PalabrasUI } from './ui/palabras.js';
import { TiranoUI } from './ui/tirano.js';
import { CronohitsUI } from './ui/cronohits.js';
import { Speaker } from './ui/speaker.js';

const params = new URLSearchParams(location.search);
const brokers = brokersFromUrl();

function go(q) {
  const u = new URL(location.href);
  u.search = '';
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const b = params.get('brokers');
  if (b) u.searchParams.set('brokers', b);
  location.assign(u.toString());
}

// ---------- pantalla de bloqueo / reconexión ----------
let wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    }
  } catch {
    /* no soportado */
  }
}

// ---------- inicio ----------
function savedRooms() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const m = k && k.match(/^mj-(host|p)-([A-Z]{5})$/);
      if (!m) continue;
      const d = store.get(k);
      const at = m[1] === 'host' ? d?.created : d?.at;
      if (at && Date.now() - at > 3 * 86400000) {
        store.del(k);
        continue;
      }
      out.push({ type: m[1], code: m[2], name: m[1] === 'host' ? d?.players?.[0]?.name : d?.name });
    }
  } catch {
    /* nada */
  }
  return out;
}

function Home() {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const rooms = savedRooms();
  const create = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const c = roomCode();
    await Host.create(c, name.trim().slice(0, 18), brokers);
    go({ admin: c });
  };
  return html`<main class="home">
    <div class="hero">
      <div class="logo">🎲</div>
      <h1>Mesa de Juegos</h1>
      <p class="muted">Juegos de mesa para jugar juntos, cada uno con su móvil.</p>
    </div>
    <div class="hero-games">
      ${Object.values(GAMES).map((g) => html`<div class="hg" key=${g.id}><span>${g.emoji}</span>${g.name}</div>`)}
    </div>
    ${rooms.length > 0 &&
    html`<section class="card">
      <h2>Volver a una sala</h2>
      ${rooms.map(
        (r) => html`<button key=${r.type + r.code} class="btn big" onClick=${() => go(r.type === 'host' ? { admin: r.code } : { sala: r.code })}>
          ${r.type === 'host' ? '👑 Mi sala' : '🎮 Sala'} ${r.code}${r.name ? ` · ${r.name}` : ''}
        </button>`,
      )}
    </section>`}
    ${mode === 'create'
      ? html`<form class="card" onSubmit=${create}>
          <h2>Crear sala</h2>
          <p class="muted small">Tu móvil será el centro de la partida: mantén la web abierta mientras jugáis.</p>
          <input class="input" placeholder="Tu nombre" value=${name} maxlength="18" autofocus onInput=${(e) => setName(e.target.value)} />
          <button class="btn primary big" disabled=${!name.trim() || busy}>Crear</button>
          <button type="button" class="btn ghost" onClick=${() => setMode(null)}>Atrás</button>
        </form>`
      : mode === 'join'
        ? html`<form class="card" onSubmit=${(e) => (e.preventDefault(), normCode(code).length === 5 && go({ sala: normCode(code) }))}>
            <h2>Unirme</h2>
            <input class="input code-input" placeholder="CÓDIGO" value=${code} maxlength="5" autofocus autocapitalize="characters"
              onInput=${(e) => setCode(normCode(e.target.value))} />
            <button class="btn primary big" disabled=${normCode(code).length !== 5}>Entrar</button>
            <button type="button" class="btn ghost" onClick=${() => setMode(null)}>Atrás</button>
          </form>`
        : html`<div class="col gap">
            <button class="btn primary big" onClick=${() => setMode('create')}>👑 Crear sala (soy el admin)</button>
            <button class="btn big" onClick=${() => setMode('join')}>🎮 Unirme con código</button>
            <p class="muted small center">¿Te han pasado un QR? Escanéalo con la cámara y entras directamente.</p>
          </div>`}
  </main>`;
}

// ---------- unirse ----------
function JoinScreen({ client }) {
  const [name, setName] = useState('');
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 9000);
    return () => clearTimeout(t);
  }, [client.id]);
  const room = client.room;
  const claimable = room ? room.players.filter((p) => !p.on && p.pid !== room.adminPid) : [];

  if (client.flags.replaced)
    return html`<main class="card center">
      <h2>Has entrado desde otro dispositivo</h2>
      <p class="muted">Tu jugador está ahora en otro móvil.</p>
      <button class="btn primary big" onClick=${() => ((client.flags = {}), client.leave())}>Entrar como jugador nuevo</button>
    </main>`;

  if (client.id)
    return html`<main class="card center">
      <div class="spinner"></div>
      <h2>Entrando en la sala ${client.code}…</h2>
      ${slow && html`<p class="muted">${room ? 'Esperando respuesta del admin…' : 'No encuentro la sala. ¿El admin tiene la web abierta y el código es correcto?'}</p>
        <button class="btn ghost" onClick=${() => client.leave()}>Empezar de nuevo</button>`}
    </main>`;

  return html`<main class="home">
    <div class="hero"><div class="logo">🎲</div><h1>Sala ${client.code}</h1>
      <p class="muted small">${room ? html`<${Dot} on=${true} /> Sala encontrada · ${room.players.length} jugadores` : html`<span class="spinner small"></span> Buscando la sala…`}</p>
    </div>
    ${client.flags.kicked && html`<p class="card warn">El admin te ha sacado de la sala. Puedes volver a entrar.</p>`}
    <form class="card" onSubmit=${(e) => (e.preventDefault(), name.trim() && ((client.flags = {}), client.join(name)))}>
      <h2>¿Cómo te llamas?</h2>
      <input class="input" placeholder="Tu nombre" value=${name} maxlength="18" autofocus onInput=${(e) => setName(e.target.value)} />
      <button class="btn primary big" disabled=${!name.trim()}>Entrar</button>
    </form>
    ${claimable.length > 0 &&
    html`<section class="card">
      <h3>¿Ya estabas dentro y cambiaste de móvil?</h3>
      <p class="muted small">Toca tu nombre para recuperar tu sitio.</p>
      <div class="pick">${claimable.map((p) => html`<button key=${p.pid} class="btn" onClick=${() => client.join(p.name, p.pid)}>${p.name}</button>`)}</div>
    </section>`}
    <p class="center"><a class="muted small" href="./">Ir al inicio</a></p>
  </main>`;
}

// ---------- sala ----------
const sentIds = new Set();
const shownErr = new Set();

function Room({ client, host, speaker }) {
  const [, force] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(null);
  const lastV = useRef(null);

  useEffect(() => client.on(() => force((x) => x + 1)), [client]);

  const view = client.view;
  const toast = (msg) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  useEffect(() => {
    if (!view || view === lastV.current) return;
    lastV.current = view;
    const e = view.err;
    if (e && sentIds.has(e.id) && !shownErr.has(e.id)) {
      shownErr.add(e.id);
      toast(e.msg);
    }
    if (host && speaker) {
      speaker.sync(host.nowPlaying(), (idx) => host.localAct({ g: { t: 'unavailable', song: idx } }));
    }
  });

  if (!view) return html`<${JoinScreen} client=${client} />`;

  const players = Object.fromEntries(view.players.map((p) => [p.pid, p]));
  const send = (a) => {
    const id = client.send(a);
    sentIds.add(id);
  };
  const ctx = {
    view,
    me: view.you,
    admin: view.admin,
    code: view.code,
    players,
    gameStarted: view.game?.started,
    nowPlayingIdx: host?.nowPlaying()?.idx,
    r: (a) => send(a),
    g: (a) => send({ g: a }),
  };
  const game = view.game ? GAMES[view.game.kind] : null;
  const st = client.status;
  const offline = st.total > 0 && st.up === 0;
  const hostGone = !host && !st.host;
  const sending = client.pending?.some((p) => p.tries > 2);

  let body;
  if (!game) body = html`<${Lobby} ctx=${ctx} />`;
  else if (game.id === 'palabras') body = html`<${PalabrasUI} ctx=${ctx} g=${view.game.view} />`;
  else if (game.id === 'tirano') body = html`<${TiranoUI} ctx=${ctx} g=${view.game.view} />`;
  else body = html`<${CronohitsUI} ctx=${ctx} g=${view.game.view} speaker=${speaker || { state: 'idle' }} />`;

  return html`<div class="room">
    <header class="top">
      <button class="brand" onClick=${() => setMenu(true)}>${game ? html`${game.emoji} ${game.name}` : '🎲 Mesa de Juegos'}</button>
      <span class="grow"></span>
      <span class="code-chip" title="Código de sala">${view.code}</span>
      <span class=${cls('net', offline || hostGone ? 'bad' : 'ok')} title=${`${st.up}/${st.total} servidores`}></span>
      <button class="icon-btn" aria-label="Menú" onClick=${() => setMenu(true)}>☰</button>
    </header>
    ${offline && html`<div class="alert">Sin conexión. Reconectando… (no cierres la web)</div>`}
    ${!offline && hostGone && html`<div class="alert">El admin no responde. Que abra la web en su móvil (con la pantalla encendida).</div>`}
    ${!offline && !hostGone && sending && html`<div class="alert soft">Enviando…</div>`}
    <main>${body}</main>
    <${Toasts} items=${toasts} />
    ${menu &&
    html`<${Sheet} title="Menú" onClose=${() => setMenu(false)}>
      <div class="col gap-s">
        <div class="muted small">Eres <b>${players[view.you]?.name}</b> · Sala ${view.code}</div>
        ${game && html`<button class="btn" onClick=${() => (setMenu(false), setSheet('rules'))}>📖 Reglas de ${game.name}</button>`}
        ${view.admin && html`<button class="btn" onClick=${() => (setMenu(false), setSheet('invite'))}>📱 Invitar (QR)</button>`}
        ${view.admin && game && html`<button class="btn" onClick=${() => (setMenu(false), setSheet('restart'))}>🔄 Reiniciar partida</button>`}
        ${view.admin && game && html`<button class="btn" onClick=${() => (setMenu(false), setSheet('lobby'))}>🏠 Volver a la sala (elegir juego)</button>`}
        ${view.admin && html`<button class="btn danger" onClick=${() => (setMenu(false), setSheet('close'))}>Cerrar la sala para todos</button>`}
        ${!view.admin && html`<button class="btn ghost" onClick=${() => (setMenu(false), setSheet('leave'))}>Salir de la sala</button>`}
        <p class="small muted">Conexión: ${st.up}/${st.total} servidores activos.</p>
      </div>
    </${Sheet}>`}
    ${sheet === 'rules' && game && html`<${Rules} game=${game} onClose=${() => setSheet(null)} />`}
    ${sheet === 'invite' && html`<${Sheet} title="Invitar" onClose=${() => setSheet(null)}><${Invite} code=${view.code} /></${Sheet}>`}
    ${sheet === 'restart' && html`<${Confirm} title="¿Reiniciar la partida?" text="Se reparte de nuevo con los jugadores actuales." ok="Reiniciar" danger onOk=${() => ctx.r({ r: 'restart' })} onClose=${() => setSheet(null)} />`}
    ${sheet === 'lobby' && html`<${Confirm} title="¿Terminar la partida?" text="Volvéis a la sala para elegir juego." ok="Terminar" danger onOk=${() => ctx.r({ r: 'lobby' })} onClose=${() => setSheet(null)} />`}
    ${sheet === 'close' && html`<${Confirm} title="¿Cerrar la sala?" text="Se borra todo y los jugadores tendrán que entrar en una sala nueva." ok="Cerrar sala" danger onOk=${() => (host.close(), setTimeout(() => go({}), 900))} onClose=${() => setSheet(null)} />`}
    ${sheet === 'leave' && html`<${Confirm} title="¿Salir de la sala?" text="Podrás volver a entrar como jugador nuevo." ok="Salir" danger onOk=${() => (client.leave(), go({}))} onClose=${() => setSheet(null)} />`}
  </div>`;
}

// ---------- arranque ----------
async function main() {
  const root = document.getElementById('app');
  const adminCode = normCode(params.get('admin'));
  const salaCode = normCode(params.get('sala'));

  // Si el admin escanea su propio QR, le llevamos a su sala.
  if (salaCode && savedHost(salaCode)) return go({ admin: salaCode });

  let client = null;
  let host = null;
  let speaker = null;
  if (adminCode) {
    host = Host.load(adminCode, brokers);
    if (!host) {
      render(
        html`<main class="card center"><h2>Esta sala no está en este dispositivo</h2>
          <p class="muted">Solo el móvil que creó la sala puede administrarla.</p>
          <a class="btn primary big" href="./">Ir al inicio</a></main>`,
        root,
      );
      return;
    }
    await host.start();
    client = new LocalClient(host);
    speaker = new Speaker(() => client._emit());
    addEventListener('pagehide', () => host.saveNow());
    window.__host = host;
  } else if (salaCode) {
    client = new RemoteClient(salaCode, brokers);
    client.connect();
    if (client.id) store.set(`mj-p-${salaCode}`, { ...client.id, at: Date.now() });
    window.__client = client;
  }

  const onInteract = () => {
    speaker?.unlock();
    keepAwake();
  };
  addEventListener('pointerdown', onInteract, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      client?.wake();
      keepAwake();
    }
  });
  addEventListener('online', () => client?.wake());

  render(client ? html`<${Room} client=${client} host=${host} speaker=${speaker} />` : html`<${Home} />`, root);
}

main().catch((e) => {
  console.error(e);
  document.getElementById('app').innerHTML =
    '<main class="card center"><h2>Algo ha fallado al cargar</h2><p>Recarga la página.</p></main>';
});
