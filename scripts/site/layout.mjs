// Shared page chrome for the howlden site: head, top bar, search dialog,
// icon sprite and footer. Pages live at the docs root or in docs/pt/, so every
// internal link is written relative to `p.base` ('' or '../').
import { ICON_NAMES, iconSymbol } from './icons.mjs';
import { markSymbol } from './extras.mjs';

export const SITE = 'https://kwy404.github.io/howlden/';
export const VERSION = '0.1.0';
export const GITHUB = 'https://github.com/kwy404/howlden';
export const AUTHOR_GH = 'https://github.com/kwy404';
export const AUTHOR_IN = 'https://www.linkedin.com/in/alexandre-silva-173687256/';
export const MONSOON_CSS = 'https://cdn.jsdelivr.net/npm/monsooncss@0.2.0/dist/monsoon.min.css';
export const VOODOO_JS = 'https://cdn.jsdelivr.net/npm/voodoojs@1.0.0/dist/voodoo.full.min.js';
export const UPDATED = '2026-10-14';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const MORE = [
  ['Monsoon', 'https://kwy404.github.io/monsoon/', 'Utility first CSS with no build step'],
  ['Voodoo.js', 'https://kwy404.github.io/Voodoo.js/', 'Reactive attributes for plain HTML'],
  ['filefinch', 'https://kwy404.github.io/filefinch/', 'Send files peer to peer, no server'],
  ['breakhound', 'https://kwy404.github.io/breakhound/', 'Find bugs in JavaScript libraries'],
  ['vueleap', 'https://kwy404.github.io/vueleap/', 'Vue 2 to Vue 3 migration'],
  ['graphemely', 'https://kwy404.github.io/graphemely/', 'Grapheme aware string utilities'],
  ['numberparrot', 'https://kwy404.github.io/numberparrot/', 'Parse localized numbers'],
  ['edgegoat', 'https://kwy404.github.io/edgegoat/', 'Edge case inputs for testing'],
  ['cookieowl', 'https://kwy404.github.io/cookieowl/', 'Cookie consent for LGPD and GDPR'],
  ['installkite', 'https://kwy404.github.io/installkite/', 'Make any website installable'],
  ['a11ymedic', 'https://kwy404.github.io/a11ymedic/', 'Accessibility checks with exact fixes'],
  ['fontsketch', 'https://kwy404.github.io/fontsketch/', 'Turn your handwriting into a font'],
  ['kastor', 'https://kwy404.github.io/kastor/', 'TypeScript ORM for many databases'],
];

// Strings that change with the page language.
export const T = {
  en: {
    skip: 'Skip to content', open: 'Open a den', search: 'Search', searchSite: 'Search the site', menu: 'Menu', theme: 'Switch theme',
    nav: [['how', 'How it works', './#invite'], ['private', 'Privacy', './#private'], ['features', 'Features', './#chat'], ['guides', 'Guides', 'guides.html'], ['faq', 'FAQ', './#faq']],
    placeholder: 'Search guides and questions', suggest: 'Luna suggests', empty: 'Nothing here. Luna sniffed every corner of the den.', enter: 'open', esc: 'close',
    tagline: 'A den for your pack: text and voice channels, video and screen share, peer to peer in the browser. No account, no server of ours, invite only.',
    site: 'The den', guides: 'Guides', more: 'More from kwy404', changelog: 'Changelog', source: 'Source code',
    made: 'Made by', built: 'Built with', inter: 'Interactive parts built with', license: 'MIT licensed. Free forever, no ads, no tracking.',
  },
  pt: {
    skip: 'Pular para o conteúdo', open: 'Abrir um den', search: 'Buscar', searchSite: 'Buscar no site', menu: 'Menu', theme: 'Trocar tema',
    nav: [['how', 'Como funciona', '../#invite'], ['private', 'Privacidade', '../#private'], ['features', 'Recursos', '../#chat'], ['guides', 'Guias', '../guides.html'], ['faq', 'Perguntas', '../#faq']],
    placeholder: 'Buscar guias e perguntas', suggest: 'Sugestões da Luna', empty: 'Nada por aqui. A Luna farejou o den inteiro.', enter: 'abrir', esc: 'fechar',
    tagline: 'Um den para a sua turma: canais de texto e voz, vídeo e compartilhamento de tela, peer to peer no navegador. Sem conta, sem servidor nosso, só com convite.',
    site: 'O den', guides: 'Guias', more: 'More from kwy404', changelog: 'Changelog', source: 'Código fonte',
    made: 'Made by', built: 'Built with', inter: 'Interactive parts built with', license: 'Licença MIT. Grátis para sempre, sem anúncios, sem rastreamento.',
  },
};

