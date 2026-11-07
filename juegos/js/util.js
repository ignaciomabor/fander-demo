// Utilidades comunes (sin dependencias, válidas en navegador y en Node para los tests).

const cryptoObj = globalThis.crypto;

/** Entero aleatorio criptográfico en [0, n). */
export function randInt(n) {
  if (n <= 0) return 0;
  const max = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do {
    cryptoObj.getRandomValues(buf);
    x = buf[0];
  } while (x >= max);
  return x % n;
}

/** Barajado Fisher–Yates (devuelve una copia). */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function rid(len = 12) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALNUM[randInt(ALNUM.length)];
  return s;
}

// Código de sala: letras fáciles de dictar (sin I, O, Ñ, Q, L).
const CODE_CHARS = 'ABCDEFGHJKMNPRSTUVWXYZ';
export function roomCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[randInt(CODE_CHARS.length)];
  return s;
}
export function normCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
}

/** Normaliza texto para comparar palabras (sin tildes, minúsculas). */
export function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function clone(o) {
  return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
}

/** Error de juego: mensaje mostrable al jugador. */
export class GameError extends Error {}
export function fail(msg) {
  throw new GameError(msg);
}

export const store = {
  get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nada */
    }
  },
};
