// Builds the howlden website (every page in docs/ except docs/app/) and the
// art in assets/ from the sources in scripts/site/.
//   scripts/site/guides/*.html      English guides: a meta comment, then sections
//   scripts/site/guides/pt/*.html   Portuguese guides, paired with hreflang
//   scripts/site/*.mjs              layout, landing page, guide pages and art
// Code samples are highlighted with Shiki (light-plus and dark-plus) at build
// time. Results are cached in scripts/site/highlight-cache.json, so a check
// run (CI) does not need Shiki installed.
// Usage: node scripts/site/build-site.mjs [--check]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PAL, builder, lunaFace, mascot, mascotHead, favicon, sticker, svg } from './art.mjs';
import { banner } from './banners.mjs';
import { ICON_NAMES, iconFile, iconSheet } from './icons.mjs';
import { SCENE_NAMES, FURS, scene } from './scenes.mjs';
import { FAQ, homeBody, homeJsonLd } from './home.mjs';
import { SITE, UPDATED, esc, page } from './layout.mjs';
import { guideBody, guideJsonLd, indexBody, indexJsonLd, notFoundBody, words } from './pages.mjs';
import { encodeQR, qrSvg } from '../../src/qr.js';
import { CHARACTERS, OBJECTS, markSvg } from './extras.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const here = join(root, 'scripts', 'site');
const check = process.argv.includes('--check');
const CACHE = join(here, 'highlight-cache.json');

// ---------- Guides ----------

function readGuides(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => {
      const src = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
      const m = /^<!--meta\n([\s\S]*?)\n-->\n([\s\S]*)$/.exec(src);
      if (!m) throw new Error(`${dir}/${f}: missing meta comment`);
      return { file: f, meta: JSON.parse(m[1]), body: m[2].trim() };
    });
}

