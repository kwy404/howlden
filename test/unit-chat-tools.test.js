import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { emptySearch, matchRecord, parseSearch } from '../src/search.js';
import { parseCommand, suggestCommands } from '../src/commands.js';
import { highlight, langOf } from '../src/highlight.js';
import { render } from '../src/markdown.js';
import { createRecord, setPinned } from '../src/history.js';

const rec = (extra = {}) => ({ ...createRecord({ id: 'a001', channel: 'c1', author: 'aaaa0001', ts: new Date(2026, 9, 10, 15).getTime(), text: 'Pizza on Friday? see https://example.com' }), ...extra });

describe('search', () => {
  it('parses words, phrases and filters', () => {
    const q = parseSearch('Pizza "next friday" from:@Ana has:file has:nope before:2026-10-12 after:2026-10-01 café');
    expect(q.words).toEqual(['pizza', 'next friday', 'has:nope', 'cafe']);
    expect(q.from).toEqual(['ana']);
    expect(q.has).toEqual(['file']);
    expect(q.before).toBe(new Date(2026, 9, 12).getTime());
    expect(q.after).toBe(new Date(2026, 9, 2).getTime());
    expect(emptySearch(parseSearch('  '))).toBe(true);
    expect(parseSearch('before:2026-02-31').before).toBeNull();
  });

  it('matches by text, author, kind and date', () => {
    const r = rec();
    const ctx = { author: 'Ana', me: false };
    expect(matchRecord(r, parseSearch('pizza friday'), ctx)).toBe(true);
    expect(matchRecord(r, parseSearch('tacos'), ctx)).toBe(false);
    expect(matchRecord(r, parseSearch('from:an has:link'), ctx)).toBe(true);
    expect(matchRecord(r, parseSearch('from:bia'), ctx)).toBe(false);
    expect(matchRecord(r, parseSearch('from:me'), { ...ctx, me: true })).toBe(true);
    expect(matchRecord(r, parseSearch('has:file'), ctx)).toBe(false);
    expect(matchRecord(r, parseSearch('before:2026-10-10'), ctx)).toBe(false);
    expect(matchRecord(r, parseSearch('before:2026-10-11 after:2026-10-09'), ctx)).toBe(true);
    expect(matchRecord(r, parseSearch('after:2026-10-10'), ctx)).toBe(false);
    expect(matchRecord(setPinned(r, true, r.ts + 1), parseSearch('has:pin'), ctx)).toBe(true);
    const files = rec({ text: '', files: [{ id: 'f1', name: 'Holiday.JPG', type: 'image/jpeg', size: 1 }, { id: 'f2', name: 'v.webm', type: 'audio/webm', voice: true, size: 1 }] });
    expect(matchRecord(files, parseSearch('has:image has:voice holiday'), ctx)).toBe(true);
    const poll = createRecord({ id: 'a002', channel: 'c1', author: 'aaaa0001', ts: 1, poll: { q: 'Where?', options: ['Beach', 'Hills'] } });
    expect(matchRecord(poll, parseSearch('has:poll beach'), ctx)).toBe(true);
    expect(matchRecord({ ...r, deleted: true }, parseSearch('pizza'), ctx)).toBe(false);
  });
});

