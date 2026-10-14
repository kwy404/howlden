// One den on this device: its settings, messages, mesh connection, typing and
// voice state, file transfers and the optional passphrase layer.

import { DIRECT_MEMBERS, Emitter, MAX_MEMBERS, Mesh } from '../core/mesh.js';
import { RtcLink } from '../core/rtc.js';
import {
  HistorySync,
  allowedChange,
  batchBySize,
  cleanRecord,
  createRecord,
  deleteRecord,
  editRecord,
  mergeRecord,
  sameRecord,
  sortRecords,
  toggleReaction,
} from '../core/history.js';
import { channelName, denConfig, mergeDen, visibleChannels } from '../core/denstate.js';
import { decryptBytes, decryptJSON, deriveKey, encryptBytes, encryptJSON, keyCheck, randomId, verifyKeyCheck } from '../core/crypto.js';
import { codeLink, invitePayload, packCode, replyPayload } from '../core/invite.js';
import { Assembler, CHUNK_SIZE, MAX_FILE, decodeChunk, encodeChunk, slices } from '../core/chunks.js';
import { mentions } from '../core/markdown.js';
import { checkProof, nonce, proveIdentity } from '../core/identity.js';
import * as store from './store.js';

const PLAIN_TYPES = new Set(['key', 'key-ok', 'key-bad', 'id-hello', 'id-proof']);
export const DM_TEXT = 'c0de0001';
export const DM_CALL = 'ca110001';
const TYPING_MS = 6000;

export class DenSession extends Emitter {
  constructor(app, den) {
    super();
    this.app = app;
    this.den = { lastRead: {}, members: [], ...den };
    this.messages = new Map();
    this.mesh = null;
    this.key = null;
    this.typing = new Map();
    this.voice = new Map();
    this.incoming = new Map();
    this.progress = new Map();
    this.blobUrls = new Map();
    this.requested = new Set();
    this.verified = new Set();
    this.ids = new Map();
    this.decryptWarned = false;
    this.queue = Promise.resolve();
    this.lastTyping = 0;
    this.sync = new HistorySync({
      store: {
        all: async () => this.messages,
        get: async (ids) => ids.map((id) => this.messages.get(id)).filter(Boolean),
        merge: async (records) => this._merge(records),
      },
      send: (peer, body) => this.sendTo(peer, body),
      onChange: (records, peer) => this._afterSync(records, peer),
    });
    this._saveSoon = debounce(() => store.putDen(this.den), 400);
  }

  get id() {
    return this.den.id;
  }

  get self() {
    return this.app.profile;
  }

  get isDirect() {
    return this.den.kind === 'dm';
  }

  /** The people limit: MAX_MEMBERS for dens, two for direct conversations. */
  get maxMembers() {
    return this.isDirect ? DIRECT_MEMBERS : MAX_MEMBERS;
  }

  /** People online now, me included. */
  get onlineCount() {
    return this.mesh && !this.mesh.closed ? this.mesh.onlineCount() : 1;
  }

  /** Me as I appear in codes: profile plus identity public key. */
  get selfCard() {
    const p = this.app.profile;
    const i = this.app.identity;
    return { id: p.id, name: p.name, avatar: p.avatar, publicKey: i.publicKey, alg: i.alg, tag: i.tag };
  }

  /** 'offline' (no mesh), 'alone' (mesh with nobody connected) or 'online'. */
  get status() {
    if (!this.mesh || this.mesh.closed) return 'offline';
    return this.mesh.links.size ? 'online' : 'alone';
  }

  async load() {
    for (const r of await store.denMessages(this.id)) {
      const { den: _den, ...rec } = r;
      this.messages.set(rec.id, rec);
    }
  }

  save() {
    this._saveSoon();
  }

  // Members

  members() {
    if (this.mesh && !this.mesh.closed) return this.mesh.memberList();
    const self = { ...this.self, online: true };
    return [self, ...(this.den.members || []).filter((m) => m.id !== self.id).map((m) => ({ ...m, online: false }))];
  }

  member(id) {
    if (id === this.self.id) return { ...this.self, online: true };
    if (this.mesh) {
      const m = this.mesh.members.get(id);
      if (m) return m;
    }
    return (this.den.members || []).find((m) => m.id === id) || null;
  }