// UI icons (24 by 24, stroked with currentColor).
const UI = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  github: '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
  system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  hash: '<path d="M9 4 7 20M17 4l-2 16M4 9h16M3.5 15h16"/>',
  speaker: '<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  micoff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M3 3l18 18"/>',
  head: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/>',
  headoff: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/><path d="M3 3l18 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M12 13V7M9 10l3-3 3 3"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  phone: '<path d="M3 12c0-3 18-3 18 0v2a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-1.5c-2.5-1-5.5-1-8 0V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>',
  send: '<path d="M4 12 20 4l-4 16-4-7Z"/><path d="m12 13 8-9"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  clip: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L14.5 7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
};

/** An inline UI icon from the sprite. */
export const icon = (name, cls = 'ic') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
/** An icon from the howlden icon set (duotone, follows the theme). */
export const art = (name, cls = 'hi') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#k-${name}"/></svg>`;

/** An illustration as a light and a dark image; CSS shows the one for the theme. */
export function pic(base, name, alt, { lazy = true, cls = '' } = {}) {
  const l = lazy ? ' loading="lazy" decoding="async"' : ' fetchpriority="high"';
  return `<span class="pic${cls ? ` ${cls}` : ''}"><img class="only-light" src="${base}assets/art/light/${name}.svg" width="640" height="420" alt="${esc(alt)}"${l}><img class="only-dark" src="${base}assets/art/dark/${name}.svg" width="640" height="420" alt=""${l}></span>`;
}

export function sprite() {
  const ui = Object.entries(UI)
    .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`)
    .join('');
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${ui}${ICON_NAMES.map(iconSymbol).join('')}${markSymbol()}</svg>`;
}

const THEME_SNIPPET = `<script>(function(){try{var t=localStorage.getItem('voodoo:theme');if(t&&t.charAt(0)==='"')t=JSON.parse(t);var r=document.documentElement;if(t==='light'||t==='dark'){r.setAttribute('data-theme',t);r.style.colorScheme=t}else{r.removeAttribute('data-theme')}}catch(e){}})();</script>`;

const FONTS = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@500..900&amp;family=Figtree:ital,wght@0,400..800;1,400..600&amp;display=swap';

/**
 * The document head.
 * p: { path, base, lang, title, description, og, ogAlt, ogType, noindex, jsonld, alternates: [[hreflang, url]] }
 */
export function head(p) {
  const url = SITE + (p.path || '');
  const ld = (p.jsonld || []).map((j) => `\n<script type="application/ld+json">\n${JSON.stringify(j, null, 2)}\n</script>`).join('');
  const og = SITE + (p.og || 'og.png');
  const alts = (p.alternates || []).map(([l, u]) => `\n<link rel="alternate" hreflang="${l}" href="${u}">`).join('');
  return `<!doctype html>
<html lang="${p.lang === 'pt' ? 'pt-BR' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
${THEME_SNIPPET}
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
${p.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`}${alts}
<meta name="author" content="Alexandre Kohler">
<meta name="theme-color" content="#f7f4ff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d0a1f" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${p.ogType || 'website'}">
<meta property="og:site_name" content="howlden">
<meta property="og:locale" content="${p.lang === 'pt' ? 'pt_BR' : 'en_US'}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(p.ogAlt || 'howlden: Luna the wolf howls into her headset mic next to the campfire')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${og}">
<link rel="icon" href="${p.base}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${MONSOON_CSS}">
<link rel="stylesheet" href="${p.base}site.css">
<script src="${VOODOO_JS}" data-manual defer></script>
<script type="module" src="${p.base}site.js"></script>${ld}
</head>`;
}

/** The top bar. */
export function topbar(p) {
  const t = T[p.lang || 'en'];
  const links = t.nav
    .map(([key, label, href]) => {
      const h = p.lang === 'pt' ? href : p.base + href.replace(/^\.\//, './');
      return `<a href="${h === '' ? './' : h}" class="top-link"${key === p.nav ? ' aria-current="page"' : ''}>${label}</a>`;
    })
    .join('');
  const home = p.base || './';
  return `<a href="#main" class="skip-link">${t.skip}</a>