describe('slash commands', () => {
  const seq = (...values) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('is null for ordinary text', () => {
    expect(parseCommand('hello')).toBeNull();
    expect(parseCommand('/')).toBeNull();
  });

  it('rolls dice and flips coins with the given randomness', () => {
    expect(parseCommand('/roll 2d6', seq(0, 0.99))).toEqual({ type: 'roll', count: 2, sides: 6, rolls: [1, 6], total: 7 });
    expect(parseCommand('/roll', seq(0.5))).toMatchObject({ count: 1, sides: 6, rolls: [4] });
    expect(parseCommand('/roll 20', seq(0.99))).toMatchObject({ count: 1, sides: 20, rolls: [20] });
    expect(parseCommand('/roll 50d6')).toEqual({ type: 'error', key: 'cmd.rollUsage', name: 'roll' });
    expect(parseCommand('/roll d1').type).toBe('error');
    expect(parseCommand('/coin', seq(0.1))).toEqual({ type: 'coin', heads: true });
    expect(parseCommand('/flip', seq(0.9))).toEqual({ type: 'coin', heads: false });
  });

  it('makes polls, /me, faces, nicknames, clear and help', () => {
    expect(parseCommand('/poll Lunch? | Pizza | Tacos | ')).toEqual({ type: 'poll', poll: { q: 'Lunch?', options: ['Pizza', 'Tacos'], multi: false } });
    expect(parseCommand('/poll Lunch? | Pizza').type).toBe('error');
    expect(parseCommand('/me waves')).toEqual({ type: 'text', text: 'waves', me: true });
    expect(parseCommand('/me').type).toBe('error');
    const shrug = parseCommand('/shrug ok');
    expect(shrug.text.startsWith('ok ')).toBe(true);
    const dom = new JSDOM('');
    expect(render(shrug.text.slice(3), { document: dom.window.document }).textContent).toBe('¯\\_(ツ)_/¯');
    expect(render(parseCommand('/unflip').text, { document: dom.window.document }).textContent).toContain(' _ ');
    expect(parseCommand('/nick   Luna  Wolf ')).toEqual({ type: 'nick', name: 'Luna Wolf' });
    expect(parseCommand('/nick').type).toBe('error');
    expect(parseCommand('/clear')).toEqual({ type: 'clear' });
    expect(parseCommand('/HELP')).toEqual({ type: 'help' });
    expect(parseCommand('/dance')).toEqual({ type: 'error', key: 'cmd.unknown', name: 'dance' });
    expect(suggestCommands('/ro').map((c) => c.name)).toEqual(['roll']);
    expect(suggestCommands('/').length).toBeGreaterThan(8);
    expect(suggestCommands('/roll 2')).toEqual([]);
  });
});

describe('code highlighting', () => {
  it('splits code into tokens that join back exactly', () => {
    const code = 'const n = 42; // answer\nfunction hi(name) { return `hi ${name}` + "!"; }';
    const toks = highlight(code, 'js');
    expect(toks.map((t) => t.value).join('')).toBe(code);
    const kinds = Object.fromEntries(toks.filter((t) => t.type).map((t) => [t.value.trim(), t.type]));
    expect(kinds.const).toBe('kw');
    expect(kinds['42']).toBe('num');
    expect(kinds['// answer']).toBe('com');
    expect(kinds.hi).toBe('fn');
    expect(kinds['"!"']).toBe('str');
  });

  it('knows a few languages and falls back for others', () => {
    expect(langOf('TypeScript')).toBe('js');
    expect(langOf('python')).toBe('py');
    expect(langOf('brainfun')).toBe('');
    const py = highlight('def f(x):\n    return x  # done', 'py');
    expect(py.find((t) => t.value === 'def').type).toBe('kw');
    expect(py.find((t) => t.type === 'com').value).toBe('# done');
    const sql = highlight("SELECT * FROM t WHERE a = 'x' -- why", 'sql');
    expect(sql.filter((t) => t.type === 'kw').map((t) => t.value)).toEqual(['SELECT', 'FROM', 'WHERE']);
    const any = 'a <b> & "c"';
    expect(highlight(any, 'nope').map((t) => t.value).join('')).toBe(any);
  });

  it('renders highlighted code blocks without parsing markup', () => {
    const dom = new JSDOM('');
    const frag = render('```js\nconst x = "<img src=x onerror=alert(1)>";\n```', { document: dom.window.document });
    const code = frag.querySelector('pre code');
    expect(code.querySelector('.hl-kw').textContent).toBe('const');
    expect(code.querySelector('.hl-str').textContent).toContain('<img');
    expect(code.querySelector('img')).toBeNull();
    expect(code.textContent).toBe('const x = "<img src=x onerror=alert(1)>";');
  });
});
