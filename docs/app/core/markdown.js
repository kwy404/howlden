// Copied from src/ by scripts/sync-core.mjs. Edit the file in src/ instead.
// Chat markdown: a small parser that produces a plain object tree, and a
// renderer that builds DOM nodes from a fixed list of tags with
// createElement and createTextNode. Untrusted text is never parsed as HTML,
// so there is no way to inject markup, attributes or scripts.
//
// Supported: **bold**, *italic* and _italic_, __underline__, ~~strike~~,
// ||spoiler||, `code`, fenced code blocks, > quotes, # headings, - lists,
// 1. lists, autolinks and [text](https://url) for http and https only,
// <@peerid> mentions, @everyone, and backslash escapes.

const ESCAPABLE = new Set('\\`*_~|[]()<>#@-.!>'.split(''));
const MAX_DEPTH = 8;

/** True for absolute http and https URLs. */
export function safeUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function pushText(out, text) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === 'text') last.value += text;
  else out.push({ type: 'text', value: text });
}

const PAIRS = [
  ['||', 'spoiler'],
  ['**', 'strong'],
  ['__', 'u'],
  ['~~', 's'],
];

function closing(text, marker, from) {
  let i = text.indexOf(marker, from);
  while (i !== -1 && text[i - 1] === '\\') i = text.indexOf(marker, i + 1);
  return i;
}

/** Parse inline markdown into nodes. */
export function parseInline(text, depth = 0) {
  const out = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    pushText(out, buf);
    buf = '';
  };
  while (i < text.length) {
    const ch = text[i];
    const rest = text.slice(i);

    if (ch === '\\' && ESCAPABLE.has(text[i + 1])) {
      buf += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: 'code', value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (depth < MAX_DEPTH) {
      let matched = false;
      for (const [marker, type] of PAIRS) {
        if (!rest.startsWith(marker)) continue;
        let end = closing(text, marker, i + marker.length);
        while (end !== -1 && text[end + marker.length] === marker[0]) end++;
        if (end > i + marker.length) {
          flush();
          out.push({ type, children: parseInline(text.slice(i + marker.length, end), depth + 1) });
          i = end + marker.length;
          matched = true;
        }
        break;
      }
      if (matched) continue;

      if ((ch === '*' || ch === '_') && text[i + 1] !== ch && text[i + 1] && !/\s/.test(text[i + 1])) {
        const wordBefore = ch === '_' && /[\p{L}\p{N}]/u.test(text[i - 1] || '');
        let end = closing(text, ch, i + 1);
        while (end !== -1 && text[end + 1] === ch) end = closing(text, ch, end + 2);
        const wordAfter = ch === '_' && end !== -1 && /[\p{L}\p{N}]/u.test(text[end + 1] || '');
        if (!wordBefore && !wordAfter && end > i + 1 && !/\s/.test(text[end - 1])) {
          flush();
          out.push({ type: 'em', children: parseInline(text.slice(i + 1, end), depth + 1) });
          i = end + 1;
          continue;
        }
      }

      if (ch === '[') {
        const m = /^\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,2000})\)/.exec(rest);
        const href = m && safeUrl(m[2]);
        if (href) {
          flush();
          out.push({ type: 'link', href, children: [{ type: 'text', value: m[1] }] });
          i += m[0].length;
          continue;
        }
      }
    }

    if (ch === '<') {
      const m = /^<@([0-9a-f]{4,32})>/.exec(rest);
      if (m) {
        flush();
        out.push({ type: 'mention', id: m[1] });
        i += m[0].length;
        continue;
      }
    }

    if (ch === '@' && rest.startsWith('@everyone') && !/[\p{L}\p{N}]/u.test(text[i - 1] || '')) {
      flush();
      out.push({ type: 'mention', id: 'everyone' });
      i += 9;
      continue;
    }

    if ((ch === 'h' || ch === 'H') && /^https?:\/\//i.test(rest) && !/[\p{L}\p{N}]/u.test(text[i - 1] || '')) {
      let url = /^\S+/.exec(rest)[0];
      while (/[.,;:!?'")\]]$/.test(url) && !(url.endsWith(')') && url.includes('('))) url = url.slice(0, -1);
      const href = safeUrl(url);
      if (href) {
        flush();
        out.push({ type: 'link', href, children: [{ type: 'text', value: url }] });
        i += url.length;
        continue;
      }
    }

    buf += ch;
    i++;
  }
  flush();
  return out;
}

