// Files in chat travel as binary chunks on their own data channel.
// Each chunk has an 18 byte header: magic, flags, the 8 byte file id, the
// chunk index and the chunk count. The receiver puts them back together in
// any order and reports progress.

export const CHUNK_SIZE = 15 * 1024;
export const MAX_FILE = 64 * 1024 * 1024;
const MAGIC = 0x48;
const HEADER = 18;

function idBytes(id) {
  if (!/^[0-9a-f]{16}$/.test(id)) throw new TypeError('file id must be 16 hex characters');
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) out[i] = parseInt(id.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function idHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Number of chunks for a file size. */
export function chunkCount(size, chunkSize = CHUNK_SIZE) {
  return Math.max(1, Math.ceil(size / chunkSize));
}

/** Build one chunk frame. */
export function encodeChunk({ id, index, total, data, encrypted = false }) {
  const out = new Uint8Array(HEADER + data.length);
  const view = new DataView(out.buffer);
  out[0] = MAGIC;
  out[1] = encrypted ? 1 : 0;
  out.set(idBytes(id), 2);
  view.setUint32(10, index);
  view.setUint32(14, total);
  out.set(data, HEADER);
  return out;
}

/** Parse a chunk frame, or return null when it is not one. */
export function decodeChunk(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < HEADER || bytes[0] !== MAGIC) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const index = view.getUint32(10);
  const total = view.getUint32(14);
  if (!total || index >= total) return null;
  return { id: idHex(bytes.subarray(2, 10)), encrypted: (bytes[1] & 1) === 1, index, total, data: bytes.subarray(HEADER) };
}

/** Slice bytes into chunk payloads. */
export function* slices(bytes, chunkSize = CHUNK_SIZE) {
  const total = chunkCount(bytes.length, chunkSize);
  for (let i = 0; i < total; i++) yield { index: i, total, data: bytes.subarray(i * chunkSize, Math.min(bytes.length, (i + 1) * chunkSize)) };
}

/** Collects the chunks of one file. */
export class Assembler {
  constructor({ id, size, total }) {
    if (size > MAX_FILE) throw new RangeError('file is too large');
    this.id = id;
    this.size = size;
    this.total = total;
    this.parts = new Array(total);
    this.received = 0;
    this.bytes = 0;
  }

  /** Add a chunk payload. Returns true when it was new. */
  add(index, data) {
    if (index >= this.total || this.parts[index]) return false;
    this.parts[index] = data.slice();
    this.received++;
    this.bytes += data.length;
    if (this.bytes > this.size + this.total) throw new RangeError('file is larger than announced');
    return true;
  }

  get done() {
    return this.received === this.total;
  }

  get progress() {
    return this.total ? this.received / this.total : 1;
  }

  /** The whole file once done. */
  bytesOut() {
    if (!this.done) throw new Error('file is incomplete');
    const out = new Uint8Array(this.bytes);
    let at = 0;
    for (const p of this.parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }
}

/** A short human size, like 1.5 MB. */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} ${units[u]}`;
}
