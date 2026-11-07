import { html, useState } from '../../vendor/standalone.module.js';
import { Name, Confirm, Sheet, useLocal, cls } from './common.js';
import { POWER_NAME } from '../games/tirano.js';

const ROLE = {
  L: { t: 'Leal', d: 'Ganas con 5 leyes leales o ejecutando al Tirano.', cls: 'r-l' },
  F: { t: 'Conspirador', d: 'Ganas con 6 leyes conspiradoras o si el Tirano es elegido Canciller tras 3. Protege al Tirano.', cls: 'r-f' },
  T: { t: 'El Tirano', d: 'Eres el líder de los conspiradores. Que nadie lo sepa: intenta llegar a Canciller.', cls: 'r-f' },
};
const PARTY = { L: 'Leal', F: 'Conspirador' };
const POL = { L: 'Ley leal', F: 'Ley conspiradora' };
const POWER_ICON = { investigate: '🔍', special: '🗳️', peek: '👁️', execute: '💀' };

export function TiranoUI({ ctx, g }) {
  const [seen, setSeen] = useLocal(`mj-role-${ctx.code}-${ctx.gameStarted}`, false);
  const [showRole, setShowRole] = useState(false);
  if (!g.role) return html`<div class="tir"><p class="center muted">Estás mirando esta partida.</p><${Boards} g=${g} /><${Seats} ctx=${ctx} g=${g} /><${Log} ctx=${ctx} g=${g} /></div>`;
  if (!seen) return html`<${RoleCard} ctx=${ctx} g=${g} onOk=${() => setSeen(true)} first />`;
  return html`<div class="tir">
    <${Boards} g=${g} />
    <${Phase} ctx=${ctx} g=${g} />
    <${Seats} ctx=${ctx} g=${g} />
    <${Private} ctx=${ctx} g=${g} />
    <button class="btn ghost" onClick=${() => setShowRole(true)}>🤫 Ver mi rol</button>
    <${Log} ctx=${ctx} g=${g} />
    ${showRole && html`<${Sheet} title="Tu rol secreto" onClose=${() => setShowRole(false)}><${RoleInfo} ctx=${ctx} g=${g} /></${Sheet}>`}
  </div>`;
}

function RoleInfo({ ctx, g }) {
  const r = ROLE[g.role];
  return html`<div class=${cls('role', r.cls)}>
    <div class="role-name">${r.t}</div>
    <p>${r.d}</p>
    ${g.know.length > 0 &&
    html`<div class="know">
      <b>${g.role === 'T' ? 'Tus conspiradores:' : 'Tu bando:'}</b>
      <ul class="plain">${g.know.map((k) => html`<li key=${k.pid}><${Name} ctx=${ctx} pid=${k.pid} /> — ${k.role === 'T' ? 'el Tirano' : 'conspirador'}</li>`)}</ul>
    </div>`}
    ${g.role === 'T' && g.know.length === 0 && html`<p class="muted small">Con 7 o más jugadores el Tirano no sabe quiénes son sus aliados (ellos sí te conocen).</p>`}
    <p class="muted small">Miembro del partido: <b>${PARTY[g.role === 'L' ? 'L' : 'F']}</b> (es lo que vería quien te investigue).</p>
  </div>`;
}

function RoleCard({ ctx, g, onOk }) {
  const [open, setOpen] = useState(false);
  return html`<div class="tir center">
    <h2>Tu rol secreto</h2>
    <p class="muted">Que nadie vea tu pantalla.</p>
    ${open
      ? html`<${RoleInfo} ctx=${ctx} g=${g} /><button class="btn primary big" onClick=${onOk}>Entendido, ocultar</button>`
      : html`<button class="btn primary big" onClick=${() => setOpen(true)}>Mostrar mi rol</button>`}
  </div>`;
}

