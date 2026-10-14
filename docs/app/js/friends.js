// The friends list: everyone whose identity key was verified on a connection.

import { Emitter } from '../core/mesh.js';
import { friendStatus } from '../core/identity.js';
import * as store from './store.js';

export class Friends extends Emitter {
  constructor(app) {
    super();
    this.app = app;
    this.map = new Map();
  }

  async load() {
    this.map.clear();
    for (const f of await store.listFriends()) this.map.set(f.id, f);
  }

  list() {
    return [...this.map.values()].filter((f) => !f.removed).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  get(id) {
    const f = this.map.get(id);
    return f && !f.removed ? f : null;
  }

  /** Whether a friend is connected in any den or conversation right now. */
  isOnline(id) {
    for (const s of this.app.sessions.values()) if (s.mesh?.links.has(id)) return true;
    return false;
  }

  /**
   * Record a peer whose key was just verified. Returns 'known' when the same
   * key was seen before, 'new' for a first meeting and 'name-clash' when a
   * friend with the same name uses another key.
   */
  async verified(peer) {
    const status = friendStatus(this.list(), peer);
    const have = this.map.get(peer.id);
    const now = Date.now();
    const f = {
      ...have,
      id: peer.id,
      name: peer.name || have?.name || 'friend',
      tag: peer.tag,
      avatar: peer.avatar || have?.avatar || '',
      status: peer.status || '',
      accent: peer.accent || '',
      publicKey: peer.publicKey,
      alg: peer.alg,
      firstSeen: have?.firstSeen || now,
      lastSeen: now,
      removed: false,
    };
    this.map.set(f.id, f);
    await store.putFriend(f);
    if (status === 'name-clash') this.emit('warning', f);
    this.emit('change');
    return status;
  }

  async touch(id, patch) {
    const f = this.map.get(id);
    if (!f) return;
    Object.assign(f, patch);
    await store.putFriend(f);
    this.emit('change');
  }

  async remove(id) {
    await this.touch(id, { removed: true });
  }
}
