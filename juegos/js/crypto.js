// Cifrado extremo a extremo entre cada jugador y el admin (ECDH P-256 + AES-GCM).
// El servidor de mensajería es público: así nadie de fuera (ni un jugador curioso)
// puede leer los roles o cartas de otro jugador ni hacerse pasar por él.

const subtle = globalThis.crypto.subtle;
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Crea un par de claves y lo devuelve exportado como JWK (para guardarlo). */
export async function newKeyPair() {
  const kp = await subtle.generateKey(ECDH, true, ['deriveKey']);
  return {
    pub: await subtle.exportKey('jwk', kp.publicKey),
    priv: await subtle.exportKey('jwk', kp.privateKey),
  };
}

/** Clave AES compartida a partir de mi privada y la pública del otro. */
export async function sharedKey(privJwk, pubJwk) {
  const priv = await subtle.importKey('jwk', privJwk, ECDH, false, ['deriveKey']);
  const pub = await subtle.importKey('jwk', pubJwk, ECDH, false, []);
  return subtle.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export async function seal(key, obj) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

/** Devuelve el objeto descifrado o null si no se puede (clave incorrecta, datos rotos). */
export async function open(key, msg) {
  try {
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(msg.iv) }, key, unb64(msg.ct));
    return JSON.parse(dec.decode(pt));
  } catch {
    return null;
  }
}

/** Huella corta de una clave pública (para detectar cambios). */
export function keyId(jwk) {
  return jwk ? `${jwk.x}.${jwk.y}` : '';
}
