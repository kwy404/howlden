// Copied from src/ by scripts/sync-core.mjs. Edit the file in src/ instead.
// Optional passphrase layer and connection fingerprints.
// WebRTC already encrypts every connection with DTLS. A den passphrase adds a
// second layer on chat payloads and file chunks: PBKDF2 (SHA-256) derives an
// AES-GCM key, salted with the den id, so every member who knows the
// passphrase derives the same key and nobody else can read the payloads.

import { fromBase64Url, toBase64Url } from './invite.js';

export const KDF_ITERATIONS = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

/** Random id as lowercase hex, 2 characters per byte. */
export function randomId(bytes = 8) {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Derive an AES-GCM key from a passphrase, salted with the den id. */
export async function deriveKey(passphrase, salt, iterations = KDF_ITERATIONS) {
  if (!passphrase) throw new TypeError('passphrase is empty');
  const material = await subtle().importKey('raw', enc.encode(String(passphrase).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`howlden:${salt}`), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt bytes. Output is the 12 byte IV followed by ciphertext and tag. */
export async function encryptBytes(key, bytes, aad) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const params = aad ? { name: 'AES-GCM', iv, additionalData: enc.encode(aad) } : { name: 'AES-GCM', iv };
  const ct = new Uint8Array(await subtle().encrypt(params, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

/** Decrypt bytes from encryptBytes. Throws when the key or data is wrong. */
export async function decryptBytes(key, data, aad) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 28) throw new Error('ciphertext too short');
  const iv = bytes.subarray(0, 12);
  const params = aad ? { name: 'AES-GCM', iv, additionalData: enc.encode(aad) } : { name: 'AES-GCM', iv };
  return new Uint8Array(await subtle().decrypt(params, key, bytes.subarray(12)));
}

/** Encrypt a JSON value to a compact string. */
export async function encryptJSON(key, value, aad) {
  return toBase64Url(await encryptBytes(key, enc.encode(JSON.stringify(value)), aad));
}

/** Decrypt a string from encryptJSON. */
export async function decryptJSON(key, text, aad) {
  return JSON.parse(dec.decode(await decryptBytes(key, fromBase64Url(text), aad)));
}

/** A token members can decrypt to prove they derived the same key. */
export function keyCheck(key) {
  return encryptJSON(key, { check: 'howlden' }, 'check');
}

/** True when the token from keyCheck decrypts with this key. */
export async function verifyKeyCheck(key, token) {
  try {
    return (await decryptJSON(key, token, 'check'))?.check === 'howlden';
  } catch {
    return false;
  }
}

/** The DTLS certificate fingerprints announced in an SDP, normalized. */
export function sdpFingerprints(sdp) {
  const out = [];
  for (const line of String(sdp || '').split(/\r?\n/)) {
    const m = /^a=fingerprint:(\S+)\s+([0-9A-Fa-f:]+)/.exec(line.trim());
    if (m) out.push(`${m[1].toLowerCase()} ${m[2].toUpperCase()}`);
  }
  return [...new Set(out)];
}

/**
 * A short fingerprint of one connection, the same on both ends. It hashes the
 * DTLS fingerprints of both sides, so a relay that swapped certificates in the
 * middle would make the two screens show different values.
 */
export async function connectionFingerprint(localSdp, remoteSdp) {
  const all = [...sdpFingerprints(localSdp), ...sdpFingerprints(remoteSdp)].sort();
  if (all.length < 2) return '';
  const hash = new Uint8Array(await subtle().digest('SHA-256', enc.encode(all.join('\n'))));
  const hex = Array.from(hash.subarray(0, 10), (x) => x.toString(16).padStart(2, '0').toUpperCase()).join('');
  return hex.match(/.{4}/g).join(' ');
}
