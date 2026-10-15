// Guide pages, the guide index and the 404 page.
import { SCENES } from './scenes.mjs';
import { SITE, UPDATED, art, esc, icon, pic } from './layout.mjs';

const L = {
  en: { home: 'Home', guides: 'Guides', guide: 'Guide', updated: 'Updated', read: 'min read', toc: 'On this page', faq: 'Frequently asked questions', related: 'Keep reading', cta: 'Ready to try it?', ctaText: 'Open a den, share six words and talk. No account, no download, no server of ours.', open: 'Open a den', other: 'Leia em português', all: 'All guides' },
  pt: { home: 'Início', guides: 'Guias', guide: 'Guia', updated: 'Atualizado em', read: 'min de leitura', toc: 'Nesta página', faq: 'Perguntas frequentes', related: 'Continue lendo', cta: 'Quer experimentar?', ctaText: 'Abra um den, passe seis palavras e converse. Sem conta, sem download, sem servidor nosso.', open: 'Abrir um den', other: 'Read in English', all: 'Todos os guias' },
};

const DATE = { en: 'October 14, 2026', pt: '14 de outubro de 2026' };

export const words = (html) => html.replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Turns figure placeholders into pictures. */
function figures(body, base) {
  return body.replace(/<figure data-scene="([a-z-]+)"><\/figure>/g, (_, name) => {
    const s = SCENES[name];
    if (!s) throw new Error(`unknown scene ${name}`);
    return `<figure class="fig">${pic(base, name, s.alt)}<figcaption>${esc(s.alt)}</figcaption></figure>`;
  });
}

/** Adds the base to relative links when the page lives in a folder. */
export function rebase(html, base) {
  if (!base) return html;
  return html.replace(/\b(href|src)="(?![a-z]+:|#|\/|\.\.\/)([^"]*)"/g, (_, a, v) => `${a}="${v}"`);
}

export function guideBody(g, all, base) {
  const m = g.meta;
  const lang = m.lang === 'pt-BR' ? 'pt' : 'en';
  const t = L[lang];
  const toc = [...g.body.matchAll(/<section id="([^"]+)"><h2>([\s\S]*?)<\/h2>/g)].map(([, id, h]) => `<li><a href="#${id}">${h}</a></li>`).join('');
  const minutes = Math.max(3, Math.round(words(g.body) / 220));
  const faq = m.faq.map((f, i) => `<details class="faq-item"${i === 0 ? ' open' : ''}><summary><h3>${f.q}</h3>${icon('chevron', 'ic chev')}</summary><div class="faq-a"><p>${f.a}</p></div></details>`).join('');
  const same = all.filter((x) => (x.meta.lang === 'pt-BR') === (lang === 'pt') && x.meta.slug !== m.slug);
  const pick = (m.related || []).map((s) => same.find((x) => x.meta.slug === s)).filter(Boolean);
  for (const x of same) if (pick.length < 3 && !pick.includes(x)) pick.push(x);
  const href = (x) => (lang === 'pt' ? `${x.meta.slug.replace(/^pt\//, '')}.html` : `${x.meta.slug}.html`);
  const related = pick.slice(0, 3).map((x) => `<li><a href="${href(x)}" class="guide-card">${art(x.meta.icon, 'hi hi-lg')}<span><b>${esc(x.meta.short)}</b><small>${esc(x.meta.description)}</small></span></a></li>`).join('');
  const twin = lang === 'pt' ? `<a class="lang-link" href="../${m.en}.html" hreflang="en" lang="en">${icon('globe')}${t.other}</a>` : g.pt ? `<a class="lang-link" href="${g.pt}.html" hreflang="pt-BR" lang="pt-BR">${icon('globe')}${t.other}</a>` : '';
  const sc = SCENES[m.scene];
  return `
<article class="guide" lang="${lang === 'pt' ? 'pt-BR' : 'en'}">
  <header class="guide-hero">
    <div class="wrap guide-hero-grid">
      <div>
        <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${base || './'}">${t.home}</a></li><li><a href="${base}guides.html">${t.guides}</a></li><li aria-current="page">${esc(m.short)}</li></ol></nav>
        <p class="kicker">${art(m.icon)}${t.guide}</p>
        <h1>${esc(m.h1)}</h1>
        <p class="lede">${m.lede}</p>
        <p class="guide-meta"><span>${t.updated} <time datetime="${UPDATED}">${DATE[lang]}</time></span><span>${minutes} ${t.read}</span>${twin}</p>
      </div>
      ${pic(base, m.scene, sc.alt, { lazy: false, cls: 'guide-pic' })}
    </div>
  </header>
  <div class="wrap guide-layout">
    <aside class="side-toc" aria-labelledby="toc-title"><p id="toc-title" class="side-toc-title">${t.toc}</p><ol>${toc}<li><a href="#faq">${t.faq}</a></li></ol></aside>
    <div class="guide-prose">
${figures(g.body, base)}
      <section id="faq" class="guide-faq"><h2>${t.faq}</h2><div class="faq">${faq}</div></section>
      <aside class="cta-card">${pic(base, 'campfire-voice', '', { cls: 'cta-pic' })}<div><h2>${t.cta}</h2><p>${t.ctaText}</p><a href="${base}app/" class="btn btn-primary btn-lg open-den">${art('den')}${t.open}</a></div></aside>
      <nav class="related" aria-labelledby="rel-title"><h2 id="rel-title">${t.related}</h2><ul class="guide-grid">${related}</ul></nav>
    </div>
  </div>
</article>`;
}