function Boards({ g }) {
  return html`<div class="boards">
    <div class="track lib">
      <div class="track-name">Leales</div>
      <div class="slots">${[0, 1, 2, 3, 4].map((i) => html`<div key=${i} class=${cls('slot', i < g.lib && 'on')}>${i === 4 ? '🏆' : ''}</div>`)}</div>
    </div>
    <div class="track fas">
      <div class="track-name">Conspiradores</div>
      <div class="slots">
        ${[0, 1, 2, 3, 4, 5].map((i) => html`<div key=${i} class=${cls('slot', i < g.fas && 'on')} title=${g.powers[i] ? POWER_NAME[g.powers[i]] : ''}>${i === 5 ? '🏆' : POWER_ICON[g.powers[i]] || ''}</div>`)}
      </div>
      ${g.fas >= 3 && html`<div class="small warn">⚠️ Si eligen al Tirano como Canciller, ganan los conspiradores.</div>`}
      ${g.vetoUnlocked && html`<div class="small">Veto desbloqueado.</div>`}
    </div>
    <div class="row between small">
      <span>Elecciones fallidas: ${[0, 1, 2].map((i) => html`<span key=${i} class=${cls('tdot', i < g.tracker && 'on')}></span>`)}</span>
      <span class="muted">Mazo ${g.deckCount} · Descartes ${g.discardCount}</span>
    </div>
  </div>`;
}

function Seats({ ctx, g }) {
  return html`<section class="card">
    <h3>Mesa</h3>
    <ul class="seats">
      ${g.seats.map((p) => {
        const dead = !g.alive[p];
        return html`<li key=${p} class=${cls(dead && 'dead')}>
          <${Name} ctx=${ctx} pid=${p} dot />
          <span class="tags">
            ${p === g.president && html`<span class="tag pres">${g.phase === 'nominate' || g.phase === 'vote' ? 'Candidato Pres.' : 'Presidente'}</span>`}
            ${p === g.chancellor && html`<span class="tag chan">${g.phase === 'vote' ? 'Candidato Canc.' : 'Canciller'}</span>`}
            ${p === g.lastPres && p !== g.president && html`<span class="tag ghost">últ. Pres.</span>`}
            ${p === g.lastChan && p !== g.chancellor && html`<span class="tag ghost">últ. Canc.</span>`}
            ${g.notTyrant.includes(p) && html`<span class="tag ok" title="Fue elegido Canciller con 3+ leyes conspiradoras">No es el Tirano</span>`}
            ${g.phase === 'vote' && !dead && html`<span class="tag ${g.voted.includes(p) ? 'ok' : 'ghost'}">${g.voted.includes(p) ? 'votó' : '…'}</span>`}
            ${dead && html`<span class="tag">☠️ ejecutado</span>`}
            ${g.roles && html`<span class=${cls('tag', g.roles[p] === 'L' ? 'lib' : 'fasc')}>${ROLE[g.roles[p]].t}</span>`}
          </span>
        </li>`;
      })}
    </ul>
    ${g.lastVote && html`<${LastVote} ctx=${ctx} lv=${g.lastVote} />`}
  </section>`;
}

function LastVote({ ctx, lv }) {
  return html`<details class="lastvote" open>
    <summary>Última votación: <b class=${lv.passed ? 'ok' : 'bad'}>${lv.passed ? 'APROBADA' : 'RECHAZADA'}</b>${' '}
      (<${Name} ctx=${ctx} pid=${lv.pres} /> + <${Name} ctx=${ctx} pid=${lv.chan} />)</summary>
    <div class="votes">
      ${Object.entries(lv.votes).map(([p, y]) => html`<span key=${p} class=${cls('vote', y ? 'yes' : 'no')}><${Name} ctx=${ctx} pid=${p} />: ${y ? 'Sí' : 'No'}</span>`)}
    </div>
  </details>`;
}

function PolicyCard({ p, onClick, label }) {
  return html`<button class=${cls('policy', p === 'L' ? 'lib' : 'fasc')} onClick=${onClick} disabled=${!onClick}>
    <span class="pol-icon">${p === 'L' ? '🕊️' : '🐍'}</span>
    <span>${POL[p]}</span>
    ${label && html`<small>${label}</small>`}
  </button>`;
}

