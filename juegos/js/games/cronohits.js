// "Cronohits": juego musical de línea temporal.
//
// Reglas implementadas (modo clásico, como el juego de cartas musical):
// - Cada jugador empieza con 1 canción descubierta en su línea temporal y 2 fichas (máx. 5).
// - En tu turno suena una canción. Colócala en tu línea donde creas que va por año.
// - Los demás pueden RETAR gastando 1 ficha: eligen otro hueco de TU línea.
// - Se revela. Si acertaste te la quedas; si no, se la queda el primer retador (en orden
//   de la mesa) que acertó, en su propia línea; si nadie acierta, se descarta.
// - Si antes de revelar dices título y artista correctamente ganas 1 ficha (lo validan los demás).
// - Fichas: 1 = saltar la canción · 3 = comprar una carta que se coloca sola.
// - Gana quien llega primero a 10 canciones (configurable).
// - Modo Pro: además hay que acertar título y artista para quedarse la carta.
//   Modo Experto: además hay que acertar el año exacto.

import { shuffle, fail, randInt } from '../util.js';
import { SONGS } from '../data/songs.js';

export const MAX_TOKENS = 5;
const year = (i) => SONGS[i][0];

function isCorrectGap(line, gap, y) {
  if (!(gap >= 0 && gap <= line.length)) return false;
  const before = gap === 0 ? -Infinity : year(line[gap - 1]);
  const after = gap === line.length ? Infinity : year(line[gap]);
  return before <= y && y <= after;
}

function insertSorted(line, song) {
  const y = year(song);
  let i = 0;
  while (i < line.length && year(line[i]) <= y) i++;
  line.splice(i, 0, song);
}

function draw(s) {
  if (!s.deck.length) {
    s.deck = shuffle(s.discard);
    s.discard = [];
  }
  return s.deck.length ? s.deck.shift() : null;
}

function active(s) {
  return s.seats[s.turnIdx];
}

/** Orden de la mesa empezando por el jugador siguiente al activo. */
function clockwiseFrom(s, pid) {
  const i = s.seats.indexOf(pid);
  return [...s.seats.slice(i + 1), ...s.seats.slice(0, i)];
}

function canChallenge(s, pid) {
  return pid !== active(s) && s.seats.includes(pid) && s.tokens[pid] >= 1;
}

function pendingChallengers(s) {
  return s.seats.filter(
    (p) => canChallenge(s, p) && !s.passes.includes(p) && !s.challenges.some((c) => c.pid === p),
  );
}

function startTurn(s) {
  s.current = draw(s);
  if (s.current === null) return finishByDeck(s);
  s.phase = 'listen';
  s.placed = null;
  s.challenges = [];
  s.passes = [];
  s.named = null;
  s.yearOk = null;
  s.playNonce++;
  s.turnNo++;
}

function finishByDeck(s) {
  const best = Math.max(...s.seats.map((p) => s.lines[p].length));
  s.winners = s.seats.filter((p) => s.lines[p].length === best);
  s.phase = 'over';
  s.reason = 'deck';
}

function checkWin(s) {
  const done = s.seats.filter((p) => s.lines[p].length >= s.target);
  if (done.length) {
    s.winners = done;
    s.phase = 'over';
    s.reason = 'target';
    return true;
  }
  return false;
}

function toReveal(s) {
  s.phase = 'reveal';
  s.named = null;
  s.yearOk = null;
}

/** Calcula quién se queda la carta con lo que se sabe ahora. */
function outcome(s) {
  const act = active(s);
  const y = year(s.current);
  const placementOk = isCorrectGap(s.lines[act], s.placed, y);
  const needName = s.mode === 'pro' || s.mode === 'expert';
  const needYear = s.mode === 'expert';
  const activeKeeps = placementOk && (!needName || s.named === true) && (!needYear || s.yearOk === true);
  let challengerWins = null;
  if (!activeKeeps) {
    for (const p of clockwiseFrom(s, act)) {
      const c = s.challenges.find((x) => x.pid === p);
      if (c && isCorrectGap(s.lines[act], c.gap, y)) {
        challengerWins = p;
        break;
      }
    }
  }
  return { placementOk, activeKeeps, challengerWins, token: s.named === true };
}