  get relay() {
    return this.mesh && !this.mesh.closed ? this.mesh.relay : null;
  }

  _rememberMembers(list) {
    const known = new Map((this.den.members || []).map((m) => [m.id, m]));
    for (const m of list) {
      if (m.id === this.self.id) continue;
      known.set(m.id, { id: m.id, name: m.name, avatar: m.avatar, joinedAt: m.joinedAt ?? known.get(m.id)?.joinedAt ?? null });
    }
    this.den.members = [...known.values()];
    this.save();
  }

  // Passphrase

  async setPassphrase(passphrase) {
    this.key = passphrase ? await deriveKey(passphrase, this.id) : null;
    this.decryptWarned = false;
  }

  get needsPassphrase() {
    return this.den.locked && !this.key;
  }

  // Mesh

  ensureMesh(host) {
    if (this.mesh && !this.mesh.closed) return this.mesh;
    const app = this.app;
    const mesh = new Mesh({
      self: { id: this.self.id, name: this.self.name, avatar: this.self.avatar, status: this.self.status, accent: this.self.accent },
      den: { id: this.id, name: this.den.name, locked: !!this.den.locked },
      transport: { createLink: () => new RtcLink({ iceServers: app.iceServers() }) },
      host,
      max: this.maxMembers,
    });
    mesh.addKnownMembers(this.den.members);
    this.mesh = mesh;
    this.verified.clear();
    mesh.on('members', (list) => {
      this._rememberMembers(list);
      for (const m of list) {
        const f = m.online && app.friends?.get(m.id);
        if (f && (f.name !== m.name || f.avatar !== m.avatar || f.status !== m.status || f.accent !== m.accent)) app.friends.touch(m.id, { name: m.name, avatar: m.avatar, status: m.status, accent: m.accent });
      }
      this.emit('members');
    });
    mesh.on('relay', () => this.emit('members'));
    mesh.on('link-open', ({ peerId, link }) => this._onLinkOpen(peerId, link));
    mesh.on('link-close', ({ peerId }) => {
      this.typing.delete(peerId);
      this.voice.delete(peerId);
      this.verified.delete(peerId);
      this.ids.delete(peerId);
      app.media.detach(this, peerId);
      this.emit('voice');
      this.emit('typing');
      this.emit('status');
    });
    mesh.on('link-failed', (info) => {
      if (info.reason === 'closed') return;
      this.emit('link-failed', { ...info, diagnosis: info.link?.diagnose?.(navigator.onLine) || 'strict-nat' });
    });
    mesh.on('welcome', () => {
      this.sync.start(mesh.introducer);
      this.emit('welcome');
    });
    mesh.on('full', (f) => this.emit('notice', { kind: 'full', ...f }));
    mesh.on('rejected', (r) => this.emit('notice', { kind: 'rejected', name: r.peer.name, peerId: r.peer.id, count: r.count, max: r.max }));
    mesh.on('message', ({ from, body }) => this._receive(from, body));
    mesh.on('error', (err) => console.warn('howlden mesh:', err));
    this.emit('status');
    return mesh;
  }

  _onLinkOpen(peerId, link) {
    link.polite = this.self.id > peerId;
    link.onbinary = (buf) => this._onBinary(peerId, buf);
    this.app.media.attach(this, peerId, link);
    const st = this.ids.get(peerId) || {};
    st.myNonce = nonce();
    st.status = 'pending';
    this.ids.set(peerId, st);
    const i = this.app.identity;
    this.sendTo(peerId, { type: 'id-hello', nonce: st.myNonce, alg: i.alg, publicKey: i.publicKey, tag: i.tag });
    if (st.theirNonce) this._prove(peerId);
    if (this.den.locked && this.key) keyCheck(this.key).then((token) => this.sendTo(peerId, { type: 'key', token }));
    this.sendTo(peerId, { type: 'den', den: denConfig(this.den) });
    const mine = this.app.media.stateFor(this);
    if (mine) this.sendTo(peerId, { type: 'voice', ...mine });
    this.emit('status');
    this.emit('link-open', peerId);
  }

