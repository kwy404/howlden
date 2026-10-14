// Local identity: a signing keypair made with WebCrypto on this device.
//
// - The keypair is Ed25519 where the browser supports it, ECDSA P-256 otherwise.
// - The member id is the first 16 hex characters of SHA-256(public key), and the
//   user tag is its first 4, so "Ana#a1b2" names one key, not just a name.
// - The key used every day is a non-extractable CryptoKey. A copy of the private
//   key bytes (PKCS #8) is kept only encrypted with AES-GCM, under a device key
//   that cannot be exported or, with a PIN lock, under a key derived from the
//   PIN. It is decrypted in memory only to build an encrypted backup file or to
//   unlock the account. Without that copy an account could never move to
//   another device, and a plain extractable key would be readable by any script
//   on the page at any time.
// - When two peers connect, each signs a challenge bound to the DTLS
//   fingerprints of that very connection, so a signature cannot be replayed on
//   another connection or relayed by someone in the middle.

import { fromBase64Url, toBase64Url } from './invite.js';

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
export const BACKUP_ITERATIONS = 600000;
export const PIN_ITERATIONS = 310000;

const ALGS = {
  Ed25519: { gen: { name: 'Ed25519' }, imp: { name: 'Ed25519' }, sign: { name: 'Ed25519' } },
  'ECDSA-P256': { gen: { name: 'ECDSA', namedCurve: 'P-256' }, imp: { name: 'ECDSA', namedCurve: 'P-256' }, sign: { name: 'ECDSA', hash: 'SHA-256' } },
};

/** Which signature algorithm this browser can use, preferring Ed25519. */
export async function pickAlgorithm() {
  try {
    await subtle().generateKey(ALGS.Ed25519.gen, false, ['sign', 'verify']);
    return 'Ed25519';
  } catch {
    return 'ECDSA-P256';
  }
}

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 of the raw public key, as hex. */
export async function keyFingerprint(publicRaw) {
  return hex(new Uint8Array(await subtle().digest('SHA-256', publicRaw)));
}

/** Member id (16 hex) and tag (4 hex) of a public key. */
export async function idFromPublicKey(publicRaw) {
  const fp = await keyFingerprint(publicRaw);
  return { id: fp.slice(0, 16), tag: fp.slice(0, 4), fingerprint: fp };
}

/** Display form "name#tag". */
export function handle(name, tag) {
  return `${name}#${tag}`;
}

/**
 * Make a new identity. Returns the non-extractable signing key, the public
 * key, and the PKCS #8 bytes of the private key, which the caller must
 * encrypt right away and then drop.
 */
