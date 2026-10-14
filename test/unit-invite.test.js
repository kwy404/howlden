import { describe, expect, it } from 'vitest';
import {
  CodeError,
  codeLink,
  deflate,
  findCode,
  fromBase64Url,
  inflate,
  invitePayload,
  packCode,
  readInvite,
  readReply,
  replyPayload,
  toBase64Url,
  unpackCode,
} from '../src/invite.js';

// A realistic data channel offer from a browser, used to check the compression ratio.
const SDP = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 51923 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 203.0.113.7',
  'a=candidate:1467250027 1 udp 2122260223 192.168.1.20 51923 typ host generation 0 network-id 1',
  'a=candidate:2845226463 1 udp 2122194687 3c2a1f0e-1b7c-4d1e-9e6c-8f0e2d4a5b6c.local 51924 typ host generation 0 network-id 2',
  'a=candidate:842163049 1 udp 1686052607 203.0.113.7 51923 typ srflx raddr 192.168.1.20 rport 51923 generation 0 network-id 1',
  'a=candidate:3018395215 1 tcp 1518280447 192.168.1.20 9 typ host tcptype active generation 0 network-id 1',
  'a=ice-ufrag:Zx4Q',
  'a=ice-pwd:kR3vI0m6s8bW2uY1aT9eQ5nL',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 6B:8B:5D:EA:59:04:20:23:29:C8:87:1C:CD:87:32:BE:DD:8C:66:A5:8E:50:55:EA:20:C8:EF:59:0E:28:1E:9C',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

describe('base64url', () => {
  it('round trips every byte value', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const text = toBase64Url(bytes);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Array.from(fromBase64Url(text))).toEqual(Array.from(bytes));
  });

  it('handles every padding length and large inputs', () => {
    for (let n = 0; n < 6; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => 250 - i);
      expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(Array.from(bytes));
    }
    const big = new Uint8Array(100000).map((_, i) => i * 31);
    expect(fromBase64Url(toBase64Url(big)).length).toBe(100000);
  });

  it('rejects other alphabets', () => {
    expect(() => fromBase64Url('ab+c')).toThrow(TypeError);
    expect(() => fromBase64Url('a b')).toThrow(TypeError);
  });
});

describe('deflate-raw', () => {
  it('round trips and shrinks SDP', async () => {
    const bytes = new TextEncoder().encode(SDP);
    const packed = await deflate(bytes);
    expect(packed.length).toBeLessThan(bytes.length * 0.75);
    expect(new TextDecoder().decode(await inflate(packed))).toBe(SDP);
  });

  it('refuses decompression bombs', async () => {
    const packed = await deflate(new Uint8Array(400000));
    await expect(inflate(packed, 1000)).rejects.toThrow(RangeError);
  });
});

describe('codes', () => {
  const den = { id: 'a1b2c3d4e5f60718', name: 'Night owls', locked: true };
  const host = { id: '0011223344556677', name: 'Ana', avatar: 'seed1', publicKey: '', alg: '', tag: '' };
  const peer = { id: '8899aabbccddeeff', name: 'Bruno', avatar: 'seed2', publicKey: 'BAc_key-1', alg: 'Ed25519', tag: '8899' };

  it('packs an invite into a short url safe code and reads it back', async () => {
    const code = await packCode(invitePayload({ inviteId: 'x1', den, host, sdp: SDP }));
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(SDP.length);
    const invite = readInvite(await unpackCode(code));
    expect(invite).toEqual({ inviteId: 'x1', kind: 'den', den, host, sdp: SDP });
  });

  it('marks direct conversation invites and carries identity keys', async () => {
    const code = await packCode(invitePayload({ inviteId: 'x2', den, host: { ...peer, avatar: 'data:image/png;base64,AAAA' }, sdp: 'v=0', kind: 'dm' }));
    const invite = readInvite(await unpackCode(code));
    expect(invite.kind).toBe('dm');
    expect(invite.host).toEqual({ ...peer, avatar: '' });
  });

  it('marks invites made while the den is full', async () => {
    const code = await packCode(invitePayload({ inviteId: 'x3', den: { ...den, full: true, count: 5, max: 5 }, host, sdp: 'v=0' }));
    expect(readInvite(await unpackCode(code)).den.full).toEqual({ count: 5, max: 5 });
    const bogus = readInvite({ k: 'i', x: 'a', s: 'v=0', d: { id: 'd', f: ['x', 5] }, h: { id: 'h' } });
    expect(bogus.den.full).toBeUndefined();
  });

  it('packs a reply', async () => {
    const code = await packCode(replyPayload({ inviteId: 'x1', denId: den.id, peer, sdp: SDP }));
    const reply = readReply(await unpackCode(code));
    expect(reply).toEqual({ inviteId: 'x1', denId: den.id, peer, sdp: SDP });
  });

  it('explains damaged, foreign and mismatched codes', async () => {
    const code = await packCode(replyPayload({ inviteId: 'x1', denId: den.id, peer, sdp: SDP }));
    await expect(unpackCode(code.slice(0, 40))).rejects.toThrow(CodeError);
    await expect(unpackCode('%%%')).rejects.toThrow(/damaged/);
    const other = toBase64Url(await deflate(new TextEncoder().encode('{"v":9}')));
    await expect(unpackCode(other)).rejects.toThrow(/different version/);
    const notJson = toBase64Url(await deflate(new TextEncoder().encode('hello')));
    await expect(unpackCode(notJson)).rejects.toThrow(/damaged/);
    const reply = await unpackCode(code);
    expect(() => readInvite(reply)).toThrow(/not an invite/);
    expect(() => readReply({ k: 'i' })).toThrow(/not a reply/);
  });

  it('trims long names', () => {
    const invite = readInvite({ k: 'i', x: 'a', s: 'sdp', d: { id: 'd', n: 'n'.repeat(200) }, h: { id: 'h', n: 'm'.repeat(99) } });
    expect(invite.den.name.length).toBe(60);
    expect(invite.host.name.length).toBe(32);
    expect(invite.den.locked).toBe(false);
  });
});

describe('links', () => {
  it('builds links and finds codes in pasted text', () => {
    const link = codeLink('https://kwy404.github.io/howlden/app/#old', 'i', 'abcDEF123_-');
    expect(link).toBe('https://kwy404.github.io/howlden/app/#i=abcDEF123_-');
    expect(findCode(link)).toEqual({ kind: 'i', code: 'abcDEF123_-' });
    expect(findCode(`Here you go: ${link.replace('#i', '#r')} thanks`)).toEqual({ kind: 'r', code: 'abcDEF123_-' });
    expect(findCode('  abcdefghijABCDEFGHIJ0123 \n 456 ')).toEqual({ kind: '?', code: 'abcdefghijABCDEFGHIJ0123456' });
    expect(findCode('hello')).toBe(null);
    expect(findCode('')).toBe(null);
  });
});