// Reading order of the English guides.
const ORDER = ['chat-without-signing-up', 'voice-chat-in-browser-no-download', 'peer-to-peer-chat-explained', 'webrtc-connection-failed-strict-nat'];
const en = readGuides(join(here, 'guides')).sort((a, b) => ORDER.indexOf(a.meta.slug) - ORDER.indexOf(b.meta.slug));
const pt = readGuides(join(here, 'guides', 'pt'));
for (const g of pt) {
  const twin = en.find((x) => x.meta.slug === g.meta.en);
  if (!twin) throw new Error(`${g.meta.slug}: no English counterpart ${g.meta.en}`);
  twin.pt = g.meta.slug.replace(/^pt\//, 'pt/');
}

const problems = [];
for (const g of [...en, ...pt]) {
  const m = g.meta;
  const where = `guide ${m.slug}`;
  if (m.title.length > 65) problems.push(`${where}: title is ${m.title.length} characters`);
  if (m.description.length < 60 || m.description.length > 160) problems.push(`${where}: description is ${m.description.length} characters`);
  if (words(g.body) < 800) problems.push(`${where}: only ${words(g.body)} words`);
  if (!SCENE_NAMES.includes(m.scene)) problems.push(`${where}: unknown scene ${m.scene}`);
  if (!ICON_NAMES.includes(m.icon)) problems.push(`${where}: unknown icon ${m.icon}`);
  if (!m.faq?.length) problems.push(`${where}: no FAQ`);
}

// ---------- Code frames (Shiki, cached) ----------

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const used = {};
let highlighter = null;
async function loadShiki() {
  const require = createRequire(import.meta.url);
  const candidates = [() => require.resolve('shiki'), () => join(root, '..', 'graphemely', 'node_modules', 'shiki', 'dist', 'index.mjs')];
  for (const c of candidates) {
    try {
      const p = c();
      if (!existsSync(p)) continue;
      const shiki = await import(pathToFileURL(p).href);
      return shiki.createHighlighter({ themes: ['light-plus', 'dark-plus'], langs: ['js', 'html', 'bash', 'text'] });
    } catch {
      // try the next one
    }
  }
  return null;
}
async function highlight(code, lang) {
  const key = createHash('sha1').update(`${lang}\n${code}`).digest('hex').slice(0, 16);
  if (!cache[key] && !check) {
    highlighter ??= await loadShiki();
    if (!highlighter) throw new Error('Shiki is not installed: install it or keep a sibling graphemely checkout');
    const html = highlighter.codeToHtml(code, { lang, themes: { light: 'light-plus', dark: 'dark-plus' }, defaultColor: false });
    cache[key] = /<code>([\s\S]*)<\/code>/.exec(html)[1];
  }
  if (!cache[key]) throw new Error('a code sample changed: run node scripts/site/build-site.mjs to highlight it');
  used[key] = cache[key];
  return cache[key];
}
const FILE_ICONS = { js: ['#c9a400', 'JS'], html: ['#e44d26', '<>'], bash: ['#3f8f4f', '$_'], text: ['#6b7280', '>_'] };
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
let codeId = 0;
async function renderCode(body) {
  const re = /<pre data-kind="(\w+)"([^>]*)>\n([\s\S]*?)\n<\/pre>/g;
  let out = '';
  let last = 0;
  for (const m of body.matchAll(re)) {
    const attr = (name) => (new RegExp(`data-${name}="([^"]*)"`).exec(m[2]) || [])[1];
    const lang = attr('lang') || 'text';
    const title = attr('title') || 'snippet';
    const inner = await highlight(unescape(m[3]), lang);
    const [color, label] = FILE_ICONS[lang] || FILE_ICONS.text;
    const id = `code-${++codeId}`;
    out += body.slice(last, m.index);
    out += `<figure class="frame"><div class="frame-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="frame-tab"><svg class="file-ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect width="16" height="16" rx="3" fill="${color}"/><text x="8" y="11" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="6.4" font-weight="700" fill="#fff">${esc(label)}</text></svg><span>${esc(title)}</span></span><button type="button" class="frame-copy" v-copy-from="#${id}" aria-label="Copy ${esc(title)}"><svg class="ic" aria-hidden="true"><use href="#i-copy"/></svg><span>Copy</span></button></div><pre class="shiki" tabindex="0"><code id="${id}">${inner}</code></pre></figure>`;
    last = m.index + m[0].length;
  }
  return out + body.slice(last);
}

// ---------- Pages ----------

const out = {};
const guideList = en.map((g) => ({ slug: g.meta.slug, short: g.meta.short, icon: g.meta.icon, description: g.meta.description, h1: g.meta.h1 }));
const qr = qrSvg(encodeQR(`${SITE}app/`, { ecl: 'M' }), { margin: 2, dark: '#1e173f', light: '#ffffff', title: 'QR code that opens the howlden app' });

out['index.html'] = page(
  {
    kind: 'home', path: '', base: '', nav: '', og: 'og.png',
    title: 'howlden: group chat, voice and video in the browser',
    description: 'Talk with up to 5 friends in the browser. Share six words to connect. No account, and no server of ours in the middle.',
    jsonld: homeJsonLd(guideList),
  },
  homeBody({ guides: guideList, qr }),
  guideList,
);

for (const g of [...en, ...pt]) {
  codeId = 0;
  const isPt = g.meta.lang === 'pt-BR';
  const base = isPt ? '../' : '';
  const alternates = [];
  const enSlug = isPt ? g.meta.en : g.meta.slug;
  const ptSlug = isPt ? g.meta.slug : g.pt;
  if (ptSlug) alternates.push(['en', `${SITE}${enSlug}.html`], ['pt-BR', `${SITE}${ptSlug}.html`], ['x-default', `${SITE}${enSlug}.html`]);
  const rendered = { ...g, body: await renderCode(g.body) };
  out[`${g.meta.slug}.html`] = page(
    {
      kind: 'guide', path: `${g.meta.slug}.html`, base, lang: isPt ? 'pt' : 'en', nav: 'guides', ogType: 'article',
      og: `og/${g.meta.slug.replace('/', '-')}.png`, ogAlt: `${g.meta.h1}: a howlden guide`,
      title: g.meta.title, description: g.meta.description, alternates, jsonld: guideJsonLd(g),
    },
    guideBody(rendered, [...en, ...pt], base),
    guideList,
  );
}

out['guides.html'] = page(
  {
    kind: 'index', path: 'guides.html', base: '', nav: 'guides', og: 'og/guides.png',
    title: 'Guides | howlden',
    description: 'Getting started, voice and video calls, how the connection works, and what to do when it fails.',
    jsonld: indexJsonLd([...en, ...pt]),
  },
  indexBody(en, pt),
  guideList,
);

// The 404 page is served at any missing path, so its links are rooted.
const rootLinks = (html) => html.replace(/\b(href|src)="(?![a-z]+:|#|\/)([^"]*)"/g, (_, a, v) => `${a}="/howlden/${v.replace(/^\.\//, '')}"`);
out['404.html'] = rootLinks(
  page(
    { kind: 'notfound', path: '404.html', base: '', noindex: true, og: 'og.png', title: 'Page not found | howlden', description: 'This page could not be found. Head back to the den, or open the app.' },
    notFoundBody(),
    guideList,
  ),
);

// ---------- Search index ----------

const search = [
  { kind: 'Page', title: 'Open a den', sub: 'Start the app, no account needed', url: 'app/' },
  { kind: 'Page', title: 'Watch two friends connect', sub: 'An animated demo of six word pairing', url: './#demo' },
  { kind: 'Page', title: '30 second tour', sub: 'Six scenes, from opening the app to talking', url: './#tour' },
  { kind: 'Page', title: 'Live preview', sub: 'Try the app layout on the home page', url: './#preview' },
  { kind: 'Page', title: 'How inviting works', sub: 'Six words out, six words back', url: './#invite' },
  { kind: 'Page', title: 'Why it is private', sub: 'No server of ours, DTLS, relays, passphrase, fingerprint', url: './#private' },
  { kind: 'Page', title: 'Features', sub: 'Text, voice, video, screen share, files, reactions', url: './#chat' },
  { kind: 'Page', title: 'Server based or direct', sub: 'Two approaches compared', url: './#compare' },
  { kind: 'Page', title: 'All guides', sub: 'Every guide in English and Portuguese', url: 'guides.html' },
];
for (const g of [...en, ...pt]) {
  const lang = g.meta.lang === 'pt-BR' ? 'Guia' : 'Guide';
  search.push({ kind: lang, title: g.meta.h1, sub: g.meta.description, url: `${g.meta.slug}.html` });
  for (const m of g.body.matchAll(/<section id="([^"]+)"><h2>([\s\S]*?)<\/h2>/g)) search.push({ kind: 'Section', title: m[2].replace(/<[^>]+>/g, ''), sub: g.meta.short, url: `${g.meta.slug}.html#${m[1]}` });
  for (const f of g.meta.faq) search.push({ kind: 'Question', title: f.q.replace(/<[^>]+>/g, ''), sub: g.meta.short, url: `${g.meta.slug}.html#faq` });
}
for (const [q] of FAQ) search.push({ kind: 'Question', title: q, sub: 'Home FAQ', url: './#faq' });

// ---------- Sitemap and robots ----------

const pairs = Object.fromEntries(pt.flatMap((g) => [[g.meta.en, g.meta.slug], [g.meta.slug, g.meta.en]]));
const urls = ['', 'guides.html', ...en.map((g) => `${g.meta.slug}.html`), ...pt.map((g) => `${g.meta.slug}.html`)];
const alt = (u) => {
  const slug = u.replace(/\.html$/, '');
  if (!pairs[slug]) return '';
  const enS = slug.startsWith('pt/') ? pairs[slug] : slug;
  const ptS = slug.startsWith('pt/') ? slug : pairs[slug];
  return `\n    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${enS}.html"/>\n    <xhtml:link rel="alternate" hreflang="pt-BR" href="${SITE}${ptS}.html"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${enS}.html"/>`;
};
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>${SITE}</loc><lastmod>${UPDATED}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE}app/</loc><lastmod>${UPDATED}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
${urls.slice(1).map((u) => `  <url>\n    <loc>${SITE}${u}</loc><lastmod>${UPDATED}</lastmod><changefreq>monthly</changefreq><priority>${u === 'guides.html' ? '0.9' : '0.8'}</priority>${alt(u)}\n  </url>`).join('\n')}
</urlset>
`;

// ---------- Art ----------

function avatar(fur, opts = {}) {
  const P = { ...PAL.dark, ...FURS[fur] };
  const b = builder();
  b.open('translate(64 74) scale(.42)');
  lunaFace(P, b, { headset: opts.headset });
  b.close();
  const bg = { luna: '#3b2f86', grey: '#2c3a5e', snow: '#4a3d8f', brown: '#5a3a33' }[fur] || '#3b2f86';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><circle cx="64" cy="64" r="64" fill="${bg}"/>${b.art.join('')}</svg>\n`;
}