function Phase({ ctx, g }) {
  const { me } = ctx;
  const [confirm, setConfirm] = useState(null);
  const alive = g.alive[me];
  const amPres = me === g.president;
  const amChan = me === g.chancellor;
  const R = g.round;
  let body;

  if (g.phase === 'over') {
    const why = {
      laws: g.winner === 'L' ? '5 leyes leales aprobadas.' : '6 leyes conspiradoras aprobadas.',
      tyrant: 'El Tirano ha sido elegido Canciller.',
      executed: 'El Tirano ha sido ejecutado.',
    }[g.reason];
    body = html`<div class=${cls('banner', g.winner === 'L' ? 'lib' : 'fasc')}>
      <h2>¡Ganan los ${g.winner === 'L' ? 'Leales' : 'Conspiradores'}!</h2><p>${why}</p>
      <p class="small">Los roles están descubiertos en la mesa.</p>
      ${ctx.admin && html`<button class="btn primary big" onClick=${() => ctx.r({ r: 'restart' })}>Jugar otra vez</button>`}
    </div>`;
  } else if (g.phase === 'nominate') {
    body = amPres
      ? html`<div><h3>Eres candidato a Presidente</h3><p>Elige a tu Canciller:</p>
          <div class="pick">${g.eligible.map((p) => html`<button key=${p} class="btn" onClick=${() => setConfirm({ title: `¿Nominar a ${ctx.players[p]?.name}?`, a: { t: 'nominate', target: p, round: R } })}>${ctx.players[p]?.name}</button>`)}</div></div>`
      : html`<p><${Name} ctx=${ctx} pid=${g.president} /> (candidato a Presidente) está eligiendo Canciller.</p>`;
  } else if (g.phase === 'vote') {
    body = html`<div>
      <h3>Votación</h3>
      <p>Presidente <b><${Name} ctx=${ctx} pid=${g.president} /></b> y Canciller <b><${Name} ctx=${ctx} pid=${g.chancellor} /></b></p>
      ${alive
        ? html`<div class="row gap">
              <button class=${cls('btn big grow vote-btn yes', g.myVote === true && 'sel')} onClick=${() => ctx.g({ t: 'vote', yes: true, round: R })}>¡Sí!</button>
              <button class=${cls('btn big grow vote-btn no', g.myVote === false && 'sel')} onClick=${() => ctx.g({ t: 'vote', yes: false, round: R })}>No</button>
            </div>
            <p class="small muted center">${g.myVote === null ? 'Vota en secreto. Se revela cuando vote todo el mundo.' : `Has votado ${g.myVote ? 'Sí' : 'No'}. Puedes cambiarlo hasta que vote el último.`}
              (${g.voted.length}/${g.seats.filter((p) => g.alive[p]).length})</p>`
        : html`<p class="muted">Los ejecutados no votan.</p>`}
    </div>`;
  } else if (g.phase === 'pres') {
    body = amPres && g.hand
      ? html`<div><h3>Sesión legislativa</h3><p>Toca la ley que quieres <b>descartar</b>. Las otras dos pasan al Canciller.</p>
          <div class="hand">${g.hand.map((p, i) => html`<${PolicyCard} key=${i} p=${p} label="descartar" onClick=${() => setConfirm({ title: `¿Descartar ${POL[p].toLowerCase()}?`, a: { t: 'discard', i, round: R } })} />`)}</div></div>`
      : html`<p>El Presidente <${Name} ctx=${ctx} pid=${g.president} /> está eligiendo qué ley descartar. Silencio en la mesa 🤫</p>`;
  } else if (g.phase === 'chan') {
    body = amChan && g.hand
      ? html`<div><h3>Eres Canciller</h3><p>Toca la ley que quieres <b>descartar</b>. Se aprobará la otra.</p>
          <div class="hand">${g.hand.map((p, i) => html`<${PolicyCard} key=${i} p=${p} label="descartar" onClick=${() => setConfirm({ title: `¿Descartar ${POL[p].toLowerCase()} y aprobar ${POL[g.hand[1 - i]].toLowerCase()}?`, a: { t: 'discard', i, round: R } })} />`)}</div>
          ${g.vetoUnlocked && !g.vetoRefused && html`<button class="btn ghost" onClick=${() => setConfirm({ title: '¿Proponer veto al Presidente?', a: { t: 'veto', round: R } })}>Proponer veto</button>`}
          ${g.vetoRefused && html`<p class="small muted">El Presidente rechazó el veto: tienes que aprobar una.</p>`}</div>`
      : html`<p>El Canciller <${Name} ctx=${ctx} pid=${g.chancellor} /> está eligiendo qué ley aprobar.${g.vetoRefused ? ' (Veto rechazado)' : ''}</p>`;
  } else if (g.phase === 'veto') {
    body = amPres
      ? html`<div><h3>El Canciller propone VETO</h3><p>Si aceptas, se descartan las dos leyes y avanza el marcador de elecciones.</p>
          <div class="hand">${(g.hand || []).map((p, i) => html`<${PolicyCard} key=${i} p=${p} />`)}</div>
          <div class="row gap"><button class="btn grow primary" onClick=${() => ctx.g({ t: 'vetoAnswer', yes: true, round: R })}>Aceptar veto</button>
          <button class="btn grow ghost" onClick=${() => ctx.g({ t: 'vetoAnswer', yes: false, round: R })}>Rechazar</button></div></div>`
      : html`<p>El Canciller ha propuesto un veto. Decide el Presidente <${Name} ctx=${ctx} pid=${g.president} />.</p>`;
  } else if (g.phase === 'power') {
    const name = POWER_NAME[g.power];
    if (!amPres) body = html`<p>Poder presidencial: <b>${POWER_ICON[g.power]} ${name}</b>. Decide <${Name} ctx=${ctx} pid=${g.president} />.</p>`;
    else if (g.power === 'peek') {
      const peek = [...g.private].reverse().find((x) => x.k === 'peek');
      body = html`<div><h3>👁️ Las 3 próximas leyes (en orden)</h3>
        <div class="hand">${(peek?.cards || []).map((p, i) => html`<${PolicyCard} key=${i} p=${p} />`)}</div>
        <p class="small muted">Puedes contarlo… o mentir.</p>
        <button class="btn primary big" onClick=${() => ctx.g({ t: 'power', round: R })}>Hecho</button></div>`;
    } else {
      const opts = g.seats.filter((p) => g.alive[p] && p !== me && !(g.power === 'investigate' && g.investigated.includes(p)));
      const desc = {
        investigate: 'Elige a quién investigar: verás su partido (solo tú).',
        special: 'Elige quién será el próximo candidato a Presidente.',
        execute: 'Elige a quién ejecutar. Si es el Tirano, ganan los Leales.',
      }[g.power];
      body = html`<div><h3>${POWER_ICON[g.power]} ${name}</h3><p>${desc}</p>
        <div class="pick">${opts.map((p) => html`<button key=${p} class=${cls('btn', g.power === 'execute' && 'danger')} onClick=${() => setConfirm({ title: `${name}: ¿${ctx.players[p]?.name}?`, a: { t: 'power', target: p, round: R }, danger: g.power === 'execute' })}>${ctx.players[p]?.name}</button>`)}</div></div>`;
    }
  }
  return html`<section class="card phase">
    ${body}
    ${confirm && html`<${Confirm} title=${confirm.title} danger=${confirm.danger} onOk=${() => ctx.g(confirm.a)} onClose=${() => setConfirm(null)} />`}
  </section>`;
}