  async createInvite() {
    const mesh = this.ensureMesh(true);
    const { inviteId, sdp, full } = await mesh.createInvite();
    const count = mesh.onlineCount();
    const max = this.maxMembers;
    const code = await packCode(invitePayload({ inviteId, den: { id: this.id, name: this.isDirect ? this.self.name : this.den.name, locked: !!this.den.locked, full, count, max }, host: this.selfCard, sdp, kind: this.isDirect ? 'dm' : 'den' }));
    return { inviteId, code, link: codeLink(this.app.baseUrl, 'i', code), full, count, max };
  }

  cancelInvite(inviteId) {
    this.mesh?.cancelInvite(inviteId);
  }

  async acceptReply(reply) {
    if (!this.mesh) throw new Error('no open invite');
    return this.mesh.acceptReply(reply);
  }

  /** Guest side: answer an invite and return the reply link. */
  async answerInvite(invite) {
    if (this.mesh && !this.mesh.closed) this.leave();
    const mesh = this.ensureMesh(false);
    const reply = await mesh.acceptInvite(invite);
    reply.peer = this.selfCard;
    const code = await packCode(replyPayload(reply));
    return { code, link: codeLink(this.app.baseUrl, 'r', code) };
  }

  leave() {
    this.app.media.leaveIfIn(this);
    this.mesh?.leave();
    this.mesh = null;
    this.typing.clear();
    this.voice.clear();
    this.emit('status');
    this.emit('members');
  }

  // Sending

  async _seal(body) {
    if (!this.key || PLAIN_TYPES.has(body.type)) return body;
    return { enc: await encryptJSON(this.key, body) };
  }

  send(body) {
    this.queue = this.queue.then(async () => {
      if (!this.mesh || this.mesh.closed) return;
      this.mesh.broadcast(await this._seal(body));
    });
    return this.queue;
  }

  sendTo(peerId, body) {
    this.queue = this.queue.then(async () => {
      if (!this.mesh || this.mesh.closed) return;
      this.mesh.sendTo(peerId, await this._seal(body));
    });
    return this.queue;
  }

  // Receiving