const files = {
  ...Object.fromEntries(Object.entries(out).map(([k, v]) => [`docs/${k}`, v])),
  'docs/search.json': `${JSON.stringify(search)}\n`,
  'docs/sitemap.xml': sitemap,
  'docs/robots.txt': `User-agent: *\nAllow: /\nDisallow: /howlden/404.html\n\nSitemap: ${SITE}sitemap.xml\n`,
  'docs/.nojekyll': '',
  'docs/favicon.svg': favicon(),
  'assets/favicon.svg': favicon(),
  'assets/mascot.svg': mascot('light'),
  'assets/mascot-dark.svg': mascot('dark'),
  'assets/mascot-head.svg': mascotHead('light'),
  'assets/mascot-head-dark.svg': mascotHead('dark'),
  'assets/banner.svg': banner('light'),
  'assets/banner-dark.svg': banner('dark'),
  'docs/assets/mascot.svg': mascot('light'),
  'docs/assets/mascot-dark.svg': mascot('dark'),
  'docs/assets/mascot-head.svg': mascotHead('light'),
  'docs/assets/mascot-head-dark.svg': mascotHead('dark'),
  'docs/assets/art/avatars/luna.svg': avatar('luna', { headset: true }),
  'docs/assets/art/avatars/fang.svg': avatar('grey'),
  'docs/assets/art/avatars/pip.svg': avatar('snow'),
  'docs/assets/art/avatars/nova.svg': avatar('brown'),
};
for (const [n, f] of Object.entries(OBJECTS)) files[`docs/assets/art/objects/${n}.svg`] = f();
for (const [n, f] of Object.entries(CHARACTERS)) {
  files[`docs/assets/art/characters/${n}.svg`] = f();
  files[`assets/characters/${n}.svg`] = f();
}
files['assets/mark.svg'] = markSvg('#7c5cff');
files['assets/icons-sheet.svg'] = `${iconSheet('light')}\n`;
files['assets/icons-sheet-dark.svg'] = `${iconSheet('dark')}\n`;
for (const theme of ['light', 'dark']) {
  for (const n of ICON_NAMES) files[`assets/icons/${theme}/${n}.svg`] = iconFile(n, theme);
  for (const n of SCENE_NAMES) {
    const s = scene(n, theme);
    files[`assets/illustrations/${theme}/${n}.svg`] = s;
    files[`docs/assets/art/${theme}/${n}.svg`] = s;
  }
}
void sticker;
void svg;

