// Pruebas de reglas: node --test juegos/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import palabras from '../js/games/palabras.js';
import tirano, { canBeChancellor, powersFor } from '../js/games/tirano.js';
import cronohits from '../js/games/cronohits.js';
import { SONGS } from '../js/data/songs.js';
import { GameError, randInt } from '../js/util.js';

const P = (n) => Array.from({ length: n }, (_, i) => 'p' + i);
const act = (eng, s, pid, a, admin = false) => eng.act(s, { pid, admin }, a);
const throws = (fn, re) => assert.throws(fn, (e) => e instanceof GameError && (!re || re.test(e.message)));

// ---------------- Palabras ----------------
function palabrasReady(n = 4) {
  const s = palabras.setup(P(n));
  s.team = {};
  P(n).forEach((p, i) => (s.team[p] = i % 2 ? 'b' : 'r'));
  act(palabras, s, 'p0', { t: 'spy', team: 'r' });
  act(palabras, s, 'p1', { t: 'spy', team: 'b' });
  act(palabras, s, 'p0', { t: 'start' }, true);
  return s;
}

test('palabras: reparto 9/8/7/1 y empieza el equipo con 9', () => {
  for (let k = 0; k < 50; k++) {
    const s = palabrasReady();
    const c = (x) => s.key.filter((y) => y === x).length;
    assert.equal(c(s.start), 9);
    assert.equal(c(s.start === 'r' ? 'b' : 'r'), 8);
    assert.equal(c('n'), 7);
    assert.equal(c('a'), 1);
    assert.equal(s.turn, s.start);
    assert.equal(new Set(s.words).size, 25);
  }
});

test('palabras: el operativo no ve colores, el jefe sí', () => {
  const s = palabrasReady();
  const op = palabras.view(s, 'p2');
  assert.ok(op.colors.every((c) => c === null));
  const spy = palabras.view(s, 'p0');
  assert.ok(spy.colors.every((c) => c !== null));
});

test('palabras: validaciones de pista', () => {
  const s = palabrasReady();
  const spy = s.spy[s.turn];
  const op = s.players.find((p) => s.team[p] === s.turn && p !== spy);
  throws(() => act(palabras, s, op, { t: 'clue', word: 'x', num: 1, turnNo: s.turnNo }));
  throws(() => act(palabras, s, spy, { t: 'clue', word: 'dos palabras', num: 1, turnNo: s.turnNo }), /una sola/);
  throws(() => act(palabras, s, spy, { t: 'clue', word: s.words[0].toLowerCase(), num: 1, turnNo: s.turnNo }), /tablero/);
  throws(() => act(palabras, s, spy, { t: 'clue', word: 'zzz', num: 12, turnNo: s.turnNo }));
  act(palabras, s, spy, { t: 'clue', word: 'zzz', num: 2, turnNo: s.turnNo });
  assert.equal(s.guessesLeft, 3);
  throws(() => act(palabras, s, op, { t: 'pass', turnNo: s.turnNo }), /al menos una/);
  throws(() => act(palabras, s, spy, { t: 'guess', i: 0, turnNo: s.turnNo }), /jefe/);
});

test('palabras: número+1 intentos y fin de turno al fallar', () => {
  const s = palabrasReady();
  const t = s.turn;
  const spy = s.spy[t];
  const op = s.players.find((p) => s.team[p] === t && p !== spy);
  act(palabras, s, spy, { t: 'clue', word: 'zzz', num: 1, turnNo: s.turnNo });
  const own = s.key.map((c, i) => (c === t ? i : -1)).filter((i) => i >= 0);
  const tn = s.turnNo;
  act(palabras, s, op, { t: 'guess', i: own[0], turnNo: tn });
  assert.equal(s.turn, t);
  act(palabras, s, op, { t: 'guess', i: own[1], turnNo: tn });
  assert.notEqual(s.turn, t, 'tras número+1 aciertos cambia el turno');
  assert.equal(s.phase, 'clue');
  // acción vieja (turno anterior) rechazada
  throws(() => act(palabras, s, op, { t: 'guess', i: own[2], turnNo: tn }));
});

