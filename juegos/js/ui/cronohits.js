import { html, useState, useEffect } from '../../vendor/standalone.module.js';
import { Name, Sheet, cls } from './common.js';

const MODE = { original: 'Original', pro: 'Pro', expert: 'Experto' };

function Timeline({ line, select, selected, onSelect, marks = {}, blocked = [] }) {
  const Gap = ({ i }) => {
    const mark = marks[i];
    const can = select && !blocked.includes(i);
    if (!can && !mark) return html`<div class="gap-line"></div>`;
    return html`<button class=${cls('tgap', selected === i && 'sel', mark && 'marked')} disabled=${!can} onClick=${() => can && onSelect(i)}>
      ${mark || (selected === i ? '🎵 Aquí' : '＋')}
    </button>`;
  };
  return html`<div class="timeline">
    ${Gap({ i: 0 })}
    ${line.map(
      (c, i) => html`<div key=${i} class="tl-item">
        <div class="tcard"><div class="tyear">${c.year}</div><div class="tinfo"><b>${c.title}</b><span>${c.artist}</span></div></div>
        ${Gap({ i: i + 1 })}
      </div>`,
    )}
  </div>`;
}

export function CronohitsUI({ ctx, g, speaker }) {
  const { me, admin } = ctx;
  const [gap, setGap] = useState(null);
  const [look, setLook] = useState(null);
  const isActive = me === g.active;
  const playing = g.seats.includes(me);
  const activeLine = g.lines[g.active] || [];
  useEffect(() => setGap(null), [g.turnNo, g.phase]);

  const takenGaps = g.challenges.map((c) => c.gap);
  const marks = {};
  if (g.placed !== null) marks[g.placed] = `🎵 ${ctx.players[g.active]?.name}`;
  for (const c of g.challenges) marks[c.gap] = `⚔️ ${ctx.players[c.pid]?.name}`;

  let main;
  if (g.phase === 'over') {
    main = html`<div class="banner gold">
      <h2>🏆 ${g.winners.map((p) => ctx.players[p]?.name).join(' y ')} ${g.winners.length > 1 ? 'ganan' : 'gana'}!</h2>
      <p>${g.reason === 'deck' ? 'Se acabaron las canciones.' : `Primera línea con ${g.target} canciones.`}</p>
      ${admin && html`<button class="btn primary big" onClick=${() => ctx.r({ r: 'restart' })}>Jugar otra vez</button>`}
    </div>`;
  } else if (g.phase === 'listen') {
    main = isActive
      ? html`<div>
          <h3>Tu turno: ¿de qué año es?</h3>
          <p class="small muted">Elige el hueco de tu línea donde va la canción. Si dices título y artista en voz alta, ganas una ficha.</p>
          <${Timeline} line=${g.lines[me]} select selected=${gap} onSelect=${setGap} />
          <button class="btn primary big" disabled=${gap === null} onClick=${() => ctx.g({ t: 'place', gap, turnNo: g.turnNo })}>Colocar aquí</button>
          <div class="row gap">
            <button class="btn ghost grow" disabled=${g.tokens[me] < 1} onClick=${() => ctx.g({ t: 'skip', turnNo: g.turnNo })}>⏭ Saltar (1 🪙)</button>
            <button class="btn ghost grow" disabled=${g.tokens[me] < 3} onClick=${() => ctx.g({ t: 'buy', turnNo: g.turnNo })}>🎁 Comprar carta (3 🪙)</button>
          </div>
        </div>`
      : html`<div>
          <h3><${Name} ctx=${ctx} pid=${g.active} /> está colocando la canción…</h3>
          <p class="small muted">Prepárate para retar si crees que se equivoca.</p>
          <${Timeline} line=${activeLine} />
        </div>`;
  } else if (g.phase === 'challenge') {
    const iCan = !isActive && g.pending.includes(me);
    main = html`<div>
      <h3>¿Alguien reta? <span class="muted small">(${g.pending.length} por decidir)</span></h3>
      ${iCan
        ? html`<p class="small">Si crees que <b>${ctx.players[g.active]?.name}</b> se equivoca, elige otro hueco (cuesta 1 🪙). Si aciertas tú, te la llevas.</p>
            <${Timeline} line=${activeLine} select selected=${gap} onSelect=${setGap} marks=${marks} blocked=${[g.placed, ...takenGaps]} />
            <div class="row gap">
              <button class="btn ghost grow" onClick=${() => ctx.g({ t: 'pass', turnNo: g.turnNo })}>No reto</button>
              <button class="btn primary grow" disabled=${gap === null} onClick=${() => ctx.g({ t: 'challenge', gap, turnNo: g.turnNo })}>⚔️ Retar aquí (1 🪙)</button>
            </div>`
        : html`<${Timeline} line=${activeLine} marks=${marks} />
            <p class="small muted center">Esperando a: ${g.pending.map((p) => ctx.players[p]?.name).join(', ') || '—'}</p>`}
      ${(isActive || admin) && html`<button class="btn ghost" onClick=${() => ctx.g({ t: 'reveal', turnNo: g.turnNo })}>Revelar ya</button>`}
    </div>`;
  } else if (g.phase === 'reveal') {
    const o = g.outcome;
    const needName = g.mode !== 'original';
    main = html`<div>
      <div class="reveal-card">
        <div class="ryear">${g.current.year}</div>
        <div class="rtitle">${g.current.title}</div>
        <div class="rartist">${g.current.artist}</div>
      </div>
      <p class="center">
        ${o.placementOk ? html`✅ <b>${ctx.players[g.active]?.name}</b> la colocó bien.` : html`❌ <b>${ctx.players[g.active]?.name}</b> falló el hueco.`}
        ${needName && o.placementOk && !o.activeKeeps ? html`<br />Falta confirmar ${g.mode === 'expert' ? 'título, artista y año exacto' : 'título y artista'}.` : ''}
        ${o.activeKeeps ? html`<br />Se queda la carta.` : o.challengerWins ? html`<br />⚔️ Se la lleva <b>${ctx.players[o.challengerWins]?.name}</b>.` : html`<br />Nadie se la queda.`}
      </p>
      <${Timeline} line=${activeLine} marks=${marks} />
      ${!isActive && playing
        ? html`<div class="judge card">
            <b>¿${ctx.players[g.active]?.name} dijo título y artista antes de revelar?</b>
            <div class="row gap">
              <button class=${cls('btn grow', g.named === true && 'primary')} onClick=${() => ctx.g({ t: 'judge', field: 'name', value: true, turnNo: g.turnNo })}>Sí${g.mode === 'original' ? ' (+1 🪙)' : ''}</button>
              <button class=${cls('btn grow', g.named === false && 'primary')} onClick=${() => ctx.g({ t: 'judge', field: 'name', value: false, turnNo: g.turnNo })}>No</button>
            </div>
            ${g.mode === 'expert' &&
            html`<b>¿Y el año exacto?</b>
              <div class="row gap">
                <button class=${cls('btn grow', g.yearOk === true && 'primary')} onClick=${() => ctx.g({ t: 'judge', field: 'year', value: true, turnNo: g.turnNo })}>Sí</button>
                <button class=${cls('btn grow', g.yearOk === false && 'primary')} onClick=${() => ctx.g({ t: 'judge', field: 'year', value: false, turnNo: g.turnNo })}>No</button>
              </div>`}
          </div>`
        : html`<p class="center small muted">${g.named === true ? 'Los demás confirman que dijiste título y artista. +1 🪙' : 'Los demás confirman si dijiste título y artista.'}</p>`}
      ${(isActive || admin) && html`<button class="btn primary big" onClick=${() => ctx.g({ t: 'next', turnNo: g.turnNo })}>Siguiente turno</button>`}
    </div>`;
  }

  return html`<div class="cro">
    <div class="row between small muted"><span>Modo ${MODE[g.mode]} · Meta: ${g.target} canciones</span><span>Quedan ${g.deckCount}</span></div>
    ${admin ? html`<${SpeakerPanel} ctx=${ctx} g=${g} speaker=${speaker} />` : g.phase !== 'over' && html`<div class="speaker-mini small"><span>🔊 Suena en el móvil de <b>${ctx.players[ctx.view.adminPid]?.name}</b></span>
          <button class="btn small ghost" onClick=${() => ctx.g({ t: 'replay' })}>Repetir</button></div>`}
    ${g.last?.k === 'buy' && html`<p class="small center">🎁 <${Name} ctx=${ctx} pid=${g.last.pid} /> compró «${g.last.song.title}» (${g.last.song.year}).</p>`}
    ${g.last?.k === 'result' && g.phase === 'listen' && html`<p class="small center muted">Anterior: «${g.last.song.title}» · ${g.last.song.artist} (${g.last.song.year})</p>`}
    <section class="card">${main}</section>
    <section class="card">
      <h3>Marcador</h3>
      <ul class="score">
        ${g.seats.map(
          (p) => html`<li key=${p} class=${cls(p === g.active && 'active')} onClick=${() => setLook(p)}>
            <${Name} ctx=${ctx} pid=${p} dot />
            <span class="grow"></span>
            <span title="Fichas">${'🪙'.repeat(g.tokens[p])}<span class="muted">${'·'.repeat(Math.max(0, g.maxTokens - g.tokens[p]))}</span></span>
            <b class="cards-n">${g.lines[p].length}/${g.target}</b>
          </li>`,
        )}
      </ul>
      <p class="small muted">Toca un jugador para ver su línea.</p>
    </section>
    ${playing && !(isActive && g.phase === 'listen') && html`<details class="card"><summary>Mi línea (${g.lines[me].length})</summary><${Timeline} line=${g.lines[me]} /></details>`}
    ${look &&
    html`<${Sheet} title=${`Línea de ${ctx.players[look]?.name}`} onClose=${() => setLook(null)}>
      <${Timeline} line=${g.lines[look] || []} />
      ${admin &&
      html`<div class="row gap center-v"><span class="grow">Fichas: ${g.tokens[look]}</span>
        <button class="btn small ghost" onClick=${() => ctx.g({ t: 'tokens', target: look, delta: -1 })}>− 🪙</button>
        <button class="btn small ghost" onClick=${() => ctx.g({ t: 'tokens', target: look, delta: 1 })}>+ 🪙</button></div>`}
    </${Sheet}>`}
  </div>`;
}

