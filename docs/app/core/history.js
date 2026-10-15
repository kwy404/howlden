// Copied from src/ by scripts/sync-core.mjs. Edit the file in src/ instead.
// Chat records and history sync.
//
// Every message is a record keyed by a random id. Records merge like a small
// state based CRDT, so any two copies can be combined in any order and end up
// equal:
// - text and editedAt: the later edit wins (ties broken by text), and the
//   earlier texts are kept as an edit history (the union of both copies);
// - deleted: once deleted, always deleted (a tombstone with no content);
// - reactions and poll votes: per key and per member, the later toggle wins;
// - pinned: the later pin or unpin wins;
// - sticker, poll question, thread, forward and /me never change.
// A member who joins later sends a manifest of [id, version] pairs. The other
// side answers with the records that are missing or older there, and asks for
// the ones it lacks itself.

export const MAX_TEXT = 4000;
export const MAX_FILES = 10;
export const MAX_HISTORY = 10;
export const POLL_LIMITS = { question: 200, option: 80, min: 2, max: 10 };
export const WAVE_POINTS = 48;

// Seasonal extras: one reaction and one sticker (named after the season) that
// can be picked only while the season is on. They render at any time.
export const SEASONAL = {
  newyear: 'firework',
  carnival: 'mask',
  easter: 'egg',
  valentine: 'rose',
  junina: 'bonfire',
  halloween: 'pumpkin',
  christmas: 'gift',
};
export const BASE_REACTIONS = ['like', 'love', 'laugh', 'wow', 'sad', 'fire', 'howl', 'check'];
export const REACTIONS = [...BASE_REACTIONS, ...Object.values(SEASONAL)];
// Stickers drawn for howlden. A sticker message carries one of these keys and
// no text; the art lives in the app (docs/app/js/stickers.js).
export const BASE_STICKERS = ['wave', 'howl', 'love', 'laugh', 'party', 'sleepy', 'thanks', 'cool'];
export const STICKERS = [...BASE_STICKERS, ...Object.keys(SEASONAL)];

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? v : 0);
const hex = (v) => typeof v === 'string' && /^[0-9a-f]{4,32}$/.test(v);
const toggles = (raw, keys) => {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of keys) {
    const users = raw[key];
    if (!users || typeof users !== 'object') continue;
    for (const [user, entry] of Object.entries(users)) {
      if (!hex(user) || !Array.isArray(entry)) continue;
      (out[key] ||= {})[user] = [num(entry[0]), entry[1] ? 1 : 0];
    }
  }
  return out;
};

/** A poll question and its options, trimmed to the limits, or null. */
export function cleanPoll(p) {
  if (!p || typeof p !== 'object') return null;
  const q = str(p.q, POLL_LIMITS.question).trim();
  const options = (Array.isArray(p.options) ? p.options : []).map((o) => str(o, POLL_LIMITS.option).trim()).filter(Boolean).slice(0, POLL_LIMITS.max);
  if (!q || options.length < POLL_LIMITS.min) return null;
  return { q, options, multi: p.multi === true };
}