<header class="topbar" v-data="{ open: false }" @keydown.escape="open = false">
  <div class="wrap topbar-in">
    <a href="${home}" class="brand" aria-label="howlden home"><img src="${p.base}assets/mascot-head.svg" class="only-light" width="40" height="40" alt=""><img src="${p.base}assets/mascot-head-dark.svg" class="only-dark" width="40" height="40" alt=""><span class="brand-name">howl<b>den</b></span></a>
    <nav id="topnav" class="topnav" :class="{ 'is-open': open }" aria-label="Main" @click="open = false">${links}<a href="${p.base}app/" class="top-link top-open">${art('den')}${t.open}</a></nav>
    <div class="top-right">
      <button type="button" class="search-btn" data-search-open v-hotkey="mod+k" aria-haspopup="dialog" aria-label="${t.searchSite}">${icon('search')}<span class="search-label">${t.search}</span><kbd class="kbd kbd-xs">Ctrl K</kbd></button>
      <a href="${GITHUB}" class="icon-btn hide-xs" aria-label="howlden on GitHub">${icon('github')}</a>
      <button type="button" class="icon-btn theme-btn" v-theme-toggle.cycle aria-label="${t.theme}" title="Theme: system, dusk or night">${icon('system', 'ic ti-system')}${icon('sun', 'ic ti-light')}${icon('moon', 'ic ti-dark')}</button>
      <a href="${p.base}app/" class="btn btn-primary btn-sm open-btn">${t.open}</a>
      <button type="button" class="icon-btn nav-btn" aria-controls="topnav" :aria-expanded="open ? 'true' : 'false'" aria-expanded="false" @click="open = !open" aria-label="${t.menu}">${icon('menu')}</button>
    </div>
  </div>
</header>`;
}

/** The Ctrl K search dialog, filled by site.js from search.json. */
export function searchDialog(p) {
  const t = T[p.lang || 'en'];
  return `<dialog id="search" class="modal modal-top search-dlg" aria-label="${t.searchSite}">
  <div class="command-palette" v-data="{ q: '', sel: 0 }" @keydown.down.prevent="sel = Math.min(sel + 1, hits(q, S.ready).length - 1)" @keydown.up.prevent="sel = Math.max(sel - 1, 0)" @keydown.enter.prevent="go(q, sel)">
    <label class="command-palette-search">${icon('search')}<input id="search-input" class="command-palette-input" v-model="q" @input="sel = 0" placeholder="${t.placeholder}" autocomplete="off" spellcheck="false" aria-label="${t.search}" aria-controls="search-results"></label>
    <div id="search-results" class="command-palette-list" role="listbox" aria-label="Results">
      <p class="command-palette-heading" v-if="!q">${t.suggest}</p>
      <a v-for="(r, i) in hits(q, S.ready)" :key="r.url" :href="r.url" class="command-palette-item" role="option" :aria-selected="i === sel ? 'true' : 'false'" @mouseenter="sel = i"><span class="hit-kind" v-text="r.kind"></span><span class="hit-text"><span class="hit-title" v-text="r.title"></span><span class="hit-sub" v-text="r.sub"></span></span></a>
      <p class="command-palette-empty" v-if="q &amp;&amp; !hits(q, S.ready).length">${t.empty}</p>
    </div>
    <div class="command-palette-footer"><span><kbd class="kbd kbd-xs">Enter</kbd> ${t.enter}</span><span><kbd class="kbd kbd-xs">Esc</kbd> ${t.esc}</span></div>
  </div>
  <form method="dialog" class="modal-backdrop"><button aria-label="Close">Close</button></form>