// ---------- House rules for every generated file ----------

for (const [name, content] of Object.entries(files)) {
  if (new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`).test(content)) problems.push(`${name}: contains an en or em dash`);
  if (/\p{Extended_Pictographic}/u.test(content)) problems.push(`${name}: contains an emoji`);
  if (new RegExp(['tail', 'wind|boot', 'strap|\\bbul', 'ma\\b'].join(''), 'i').test(content)) problems.push(`${name}: names another CSS framework`);
  if (new RegExp(`\\b${'A'}${'I'}\\b`).test(content.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ''))) problems.push(`${name}: names generated code`);
  if (name.endsWith('.html')) {
    // Voodoo reads { expressions } in text, so braces must stay inside code.
    const text = content.replace(/<(script|style|pre|code|kbd|samp|textarea|template|noscript)\b[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, '');
    const brace = /.{0,40}[{}].{0,40}/.exec(text);
    if (brace) problems.push(`${name}: braces outside code would be read by Voodoo: ${brace[0]}`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const cacheText = `${JSON.stringify(Object.fromEntries(Object.entries(used).sort()), null, 1)}\n`;
if (check) {
  const stale = Object.entries(files).filter(([name, content]) => !existsSync(join(root, name)) || readFileSync(join(root, name), 'utf8') !== content);
  if (stale.length) {
    console.error(`the site is out of date, run npm run site:\n${stale.map(([n]) => `  ${n}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`site: ${Object.keys(out).length} pages and ${Object.keys(files).length - Object.keys(out).length} other files are up to date`);
} else {
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(root, name, '..'), { recursive: true });
    writeFileSync(join(root, name), content);
  }
  writeFileSync(CACHE, cacheText);
  const counts = [...en, ...pt].map((g) => `${g.meta.slug} ${words(g.body)}`).join(', ');
  console.log(`site: built ${Object.keys(out).length} pages and ${Object.keys(files).length - Object.keys(out).length} other files\nwords: ${counts}`);
}
