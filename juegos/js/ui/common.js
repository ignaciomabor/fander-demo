import { html, useState, useEffect } from '../../vendor/standalone.module.js';

export { html };

export function cls(...a) {
  return a.filter(Boolean).join(' ');
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return html`<div class="sheet-bg" onClick=${(e) => e.target === e.currentTarget && onClose?.()}>
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-head">
        <h3>${title}</h3>
        ${onClose && html`<button class="icon-btn" aria-label="Cerrar" onClick=${onClose}>✕</button>`}
      </div>
      <div class="sheet-body">${children}</div>
    </div>
  </div>`;
}

/** Confirmación de dos pasos: evita toques accidentales en jugadas importantes. */
export function Confirm({ title, text, ok = 'Confirmar', danger, onOk, onClose }) {
  return html`<${Sheet} title=${title} onClose=${onClose}>
    ${text && html`<p class="muted">${text}</p>`}
    <div class="row gap">
      <button class="btn ghost grow" onClick=${onClose}>Cancelar</button>
      <button class=${cls('btn grow', danger ? 'danger' : 'primary')} onClick=${() => (onOk(), onClose())}>${ok}</button>
    </div>
  </${Sheet}>`;
}

export function Toasts({ items }) {
  return html`<div class="toasts" aria-live="polite">
    ${items.map((t) => html`<div class="toast" key=${t.id}>${t.msg}</div>`)}
  </div>`;
}

export function Dot({ on }) {
  return html`<span class=${cls('dot', on ? 'on' : 'off')} title=${on ? 'Conectado' : 'Desconectado'}></span>`;
}

export function Name({ ctx, pid, dot }) {
  const p = ctx.players[pid];
  if (!p) return html`<span class="muted">¿?</span>`;
  return html`<span class="pname">${dot && html`<${Dot} on=${p.on} />`}${p.name}${pid === ctx.me ? html`<small> (tú)</small>` : ''}</span>`;
}

/** Hook: estado guardado en el navegador (p. ej. "ya he visto mi rol"). */
export function useLocal(key, def) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s === null ? def : JSON.parse(s);
    } catch {
      return def;
    }
  });
  const set = (x) => {
    setV(x);
    try {
      localStorage.setItem(key, JSON.stringify(x));
    } catch {
      /* nada */
    }
  };
  return [v, set];
}

export function Rules({ game, onClose }) {
  return html`<${Sheet} title=${`Reglas · ${game.name}`} onClose=${onClose}>
    <div class="rules">${RULES[game.id]}</div>
  </${Sheet}>`;
}

const RULES = {
  palabras: html`
    <p><b>Objetivo:</b> que tu equipo descubra a todos sus agentes antes que el rival.</p>
    <ul>
      <li>Dos equipos (Rojo y Azul). Cada uno tiene un <b>jefe de espías</b>, que ve qué palabra es de quién.</li>
      <li>El equipo que empieza tiene 9 agentes; el otro, 8. Hay 7 civiles y 1 <b>asesino</b>.</li>
      <li>En su turno, el jefe da <b>una palabra y un número</b>: cuántas palabras del tablero están relacionadas.
        No puede decir nada más ni hacer gestos. No vale una palabra visible del tablero.</li>
      <li>Su equipo debate y toca palabras una a una. Hay que tocar al menos una. Se pueden hacer hasta
        <b>número + 1</b> intentos (con 0 o ∞, sin límite).</li>
      <li>Agente propio: seguís. Civil o agente rival: se acaba el turno. <b>Asesino: perdéis</b>.</li>
      <li>Gana el equipo que tenga todos sus agentes descubiertos, aunque los descubra el rival.</li>
    </ul>
    <p class="muted">Mínimo 4 jugadores (2 por equipo).</p>`,
  tirano: html`
    <p><b>Bandos:</b> los <b>Leales</b> (mayoría) contra los <b>Conspiradores</b> y su líder secreto, <b>el Tirano</b>.</p>
    <ul>
      <li>Los conspiradores se conocen entre sí y saben quién es el Tirano. El Tirano solo sabe quiénes son
        sus aliados si sois 5 o 6. Los leales no saben nada.</li>
      <li><b>Elecciones:</b> el candidato a Presidente (va rotando) elige Canciller. No pueden ser Canciller el último
        Presidente ni el último Canciller elegidos (con 5 vivos, solo el último Canciller). Todos votan Sí/No a la vez:
        sale si hay más síes que noes.</li>
      <li>3 gobiernos rechazados seguidos: se aprueba automáticamente la ley de arriba del mazo (sin poder).</li>
      <li><b>Legislar:</b> el Presidente roba 3 leyes y descarta 1 en secreto; el Canciller descarta 1 y aprueba la otra.
        Prohibido enseñar las cartas. Se puede mentir.</li>
      <li><b>Poderes:</b> algunas leyes conspiradoras dan un poder al Presidente (investigar, elección especial,
        ver leyes o ejecutar). Con 5 leyes conspiradoras se desbloquea el <b>veto</b>.</li>
      <li><b>Ganan los Leales</b> con 5 leyes leales o ejecutando al Tirano.</li>
      <li><b>Ganan los Conspiradores</b> con 6 leyes conspiradoras o si el Tirano es elegido Canciller cuando ya hay
        3 o más leyes conspiradoras.</li>
    </ul>
    <p class="muted">5 a 10 jugadores. Mecánica basada en un juego publicado bajo licencia CC BY-NC-SA 4.0.</p>`,
  cronohits: html`
    <p><b>Objetivo:</b> ser el primero en tener 10 canciones bien ordenadas por año en tu línea temporal.</p>
    <ul>
      <li>Cada uno empieza con una canción descubierta y 2 fichas.</li>
      <li>En tu turno suena una canción (en el móvil del admin). Colócala en tu línea: antes, después o entre tus canciones.</li>
      <li>Los demás pueden <b>retarte</b> pagando 1 ficha: eligen otro hueco de tu línea. Si fallas y un retador
        acierta, se la queda él.</li>
      <li>Se revela el año. Si acertaste, te la quedas. Si no, se descarta (o se la lleva el retador).</li>
      <li>Si dijiste <b>título y artista</b> antes de revelar, ganas 1 ficha (máx. 5). Lo confirman los demás.</li>
      <li>Fichas: 1 para <b>saltar</b> una canción · 3 para <b>comprar</b> una carta que se coloca sola.</li>
      <li>Modo Pro: además hay que acertar título y artista. Modo Experto: además el año exacto.</li>
    </ul>`,
};
