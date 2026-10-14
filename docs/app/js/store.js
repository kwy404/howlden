// Local storage: IndexedDB for the account, friends, dens, messages and file
// blobs, localStorage for settings. With a PIN lock every record is sealed
// with AES-GCM under the PIN key before it is written. Nothing leaves the
// device except through the peer connections the user opens.

import { seal, unseal } from '../core/identity.js';

const DB = 'howlden';
const VERSION = 2;
const SEALED = ['dens', 'messages', 'blobs', 'friends'];
let dbPromise = null;
let vault = null;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function setVault(key) {
  vault = key;
}

export function hasVault() {
  return !!vault;
}

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('dens')) db.createObjectStore('dens', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('messages')) db.createObjectStore('messages', { keyPath: 'id' }).createIndex('den', 'den');
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' }).createIndex('den', 'den');
      if (!db.objectStoreNames.contains('friends')) db.createObjectStore('friends', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('account')) db.createObjectStore('account', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('storage is blocked by another tab'));
  });
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Sealing. Blobs keep their bytes binary; everything else is JSON.

async function pack(store, value) {
  if (!vault) return value;
  if (store === 'blobs') {
    const { id, den, data, ...meta } = value;
    return { id, den, sealedMeta: await seal(vault, enc.encode(JSON.stringify(meta)), `${store}:${id}`), sealedData: await seal(vault, data, `${store}:${id}:data`) };
  }
  return { id: value.id, den: value.den, sealed: await seal(vault, enc.encode(JSON.stringify(value)), `${store}:${value.id}`) };
}

async function unpack(store, row) {
  if (!row) return row;
  if (row.sealed) {
    if (!vault) throw new Error('locked');
    return JSON.parse(dec.decode(await unseal(vault, row.sealed, `${store}:${row.id}`)));
  }
  if (row.sealedMeta) {
    if (!vault) throw new Error('locked');
    const meta = JSON.parse(dec.decode(await unseal(vault, row.sealedMeta, `${store}:${row.id}`)));
    return { id: row.id, den: row.den, ...meta, data: await unseal(vault, row.sealedData, `${store}:${row.id}:data`) };
  }
  return row;
}

async function getAll(store, index, key) {
  const db = await open();
  const os = db.transaction(store).objectStore(store);
  const rows = await request(index ? os.index(index).getAll(key) : os.getAll());
  return Promise.all(rows.map((r) => unpack(store, r)));
}

async function putAll(store, values) {
  if (!values.length) return;
  const packed = await Promise.all(values.map((v) => pack(store, v)));
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  for (const v of packed) tx.objectStore(store).put(v);
  return done(tx);
}

async function getOne(store, id) {
  const db = await open();
  return unpack(store, await request(db.transaction(store).objectStore(store).get(id)));
}

export const listDens = () => getAll('dens');
export const putDen = (den) => putAll('dens', [den]);
export const denMessages = (denId) => getAll('messages', 'den', denId);
export const putMessages = (denId, records) => putAll('messages', records.map((r) => ({ ...r, den: denId })));
export const getBlob = (id) => getOne('blobs', id);
export const putBlob = (entry) => putAll('blobs', [entry]);
export const listFriends = () => getAll('friends');
export const putFriend = (friend) => putAll('friends', [friend]);

export async function deleteFriend(id) {
  const db = await open();
  const tx = db.transaction('friends', 'readwrite');
  tx.objectStore('friends').delete(id);
  return done(tx);
}

/** Remove a den with its messages and files from this device. */
export async function deleteDen(denId) {
  const db = await open();
  const tx = db.transaction(['dens', 'messages', 'blobs'], 'readwrite');
  tx.objectStore('dens').delete(denId);
  for (const name of ['messages', 'blobs']) {
    const req = tx.objectStore(name).index('den').openKeyCursor(IDBKeyRange.only(denId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      tx.objectStore(name).delete(cursor.primaryKey);
      cursor.continue();
    };
  }
  return done(tx);
}

/** Re-write every sealed store with the current vault setting (after a PIN change). */
export async function rewriteAll(oldVault, newVault) {
  const data = {};
  vault = oldVault;
  for (const s of SEALED) data[s] = await getAll(s);
  vault = newVault;
  for (const s of SEALED) await putAll(s, data[s]);
}

// Account records (profile, identity, device key, PIN lock)

export async function getAccount(k) {
  const db = await open();
  const row = await request(db.transaction('account').objectStore('account').get(k));
  if (row?.sealed) {
    if (!vault) throw new Error('locked');
    return { ...JSON.parse(dec.decode(await unseal(vault, row.sealed, `account:${k}`))), k };
  }
  return row;
}

export async function putAccount(k, value, { sealed = false } = {}) {
  const db = await open();
  const row = sealed && vault ? { k, sealed: await seal(vault, enc.encode(JSON.stringify(value)), `account:${k}`) } : { ...value, k };
  const tx = db.transaction('account', 'readwrite');
  tx.objectStore('account').put(row);
  return done(tx);
}

export async function deleteAccountRecord(k) {
  const db = await open();
  const tx = db.transaction('account', 'readwrite');
  tx.objectStore('account').delete(k);
  return done(tx);
}

/** Delete the whole local database. */
export async function wipe() {
  const db = await open();
  db.close();
  dbPromise = null;
  vault = null;
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

// localStorage helpers, safe in private windows where storage may throw.

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(`howlden:${key}`);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(`howlden:${key}`, JSON.stringify(value));
  } catch {
    // storage full or blocked: settings simply do not persist
  }
}

export const DEFAULT_SETTINGS = {
  lang: null,
  theme: 'dark',
  turn: [],
  inputMode: 'voice',
  pttKey: 'Backquote',
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  inputId: '',
  outputId: '',
  cameraId: '',
  notify: false,
  volumes: {},
  compact: false,
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load('settings', {}) };
}
