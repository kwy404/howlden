// Copied from src/ by scripts/sync-core.mjs. Edit the file in src/ instead.
// Chat records and history sync.
//
// Every message is a record keyed by a random id. Records merge like a small
// state based CRDT, so any two copies can be combined in any order and end up
// equal:
// - text and editedAt: the later edit wins (ties broken by text);
// - deleted: once deleted, always deleted (a tombstone with no content);
// - reactions: per reaction and per member, the later toggle wins.
// A member who joins later sends a manifest of [id, version] pairs. The other
// side answers with the records that are missing or older there, and asks for
// the ones it lacks itself.

export const MAX_TEXT = 4000;
export const MAX_FILES = 10;
export const REACTIONS = ['like', 'love', 'laugh', 'wow', 'sad', 'fire', 'howl', 'check'];
// Stickers drawn for howlden. A sticker message carries one of these keys and
// no text; the art lives in the app (docs/app/js/stickers.js).
export const STICKERS = ['wave', 'howl', 'love', 'laugh', 'party', 'sleepy', 'thanks', 'cool'];

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? v : 0);
const hex = (v) => typeof v === 'string' && /^[0-9a-f]{4,32}$/.test(v);

/** Validate and normalize a record that came from another peer. Returns null when unusable. */
export function cleanRecord(rec) {
  if (!rec || typeof rec !== 'object' || !hex(rec.id) || !hex(rec.author) || typeof rec.channel !== 'string' || !num(rec.ts)) return null;
  const out = {
    id: rec.id,
    channel: str(rec.channel, 40),
    author: rec.author,
    ts: num(rec.ts),
    text: str(rec.text, MAX_TEXT),
    editedAt: num(rec.editedAt),
    deleted: rec.deleted === true,
    deletedAt: num(rec.deletedAt),
    reply: hex(rec.reply) ? rec.reply : null,
    files: [],
    reactions: {},
  };
  if (STICKERS.includes(rec.sticker)) out.sticker = rec.sticker;
  if (Array.isArray(rec.files)) {
    for (const f of rec.files.slice(0, MAX_FILES)) {
      if (!f || !hex(f.id)) continue;
      out.files.push({
        id: f.id,
        name: str(f.name, 200) || 'file',
        size: Math.max(0, num(f.size)),
        type: /^[\w.+-]+\/[\w.+-]+$/.test(f.type || '') ? f.type : 'application/octet-stream',
        w: num(f.w) || undefined,
        h: num(f.h) || undefined,
        thumb: typeof f.thumb === 'string' && f.thumb.startsWith('data:image/') && f.thumb.length < 60000 ? f.thumb : undefined,
      });
    }
  }
  if (rec.reactions && typeof rec.reactions === 'object') {
    for (const key of REACTIONS) {
      const users = rec.reactions[key];
      if (!users || typeof users !== 'object') continue;
      for (const [user, entry] of Object.entries(users)) {
        if (!hex(user) || !Array.isArray(entry)) continue;
        (out.reactions[key] ||= {})[user] = [num(entry[0]), entry[1] ? 1 : 0];
      }
    }
  }
  if (out.deleted) return tombstone(out);
  return out;
}

function tombstone({ sticker: _gone, ...rec }) {
  return { ...rec, text: '', editedAt: 0, files: [], reply: null, reactions: {}, deleted: true, deletedAt: rec.deletedAt || rec.ts };
}

/** The highest timestamp in a record, used to compare two copies. */
export function version(rec) {
  let v = Math.max(num(rec.ts), num(rec.editedAt), num(rec.deletedAt));
  for (const users of Object.values(rec.reactions || {})) {
    for (const [at] of Object.values(users)) if (at > v) v = at;
  }
  return v;
}

