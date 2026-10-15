// Checks the built website in docs/ (not the app): SEO tags, guides, hreflang
// pairs, the sitemap, the footer and the house rules on every page.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docs = join(process.cwd(), 'docs');
const SITE = 'https://kwy404.github.io/howlden/';
const read = (p) => readFileSync(join(docs, p), 'utf8');
const words = (html) => html.replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const attr = (html, re) => (re.exec(html) || [])[1];

const en = readdirSync(join(process.cwd(), 'scripts', 'site', 'guides')).filter((f) => f.endsWith('.html'));
const pt = readdirSync(join(process.cwd(), 'scripts', 'site', 'guides', 'pt')).filter((f) => f.endsWith('.html'));
const pages = ['index.html', 'guides.html', '404.html', ...en, ...pt.map((f) => `pt/${f}`)];

describe('site pages', () => {
  it('has at least 10 English guides and 2 Portuguese guides', () => {
    expect(en.length).toBeGreaterThanOrEqual(10);
    expect(pt.length).toBeGreaterThanOrEqual(2);
  });

  it.each(pages)('%s has a title, a description, OG tags and the footer', (p) => {
    const html = read(p);
    const title = attr(html, /<title>([^<]+)<\/title>/);
    const desc = attr(html, /<meta name="description" content="([^"]+)"/);
    expect(title.length).toBeGreaterThan(10);
    expect(title.length).toBeLessThanOrEqual(70);
    expect(desc.length).toBeGreaterThanOrEqual(110);
    expect(desc.length).toBeLessThanOrEqual(165);
    const og = attr(html, /<meta property="og:image" content="([^"]+)"/);
    expect(og.startsWith(SITE)).toBe(true);
    expect(existsSync(join(docs, og.slice(SITE.length)))).toBe(true);
    expect(html).toContain('rel="me noopener"');
    expect(html).toMatch(/Built with <a href="https:\/\/kwy404\.github\.io\/monsoon\/">Monsoon<\/a>/);
    expect(html).toMatch(/Interactive parts built with <a href="https:\/\/kwy404\.github\.io\/Voodoo\.js\/">Voodoo\.js<\/a>/);
    for (const name of ['monsoon', 'Voodoo.js', 'filefinch', 'breakhound', 'vueleap', 'graphemely', 'numberparrot', 'edgegoat', 'cookieowl', 'installkite', 'a11ymedic', 'fontsketch', 'kastor']) {
      expect(html).toContain(`https://kwy404.github.io/${name}/`);
    }
    expect(html).toContain('https://cdn.jsdelivr.net/npm/monsooncss@0.2.0/dist/monsoon.min.css');
    expect(html).toContain('https://cdn.jsdelivr.net/npm/voodoojs@1.0.0/dist/voodoo.full.min.js');
  });

  it.each(pages)('%s follows the house rules', (p) => {
    const html = read(p);
    expect(html).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    for (const m of html.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g)) expect(() => JSON.parse(m[1])).not.toThrow();
  });

  it.each([...en, ...pt.map((f) => `pt/${f}`)])('%s is a real guide with canonical, FAQ and 800+ words', (p) => {
    const html = read(p);
    expect(html).toContain(`<link rel="canonical" href="${SITE}${p}">`);
    expect(html).toContain('"@type": "FAQPage"');
    expect(html).toContain('"@type": "TechArticle"');
    expect(html).toContain('"@type": "BreadcrumbList"');
    const body = /<div class="guide-prose">([\s\S]*?)<section id="faq"/.exec(html)[1];
    expect(words(body)).toBeGreaterThanOrEqual(800);
    expect(html).toMatch(/href="(\.\.\/)?app\/"/);
  });

  it('pairs every Portuguese guide with its English twin through hreflang', () => {
    for (const f of pt) {
      const html = read(`pt/${f}`);
      expect(html).toContain('<html lang="pt-BR">');
      const enUrl = attr(html, /hreflang="en" href="([^"]+)"/);
      expect(enUrl).toBeTruthy();
      const twin = read(enUrl.slice(SITE.length));
      expect(twin).toContain(`hreflang="pt-BR" href="${SITE}pt/${f}"`);
      expect(html).toContain('hreflang="x-default"');
    }
  });

  it('lists every indexable page in the sitemap, and robots points to it', () => {
    const sitemap = read('sitemap.xml');
    for (const p of pages.filter((x) => x !== '404.html')) expect(sitemap).toContain(`<loc>${SITE}${p === 'index.html' ? '' : p}</loc>`);
    expect(sitemap).toContain('xhtml:link rel="alternate" hreflang="pt-BR"');
    expect(read('robots.txt')).toContain(`Sitemap: ${SITE}sitemap.xml`);
    expect(read('404.html')).toContain('<meta name="robots" content="noindex">');
  });

  it('describes the app as a WebApplication with price 0 and an FAQ', () => {
    const html = read('index.html');
    expect(html).toContain('"@type": "WebApplication"');
    expect(html).toMatch(/"price": "0"/);
    expect(html).toContain('"@type": "FAQPage"');
    expect(html).toMatch(/href="app\/"/);
  });

  it('keeps the security copy honest', () => {
    const all = pages.map(read).join('\n').replace(/<[^>]+>/g, ' ');
    expect(all).not.toMatch(/impossible to hack|unhackable|military grade|100% secure|completely anonymous/i);
    expect(all).toMatch(/No server of ours ever sees/);
    expect(all).toMatch(/DTLS/);
    expect(all).toMatch(/TURN relay/);
  });
});
