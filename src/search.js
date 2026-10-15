// Message search with filters, all on this device:
//   pizza "next friday" from:ana has:file before:2026-10-01 after:2026-09-01
// has: takes file, image, voice, link, poll, sticker or pin. from:me is you.
// Dates are local days: before: means earlier than that day, after: later.

export const HAS = ['file', 'image', 'voice', 'link', 'poll', 'sticker', 'pin'];

const fold = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function localDay(text) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

/** Parse a query into { words, from, has, before, after } (before and after are timestamps). */
export function parseSearch(query) {
  const out = { words: [], from: [], has: [], before: null, after: null };
  for (const m of String(query || '').matchAll(/(\w+):("[^"]*"|\S+)|"([^"]*)"|(\S+)/g)) {
    const [, key, rawValue, phrase, word] = m;
    const value = rawValue?.replace(/^"|"$/g, '');
    const k = key?.toLowerCase();
    if (k === 'from' && value) out.from.push(fold(value.replace(/^@/, '')));
    else if (k === 'has' && HAS.includes(value?.toLowerCase())) out.has.push(value.toLowerCase());
    else if ((k === 'before' || k === 'after') && localDay(value)) {
      const d = localDay(value);
      if (k === 'before') out.before = d.getTime();
      else out.after = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    } else if (phrase !== undefined) {
      if (phrase.trim()) out.words.push(fold(phrase.trim()));
    } else out.words.push(fold(word ?? m[0]));
  }
  return out;
}

/** True when nothing would filter. */
export const emptySearch = (q) => !q.words.length && !q.from.length && !q.has.length && q.before == null && q.after == null;

function has(rec, what) {
  const files = rec.files || [];
  switch (what) {
    case 'file':
      return files.length > 0;
    case 'image':
      return files.some((f) => /^image\//.test(f.type));
    case 'voice':
      return files.some((f) => f.voice);
    case 'link':
      return /https?:\/\/\S/i.test(rec.text || '');
    case 'poll':
      return !!rec.poll;
    case 'sticker':
      return !!rec.sticker;
    case 'pin':
      return rec.pin?.[1] === 1;
    default:
      return false;
  }
}

/**
 * Whether a record matches. `text` is its plain text (mentions resolved),
 * `author` its author's name, and `me` true when I wrote it.
 */
export function matchRecord(rec, q, { text = rec.text, author = '', me = false } = {}) {
  if (rec.deleted) return false;
  if (q.before != null && rec.ts >= q.before) return false;
  if (q.after != null && rec.ts < q.after) return false;
  if (q.from.length && !q.from.some((f) => (f === 'me' && me) || fold(author).startsWith(f))) return false;
  if (!q.has.every((what) => has(rec, what))) return false;
  if (q.words.length) {
    const hay = fold([text, rec.poll?.q, ...(rec.poll?.options || []), ...(rec.files || []).map((f) => f.name)].filter(Boolean).join(' '));
    if (!q.words.every((w) => hay.includes(w))) return false;
  }
  return true;
}