  async _receive(from, body) {
    if (!body || typeof body !== 'object') return;
    let msg = body;
    if (typeof body.enc === 'string') {
      if (!this.key) return this._warnDecrypt();
      try {
        msg = await decryptJSON(this.key, body.enc);
      } catch {
        return this._warnDecrypt();
      }
    } else if (this.den.locked && !PLAIN_TYPES.has(body.type)) {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;
    switch (msg.type) {
      case 'rec':
        return this._incoming([msg.rec], from, true);
      case 'recs':
        return this._incoming(Array.isArray(msg.recs) ? msg.recs : [], from, false);
      case 'typing':
        if (typeof msg.channel === 'string') {
          this.typing.set(from, { channel: msg.channel, until: Date.now() + TYPING_MS });
          this.emit('typing');
          setTimeout(() => this.emit('typing'), TYPING_MS + 50);
        }
        return;
      case 'voice': {
        if (typeof msg.channel === 'string' && this.den.channels.some((c) => c.id === msg.channel && c.kind === 'voice')) {
          this.voice.set(from, { channel: msg.channel, muted: !!msg.muted, deafened: !!msg.deafened, camera: !!msg.camera, screen: !!msg.screen, since: this.voice.get(from)?.channel === msg.channel ? this.voice.get(from).since : Date.now() });
        } else {
          this.voice.delete(from);
        }
        this.app.media.sync(this, from);
        this.emit('voice');
        return;
      }
      case 'den': {
        const merged = mergeDen(this.den, msg.den);
        if (JSON.stringify(denConfig(merged)) !== JSON.stringify(denConfig(this.den))) {
          this.den = merged;
          if (this.mesh) this.mesh.den.name = merged.name;
          this.save();
          this.emit('den');
        }
        return;
      }
      case 'sync-m':
      case 'sync-w':
      case 'sync-r':
        return this.sync.handle(from, msg);
      case 'file-req':
        return this._serveFile(from, msg.id);
      case 'key': {
        const ok = !!this.key && (await verifyKeyCheck(this.key, msg.token));
        await this.sendTo(from, { type: ok ? 'key-ok' : 'key-bad' });
        if (ok) this.verified.add(from);
        return;
      }
      case 'id-hello': {
        if (typeof msg.nonce !== 'string' || typeof msg.publicKey !== 'string') return;
        const st = this.ids.get(from) || {};
        Object.assign(st, { theirNonce: msg.nonce.slice(0, 64), claim: { alg: String(msg.alg || ''), publicKey: msg.publicKey.slice(0, 200), tag: String(msg.tag || '') } });
        this.ids.set(from, st);
        if (st.myNonce) this._prove(from);
        if (st.proof) this._check(from);
        return;
      }
      case 'id-proof': {
        const st = this.ids.get(from) || {};
        st.proof = String(msg.signature || '').slice(0, 300);
        this.ids.set(from, st);
        this._check(from);
        return;
      }
      case 'call-decline':
        this.emit('call-declined', from);
        return;
      case 'key-ok':
        this.verified.add(from);
        this.emit('members');
        return;
      case 'key-bad':
        this.emit('notice', { kind: 'bad-passphrase', peer: from });
        return;
      default:
    }
  }

  async _prove(peerId) {
    const st = this.ids.get(peerId);
    const link = this.mesh?.links.get(peerId);
    if (!st?.theirNonce || !link || st.proved) return;
    st.proved = true;
    const connection = await link.fingerprint();
    const signature = await proveIdentity(this.app.identity, { connection, theirNonce: st.theirNonce, peerId });
    this.sendTo(peerId, { type: 'id-proof', signature });
  }

  async _check(peerId) {
    const st = this.ids.get(peerId);
    const link = this.mesh?.links.get(peerId);
    if (!st?.claim || !st.proof || !st.myNonce || !link || st.checked) return;
    st.checked = true;
    const connection = await link.fingerprint();
    const result = await checkProof({ claimedId: peerId, alg: st.claim.alg, publicKey: st.claim.publicKey, signature: st.proof, connection, myNonce: st.myNonce, myId: this.self.id });
    st.status = result;
    if (result === 'verified') {
      const m = this.member(peerId) || {};
      st.friend = await this.app.friends.verified({ id: peerId, name: m.name, avatar: m.avatar, status: m.status, accent: m.accent, publicKey: st.claim.publicKey, alg: st.claim.alg, tag: st.claim.tag || peerId.slice(0, 4) });
    }
    this.emit('identity', peerId);
    this.emit('members');
  }

  /** Identity state of a peer: { status, friend } where status is 'verified', 'pending' or a failure. */
  identityOf(peerId) {
    return this.ids.get(peerId) || null;
  }

  _warnDecrypt() {
    if (this.decryptWarned) return;
    this.decryptWarned = true;
    this.emit('notice', { kind: 'decrypt' });
  }

  async _merge(records) {
    const changed = [];
    for (const rec of records) {
      const before = this.messages.get(rec.id);
      const after = mergeRecord(before, rec);
      if (before && sameRecord(before, after)) continue;
      this.messages.set(after.id, after);
      changed.push({ rec: after, isNew: !before });
    }
    if (changed.length) await store.putMessages(this.id, changed.map((c) => c.rec));
    return changed;
  }

  async _incoming(raw, from, live) {
    const accepted = [];
    for (const r of raw.slice(0, 500)) {
      const rec = cleanRecord(r);
      if (!rec || !this.den.channels.some((c) => c.id === rec.channel)) continue;
      if (!allowedChange(this.messages.get(rec.id), rec, from)) continue;
      accepted.push(rec);
    }
    const changed = await this._merge(accepted);
    if (!changed.length) return;
    for (const { rec, isNew } of changed) {
      if (isNew && live && this.typing.delete(rec.author)) this.emit('typing');
      if (isNew && live && rec.author !== this.self.id) this.emit('incoming', rec);
    }
    this.emit('records', changed.map((c) => c.rec));
  }

  async _afterSync(changed, peer) {
    const recs = changed.map((c) => c.rec);
    this.emit('records', recs);
    if (this.mesh && peer !== this.mesh.introducer && this.mesh.links.size > 1) {
      for (const batch of batchBySize(recs, 50000)) this.send({ type: 'recs', recs: batch });
    }
  }

  // Messages

  channelMessages(channelId) {
    return sortRecords([...this.messages.values()].filter((r) => r.channel === channelId));
  }

  async post(channelId, text, { reply = null, files = [] } = {}) {
    const rec = createRecord({ id: randomId(8), channel: channelId, author: this.self.id, ts: Date.now(), text, reply, files });
    await this._merge([rec]);
    this.emit('records', [rec]);
    this.markRead(channelId);
    await this.send({ type: 'rec', rec });
    return rec;
  }

  async _update(id, fn) {
    const before = this.messages.get(id);
    if (!before) return;
    const after = fn(before);
    if (after === before) return;
    await this._merge([after]);
    this.emit('records', [after]);
    await this.send({ type: 'rec', rec: after });
  }

  edit(id, text) {
    return this._update(id, (r) => (r.author === this.self.id ? editRecord(r, text, Date.now()) : r));
  }

  remove(id) {
    return this._update(id, (r) => (r.author === this.self.id ? deleteRecord(r, Date.now()) : r));
  }

  react(id, key) {
    return this._update(id, (r) => toggleReaction(r, key, this.self.id, Date.now()));
  }

  typingIn(channelId) {
    const now = Date.now();
    const out = [];
    for (const [peer, t] of this.typing) if (t.channel === channelId && t.until > now && peer !== this.self.id) out.push(peer);
    return out;
  }

  sendTyping(channelId) {
    const now = Date.now();
    if (now - this.lastTyping < 3000) return;
    this.lastTyping = now;
    this.send({ type: 'typing', channel: channelId });
  }

  // Read state

  markRead(channelId) {
    const last = this.channelMessages(channelId).pop();
    const ts = last ? last.ts : 0;
    if ((this.den.lastRead[channelId] || 0) >= ts) return;
    this.den.lastRead = { ...this.den.lastRead, [channelId]: ts };
    this.save();
    this.emit('unread');
  }

  unread(channelId) {
    const since = this.den.lastRead?.[channelId] || 0;
    let count = 0;
    let mention = 0;
    for (const r of this.messages.values()) {
      if (r.channel !== channelId || r.ts <= since || r.author === this.self.id || r.deleted) continue;
      count++;
      if (this.mentionsMe(r)) mention++;
    }
    return { count, mention };
  }

  unreadTotal() {
    let count = 0;
    let mention = 0;
    for (const c of visibleChannels(this.den, 'text')) {
      const u = this.unread(c.id);
      count += u.count;
      mention += u.mention;
    }
    return { count, mention };
  }

  mentionsMe(rec) {
    const ids = mentions(rec.text);
    return ids.includes(this.self.id) || ids.includes('everyone');
  }

  // Den settings

  _changeDen(fn) {
    fn(this.den);
    this.save();
    this.emit('den');
    this.send({ type: 'den', den: denConfig(this.den) });
  }

  rename(name) {
    const clean = String(name).trim().slice(0, 60);
    if (!clean) return;
    this._changeDen((d) => {
      d.name = clean;
      d.nameV = Date.now();
      if (this.mesh) this.mesh.den.name = clean;
    });
  }

  addChannel(kind, name) {
    const clean = channelName(name, kind);
    if (!clean) return null;
    const id = randomId(6);
    this._changeDen((d) => {
      const pos = Math.max(0, ...d.channels.map((c) => c.pos)) + 1;
      d.channels = [...d.channels, { id, name: clean, kind, pos, v: Date.now(), deleted: false }];
    });
    return id;
  }

  renameChannel(id, name) {
    this._changeDen((d) => {
      d.channels = d.channels.map((c) => (c.id === id ? { ...c, name: channelName(name, c.kind) || c.name, v: Date.now() } : c));
    });
  }

  deleteChannel(id) {
    this._changeDen((d) => {
      d.channels = d.channels.map((c) => (c.id === id ? { ...c, deleted: true, v: Date.now() } : c));
    });
  }

  // Files

  async prepareFile(file) {
    if (file.size > MAX_FILE) throw new RangeError('too-large');
    const id = randomId(8);
    const data = new Uint8Array(await file.arrayBuffer());
    const meta = { id, name: file.name || 'file', size: file.size, type: file.type || 'application/octet-stream' };
    if (/^image\/(png|jpe?g|gif|webp|avif|bmp)$/.test(meta.type)) Object.assign(meta, await thumbnail(file));
    await store.putBlob({ id, den: this.id, name: meta.name, type: meta.type, size: meta.size, data });
    this.blobUrls.set(id, URL.createObjectURL(new Blob([data], { type: meta.type })));
    return { meta, data };
  }

  async postFiles(channelId, text, files, reply) {
    const prepared = [];
    for (const f of files) prepared.push(await this.prepareFile(f));
    await this.post(channelId, text, { reply, files: prepared.map((p) => p.meta) });
    const peers = this.mesh ? [...this.mesh.links.keys()] : [];
    for (const p of prepared) this._push(p.meta.id, p.data, peers);
  }

  async _push(id, data, peers) {
    const send = async (peerId) => {
      const link = this.mesh?.links.get(peerId);
      if (!link?.sendBinary) return;
      for (const s of slices(data)) {
        const payload = this.key ? await encryptBytes(this.key, s.data, `${id}:${s.index}`) : s.data;
        await link.sendBinary(encodeChunk({ id, index: s.index, total: s.total, data: payload, encrypted: !!this.key }));
      }
    };
    await Promise.all(peers.map((p) => send(p).catch(() => {})));
  }

  async _onBinary(from, buf) {
    const c = decodeChunk(buf);
    if (!c) return;
    if (this.den.locked && !c.encrypted) return;
    if (this.blobUrls.has(c.id)) return;
    let asm = this.incoming.get(c.id);
    if (!asm) {
      if (c.total * CHUNK_SIZE > MAX_FILE + CHUNK_SIZE) return;
      asm = new Assembler({ id: c.id, size: c.total * CHUNK_SIZE, total: c.total });
      this.incoming.set(c.id, asm);
    }
    let data = c.data;
    if (c.encrypted) {
      if (!this.key) return;
      try {
        data = await decryptBytes(this.key, c.data, `${c.id}:${c.index}`);
      } catch {
        return this._warnDecrypt();
      }
    }
    try {
      if (!asm.add(c.index, data)) return;
    } catch {
      this.incoming.delete(c.id);
      return;
    }
    this.progress.set(c.id, asm.progress);
    this.emit('file-progress', c.id);
    if (!asm.done) return;
    this.incoming.delete(c.id);
    this.progress.delete(c.id);
    const bytes = asm.bytesOut();
    const meta = this.fileMeta(c.id) || { name: 'file', type: 'application/octet-stream' };
    await store.putBlob({ id: c.id, den: this.id, name: meta.name, type: meta.type, size: bytes.length, data: bytes });
    this.blobUrls.set(c.id, URL.createObjectURL(new Blob([bytes], { type: meta.type })));
    this.emit('file-ready', c.id);
  }

  fileMeta(id) {
    for (const r of this.messages.values()) {
      const f = r.files?.find((x) => x.id === id);
      if (f) return f;
    }
    return null;
  }

  /** Object URL of a file, loading it from storage on first use. Null while unknown. */
  fileUrl(id) {
    if (this.blobUrls.has(id)) return this.blobUrls.get(id);
    if (!this.requested.has(`load:${id}`)) {
      this.requested.add(`load:${id}`);
      store.getBlob(id).then((entry) => {
        if (!entry) return this.emit('file-missing', id);
        this.blobUrls.set(id, URL.createObjectURL(new Blob([entry.data], { type: entry.type })));
        this.emit('file-ready', id);
      });
    }
    return null;
  }

  /** Ask a member who has the file to send it. */
  requestFile(id, authorId) {
    if (!this.mesh || this.progress.has(id)) return false;
    const target = this.mesh.links.has(authorId) ? authorId : [...this.mesh.links.keys()][0];
    if (!target) return false;
    this.progress.set(id, 0);
    this.emit('file-progress', id);
    this.sendTo(target, { type: 'file-req', id });
    setTimeout(() => {
      if (this.progress.get(id) === 0) {
        this.progress.delete(id);
        this.emit('file-progress', id);
      }
    }, 20000);
    return true;
  }

  async _serveFile(peerId, id) {
    if (typeof id !== 'string') return;
    const entry = await store.getBlob(id);
    if (entry && entry.den === this.id) this._push(id, entry.data, [peerId]);
  }
}

function debounce(fn, ms) {
  let t = null;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

async function thumbnail(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const hgt = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = hgt;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, hgt);
    let thumb = canvas.toDataURL('image/webp', 0.7);
    if (!thumb.startsWith('data:image/webp')) thumb = canvas.toDataURL('image/jpeg', 0.7);
    return { w: bitmap.width, h: bitmap.height, thumb: thumb.length < 60000 ? thumb : undefined };
  } catch {
    return {};
  }
}
