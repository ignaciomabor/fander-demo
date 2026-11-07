// "Palabras Espía": juego de pistas por equipos (mecánica clásica de 2 equipos y 25 palabras).
//
// Reglas implementadas:
// - Tablero de 5x5 palabras. Equipo inicial (al azar): 9 agentes; el otro: 8; 7 civiles; 1 asesino.
// - Cada equipo tiene un jefe de espías que ve el mapa secreto y da UNA palabra + UN número.
// - La pista no puede ser una palabra visible del tablero. El número puede ser 0-9 o ∞
//   (0 e ∞ permiten adivinar sin límite).
// - Los agentes deben tocar al menos una palabra. Pueden hacer hasta número+1 intentos.
//   * Agente propio: siguen adivinando.  * Civil o agente rival: se acaba el turno.
//   * Asesino: su equipo pierde al instante.
// - Gana el equipo que tenga todos sus agentes descubiertos (aunque los descubra el rival).

import { shuffle, fold, fail, randInt } from '../util.js';
import { WORDS } from '../data/words.js';

const other = (t) => (t === 'r' ? 'b' : 'r');
const TEAM_NAME = { r: 'Rojo', b: 'Azul' };

function teamOf(s, pid) {
  return s.team[pid] || null;
}
function members(s, t) {
  return s.players.filter((p) => s.team[p] === t);
}
function remaining(s, t) {
  let n = 0;
  for (let i = 0; i < 25; i++) if (s.key[i] === t && !s.revealed[i]) n++;
  return n;
}

function balance(s) {
  for (const p of s.players) {
    if (!s.team[p]) s.team[p] = members(s, 'r').length <= members(s, 'b').length ? 'r' : 'b';
  }
}

function deal(s) {
  const start = randInt(2) ? 'r' : 'b';
  const key = [
    ...Array(9).fill(start),
    ...Array(8).fill(other(start)),
    ...Array(7).fill('n'),
    'a',
  ];
  s.words = shuffle(WORDS).slice(0, 25);
  s.key = shuffle(key);
  s.revealed = Array(25).fill(false);
  s.start = start;
  s.turn = start;
  s.phase = 'clue';
  s.clue = null;
  s.guessesLeft = null;
  s.guessed = 0;
  s.turnNo = (s.turnNo || 0) + 1;
  s.log = [];
  s.winner = null;
  s.reason = null;
  s.lastReveal = null;
}

function endTurn(s) {
  s.turn = other(s.turn);
  s.phase = 'clue';
  s.clue = null;
  s.guessesLeft = null;
  s.guessed = 0;
  s.turnNo++;
}

function checkWin(s) {
  for (const t of ['r', 'b']) {
    if (remaining(s, t) === 0) {
      s.winner = t;
      s.reason = 'agents';
      s.phase = 'over';
      s.score[t]++;
      return true;
    }
  }
  return false;
}

