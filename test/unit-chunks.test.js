import { describe, expect, it } from 'vitest';
import { Assembler, CHUNK_SIZE, chunkCount, decodeChunk, encodeChunk, formatSize, slices } from '../src/chunks.js';
import { avatarSvg, avatarTraits, avatarUrl, nameColor } from '../src/avatar.js';
import { decryptBytes, deriveKey, encryptBytes } from '../src/crypto.js';

const ID = '0123456789abcdef';

describe('chunks', () => {
  it('encodes and decodes frames', () => {
    const frame = encodeChunk({ id: ID, index: 3, total: 9, data: new Uint8Array([1, 2, 3]), encrypted: true });
    expect(frame.length).toBe(21);
    const c = decodeChunk(frame.buffer);
    expect(c).toMatchObject({ id: ID, index: 3, total: 9, encrypted: true });
    expect(Array.from(c.data)).toEqual([1, 2, 3]);
    expect(() => encodeChunk({ id: 'xyz', index: 0, total: 1, data: new Uint8Array() })).toThrow(TypeError);
  });

  it('rejects frames that are not chunks', () => {
    expect(decodeChunk(new Uint8Array(4))).toBe(null);
    const frame = encodeChunk({ id: ID, index: 0, total: 1, data: new Uint8Array(1) });
    frame[0] = 0;
    expect(decodeChunk(frame)).toBe(null);
    const bad = encodeChunk({ id: ID, index: 5, total: 2, data: new Uint8Array(1) });
    expect(decodeChunk(bad)).toBe(null);
  });

  it('slices and reassembles out of order, including encrypted payloads', async () => {
    const key = await deriveKey('pw', 'den', 1000);
    const file = Uint8Array.from({ length: CHUNK_SIZE * 3 + 77 }, (_, i) => (i * 13) & 255);
    const frames = [];
    for (const s of slices(file)) {
      const sealed = await encryptBytes(key, s.data, `${ID}:${s.index}`);
      frames.push(encodeChunk({ id: ID, index: s.index, total: s.total, data: sealed, encrypted: true }));
    }
    expect(frames).toHaveLength(chunkCount(file.length));
    const asm = new Assembler({ id: ID, size: file.length, total: frames.length });
    for (const f of [frames[2], frames[0], frames[3], frames[0], frames[1]]) {
      const c = decodeChunk(f);
      asm.add(c.index, await decryptBytes(key, c.data, `${ID}:${c.index}`));
    }
    expect(asm.done).toBe(true);
    expect(asm.progress).toBe(1);
    expect(asm.bytesOut()).toEqual(file);
  });

  it('guards sizes', () => {
    expect(chunkCount(0)).toBe(1);
    expect(() => new Assembler({ id: ID, size: 1e12, total: 1 })).toThrow(RangeError);
    const asm = new Assembler({ id: ID, size: 2, total: 2 });
    expect(() => asm.bytesOut()).toThrow(/incomplete/);
    expect(asm.add(9, new Uint8Array(1))).toBe(false);
    expect(() => asm.add(0, new Uint8Array(100))).toThrow(/larger/);
  });

  it('formats sizes', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(20 * 1024 * 1024)).toBe('20 MB');
    expect(formatSize(5 * 1024 ** 4)).toBe('5120 GB');
  });
});

describe('avatars', () => {
  it('are deterministic and vary by seed', () => {
    expect(avatarSvg('ana')).toBe(avatarSvg('ana'));
    expect(avatarSvg('ana')).not.toBe(avatarSvg('bia'));
    const seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(JSON.stringify(avatarTraits(`seed${i}`)));
    expect(seen.size).toBe(40);
  });

  it('never include the seed text', () => {
    const svg = avatarSvg('<script>alert(1)</script>');
    expect(svg).not.toContain('script');
    expect(avatarUrl('x').startsWith('data:image/svg+xml,')).toBe(true);
    expect(nameColor('x')).toMatch(/^hsl\(\d+ 70% var\(--name-l, 62%\)\)$/);
  });
});
