import { html, useState } from '../../vendor/standalone.module.js';
import { Name, Confirm, cls } from './common.js';

const TN = { r: 'Rojo', b: 'Azul' };
const COLOR_NAME = { r: 'agente rojo', b: 'agente azul', n: 'civil', a: 'ASESINO' };

export function PalabrasUI({ ctx, g }) {
  if (g.phase === 'teams') return html`<${Teams} ctx=${ctx} g=${g} />`;
  return html`<${Board} ctx=${ctx} g=${g} />`;
}

function Teams({ ctx, g }) {
  const { me, admin } = ctx;
  const mine = g.team[me];
  return html`<div class="pal">
    <p class="muted center">Elegid equipo y un jefe de espías por equipo. El admin empieza cuando esté listo.</p>
    <div class="teams">
      ${['r', 'b'].map(
        (t) => html`<section key=${t} class=${cls('card team', 'team-' + t)}>
          <h2>Equipo ${TN[t]}</h2>
          <ul class="plain">
            ${g.players
              .filter((p) => g.team[p] === t)
              .map(
                (p) => html`<li key=${p}>
                  ${g.spy[t] === p ? '🕶️ ' : ''}<${Name} ctx=${ctx} pid=${p} dot />
                  ${admin &&
                  html` <button class="icon-btn" title="Cambiar de equipo" onClick=${() => ctx.g({ t: 'team', team: t === 'r' ? 'b' : 'r', target: p })}>⇄</button>
                    ${g.spy[t] !== p && html`<button class="icon-btn" title="Hacer jefe" onClick=${() => ctx.g({ t: 'spy', team: t, target: p })}>🕶️</button>`}`}
                </li>`,
              )}
          </ul>
          <div class="muted small">Jefe de espías: ${g.spy[t] ? html`<${Name} ctx=${ctx} pid=${g.spy[t]} />` : '—'}</div>
          <div class="col gap-s">
            ${mine !== t && html`<button class="btn small" onClick=${() => ctx.g({ t: 'team', team: t })}>Unirme al ${TN[t]}</button>`}
            ${mine === t && g.spy[t] !== me && !g.spy[t] && html`<button class="btn small" onClick=${() => ctx.g({ t: 'spy', team: t })}>Ser jefe de espías</button>`}
            ${g.spy[t] === me && html`<button class="btn small ghost" onClick=${() => ctx.g({ t: 'unspy' })}>Dejar de ser jefe</button>`}
          </div>
        </section>`,
      )}
    </div>
    ${admin &&
    html`<div class="col gap-s">
      <button class="btn ghost" onClick=${() => ctx.g({ t: 'shuffle' })}>🔀 Equipos y jefes al azar</button>
      <button class="btn primary big" onClick=${() => ctx.g({ t: 'start' })}>Repartir tablero</button>
    </div>`}
    <${Score} g=${g} />
  </div>`;
}

function Score({ g }) {
  if (!g.score.r && !g.score.b) return null;
  return html`<p class="center muted small">Marcador de la noche: <b class="t-r">Rojo ${g.score.r}</b> · <b class="t-b">Azul ${g.score.b}</b></p>`;
}

// Tamaño de letra para que cada palabra quepa en una línea, sea cual sea el móvil.
function fontStyle(w) {
  const n = Math.max(w.length, 5);
  return `font-size: min(17px, calc((min(100vw, 720px) - 64px) / ${(5 * 0.7 * n).toFixed(2)}))`;
}