export function guideJsonLd(g) {
  const m = g.meta;
  const url = `${SITE}${m.slug}.html`;
  const pt = m.lang === 'pt-BR';
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: m.h1,
      description: m.description,
      inLanguage: pt ? 'pt-BR' : 'en',
      url,
      mainEntityOfPage: url,
      image: `${SITE}og/${m.slug.replace('/', '-')}.png`,
      datePublished: UPDATED,
      dateModified: UPDATED,
      author: { '@type': 'Person', name: 'Alexandre Kohler', url: 'https://github.com/kwy404' },
      publisher: { '@type': 'Person', name: 'Alexandre Kohler', url: 'https://github.com/kwy404' },
      about: { '@type': 'WebApplication', name: 'howlden', url: SITE },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: pt ? 'pt-BR' : 'en',
      mainEntity: m.faq.map((f) => ({ '@type': 'Question', name: f.q.replace(/<[^>]+>/g, ''), acceptedAnswer: { '@type': 'Answer', text: f.a.replace(/<[^>]+>/g, '') } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'howlden', item: SITE },
        { '@type': 'ListItem', position: 2, name: pt ? 'Guias' : 'Guides', item: `${SITE}guides.html` },
        { '@type': 'ListItem', position: 3, name: m.short, item: url },
      ],
    },
  ];
}

export function indexBody(en, pt) {
  const card = (g, href) => `<li><a href="${href}" class="guide-card big">${pic('', g.meta.scene, '', { cls: 'card-pic' })}<span class="gc-b">${art(g.meta.icon, 'hi hi-lg')}<b>${esc(g.meta.short)}</b><small>${esc(g.meta.description)}</small></span></a></li>`;
  return `
<section class="guide-hero index-hero">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="./">Home</a></li><li aria-current="page">Guides</li></ol></nav>
    <p class="kicker">${art('study')}Guides</p>
    <h1>Guides from the den</h1>
    <p class="lede">Four short guides: getting started, calls, how the connection works, and what to do when it fails.</p>
  </div>
</section>
<section class="band" aria-labelledby="g-en"><div class="wrap"><h2 id="g-en" class="sr-only">English guides</h2><ul class="guide-grid big">${en.map((g) => card(g, `${g.meta.slug}.html`)).join('')}</ul></div></section>
<section class="band band-deep" aria-labelledby="g-pt" lang="pt-BR"><div class="wrap"><header class="sec-head"><p class="kicker">${icon('globe')}Em português</p><h2 id="g-pt">Guias em português</h2><p>Os mesmos dens, explicados em português do Brasil.</p></header><ul class="guide-grid big">${pt.map((g) => card(g, `${g.meta.slug}.html`)).join('')}</ul></div></section>`;
}

export function indexJsonLd(all) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'howlden guides',
      url: `${SITE}guides.html`,
      hasPart: all.map((g) => ({ '@type': 'TechArticle', headline: g.meta.h1, url: `${SITE}${g.meta.slug}.html`, inLanguage: g.meta.lang || 'en' })),
    },
  ];
}

export function notFoundBody() {
  return `
<section class="nf">
  <div class="wrap nf-in">
    ${pic('', 'lost-pup', 'A wolf pup with a lantern looks for a page that is not there', { lazy: false })}
    <div>
      <p class="kicker">${art('paw')}404</p>
      <h1>Lost in the woods</h1>
      <p class="lede">Luna followed the trail, but this page is not here. It may have moved, or the link has a typo.</p>
      <p class="hero-cta"><a href="./" class="btn btn-primary btn-lg">${art('den')}Back to the den</a><a href="guides.html" class="btn btn-ghost btn-lg">Browse the guides</a></p>
      <p class="nf-note">Looking for the app? <a href="app/">Open a den</a>. Searching? Press <kbd class="kbd kbd-xs">Ctrl K</kbd>.</p>
    </div>
  </div>
</section>`;
}