const optionKeys = (poll) => poll.options.map((_, i) => String(i));

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
  if (hex(rec.thread) && rec.thread !== rec.id) out.thread = rec.thread;
  if (rec.me === true) out.me = true;
  if (rec.fwd && typeof rec.fwd === 'object') out.fwd = { name: str(rec.fwd.name, 64) || '?', from: str(rec.fwd.from, 64) };
  if (Array.isArray(rec.pin) && num(rec.pin[0])) out.pin = [num(rec.pin[0]), rec.pin[1] ? 1 : 0];
  const poll = cleanPoll(rec.poll);
  if (poll) {
    out.poll = poll;
    out.votes = toggles(rec.votes, optionKeys(poll));
  }
  if (Array.isArray(rec.history)) {
    out.history = rec.history
      .filter((e) => Array.isArray(e) && num(e[0]) && typeof e[1] === 'string')
      .map((e) => [num(e[0]), str(e[1], MAX_TEXT)])
      .slice(-MAX_HISTORY);
  }
  if (Array.isArray(rec.files)) {
    for (const f of rec.files.slice(0, MAX_FILES)) {
      if (!f || !hex(f.id)) continue;
      const file = {
        id: f.id,
        name: str(f.name, 200) || 'file',
        size: Math.max(0, num(f.size)),
        type: /^[\w.+-]+\/[\w.+-]+$/.test(f.type || '') ? f.type : 'application/octet-stream',
        w: num(f.w) || undefined,
        h: num(f.h) || undefined,
        thumb: typeof f.thumb === 'string' && f.thumb.startsWith('data:image/') && f.thumb.length < 60000 ? f.thumb : undefined,
      };
      // A voice message: its length in seconds and a small waveform (0 to 100).
      if (f.voice === true) {
        file.voice = true;
        file.dur = Math.min(3600, Math.max(0, num(f.dur)));
        file.wave = (Array.isArray(f.wave) ? f.wave : []).slice(0, WAVE_POINTS).map((v) => Math.max(0, Math.min(100, Math.round(num(v)))));
      }
      out.files.push(file);
    }
  }
  out.reactions = toggles(rec.reactions, REACTIONS);
  if (out.deleted) return tombstone(out);
  return out;
}

function tombstone({ sticker: _s, poll: _p, votes: _v, history: _h, fwd: _f, pin: _pin, me: _me, ...rec }) {
  return { ...rec, text: '', editedAt: 0, files: [], reply: null, reactions: {}, deleted: true, deletedAt: rec.deletedAt || rec.ts };
}

/** The highest timestamp in a record, used to compare two copies. */
export function version(rec) {
  let v = Math.max(num(rec.ts), num(rec.editedAt), num(rec.deletedAt), num(rec.pin?.[0]));
  for (const group of [rec.reactions, rec.votes]) {
    for (const users of Object.values(group || {})) {
      for (const [at] of Object.values(users)) if (at > v) v = at;
    }
  }
  return v;
}

const later = (x, y) => (!x ? y : !y ? x : x[0] > y[0] || (x[0] === y[0] && x[1] >= y[1]) ? x : y);

function mergeToggles(a = {}, b = {}) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const ua = a[key] || {};
    const ub = b[key] || {};
    const merged = {};
    for (const user of new Set([...Object.keys(ua), ...Object.keys(ub)])) merged[user] = later(ua[user], ub[user]);
    out[key] = merged;
  }
  return out;
}

const first = (x, y) => (x === undefined ? y : y === undefined ? x : JSON.stringify(x) <= JSON.stringify(y) ? x : y);

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
  for (const k of ['sticker', 'thread', 'me', 'fwd', 'poll']) {
    const v = first(a[k], b[k]);
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  const pin = later(a.pin, b.pin);
  if (pin) out.pin = pin;
  else delete out.pin;
  out.reactions = mergeToggles(a.reactions, b.reactions);
  if (out.poll) out.votes = mergeToggles(a.votes, b.votes);
  else delete out.votes;
  const seen = new Map();
  for (const e of [...(a.history || []), ...(b.history || [])]) if (!seen.has(e[0]) || seen.get(e[0]) > e[1]) seen.set(e[0], e[1]);
  if (seen.size) out.history = [...seen].sort((x, y) => x[0] - y[0] || (x[1] < y[1] ? -1 : 1)).slice(-MAX_HISTORY);
  else delete out.history;
  return out;
}

/** True when two records hold the same state. */
export function sameRecord(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

const sortDeep = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])])) : v);

function canonical(rec) {
  return rec ? sortDeep(rec) : null;
}

/** Members who currently have a reaction switched on. */
export function reactors(rec, key) {
  return Object.entries(rec.reactions?.[key] || {})
    .filter(([, e]) => e[1])
    .map(([u]) => u);
}

