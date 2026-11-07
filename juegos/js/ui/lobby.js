import { html, useState } from '../../vendor/standalone.module.js';
import { GAME_LIST, GAMES } from '../games/index.js';
import { Sheet, Confirm, Dot, Rules, cls } from './common.js';

export function joinUrl(code) {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('sala', code);
  const b = new URLSearchParams(location.search).get('brokers');
  if (b) u.searchParams.set('brokers', b);
  return u.toString();
}

export function QR({ text, size = 220 }) {
  const qr = globalThis.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = Math.max(2, Math.floor(size / (n + 4)));
  return html`<div class="qr" dangerouslySetInnerHTML=${{ __html: qr.createSvgTag({ cellSize: cell, margin: cell * 2, scalable: true }) }}></div>`;
}

export function Invite({ code, compact }) {
  const url = joinUrl(code);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (navigator.share && compact !== 'copy') {
        await navigator.share({ title: 'Únete a la partida', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* cancelado */
    }
  };
  return html`<div class="invite">
    <${QR} text=${url} />
    <div class="code-big" aria-label="Código de sala">${code}</div>
    <p class="muted small">Escanead el QR con la cámara o entrad en la web y poned el código.</p>
    <button class="btn ghost" onClick=${copy}>${copied ? '¡Copiado!' : 'Compartir enlace'}</button>
  </div>`;
}

export function Lobby({ ctx }) {
  const { view, admin } = ctx;
  const [rules, setRules] = useState(null);
  const [kick, setKick] = useState(null);
  const [rename, setRename] = useState(false);
  const selected = GAMES[view.selected];
  const playing = view.players.filter((p) => p.plays).length;

  return html`<div class="lobby">
    ${admin && html`<section class="card"><${Invite} code=${view.code} /></section>`}

    <section class="card">
      <div class="row between">
        <h2>Jugadores <span class="muted">(${view.players.length})</span></h2>
        <button class="btn small ghost" onClick=${() => setRename(true)}>Cambiar mi nombre</button>
      </div>
      ${admin && html`<p class="muted small">El orden de la lista es el orden de la mesa (importa en El Tirano Oculto y Cronohits).</p>`}
      <ol class="plist">
        ${view.players.map(
          (p, i) => html`<li key=${p.pid} class=${cls(!p.plays && 'sitout')}>
            <span class="pname"><${Dot} on=${p.on} />${p.name}${p.pid === view.adminPid ? html` <span class="badge">admin</span>` : ''}${p.pid === ctx.me ? html`<small> (tú)</small>` : ''}</span>
            ${!p.plays && html`<span class="badge muted">no juega</span>`}
            ${admin &&
            html`<span class="ctrls">
              <button class="icon-btn" aria-label="Subir" disabled=${i === 0} onClick=${() => ctx.r({ r: 'move', target: p.pid, dir: -1 })}>↑</button>
              <button class="icon-btn" aria-label="Bajar" disabled=${i === view.players.length - 1} onClick=${() => ctx.r({ r: 'move', target: p.pid, dir: 1 })}>↓</button>
              <button class="icon-btn" aria-label=${p.plays ? 'Quitar de la partida' : 'Meter en la partida'} title=${p.plays ? 'Juega' : 'No juega'} onClick=${() => ctx.r({ r: 'plays', target: p.pid, value: !p.plays })}>${p.plays ? '🎮' : '💤'}</button>
              ${p.pid !== view.adminPid && html`<button class="icon-btn" aria-label="Expulsar" onClick=${() => setKick(p)}>✕</button>`}
            </span>`}
          </li>`,
        )}
      </ol>
    </section>

    <section class="card">
      <h2>${admin ? 'Elige juego' : 'Juego'}</h2>
      <div class="games">
        ${GAME_LIST.map(
          (g) => html`<div key=${g.id} class=${cls('game-tile', view.selected === g.id && 'sel', !admin && view.selected !== g.id && 'dim')}
              onClick=${() => admin && ctx.r({ r: 'select', kind: g.id })} role=${admin ? 'button' : undefined}>
            <div class="game-emoji">${g.emoji}</div>
            <div class="grow">
              <b>${g.name}</b>
              <div class="muted small">${g.tagline}</div>
              <div class="muted small">${g.min}–${g.max} jugadores</div>
            </div>
            <button class="btn small ghost" onClick=${(e) => (e.stopPropagation(), setRules(g))}>Reglas</button>
          </div>`,
        )}
      </div>
      ${selected.options.length > 0 &&
      html`<div class="opts">
        ${selected.options.map((o) => {
          const val = view.opts?.[selected.id]?.[o.key] ?? o.def;
          return html`<label class="opt" key=${o.key}>
            <span>${o.label}</span>
            <select disabled=${!admin} value=${String(val)} onChange=${(e) => ctx.r({ r: 'opt', kind: selected.id, key: o.key, value: e.target.value })}>
              ${o.choices.map((c) => html`<option value=${String(c)}>${o.labels?.[c] ?? c}</option>`)}
            </select>
          </label>`;
        })}
      </div>`}
      ${admin
        ? html`<button class="btn primary big" disabled=${playing < selected.min || playing > selected.max} onClick=${() => ctx.r({ r: 'start' })}>
              Empezar ${selected.name} (${playing})
            </button>
            ${playing < selected.min && html`<p class="muted small center">Faltan ${selected.min - playing} jugadores.</p>`}
            ${playing > selected.max && html`<p class="muted small center">Sobran ${playing - selected.max}: marca a alguien como "no juega" (💤).</p>`}`
        : html`<p class="center muted">Esperando a que el admin empiece la partida…</p>`}
    </section>

    ${rules && html`<${Rules} game=${rules} onClose=${() => setRules(null)} />`}
    ${kick && html`<${Confirm} title=${`¿Expulsar a ${kick.name}?`} ok="Expulsar" danger onOk=${() => ctx.r({ r: 'kick', target: kick.pid })} onClose=${() => setKick(null)} />`}
    ${rename && html`<${Rename} ctx=${ctx} onClose=${() => setRename(false)} />`}
  </div>`;
}

function Rename({ ctx, onClose }) {
  const [name, setName] = useState(ctx.players[ctx.me]?.name || '');
  return html`<${Sheet} title="Cambiar mi nombre" onClose=${onClose}>
    <form onSubmit=${(e) => (e.preventDefault(), name.trim() && (ctx.r({ r: 'rename', name }), onClose()))}>
      <input class="input" value=${name} maxlength="18" onInput=${(e) => setName(e.target.value)} autofocus />
      <button class="btn primary big" type="submit">Guardar</button>
    </form>
  </${Sheet}>`;
}
