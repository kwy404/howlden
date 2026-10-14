// Den settings shared by every member: the den name and its channels.
// Each field carries its own version stamp and the newest stamp wins, so
// members who rename or add channels while apart converge when they meet.

export const MAX_CHANNELS = 40;

/** Turn free text into a channel name: lowercase words joined by hyphens. */
export function channelName(text, kind = 'text') {
  const clean = String(text || '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, kind === 'text' ? '-' : ' ')
    .replace(/[^\p{L}\p{N}\- _']/gu, '')
    .slice(0, 32);
  return kind === 'text' ? clean.toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '') : clean;
}

/** A new den with default channels. */
export function newDen({ id, name, now, ids, labels = {} }) {
  const t = labels;
  return {
    id,
    name: String(name).slice(0, 60),
    nameV: now,
    locked: false,
    channels: [
      { id: ids[0], name: t.general || 'general', kind: 'text', pos: 0, v: now, deleted: false },
      { id: ids[1], name: t.links || 'links-and-media', kind: 'text', pos: 1, v: now, deleted: false },
      { id: ids[2], name: t.lounge || 'Lounge', kind: 'voice', pos: 2, v: now, deleted: false },
      { id: ids[3], name: t.gaming || 'Game night', kind: 'voice', pos: 3, v: now, deleted: false },
    ],
  };
}

function cleanChannel(c) {
  if (!c || typeof c.id !== 'string' || !/^[0-9a-f]{4,32}$/.test(c.id)) return null;
  const kind = c.kind === 'voice' ? 'voice' : 'text';
  return { id: c.id, name: channelName(c.name, kind) || (kind === 'voice' ? 'voice' : 'chat'), kind, pos: Number.isFinite(c.pos) ? c.pos : 0, v: Number.isFinite(c.v) ? c.v : 0, deleted: c.deleted === true };
}

/** Merge two copies of the den settings. */
export function mergeDen(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a };
  if ((b.nameV || 0) > (a.nameV || 0) || ((b.nameV || 0) === (a.nameV || 0) && String(b.name) > String(a.name))) {
    out.name = String(b.name || a.name).slice(0, 60);
    out.nameV = b.nameV || 0;
  }
  const map = new Map();
  for (const list of [a.channels || [], b.channels || []]) {
    for (const raw of list) {
      const c = cleanChannel(raw);
      if (!c) continue;
      const have = map.get(c.id);
      if (!have || c.v > have.v || (c.v === have.v && JSON.stringify(c) > JSON.stringify(have))) map.set(c.id, c);
    }
  }
  out.channels = [...map.values()].slice(0, MAX_CHANNELS * 2);
  return out;
}

/** Visible channels of one kind, in display order. */
export function visibleChannels(den, kind) {
  return (den.channels || []).filter((c) => !c.deleted && (!kind || c.kind === kind)).sort((x, y) => x.pos - y.pos || (x.id < y.id ? -1 : 1));
}

/** The public part of the den settings that is sent to members. */
export function denConfig(den) {
  return { name: den.name, nameV: den.nameV, channels: den.channels };
}