function SpeakerPanel({ ctx, g, speaker }) {
  const st = speaker.state;
  if (g.phase === 'over') return null;
  const label = {
    idle: 'Altavoz listo',
    loading: 'Buscando la canción…',
    playing: '🔊 Sonando',
    paused: '⏸ En pausa',
    blocked: 'Toca ▶ para que suene',
    missing: 'Canción no disponible, cambiando…',
  }[st];
  return html`<div class=${cls('speaker card', st === 'blocked' && 'attention')}>
    <div class="grow"><b>Altavoz (este móvil)</b><div class="small muted">${label}. Sube el volumen o conéctalo a un altavoz.</div></div>
    <button class="icon-btn big" aria-label="Reproducir o pausar" onClick=${() => (speaker.unlock(), speaker.toggle())}>${st === 'playing' ? '⏸' : '▶'}</button>
    <button class="icon-btn big" aria-label="Repetir desde el principio" onClick=${() => (speaker.unlock(), ctx.g({ t: 'replay' }))}>🔁</button>
    ${g.phase === 'listen' && html`<button class="icon-btn big" aria-label="No suena: cambiar canción" title="No suena: cambiar canción" onClick=${() => ctx.g({ t: 'unavailable', song: ctx.nowPlayingIdx })}>⏭</button>`}
  </div>`;
}