function Board({ ctx, g }) {
  const { me, admin } = ctx;
  const [pick, setPick] = useState(null);
  const myTurn = g.myTeam === g.turn;
  const canGuess = g.phase === 'guess' && myTurn && !g.isSpy;
  const canClue = g.phase === 'clue' && myTurn && g.isSpy;
  const over = g.phase === 'over';

  return html`<div class=${cls('pal', g.isSpy && 'spyview')}>
    <div class="pal-top">
      <div class=${cls('count t-r', g.turn === 'r' && !over && 'now')}>${g.left.r}</div>
      <div class="pal-status">
        ${over
          ? html`<b class=${'t-' + g.winner}>¡Gana el equipo ${TN[g.winner]}!</b>
              <div class="small muted">${g.reason === 'assassin' ? 'El otro equipo encontró al asesino' : 'Todos sus agentes descubiertos'}</div>`
          : g.phase === 'clue'
            ? html`<b class=${'t-' + g.turn}>Turno ${TN[g.turn]}</b><div class="small muted">El jefe <${Name} ctx=${ctx} pid=${g.spy[g.turn]} /> está pensando la pista…</div>`
            : html`<div class="clue"><span class=${'t-' + g.turn}>${g.clue.word}</span> <span class="num">${g.clue.num}</span></div>
                <div class="small muted">${g.guessesLeft === null ? 'Intentos sin límite' : `Quedan ${g.guessesLeft - g.guessed} intentos`}</div>`}
      </div>
      <div class=${cls('count t-b', g.turn === 'b' && !over && 'now')}>${g.left.b}</div>
    </div>

    <div class="you-are small center">
      ${g.myTeam
        ? html`Eres del <b class=${'t-' + g.myTeam}>${TN[g.myTeam]}</b>${g.isSpy ? ' · jefe de espías 🕶️ (solo tú ves los colores)' : ' · agente'}`
        : html`<span class="muted">Estás mirando</span>`}
    </div>

    <div class="grid5" role="grid">
      ${g.words.map((w, i) => {
        const c = g.colors[i];
        const rev = g.revealed[i];
        return html`<button key=${i}
          style=${fontStyle(w)}
          class=${cls('wcard', rev && 'rev', c && 'c-' + c, g.lastReveal?.i === i && 'last')}
          disabled=${!canGuess || rev}
          onClick=${() => setPick(i)}>
          <span>${w}</span>
        </button>`;
      })}
    </div>

    ${canClue && html`<${ClueForm} ctx=${ctx} g=${g} />`}
    ${canGuess &&
    html`<div class="col gap-s">
      <p class="center small">Debatid y tocad una palabra.</p>
      <button class="btn ghost" disabled=${g.guessed < 1} onClick=${() => ctx.g({ t: 'pass', turnNo: g.turnNo })}>
        Terminar turno${g.guessed < 1 ? ' (toca al menos 1)' : ''}
      </button>
    </div>`}
    ${!over && !canClue && !canGuess && g.phase === 'guess' && html`<p class="center muted small">Adivina el equipo ${TN[g.turn]}…</p>`}

    ${over &&
    admin &&
    html`<div class="col gap-s">
      <button class="btn primary big" onClick=${() => ctx.g({ t: 'again' })}>Otra partida (mismos equipos)</button>
      <button class="btn ghost" onClick=${() => ctx.g({ t: 'again', toTeams: true })}>Cambiar equipos</button>
    </div>`}

    <${Score} g=${g} />
    <${Log} ctx=${ctx} g=${g} />

    ${pick !== null &&
    html`<${Confirm} title=${`¿Tocar "${g.words[pick]}"?`} ok="Sí, revelar" onOk=${() => ctx.g({ t: 'guess', i: pick, turnNo: g.turnNo })} onClose=${() => setPick(null)} />`}
  </div>`;
}

function ClueForm({ ctx, g }) {
  const [word, setWord] = useState('');
  const [num, setNum] = useState(1);
  const submit = (e) => {
    e.preventDefault();
    if (!word.trim()) return;
    ctx.g({ t: 'clue', word: word.trim(), num, turnNo: g.turnNo });
  };
  return html`<form class="card clue-form" onSubmit=${submit}>
    <b>Tu pista</b>
    <input class="input" placeholder="Una sola palabra" value=${word} maxlength="30" autocomplete="off" autocapitalize="characters"
      onInput=${(e) => setWord(e.target.value.replace(/\s/g, ''))} />
    <div class="nums">
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, '∞'].map(
        (n) => html`<button type="button" key=${n} class=${cls('numb', num === n && 'sel')} onClick=${() => setNum(n)}>${n}</button>`,
      )}
    </div>
    <button class="btn primary big" type="submit" disabled=${!word.trim()}>Dar pista: ${word.toUpperCase() || '…'} · ${num}</button>
  </form>`;
}

function Log({ ctx, g }) {
  if (!g.log.length) return null;
  return html`<details class="card log">
    <summary>Historial de pistas (${g.log.length})</summary>
    <ul class="plain">
      ${g.log
        .slice()
        .reverse()
        .map(
          (l, k) => html`<li key=${k}>
            <b class=${'t-' + l.team}>${l.word} ${l.num}</b>:
            ${l.guesses.length ? l.guesses.map((x, j) => html`<span key=${j} class=${'chip c-' + x.color}>${g.words[x.i]}</span>`) : html`<span class="muted">—</span>`}
          </li>`,
        )}
    </ul>
    <p class="small muted">Colores: ${Object.entries(COLOR_NAME).map(([k, v]) => html`<span class=${'chip c-' + k}>${v}</span>`)}</p>
  </details>`;
}
