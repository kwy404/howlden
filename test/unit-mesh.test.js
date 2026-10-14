import { describe, expect, it } from 'vitest';
import { Emitter, Mesh, MeshError, electRelay, forwardTargets } from '../src/mesh.js';
import { invitePayload, packCode, readInvite, readReply, replyPayload, unpackCode } from '../src/invite.js';
import { FakeHub, settle } from './fake-transport.js';

const DEN = { id: 'den0000000000001', name: 'Test den' };
let clock = 1000;
const now = () => clock++;

function peer(hub, id, opts = {}) {
  const mesh = new Mesh({ self: { id, name: id.toUpperCase(), avatar: `a-${id}` }, den: DEN, transport: hub.transport(id), now, introTimeout: 200, ...opts });
  mesh.inbox = [];
  mesh.on('message', (m) => mesh.inbox.push(m));
  return mesh;
}

// The full manual round trip, through real invite and reply codes.
async function join(introducer, guest) {
  const { inviteId, sdp } = await introducer.createInvite();
  const inviteCode = await packCode(invitePayload({ inviteId, den: introducer.den, host: introducer.self, sdp }));
  const invite = readInvite(await unpackCode(inviteCode));
  const reply = await guest.acceptInvite(invite);
  const replyCode = await packCode(replyPayload(reply));
  await introducer.acceptReply(readReply(await unpackCode(replyCode)));
  await settle();
}

const linked = (mesh) => [...mesh.links.keys()].sort();
const online = (mesh) => mesh.memberList().filter((m) => m.online).map((m) => m.id).sort();

describe('pure helpers', () => {
  it('elects the online member who joined first', () => {
    const members = [
      { id: 'b', joinedAt: 5, online: true },
      { id: 'a', joinedAt: 3, online: false },
      { id: 'c', joinedAt: 5, online: true },
      { id: 'd', joinedAt: null, online: true },
    ];
    expect(electRelay(members)).toBe('b');
    expect(electRelay([{ id: 'x', joinedAt: 1, online: false }])).toBe(null);
  });

  it('forwards only to peers the origin cannot reach', () => {
    expect(forwardTargets({ origin: 'a', via: 'a', linked: ['a', 'b', 'c', 'd'], originLinks: new Set(['r', 'b']) })).toEqual(['c', 'd']);
    expect(forwardTargets({ origin: 'a', via: 'b', linked: ['a', 'b', 'c'], originLinks: undefined })).toEqual(['c']);
  });

  it('isolates emitter handler errors', () => {
    const e = new Emitter();
    const errors = [];
    e.on('error', (err) => errors.push(err.message));
    e.on('x', () => {
      throw new Error('boom');
    });
    const off = e.on('x', (v) => errors.push(`got ${v}`));
    e.emit('x', 1);
    off();
    e.emit('x', 2);
    expect(errors).toEqual(['boom', 'got 1', 'boom']);
  });
});