export default {
  id: 'cronohits',
  name: 'Cronohits',
  emoji: '🎵',
  tagline: 'Escucha, adivina el año y ordena tu línea temporal musical.',
  min: 2,
  max: 12,
  options: [
    { key: 'target', label: 'Canciones para ganar', type: 'select', choices: [5, 8, 10, 12, 15], def: 10 },
    {
      key: 'mode',
      label: 'Modo',
      type: 'select',
      choices: ['original', 'pro', 'expert'],
      labels: { original: 'Original', pro: 'Pro (+ título y artista)', expert: 'Experto (+ año exacto)' },
      def: 'original',
    },
    {
      key: 'era',
      label: 'Canciones',
      type: 'select',
      choices: ['all', 'es', 'intl'],
      labels: { all: 'Todas', es: 'Solo en español', intl: 'Solo internacionales' },
      def: 'all',
    },
  ],

  setup(players, opts = {}) {
    const target = Number(opts.target) || 10;
    const mode = ['original', 'pro', 'expert'].includes(opts.mode) ? opts.mode : 'original';
    let pool = SONGS.map((_, i) => i);
    if (opts.era === 'es') pool = pool.filter((i) => SONGS_ES.has(i));
    if (opts.era === 'intl') pool = pool.filter((i) => !SONGS_ES.has(i));
    const s = {
      seats: players.slice(),
      tokens: {},
      lines: {},
      deck: shuffle(pool),
      discard: [],
      unavailable: [],
      turnIdx: randInt(players.length),
      current: null,
      phase: 'listen',
      placed: null,
      challenges: [],
      passes: [],
      named: null,
      yearOk: null,
      target,
      mode,
      playNonce: 0,
      turnNo: 0,
      last: null,
      winners: null,
      reason: null,
    };
    for (const p of players) {
      s.tokens[p] = 2;
      s.lines[p] = [draw(s)];
    }
    startTurn(s);
    return s;
  },

  // Quien llega tarde puede incorporarse con su carta inicial y 2 fichas.
  addPlayer(s, pid) {
    if (s.seats.includes(pid) || s.phase === 'over') return;
    s.seats.push(pid);
    s.tokens[pid] = 2;
    s.lines[pid] = [draw(s)];
  },

  removePlayer(s, pid) {
    const i = s.seats.indexOf(pid);
    if (i < 0) return;
    const wasActive = i === s.turnIdx;
    s.seats.splice(i, 1);
    s.challenges = s.challenges.filter((c) => c.pid !== pid);
    s.passes = s.passes.filter((p) => p !== pid);
    if (!s.seats.length) return;
    if (i < s.turnIdx) s.turnIdx--;
    if (s.turnIdx >= s.seats.length) s.turnIdx = 0;
    if (wasActive && s.phase !== 'over') {
      s.discard.push(s.current);
      startTurn(s);
    } else if (s.phase === 'challenge' && !pendingChallengers(s).length) toReveal(s);
  },

  act(s, ctx, a) {
    const me = ctx.pid;
    const isActive = me === active(s);
    if (s.phase === 'over') fail('La partida ha terminado');
    if (a.turnNo !== undefined && a.turnNo !== s.turnNo) fail('Eso era del turno anterior');
    switch (a.t) {
      case 'place': {
        if (s.phase !== 'listen') fail('Ya está colocada');
        if (!isActive) fail('No es tu turno');
        const gap = Number(a.gap);
        if (!(Number.isInteger(gap) && gap >= 0 && gap <= s.lines[me].length)) fail('Hueco no válido');
        s.placed = gap;
        s.phase = 'challenge';
        if (!pendingChallengers(s).length) toReveal(s);
        return;
      }
      case 'skip': {
        if (s.phase !== 'listen' || !isActive) fail('Solo el jugador en turno, antes de colocar');
        if (s.tokens[me] < 1) fail('Necesitas 1 ficha');
        s.tokens[me]--;
        s.discard.push(s.current);
        s.current = draw(s);
        if (s.current === null) return finishByDeck(s);
        s.playNonce++;
        s.last = { k: 'skip', pid: me };
        return;
      }
      case 'buy': {
        if (s.phase !== 'listen' || !isActive) fail('Solo el jugador en turno, antes de colocar');
        if (s.tokens[me] < 3) fail('Necesitas 3 fichas');
        const card = draw(s);
        if (card === null) fail('No quedan cartas');
        s.tokens[me] -= 3;
        insertSorted(s.lines[me], card);
        s.last = { k: 'buy', pid: me, song: card };
        checkWin(s);
        return;
      }
      case 'challenge': {
        if (s.phase !== 'challenge') fail('Ahora no se puede retar');
        if (isActive) fail('No puedes retarte a ti mismo');
        if (!canChallenge(s, me)) fail('Necesitas 1 ficha para retar');
        if (s.passes.includes(me) || s.challenges.some((c) => c.pid === me)) fail('Ya has decidido');
        const gap = Number(a.gap);
        const line = s.lines[active(s)];
        if (!(Number.isInteger(gap) && gap >= 0 && gap <= line.length)) fail('Hueco no válido');
        if (gap === s.placed) fail('Ese hueco es el que ha elegido el jugador');
        if (s.challenges.some((c) => c.gap === gap)) fail('Otro jugador ya ha elegido ese hueco');
        s.tokens[me]--;
        s.challenges.push({ pid: me, gap });
        if (!pendingChallengers(s).length) toReveal(s);
        return;
      }
      case 'pass': {
        if (s.phase !== 'challenge') fail('Ahora no');
        if (isActive) fail('Eres el jugador en turno');
        if (!s.passes.includes(me)) s.passes.push(me);
        if (!pendingChallengers(s).length) toReveal(s);
        return;
      }
      case 'reveal': {
        if (s.phase !== 'challenge') fail('Ahora no');
        if (!isActive && !ctx.admin) fail('Solo el jugador en turno o el admin');
        toReveal(s);
        return;
      }
      case 'judge': {
        if (s.phase !== 'reveal') fail('Ahora no');
        if (isActive) fail('Lo deciden los demás jugadores');
        if (a.field === 'year') s.yearOk = !!a.value;
        else s.named = !!a.value;
        return;
      }
      case 'next': {
        if (s.phase !== 'reveal') fail('Ahora no');
        if (!isActive && !ctx.admin) fail('Solo el jugador en turno o el admin');
        const act = active(s);
        const o = outcome(s);
        if (o.activeKeeps) s.lines[act].splice(s.placed, 0, s.current);
        else if (o.challengerWins) insertSorted(s.lines[o.challengerWins], s.current);
        else s.discard.push(s.current);
        if (o.token) s.tokens[act] = Math.min(MAX_TOKENS, s.tokens[act] + 1);
        s.last = { k: 'result', pid: act, song: s.current, ...o };
        if (checkWin(s)) return;
        s.turnIdx = (s.turnIdx + 1) % s.seats.length;
        return startTurn(s);
      }
      case 'replay': {
        s.playNonce++;
        return;
      }
      case 'unavailable': {
        // Lo envía el altavoz (admin) si no encuentra el audio de la canción: se cambia sin coste.
        if (!ctx.admin) fail('Solo el admin');
        if (s.phase !== 'listen' || a.song !== s.current) return;
        s.unavailable.push(s.current);
        s.current = draw(s);
        if (s.current === null) return finishByDeck(s);
        s.playNonce++;
        return;
      }
      case 'tokens': {
        if (!ctx.admin) fail('Solo el admin');
        if (!s.seats.includes(a.target)) fail('Jugador no válido');
        s.tokens[a.target] = Math.max(0, Math.min(MAX_TOKENS, s.tokens[a.target] + (a.delta > 0 ? 1 : -1)));
        return;
      }
      default:
        fail('Acción desconocida');
    }
  },

  view(s, pid) {
    const card = (i) => ({ year: SONGS[i][0], artist: SONGS[i][1], title: SONGS[i][2] });
    const lines = {};
    for (const p of s.seats) lines[p] = s.lines[p].map(card);
    const v = {
      seats: s.seats,
      tokens: s.tokens,
      lines,
      active: active(s),
      phase: s.phase,
      placed: s.placed,
      challenges: s.challenges,
      passes: s.passes,
      pending: s.phase === 'challenge' ? pendingChallengers(s) : [],
      named: s.named,
      yearOk: s.yearOk,
      target: s.target,
      mode: s.mode,
      turnNo: s.turnNo,
      playNonce: s.playNonce,
      deckCount: s.deck.length,
      winners: s.winners,
      reason: s.reason,
      last: s.last ? { ...s.last, song: s.last.song != null ? card(s.last.song) : null } : null,
      maxTokens: MAX_TOKENS,
      current: s.phase === 'reveal' || s.phase === 'over' ? (s.current != null ? card(s.current) : null) : null,
    };
    if (s.phase === 'reveal') v.outcome = outcome(s);
    return v;
  },

  /** Solo para el altavoz del admin: qué canción debe sonar. */
  nowPlaying(s) {
    if (s.current == null || s.phase === 'over') return null;
    return { idx: s.current, nonce: s.playNonce, artist: SONGS[s.current][1], title: SONGS[s.current][2] };
  },
};