test('palabras: asesino = pierde; civil = fin de turno', () => {
  const s = palabrasReady();
  const t = s.turn;
  const spy = s.spy[t];
  const op = s.players.find((p) => s.team[p] === t && p !== spy);
  act(palabras, s, spy, { t: 'clue', word: 'zzz', num: '∞', turnNo: s.turnNo });
  assert.equal(s.guessesLeft, null);
  act(palabras, s, op, { t: 'guess', i: s.key.indexOf('n'), turnNo: s.turnNo });
  assert.notEqual(s.turn, t);
  const t2 = s.turn;
  const spy2 = s.spy[t2];
  const op2 = s.players.find((p) => s.team[p] === t2 && p !== spy2);
  act(palabras, s, spy2, { t: 'clue', word: 'yyy', num: 0, turnNo: s.turnNo });
  act(palabras, s, op2, { t: 'guess', i: s.key.indexOf('a'), turnNo: s.turnNo });
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, t);
  assert.equal(s.reason, 'assassin');
});

test('palabras: gana quien descubre todos (aunque los toque el rival)', () => {
  const s = palabrasReady();
  const t = s.turn;
  const o = t === 'r' ? 'b' : 'r';
  // Revelamos todos menos uno del rival "a mano" y que el turno toque el último del rival.
  const opp = s.key.map((c, i) => (c === o ? i : -1)).filter((i) => i >= 0);
  for (const i of opp.slice(0, -1)) s.revealed[i] = true;
  const spy = s.spy[t];
  const op = s.players.find((p) => s.team[p] === t && p !== spy);
  act(palabras, s, spy, { t: 'clue', word: 'zzz', num: 1, turnNo: s.turnNo });
  act(palabras, s, op, { t: 'guess', i: opp.at(-1), turnNo: s.turnNo });
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, o);
});

test('palabras: partidas aleatorias completas terminan siempre', () => {
  for (let k = 0; k < 300; k++) {
    const s = palabrasReady(6);
    let guard = 0;
    while (s.phase !== 'over' && guard++ < 500) {
      const t = s.turn;
      const spy = s.spy[t];
      const ops = s.players.filter((p) => s.team[p] === t && p !== spy);
      if (s.phase === 'clue') act(palabras, s, spy, { t: 'clue', word: 'pista' + guard, num: randInt(4), turnNo: s.turnNo });
      else {
        const free = s.revealed.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
        if (s.guessed > 0 && randInt(3) === 0) act(palabras, s, ops[0], { t: 'pass', turnNo: s.turnNo });
        else act(palabras, s, ops[randInt(ops.length)], { t: 'guess', i: free[randInt(free.length)], turnNo: s.turnNo });
      }
    }
    assert.equal(s.phase, 'over');
  }
});

// ---------------- Tirano ----------------
test('tirano: reparto de roles por número de jugadores', () => {
  const exp = { 5: [3, 1], 6: [4, 1], 7: [4, 2], 8: [5, 2], 9: [5, 3], 10: [6, 3] };
  for (const n of [5, 6, 7, 8, 9, 10]) {
    const s = tirano.setup(P(n));
    const r = Object.values(s.roles);
    assert.equal(r.filter((x) => x === 'L').length, exp[n][0]);
    assert.equal(r.filter((x) => x === 'F').length, exp[n][1]);
    assert.equal(r.filter((x) => x === 'T').length, 1);
    assert.equal(s.deck.filter((x) => x === 'L').length, 6);
    assert.equal(s.deck.filter((x) => x === 'F').length, 11);
  }
  assert.throws(() => tirano.setup(P(4)));
  assert.throws(() => tirano.setup(P(11)));
});

