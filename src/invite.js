// Invite and reply codes. A code is JSON, compressed with deflate-raw through
// CompressionStream and written as base64url so it fits in a link hash and a
// QR code. The host sends an invite (#i=...), the guest answers with a reply
// (#r=...). Users never see the JSON.

export const CODE_VERSION = 1;

/** Encode bytes as base64url without padding. */
export function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode base64url (padding optional). Throws on characters outside the alphabet. */
export function fromBase64Url(text) {
  const clean = String(text).trim();
  if (!/^[A-Za-z0-9_-]*$/.test(clean)) throw new TypeError('not a base64url string');
  const b64 = clean.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((clean.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const body = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

/** Compress bytes with deflate-raw. */
export function deflate(bytes) {
  return pipe(bytes, new CompressionStream('deflate-raw'));
}

/** Decompress deflate-raw bytes. Rejects output above maxBytes. */
export async function inflate(bytes, maxBytes = 256 * 1024) {
  const out = await pipe(bytes, new DecompressionStream('deflate-raw'));
  if (out.length > maxBytes) throw new RangeError('code is too large');
  return out;
}

/** Pack a payload object into a compact code string. */
export async function packCode(payload) {
  const json = JSON.stringify({ v: CODE_VERSION, ...payload });
  return toBase64Url(await deflate(new TextEncoder().encode(json)));
}

/** Unpack a code string. Throws a CodeError with a reason users can read. */
export async function unpackCode(code) {
  let bytes;
  try {
    bytes = await inflate(fromBase64Url(code));
  } catch {
    throw new CodeError('damaged', 'This code is incomplete or damaged. Copy the whole link again.');
  }
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new CodeError('damaged', 'This code is incomplete or damaged. Copy the whole link again.');
  }
  if (!data || typeof data !== 'object' || data.v !== CODE_VERSION) {
    throw new CodeError('version', 'This code was made by a different version of howlden.');
  }
  return data;
}

export class CodeError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'CodeError';
    this.reason = reason;
  }
}

/** Find a code in a pasted link, hash or bare code. Returns { kind, code } with kind 'i', 'r' or '?'. */
export function findCode(input) {
  const text = String(input || '').trim();
  const match = /(?:^|[#&?])([ir])=([A-Za-z0-9_-]+)/.exec(text);
  if (match) return { kind: match[1], code: match[2] };
  const bare = text.replace(/\s+/g, '');
  if (/^[A-Za-z0-9_-]{16,}$/.test(bare)) return { kind: '?', code: bare };
  return null;
}

/** Build the invite payload. */
export function invitePayload({ inviteId, den, host, sdp }) {
  return {
    k: 'i',
    x: inviteId,
    d: { id: den.id, n: den.name, l: den.locked ? 1 : 0 },
    h: { id: host.id, n: host.name, a: host.avatar },
    s: sdp,
  };
}

/** Build the reply payload. */
export function replyPayload({ inviteId, denId, peer, sdp }) {
  return { k: 'r', x: inviteId, d: denId, p: { id: peer.id, n: peer.name, a: peer.avatar }, s: sdp };
}

/** Validate and normalize an unpacked invite. */
export function readInvite(data) {
  if (data?.k !== 'i' || typeof data.s !== 'string' || !data.d?.id || !data.h?.id || !data.x) {
    throw new CodeError('kind', 'This is not an invite link. Ask the host for a fresh invite.');
  }
  return {
    inviteId: String(data.x),
    den: { id: String(data.d.id), name: String(data.d.n || 'den').slice(0, 60), locked: data.d.l === 1 },
    host: { id: String(data.h.id), name: String(data.h.n || 'host').slice(0, 32), avatar: String(data.h.a || '') },
    sdp: data.s,
  };
}

/** Validate and normalize an unpacked reply. */
export function readReply(data) {
  if (data?.k !== 'r' || typeof data.s !== 'string' || !data.p?.id || !data.x) {
    throw new CodeError('kind', 'This is not a reply code. The reply comes from the person you invited.');
  }
  return {
    inviteId: String(data.x),
    denId: String(data.d || ''),
    peer: { id: String(data.p.id), name: String(data.p.n || 'guest').slice(0, 32), avatar: String(data.p.a || '') },
    sdp: data.s,
  };
}

/** Link for a code, given the app base URL (without hash). */
export function codeLink(base, kind, code) {
  return `${String(base).split('#')[0]}#${kind}=${code}`;
}
