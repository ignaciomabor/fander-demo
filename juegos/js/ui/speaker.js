// Altavoz de Cronohits: suena en el dispositivo del admin.
// Busca un fragmento de 30 s de la canción en iTunes y, si no, en Deezer (JSONP, sin claves).

import { fold } from '../util.js';

const cache = new Map();
let jsonpN = 0;

function jsonp(url, timeout = 7000) {
  return new Promise((resolve, reject) => {
    const cb = `__mj_cb${Date.now()}_${jsonpN++}`;
    const s = document.createElement('script');
    const done = (err, data) => {
      clearTimeout(t);
      delete window[cb];
      s.remove();
      err ? reject(err) : resolve(data);
    };
    const t = setTimeout(() => done(new Error('timeout')), timeout);
    window[cb] = (data) => done(null, data);
    s.onerror = () => done(new Error('network'));
    s.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    document.head.appendChild(s);
  });
}

const clean = (s) => fold(s).replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const mainArtist = (a) => clean(a.split(/ & | feat\.? | y los | con /i)[0]);

function matches(artist, title, gotArtist, gotTitle) {
  const a = mainArtist(artist);
  const t = clean(title).split(' ').slice(0, 3).join(' ');
  const ga = clean(gotArtist);
  const gt = clean(gotTitle);
  return (ga.includes(a) || a.includes(ga)) && gt.includes(t);
}

async function fromItunes(artist, title) {
  const term = encodeURIComponent(`${mainArtist(artist)} ${clean(title)}`);
  for (const country of ['ES', 'US']) {
    const r = await jsonp(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=15&country=${country}`);
    const hit = (r.results || []).find((x) => x.previewUrl && matches(artist, title, x.artistName || '', x.trackName || ''));
    if (hit) return hit.previewUrl;
  }
  return null;
}

async function fromDeezer(artist, title) {
  const q = encodeURIComponent(`${mainArtist(artist)} ${clean(title)}`);
  const r = await jsonp(`https://api.deezer.com/search?q=${q}&limit=15&output=jsonp`);
  const hit = (r.data || []).find((x) => x.preview && matches(artist, title, x.artist?.name || '', x.title || ''));
  return hit ? hit.preview : null;
}

export async function findPreview(artist, title) {
  const k = artist + '|' + title;
  if (cache.has(k)) return cache.get(k);
  let url = null;
  try {
    url = await fromItunes(artist, title);
  } catch {
    /* probamos Deezer */
  }
  if (!url) {
    try {
      url = await fromDeezer(artist, title);
    } catch {
      /* sin audio */
    }
  }
  if (url) cache.set(k, url);
  return url;
}

// Sonido mudo (0,1 s) para "desbloquear" el audio en móviles con el primer toque.
const SILENCE = (() => {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const dv = new DataView(b.buffer);
  const str = (o, t) => [...t].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true);
  dv.setUint32(28, 8000, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  str(36, 'data');
  dv.setUint32(40, n, true);
  b.fill(128, 44);
  let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return 'data:audio/wav;base64,' + btoa(bin);
})();

export class Speaker {
  constructor(onChange) {
    this.el = new Audio();
    this.el.loop = true;
    this.el.preload = 'auto';
    this.onChange = onChange;
    this.state = 'idle'; // idle | loading | playing | blocked | paused | missing
    this.key = null;
    this.el.addEventListener('playing', () => this._set('playing'));
    this.el.addEventListener('pause', () => this.state === 'playing' && this._set('paused'));
  }

  _set(s) {
    this.state = s;
    this.onChange?.(s);
  }

  /** Llamar dentro de un toque del usuario. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    const src = this.el.src;
    if (!src) {
      this.el.src = SILENCE;
      this.el.play().catch(() => {});
    } else this.el.play().catch(() => {});
  }

  /** np: { idx, nonce, artist, title } | null */
  async sync(np, onMissing) {
    if (!np) {
      this.key = null;
      this.el.pause();
      this._set('idle');
      return;
    }
    const key = np.idx + ':' + np.nonce;
    if (key === this.key) return;
    const sameSong = this.key && this.key.split(':')[0] === String(np.idx);
    this.key = key;
    if (sameSong && this.el.src && !this.el.src.startsWith('data:')) {
      this.el.currentTime = 0;
      return this._play();
    }
    this.el.pause();
    this._set('loading');
    const url = await findPreview(np.artist, np.title);
    if (this.key !== key) return; // ya ha cambiado de canción
    if (!url) {
      this._set('missing');
      onMissing?.(np.idx);
      return;
    }
    this.el.src = url;
    this.el.currentTime = 0;
    this._play();
  }

  _play() {
    return this.el.play().then(
      () => this._set('playing'),
      () => this._set('blocked'),
    );
  }

  toggle() {
    if (this.el.paused) this._play();
    else this.el.pause();
  }

  stop() {
    this.key = null;
    this.el.pause();
  }
}