test('tirano: quién conoce a quién', () => {
  for (const n of [5, 6, 7, 10]) {
    const s = tirano.setup(P(n));
    const T = Object.keys(s.roles).find((p) => s.roles[p] === 'T');
    const F = Object.keys(s.roles).filter((p) => s.roles[p] === 'F');
    const L = Object.keys(s.roles).find((p) => s.roles[p] === 'L');
    assert.equal(tirano.view(s, L).know.length, 0);
    for (const f of F) assert.equal(tirano.view(s, f).know.length, F.length, 'conspirador ve al resto + Tirano');
    assert.equal(tirano.view(s, T).know.length, n <= 6 ? F.length : 0);
    // nadie ve el rol de otro en la vista salvo por "know"
    assert.equal(tirano.view(s, L).roles, null);
  }
});

test('tirano: poderes por número de jugadores', () => {
  assert.deepEqual(powersFor(5), [null, null, 'peek', 'execute', 'execute']);
  assert.deepEqual(powersFor(8), [null, 'investigate', 'special', 'execute', 'execute']);
  assert.deepEqual(powersFor(10), ['investigate', 'investigate', 'special', 'execute', 'execute']);
});

test('tirano: límites de mandato (y regla de 5 vivos)', () => {
  const s = tirano.setup(P(7));
  s.lastPres = 'p1';
  s.lastChan = 'p2';
  s.president = 'p0';
  assert.equal(canBeChancellor(s, 'p0'), false);
  assert.equal(canBeChancellor(s, 'p1'), false);
  assert.equal(canBeChancellor(s, 'p2'), false);
  assert.equal(canBeChancellor(s, 'p3'), true);
  s.alive.p5 = false;
  s.alive.p6 = false; // quedan 5 vivos
  assert.equal(canBeChancellor(s, 'p1'), true, 'con 5 vivos el último Presidente sí puede');
  assert.equal(canBeChancellor(s, 'p2'), false);
  assert.equal(canBeChancellor(s, 'p5'), false, 'los ejecutados no');
});

function voteAll(s, yes) {
  for (const p of s.seats) if (s.alive[p]) tirano.act(s, { pid: p }, { t: 'vote', yes: typeof yes === 'function' ? yes(p) : yes });
}

test('tirano: votación (empate = no), 3 fallos = caos sin poder y sin límites', () => {
  const s = tirano.setup(P(6));
  s.lastPres = 'p1';
  s.lastChan = 'p2';
  for (let k = 0; k < 3; k++) {
    const pres = s.president;
    const chan = s.seats.find((p) => canBeChancellor(s, p));
    tirano.act(s, { pid: pres }, { t: 'nominate', target: chan });
    let n = 0;
    voteAll(s, () => n++ < 3); // 3 sí, 3 no -> empate -> no
    assert.equal(s.lastVote.passed, false);
  }
  assert.equal(s.tracker, 0);
  assert.equal(s.lib + s.fas, 1, 'se aprobó la ley de arriba');
  assert.equal(s.lastPres, null);
  assert.equal(s.lastChan, null);
  assert.equal(s.phase, 'nominate');
  assert.equal(s.log.find((e) => e.k === 'enact').chaos, true);
});

test('tirano: rotación de la presidencia y elección especial', () => {
  const s = tirano.setup(P(8));
  s.rot = 0;
  s.president = 'p0';
  // Forzamos un gobierno que aprueba una conspiradora con poder "special" (slot 3 en 7-8)
  s.fas = 2;
  tirano.act(s, { pid: 'p0' }, { t: 'nominate', target: 'p1' });
  voteAll(s, true);
  s.hand = ['F', 'F', 'F'];
  tirano.act(s, { pid: 'p0' }, { t: 'discard', i: 0 });
  tirano.act(s, { pid: 'p1' }, { t: 'discard', i: 0 });
  assert.equal(s.fas, 3);
  assert.equal(s.phase, 'power');
  assert.equal(s.power, 'special');
  throws(() => tirano.act(s, { pid: 'p0' }, { t: 'power', target: 'p0' }));
  tirano.act(s, { pid: 'p0' }, { t: 'power', target: 'p5' });
  assert.equal(s.president, 'p5');
  // Tras la ronda especial, la presidencia vuelve a la izquierda de quien convocó (p1)
  const chan = s.seats.find((p) => canBeChancellor(s, p) && s.roles[p] !== 'T');
  tirano.act(s, { pid: 'p5' }, { t: 'nominate', target: chan });
  voteAll(s, false);
  assert.equal(s.president, 'p1');
});

