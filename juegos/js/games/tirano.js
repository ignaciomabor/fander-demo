// "El Tirano Oculto": juego de roles ocultos de 5 a 10 jugadores.
// Mecánica fiel al juego de deducción social de leyes y gobiernos
// (cuyas reglas se publican bajo licencia CC BY-NC-SA 4.0), con temática propia:
//   Liberales  -> Leales        Fascistas -> Conspiradores        Hitler -> El Tirano
//
// Resumen de reglas:
// - Reparto: 5j 3L+1C+T · 6j 4L+1C+T · 7j 4L+2C+T · 8j 5L+2C+T · 9j 5L+3C+T · 10j 6L+3C+T.
// - Los conspiradores conocen a sus compañeros y al Tirano. El Tirano solo conoce a los
//   conspiradores si hay 5 o 6 jugadores.
// - Mazo: 6 leyes leales y 11 conspiradoras.
// - Ronda: el candidato a Presidente (rota en el sentido de la mesa) nomina Canciller.
//   No pueden ser Canciller ni el último Presidente ni el último Canciller ELEGIDOS
//   (con 5 jugadores vivos solo el último Canciller está vetado).
// - Votación simultánea: sale si hay MÁS síes que noes (empate = no).
//   * Si sale con 3+ leyes conspiradoras y el Canciller es el Tirano: ganan los conspiradores.
//   * Si falla: avanza el marcador de elecciones. A la 3.ª se aprueba la ley de arriba del
//     mazo (sin poder presidencial), se reinicia el marcador y se olvidan los límites de mandato.
// - Sesión legislativa: Presidente roba 3, descarta 1 en secreto; Canciller descarta 1 y aprueba 1.
// - Con 5 leyes conspiradoras se desbloquea el veto (Canciller propone, Presidente acepta o no).
//   Un veto aceptado descarta las 2 leyes y avanza el marcador de elecciones.
// - Poderes al aprobar leyes conspiradoras (según nº de jugadores):
//     5-6:  -, -, ver 3 leyes, ejecución, ejecución
//     7-8:  -, investigar, elección especial, ejecución, ejecución
//     9-10: investigar, investigar, elección especial, ejecución, ejecución
// - Si quedan menos de 3 cartas en el mazo se baraja con los descartes.
// - Ganan los Leales con 5 leyes leales o ejecutando al Tirano.
//   Ganan los Conspiradores con 6 leyes conspiradoras o eligiendo Canciller al Tirano tras 3.

import { shuffle, fail, randInt } from '../util.js';

const ROLES = {
  5: [3, 1],
  6: [4, 1],
  7: [4, 2],
  8: [5, 2],
  9: [5, 3],
  10: [6, 3],
};

export function powersFor(n) {
  if (n <= 6) return [null, null, 'peek', 'execute', 'execute'];
  if (n <= 8) return [null, 'investigate', 'special', 'execute', 'execute'];
  return ['investigate', 'investigate', 'special', 'execute', 'execute'];
}

export const POWER_NAME = {
  investigate: 'Investigar lealtad',
  special: 'Elección especial',
  peek: 'Ver las 3 leyes de arriba',
  execute: 'Ejecución',
};

function alive(s) {
  return s.seats.filter((p) => s.alive[p]);
}

function nextAliveIdx(s, idx) {
  const n = s.seats.length;
  for (let k = 1; k <= n; k++) {
    const j = (idx + k) % n;
    if (s.alive[s.seats[j]]) return j;
  }
  return idx;
}

function ensureDeck(s) {
  if (s.deck.length < 3) {
    s.deck = shuffle([...s.deck, ...s.discard]);
    s.discard = [];
    s.log.push({ k: 'reshuffle' });
  }
}

export function canBeChancellor(s, pid) {
  if (!s.alive[pid] || pid === s.president) return false;
  if (pid === s.lastChan) return false;
  if (pid === s.lastPres && alive(s).length > 5) return false;
  return true;
}

function newRound(s) {
  s.chancellor = null;
  s.votes = {};
  s.hand = [];
  s.vetoRefused = false;
  s.power = null;
  s.phase = 'nominate';
  s.round++;
}

function advancePresident(s) {
  s.rot = nextAliveIdx(s, s.rot);
  s.president = s.seats[s.rot];
  newRound(s);
}

function win(s, team, reason) {
  s.winner = team;
  s.reason = reason;
  s.phase = 'over';
}