</dialog>`;
}

/** The pine ridge and campfire that close every page. */
function footRidge() {
  const pines = [40, 120, 170, 300, 380, 470, 610, 700, 820, 905, 1010, 1090, 1160]
    .map((x, i) => {
      const s = [1, 0.7, 0.85, 0.6, 1.1, 0.75, 0.9, 0.65, 1, 0.8, 0.7, 1.05, 0.75][i];
      return `<path d="M${x} ${90 - 70 * s} l${16 * s} ${30 * s} h${-7 * s} l${13 * s} ${24 * s} h${-8 * s} l${15 * s} ${26 * s} h${-58 * s} l${15 * s} ${-26 * s} h${-8 * s} l${13 * s} ${-24 * s} h${-7 * s}Z"/>`;
    })
    .join('');
  return `<svg class="foot-ridge" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="r1" d="M0 70 C150 40 260 56 400 64 C560 40 700 46 860 62 C990 44 1100 50 1200 58 V100 H0Z"/><g class="r2">${pines}</g><path class="r3" d="M0 86 C200 74 420 80 600 84 C800 76 1000 78 1200 82 V100 H0Z"/></svg>`;
}

/** The footer, the same on every page. */
export function footer(p, guides) {
  const t = T[p.lang || 'en'];
  const b = p.base;
  const site = p.lang === 'pt' ? '../' : './';
  const g = guides.map((x) => `<li><a href="${b}${x.slug}.html">${esc(x.short)}</a></li>`).join('');
  const more = MORE.map(([n, u, d]) => `<li><a href="${u}">${n}</a><small>${d}</small></li>`).join('');
  return `<footer class="site-foot">
  ${footRidge()}
  <div class="foot-night">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-about">
        <a href="${b || './'}" class="brand"><img src="${b}assets/mascot-dark.svg" width="72" height="72" alt="" loading="lazy"><span class="brand-name">howl<b>den</b></span></a>
        <p>${t.tagline}</p>
        <p class="foot-links"><a href="${b}app/" class="btn btn-primary btn-sm">${art('den')}${t.open}</a><a href="${GITHUB}">${icon('github')}${t.source}</a><a href="${GITHUB}/blob/main/CHANGELOG.md">${t.changelog}</a></p>
      </div>
      <nav aria-labelledby="f-site"><h2 id="f-site" class="foot-title">${t.site}</h2><ul>
        <li><a href="${site}#tour">30 second tour</a></li><li><a href="${site}#preview">Live preview</a></li><li><a href="${site}#invite">How inviting works</a></li><li><a href="${site}#private">Why it is private</a></li><li><a href="${site}#chat">Features</a></li><li><a href="${site}#use-cases">Use cases</a></li><li><a href="${site}#compare">Server based or direct</a></li><li><a href="${site}#faq">FAQ</a></li><li><a href="${b}guides.html">All guides</a></li><li><a href="${b}pt/chat-sem-cadastro.html" hreflang="pt-BR">Em português</a></li>
      </ul></nav>
      <nav aria-labelledby="f-guides"><h2 id="f-guides" class="foot-title">${t.guides}</h2><ul>${g}</ul></nav>
      <nav aria-labelledby="f-more"><h2 id="f-more" class="foot-title">${t.more}</h2><ul class="foot-more">${more}</ul></nav>
    </div>
    <div class="foot-bottom">
      <p>${t.made} <a href="${AUTHOR_GH}" rel="me noopener">Alexandre Kohler</a><a href="${AUTHOR_GH}" class="foot-ic" rel="me noopener" aria-label="Alexandre Kohler on GitHub">${icon('github')}</a><a href="${AUTHOR_IN}" class="foot-ic" rel="me noopener" aria-label="Alexandre Kohler on LinkedIn">${icon('linkedin')}</a></p>
      <p>${t.built} <a href="https://kwy404.github.io/monsoon/">Monsoon</a>. ${t.inter} <a href="https://kwy404.github.io/Voodoo.js/">Voodoo.js</a>. ${t.license}</p>
    </div>
  </div>
  <p class="wordmark" aria-hidden="true"><svg class="wm-mark"><use href="#mark"/></svg><span>howlden</span></p>
  </div>
</footer>`;
}

/** Wraps a page body with the shared chrome. */
export function page(p, body, guides) {
  return `${head(p)}
<body class="antialiased page-${p.kind}">
${sprite()}
<div class="sky" aria-hidden="true"></div>
${topbar(p)}
<main id="main">
${body}
</main>
${footer(p, guides)}
${searchDialog(p)}
</body>
</html>
`;
}