test('tirano: el Tirano elegido Canciller con 3+ conspiradoras gana; si no, "no es el Tirano"', () => {
  const s = tirano.setup(P(7));
  const T = s.seats.find((p) => s.roles[p] === 'T');
  const notT = s.seats.find((p) => s.roles[p] !== 'T' && p !== s.president && canBeChancellor(s, p));
  s.fas = 3;
  tirano.act(s, { pid: s.president }, { t: 'nominate', target: notT });
  voteAll(s, true);
  assert.ok(s.notTyrant.includes(notT));
  // nuevo gobierno con el Tirano
  const s2 = tirano.setup(P(7));
  const T2 = s2.seats.find((p) => s2.roles[p] === 'T');
  s2.fas = 3;
  s2.president = s2.seats.find((p) => p !== T2);
  s2.rot = s2.seats.indexOf(s2.president);
  tirano.act(s2, { pid: s2.president }, { t: 'nominate', target: T2 });
  voteAll(s2, true);
  assert.equal(s2.phase, 'over');
  assert.equal(s2.winner, 'F');
  assert.equal(s2.reason, 'tyrant');
  assert.ok(T);
});

test('tirano: veto (con 5 conspiradoras) aceptado avanza el marcador', () => {
  const s = tirano.setup(P(5));
  s.fas = 5;
  s.president = 'p0';
  s.rot = 0;
  tirano.act(s, { pid: 'p0' }, { t: 'nominate', target: 'p1' });
  voteAll(s, true);
  if (s.phase === 'over') return; // p1 era el Tirano
  tirano.act(s, { pid: 'p0' }, { t: 'discard', i: 0 });
  tirano.act(s, { pid: 'p1' }, { t: 'veto' });
  assert.equal(s.phase, 'veto');
  tirano.act(s, { pid: 'p0' }, { t: 'vetoAnswer', yes: false });
  assert.equal(s.phase, 'chan');
  throws(() => tirano.act(s, { pid: 'p1' }, { t: 'veto' }), /rechazó/);
  // Otro gobierno para el veto aceptado
  const s2 = tirano.setup(P(5));
  s2.fas = 5;
  s2.president = 'p0';
  s2.rot = 0;
  tirano.act(s2, { pid: 'p0' }, { t: 'nominate', target: 'p2' });
  voteAll(s2, true);
  if (s2.phase === 'over') return;
  tirano.act(s2, { pid: 'p0' }, { t: 'discard', i: 0 });
  tirano.act(s2, { pid: 'p2' }, { t: 'veto' });
  tirano.act(s2, { pid: 'p0' }, { t: 'vetoAnswer', yes: true });
  assert.equal(s2.tracker, 1);
  assert.equal(s2.president, 'p1');
});

test('tirano: solo el presidente ve 3 cartas y solo el canciller ve 2', () => {
  const s = tirano.setup(P(5));
  const pres = s.president;
  const chan = s.seats.find((p) => canBeChancellor(s, p) && s.roles[p] !== 'T');
  tirano.act(s, { pid: pres }, { t: 'nominate', target: chan });
  voteAll(s, true);
  assert.equal(tirano.view(s, pres).hand.length, 3);
  assert.equal(tirano.view(s, chan).hand, null);
  tirano.act(s, { pid: pres }, { t: 'discard', i: 1 });
  assert.equal(tirano.view(s, pres).hand, null);
  assert.equal(tirano.view(s, chan).hand.length, 2);
  for (const p of s.seats) if (p !== chan) assert.equal(tirano.view(s, p).hand, null);
});