export default {
  id: 'palabras',
  name: 'Palabras Espía',
  emoji: '🕵️',
  tagline: 'Dos equipos, 25 palabras y un jefe de espías que da pistas de una palabra.',
  min: 4,
  max: 20,
  options: [],

  setup(players) {
    const s = { players: players.slice(), team: {}, spy: { r: null, b: null }, phase: 'teams', score: { r: 0, b: 0 }, turnNo: 0 };
    // Reparto inicial aleatorio y equilibrado; luego cada uno puede cambiarse.
    const sh = shuffle(players);
    sh.forEach((p, i) => (s.team[p] = i % 2 ? 'b' : 'r'));
    return s;
  },

  addPlayer(s, pid) {
    if (!s.players.includes(pid)) s.players.push(pid);
    balance(s);
  },

  removePlayer(s, pid) {
    s.players = s.players.filter((p) => p !== pid);
    delete s.team[pid];
    for (const t of ['r', 'b']) if (s.spy[t] === pid) s.spy[t] = null;
  },

  act(s, ctx, a) {
    const me = ctx.pid;
    const target = a.target && ctx.admin ? a.target : me;
    switch (a.t) {
      case 'team': {
        if (!['r', 'b'].includes(a.team)) fail('Equipo no válido');
        if (!s.players.includes(target)) fail('Ese jugador no está en la partida');
        if (s.phase !== 'teams' && !ctx.admin && teamOf(s, target)) fail('Solo puedes cambiar de equipo antes de empezar');
        if (s.spy[other(a.team)] === target) s.spy[other(a.team)] = null;
        s.team[target] = a.team;
        return;
      }
      case 'spy': {
        if (!['r', 'b'].includes(a.team)) fail('Equipo no válido');
        if (s.phase !== 'teams' && s.spy[a.team] && !ctx.admin) fail('Ese equipo ya tiene jefe de espías');
        if (s.phase === 'teams' && s.spy[a.team] && s.spy[a.team] !== target && !ctx.admin)
          fail('Ese equipo ya tiene jefe de espías');
        if (s.spy[other(a.team)] === target) s.spy[other(a.team)] = null;
        s.team[target] = a.team;
        s.spy[a.team] = target;
        return;
      }
      case 'unspy': {
        if (s.phase !== 'teams') fail('No se puede durante la partida');
        for (const t of ['r', 'b']) if (s.spy[t] === target) s.spy[t] = null;
        return;
      }
      case 'shuffle': {
        if (!ctx.admin) fail('Solo el admin');
        if (s.phase !== 'teams') fail('Solo antes de empezar');
        const sh = shuffle(s.players);
        s.team = {};
        sh.forEach((p, i) => (s.team[p] = i % 2 ? 'b' : 'r'));
        s.spy = { r: members(s, 'r')[0] || null, b: members(s, 'b')[0] || null };
        return;
      }
      case 'start': {
        if (!ctx.admin) fail('Solo el admin');
        if (s.phase !== 'teams') fail('La partida ya ha empezado');
        for (const t of ['r', 'b']) {
          if (members(s, t).length < 2) fail(`El equipo ${TEAM_NAME[t]} necesita al menos 2 jugadores`);
          if (!s.spy[t] || s.team[s.spy[t]] !== t) fail(`Falta el jefe de espías del equipo ${TEAM_NAME[t]}`);
        }
        deal(s);
        return;
      }
      case 'again': {
        if (!ctx.admin) fail('Solo el admin');
        if (a.toTeams) {
          s.phase = 'teams';
          return;
        }
        for (const t of ['r', 'b']) if (!s.spy[t]) fail(`Falta el jefe de espías del equipo ${TEAM_NAME[t]}`);
        deal(s);
        return;
      }
      case 'clue': {
        if (s.phase !== 'clue') fail('Ahora no toca dar pista');
        if (a.turnNo !== s.turnNo) fail('Ese turno ya ha pasado');
        if (s.spy[s.turn] !== me) fail('Solo el jefe de espías del equipo en turno da la pista');
        const word = String(a.word || '').trim();
        if (!word) fail('Escribe una palabra');
        if (/\s/.test(word)) fail('La pista debe ser una sola palabra');
        if (word.length > 30) fail('Palabra demasiado larga');
        const f = fold(word);
        for (let i = 0; i < 25; i++) {
          if (!s.revealed[i] && fold(s.words[i]) === f) fail('No puedes usar una palabra que está en el tablero');
        }
        const unlimited = a.num === '∞' || a.num === 0 || a.num === '0';
        const num = a.num === '∞' ? '∞' : Number(a.num);
        if (num !== '∞' && !(Number.isInteger(num) && num >= 0 && num <= 9)) fail('Número no válido');
        s.clue = { word, num };
        s.guessesLeft = unlimited ? null : num + 1;
        s.guessed = 0;
        s.phase = 'guess';
        s.log.push({ team: s.turn, word, num, guesses: [] });
        return;
      }
      case 'guess': {
        if (s.phase !== 'guess') fail('Ahora no se puede adivinar');
        if (a.turnNo !== s.turnNo) fail('Ese turno ya ha pasado');
        if (teamOf(s, me) !== s.turn) fail('No es el turno de tu equipo');
        if (s.spy[s.turn] === me) fail('El jefe de espías no puede tocar palabras');
        const i = Number(a.i);
        if (!(i >= 0 && i < 25)) fail('Carta no válida');
        if (s.revealed[i]) fail('Esa palabra ya está descubierta');
        s.revealed[i] = true;
        const color = s.key[i];
        s.guessed++;
        s.lastReveal = { i, by: me, color, team: s.turn };
        s.log[s.log.length - 1]?.guesses.push({ i, color });
        if (color === 'a') {
          s.winner = other(s.turn);
          s.reason = 'assassin';
          s.phase = 'over';
          s.score[s.winner]++;
          return;
        }
        if (checkWin(s)) return;
        if (color !== s.turn) return endTurn(s);
        if (s.guessesLeft !== null && s.guessed >= s.guessesLeft) return endTurn(s);
        return;
      }
      case 'pass': {
        if (s.phase !== 'guess') fail('Ahora no se puede pasar');
        if (a.turnNo !== s.turnNo) fail('Ese turno ya ha pasado');
        if (teamOf(s, me) !== s.turn || s.spy[s.turn] === me) fail('Solo los agentes del equipo en turno');
        if (s.guessed < 1) fail('Hay que tocar al menos una palabra antes de pasar');
        return endTurn(s);
      }
      default:
        fail('Acción desconocida');
    }
  },

  view(s, pid) {
    const myTeam = teamOf(s, pid);
    const isSpy = myTeam && s.spy[myTeam] === pid;
    const showKey = isSpy || s.phase === 'over';
    const v = {
      phase: s.phase,
      team: s.team,
      spy: s.spy,
      score: s.score,
      players: s.players,
      myTeam,
      isSpy: !!isSpy,
    };
    if (s.phase === 'teams') return v;
    Object.assign(v, {
      words: s.words,
      revealed: s.revealed,
      colors: s.key.map((c, i) => (showKey || s.revealed[i] ? c : null)),
      start: s.start,
      turn: s.turn,
      clue: s.clue,
      guessesLeft: s.guessesLeft,
      guessed: s.guessed,
      turnNo: s.turnNo,
      left: { r: remaining(s, 'r'), b: remaining(s, 'b') },
      log: s.log,
      winner: s.winner,
      reason: s.reason,
      lastReveal: s.lastReveal,
    });
    return v;
  },
};