export async function createIdentity(alg) {
  const algorithm = alg || (await pickAlgorithm());
  const a = ALGS[algorithm];
  const pair = await subtle().generateKey(a.gen, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
  const publicRaw = new Uint8Array(await subtle().exportKey('raw', pair.publicKey));
  const signingKey = await subtle().importKey('pkcs8', pkcs8, a.imp, false, ['sign']);
  const ids = await idFromPublicKey(publicRaw);
  return { alg: algorithm, signingKey, publicRaw, publicKey: toBase64Url(publicRaw), pkcs8, ...ids };
}

/** Rebuild the non-extractable signing key from PKCS #8 bytes (after unlock or restore). */
export async function importIdentity({ alg, pkcs8, publicKey }) {
  const a = ALGS[alg];
  if (!a) throw new TypeError(`unknown algorithm ${alg}`);
  const signingKey = await subtle().importKey('pkcs8', pkcs8, a.imp, false, ['sign']);
  const publicRaw = fromBase64Url(publicKey);
  const ids = await idFromPublicKey(publicRaw);
  return { alg, signingKey, publicRaw, publicKey, ...ids };
}

/** Sign bytes or text. Returns base64url. */
export async function sign(identity, data) {
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  return toBase64Url(new Uint8Array(await subtle().sign(ALGS[identity.alg].sign, identity.signingKey, bytes)));
}

/** Verify a base64url signature from a public key given as base64url. */
export async function verify({ alg, publicKey }, data, signature) {
  const a = ALGS[alg];
  if (!a) return false;
  try {
    const key = await subtle().importKey('raw', fromBase64Url(publicKey), a.imp, false, ['verify']);
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    return await subtle().verify(a.sign, key, fromBase64Url(signature), bytes);
  } catch {
    return false;
  }
}

/** A random challenge nonce. */
export function nonce() {
  return toBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

/** The exact text a peer signs to prove its identity on one connection. */
export function challengeText({ connection, theirNonce, signerId, peerId }) {
  return `howlden-identity-v1|${connection}|${theirNonce}|${signerId}|${peerId}`;
}

/** Answer a peer's challenge on a connection. */
export function proveIdentity(identity, { connection, theirNonce, peerId }) {
  return sign(identity, challengeText({ connection, theirNonce, signerId: identity.id, peerId }));
}

/**
 * Check a peer's proof. The claimed id must be the hash of the claimed public
 * key, and the signature must cover this connection and my nonce.
 * Returns 'verified' or a failure reason.
 */
export async function checkProof({ claimedId, alg, publicKey, signature, connection, myNonce, myId }) {
  if (!ALGS[alg]) return 'unsupported';
  let ids;
  try {
    ids = await idFromPublicKey(fromBase64Url(publicKey));
  } catch {
    return 'bad-key';
  }
  if (ids.id !== claimedId) return 'id-mismatch';
  const ok = await verify({ alg, publicKey }, challengeText({ connection, theirNonce: myNonce, signerId: claimedId, peerId: myId }), signature);
  return ok ? 'verified' : 'bad-signature';
}

/**
 * Compare a verified peer with the friends list.
 * Returns 'known' (same key as before), 'new', or 'name-clash' when a friend
 * with the same name uses a different key.
 */
export function friendStatus(friends, peer) {
  const same = friends.find((f) => f.id === peer.id);
  if (same) return same.publicKey === peer.publicKey ? 'known' : 'key-changed';
  const name = String(peer.name || '').trim().toLowerCase();
  if (name && friends.some((f) => String(f.name || '').trim().toLowerCase() === name && f.publicKey !== peer.publicKey)) return 'name-clash';
  return 'new';
}

// Symmetric helpers for the PIN lock, the device key and backups.

/** A non-extractable AES-GCM key for this device. */
export function deviceKey() {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Derive an AES-GCM key from a PIN or password. */
export async function passwordKey(secret, salt, iterations) {
  if (!secret) throw new TypeError('empty secret');
  const material = await subtle().importKey('raw', enc.encode(String(secret).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function randomSalt() {
  return globalThis.crypto.getRandomValues(new Uint8Array(16));
}

/** Encrypt bytes: 12 byte IV then ciphertext. */
export async function seal(key, bytes, aad = 'howlden') {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

/** Decrypt bytes from seal(). Throws on a wrong key or tampering. */
export async function unseal(key, data, aad = 'howlden') {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: enc.encode(aad) }, key, bytes.subarray(12)));
}

/** A PIN lock record: random salt plus a check value. */
export async function createPinLock(pin, iterations = PIN_ITERATIONS) {
  if (!/^\d{4,12}$/.test(String(pin))) throw new TypeError('PIN must be 4 to 12 digits');
  const salt = randomSalt();
  const key = await passwordKey(pin, salt, iterations);
  const check = await seal(key, enc.encode('howlden-pin'), 'pin-check');
  return { key, lock: { salt: toBase64Url(salt), iterations, check: toBase64Url(check) } };
}

/** Unlock with a PIN. Returns the key, or null when the PIN is wrong. */
export async function openPinLock(pin, lock) {
  try {
    const key = await passwordKey(pin, fromBase64Url(lock.salt), lock.iterations);
    await unseal(key, fromBase64Url(lock.check), 'pin-check');
    return key;
  } catch {
    return null;
  }
}

/**
 * Build an encrypted backup file (JSON text). The payload holds the profile,
 * the private key bytes and the friends list, encrypted with AES-GCM under a
 * key derived from the backup password with PBKDF2.
 */
export async function exportBackup(payload, password, iterations = BACKUP_ITERATIONS) {
  if (String(password || '').length < 8) throw new TypeError('Use a backup password of at least 8 characters.');
  const salt = randomSalt();
  const key = await passwordKey(password, salt, iterations);
  const body = enc.encode(JSON.stringify(payload));
  const ct = await seal(key, body, 'howlden-backup-v1');
  return JSON.stringify({ format: 'howlden-backup', v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64Url(salt) }, cipher: 'AES-GCM', data: toBase64Url(ct) }, null, 2);
}

/** Open a backup file. Throws BackupError with a readable reason. */
export async function importBackup(text, password) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new BackupError('format', 'This is not a howlden backup file.');
  }
  if (file?.format !== 'howlden-backup' || file.v !== 1 || file.kdf?.name !== 'PBKDF2') throw new BackupError('format', 'This is not a howlden backup file.');
  const iterations = Number(file.kdf.iterations);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 10000000) throw new BackupError('format', 'This backup file is damaged.');
  let plain;
  try {
    const key = await passwordKey(password, fromBase64Url(file.kdf.salt), iterations);
    plain = await unseal(key, fromBase64Url(file.data), 'howlden-backup-v1');
  } catch {
    throw new BackupError('password', 'Wrong backup password, or the file is damaged.');
  }
  return JSON.parse(new TextDecoder().decode(plain));
}

export class BackupError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'BackupError';
    this.reason = reason;
  }
}

/** The id of the 1 to 1 conversation between two members, the same on both sides. */
export async function directId(a, b) {
  const [x, y] = [a, b].sort();
  return hex(new Uint8Array(await subtle().digest('SHA-256', enc.encode(`howlden-dm|${x}|${y}`)))).slice(0, 16);
}