test('tirano: el mazo se rebaraja y las cartas se conservan (17 en total)', () => {
  for (let k = 0; k < 400; k++) {
    const n = 5 + randInt(6);
    const s = tirano.setup(P(n));
    let guard = 0;
    while (s.phase !== 'over' && guard++ < 400) {
      const pres = s.president;
      switch (s.phase) {
        case 'nominate':
          tirano.act(s, { pid: pres }, { t: 'nominate', target: tirano.view(s, pres).eligible[randInt(tirano.view(s, pres).eligible.length)] });
          break;
        case 'vote':
          voteAll(s, () => randInt(3) > 0);
          break;
        case 'pres':
          tirano.act(s, { pid: pres }, { t: 'discard', i: randInt(3) });
          break;
        case 'chan':
          if (s.fas >= 5 && !s.vetoRefused && randInt(3) === 0) tirano.act(s, { pid: s.chancellor }, { t: 'veto' });
          else tirano.act(s, { pid: s.chancellor }, { t: 'discard', i: randInt(2) });
          break;
        case 'veto':
          tirano.act(s, { pid: pres }, { t: 'vetoAnswer', yes: randInt(2) === 0 });
          break;
        case 'power': {
          const opts = s.seats.filter((p) => s.alive[p] && p !== pres && !(s.power === 'investigate' && s.investigated.includes(p)));
          tirano.act(s, { pid: pres }, { t: 'power', target: opts[randInt(opts.length)] });
          break;
        }
      }
      if (s.phase !== 'over') {
        const total = s.deck.length + s.discard.length + s.hand.length + s.lib + s.fas;
        assert.equal(total, 17, 'no se pierden ni duplican cartas');
        assert.ok(s.deck.length + s.hand.length >= 3 || s.phase !== 'nominate', 'siempre hay 3 cartas para robar');
        assert.ok(s.alive[s.president], 'el presidente siempre está vivo');
        assert.ok(s.tracker < 3);
      }
    }
    assert.equal(s.phase, 'over', 'la partida termina');
    assert.ok(['L', 'F'].includes(s.winner));
    if (s.reason === 'laws') assert.ok(s.lib === 5 || s.fas === 6);
  }
});

// ---------------- Cronohits ----------------
const yearOf = (line) => line.map((i) => SONGS[i][0]);
function correctGap(s, pid) {
  const y = SONGS[s.current][0];
  const ys = yearOf(s.lines[pid]);
  let g = 0;
  while (g < ys.length && ys[g] <= y) g++;
  return g;
}

test('cronohits: inicio con 1 carta y 2 fichas', () => {
  const s = cronohits.setup(P(4), { target: 10 });
  for (const p of s.seats) {
    assert.equal(s.lines[p].length, 1);
    assert.equal(s.tokens[p], 2);
  }
  assert.equal(s.phase, 'listen');
  const v = cronohits.view(s, 'p0');
  assert.equal(v.current, null, 'la canción en juego está oculta');
});

test('cronohits: acierto, reto y fichas', () => {
  const s = cronohits.setup(P(3), {});
  const a = s.seats[s.turnIdx];
  const others = s.seats.filter((p) => p !== a);
  const good = correctGap(s, a);
  const bad = good === 0 ? 1 : 0;
  // El activo falla; el retador acierta y se la lleva
  cronohits.act(s, { pid: a }, { t: 'place', gap: bad, turnNo: s.turnNo });
  assert.equal(s.phase, 'challenge');
  throws(() => cronohits.act(s, { pid: others[0] }, { t: 'challenge', gap: bad, turnNo: s.turnNo }), /elegido/);
  const ys = yearOf(s.lines[a]);
  const y = SONGS[s.current][0];
  const isRight = (g) => (g === 0 || ys[g - 1] <= y) && (g === ys.length || y <= ys[g]);
  if (!isRight(bad)) {
    cronohits.act(s, { pid: others[0] }, { t: 'challenge', gap: good, turnNo: s.turnNo });
    assert.equal(s.tokens[others[0]], 1);
    cronohits.act(s, { pid: others[1] }, { t: 'pass', turnNo: s.turnNo });
    assert.equal(s.phase, 'reveal');
    const before = s.lines[others[0]].length;
    cronohits.act(s, { pid: others[1] }, { t: 'judge', field: 'name', value: true, turnNo: s.turnNo });
    cronohits.act(s, { pid: a }, { t: 'next', turnNo: s.turnNo });
    assert.equal(s.lines[others[0]].length, before + 1, 'el retador se la lleva');
    assert.equal(s.lines[a].length, 1);
    assert.equal(s.tokens[a], 3, 'ficha por título+artista');
    const ly = yearOf(s.lines[others[0]]);
    assert.deepEqual(ly, [...ly].sort((x, z) => x - z), 'la línea del retador queda ordenada');
  }
});

