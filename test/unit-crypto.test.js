import { describe, expect, it } from 'vitest';
import {
  connectionFingerprint,
  decryptBytes,
  decryptJSON,
  deriveKey,
  encryptBytes,
  encryptJSON,
  keyCheck,
  randomId,
  sdpFingerprints,
  verifyKeyCheck,
} from '../src/crypto.js';

const FAST = 1000;
const fp = (hex) => `a=fingerprint:sha-256 ${hex}`;
const A = '6B:8B:5D:EA:59:04:20:23:29:C8:87:1C:CD:87:32:BE:DD:8C:66:A5:8E:50:55:EA:20:C8:EF:59:0E:28:1E:9C';
const B = '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00';
const C = 'FE:ED:FA:CE:59:04:20:23:29:C8:87:1C:CD:87:32:BE:DD:8C:66:A5:8E:50:55:EA:20:C8:EF:59:0E:28:1E:9C';

describe('ids', () => {
  it('makes random hex ids', () => {
    expect(randomId()).toMatch(/^[0-9a-f]{16}$/);
    expect(randomId(4)).toMatch(/^[0-9a-f]{8}$/);
    expect(randomId()).not.toBe(randomId());
  });
});

describe('passphrase encryption', () => {
  it('derives the same key from the same passphrase and den', async () => {
    const k1 = await deriveKey('correct horse', 'den1', FAST);
    const k2 = await deriveKey('correct horse', 'den1', FAST);
    const text = await encryptJSON(k1, { text: 'hello', n: 1 });
    expect(await decryptJSON(k2, text)).toEqual({ text: 'hello', n: 1 });
  });

  it('fails with a different passphrase or den', async () => {
    const k1 = await deriveKey('correct horse', 'den1', FAST);
    const wrong = await deriveKey('correct horsf', 'den1', FAST);
    const otherDen = await deriveKey('correct horse', 'den2', FAST);
    const text = await encryptJSON(k1, 'secret');
    await expect(decryptJSON(wrong, text)).rejects.toThrow();
    await expect(decryptJSON(otherDen, text)).rejects.toThrow();
  });

  it('uses a fresh IV every time and detects tampering', async () => {
    const key = await deriveKey('pw', 'den', FAST);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const a = await encryptBytes(key, bytes);
    const b = await encryptBytes(key, bytes);
    expect(a.length).toBe(12 + 4 + 16);
    expect(Array.from(a.subarray(0, 12))).not.toEqual(Array.from(b.subarray(0, 12)));
    expect(Array.from(await decryptBytes(key, a))).toEqual([1, 2, 3, 4]);
    a[20] ^= 1;
    await expect(decryptBytes(key, a)).rejects.toThrow();
    await expect(decryptBytes(key, new Uint8Array(10))).rejects.toThrow(/too short/);
  });

  it('binds additional data', async () => {
    const key = await deriveKey('pw', 'den', FAST);
    const sealed = await encryptBytes(key, new Uint8Array([9]), 'file:1');
    expect(Array.from(await decryptBytes(key, sealed.buffer, 'file:1'))).toEqual([9]);
    await expect(decryptBytes(key, sealed, 'file:2')).rejects.toThrow();
  });

  it('normalizes unicode so composed and decomposed passphrases match', async () => {
    const k1 = await deriveKey('maçã', 'den', FAST);
    const k2 = await deriveKey('maçã', 'den', FAST);
    expect(await verifyKeyCheck(k2, await keyCheck(k1))).toBe(true);
  });

  it('verifies a key check token', async () => {
    const key = await deriveKey('pw', 'den', FAST);
    const other = await deriveKey('pw2', 'den', FAST);
    const token = await keyCheck(key);
    expect(await verifyKeyCheck(key, token)).toBe(true);
    expect(await verifyKeyCheck(other, token)).toBe(false);
    expect(await verifyKeyCheck(key, 'garbage')).toBe(false);
  });

  it('refuses an empty passphrase', async () => {
    await expect(deriveKey('', 'den')).rejects.toThrow(TypeError);
  });
});

describe('connection fingerprint', () => {
  it('reads DTLS fingerprints from SDP', () => {
    const sdp = `v=0\r\n${fp(A.toLowerCase())}\r\nm=application\r\n${fp(A)}\r\n`;
    expect(sdpFingerprints(sdp)).toEqual([`sha-256 ${A}`]);
    expect(sdpFingerprints('')).toEqual([]);
  });

  it('is the same on both ends and changes when a certificate changes', async () => {
    const local = await connectionFingerprint(fp(A), fp(B));
    const remote = await connectionFingerprint(fp(B), fp(A));
    expect(local).toMatch(/^[0-9A-F]{4}( [0-9A-F]{4}){4}$/);
    expect(remote).toBe(local);
    expect(await connectionFingerprint(fp(A), fp(C))).not.toBe(local);
    expect(await connectionFingerprint(fp(A), '')).toBe('');
  });
});
