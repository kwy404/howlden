// Regression: applying the same answer twice used to throw "Failed to set
// remote answer sdp: Called in wrong state: stable" (a reply pasted twice, or
// handed over by another tab). A fake RTCPeerConnection enforces the same
// state rules as browsers.
import { describe, expect, it } from 'vitest';
import { RtcLink } from '../src/rtc.js';
import { Mesh, MeshError } from '../src/mesh.js';
import { FakeHub, settle } from './fake-transport.js';

class FakeChannel {
  constructor(label) {
    this.label = label;
    this.readyState = 'connecting';
    this.sent = [];
  }

  send(data) {
    this.sent.push(data);
  }

  addEventListener() {}
}

class FakePC {
  constructor() {
    this.signalingState = 'stable';
    this.iceGatheringState = 'complete';
    this.connectionState = 'new';
    this.localDescription = null;
    this.remoteDescription = null;
    this.remoteSets = 0;
  }

  createDataChannel(label) {
    return new FakeChannel(label);
  }

  async createOffer() {
    return { type: 'offer', sdp: 'v=0 offer' };
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'v=0 answer' };
  }

  async setLocalDescription(d) {
    const desc = d || { type: this.signalingState === 'have-remote-offer' ? 'answer' : 'offer', sdp: 'v=0 auto' };
    if (desc.type === 'answer' && this.signalingState !== 'have-remote-offer') throw new Error('Called in wrong state: ' + this.signalingState);
    this.localDescription = { ...desc, toJSON: () => desc };
    this.signalingState = desc.type === 'offer' ? 'have-local-offer' : 'stable';
  }

  async setRemoteDescription(d) {
    if (d.type === 'answer' && this.signalingState !== 'have-local-offer') throw new Error(`Failed to set remote answer sdp: Called in wrong state: ${this.signalingState}`);
    this.remoteSets++;
    this.remoteDescription = d;
    this.signalingState = d.type === 'offer' ? 'have-remote-offer' : 'stable';
  }

  addEventListener() {}

  removeEventListener() {}

  close() {}
}

describe('idempotent answers', () => {
  it('applies the first answer and ignores repeats instead of throwing', async () => {
    const link = new RtcLink({ RTCPeerConnection: FakePC, iceServers: [] });
    await link.offer();
    expect(await link.complete('v=0 answer')).toBe(true);
    expect(await link.complete('v=0 answer')).toBe(false);
    expect(await Promise.all([link.complete('a'), link.complete('b')])).toEqual([false, false]);
    expect(link.pc.remoteSets).toBe(1);
    link.close();
  });

  it('answers a repeated offer once', async () => {
    const link = new RtcLink({ RTCPeerConnection: FakePC, iceServers: [] });
    const [a, b] = await Promise.all([link.answer('v=0 offer'), link.answer('v=0 offer')]);
    expect(a).toBe(b);
    expect(link.pc.remoteSets).toBe(1);
    link.close();
  });

  it('ignores a stale renegotiation answer for camera and screen', async () => {
    const link = new RtcLink({ RTCPeerConnection: FakePC, iceServers: [] });
    const states = [];
    link.onstate = (s) => states.push(s);
    await link._onCtl(JSON.stringify({ description: { type: 'answer', sdp: 'v=0 late' } }));
    expect(states).toEqual([]);
    expect(link.pc.remoteSets).toBe(0);
    link.close();
  });

  it('marks a reply used twice in the mesh as answered, not as an error to show', async () => {
    const hub = new FakeHub();
    const host = new Mesh({ self: { id: 'aa', name: 'A' }, den: { id: 'd' }, transport: hub.transport('aa'), host: true });
    const guest = new Mesh({ self: { id: 'bb', name: 'B' }, den: { id: 'd' }, transport: hub.transport('bb') });
    const { inviteId, sdp } = await host.createInvite();
    const reply = await guest.acceptInvite({ inviteId, den: { id: 'd' }, host: host.self, sdp });
    await host.acceptReply(reply);
    await expect(host.acceptReply(reply)).rejects.toMatchObject({ reason: 'answered' });
    await expect(host.acceptReply(reply)).rejects.toBeInstanceOf(MeshError);
    await settle();
    expect([...host.links.keys()]).toEqual(['bb']);
  });
});

describe('held links (six word confirmation)', () => {
  async function heldPair() {
    const hub = new FakeHub();
    const host = new Mesh({ self: { id: 'aa', name: 'A' }, den: { id: 'd' }, transport: hub.transport('aa'), host: true });
    const guest = new Mesh({ self: { id: 'bb', name: 'B' }, den: { id: 'd' }, transport: hub.transport('bb') });
    const held = [];
    const inbox = [];
    host.on('held', (h) => held.push(h.peerId));
    host.on('message', (m) => inbox.push(m));
    const { inviteId, sdp } = await host.createInvite();
    const reply = await guest.acceptInvite({ inviteId, den: { id: 'd' }, host: host.self, sdp });
    await host.acceptReply(reply, { hold: true });
    await settle();
    return { host, guest, held, inbox };
  }

  it('keeps the guest out until released, letting only identity and pairing messages through', async () => {
    const { host, guest, held, inbox } = await heldPair();
    expect(held).toEqual(['bb']);
    expect(host.links.size).toBe(0);
    expect(host.members.has('bb')).toBe(false);
    guest.sendTo('aa', { type: 'id-hello', nonce: 'x' });
    guest.sendTo('aa', { type: 'rec', rec: {} });
    await settle();
    expect(inbox.map((m) => [m.body.type, m.held])).toEqual([['id-hello', true]]);
    expect(host.release('bb')).toBe(true);
    await settle();
    expect([...host.links.keys()]).toEqual(['bb']);
    expect(guest.relay).toBe('aa');
    expect(inbox.map((m) => m.body.type)).toEqual(['id-hello', 'rec']);
  });

  it('refuses a held guest with a reason', async () => {
    const { host, guest } = await heldPair();
    const refused = [];
    guest.on('refused', (r) => refused.push(r.reason));
    host.refuse('bb', 'words');
    await new Promise((r) => setTimeout(r, 300));
    await settle();
    expect(refused).toEqual(['words']);
    expect(host.held.size).toBe(0);
    expect(host.members.has('bb')).toBe(false);
  });
});