/** Parse a whole message into block nodes. */
export function parse(source) {
  const text = String(source ?? '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const blocks = [];
  let para = [];
  const flushPara = () => {
    if (!para.length) return;
    const children = [];
    para.forEach((line, n) => {
      if (n) children.push({ type: 'br' });
      children.push(...parseInline(line));
    });
    blocks.push({ type: 'paragraph', children });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^```([\w+-]{0,20})\s*(.*)$/.exec(line);
    if (fence) {
      let end = -1;
      if (fence[2].endsWith('```') && `${fence[1]}${fence[2].slice(0, -3)}`.trim()) {
        flushPara();
        blocks.push({ type: 'codeblock', lang: '', value: `${fence[1]} ${fence[2].slice(0, -3)}`.trim() });
        continue;
      }
      for (let j = i + 1; j < lines.length; j++) {
        if (/^```\s*$/.test(lines[j])) {
          end = j;
          break;
        }
      }
      if (end !== -1) {
        flushPara();
        const body = [fence[2], ...lines.slice(i + 1, end)].filter((l, n) => n > 0 || l !== '');
        blocks.push({ type: 'codeblock', lang: fence[1], value: body.join('\n') });
        i = end;
        continue;
      }
    }
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      flushPara();
      blocks.push({ type: 'heading', level: heading[1].length, children: parseInline(heading[2]) });
      continue;
    }
    if (/^> ?/.test(line) && line.length > 1) {
      flushPara();
      const quoted = [];
      while (i < lines.length && /^> ?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^> ?/, ''));
        i++;
      }
      i--;
      blocks.push({ type: 'quote', children: parse(quoted.join('\n')) });
      continue;
    }
    const item = /^(\s*)([-*]|\d{1,3}\.) (.+)$/.exec(line);
    if (item) {
      flushPara();
      const ordered = /\d/.test(item[2]);
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d{1,3}\.) (.+)$/.exec(lines[i]);
        if (!m || /\d/.test(m[2]) !== ordered) break;
        items.push(parseInline(m[3]));
        i++;
      }
      i--;
      blocks.push({ type: 'list', ordered, start: ordered ? parseInt(item[2], 10) : 1, items });
      continue;
    }
    para.push(line);
  }
  flushPara();
  while (blocks.length && blocks[blocks.length - 1].type === 'paragraph' && isBlank(blocks[blocks.length - 1])) blocks.pop();
  return blocks;
}

function isBlank(block) {
  return block.children.every((n) => n.type === 'br' || (n.type === 'text' && !n.value.trim()));
}

/** Plain text of a message, for notifications and reply previews. */
export function plainText(source, resolveMention = () => null) {
  const walk = (nodes) =>
    nodes
      .map((n) => {
        switch (n.type) {
          case 'text':
          case 'code':
          case 'codeblock':
            return n.value;
          case 'br':
            return ' ';
          case 'mention':
            return `@${n.id === 'everyone' ? 'everyone' : resolveMention(n.id)?.name || 'unknown'}`;
          case 'spoiler':
            return '[spoiler]';
          case 'list':
            return n.items.map(walk).join(' ');
          default:
            return walk(n.children || []);
        }
      })
      .join(' ')
      .replace(/\s+/g, ' ');
  return walk(parse(source)).trim();
}

/** Ids mentioned in a message, including 'everyone'. */
export function mentions(source) {
  const ids = new Set();
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'mention') ids.add(n.id);
      if (n.children) walk(n.children);
      if (n.items) n.items.forEach(walk);
    }
  };
  walk(parse(source));
  return [...ids];
}

const TAGS = { paragraph: 'p', strong: 'strong', em: 'em', u: 'u', s: 's', heading: 'h', quote: 'blockquote' };

/**
 * Build DOM nodes for a message.
 * @param {string} source
 * @param {{document?: Document, resolveMention?: (id: string) => ({name: string, self?: boolean} | null)}} [options]
 * @returns {DocumentFragment}
 */
export function render(source, { document: doc = globalThis.document, resolveMention = () => null } = {}) {
  const frag = doc.createDocumentFragment();
  const el = (tag, cls) => {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    return node;
  };
  const append = (parent, nodes) => {
    for (const n of nodes) parent.appendChild(build(n));
  };
  const build = (n) => {
    switch (n.type) {
      case 'text':
        return doc.createTextNode(n.value);
      case 'br':
        return el('br');
      case 'code': {
        const c = el('code', 'md-code');
        c.textContent = n.value;
        return c;
      }
      case 'codeblock': {
        const pre = el('pre', 'md-pre');
        const c = el('code');
        if (n.lang) c.dataset.lang = n.lang;
        c.textContent = n.value;
        pre.appendChild(c);
        return pre;
      }
      case 'spoiler': {
        const s = el('span', 'md-spoiler');
        s.tabIndex = 0;
        s.setAttribute('role', 'button');
        s.setAttribute('aria-label', 'Spoiler, press to reveal');
        append(s, n.children);
        return s;
      }
      case 'link': {
        const a = el('a', 'md-link');
        a.href = n.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer nofollow ugc';
        append(a, n.children);
        return a;
      }
      case 'mention': {
        const m = el('span', 'md-mention');
        const who = n.id === 'everyone' ? { name: 'everyone' } : resolveMention(n.id);
        m.textContent = `@${who?.name || 'unknown'}`;
        m.dataset.peer = n.id;
        if (who?.self || n.id === 'everyone') m.classList.add('md-mention-me');
        return m;
      }
      case 'heading': {
        const h = el(`h${n.level + 2}`, 'md-h');
        append(h, n.children);
        return h;
      }
      case 'list': {
        const list = el(n.ordered ? 'ol' : 'ul', 'md-list');
        if (n.ordered && n.start !== 1) list.start = n.start;
        for (const item of n.items) {
          const li = el('li');
          append(li, item);
          list.appendChild(li);
        }
        return list;
      }
      default: {
        const tag = TAGS[n.type];
        if (!tag) return doc.createTextNode('');
        const node = el(tag, n.type === 'quote' ? 'md-quote' : n.type === 'paragraph' ? 'md-p' : '');
        append(node, n.children);
        return node;
      }
    }
  };
  append(frag, parse(source));
  return frag;
}
