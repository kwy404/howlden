// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mentions, parse, parseInline, plainText, render, safeUrl } from '../src/markdown.js';

const ALLOWED = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'S', 'CODE', 'PRE', 'SPAN', 'A', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'H3', 'H4', 'H5']);
const ALLOWED_ATTRS = new Set(['class', 'href', 'target', 'rel', 'tabindex', 'role', 'aria-label', 'data-peer', 'data-lang', 'start']);

function html(source, resolveMention) {
  const box = document.createElement('div');
  box.appendChild(render(source, { document, resolveMention }));
  return box;
}

function assertSafe(box) {
  for (const node of box.querySelectorAll('*')) {
    expect(ALLOWED.has(node.tagName), node.tagName).toBe(true);
    for (const attr of node.attributes) {
      expect(ALLOWED_ATTRS.has(attr.name), attr.name).toBe(true);
      expect(attr.value.toLowerCase()).not.toMatch(/^\s*(javascript|data|vbscript):/);
    }
    if (node.tagName === 'A') expect(node.href).toMatch(/^https?:\/\//);
  }
}

describe('inline markdown', () => {
  it('formats bold, italic, underline, strike, spoiler and code', () => {
    const box = html('**b** *i* _j_ __u__ ~~s~~ ||sp|| `c`');
    expect(box.querySelector('strong').textContent).toBe('b');
    expect([...box.querySelectorAll('em')].map((e) => e.textContent)).toEqual(['i', 'j']);
    expect(box.querySelector('u').textContent).toBe('u');
    expect(box.querySelector('s').textContent).toBe('s');
    expect(box.querySelector('.md-spoiler').textContent).toBe('sp');
    expect(box.querySelector('code').textContent).toBe('c');
  });

  it('nests formatting', () => {
    const box = html('**bold *and italic***');
    expect(box.querySelector('strong em').textContent).toBe('and italic');
  });

  it('leaves snake_case, lone markers and unclosed markers alone', () => {
    expect(html('my_var_name').textContent).toBe('my_var_name');
    expect(html('my_var_name').querySelector('em')).toBe(null);
    expect(html('2 * 3 * 4').querySelector('em')).toBe(null);
    expect(html('**open').textContent).toBe('**open');
    expect(html('``').textContent).toBe('``');
  });

  it('supports backslash escapes', () => {
    const box = html('\\*not italic\\* and \\`tick\\`');
    expect(box.querySelector('em')).toBe(null);
    expect(box.textContent).toBe('*not italic* and `tick`');
  });

  it('keeps markdown inside inline code literal', () => {
    const box = html('`**x** <b>`');
    expect(box.querySelector('strong')).toBe(null);
    expect(box.querySelector('code').textContent).toBe('**x** <b>');
  });

  it('links http and https urls only', () => {
    const box = html('see https://example.com/a_b?x=1. and [docs](https://kwy404.github.io/howlden/)');
    const links = [...box.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://example.com/a_b?x=1', 'https://kwy404.github.io/howlden/']);
    expect(links[0].rel).toContain('noopener');
    expect(links[0].target).toBe('_blank');
    expect(links[1].textContent).toBe('docs');
    expect(box.textContent.endsWith('docs')).toBe(true);
    expect(html('(see https://example.com/page)').querySelector('a').getAttribute('href')).toBe('https://example.com/page');
    expect(html('https://en.wikipedia.org/wiki/Foo_(bar)').querySelector('a').getAttribute('href')).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
  });

  it('renders mentions through the resolver', () => {
    const resolve = (id) => (id === 'abcd1234' ? { name: 'Ana', self: true } : null);
    const box = html('hi <@abcd1234> and <@ffff0000> @everyone', resolve);
    const pills = [...box.querySelectorAll('.md-mention')];
    expect(pills.map((p) => p.textContent)).toEqual(['@Ana', '@unknown', '@everyone']);
    expect(pills[0].classList.contains('md-mention-me')).toBe(true);
    expect(pills[1].classList.contains('md-mention-me')).toBe(false);
    expect(mentions('hi <@abcd1234> @everyone <@abcd1234>')).toEqual(['abcd1234', 'everyone']);
    expect(mentions('mail me at x@everyone.com')).toEqual([]);
  });
});

describe('block markdown', () => {
  it('builds code blocks, quotes, headings and lists', () => {
    const box = html('# Title\n> quoted **bold**\n> second\n```js\nconst a = 1 < 2;\n```\n- one\n- two\n3. three\n4. four\nplain\nline');
    expect(box.querySelector('h3').textContent).toBe('Title');
    expect(box.querySelector('blockquote strong').textContent).toBe('bold');
    expect(box.querySelector('blockquote').textContent).toContain('second');
    expect(box.querySelector('pre code').textContent).toBe('const a = 1 < 2;');
    expect(box.querySelector('pre code').dataset.lang).toBe('js');
    expect([...box.querySelectorAll('ul li')].map((l) => l.textContent)).toEqual(['one', 'two']);
    expect(box.querySelector('ol').getAttribute('start')).toBe('3');
    expect(box.querySelectorAll(':scope > p br').length).toBe(1);
  });

  it('handles one line fences and unclosed fences', () => {
    expect(html('```x = 1```').querySelector('pre').textContent).toBe('x = 1');
    expect(html('```\nnever closed').querySelector('pre')).toBe(null);
  });

  it('drops trailing blank lines', () => {
    expect(parse('hello\n\n\n')).toHaveLength(1);
    expect(parse('')).toEqual([]);
  });
});

describe('XSS', () => {
  const vectors = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg/onload=alert(1)>',
    '[click](javascript:alert(1))',
    '[click](JaVaScRiPt:alert(1))',
    '[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '[x](https://ok.example/"onmouseover="alert(1))',
    '[a](https://x.y/ "title" onclick=alert(1))',
    'javascript:alert(1)',
    '**<b onclick=alert(1)>bold</b>**',
    '`</code><script>alert(1)</script>`',
    '```\n</pre><img src=x onerror=alert(1)>\n```',
    '<@abcd" onclick="alert(1)>',
    '||<iframe src=https://evil.example>||',
    '> <style>*{display:none}</style>',
    '<a href="javascript:alert(1)">x</a>',
    'https://example.com/<script>alert(1)</script>',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    '\u0000<script>',
  ];

  for (const vector of vectors) {
    it(`renders ${JSON.stringify(vector).slice(0, 50)} as text`, () => {
      const box = html(vector, () => ({ name: '<img src=x onerror=alert(1)>' }));
      assertSafe(box);
      expect(box.querySelector('script, img, svg, iframe, style')).toBe(null);
    });
  }

  it('keeps hostile mention names as text', () => {
    const box = html('<@abcd1234>', () => ({ name: '<img src=x onerror=alert(1)>' }));
    expect(box.querySelector('img')).toBe(null);
    expect(box.textContent).toBe('@<img src=x onerror=alert(1)>');
  });

  it('only accepts http and https in safeUrl', () => {
    expect(safeUrl('https://a.b/')).toBe('https://a.b/');
    expect(safeUrl('javascript:alert(1)')).toBe(null);
    expect(safeUrl('/relative')).toBe(null);
  });

  it('survives pathological nesting', () => {
    const deep = '**'.repeat(200) + 'x' + '**'.repeat(200);
    const nodes = parseInline(deep);
    expect(nodes.length).toBeGreaterThan(0);
    assertSafe(html(deep));
    const long = '*a'.repeat(5000);
    expect(() => html(long)).not.toThrow();
  });
});

describe('plain text', () => {
  it('flattens a message for previews', () => {
    const text = plainText('**hi** <@abcd1234>\n||secret|| `x`', () => ({ name: 'Ana' }));
    expect(text).toBe('hi @Ana [spoiler] x');
    expect(plainText('- a\n- b')).toBe('a b');
  });
});
