import { describe, expect, it } from 'vitest';
import {
  checkProof,
  createIdentity,
  createPinLock,
  deviceKey,
  directId,
  exportBackup,
  friendStatus,
  handle,
  idFromPublicKey,
  importBackup,
  importIdentity,
  nonce,
  openPinLock,
  pickAlgorithm,
  proveIdentity,
  seal,
  sign,
  unseal,
  verify,
} from '../src/identity.js';
import { fromBase64Url } from '../src/invite.js';

const FAST = 1000;
const algs = ['ECDSA-P256'];
if ((await pickAlgorithm()) === 'Ed25519') algs.push('Ed25519');

describe.each(algs)('identity with %s', (alg) => {
  it('derives the id and tag from the public key', async () => {
    const me = await createIdentity(alg);
    expect(me.id).toMatch(/^[0-9a-f]{16}$/);
    expect(me.tag).toBe(me.id.slice(0, 4));
    expect(me.fingerprint.startsWith(me.id)).toBe(true);
    expect((await idFromPublicKey(fromBase64Url(me.publicKey))).id).toBe(me.id);
    expect(handle('Ana', me.tag)).toBe(`Ana#${me.tag}`);
    const other = await createIdentity(alg);
    expect(other.id).not.toBe(me.id);
  });

  it('keeps the signing key non-extractable', async () => {
    const me = await createIdentity(alg);
    expect(me.signingKey.extractable).toBe(false);
    await expect(globalThis.crypto.subtle.exportKey('pkcs8', me.signingKey)).rejects.toThrow();
  });

  it('signs and verifies, and rejects other keys and data', async () => {
    const me = await createIdentity(alg);
    const other = await createIdentity(alg);
    const sig = await sign(me, 'hello');
    expect(await verify(me, 'hello', sig)).toBe(true);
    expect(await verify(me, 'hellp', sig)).toBe(false);
    expect(await verify(other, 'hello', sig)).toBe(false);
    expect(await verify({ alg: 'nope', publicKey: me.publicKey }, 'hello', sig)).toBe(false);
    expect(await verify({ alg, publicKey: 'garbage' }, 'hello', sig)).toBe(false);
  });

  it('rebuilds the same identity from its PKCS 8 bytes', async () => {
    const me = await createIdentity(alg);
    const again = await importIdentity({ alg, pkcs8: me.pkcs8, publicKey: me.publicKey });
    expect(again.id).toBe(me.id);
    expect(await verify(me, 'x', await sign(again, 'x'))).toBe(true);
  });

  it('proves identity bound to one connection', async () => {
    const ana = await createIdentity(alg);
    const bia = await createIdentity(alg);
    const connection = 'AAAA BBBB CCCC DDDD EEEE';
    const biaNonce = nonce();
    const signature = await proveIdentity(ana, { connection, theirNonce: biaNonce, peerId: bia.id });
    const base = { claimedId: ana.id, alg, publicKey: ana.publicKey, signature, connection, myNonce: biaNonce, myId: bia.id };
    expect(await checkProof(base)).toBe('verified');
    expect(await checkProof({ ...base, connection: 'AAAA BBBB CCCC DDDD FFFF' })).toBe('bad-signature');
    expect(await checkProof({ ...base, myNonce: nonce() })).toBe('bad-signature');
    expect(await checkProof({ ...base, myId: ana.id })).toBe('bad-signature');
    expect(await checkProof({ ...base, claimedId: bia.id })).toBe('id-mismatch');
    expect(await checkProof({ ...base, publicKey: bia.publicKey, claimedId: bia.id })).toBe('bad-signature');
    expect(await checkProof({ ...base, alg: 'RSA' })).toBe('unsupported');
  });
});

describe('friends', () => {
  it('flags new people, known keys, changed keys and name clashes', () => {
    const friends = [{ id: 'aaaa000000000001', name: 'Ana', publicKey: 'k1' }];
    expect(friendStatus(friends, { id: 'aaaa000000000001', name: 'Ana', publicKey: 'k1' })).toBe('known');
    expect(friendStatus(friends, { id: 'aaaa000000000001', name: 'Ana', publicKey: 'k9' })).toBe('key-changed');
    expect(friendStatus(friends, { id: 'bbbb000000000002', name: ' ana ', publicKey: 'k2' })).toBe('name-clash');
    expect(friendStatus(friends, { id: 'bbbb000000000002', name: 'Bia', publicKey: 'k2' })).toBe('new');
  });

  it('gives both sides the same direct conversation id', async () => {
    const a = await directId('aaaa', 'bbbb');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await directId('bbbb', 'aaaa')).toBe(a);
    expect(await directId('aaaa', 'cccc')).not.toBe(a);
  });
});

describe('PIN lock', () => {
  it('opens with the right PIN only', async () => {
    const { key, lock } = await createPinLock('2468', FAST);
    const secret = await seal(key, new Uint8Array([1, 2, 3]));
    const again = await openPinLock('2468', lock);
    expect(Array.from(await unseal(again, secret))).toEqual([1, 2, 3]);
    expect(await openPinLock('1357', lock)).toBe(null);
    expect(JSON.stringify(lock)).not.toContain('2468');
  });

  it('accepts only 4 to 12 digits', async () => {
    await expect(createPinLock('12', FAST)).rejects.toThrow(TypeError);
    await expect(createPinLock('abcd', FAST)).rejects.toThrow(TypeError);
  });

  it('protects the private key copy with the device key', async () => {
    const me = await createIdentity('ECDSA-P256');
    const dev = await deviceKey();
    expect(dev.extractable).toBe(false);
    const wrapped = await seal(dev, me.pkcs8, 'identity');
    await expect(unseal(dev, wrapped, 'other')).rejects.toThrow();
    const back = await importIdentity({ alg: me.alg, pkcs8: await unseal(dev, wrapped, 'identity'), publicKey: me.publicKey });
    expect(back.id).toBe(me.id);
  });
});

describe('backup', () => {
  it('round trips the account through an encrypted file', async () => {
    const me = await createIdentity('ECDSA-P256');
    const payload = { profile: { id: me.id, name: 'Ana' }, alg: me.alg, publicKey: me.publicKey, pkcs8: Array.from(me.pkcs8), friends: [{ id: 'f1', name: 'Bia' }] };
    const file = await exportBackup(payload, 'correct horse battery', FAST);
    expect(file).not.toContain('Ana');
    expect(JSON.parse(file)).toMatchObject({ format: 'howlden-backup', v: 1, cipher: 'AES-GCM', kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: FAST } });
    const back = await importBackup(file, 'correct horse battery');
    expect(back).toEqual(payload);
    const restored = await importIdentity({ alg: back.alg, pkcs8: Uint8Array.from(back.pkcs8), publicKey: back.publicKey });
    expect(restored.id).toBe(me.id);
    expect(await verify(me, 'moved', await sign(restored, 'moved'))).toBe(true);
  });

  it('explains wrong passwords and foreign files', async () => {
    const file = await exportBackup({ a: 1 }, 'password123', FAST);
    await expect(importBackup(file, 'password124')).rejects.toMatchObject({ reason: 'password' });
    await expect(importBackup('{"x":1}', 'password123')).rejects.toMatchObject({ reason: 'format' });
    await expect(importBackup('not json', 'password123')).rejects.toMatchObject({ reason: 'format' });
    const bad = JSON.parse(file);
    bad.kdf.iterations = 5;
    await expect(importBackup(JSON.stringify(bad), 'password123')).rejects.toMatchObject({ reason: 'format' });
    await expect(exportBackup({}, 'short')).rejects.toThrow(/8 characters/);
  });
});