function enact(s, policy, { chaos = false } = {}) {
  if (policy === 'L') s.lib++;
  else s.fas++;
  s.tracker = 0;
  s.log.push({ k: 'enact', policy, chaos, pres: chaos ? null : s.president, chan: chaos ? null : s.chancellor });
  if (s.lib >= 5) return win(s, 'L', 'laws'), true;
  if (s.fas >= 6) return win(s, 'F', 'laws'), true;
  return false;
}

function failElection(s) {
  s.tracker++;
  if (s.tracker >= 3) {
    ensureDeck(s);
    const top = s.deck.shift();
    s.lastPres = null;
    s.lastChan = null;
    if (enact(s, top, { chaos: true })) return;
    ensureDeck(s);
  }
  advancePresident(s);
}

export default {
  id: 'tirano',
  name: 'El Tirano Oculto',
  emoji: '🎭',
  tagline: 'Leales contra conspiradores. Encuentra al Tirano antes de que llegue al poder.',
  min: 5,
  max: 10,
  options: [],

  setup(players) {
    const n = players.length;
    if (!ROLES[n]) fail('Este juego es para 5 a 10 jugadores');
    const [nl, nf] = ROLES[n];
    const roles = shuffle([...Array(nl).fill('L'), ...Array(nf).fill('F'), 'T']);
    const s = {
      seats: players.slice(),
      roles: {},
      alive: {},
      deck: shuffle([...Array(6).fill('L'), ...Array(11).fill('F')]),
      discard: [],
      lib: 0,
      fas: 0,
      tracker: 0,
      powers: powersFor(n),
      rot: randInt(n),
      president: null,
      chancellor: null,
      lastPres: null,
      lastChan: null,
      votes: {},
      lastVote: null,
      hand: [],
      vetoRefused: false,
      power: null,
      investigated: [],
      notTyrant: [],
      private: {}, // pid -> [{k:'investigate'|'peek', ...}]
      log: [],
      round: 0,
      phase: 'nominate',
      winner: null,
      reason: null,
    };
    players.forEach((p, i) => {
      s.roles[p] = roles[i];
      s.alive[p] = true;
      s.private[p] = [];
    });
    s.president = s.seats[s.rot];
    newRound(s);
    return s;
  },

  // Nadie entra a mitad de partida: quien llegue tarde mira.
  addPlayer() {},
  removePlayer() {},

  act(s, ctx, a) {
    const me = ctx.pid;
    if (s.phase === 'over') fail('La partida ha terminado');
    if (a.round !== undefined && a.round !== s.round) fail('Esa acción es de una ronda anterior');
    switch (a.t) {
      case 'nominate': {
        if (s.phase !== 'nominate') fail('Ahora no toca nominar');
        if (me !== s.president) fail('Solo el candidato a Presidente nomina');
        if (!canBeChancellor(s, a.target)) fail('Ese jugador no puede ser Canciller');
        s.chancellor = a.target;
        s.votes = {};
        s.phase = 'vote';
        return;
      }
      case 'vote': {
        if (s.phase !== 'vote') fail('Ahora no se vota');
        if (!s.alive[me]) fail('Los ejecutados no votan');
        if (typeof a.yes !== 'boolean') fail('Voto no válido');
        s.votes[me] = a.yes;
        const living = alive(s);
        if (!living.every((p) => p in s.votes)) return;
        const yes = living.filter((p) => s.votes[p]).length;
        const passed = yes > living.length / 2;
        s.lastVote = { votes: { ...s.votes }, passed, pres: s.president, chan: s.chancellor, round: s.round };
        s.log.push({ k: 'vote', passed, pres: s.president, chan: s.chancellor, yes, no: living.length - yes });
        if (!passed) return failElection(s);
        s.lastPres = s.president;
        s.lastChan = s.chancellor;
        if (s.fas >= 3) {
          if (s.roles[s.chancellor] === 'T') return win(s, 'F', 'tyrant');
          if (!s.notTyrant.includes(s.chancellor)) s.notTyrant.push(s.chancellor);
        }
        ensureDeck(s);
        s.hand = s.deck.splice(0, 3);
        s.phase = 'pres';
        return;
      }
      case 'discard': {
        const i = Number(a.i);
        if (s.phase === 'pres') {
          if (me !== s.president) fail('Solo el Presidente');
          if (!(i >= 0 && i < 3)) fail('Carta no válida');
          s.discard.push(s.hand.splice(i, 1)[0]);
          s.phase = 'chan';
          return;
        }
        if (s.phase === 'chan') {
          if (me !== s.chancellor) fail('Solo el Canciller');
          if (!(i >= 0 && i < 2)) fail('Carta no válida');
          s.discard.push(s.hand.splice(i, 1)[0]);
          const policy = s.hand.pop();
          s.hand = [];
          if (enact(s, policy)) return;
          ensureDeck(s);
          const power = policy === 'F' ? s.powers[s.fas - 1] : null;
          if (power) {
            s.power = power;
            s.phase = 'power';
            if (power === 'peek') {
              s.private[s.president].push({ k: 'peek', cards: s.deck.slice(0, 3), round: s.round });
            }
            return;
          }
          return advancePresident(s);
        }
        fail('Ahora no se descarta');
        return;
      }
      case 'veto': {
        if (s.phase !== 'chan') fail('Ahora no se puede vetar');
        if (me !== s.chancellor) fail('Solo el Canciller propone el veto');
        if (s.fas < 5) fail('El veto se desbloquea con 5 leyes conspiradoras');
        if (s.vetoRefused) fail('El Presidente ya rechazó el veto');
        s.phase = 'veto';
        return;
      }
      case 'vetoAnswer': {
        if (s.phase !== 'veto') fail('No hay veto pendiente');
        if (me !== s.president) fail('Solo el Presidente responde al veto');
        if (a.yes) {
          s.discard.push(...s.hand);
          s.hand = [];
          s.log.push({ k: 'veto', pres: s.president, chan: s.chancellor });
          ensureDeck(s);
          return failElection(s);
        }
        s.vetoRefused = true;
        s.log.push({ k: 'vetoRefused', pres: s.president });
        s.phase = 'chan';
        return;
      }
      case 'power': {
        if (s.phase !== 'power') fail('No hay poder pendiente');
        if (me !== s.president) fail('Solo el Presidente usa el poder');
        const t = a.target;
        if (s.power === 'peek') {
          s.log.push({ k: 'peek', pres: s.president });
          return advancePresident(s);
        }
        if (!s.alive[t] || t === me) fail('Elige a otro jugador vivo');
        if (s.power === 'investigate') {
          if (s.investigated.includes(t)) fail('Ese jugador ya ha sido investigado');
          s.investigated.push(t);
          s.private[me].push({ k: 'investigate', target: t, party: s.roles[t] === 'L' ? 'L' : 'F', round: s.round });
          s.log.push({ k: 'investigate', pres: me, target: t });
          return advancePresident(s);
        }
        if (s.power === 'special') {
          s.log.push({ k: 'special', pres: me, target: t });
          s.president = t; // la rotación (s.rot) sigue desde quien convocó
          return newRound(s);
        }
        if (s.power === 'execute') {
          s.alive[t] = false;
          s.log.push({ k: 'execute', pres: me, target: t });
          if (s.roles[t] === 'T') return win(s, 'L', 'executed');
          return advancePresident(s);
        }
        fail('Poder desconocido');
        return;
      }
      default:
        fail('Acción desconocida');
    }
  },

  view(s, pid) {
    const role = s.roles[pid] || null;
    const n = s.seats.length;
    let know = [];
    if (role === 'F' || (role === 'T' && n <= 6)) {
      know = s.seats.filter((p) => p !== pid && s.roles[p] !== 'L').map((p) => ({ pid: p, role: s.roles[p] }));
    }
    const over = s.phase === 'over';
    const v = {
      seats: s.seats,
      alive: s.alive,
      lib: s.lib,
      fas: s.fas,
      tracker: s.tracker,
      powers: s.powers,
      deckCount: s.deck.length,
      discardCount: s.discard.length,
      president: s.president,
      chancellor: s.chancellor,
      lastPres: s.lastPres,
      lastChan: s.lastChan,
      eligible: s.phase === 'nominate' ? s.seats.filter((p) => canBeChancellor(s, p)) : [],
      phase: s.phase,
      round: s.round,
      voted: s.phase === 'vote' ? Object.keys(s.votes) : [],
      myVote: s.phase === 'vote' && pid in s.votes ? s.votes[pid] : null,
      lastVote: s.lastVote,
      power: s.power,
      investigated: s.investigated,
      notTyrant: s.notTyrant,
      vetoUnlocked: s.fas >= 5,
      vetoRefused: s.vetoRefused,
      log: s.log,
      winner: s.winner,
      reason: s.reason,
      role,
      know,
      private: s.private[pid] || [],
      hand: (s.phase === 'pres' && pid === s.president) || ((s.phase === 'chan' || s.phase === 'veto') && pid === s.chancellor) ? s.hand : null,
      handSize: s.hand.length,
      roles: over ? s.roles : null,
    };
    // En la votación del veto, el Presidente ve las 2 cartas que el Canciller quiere vetar.
    if (s.phase === 'veto' && pid === s.president) v.hand = s.hand;
    return v;
  },
};