function Private({ ctx, g }) {
  const items = g.private.filter((x) => x.k === 'investigate');
  if (!items.length) return null;
  return html`<section class="card">
    <h3>🔍 Tus investigaciones (secreto)</h3>
    <ul class="plain">${items.map((x, i) => html`<li key=${i}><${Name} ctx=${ctx} pid=${x.target} />: <b class=${x.party === 'L' ? 'lib' : 'fasc'}>${PARTY[x.party]}</b></li>`)}</ul>
  </section>`;
}

function Log({ ctx, g }) {
  if (!g.log.length) return null;
  const N = (p) => html`<${Name} ctx=${ctx} pid=${p} />`;
  const txt = (e) => {
    switch (e.k) {
      case 'vote':
        return html`Gobierno ${N(e.pres)} + ${N(e.chan)}: ${e.passed ? 'aprobado' : 'rechazado'} (${e.yes} sí / ${e.no} no)`;
      case 'enact':
        return e.chaos ? html`Caos: se aprueba automáticamente una <b>${POL[e.policy].toLowerCase()}</b>` : html`Se aprueba una <b>${POL[e.policy].toLowerCase()}</b>`;
      case 'veto':
        return html`Veto aceptado: ambas leyes descartadas`;
      case 'vetoRefused':
        return html`${N(e.pres)} rechaza el veto`;
      case 'investigate':
        return html`${N(e.pres)} investiga a ${N(e.target)}`;
      case 'special':
        return html`${N(e.pres)} convoca elección especial: ${N(e.target)}`;
      case 'peek':
        return html`${N(e.pres)} mira las 3 próximas leyes`;
      case 'execute':
        return html`${N(e.pres)} ejecuta a ${N(e.target)}`;
      case 'reshuffle':
        return html`Se baraja el mazo con los descartes`;
      default:
        return '';
    }
  };
  return html`<details class="card log"><summary>Historial (${g.log.length})</summary>
    <ol class="plain">${g.log.slice().reverse().map((e, i) => html`<li key=${i}>${txt(e)}</li>`)}</ol>
  </details>`;
}