// Canciones de artistas en español (para el filtro de idioma).
const ES_ARTISTS = new Set([
  'Los Bravos', 'Raphael', 'Massiel', 'Los Payos', 'Los Diablos', 'Julio Iglesias', 'Joan Manuel Serrat', 'Peret',
  'Karina', 'Nino Bravo', 'Mocedades', 'Fórmula V', 'Manolo Escobar', 'Jeanette', 'Camilo Sesto', 'Nacha Pop',
  'Los Secretos', 'Miguel Ríos', 'Loquillo y los Trogloditas', 'Tino Casal', 'Radio Futura', 'La Unión', 'Miguel Bosé',
  'Miami Sound Machine', 'Hombres G', 'Alaska y Dinarama', 'Mecano', 'Duncan Dhu', 'Gabinete Caligari',
  'El Último de la Fila', 'Héroes del Silencio', 'Azúcar Moreno', 'Celtas Cortos', 'Sergio Dalma',
  'Presuntos Implicados', 'Maná', 'Joaquín Sabina', 'Gloria Estefan', 'Carlos Vives', 'Los Rodríguez', 'Marta Sánchez',
  'Mónica Naranjo', 'Jarabe de Palo', 'Ella Baila Sola', 'Rosana', 'Extremoduro', 'Alejandro Sanz', 'Celia Cruz',
  'Manu Chao', 'La Oreja de Van Gogh', 'Manolo García', 'Estopa', 'Paulina Rubio', 'Mägo de Oz', 'Las Ketchup', 'Amaral',
  'David Bisbal', 'Chenoa', 'Juanes', 'Fito & Fitipaldis', 'Daddy Yankee', 'Bebe', 'El Canto del Loco', 'Melendi',
  'Carlos Baute & Marta Sánchez', 'Nicky Jam & Enrique Iglesias', 'Carlos Vives & Shakira', 'Luis Fonsi',
  'J Balvin & Willy William', 'Maluma', 'Becky G', 'Rosalía', 'Aitana', 'Lola Índigo', 'Rosalía & J Balvin',
  'Karol G & Nicki Minaj', 'C. Tangana', 'Bad Bunny & Jhay Cortez', 'Rauw Alejandro', 'Sebastián Yatra', 'Bad Bunny',
  'Bizarrap & Quevedo', 'Bizarrap & Shakira',
]);
const ES_TITLES = new Set(['María', 'La copa de la vida', 'Estoy aquí', 'La tortura', 'Bailando', 'La Bamba']);
export const SONGS_ES = new Set(
  SONGS.map((s, i) => (ES_ARTISTS.has(s[1]) || ES_TITLES.has(s[2]) ? i : -1)).filter((i) => i >= 0),
);