test('cronohits: saltar y comprar cuestan fichas', () => {
  const s = cronohits.setup(P(2), {});
  const a = s.seats[s.turnIdx];
  const cur = s.current;
  cronohits.act(s, { pid: a }, { t: 'skip', turnNo: s.turnNo });
  assert.equal(s.tokens[a], 1);
  assert.notEqual(s.current, cur);
  throws(() => cronohits.act(s, { pid: a }, { t: 'buy', turnNo: s.turnNo }), /3 fichas/);
  s.tokens[a] = 3;
  cronohits.act(s, { pid: a }, { t: 'buy', turnNo: s.turnNo });
  assert.equal(s.tokens[a], 0);
  assert.equal(s.lines[a].length, 2);
});

test('cronohits: modo Pro exige título y artista', () => {
  const s = cronohits.setup(P(2), { mode: 'pro' });
  const a = s.seats[s.turnIdx];
  const o = s.seats.find((p) => p !== a);
  s.tokens[o] = 0; // sin retos
  cronohits.act(s, { pid: a }, { t: 'place', gap: correctGap(s, a), turnNo: s.turnNo });
  assert.equal(s.phase, 'reveal');
  assert.equal(cronohits.view(s, a).outcome.activeKeeps, false);
  cronohits.act(s, { pid: o }, { t: 'judge', field: 'name', value: true, turnNo: s.turnNo });
  assert.equal(cronohits.view(s, a).outcome.activeKeeps, true);
});

test('cronohits: partidas aleatorias terminan con alguien en la meta y líneas ordenadas', () => {
  for (let k = 0; k < 150; k++) {
    const n = 2 + randInt(6);
    const s = cronohits.setup(P(n), { target: 5 + randInt(6), mode: ['original', 'pro', 'expert'][randInt(3)] });
    let guard = 0;
    while (s.phase !== 'over' && guard++ < 5000) {
      const a = s.seats[s.turnIdx];
      if (s.phase === 'listen') {
        if (s.tokens[a] >= 3 && randInt(4) === 0) cronohits.act(s, { pid: a }, { t: 'buy', turnNo: s.turnNo });
        else if (s.tokens[a] >= 1 && randInt(6) === 0) cronohits.act(s, { pid: a }, { t: 'skip', turnNo: s.turnNo });
        else {
          const g = randInt(2) ? correctGap(s, a) : randInt(s.lines[a].length + 1);
          cronohits.act(s, { pid: a }, { t: 'place', gap: g, turnNo: s.turnNo });
        }
      } else if (s.phase === 'challenge') {
        const p = cronohits.view(s, a).pending[0];
        const free = Array.from({ length: s.lines[a].length + 1 }, (_, i) => i).filter((g) => g !== s.placed && !s.challenges.some((c) => c.gap === g));
        if (free.length && randInt(2)) cronohits.act(s, { pid: p }, { t: 'challenge', gap: free[randInt(free.length)], turnNo: s.turnNo });
        else cronohits.act(s, { pid: p }, { t: 'pass', turnNo: s.turnNo });
      } else if (s.phase === 'reveal') {
        const o = s.seats.find((p) => p !== a);
        if (randInt(2)) cronohits.act(s, { pid: o }, { t: 'judge', field: 'name', value: true, turnNo: s.turnNo });
        cronohits.act(s, { pid: a }, { t: 'next', turnNo: s.turnNo });
      }
      for (const p of s.seats) {
        const ys = yearOf(s.lines[p]);
        assert.deepEqual(ys, [...ys].sort((x, z) => x - z));
        assert.ok(s.tokens[p] >= 0 && s.tokens[p] <= 5);
      }
    }
    assert.equal(s.phase, 'over');
    assert.ok(s.winners.length >= 1);
  }
});