describe('mesh introduction', () => {
  it('connects a guest through one invite and one reply', async () => {
    const hub = new FakeHub();
    const host = peer(hub, 'aa', { host: true });
    const guest = peer(hub, 'bb');
    const welcomes = [];
    guest.on('welcome', (w) => welcomes.push(w));
    await join(host, guest);
    expect(linked(host)).toEqual(['bb']);
    expect(linked(guest)).toEqual(['aa']);
    expect(welcomes).toHaveLength(1);
    expect(welcomes[0].expected).toEqual([]);
    expect(guest.relay).toBe('aa');
    expect(guest.self.joinedAt).toBeGreaterThan(host.self.joinedAt);
    expect(online(guest)).toEqual(['aa', 'bb']);
    expect(guest.memberList().find((m) => m.id === 'aa').name).toBe('AA');
  });

  it('builds a full mesh where only the host exchanged codes', async () => {
    const hub = new FakeHub();
    const host = peer(hub, 'aa', { host: true });
    const guests = ['bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh'].map((id) => peer(hub, id));
    for (const g of guests) await join(host, g);
    await settle();
    const all = [host, ...guests];
    const ids = all.map((m) => m.self.id).sort();
    for (const m of all) {
      expect(linked(m)).toEqual(ids.filter((id) => id !== m.self.id));
      expect(online(m)).toEqual(ids);
      expect(m.relay).toBe('aa');
    }
    const order = host.memberList().map((m) => m.id);
    for (const m of all) expect(m.memberList().map((x) => x.id)).toEqual(order);
  });

  it('refuses a ninth member', async () => {
    const hub = new FakeHub();
    const host = peer(hub, 'aa', { host: true, max: 3 });
    await join(host, peer(hub, 'bb'));
    const { inviteId, sdp } = await host.createInvite();
    await join(host, peer(hub, 'cc'));
    expect(host.onlineCount()).toBe(3);
    await expect(host.createInvite()).rejects.toThrow(MeshError);
    const late = peer(hub, 'dd');
    const reply = await late.acceptInvite({ inviteId, den: DEN, host: host.self, sdp });
    await expect(host.acceptReply(reply)).rejects.toMatchObject({ reason: 'full' });
  });

  it('delivers broadcasts once to everyone and direct messages to one peer', async () => {
    const hub = new FakeHub();
    const host = peer(hub, 'aa', { host: true });
    const b = peer(hub, 'bb');
    const c = peer(hub, 'cc');
    await join(host, b);
    await join(host, c);
    const id = c.broadcast({ text: 'hi all' });
    b.sendTo('aa', { text: 'just you' });
    await settle();
    expect(host.inbox.map((m) => m.body.text).sort()).toEqual(['hi all', 'just you']);
    expect(b.inbox.map((m) => [m.body.text, m.from, m.id, m.direct])).toEqual([['hi all', 'cc', id, true]]);
    expect(c.inbox).toHaveLength(0);
  });

  it('elects a new relay when the host leaves and keeps working', async () => {
    const hub = new FakeHub();
    const host = peer(hub, 'aa', { host: true });
    const b = peer(hub, 'bb');
    const c = peer(hub, 'cc');
    await join(host, b);
    await join(host, c);
    const relays = [];
    c.on('relay', (r) => relays.push(r));
    host.leave();
    await settle();
    expect(b.relay).toBe('bb');
    expect(c.relay).toBe('bb');
    expect(relays).toEqual(['bb']);
    expect(online(c)).toEqual(['bb', 'cc']);
    expect(c.memberList().find((m) => m.id === 'aa').online).toBe(false);

    const d = peer(hub, 'dd');
    await join(b, d);
    await settle();
    expect(linked(d)).toEqual(['bb', 'cc']);
    expect(d.relay).toBe('bb');
    d.broadcast({ text: 'after' });
    await settle();
    expect(c.inbox.map((m) => m.body.text)).toEqual(['after']);
  });

  it('routes through the relay when two members cannot connect directly', async () => {
    const hub = new FakeHub();
    hub.block('bb', 'cc');
    const host = peer(hub, 'aa', { host: true });
    const b = peer(hub, 'bb');
    const c = peer(hub, 'cc');
    const failures = [];
    c.on('link-failed', (f) => failures.push(f.peerId));
    await join(host, b);
    await join(host, c);
    await new Promise((r) => setTimeout(r, 260));
    await settle();
    expect(linked(c)).toEqual(['aa']);
    expect(failures).toContain('bb');
    b.broadcast({ text: 'relayed' });
    c.sendTo('bb', { text: 'routed' });
    await settle();
    expect(c.inbox.map((m) => [m.body.text, m.direct])).toEqual([['relayed', false]]);
    expect(b.inbox.map((m) => [m.body.text, m.direct])).toEqual([['routed', false]]);
    expect(host.inbox).toHaveLength(1);
  });

  it('shares profile changes', async () => {
    const hub = new FakeHub();
    const host = peer(hub, 'aa', { host: true });
    const b = peer(hub, 'bb');
    await join(host, b);
    b.setProfile({ name: 'Bruno', avatar: 'new' });
    await settle();
    expect(host.memberList().find((m) => m.id === 'bb')).toMatchObject({ name: 'Bruno', avatar: 'new' });
  });

  it('explains wrong, stale and self codes', async () => {
    const hub = new FakeHub();
    const host = peer(hub, 'aa', { host: true });
    const { inviteId, sdp } = await host.createInvite();
    await expect(host.acceptReply({ inviteId: 'nope', peer: { id: 'x' }, sdp: '' })).rejects.toMatchObject({ reason: 'expired' });
    await expect(host.acceptReply({ inviteId, denId: 'other', peer: { id: 'x' }, sdp: '' })).rejects.toMatchObject({ reason: 'den' });
    await expect(host.acceptReply({ inviteId, peer: { id: 'aa' }, sdp: '' })).rejects.toMatchObject({ reason: 'self' });
    await expect(host.acceptInvite({ inviteId, den: DEN, host: host.self, sdp })).rejects.toMatchObject({ reason: 'self' });
    host.cancelInvite(inviteId);
    expect(host.pending.size).toBe(0);
  });

  it('keeps known members from history offline until they connect', async () => {
    const hub = new FakeHub();
    const host = peer(hub, 'aa', { host: true });
    host.addKnownMembers([{ id: 'zz', name: 'Old friend', joinedAt: 1 }, { id: 'aa', name: 'me' }]);
    expect(host.memberList().map((m) => [m.id, m.online])).toEqual([['zz', false], ['aa', true]]);
    expect(host.relay).toBe('aa');
    const b = peer(hub, 'bb');
    await join(host, b);
    expect(b.memberList().find((m) => m.id === 'zz')).toMatchObject({ name: 'Old friend', online: false });
    expect(b.relay).toBe('aa');
  });

  it('ignores garbage and spoofed control messages', async () => {
    const hub = new FakeHub();
    const host = peer(hub, 'aa', { host: true });
    const b = peer(hub, 'bb');
    await join(host, b);
    const link = b.links.get('aa');
    link.send('not json');
    link.send(JSON.stringify({ nope: 1 }));
    link.send(JSON.stringify({ t: 'hello', peer: { id: 'zz', name: 'spoof' } }));
    link.send(JSON.stringify({ t: 'welcome', members: [] }));
    await settle();
    expect(host.members.has('zz')).toBe(false);
    expect(linked(host)).toEqual(['bb']);
  });

  it('stops everything on leave', async () => {
    const hub = new FakeHub();
    const host = peer(hub, 'aa', { host: true });
    const b = peer(hub, 'bb');
    await join(host, b);
    await host.createInvite();
    b.leave();
    b.leave();
    await settle();
    expect(b.links.size).toBe(0);
    expect(linked(host)).toEqual([]);
    expect(online(host)).toEqual(['aa']);
    await expect(b.createInvite()).rejects.toMatchObject({ reason: 'closed' });
  });
});
