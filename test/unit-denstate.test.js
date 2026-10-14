import { describe, expect, it } from 'vitest';
import { channelName, denConfig, mergeDen, newDen, visibleChannels } from '../src/denstate.js';
import { buildIceServers, candidateTypes, diagnose, OPEN_RELAY, parseTurn, STUN_SERVERS } from '../src/rtc.js';

const den = () => newDen({ id: 'd1', name: 'Night owls', now: 10, ids: ['c001', 'c002', 'c003', 'c004'] });

describe('den settings', () => {
  it('normalizes channel names', () => {
    expect(channelName('  Off Topic!! ')).toBe('off-topic');
    expect(channelName('Sala de Jogos', 'voice')).toBe('Sala de Jogos');
    expect(channelName('<b>x</b>')).toBe('bxb');
    expect(channelName('café time')).toBe('café-time');
    expect(channelName('x'.repeat(50)).length).toBe(32);
  });

  it('creates default channels and lists them in order', () => {
    const d = den();
    expect(visibleChannels(d, 'text').map((c) => c.name)).toEqual(['general', 'links-and-media']);
    expect(visibleChannels(d, 'voice').map((c) => c.name)).toEqual(['Lounge', 'Game night']);
    expect(denConfig(d)).toEqual({ name: 'Night owls', nameV: 10, channels: d.channels });
  });

  it('merges renames, additions and deletions by version', () => {
    const a = den();
    const b = den();
    a.name = 'Renamed';
    a.nameV = 20;
    a.channels[0] = { ...a.channels[0], name: 'lobby', v: 30 };
    b.channels.push({ id: 'c005', name: 'Clips', kind: 'text', pos: 5, v: 25 });
    b.channels[1] = { ...b.channels[1], deleted: true, v: 26 };
    const ab = mergeDen(a, b);
    const ba = mergeDen(b, a);
    expect(ab.name).toBe('Renamed');
    expect(visibleChannels(ab).map((c) => c.name)).toEqual(['lobby', 'Lounge', 'Game night', 'clips']);
    expect(visibleChannels(ba).map((c) => c.name)).toEqual(visibleChannels(ab).map((c) => c.name));
    expect(mergeDen(null, a)).toBe(a);
    expect(mergeDen(a, undefined)).toBe(a);
  });

  it('drops malformed channels', () => {
    const merged = mergeDen(den(), { channels: [{ id: 'not hex!', name: 'x' }, null, { id: 'abcd', name: '', kind: 'voice', v: 1 }] });
    expect(merged.channels.find((c) => c.id === 'abcd')).toMatchObject({ name: 'voice', kind: 'voice' });
    expect(merged.channels).toHaveLength(5);
  });
});

describe('ICE configuration', () => {
  it('lists Google STUN, custom TURN and Open Relay', () => {
    const custom = parseTurn({ urls: 'turn:turn.example.com:3478 turns:turn.example.com:5349?transport=tcp', username: 'u', credential: 'p' });
    const servers = buildIceServers({ custom: [custom] });
    expect(servers[0].urls).toEqual(STUN_SERVERS);
    expect(servers[1]).toEqual({ urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349?transport=tcp'], username: 'u', credential: 'p' });
    expect(servers[2]).toBe(OPEN_RELAY);
    expect(buildIceServers({ openRelay: false })).toHaveLength(1);
  });

  it('validates TURN input with readable errors', () => {
    expect(() => parseTurn({ urls: '' })).toThrow(/at least one/);
    expect(() => parseTurn({ urls: 'https://turn.example.com' })).toThrow(/not a TURN address/);
    expect(() => parseTurn({ urls: 'turn:turn.example.com:3478' })).toThrow(/username/);
    expect(parseTurn({ urls: ['stun:stun.example.com:3478'] }).urls).toEqual(['stun:stun.example.com:3478']);
  });

  it('counts candidates and explains failures', () => {
    const host = 'a=candidate:1 1 udp 1 192.168.0.2 5000 typ host';
    const srflx = 'a=candidate:2 1 udp 1 203.0.113.9 5000 typ srflx raddr 0.0.0.0 rport 0';
    const relay = 'a=candidate:3 1 udp 1 198.51.100.4 5000 typ relay raddr 0.0.0.0 rport 0';
    expect(candidateTypes([host, srflx, srflx].join('\n'))).toEqual({ host: 1, srflx: 2, relay: 0, prflx: 0 });
    expect(diagnose({ localSdp: host, remoteSdp: srflx, online: false })).toBe('offline');
    expect(diagnose({ localSdp: '', remoteSdp: srflx })).toBe('blocked');
    expect(diagnose({ localSdp: host, remoteSdp: srflx })).toBe('no-stun');
    expect(diagnose({ localSdp: `${host}\n${srflx}`, remoteSdp: srflx })).toBe('strict-nat');
    expect(diagnose({ localSdp: relay, remoteSdp: relay })).toBe('timeout');
  });
});