/** Merge two copies of the same record. Commutative, associative and idempotent. */
export function mergeRecord(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.id !== b.id) throw new Error('cannot merge different records');
  const deleted = a.deleted || b.deleted;
  const base = a.ts < b.ts || (a.ts === b.ts && a.author <= b.author) ? a : b;
  const out = { ...base };
  if (deleted) return tombstone({ ...out, deletedAt: Math.max(num(a.deletedAt), num(b.deletedAt)) || out.ts });
  const ea = num(a.editedAt);
  const eb = num(b.editedAt);
  const newer = ea > eb || (ea === eb && a.text >= b.text) ? a : b;
  out.text = newer.text;
  out.editedAt = newer.editedAt || 0;
  out.files = base.files || [];
  const sticker = [a.sticker, b.sticker].filter(Boolean).sort()[0];
  if (sticker) out.sticker = sticker;
  out.reactions = {};
  for (const key of new Set([...Object.keys(a.reactions || {}), ...Object.keys(b.reactions || {})])) {
    const ua = a.reactions?.[key] || {};
    const ub = b.reactions?.[key] || {};
    const merged = {};
    for (const user of new Set([...Object.keys(ua), ...Object.keys(ub)])) {
      const x = ua[user];
      const y = ub[user];
      merged[user] = !x ? y : !y ? x : x[0] > y[0] || (x[0] === y[0] && x[1] >= y[1]) ? x : y;
    }
    out.reactions[key] = merged;
  }
  return out;
}

