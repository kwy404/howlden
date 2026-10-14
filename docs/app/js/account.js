// The local account: profile, identity keypair, optional PIN lock, backups.
// The account lives only on this device. There is no server, email or password.

import { createIdentity, createPinLock, deviceKey, exportBackup, importBackup, importIdentity, openPinLock, seal, unseal } from '../core/identity.js';
import * as store from './store.js';

const COOKIE = 'howlden_account';

export function hasAccountCookie() {
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${COOKIE}=`));
}

function setCookie(on) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = on ? `${COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Strict${secure}` : `${COOKIE}=; Max-Age=0; Path=/; SameSite=Strict${secure}`;
}

/** Load the account. Returns { state: 'none' | 'locked' | 'ready', profile, identity }. */
export async function loadAccount() {
  const lock = await store.getAccount('pin');
  const idRow = await store.getAccount('identity');
  if (!idRow) return { state: 'none' };
  if (lock) return { state: 'locked', lock };
  const profile = await store.getAccount('profile');
  const identity = { alg: idRow.alg, signingKey: idRow.signingKey, publicKey: idRow.publicKey, id: idRow.id, tag: idRow.tag };
  setCookie(true);
  return { state: 'ready', profile: cleanProfile(profile), identity };
}

function cleanProfile(p) {
  if (!p) return null;
  const { k: _k, id, name, avatar, accent, status, tag, createdAt } = p;
  return { id, name, avatar, accent: accent || '', status: status || '', tag, createdAt };
}

/** Make a new account: identity keypair, profile and the cookie flag. */
export async function createAccount({ name, avatar, accent = '' }) {
  const me = await createIdentity();
  const dev = await deviceKey();
  await store.putAccount('device', { key: dev });
  await store.putAccount('identity', { alg: me.alg, publicKey: me.publicKey, id: me.id, tag: me.tag, signingKey: me.signingKey, wrapped: await seal(dev, me.pkcs8, 'identity') });
  me.pkcs8.fill(0);
  const profile = { id: me.id, tag: me.tag, name, avatar, accent, status: '', createdAt: Date.now() };
  await store.putAccount('profile', profile);
  setCookie(true);
  return { profile, identity: { alg: me.alg, signingKey: me.signingKey, publicKey: me.publicKey, id: me.id, tag: me.tag } };
}

export async function saveProfile(profile) {
  await store.putAccount('profile', profile, { sealed: store.hasVault() });
}

/** Read the PKCS #8 copy of the private key, only to build a backup or move under a PIN. */
async function privateBytes() {
  const row = await store.getAccount('identity');
  if (store.hasVault()) return { row, pkcs8: await unseal(currentVault(), row.wrapped, 'identity') };
  const dev = await store.getAccount('device');
  return { row, pkcs8: await unseal(dev.key, row.wrapped, 'identity') };
}

let vaultKey = null;
const currentVault = () => vaultKey;

/** Unlock a PIN protected account. Returns the account, or null for a wrong PIN. */
export async function unlock(pin) {
  const lock = await store.getAccount('pin');
  const key = await openPinLock(pin, lock);
  if (!key) return null;
  vaultKey = key;
  store.setVault(key);
  const row = await store.getAccount('identity');
  const pkcs8 = await unseal(key, row.wrapped, 'identity');
  const identity = await importIdentity({ alg: row.alg, pkcs8, publicKey: row.publicKey });
  pkcs8.fill(0);
  const profile = await store.getAccount('profile');
  setCookie(true);
  return { state: 'ready', profile: cleanProfile(profile), identity: { alg: identity.alg, signingKey: identity.signingKey, publicKey: identity.publicKey, id: identity.id, tag: identity.tag } };
}

export async function hasPin() {
  return !!(await store.getAccount('pin'));
}

/**
 * Turn on the PIN lock. The private key copy moves under the PIN key, the
 * stored signing key and device key are removed, and every record is sealed.
 */
export async function setPin(pin, profile) {
  const { row, pkcs8 } = await privateBytes();
  const { key, lock } = await createPinLock(pin);
  await store.rewriteAll(null, key);
  vaultKey = key;
  await store.putAccount('identity', { alg: row.alg, publicKey: row.publicKey, id: row.id, tag: row.tag, wrapped: await seal(key, pkcs8, 'identity') });
  pkcs8.fill(0);
  await store.deleteAccountRecord('device');
  await store.putAccount('profile', profile, { sealed: true });
  await store.putAccount('pin', lock);
}

/** Turn off the PIN lock: data goes back to plain local storage with a device key. */
export async function removePin(profile, identity) {
  const { row, pkcs8 } = await privateBytes();
  const dev = await deviceKey();
  await store.rewriteAll(vaultKey, null);
  vaultKey = null;
  await store.putAccount('device', { key: dev });
  await store.putAccount('identity', { alg: row.alg, publicKey: row.publicKey, id: row.id, tag: row.tag, signingKey: identity.signingKey, wrapped: await seal(dev, pkcs8, 'identity') });
  pkcs8.fill(0);
  await store.putAccount('profile', profile);
  await store.deleteAccountRecord('pin');
}

/** An encrypted backup file with the profile, the private key and the friends list. */
export async function exportAccount(password, profile) {
  const { row, pkcs8 } = await privateBytes();
  const friends = await store.listFriends();
  const dens = (await store.listDens()).map((d) => ({ id: d.id, name: d.name, nameV: d.nameV, kind: d.kind, peer: d.peer, locked: d.locked, channels: d.channels, members: d.members, createdAt: d.createdAt }));
  const text = await exportBackup({ kind: 'howlden-account', profile, alg: row.alg, publicKey: row.publicKey, pkcs8: Array.from(pkcs8), friends, dens });
  pkcs8.fill(0);
  return text;
}

/** Restore an account from a backup file, replacing what is on this device. */
export async function importAccount(text, password) {
  const data = await importBackup(text, password);
  if (data.kind !== 'howlden-account') throw new Error('This is not a howlden account backup.');
  const pkcs8 = Uint8Array.from(data.pkcs8);
  const identity = await importIdentity({ alg: data.alg, pkcs8, publicKey: data.publicKey });
  if (identity.id !== data.profile.id) throw new Error('This backup is damaged: the key does not match the profile.');
  await store.wipe();
  const dev = await deviceKey();
  await store.putAccount('device', { key: dev });
  await store.putAccount('identity', { alg: identity.alg, publicKey: identity.publicKey, id: identity.id, tag: identity.tag, signingKey: identity.signingKey, wrapped: await seal(dev, pkcs8, 'identity') });
  pkcs8.fill(0);
  await store.putAccount('profile', data.profile);
  for (const f of data.friends || []) await store.putFriend(f);
  for (const d of data.dens || []) await store.putDen({ ...d, lastRead: {} });
  setCookie(true);
  return { state: 'ready', profile: cleanProfile(data.profile), identity: { alg: identity.alg, signingKey: identity.signingKey, publicKey: identity.publicKey, id: identity.id, tag: identity.tag } };
}

/** Delete the account and everything stored on this device. */
export async function deleteAccount() {
  await store.wipe();
  setCookie(false);
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('howlden:')) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