/** A new message record. Pass sticker, poll, thread, fwd or me for the special kinds. */
export function createRecord({ id, channel, author, text = '', ts, reply = null, files = [], sticker = null, poll = null, thread = null, fwd = null, me = false }) {
  const rec = { id, channel, author, ts, text: text.slice(0, MAX_TEXT), editedAt: 0, deleted: false, deletedAt: 0, reply, files, reactions: {} };
  if (thread) rec.thread = thread;
  if (fwd) rec.fwd = { name: String(fwd.name || '?').slice(0, 64), from: String(fwd.from || '').slice(0, 64) };
  if (me) rec.me = true;
  if (sticker) {
    if (!STICKERS.includes(sticker)) throw new Error(`unknown sticker ${sticker}`);
    return { ...rec, text: '', files: [], sticker };
  }
  if (poll) {
    const clean = cleanPoll(poll);
    if (!clean) throw new Error('a poll needs a question and at least two options');
    return { ...rec, text: '', files: [], poll: clean, votes: {} };
  }
  return rec;
}

/** Edit a record (author only). The previous text goes into its edit history. */
export function editRecord(rec, text, at) {
  if (rec.deleted || rec.sticker || rec.poll) return rec;
  const next = String(text).slice(0, MAX_TEXT);
  if (next === rec.text) return rec;
  const history = [...(rec.history || []), [num(rec.editedAt) || rec.ts, rec.text]].slice(-MAX_HISTORY);
  return { ...rec, text: next, history, editedAt: Math.max(at, num(rec.editedAt) + 1, rec.ts + 1) };
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

/** Pin or unpin a message for everyone in the channel. Anyone may. */
export function setPinned(rec, on, at) {
  if (rec.deleted) return rec;
  return { ...rec, pin: [Math.max(at, num(rec.pin?.[0]) + 1), on ? 1 : 0] };
}

export const isPinned = (rec) => !rec.deleted && rec.pin?.[1] === 1;

/** Vote for one option; in a single choice poll this also takes back any other vote. */
export function votePoll(rec, option, user, at) {
  if (!rec.poll || rec.deleted || !(option >= 0 && option < rec.poll.options.length)) return rec;
  const votes = { ...(rec.votes || {}) };
  const cur = (i) => votes[String(i)]?.[user];
  const stamp = Math.max(at, ...rec.poll.options.map((_, i) => (cur(i)?.[0] || 0) + 1));
  const on = !cur(option)?.[1];
  rec.poll.options.forEach((_, i) => {
    const key = String(i);
    if (i === option) votes[key] = { ...votes[key], [user]: [stamp, on ? 1 : 0] };
    else if (on && !rec.poll.multi && cur(i)?.[1]) votes[key] = { ...votes[key], [user]: [stamp, 0] };
  });
  return { ...rec, votes };
}

/** Poll results: voters per option, the total of people who voted, and my picks. */
export function pollResults(rec, me) {
  const per = (rec.poll?.options || []).map((_, i) =>
    Object.entries(rec.votes?.[String(i)] || {})
      .filter(([, e]) => e[1])
      .map(([u]) => u),
  );
  const people = new Set(per.flat());
  return { per, total: people.size, mine: per.map((list) => list.includes(me)) };
}

/**
 * Whether a change from `before` to `after` may come from `sender`. Anyone may
 * react, vote, pin or relay history, but only the author may change text,
 * the edit history or delete, and nobody may change what never changes.
 */
export function allowedChange(before, after, sender) {
  if (!before) return true;
  if (after.author !== before.author || after.channel !== before.channel || after.ts !== before.ts) return false;
  const textChanged = after.text !== before.text || num(after.editedAt) !== num(before.editedAt) || JSON.stringify(after.history || []) !== JSON.stringify(before.history || []);
  const fixed = (r) => JSON.stringify([r.sticker || null, r.poll || null, r.thread || null, r.fwd || null, !!r.me]);
  const fixedChanged = !after.deleted && fixed(after) !== fixed(before);
  if ((textChanged || fixedChanged || (after.deleted && !before.deleted)) && sender !== before.author) return false;
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