/** True when two records hold the same state. */
export function sameRecord(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(rec) {
  if (!rec) return null;
  const reactions = {};
  for (const key of Object.keys(rec.reactions || {}).sort()) {
    const users = rec.reactions[key];
    reactions[key] = Object.fromEntries(Object.keys(users).sort().map((u) => [u, users[u]]));
  }
  return { ...rec, reactions };
}

/** Members who currently have a reaction switched on. */
export function reactors(rec, key) {
  return Object.entries(rec.reactions?.[key] || {})
    .filter(([, e]) => e[1])
    .map(([u]) => u);
}

/** A new message record. */
export function createRecord({ id, channel, author, text = '', ts, reply = null, files = [], sticker = null }) {
  const rec = { id, channel, author, ts, text: text.slice(0, MAX_TEXT), editedAt: 0, deleted: false, deletedAt: 0, reply, files, reactions: {} };
  if (sticker) {
    if (!STICKERS.includes(sticker)) throw new Error(`unknown sticker ${sticker}`);
    return { ...rec, text: '', files: [], sticker };
  }
  return rec;
}

/** Edit a record (author only). */
export function editRecord(rec, text, at) {
  if (rec.deleted || rec.sticker) return rec;
  return { ...rec, text: String(text).slice(0, MAX_TEXT), editedAt: Math.max(at, num(rec.editedAt) + 1, rec.ts + 1) };
}

/** Delete a record (author only). */
export function deleteRecord(rec, at) {
  return tombstone({ ...rec, deletedAt: Math.max(at, rec.ts) });
}

/** Toggle one member's reaction. */
export function toggleReaction(rec, key, user, at) {
  if (!REACTIONS.includes(key) || rec.deleted) return rec;
  const users = { ...(rec.reactions?.[key] || {}) };
  const prev = users[user];
  const stamp = Math.max(at, prev ? prev[0] + 1 : 0);
  users[user] = [stamp, prev && prev[1] ? 0 : 1];
  return { ...rec, reactions: { ...rec.reactions, [key]: users } };
}

/**
 * Whether a change from `before` to `after` may come from `sender`. Anyone may
 * react or relay history, but only the author may change text or delete.
 */
export function allowedChange(before, after, sender) {
  if (!before) return true;
  if (after.author !== before.author || after.channel !== before.channel || after.ts !== before.ts) return false;
  const textChanged = after.text !== before.text || num(after.editedAt) !== num(before.editedAt);
  const stickerChanged = !after.deleted && (after.sticker || null) !== (before.sticker || null);
  if ((textChanged || stickerChanged || (after.deleted && !before.deleted)) && sender !== before.author) return false;
  return true;
}

/** Manifest entries [id, version] for a list of records. */
export function manifest(records) {
  return records.map((r) => [r.id, version(r)]);
}

/** Compare a local record map (id to record) with a remote manifest. */
export function diffManifest(local, remote) {
  const theirs = new Map(remote);
  const send = [];
  const want = [];
  for (const [id, rec] of local) {
    const v = theirs.get(id);
    if (v === undefined || version(rec) > v) send.push(id);
  }
  for (const [id, v] of theirs) {
    const rec = local.get(id);
    if (!rec || v > version(rec)) want.push(id);
  }
  return { send, want };
}

/** Split items into batches whose JSON size stays under maxBytes. */
export function batchBySize(items, maxBytes = 60000) {
  const out = [];
  let batch = [];
  let size = 2;
  for (const item of items) {
    const n = JSON.stringify(item).length + 1;
    if (batch.length && size + n > maxBytes) {
      out.push(batch);
      batch = [];
      size = 2;
    }
    batch.push(item);
    size += n;
  }
  if (batch.length) out.push(batch);
  return out;
}

/** Sort records by time, then id, the order every peer shows. */
export function sortRecords(records) {
  return [...records].sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const PAGE = 400;

/**
 * History sync between two peers over any message channel.
 * The store is async so it can sit on IndexedDB: all() returns a Map of id to
 * record, get(ids) returns records, and merge(records) stores them and returns
 * the ones that changed.
 */
export class HistorySync {
  constructor({ store, send, onChange = () => {}, accept = () => true }) {
    this.store = store;
    this.send = send;
    this.onChange = onChange;
    this.accept = accept;
    this.inbound = new Map();
  }

  /** Send my manifest to a peer, which answers with what I lack and asks for what it lacks. */
  async start(peerId) {
    const entries = manifest([...(await this.store.all()).values()]);
    const pages = Math.max(1, Math.ceil(entries.length / PAGE));
    for (let p = 0; p < pages; p++) {
      this.send(peerId, { type: 'sync-m', page: p, last: p === pages - 1, entries: entries.slice(p * PAGE, (p + 1) * PAGE) });
    }
  }

  async handle(peerId, msg) {
    if (msg.type === 'sync-m') {
      const acc = this.inbound.get(peerId) || [];
      if (Array.isArray(msg.entries)) acc.push(...msg.entries.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1])));
      if (!msg.last) {
        this.inbound.set(peerId, acc);
        return;
      }
      this.inbound.delete(peerId);
      const local = await this.store.all();
      const { send, want } = diffManifest(local, acc);
      await this._sendRecords(peerId, send.map((id) => local.get(id)));
      if (want.length) this.send(peerId, { type: 'sync-w', ids: want });
    } else if (msg.type === 'sync-w') {
      const ids = Array.isArray(msg.ids) ? msg.ids.filter((id) => typeof id === 'string').slice(0, 100000) : [];
      await this._sendRecords(peerId, await this.store.get(ids));
    } else if (msg.type === 'sync-r') {
      const records = (Array.isArray(msg.records) ? msg.records : []).map(cleanRecord).filter((r) => r && this.accept(r, peerId));
      if (!records.length) return;
      const changed = await this.store.merge(records);
      if (changed.length) this.onChange(changed, peerId);
    }
  }

  async _sendRecords(peerId, records) {
    for (const batch of batchBySize(sortRecords(records.filter(Boolean)))) this.send(peerId, { type: 'sync-r', records: batch });
  }
}

/** An in-memory store with the HistorySync interface. */
export class MemoryStore {
  constructor(records = []) {
    this.map = new Map(records.map((r) => [r.id, r]));
  }

  async all() {
    return new Map(this.map);
  }

  async get(ids) {
    return ids.map((id) => this.map.get(id)).filter(Boolean);
  }

  async merge(records) {
    const changed = [];
    for (const rec of records) {
      const before = this.map.get(rec.id);
      const after = mergeRecord(before, rec);
      if (!before || !sameRecord(before, after)) {
        this.map.set(rec.id, after);
        changed.push(after);
      }
    }
    return changed;
  }
}
